import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { checked, contentHash, digest } from '@arbi/audit';
import { bounded, sameRealm, type AuthorizedContext } from '@arbi/gredice';
import type { AuditEvent } from '@arbi/protocol';
import { JobError } from '../jobs/contracts';
import { PostgresJobStore } from '../jobs/store';
import { auditQuery, QUERY_VERSION, retentionExpired, retentionPolicy, type AuditQuery, type DataClass, type RetentionPolicy } from './query-contracts';
import { scope } from './store';

type Tx=Parameters<Parameters<PostgresJobStore['transaction']>[1]>[0];
interface Row extends Record<string,unknown>{ordinal:string;origin:string;id:string;record:AuditEvent|null;received_at:string;retired_at_ms:string|null;record_digest:string|null;content_hash:string|null;hash:string|null;previous_hash:string|null}
export interface QueryStoreOptions {key:Uint8Array;lifecycle?:PostgresJobStore;steward?:(context:AuthorizedContext)=>Promise<boolean>}
export class AuditQueryStore {
  readonly #key:Buffer;
  constructor(readonly jobs:PostgresJobStore,readonly options:QueryStoreOptions){if(options.key.length<32)throw new JobError('DENIED');this.#key=Buffer.from(options.key);
    if(options.lifecycle && !sameRealm(options.lifecycle.realm,jobs.realm))throw new JobError('DENIED');}
  #mac(value:string){return createHmac('sha256',this.#key).update(value).digest('base64url');}
  #pseudonym(context:AuthorizedContext,id:string){return this.#mac(JSON.stringify([context.realm,context.siteId,id]));}
  #cursor(token:string,hash:string,now:number){
    try{const [body,mac,...extra]=token.split('.');if(extra.length || !body || !mac)throw Error();const a=Buffer.from(this.#mac(body)),b=Buffer.from(mac);if(a.length!==b.length || !timingSafeEqual(a,b))throw Error();
      const p=JSON.parse(Buffer.from(body,'base64url').toString());if(p.version!==QUERY_VERSION || p.hash!==hash || !Number.isSafeInteger(p.expiresAtMs) || p.expiresAtMs<=now ||
        ![p.upper,p.after].every(v=>typeof v==='string' && /^(0|[1-9][0-9]{0,18})$/.test(v) && BigInt(v)<=9223372036854775807n) || BigInt(p.after)>BigInt(p.upper))throw Error();return p as {upper:string;after:string;expiresAtMs:number};
    }catch{throw new JobError('INVALID_REQUEST');}
  }
  #view(row:Row,context:AuthorizedContext){
    if(!row.record)return {id:row.id,origin:row.origin,ordinal:row.ordinal,retired:true,retiredAtMs:Number(row.retired_at_ms),recordDigest:row.record_digest,contentHash:row.content_hash};
    const e=checked(row.record,true);if(e.siteId!==context.siteId || !sameRealm(e.realm,context.realm))throw new JobError('DENIED');
    return {id:e.eventId,origin:row.origin,ordinal:row.ordinal,retired:false,actor:{kind:e.actor.kind,id:this.#pseudonym(context,e.actor.id)},actorIdentity:'site-scoped pseudonym',
      source:e.source,sequence:e.sequence,sourceTime:e.sourceTime,ingestTime:e.ingestTime,resource:e.resource,action:e.action,evidence:e.evidence,outcome:e.outcome,reason:e.reason,effect:e.effect,
      links:e.links,metadata:e.metadata,change:e.change,contentHash:contentHash(e),recordDigest:digest(e),chain:row.origin==='durable'?{previousHash:row.previous_hash,hash:row.hash}:null};
  }
  async search(context:AuthorizedContext,input:unknown,exporting=false){const q=auditQuery(input);return this.jobs.transaction(context.siteId,async tx=>{
    await this.jobs.authority(tx,context);if(context.capability!==(exporting?'audit.export':'audit.read'))throw new JobError('DENIED');
    await tx.sql.query("SELECT pg_advisory_xact_lock(hashtextextended(jsonb_build_array('arbi-audit-index',$1::text,$2::text,$3::text)::text,0))",scope(context.realm,context.siteId));
    const {cursor:_,...filter}=q,hash=digest([context.realm,context.siteId,context.actor,context.sessionId,filter]);
    const head=(await tx.sql.query<{upper:string}>("SELECT coalesce(max(ordinal),0)::text AS upper FROM arbi_audit_query_index WHERE environment=$1 AND namespace_id=$2 AND site_id=$3",scope(context.realm,context.siteId))).rows[0].upper;
    const page=q.cursor?this.#cursor(q.cursor,hash,tx.now):{upper:head,after:'0',expiresAtMs:Math.min(tx.now+300000,context.expiresAtMs)};
    if(BigInt(page.upper)>BigInt(head))throw new JobError('INVALID_REQUEST');
    const params:unknown[]=[...scope(context.realm,context.siteId),q.fromMs,q.toMs,page.upper,page.after];
    const clauses=['i.environment=$1','i.namespace_id=$2','i.site_id=$3',"i.received_at>=to_timestamp($4::double precision/1000)","i.received_at<to_timestamp($5::double precision/1000)",'i.ordinal<=$6::bigint','i.ordinal>$7::bigint'];
    const paths:Record<string,string>={actorId:"h.record->'actor'->>'id'",deviceId:"h.record->'resource'->>'deviceId'",action:"h.record->>'action'",resourceId:"h.record->'resource'->>'id'",outcome:"h.record->>'outcome'",correlationId:"h.record->'links'->>'correlationId'",sessionId:"h.record->'links'->>'sessionId'"};
    for(const [key,path] of Object.entries(paths))if(q[key as keyof AuditQuery]!==undefined){params.push(q[key as keyof AuditQuery]);clauses.push(`${path}=$${params.length}`);}
    const limit=exporting?1000:q.limit;params.push(limit+1);
    const rows=(await tx.sql.query<Row>(`SELECT i.ordinal::text,i.origin,i.id,i.received_at::text,h.record,r.retired_at_ms::text,r.record_digest,r.content_hash,e.hash,e.previous_hash
      FROM arbi_audit_query_index i JOIN arbi_audit_history h ON h.origin=i.origin AND h.id=i.id
      LEFT JOIN arbi_audit_retirements r ON r.origin=i.origin AND r.event_id=i.id
      LEFT JOIN arbi_audit_events e ON i.origin='durable' AND e.id=i.id WHERE ${clauses.join(' AND ')} ORDER BY i.ordinal LIMIT $${params.length}`,params)).rows;
    if(exporting && rows.length>limit)throw new JobError('CAPACITY');
    const visible=rows.slice(0,limit),events=visible.map(row=>this.#view(row,context));
    const retired=(await tx.sql.query<{n:string}>(`SELECT count(*)::text AS n FROM arbi_audit_query_index i JOIN arbi_audit_retirements r ON r.origin=i.origin AND r.event_id=i.id
      WHERE i.environment=$1 AND i.namespace_id=$2 AND i.site_id=$3 AND i.received_at>=to_timestamp($4::double precision/1000) AND i.received_at<to_timestamp($5::double precision/1000) AND i.ordinal<=$6::bigint`,params.slice(0,6))).rows[0].n;
    const makeCursor=(after:string)=>{const body=Buffer.from(JSON.stringify({version:QUERY_VERSION,hash,upper:page.upper,after,expiresAtMs:page.expiresAtMs})).toString('base64url');return `${body}.${this.#mac(body)}`;};
    const payload={version:QUERY_VERSION,siteId:context.siteId,realm:context.realm,filter,snapshot:{upper:page.upper,expiresAtMs:page.expiresAtMs,cursor:makeCursor('0')},events,
      coverage:{timeBasis:'trusted receipt / conservative migration receipt',retiredPayloadsInWindow:Number(retired),retiredFilterMatches:'unknown',durableChain:'hashes and explicit retirement receipts; legacy origins are unchained',sourceClocks:'original; UTC may be unknown'},
      nextCursor:rows.length>limit?makeCursor(visible.at(-1)!.ordinal):null};
    if(Buffer.byteLength(JSON.stringify(payload))>(exporting?8388608:1048576))throw new JobError('CAPACITY');
    await this.jobs.authority(tx,context);
    return exporting?{...payload,schema:'arbi.audit-export/1.0',integrity:{algorithm:'SHA-256 canonical JSON',digest:digest(payload),signature:'none'},redaction:'Closed audit vocabulary, site-scoped actor pseudonyms; no raw request/media/credentials'}:payload;
  },1500);}
  async #steward(store:PostgresJobStore,tx:Tx,context:AuthorizedContext){
    await store.authority(tx,context);
    if(context.capability!=='configuration.write' || !this.options.steward)throw new JobError('DENIED');
    let allowed:boolean;try{allowed=await bounded(1000,()=>this.options.steward!(structuredClone(context)));}catch{throw new JobError('UNAVAILABLE');}
    if(!allowed)throw new JobError('DENIED');await store.authority(tx,context);
  }
  async #approval(store:PostgresJobStore,tx:Tx,context:AuthorizedContext,id:string){
    const root=await store.event(tx,context,'configuration.change',{kind:'configuration',id,deviceId:null});root.metadata={permission:'configure',configRevision:id};
    await store.admit(tx,root);await tx.sql.query('INSERT INTO arbi_audit_deliveries(id) VALUES($1)',[root.eventId]);return root.eventId;
  }
  policy(context:AuthorizedContext,input:unknown){const p=retentionPolicy(input);return this.jobs.transaction(context.siteId,async tx=>{
    await this.#steward(this.jobs,tx,context);const key=[...scope(context.realm,context.siteId),p.class,p.revision];
    const prior=(await tx.sql.query<{record:RetentionPolicy;intent_id:string}>('SELECT record,intent_id FROM arbi_audit_retention_policies WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND class=$4 AND revision=$5',key)).rows[0];
    if(prior){if(digest(prior.record)!==digest(p))throw new JobError('CONFLICT');return {policy:p,intentId:prior.intent_id};}
    const count=Number((await tx.sql.query<{n:string}>('SELECT count(*)::text n FROM arbi_audit_retention_policies WHERE environment=$1 AND namespace_id=$2 AND site_id=$3',key.slice(0,3))).rows[0].n);if(count>=128)throw new JobError('CAPACITY');
    const intentId=await this.#approval(this.jobs,tx,context,p.revision);await tx.sql.query('INSERT INTO arbi_audit_retention_policies VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb)',[...key,tx.now,intentId,JSON.stringify(p)]);
    await this.#steward(this.jobs,tx,context);return {policy:p,intentId};
  },1500);}
  hold(context:AuthorizedContext,input:{id:string;class:DataClass;targetId:string|null;expiresAtMs:number;reason:'investigation'|'incident'|'privacy-review'},release=false){return this.jobs.transaction(context.siteId,async tx=>{
    await this.#steward(this.jobs,tx,context);
    if(!/^[A-Za-z0-9._:-]{1,128}$/.test(input.id) || !['audit','media','operational'].includes(input.class))throw new JobError('INVALID_REQUEST');
    const prior=(await tx.sql.query<{record:typeof input;intent_id:string}>('SELECT record,intent_id FROM arbi_audit_holds WHERE id=$1 AND environment=$2 AND namespace_id=$3 AND site_id=$4',[input.id,...scope(context.realm,context.siteId)])).rows[0];
    if(release){if(!prior)throw new JobError('DENIED');if(digest(prior.record)!==digest(input))throw new JobError('CONFLICT');
      const existing=(await tx.sql.query<{intent_id:string}>('SELECT intent_id FROM arbi_audit_hold_releases WHERE hold_id=$1',[input.id])).rows[0];if(existing)return existing;
      const intentId=await this.#approval(this.jobs,tx,context,input.id);await tx.sql.query('INSERT INTO arbi_audit_hold_releases VALUES($1,$2,$3)',[input.id,intentId,tx.now]);
      await this.#steward(this.jobs,tx,context);return {intent_id:intentId};}
    if(prior){if(digest(prior.record)!==digest(input))throw new JobError('CONFLICT');return {intent_id:prior.intent_id};}
    const policy=(await tx.sql.query<{record:RetentionPolicy}>('SELECT record FROM arbi_audit_retention_policies WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND class=$4 ORDER BY created_at_ms DESC,revision DESC LIMIT 1',[...scope(context.realm,context.siteId),input.class])).rows[0]?.record;
    if(!policy || !Number.isSafeInteger(input.expiresAtMs) || input.expiresAtMs<=tx.now || input.expiresAtMs>tx.now+policy.maxHoldDays*86400000 ||
      input.targetId!==null && !/^[A-Za-z0-9._:-]{1,128}$/.test(input.targetId) || !['investigation','incident','privacy-review'].includes(input.reason))throw new JobError('INVALID_REQUEST');
    const count=Number((await tx.sql.query<{n:string}>('SELECT count(*)::text n FROM arbi_audit_holds WHERE environment=$1 AND namespace_id=$2 AND site_id=$3',scope(context.realm,context.siteId))).rows[0].n);if(count>=1024)throw new JobError('CAPACITY');
    const intentId=await this.#approval(this.jobs,tx,context,input.id);await tx.sql.query('INSERT INTO arbi_audit_holds VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)',[input.id,...scope(context.realm,context.siteId),input.class,input.targetId,input.expiresAtMs,intentId,JSON.stringify(input)]);
    await this.#steward(this.jobs,tx,context);return {intent_id:intentId};
  },1500);}
  async retire(context:AuthorizedContext,input:{origin:'enrollment'|'media'|'durable';eventId:string;reason:'retention-expired'|'operator-delete'}){
    const store=this.options.lifecycle;if(!store)throw new JobError('UNAVAILABLE');return store.transaction(context.siteId,async tx=>{
      await this.#steward(store,tx,context);
      if(!['enrollment','media','durable'].includes(input.origin) || !/^[A-Za-z0-9._:-]{1,128}$/.test(input.eventId) || !['retention-expired','operator-delete'].includes(input.reason))throw new JobError('INVALID_REQUEST');
      const key=[input.origin,input.eventId,...scope(context.realm,context.siteId)];
      const retired=(await tx.sql.query<{id:string}>('SELECT id FROM arbi_audit_retirements WHERE origin=$1 AND event_id=$2 AND environment=$3 AND namespace_id=$4 AND site_id=$5',key)).rows[0];if(retired)return {receiptId:retired.id,retired:true};
      const row=(await tx.sql.query<Row>('SELECT i.*,i.ordinal::text,i.received_at::text,h.record FROM arbi_audit_query_index i JOIN arbi_audit_history h ON h.origin=i.origin AND h.id=i.id WHERE i.origin=$1 AND i.id=$2 AND i.environment=$3 AND i.namespace_id=$4 AND i.site_id=$5',key)).rows[0];if(!row?.record)throw new JobError('DENIED');
      const policy=(await tx.sql.query<{record:RetentionPolicy}>('SELECT record FROM arbi_audit_retention_policies WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND class=\'audit\' ORDER BY created_at_ms DESC,revision DESC LIMIT 1',scope(context.realm,context.siteId))).rows[0]?.record;
      if(!policy || input.reason==='retention-expired' && !retentionExpired(Date.parse(row.received_at),tx.now,policy.retainDays))throw new JobError('DENIED');
      const held=(await tx.sql.query<{n:string}>(`SELECT count(*)::text n FROM arbi_audit_holds h LEFT JOIN arbi_audit_hold_releases r ON r.hold_id=h.id
        WHERE h.environment=$1 AND h.namespace_id=$2 AND h.site_id=$3 AND h.class='audit' AND (h.target_id IS NULL OR h.target_id=$4) AND h.expires_at_ms>$5 AND r.hold_id IS NULL`,[...scope(context.realm,context.siteId),input.eventId,tx.now])).rows[0].n;
      if(Number(held)>0)throw new JobError('DENIED');
      if(input.origin==='durable'){
        const pending=Number((await tx.sql.query<{n:string}>('SELECT count(*)::text n FROM arbi_audit_outbox o LEFT JOIN arbi_audit_deliveries d ON d.id=o.id WHERE (o.id=$1 OR o.authorization_id=$1) AND d.id IS NULL',[input.eventId])).rows[0].n);
        const active=Number((await tx.sql.query<{n:string}>('SELECT count(*)::text n FROM arbi_command_jobs WHERE intent_id=$1 AND record->\'terminal\'=\'null\'::jsonb',[row.record.links.intentEventId??input.eventId])).rows[0].n);
        const lease=Number((await tx.sql.query<{n:string}>("SELECT count(*)::text n FROM arbi_control_leases WHERE record->'intent'->>'eventId'=$1 AND ended_at_ms IS NULL",[row.record.links.intentEventId??input.eventId])).rows[0].n);
        if(pending || active || lease)throw new JobError('DENIED');
      }
      const e=checked(row.record,true),receiptId=randomUUID(),intentId=await this.#approval(store,tx,context,receiptId);
      await tx.sql.query('INSERT INTO arbi_audit_retirements VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13)',[receiptId,input.origin,input.eventId,...scope(context.realm,context.siteId),tx.now,intentId,policy.revision,digest(e),contentHash(e),JSON.stringify(e.ingestTime),input.reason]);
      await tx.sql.query('SELECT arbi_retire_audit_payload($1)',[receiptId]);await this.#steward(store,tx,context);return {receiptId,retired:true};
    },1500);
  }
}
