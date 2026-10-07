import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { isRealm, sameRealm, bounded, isResourceScope } from '@arbi/gredice';
import type { AuthorizedContext, AuthorizationObservation, ResourceResolver } from '@arbi/gredice';
import type { Realm, Event } from '@arbi/protocol';
import type { SqlDatabase } from '../enrollment/store';
import { prove } from '../enrollment/crypto';
import { PostgresJobStore } from '../jobs/store';
import { exact, id, milliseconds } from '../jobs/contracts';
import type { CurrentAuthority } from '../jobs/contracts';
import { scope } from '../audit/store';
import { VERSION, RealtimeError, cursor } from './contracts';
import type { Broker, Grant, Notification } from './contracts';

type Tx = Parameters<Parameters<PostgresJobStore['transaction']>[1]>[0];
type GrantRow = { record: Grant; revoked: boolean; heartbeat_at_ms: string } & Record<string, unknown>;
type Head = { epoch: string; cursor: string } & Record<string, unknown>;
/** Inventory lock also orders merged job mutations and additive trigger outbox.
 * All grants, presence, acknowledgements and retry budgets survive instance churn. */
export class RealtimeStore {
  readonly jobs: PostgresJobStore;
  constructor(db: SqlDatabase, readonly realm: Realm, currentAuthority: CurrentAuthority, readonly broker: Broker, readonly resolveSite: ResourceResolver) {
    this.jobs = new PostgresJobStore(db,realm,currentAuthority);
  }
  authorization(record: AuthorizationObservation, signal: AbortSignal) { return this.jobs.authorization(record,signal); }
  async head(tx: Tx): Promise<Head> {
    await tx.sql.query('SET LOCAL synchronous_commit=on');
    const key = scope(this.realm,tx.registry.siteId);
    await tx.sql.query('INSERT INTO arbi_realtime_sites(environment,namespace_id,site_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',key);
    return (await tx.sql.query<Head>('SELECT epoch,cursor::text FROM arbi_realtime_sites WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 FOR UPDATE',key)).rows[0];
  }
  async valid(tx: Tx, grant: Grant): Promise<boolean> {
    if (!sameRealm(grant.realm,this.realm) || grant.siteId !== tx.registry.siteId || grant.expiresAtMs <= tx.now) return false;
    try {
      const current=await bounded(1000,(signal) => this.resolveSite({realm:this.realm,siteId:grant.siteId,resource:{kind:'site',id:grant.siteId},signal}));
      await this.jobs.tick(tx);
      if(!isResourceScope(current) || !sameRealm(current.realm,this.realm) || current.siteId!==grant.siteId || current.accountId!==tx.registry.accountId ||
        current.resource.kind!=='site' || current.resource.id!==grant.siteId || current.executionMode!=='simulation' || grant.expiresAtMs<=tx.now) return false;
    } catch { return false; }
    if (grant.principal.kind === 'human') {
      try {
        const current = await this.jobs.authority(tx,grant.principal.authority);
        return current.membershipRevision === grant.principal.authority.membershipRevision;
      } catch { return false; }
    }
    const p = grant.principal;
    const device = tx.registry.devices.find((d) => d.id === p.deviceId && d.role === 'edge' && d.status === 'active' && d.revokedAtMs === null);
    return !!device && isDeepStrictEqual(device.current,p.identity) && device.appliedConfigRevision === p.configRevision &&
      tx.registry.configRevision === p.configRevision && device.credentials.some((c) => c.id === p.credentialId && c.createdAtMs <= tx.now && c.expiresAtMs > tx.now && c.revokedAtMs === null);
  }
  async revoke(tx: Tx, grant: Grant): Promise<void> {
    await tx.sql.query('UPDATE arbi_realtime_grants SET revoked=true,revoke_pending=true WHERE id=$1 AND revoked=false',[grant.id]);
  }
  async budget(tx: Tx, principal: string): Promise<void> {
    const key = [...scope(this.realm,tx.registry.siteId),principal];
    const row = (await tx.sql.query<{ window_ms: string; attempts: number }>('SELECT window_ms,attempts FROM arbi_realtime_budgets WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND principal=$4',key)).rows[0];
    const fresh = !row || tx.now-Number(row.window_ms) >= 60000;
    if (!fresh && row.attempts >= 8) throw new RealtimeError('CAPACITY');
    await tx.sql.query(`INSERT INTO arbi_realtime_budgets VALUES($1,$2,$3,$4,$5,$6)
      ON CONFLICT(environment,namespace_id,site_id,principal) DO UPDATE SET window_ms=EXCLUDED.window_ms,attempts=EXCLUDED.attempts`,[...key,fresh ? tx.now : Number(row.window_ms),fresh ? 1 : row.attempts+1]);
    await tx.sql.query('DELETE FROM arbi_realtime_budgets WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND window_ms<$4',[...key.slice(0,3),tx.now-60000]);
  }
  async admit(tx: Tx, principal: Grant['principal'], priorId: unknown): Promise<{ grant: Grant; token: unknown }> {
    const key = scope(this.realm,tx.registry.siteId);
    await this.budget(tx,principal.kind === 'human' ? `human:${principal.authority.actor.id}` : `device:${principal.deviceId}`);
    await tx.sql.query('DELETE FROM arbi_realtime_grants WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND expires_at_ms<$4',[...key,tx.now-60000]);
    const count = (await tx.sql.query<{ count: string }>('SELECT count(*)::text FROM arbi_realtime_grants WHERE environment=$1 AND namespace_id=$2 AND site_id=$3',key)).rows[0];
    if (Number(count.count) >= 64) throw new RealtimeError('CAPACITY');
    let originalExpiry = tx.now+30000;
    if (priorId !== null) {
      id(priorId);
      const prior = (await tx.sql.query<GrantRow>('SELECT record,revoked,heartbeat_at_ms FROM arbi_realtime_grants WHERE id=$1 AND environment=$2 AND namespace_id=$3 AND site_id=$4',[priorId,...key])).rows[0];
      if (!prior || prior.revoked || !await this.valid(tx,prior.record) || !samePrincipal(prior.record.principal,principal)) throw new RealtimeError('DENIED');
      originalExpiry = prior.record.expiresAtMs;
      await this.revoke(tx,prior.record);
    }
    const expiresAtMs = Math.min(originalExpiry,principal.kind === 'human' ? principal.authority.expiresAtMs :
      tx.registry.devices.find((d) => d.id === principal.deviceId)!.credentials.find((c) => c.id === principal.credentialId)!.expiresAtMs);
    const grantId = randomUUID();
    const hash = createHash('sha256').update(JSON.stringify([this.realm,tx.registry.siteId,principal,grantId])).digest('hex');
    const clientId = `arbi-${hash}`;
    const channel = `arbi:${this.realm.environment}:${this.realm.namespaceId}:${tx.registry.siteId}:state:${hash}`;
    const grant: Grant = { id: grantId,realm: this.realm,siteId: tx.registry.siteId,channel,clientId,expiresAtMs,principal };
    if (!await this.valid(tx,grant)) throw new RealtimeError('DENIED');
    const actor = principal.kind === 'human' ? principal.authority.actor : { kind: 'device' as const,id: principal.deviceId };
    const event = await this.jobs.event(tx,{ actor,sessionId: principal.kind === 'human' ? principal.authority.sessionId : principal.identity.sessionId } as AuthorizedContext,
      'authorization.check',{ kind: 'site',id: grant.siteId,deviceId: principal.kind === 'device' ? principal.deviceId : null });
    event.evidence='authorization';event.outcome='allow';event.reason='authorized';event.links.intentEventId=null;
    await this.jobs.audit.stage(tx.sql,event,{ action: event.action,evidence: event.evidence,record: event.record,realm: event.realm,executionMode: event.executionMode,
      siteId: event.siteId,authenticatedSource: event.source,actor: event.actor,resource: event.resource,links: event.links,metadata: event.metadata,change: event.change });
    await tx.sql.query(`INSERT INTO arbi_realtime_grants(id,environment,namespace_id,site_id,client_id,channel,record,expires_at_ms,heartbeat_at_ms)
      VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)`,[grant.id,...key,clientId,channel,JSON.stringify(grant),expiresAtMs,tx.now-1000]);
    await this.jobs.tick(tx);
    const token = await this.broker.issue(grant,Math.min(30000,expiresAtMs-tx.now-250));
    await this.jobs.tick(tx);
    if (!await this.valid(tx,grant)) throw new RealtimeError('EXPIRED');
    return { grant,token };
  }
  async human(context: AuthorizedContext, action: 'attach' | 'recover', input: unknown): Promise<unknown> {
    return this.jobs.transaction(context.siteId,async (tx) => {
      await this.jobs.authority(tx,context);
      if (context.actor.kind !== 'human' || context.capability !== 'state.read') throw new RealtimeError('DENIED');
      if (action === 'attach') {
        exact(input,['grantId']);return this.admit(tx,{ kind: 'human',authority: context },input.grantId);
      }
      return this.recover(tx,input,{ kind: 'human',authority: context });
    });
  }
  async device(siteId: string, input: unknown, accountId?: string): Promise<unknown> {
    exact(input,['version','realm','siteId','deviceId','credentialId','identity','issuedAtMs','expiresAtMs','action','payload','signature']);
    if (input.version !== VERSION || !isRealm(input.realm) || !sameRealm(input.realm,this.realm) || input.siteId !== siteId || !['attach','recover'].includes(String(input.action))) throw new RealtimeError('INVALID_REQUEST');
    id(input.deviceId);id(input.credentialId);milliseconds(input.issuedAtMs,0,Number.MAX_SAFE_INTEGER);milliseconds(input.expiresAtMs,0,Number.MAX_SAFE_INTEGER);
    const request = structuredClone(input);
    return this.jobs.transaction(siteId,async (tx) => {
      if (accountId !== undefined && accountId !== tx.registry.accountId) throw new RealtimeError('DENIED');
      const device = this.jobs.activeDevice(tx,String(request.deviceId));
      const credential = device.credentials.find((c) => c.id === request.credentialId && c.createdAtMs <= tx.now && c.expiresAtMs > tx.now && c.revokedAtMs === null);
      if (!credential || !isDeepStrictEqual(device.current,request.identity) || Number(request.issuedAtMs) > tx.now+100 || Number(request.expiresAtMs) <= tx.now ||
        Number(request.expiresAtMs)-Number(request.issuedAtMs) > 10000 || Number(request.expiresAtMs) <= Number(request.issuedAtMs)) throw new RealtimeError('DENIED');
      const { signature,...unsigned } = request;
      try { prove(credential.publicKey,unsigned,signature); } catch { throw new RealtimeError('DENIED'); }
      const principal: Grant['principal'] = { kind: 'device',deviceId: device.id,credentialId: credential.id,identity: device.current!,configRevision: tx.registry.configRevision };
      if (request.action === 'attach') { exact(request.payload,['grantId']);return this.admit(tx,principal,request.payload.grantId); }
      return this.recover(tx,request.payload,principal);
    });
  }
  async recover(tx: Tx, input: unknown, principal: Grant['principal']): Promise<unknown> {
    exact(input,['grantId','epoch','cursor']);id(input.grantId);
    if (input.epoch !== null) id(input.epoch);
    if (input.cursor !== null) cursor(input.cursor);
    if ((input.epoch === null) !== (input.cursor === null)) throw new RealtimeError('INVALID_REQUEST');
    const key = scope(this.realm,tx.registry.siteId);
    const row = (await tx.sql.query<GrantRow>('SELECT record,revoked,heartbeat_at_ms FROM arbi_realtime_grants WHERE id=$1 AND environment=$2 AND namespace_id=$3 AND site_id=$4',[input.grantId,...key])).rows[0];
    if (!row || row.revoked || !await this.valid(tx,row.record)) throw new RealtimeError('DENIED');
    const old = row.record.principal;
    // Fresh HTTP authorization may have a newer directory freshness deadline,
    // but must never change the original grant's session/membership/expiry.
    if (old.kind !== principal.kind || (old.kind === 'human' && principal.kind === 'human' ?
      old.authority.actor.id !== principal.authority.actor.id || old.authority.sessionId !== principal.authority.sessionId || old.authority.membershipRevision !== principal.authority.membershipRevision :
      !isDeepStrictEqual(old,principal))) throw new RealtimeError('DENIED');
    if (tx.now-Number(row.heartbeat_at_ms) < 500) throw new RealtimeError('CAPACITY');
    const head = await this.head(tx);
    const first = (await tx.sql.query<{ cursor: string }>('SELECT min(cursor)::text AS cursor FROM arbi_realtime_events WHERE environment=$1 AND namespace_id=$2 AND site_id=$3',key)).rows[0]?.cursor;
    const reset = input.cursor === null || input.epoch !== head.epoch || BigInt(input.cursor) > BigInt(head.cursor) || (first && BigInt(input.cursor) < BigInt(first)-1n);
    const notifications = reset ? [] : (await tx.sql.query<{ cursor: string; kind: string }>('SELECT cursor::text,kind FROM arbi_realtime_events WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND cursor>$4 ORDER BY cursor LIMIT 32',[...key,input.cursor])).rows;
    const next = reset ? head.cursor : notifications.at(-1)?.cursor ?? input.cursor;
    await tx.sql.query('UPDATE arbi_realtime_grants SET heartbeat_at_ms=$2,acknowledged_cursor=$3 WHERE id=$1',[row.record.id,tx.now,reset ? '0' : input.cursor]);
    let snapshot: unknown = null;
    const more = BigInt(String(next)) < BigInt(head.cursor);
    if (reset || !more) {
      const states = (await tx.sql.query<{ record: {event: Event;receivedAtMs: number} }>('SELECT record FROM arbi_job_receivers WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 ORDER BY device_id LIMIT 32',key)).rows;
      const jobs = (await tx.sql.query<{ id: string; record: Record<string,unknown> }>('SELECT id,record FROM arbi_command_jobs WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 ORDER BY expires_at_ms DESC,id LIMIT 64',key)).rows;
      snapshot = { configRevision: tx.registry.configRevision,devices: tx.registry.devices.slice(0,32).map((d) => ({ id: d.id,status: d.status,identity: d.current,configRevision: d.appliedConfigRevision })),
        states: states.map(({record}) => ({...record,provenance:'authenticated-device-report',freshness: tx.now-record.receivedAtMs<=5000 &&
          record.event.body.type==='state.snapshot' && record.event.body.configRevision===tx.registry.configRevision &&
          tx.registry.devices.some((d) => d.status==='active' && isDeepStrictEqual(d.current,record.event.source)) ? 'current' : 'stale'})),
        jobs: jobs.map((j) => ({ id: j.id,cloudDisposition: j.record.cloudDisposition,deviceStatus: j.record.deviceStatus })),
        coverage: 'bounded-current-view',authority: 'HTTPS reads; job poll independently reauthorizes' };
    }
    const response = { version: VERSION,realm: this.realm,siteId: tx.registry.siteId,epoch: head.epoch,cursor: next,reset: !!reset,snapshot,notifications,more,
      expiresAtMs: row.record.expiresAtMs,heartbeatAfterMs: 2500 };
    if (Buffer.byteLength(JSON.stringify(response)) > 65536) throw new RealtimeError('CAPACITY');
    return response;
  }
  /** Operator-scheduled bounded work, not a background loop in a Vercel request.
   * Reauthorize before each per-client publication. Notifications coalesce to head. */
  async maintain(siteId: string): Promise<{ published: number; revoked: number }> {
    return this.jobs.transaction(siteId,async (tx) => {
      const key = scope(this.realm,siteId);const head = await this.head(tx);
      const rows = (await tx.sql.query<GrantRow>('SELECT record,revoked,heartbeat_at_ms FROM arbi_realtime_grants WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 ORDER BY id LIMIT 64',key)).rows;
      const outbox = (await tx.sql.query<{ cursor: string; attempts: number; next_at_ms: string; pending: boolean }>('SELECT cursor::text,attempts,next_at_ms,pending FROM arbi_realtime_outbox WHERE environment=$1 AND namespace_id=$2 AND site_id=$3',key)).rows[0];
      let published=0,revoked=0,failed=false;
      for (const row of rows) {
        if (performance.now()-tx.startedAt > 2500) { failed=true;break; }
        if (!row.revoked && (!await this.valid(tx,row.record) || tx.now-Number(row.heartbeat_at_ms) > 10000)) { await this.revoke(tx,row.record);row.revoked=true; }
        if (row.revoked) {
          const retry = (await tx.sql.query<{ revoke_pending: boolean; revoke_attempts: number; next_revoke_ms: string }>('SELECT revoke_pending,revoke_attempts,next_revoke_ms FROM arbi_realtime_grants WHERE id=$1',[row.record.id])).rows[0];
          if (!retry.revoke_pending || retry.revoke_attempts >= 8 || Number(retry.next_revoke_ms)>tx.now) continue;
          try { await this.broker.revoke(row.record.clientId);await tx.sql.query('UPDATE arbi_realtime_grants SET revoke_pending=false WHERE id=$1',[row.record.id]);revoked++; }
          catch { await tx.sql.query('UPDATE arbi_realtime_grants SET revoke_attempts=revoke_attempts+1,next_revoke_ms=$2 WHERE id=$1',[row.record.id,tx.now+Math.min(60000,1000*2**retry.revoke_attempts)+Math.floor(Math.random()*500)]); }
        } else if (outbox?.pending && outbox.attempts<8 && Number(outbox.next_at_ms)<=tx.now) {
          const notice: Notification = { version: VERSION,realm: this.realm,siteId,epoch: head.epoch,cursor: outbox.cursor };
          try { await this.broker.publish(row.record.channel,notice);published++; } catch { failed=true; }
        }
      }
      if (outbox?.pending && outbox.attempts<8 && Number(outbox.next_at_ms)<=tx.now) await tx.sql.query(`UPDATE arbi_realtime_outbox SET pending=$4,attempts=attempts+1,next_at_ms=$5
        WHERE environment=$1 AND namespace_id=$2 AND site_id=$3`,[...key,failed,tx.now+Math.min(60000,1000*2**outbox.attempts)+Math.floor(Math.random()*500)]);
      return { published,revoked };
    });
  }
}
function samePrincipal(a: Grant['principal'], b: Grant['principal']): boolean {
  if (a.kind === 'human' && b.kind === 'human') {
    const { expiresAtMs: _a,...one } = a.authority;const { expiresAtMs: _b,...two } = b.authority;
    return isDeepStrictEqual(one,two);
  }
  return isDeepStrictEqual(a,b);
}
