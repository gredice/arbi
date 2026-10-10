import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { digest } from "@arbi/audit";
import { bounded, isRealm, sameRealm } from "@arbi/gredice";
import type { AuthorizationObservation, AuthorizedContext } from "@arbi/gredice";
import { AUDIT_VERSION, MAX_COUNTER, auditFromProtocolOutcome, validateMessage } from "@arbi/protocol";
import type { AuditAction, AuditEvent, AuditSource, Command, ErrorCode, Event, Realm } from "@arbi/protocol";
import { PostgresAuditStore, scope } from "../audit/store";
import type { TrustedBinding } from "../audit/store";
import { VERSION } from "../enrollment/contracts";
import type { Device, Registry } from "../enrollment/contracts";
import { prove } from "../enrollment/crypto";
import type { SqlDatabase, SqlSession } from "../enrollment/store";
import { commandActions, exact, id, JobError, milliseconds } from "./contracts";
import type { ControlLease, CurrentAuthority, Job } from "./contracts";

type Row<T> = { record: T } & Record<string, unknown>;
interface Tx { sql: SqlSession; registry: Registry; now: number; startedAt: number }
interface Receiver { event: Event; receivedAtMs: number }
function binding(e: AuditEvent): TrustedBinding {
  return { action: e.action,evidence: e.evidence,record: e.record,realm: e.realm,executionMode: e.executionMode,
    siteId: e.siteId,authenticatedSource: e.source,actor: e.actor,resource: e.resource,links: e.links,metadata: e.metadata,change: e.change };
}
const terminal = (s: unknown) => ["completed","rejected","failed","cancelled"].includes(String(s));
const stream = (e: Event) => JSON.stringify([e.realm,e.siteId,e.source,"job-event"]);

/** One inventory row lock orders enrollment revocation, site fences, jobs, receipts and audit COMMIT across processes. */
export class PostgresJobStore {
  readonly source: AuditSource = { module: "cloud",identity: { deviceId: "job-service",bootId: randomUUID(),sessionId: randomUUID() } };
  readonly startedAt = performance.now();
  readonly audit: PostgresAuditStore;
  constructor(readonly db: SqlDatabase, readonly realm: Realm, readonly currentAuthority: CurrentAuthority,
    readonly receiverUncertaintyMs = 100) {
    if (!isRealm(realm) || realm.environment === "production" || typeof currentAuthority !== "function") throw new JobError("DENIED");
    milliseconds(receiverUncertaintyMs,1,250);
    this.audit = new PostgresAuditStore(db,"job-service",Date.now,receiverUncertaintyMs);
  }
  async transaction<T>(siteId: string, work: (tx: Tx) => Promise<T>, queryTimeoutMs?: number): Promise<T> {
    id(siteId); let domainError: JobError | undefined;
    if (queryTimeoutMs !== undefined) milliseconds(queryTimeoutMs,1,1500);
    try { return await this.db.transaction(async (sql) => {
      try {
        if (queryTimeoutMs !== undefined) {
          await sql.query("SELECT set_config('statement_timeout',$1,true),set_config('lock_timeout','1000ms',true)",[`${queryTimeoutMs}ms`]);
        }
        const key = scope(this.realm,siteId);
        const registry = (await sql.query<{ state: Registry }>("SELECT state FROM arbi_device_registry WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 FOR UPDATE",key)).rows[0]?.state;
        if (!registry || registry.version !== VERSION || !sameRealm(registry.realm,this.realm) || registry.siteId !== siteId) throw new JobError("DENIED");
        await sql.query("INSERT INTO arbi_job_sites(environment,namespace_id,site_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",key);
        const now = Number((await sql.query<{ now: string }>("SELECT floor(extract(epoch FROM clock_timestamp())*1000)::text AS now")).rows[0].now);
        const floor = Number((await sql.query<{ clock_floor_ms: string }>("SELECT clock_floor_ms FROM arbi_job_sites WHERE environment=$1 AND namespace_id=$2 AND site_id=$3",key)).rows[0].clock_floor_ms);
        if (!Number.isSafeInteger(now) || now < floor) throw new JobError("CLOCK_UNCERTAIN");
        await sql.query("UPDATE arbi_job_sites SET clock_floor_ms=$4 WHERE environment=$1 AND namespace_id=$2 AND site_id=$3",[...key,now]);
        const tx = { sql,registry,now,startedAt: performance.now() };
        const result = await work(tx);
        await this.tick(tx);
        return result;
      } catch (e) { if (e instanceof JobError) domainError = e; throw e; }
    }); } catch { throw domainError ?? new JobError("UNAVAILABLE"); }
  }
  async tick(tx: Tx): Promise<void> {
    const now = Number((await tx.sql.query<{ now: string }>("SELECT floor(extract(epoch FROM clock_timestamp())*1000)::text AS now")).rows[0].now);
    if (!Number.isSafeInteger(now) || now < tx.now || performance.now()-tx.startedAt > 4000) throw new JobError("CLOCK_UNCERTAIN");
    tx.now = now;
    await tx.sql.query("UPDATE arbi_job_sites SET clock_floor_ms=$4 WHERE environment=$1 AND namespace_id=$2 AND site_id=$3",[...scope(this.realm,tx.registry.siteId),now]);
  }
  async authority(tx: Tx, previous: AuthorizedContext): Promise<AuthorizedContext> {
    let current: AuthorizedContext | null;
    try { current = await bounded(1000,(signal) => this.currentAuthority(structuredClone(previous),signal)); }
    catch { throw new JobError("UNAVAILABLE"); }
    await this.tick(tx);
    if (!current || current.actor.kind !== "human" || !isDeepStrictEqual(current.actor,previous.actor) ||
      current.sessionId !== previous.sessionId || current.siteId !== tx.registry.siteId || previous.siteId !== tx.registry.siteId ||
      current.accountId !== tx.registry.accountId || previous.accountId !== tx.registry.accountId ||
      !sameRealm(current.realm,this.realm) || !sameRealm(previous.realm,this.realm) || current.capability !== previous.capability ||
      current.resource.kind !== "site" || current.resource.id !== tx.registry.siteId ||
      !Number.isSafeInteger(current.expiresAtMs) || current.expiresAtMs <= tx.now || previous.expiresAtMs <= tx.now) throw new JobError("DENIED");
    return current;
  }
  async next(tx: Tx, field: "sequence" | "fence"): Promise<string> {
    const row = (await tx.sql.query<{ value: string }>(`UPDATE arbi_job_sites SET ${field}=${field}+1
      WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND ${field}<$4 RETURNING ${field}::text AS value`,
      [...scope(this.realm,tx.registry.siteId),String(MAX_COUNTER)])).rows[0];
    if (!row) throw new JobError("CAPACITY"); return row.value;
  }
  async event(tx: Tx, authority: AuthorizedContext, action: AuditAction, resource: AuditEvent["resource"],
    links: Partial<AuditEvent["links"]> = {}): Promise<AuditEvent> {
    const eventId = randomUUID();
    return { auditVersion: AUDIT_VERSION,eventId,realm: this.realm,executionMode: "simulation",siteId: tx.registry.siteId,
      actor: authority.actor,source: this.source,sequence: await this.next(tx,"sequence"),
      sourceTime: { utc: null,uncertaintyMs: null,monotonicMs: Math.floor(performance.now()-this.startedAt) },ingestTime: null,
      resource,action,evidence: "intent",outcome: "requested",reason: "requested",effect: "none",
      links: { correlationId: eventId,intentEventId: eventId,causationEventId: null,jobId: null,sessionId: authority.sessionId,
        commandId: null,requestSource: null,target: null,...links },record: null,metadata: { configRevision: tx.registry.configRevision },change: null };
  }
  async admit(tx: Tx, intent: AuditEvent): Promise<void> {
    const allow: AuditEvent = { ...structuredClone(intent),eventId: randomUUID(),sequence: await this.next(tx,"sequence"),
      evidence: "authorization",outcome: "allow",reason: "authorized",links: { ...intent.links,causationEventId: intent.eventId } };
    await this.audit.stageAdmission(tx.sql,intent,allow,binding(intent),binding(allow));
  }
  async observation(tx: Tx, root: AuditEvent, reason: AuditEvent["reason"], action = root.action, code?: ErrorCode): Promise<void> {
    const lifecycle = action.startsWith("control.session.");
    const auditReason = !lifecycle ? "execution-failed" : reason === "observed" ? "completed" : reason === "source-restarted" ? "revoked" : reason;
    const event: AuditEvent = { ...structuredClone(root),eventId: randomUUID(),sequence: await this.next(tx,"sequence"),source: this.source,
      sourceTime: { utc: null,uncertaintyMs: null,monotonicMs: Math.floor(performance.now()-this.startedAt) },ingestTime: null,
      action,evidence: "service-outcome",outcome: lifecycle ? "succeeded" : "fail",reason: auditReason,effect: "none",
      links: { ...root.links,causationEventId: root.eventId } };
    if (reason === "cancelled") event.metadata.protocolErrorCode = "CANCELLED";
    if (reason === "source-restarted") event.metadata.protocolErrorCode = "TARGET_RESTARTED";
    if (!lifecycle && reason === "timeout") event.metadata.protocolErrorCode = "DEADLINE_EXPIRED";
    if (!lifecycle && reason === "revoked") event.metadata.protocolErrorCode = "NOT_AUTHORIZED";
    if (code) event.metadata.protocolErrorCode = code;
    await this.audit.stage(tx.sql,event,binding(event));
  }
  activeDevice(tx: Tx, deviceId: string, applied = true): Device {
    const device = tx.registry.devices.find((d) => d.id === deviceId && d.role === "edge" && d.status === "active" && d.revokedAtMs === null);
    if (!device?.current || (applied && device.appliedConfigRevision !== tx.registry.configRevision)) throw new JobError("DENIED");
    return device;
  }
  async receiver(tx: Tx, deviceId: string): Promise<{ event: Event & { body: Extract<Event["body"],{ type: "state.snapshot" }> }; margin: number; currentMono: number }> {
    const device = this.activeDevice(tx,deviceId);
    const row = (await tx.sql.query<Row<Receiver>>("SELECT record FROM arbi_job_receivers WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND device_id=$4",[...scope(this.realm,tx.registry.siteId),deviceId])).rows[0];
    const event = row?.record.event;
    if (!event || event.body.type !== "state.snapshot" || !isDeepStrictEqual(event.source,device.current) || event.body.configRevision !== tx.registry.configRevision) throw new JobError("DENIED");
    const { utc,uncertaintyMs,monotonicMs } = event.sourceTime;
    if (utc === null || uncertaintyMs === null || uncertaintyMs > 250 || tx.now < row.record.receivedAtMs ||
      tx.now-row.record.receivedAtMs > 5000 || Math.abs(tx.now-Date.parse(utc)) > 5000 || Date.parse(utc)-tx.now > uncertaintyMs+this.receiverUncertaintyMs) throw new JobError("CLOCK_UNCERTAIN");
    // Bound UTC mapping in both directions, including a 50ms drift/processing allowance. No cross-boot subtraction.
    const margin = uncertaintyMs+this.receiverUncertaintyMs+50;
    const currentMono = monotonicMs+tx.now-Date.parse(utc);
    if (!Number.isSafeInteger(currentMono) || currentMono < margin) throw new JobError("CLOCK_UNCERTAIN");
    return { event: event as Event & { body: Extract<Event["body"],{ type: "state.snapshot" }> },margin,currentMono };
  }
  async activeLease(tx: Tx): Promise<ControlLease | null> {
    const key = scope(this.realm,tx.registry.siteId);
    const row = (await tx.sql.query<Row<ControlLease>>("SELECT record FROM arbi_control_leases WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND ended_at_ms IS NULL",key)).rows[0];
    if (!row) return null;
    const lease = row.record;
    if (lease.expiresAtMs <= tx.now) { await this.end(tx,lease,"timeout"); return null; }
    try { await this.authority(tx,lease.authority); }
    catch (e) { if (!(e instanceof JobError) || e.code !== "DENIED") throw e;await this.end(tx,lease,"revoked");return null; }
    const device = tx.registry.devices.find((d) => d.id === lease.target.deviceId && d.status === "active" && d.revokedAtMs === null);
    if (!device || !isDeepStrictEqual(device.current,lease.target) || device.appliedConfigRevision !== lease.configRevision || tx.registry.configRevision !== lease.configRevision) {
      await this.end(tx,lease,"source-restarted");return null;
    }
    return lease;
  }
  async end(tx: Tx, lease: ControlLease, reason: "timeout" | "revoked" | "ended" | "source-restarted"): Promise<void> {
    lease.endedAtMs = tx.now;
    await tx.sql.query("UPDATE arbi_control_leases SET ended_at_ms=$2,record=$3::jsonb WHERE id=$1",[lease.id,tx.now,JSON.stringify(lease)]);
    await this.observation(tx,lease.intent,reason,reason === "timeout" ? "control.session.timeout" : reason === "revoked" ? "control.session.revoke" : "control.session.end");
  }
  async lease(context: AuthorizedContext, action: "acquire" | "renew" | "release" | "revoke", input: unknown): Promise<ControlLease> {
    exact(input,action === "acquire" ? ["key","deviceId","ttlMs"] : action === "renew" ? ["key","leaseId","fence","ttlMs"] : ["key","leaseId","fence"]);
    id(input.key); if (action === "acquire") id(input.deviceId); else { id(input.leaseId); id(input.fence); }
    if (action === "acquire" || action === "renew") milliseconds(input.ttlMs,500,15000);
    const value = structuredClone(input), fingerprint = digest({ action,input: value,sessionId: context.sessionId });
    return this.transaction(context.siteId,async (tx) => {
      await this.authority(tx,context);
      if (context.capability !== (action === "revoke" ? "configuration.write" : "manipulation.request")) throw new JobError("DENIED");
      const key = [...scope(this.realm,context.siteId),context.actor.id,value.key];
      const prior = (await tx.sql.query<{ fingerprint: string; lease_id: string }>("SELECT fingerprint,lease_id FROM arbi_lease_requests WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND actor_id=$4 AND request_key=$5",key)).rows[0];
      if (prior) {
        if (prior.fingerprint !== fingerprint) throw new JobError("CONFLICT");
        await this.activeLease(tx);
        return (await tx.sql.query<Row<ControlLease>>("SELECT record FROM arbi_control_leases WHERE id=$1",[prior.lease_id])).rows[0].record;
      }
      let lease = await this.activeLease(tx);
      if (action === "acquire") {
        if (lease) throw new JobError("CONFLICT");
        const receiver = await this.receiver(tx,String(value.deviceId));
        const expiresAtMs = Math.min(tx.now+Number(value.ttlMs),context.expiresAtMs);
        const leaseId = randomUUID();
        const intent = await this.event(tx,context,"control.session.start",{ kind: "control-session",id: leaseId,deviceId: receiver.event.source.deviceId },{ target: receiver.event.source });
        lease = { id: leaseId,fence: await this.next(tx,"fence"),authority: context,target: receiver.event.source,configRevision: tx.registry.configRevision,
          expiresAtMs,expiresMonotonicMs: receiver.currentMono+expiresAtMs-tx.now-receiver.margin,endedAtMs: null,intent };
        if (expiresAtMs-tx.now <= receiver.margin*2) throw new JobError("EXPIRED");
        await this.admit(tx,intent);
        await this.observation(tx,intent,"observed");
        await tx.sql.query(`INSERT INTO arbi_control_leases(id,environment,namespace_id,site_id,fence,actor_id,session_id,expires_at_ms,record)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,[lease.id,...scope(this.realm,context.siteId),lease.fence,context.actor.id,context.sessionId,expiresAtMs,JSON.stringify(lease)]);
      } else {
        if (!lease || lease.id !== value.leaseId || lease.fence !== value.fence || (action !== "revoke" &&
          (lease.authority.actor.id !== context.actor.id || lease.authority.sessionId !== context.sessionId))) throw new JobError("STALE_FENCE");
        if (action === "renew") {
          const receiver = await this.receiver(tx,lease.target.deviceId);
          if (!isDeepStrictEqual(receiver.event.source,lease.target) || lease.configRevision !== tx.registry.configRevision) throw new JobError("STALE_FENCE");
          lease.authority = context;lease.expiresAtMs = Math.min(tx.now+Number(value.ttlMs),context.expiresAtMs);
          lease.expiresMonotonicMs = receiver.currentMono+lease.expiresAtMs-tx.now-receiver.margin;
          if (lease.expiresAtMs-tx.now <= receiver.margin*2) throw new JobError("EXPIRED");
          await this.observation(tx,lease.intent,"observed");
          await tx.sql.query("UPDATE arbi_control_leases SET expires_at_ms=$2,record=$3::jsonb WHERE id=$1",[lease.id,lease.expiresAtMs,JSON.stringify(lease)]);
        } else {
          // A revoker's attributable decision is distinct from the original holder's lifecycle.
          if (action === "revoke") {
            const intent = await this.event(tx,context,"control.session.revoke",lease.intent.resource,{ target: lease.target });
            await this.admit(tx,intent);await this.observation(tx,intent,"revoked");
          }
          await this.end(tx,lease,action === "revoke" ? "revoked" : "ended");
        }
      }
      await tx.sql.query("INSERT INTO arbi_lease_requests(environment,namespace_id,site_id,actor_id,request_key,fingerprint,lease_id) VALUES($1,$2,$3,$4,$5,$6,$7)",[...key,fingerprint,lease.id]);
      return structuredClone(lease);
    });
  }
  async submit(context: AuthorizedContext, input: unknown): Promise<Job> {
    exact(input,["key","deviceId","leaseId","fence","timeoutMs","body"]);
    id(input.key);id(input.deviceId);milliseconds(input.timeoutMs,500,10000);
    const value = structuredClone(input), fingerprint = digest({ input: value,sessionId: context.sessionId });
    return this.transaction(context.siteId,async (tx) => {
      await this.authority(tx,context);
      if (context.capability !== "manipulation.request") throw new JobError("DENIED");
      const prior = (await tx.sql.query<Row<Job> & { fingerprint: string }>("SELECT record,fingerprint FROM arbi_command_jobs WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND actor_id=$4 AND request_key=$5",
        [...scope(this.realm,context.siteId),context.actor.id,value.key])).rows[0];
      if (prior) { if (prior.fingerprint !== fingerprint) throw new JobError("CONFLICT");await this.refresh(tx,prior.record);return prior.record; }
      const receiver = await this.receiver(tx,String(value.deviceId)), jobId = randomUUID();
      const body = value.body as Command["body"];
      if (!body || !Object.hasOwn(commandActions,body.type) || !receiver.event.body.supportedCommands.includes(body.type)) throw new JobError("INVALID_REQUEST");
      const stopped = body.type === "control.stop";
      let lease: ControlLease | null = null;
      if (stopped) { if (value.leaseId !== null || value.fence !== null) throw new JobError("INVALID_REQUEST"); }
      else {
        lease = await this.activeLease(tx);
        if (!lease || lease.id !== value.leaseId || lease.fence !== value.fence || lease.authority.actor.id !== context.actor.id ||
          lease.authority.sessionId !== context.sessionId || !isDeepStrictEqual(lease.target,receiver.event.source) || lease.configRevision !== tx.registry.configRevision) throw new JobError("STALE_FENCE");
        if (receiver.event.body.state === "Fault") throw new JobError("DENIED");
      }
      const duration = Math.min(Number(value.timeoutMs),context.expiresAtMs-tx.now,(lease?.expiresAtMs ?? Infinity)-tx.now);
      if (duration <= receiver.margin*2 || ("maxDurationMs" in body && body.maxDurationMs > duration-receiver.margin*2)) throw new JobError("EXPIRED");
      const command: Command = { protocol: "arbi/1.0",messageId: randomUUID(),realm: this.realm,siteId: context.siteId,source: this.source.identity,
        sequence: await this.next(tx,"sequence"),sourceTime: { utc: null,uncertaintyMs: null,monotonicMs: Math.floor(performance.now()-this.startedAt) },
        ingestTime: null,kind: "command",executionMode: "simulation",body,
        command: { commandId: jobId,correlationId: randomUUID(),idempotencyKey: String(value.key),actor: context.actor,target: receiver.event.source,
          deadline: { bootId: receiver.event.source.bootId,sessionId: receiver.event.source.sessionId,expiresMonotonicMs: receiver.currentMono+duration-receiver.margin },
          lease: lease ? { id: lease.id,holderId: context.actor.id,fence: lease.fence } : null,configRevision: tx.registry.configRevision } };
      const parsed = validateMessage(command);if (!parsed.ok) throw new JobError("INVALID_REQUEST");
      const resource: AuditEvent["resource"] = body.type === "camera.capture" ? { kind: "capture",id: body.resourceId,deviceId: receiver.event.source.deviceId } : { kind: "device",id: receiver.event.source.deviceId,deviceId: receiver.event.source.deviceId };
      const intent = await this.event(tx,context,commandActions[body.type as keyof typeof commandActions],resource,
        { correlationId: command.command.correlationId,jobId,commandId: jobId,requestSource: command.source,target: command.command.target });
      const job: Job = { id: jobId,authority: context,command,intent,expiresAtMs: tx.now+duration-receiver.margin*2,cloudDisposition: "admitted",deviceStatus: null,terminal: null };
      const count = (await tx.sql.query<{ count: string }>("SELECT count(*)::text AS count FROM arbi_command_jobs WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND expires_at_ms>$4",[...scope(this.realm,context.siteId),tx.now])).rows[0].count;
      if (Number(count) >= 256) throw new JobError("CAPACITY");
      await this.admit(tx,intent);
      await tx.sql.query(`INSERT INTO arbi_command_jobs(id,environment,namespace_id,site_id,actor_id,request_key,fingerprint,intent_id,expires_at_ms,record)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,[job.id,...scope(this.realm,context.siteId),context.actor.id,value.key,fingerprint,intent.eventId,job.expiresAtMs,JSON.stringify(job)]);
      return structuredClone(job);
    });
  }
  async save(tx: Tx, job: Job): Promise<void> { await tx.sql.query("UPDATE arbi_command_jobs SET record=$2::jsonb WHERE id=$1",[job.id,JSON.stringify(job)]); }
  async refresh(tx: Tx, job: Job): Promise<void> {
    if (job.cloudDisposition !== "admitted" || job.terminal) return;
    let reason: AuditEvent["reason"] = "timeout";
    if (job.expiresAtMs <= tx.now) job.cloudDisposition = "expired";
    else {
      try { await this.authority(tx,job.authority); } catch { job.cloudDisposition = "authority-lost";reason = "revoked"; }
      if (job.cloudDisposition === "admitted") {
        try {
          const receiver = await this.receiver(tx,job.command.command.target.deviceId);
          if (!isDeepStrictEqual(receiver.event.source,job.command.command.target) || job.command.command.configRevision !== tx.registry.configRevision ||
            !receiver.event.body.supportedCommands.includes(job.command.body.type)) { job.cloudDisposition = "receiver-changed";reason = "source-restarted"; }
          else if (receiver.currentMono+receiver.margin >= job.command.command.deadline.expiresMonotonicMs) job.cloudDisposition = "expired";
        } catch (e) { job.cloudDisposition = e instanceof JobError && e.code === "CLOCK_UNCERTAIN" ? "clock-uncertain" : "receiver-changed";reason = "source-restarted"; }
      }
      if (job.cloudDisposition === "admitted" && job.command.command.lease) {
        const lease = await this.activeLease(tx);
        if (!lease || lease.id !== job.command.command.lease.id || lease.fence !== job.command.command.lease.fence ||
          job.command.command.deadline.expiresMonotonicMs > lease.expiresMonotonicMs) { job.cloudDisposition = "lease-lost";reason = "revoked"; }
      }
    }
    if (job.cloudDisposition !== "admitted") {
      await this.observation(tx,job.intent,reason,job.intent.action,job.cloudDisposition === "clock-uncertain" ? "CLOCK_INVALID" : undefined);
      await this.save(tx,job);
    }
  }
  async status(context: AuthorizedContext, jobId: string, cancel = false): Promise<Job> {
    id(jobId);
    return this.transaction(context.siteId,async (tx) => {
      await this.authority(tx,context);
      if (context.capability !== (cancel ? "manipulation.request" : "state.read")) throw new JobError("DENIED");
      const job = (await tx.sql.query<Row<Job>>("SELECT record FROM arbi_command_jobs WHERE id=$1 AND environment=$2 AND namespace_id=$3 AND site_id=$4",[jobId,...scope(this.realm,context.siteId)])).rows[0]?.record;
      if (!job || (cancel && (job.authority.actor.id !== context.actor.id || job.authority.sessionId !== context.sessionId))) throw new JobError("DENIED");
      if (cancel && !job.terminal && job.cloudDisposition !== "cancel-requested") {
        job.cloudDisposition = "cancel-requested";await this.observation(tx,job.intent,"cancelled");await this.save(tx,job);
      } else await this.refresh(tx,job);
      return job;
    });
  }
  async authorization(record: AuthorizationObservation, signal: AbortSignal): Promise<boolean> {
    if (!record.siteId || signal.aborted) return false;
    await this.transaction(record.siteId,async (tx) => {
      const context = { actor: record.actor ?? { kind: "service",id: "unverified-attempt" },sessionId: record.sessionId ?? "unverified-session" } as AuthorizedContext;
      const event = await this.event(tx,context,"authorization.check",{ kind: "site",id: record.siteId!,deviceId: null });
      event.evidence = "authorization";event.outcome = record.decision === "authorized" ? "allow" : "deny";
      event.reason = record.decision === "authorized" ? "authorized" : "not-authorized";
      event.links = { ...event.links,correlationId: record.correlationId,intentEventId: null,sessionId: record.sessionId };
      if (signal.aborted) throw new JobError("UNAVAILABLE");await this.audit.stage(tx.sql,event,binding(event));
    });return !signal.aborted;
  }
  /** Signed outbound-device HTTP adapter; no broker, device-local state machine or actuator dispatch. */
  async device(siteId: string, input: unknown): Promise<unknown> {
    exact(input,["version","realm","siteId","deviceId","credentialId","identity","issuedAtMs","expiresAtMs","action","payload","signature"]);
    if (input.version !== "arbi.jobs-device/1.0" || !isRealm(input.realm) || !sameRealm(input.realm,this.realm) || input.siteId !== siteId ||
      !["snapshot","poll","outcome"].includes(String(input.action))) throw new JobError("INVALID_REQUEST");
    id(input.deviceId);id(input.credentialId);milliseconds(input.issuedAtMs,0,Number.MAX_SAFE_INTEGER);milliseconds(input.expiresAtMs,0,Number.MAX_SAFE_INTEGER);
    const request = structuredClone(input);
    return this.transaction(siteId,async (tx) => {
      const uploader = this.activeDevice(tx,String(request.deviceId),request.action !== "outcome");
      const credential = uploader.credentials.find((c) => c.id === request.credentialId && c.revokedAtMs === null && c.createdAtMs <= tx.now && c.expiresAtMs > tx.now);
      if (!credential || !isDeepStrictEqual(uploader.current,request.identity) || Number(request.issuedAtMs) > tx.now+this.receiverUncertaintyMs ||
        Number(request.expiresAtMs) <= tx.now || Number(request.expiresAtMs)-Number(request.issuedAtMs) > 10000 || Number(request.expiresAtMs) <= Number(request.issuedAtMs)) throw new JobError("DENIED");
      const { signature,...unsigned } = request;
      try { prove(credential.publicKey,unsigned,signature); } catch { throw new JobError("DENIED"); }
      if (request.action === "poll") {
        exact(request.payload,[]);
        const jobs = (await tx.sql.query<Row<Job>>(`SELECT record FROM arbi_command_jobs WHERE environment=$1 AND namespace_id=$2 AND site_id=$3
          AND record->'command'->'command'->'target'->>'deviceId'=$4 AND record->>'cloudDisposition'='admitted' AND record->'terminal'='null'::jsonb ORDER BY expires_at_ms,id LIMIT 8`,[...scope(this.realm,siteId),uploader.id])).rows;
        const ready: Job[] = [];
        for (const row of jobs) { await this.refresh(tx,row.record);if (row.record.cloudDisposition === "admitted" && row.record.deviceStatus === null) ready.push(row.record); }
        // A later bounded authority read in this same page may consume an earlier command's remaining lifetime.
        await this.tick(tx);
        const commands: Command[] = [];
        for (const job of ready) {
          if (job.expiresAtMs <= tx.now) {
            job.cloudDisposition = "expired";await this.observation(tx,job.intent,"timeout");await this.save(tx,job);
          } else commands.push(job.command);
        }
        // Repeated delivery returns exactly the durable envelope. A response or socket write changes no device status.
        return { commands };
      }
      const parsed = validateMessage(request.payload);
      if (!parsed.ok || parsed.value.kind !== "event" || parsed.value.ingestTime !== null || parsed.value.executionMode !== "simulation" ||
        !sameRealm(parsed.value.realm,this.realm) || parsed.value.siteId !== siteId) throw new JobError("INVALID_REQUEST");
      const event = parsed.value;
      if ((request.action === "snapshot" && event.body.type !== "state.snapshot") ||
        (request.action === "outcome" && event.body.type !== "command.outcome")) throw new JobError("INVALID_REQUEST");
      if (event.source.deviceId !== uploader.id || ![uploader.current,...uploader.retiredIdentities].some((i) => isDeepStrictEqual(i,event.source)) ||
        (request.action === "snapshot" && !isDeepStrictEqual(event.source,uploader.current))) throw new JobError("DENIED");
      const fingerprint = digest(event), key = stream(event);
      const admitted: Event = { ...event,ingestTime: { utc: new Date(tx.now).toISOString(),uncertaintyMs: this.receiverUncertaintyMs,deviceId: "job-service" } };
      const prior = (await tx.sql.query<{ fingerprint: string; decision: string }>("SELECT fingerprint,decision FROM arbi_job_reports WHERE id=$1 OR (stream=$2 AND sequence=$3)",[event.messageId,key,event.sequence])).rows;
      if (prior.length) {
        if (prior.length !== 1 || prior[0].fingerprint !== fingerprint) throw new JobError("CONFLICT");
        return { decision: prior[0].decision,durable: true };
      }
      let decision = "recorded";
      if (request.action === "snapshot") {
        if (event.body.type !== "state.snapshot" || !isDeepStrictEqual(event.source,uploader.current) || event.body.configRevision !== tx.registry.configRevision) throw new JobError("DENIED");
        const existing = (await tx.sql.query<Row<Receiver>>("SELECT record FROM arbi_job_receivers WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND device_id=$4",[...scope(this.realm,siteId),uploader.id])).rows[0]?.record;
        if (existing && isDeepStrictEqual(existing.event.source,event.source) &&
          (BigInt(event.sequence) <= BigInt(existing.event.sequence) || event.sourceTime.monotonicMs < existing.event.sourceTime.monotonicMs)) decision = "stale";
        else {
          await tx.sql.query(`INSERT INTO arbi_job_receivers(environment,namespace_id,site_id,device_id,received_at_ms,record) VALUES($1,$2,$3,$4,$5,$6::jsonb)
            ON CONFLICT(environment,namespace_id,site_id,device_id) DO UPDATE SET received_at_ms=EXCLUDED.received_at_ms,record=EXCLUDED.record`,[...scope(this.realm,siteId),uploader.id,tx.now,JSON.stringify({ event,receivedAtMs: tx.now })]);
          try { await this.receiver(tx,uploader.id); }
          catch (e) {
            if (!(e instanceof JobError)) throw e;
            // Observed clock ambiguity must never resurrect pending motion when a later snapshot is synchronized.
            const pending = (await tx.sql.query<Row<Job>>(`SELECT record FROM arbi_command_jobs WHERE environment=$1 AND namespace_id=$2 AND site_id=$3
              AND record->'command'->'command'->'target'->>'deviceId'=$4 AND record->>'cloudDisposition'='admitted' AND record->'terminal'='null'::jsonb LIMIT 256`,[...scope(this.realm,siteId),uploader.id])).rows;
            for (const { record: job } of pending) {
              job.cloudDisposition = "clock-uncertain";
              await this.observation(tx,job.intent,"source-restarted",job.intent.action,"CLOCK_INVALID");await this.save(tx,job);
            }
          }
        }
      } else {
        if (event.body.type !== "command.outcome" || event.body.outcome === "requested") throw new JobError("INVALID_REQUEST");
        const job = (await tx.sql.query<Row<Job>>("SELECT record FROM arbi_command_jobs WHERE id=$1 AND environment=$2 AND namespace_id=$3 AND site_id=$4",[event.body.commandId,...scope(this.realm,siteId)])).rows[0]?.record;
        if (!job || event.body.correlationId !== job.command.command.correlationId || !isDeepStrictEqual(event.body.requestSource,job.command.source) ||
          !isDeepStrictEqual(event.source,job.command.command.target) || event.source.deviceId !== uploader.id ||
          ![uploader.current,...uploader.retiredIdentities].some((i) => isDeepStrictEqual(i,event.source))) throw new JobError("DENIED");
        if (job.command.body.type === "camera.capture" ? (event.body.outcome === "completed" || event.body.resourceId !== null) && event.body.resourceId !== job.command.body.resourceId : event.body.resourceId !== null) throw new JobError("DENIED");
        if (terminal(event.body.outcome)) {
          const outcome = auditFromProtocolOutcome(job.intent,event,{ realm: this.realm,siteId,executionMode: "simulation",command: job.command,
            eventId: event.messageId,sequence: event.sequence,action: job.intent.action,sourceModule: "edge",resource: job.intent.resource,
            commandId: job.id,requestSource: job.command.source,target: job.command.command.target,ingestTime: null });
          if (!outcome.ok) throw new JobError("DENIED");
          outcome.value.metadata.configRevision = job.command.command.configRevision;
          await this.audit.stage(tx.sql,outcome.value,binding(outcome.value));
          if (job.terminal) {
            decision = isDeepStrictEqual(job.terminal.body,event.body) ? "terminal-repeat" : "contradiction";
          } else { job.terminal = admitted;job.deviceStatus = event.body.outcome as Job["deviceStatus"];await this.save(tx,job); }
        } else if (job.terminal || (job.deviceStatus === "running" && event.body.outcome === "accepted")) decision = "stale";
        else {
          job.deviceStatus = event.body.outcome as Job["deviceStatus"];
          // Audit 1.0 has terminal device outcomes only. The authenticated nonterminal protocol receipt stays in immutable reports.
          await this.save(tx,job);
        }
      }
      await tx.sql.query("INSERT INTO arbi_job_reports(id,environment,namespace_id,site_id,stream,sequence,fingerprint,received_at_ms,record,decision) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)",[event.messageId,...scope(this.realm,siteId),key,event.sequence,fingerprint,tx.now,JSON.stringify(admitted),decision]);
      return { decision,durable: true };
    });
  }
}
