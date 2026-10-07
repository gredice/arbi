import { randomUUID } from 'node:crypto';
import { statfsSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { canonical, checked, digest, SqliteAuditSpool } from '@arbi/audit';
import { advanceOutcome, validateMessage, type AuditEvent, type Command, type ErrorCode, type Event, type Identity } from '@arbi/protocol';
import { fingerprint, same } from './admission.js';
import { JobError, type CrashPoint, type JobRecord, type LocalAuthority, type Outcome, type Proof, type State, type Step } from './types.js';

export interface JournalOptions {
  path: string; realm: Command['realm']; siteId: string; deviceId: string;
  maxJobs: number; maxBytes: number; maxPages: number; minFreeBytes: number;
  fault?: (point: CrashPoint, record?: JobRecord) => void;
}
interface Row { body: string; hash: string }
const terminal = (o: Outcome): boolean => ['completed', 'failed', 'cancelled', 'rejected'].includes(o);
export class JobJournal {
  readonly #db: DatabaseSync;
  readonly #options: JournalOptions;
  readonly #owner = randomUUID();
  #degraded = false;
  #transitionRecord?: JobRecord;
  constructor(options: JournalOptions) {
    this.#options = options;
    if (options.path === ':memory:' || options.realm.environment !== 'test' || !Number.isSafeInteger(options.maxJobs) || options.maxJobs < 1 || options.maxJobs > 4096
      || !Number.isSafeInteger(options.maxBytes) || options.maxBytes < 8192 || options.maxBytes > 134217728 || !Number.isSafeInteger(options.maxPages) || options.maxPages < 32 || options.maxPages > 32768
      || !Number.isSafeInteger(options.minFreeBytes) || options.minFreeBytes < 0) throw new JobError('INVALID_RANGE');
    this.#db = new DatabaseSync(options.path, { timeout: 100 });
    try {
      const version = this.#db.prepare('PRAGMA user_version').get()!.user_version;
      if (version !== 0 && version !== 1) throw new JobError('CONFIG_MISMATCH');
      this.#db.exec(`PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; PRAGMA fullfsync=ON; PRAGMA foreign_keys=ON;
        PRAGMA max_page_count=${options.maxPages}; PRAGMA cache_size=-1024;
        CREATE TABLE IF NOT EXISTS control (id INTEGER PRIMARY KEY CHECK(id=1), binding TEXT NOT NULL, owner TEXT, pid INTEGER, recovery INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, source TEXT NOT NULL, key TEXT NOT NULL, fingerprint TEXT NOT NULL, body TEXT NOT NULL, hash TEXT NOT NULL, UNIQUE(source,key));
        CREATE TABLE IF NOT EXISTS records (ordinal INTEGER PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id), body TEXT NOT NULL, hash TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS evidence (operation_id TEXT PRIMARY KEY, body TEXT NOT NULL, hash TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS recoveries (id TEXT PRIMARY KEY, body TEXT NOT NULL, hash TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS audit_intents (ordinal INTEGER PRIMARY KEY, event_id TEXT UNIQUE NOT NULL, record_id TEXT NOT NULL, body TEXT NOT NULL, hash TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS audit_copies (event_id TEXT PRIMARY KEY REFERENCES audit_intents(event_id));
        CREATE TABLE IF NOT EXISTS clocks (epoch TEXT PRIMARY KEY, floor INTEGER NOT NULL);
        CREATE TRIGGER IF NOT EXISTS immutable_job BEFORE UPDATE ON jobs BEGIN SELECT RAISE(ABORT,'immutable'); END;`);
      for (const table of ['jobs', 'records', 'evidence', 'recoveries', 'audit_intents']) for (const mutation of ['UPDATE', 'DELETE']) this.#db.exec(`CREATE TRIGGER IF NOT EXISTS immutable_${table}_${mutation} BEFORE ${mutation} ON ${table} BEGIN SELECT RAISE(ABORT,'immutable'); END;`);
      this.#db.exec('BEGIN IMMEDIATE');
      try {
        const binding = canonical([options.realm, options.siteId, 'simulation', options.deviceId]);
        this.#db.prepare('INSERT OR IGNORE INTO control VALUES(1,?,NULL,NULL,0)').run(binding);
        const c = this.#db.prepare('SELECT * FROM control').get()!;
        if (c.binding !== binding) throw new JobError('REALM_MISMATCH');
        if (c.pid !== null) {
          let alive = true;
          try { process.kill(Number(c.pid), 0); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ESRCH') alive = false; }
          if (alive) throw new JobError('RESOURCE_LIMIT');
        }
        this.#db.prepare('UPDATE control SET owner=?,pid=?').run(this.#owner, process.pid);
        this.#db.exec('COMMIT');
      } catch (e) { this.#db.exec('ROLLBACK'); throw e; }
      this.verify();
      this.#db.exec('PRAGMA user_version=1');
    } catch (e) { this.#db.close(); throw e instanceof JobError ? e : new JobError('STORAGE_UNAVAILABLE'); }
  }
  close(): void {
    if (!this.#db.isOpen) return;
    try { this.#db.prepare('UPDATE control SET owner=NULL,pid=NULL WHERE owner=?').run(this.#owner); }
    catch { this.#degraded = true; }
    finally { this.#db.close(); }
  }
  #owned(): void { if (this.#db.prepare('SELECT owner FROM control').get()?.owner !== this.#owner) throw new JobError('STORAGE_UNAVAILABLE'); }
  #transaction<T>(work: () => T): T {
    try {
      this.#db.exec('BEGIN IMMEDIATE'); this.#owned();
      this.#transitionRecord = undefined;
      const result = work();
      this.#capacity(); this.#options.fault?.('before-commit', this.#transitionRecord); this.#db.exec('COMMIT'); this.#options.fault?.('after-commit', this.#transitionRecord);
      return result;
    } catch (e) {
      try { this.#db.exec('ROLLBACK'); } catch { /* SQLite may already have rolled back SQLITE_FULL. */ }
      this.#degraded = true; throw e instanceof JobError ? e : new JobError('STORAGE_UNAVAILABLE');
    }
  }
  #capacity(): void {
    const stats = statfsSync(dirname(this.#options.path));
    const bytes = ['jobs', 'records', 'evidence', 'recoveries', 'audit_intents'].reduce((sum, table) => sum + Number(this.#db.prepare(`SELECT coalesce(sum(length(CAST(body AS BLOB))),0) AS n FROM ${table}`).get()!.n), 0);
    if (bytes > this.#options.maxBytes || Number(this.#db.prepare('SELECT count(*) AS n FROM jobs').get()!.n) > this.#options.maxJobs
      || stats.bavail * stats.bsize < this.#options.minFreeBytes) throw new JobError('RESOURCE_LIMIT');
  }
  verify(): void {
    if (this.#db.prepare('PRAGMA quick_check').get()?.quick_check !== 'ok') throw new JobError('STORAGE_UNAVAILABLE');
    for (const table of ['jobs', 'records', 'evidence', 'recoveries', 'audit_intents']) {
      for (const row of this.#db.prepare(`SELECT body,hash FROM ${table}`).all() as unknown as Row[]) {
        if (digest(JSON.parse(row.body)) !== row.hash) throw new JobError('STORAGE_UNAVAILABLE');
        if (table === 'audit_intents') checked(JSON.parse(row.body));
        if (table === 'records' && !validateMessage((JSON.parse(row.body) as JobRecord).event).ok) throw new JobError('STORAGE_UNAVAILABLE');
      }
    }
  }
  get(id: string): JobRecord | null {
    const row = this.#db.prepare('SELECT body,hash FROM records WHERE job_id=? ORDER BY ordinal DESC LIMIT 1').get(id) as unknown as Row | undefined;
    if (!row) return null;
    const r = JSON.parse(row.body) as JobRecord;
    if (digest(r) !== row.hash) throw new JobError('STORAGE_UNAVAILABLE');
    return r;
  }
  records(id: string): JobRecord[] { return this.#db.prepare('SELECT body FROM records WHERE job_id=? ORDER BY ordinal').all(id).map(r => JSON.parse(String(r.body)) as JobRecord); }
  active(): JobRecord[] {
    // Select only the latest nonterminal projections; health never materializes all retained payloads.
    return this.#db.prepare(`SELECT r.body,r.hash FROM records r
      JOIN (SELECT job_id,max(ordinal) AS ordinal FROM records GROUP BY job_id) latest ON r.ordinal=latest.ordinal
      WHERE json_extract(r.body,'$.outcome') IN ('requested','accepted','running')`).all().map(row => {
      const record = JSON.parse(String(row.body)) as JobRecord;
      if (digest(record) !== row.hash) throw new JobError('STORAGE_UNAVAILABLE'); return record;
    });
  }
  duplicate(c: Command): JobRecord | null {
    const id = c.command.commandId;
    const row = this.#db.prepare('SELECT id,fingerprint FROM jobs WHERE id=? OR (source=? AND key=?)').get(id, canonical(c.source), c.command.idempotencyKey);
    if (!row) return null;
    if (row.id !== id || row.fingerprint !== fingerprint(c)) throw new JobError('IDEMPOTENCY_CONFLICT');
    return this.get(id);
  }
  get recoveryRequired(): boolean { return this.#db.prepare('SELECT recovery FROM control').get()?.recovery === 1; }
  clock(a: LocalAuthority): void {
    const key = canonical(a.gate.receiver), now = a.gate.nowMonotonicMs;
    const row = this.#db.prepare('SELECT floor FROM clocks WHERE epoch=?').get(key);
    if (!a.clockReliable || !Number.isSafeInteger(now) || now < 0 || row && now < Number(row.floor)) throw new JobError('CLOCK_INVALID');
    this.#db.prepare('INSERT INTO clocks VALUES(?,?) ON CONFLICT(epoch) DO UPDATE SET floor=excluded.floor').run(key, now);
  }
  observeClock(a: LocalAuthority): void { this.#transaction(() => { this.clock(a); }); }
  create(c: Command, a: LocalAuthority, steps: Step[], error: ErrorCode | null): JobRecord {
    return this.#transaction(() => {
      const prior = this.duplicate(c); if (prior) return prior;
      if (!error) this.clock(a);
      const fp = fingerprint(c), body = canonical(c);
      const previous = this.#db.prepare(`SELECT json_extract(body,'$.sequence') AS sequence FROM jobs WHERE source=?
        ORDER BY length(json_extract(body,'$.sequence')) DESC,json_extract(body,'$.sequence') DESC LIMIT 1`).get(canonical(c.source));
      if (!error && previous && BigInt(String(previous.sequence)) >= BigInt(c.sequence)) error = 'SEQUENCE_REPLAY';
      if (!error && c.body.type !== 'control.stop' && (this.recoveryRequired || this.active().length > 0)) error = 'FAULT_INHIBITED';
      this.#db.prepare('INSERT INTO jobs VALUES(?,?,?,?,?,?)').run(c.command.commandId, canonical(c.source), c.command.idempotencyKey, fp, body, digest(c));
      const r: JobRecord = { command: c, fingerprint: fp, outcome: 'requested', error: null, phase: 'admitted', state: a.state, steps,
        stepIndex: 0, operation: null, sent: false, modules: structuredClone(a.modules), configurationDigest: a.applied.configurationDigest,
        appliedIdentity: { transactionId: a.applied.request.transactionId, appliedBy: structuredClone(a.applied.appliedBy) },
        calibrationRevision: a.applied.request.configuration.calibration?.revision ?? 'unavailable',
        lastAtMs: Number.isSafeInteger(a.gate.nowMonotonicMs) && a.gate.nowMonotonicMs >= 0 ? a.gate.nowMonotonicMs : 0,
        expiresAtMs: Math.min(c.command.deadline.expiresMonotonicMs, a.gate.nowMonotonicMs + ('maxDurationMs' in c.body ? c.body.maxDurationMs : 500)), event: {} as Event };
      this.#append(r, 'requested', null); return this.#append(r, error ? 'rejected' : 'accepted', error);
    });
  }
  change(id: string, mutate: (r: JobRecord) => void, next?: Outcome, error: ErrorCode | null = null, proof?: Proof): JobRecord {
    return this.#transaction(() => {
      const r = this.get(id); if (!r || terminal(r.outcome)) throw new JobError('INVALID_TRANSITION');
      if (proof) {
        const old = this.#db.prepare('SELECT body FROM evidence WHERE operation_id=?').get(proof.operationId);
        if (old && old.body !== canonical(proof)) throw new JobError('IDEMPOTENCY_CONFLICT');
        this.#db.prepare('INSERT OR IGNORE INTO evidence VALUES(?,?,?)').run(proof.operationId, canonical(proof), digest(proof));
      }
      mutate(r); return this.#append(r, next ?? r.outcome, error);
    });
  }
  #append(r: JobRecord, outcome: Outcome, error: ErrorCode | null): JobRecord {
    if (!advanceOutcome(r.event.body ? r.outcome : null, outcome).ok) throw new JobError('INVALID_TRANSITION');
    const c = r.command, sequence = String(Number(this.#db.prepare('SELECT coalesce(max(ordinal),0)+1 AS n FROM records').get()!.n));
    r.outcome = outcome; r.error = error;
    r.event = { protocol: c.protocol, messageId: randomUUID(), realm: c.realm, executionMode: c.executionMode, siteId: c.siteId, source: c.command.target,
      sequence, sourceTime: { utc: null, uncertaintyMs: null, monotonicMs: r.lastAtMs }, ingestTime: null, kind: 'event',
      body: { type: 'command.outcome', commandId: c.command.commandId, correlationId: c.command.correlationId, requestSource: c.source,
        outcome, error: error ? { code: error, retryable: false } : null, resourceId: c.body.type === 'camera.capture' && outcome === 'completed' ? c.body.resourceId : null } };
    if (!validateMessage(r.event).ok) throw new JobError('INVALID_MESSAGE');
    const body = canonical(r);
    this.#db.prepare('INSERT INTO records(job_id,body,hash) VALUES(?,?,?)').run(c.command.commandId, body, digest(r));
    const intentRow = this.#db.prepare('SELECT event_id FROM audit_intents WHERE json_extract(body,\'$.links.commandId\')=? ORDER BY ordinal LIMIT 1').get(c.command.commandId);
    const eventId = randomUUID(), intent = outcome === 'requested' && !intentRow;
    const action = c.body.type === 'motion.move' ? 'motion.move' : c.body.type === 'camera.gimbal' ? 'gimbal.move' : c.body.type === 'control.stop' ? 'control.stop' : 'capture.request';
    const audit: AuditEvent = { auditVersion: 'arbi.audit/1.0', eventId, realm: c.realm, executionMode: c.executionMode, siteId: c.siteId, actor: c.command.actor,
      source: { module: 'edge', identity: c.command.target }, sequence: String(Number(this.#db.prepare('SELECT coalesce(max(ordinal),0)+1 AS n FROM audit_intents').get()!.n)), sourceTime: r.event.sourceTime, ingestTime: null,
      resource: c.body.type === 'camera.capture' ? { kind: 'capture', id: c.body.resourceId, deviceId: c.command.target.deviceId } : { kind: 'device', id: c.command.target.deviceId, deviceId: c.command.target.deviceId }, action,
      evidence: intent ? 'intent' : ['completed', 'rejected'].includes(outcome) ? 'device-outcome' : terminal(outcome) ? 'connection-loss' : 'authorization',
      outcome: intent ? 'requested' : !terminal(outcome) ? 'allow' : outcome === 'rejected' ? 'deny' : outcome !== 'completed' ? 'interrupted' : 'succeeded',
      effect: intent || !terminal(outcome) ? 'none' : ['completed', 'rejected'].includes(outcome) ? 'device-reported' : 'unknown',
      reason: intent ? 'requested' : !terminal(outcome) ? 'authorized' : outcome === 'rejected' ? 'rejected' : outcome === 'completed' ? 'completed' : error === 'INTERRUPTED' ? 'source-restarted' : error === 'DEADLINE_EXPIRED' ? 'timeout' : 'response-lost',
      links: { correlationId: c.command.correlationId, intentEventId: intent ? eventId : String(intentRow!.event_id), causationEventId: null,
        jobId: c.command.correlationId, sessionId: c.command.lease?.id ?? null, commandId: c.command.commandId, requestSource: c.source, target: c.command.target },
      record: ['completed', 'rejected'].includes(outcome) ? { kind: 'local-record', id: r.event.messageId } : null,
      metadata: { configRevision: c.command.configRevision, calibrationRevision: r.calibrationRevision, ...(error ? { protocolErrorCode: error } : {}) }, change: null };
    checked(audit);
    this.#db.prepare('INSERT INTO audit_intents(event_id,record_id,body,hash) VALUES(?,?,?,?)').run(eventId, r.event.messageId, canonical(audit), digest(audit));
    this.#transitionRecord = structuredClone(r);
    return structuredClone(r);
  }
  recover(): number {
    const pending = this.active();
    for (const r of pending) this.change(r.command.command.commandId, value => {
      value.phase = 'operator-required'; value.state = 'Fault'; this.#db.prepare('UPDATE control SET recovery=1').run();
    }, 'failed', 'INTERRUPTED');
    return pending.length;
  }
  latch(): void { this.#transaction(() => { this.#db.prepare('UPDATE control SET recovery=1').run(); }); }
  /** Local operator composition supplies fresh independent stop/reconciliation evidence. */
  authorizeRecovery(a: LocalAuthority): void {
    if (a.mode === 'inhibited' || !a.stationary || a.state !== 'Ready' || this.active().length || this.#degraded) throw new JobError('FAULT_INHIBITED');
    this.#transaction(() => {
      this.clock(a); const id = randomUUID(), eventId = randomUUID(), reconciliation = a.reconciliation!;
      const record = { id, receiver: a.gate.receiver, configurationDigest: a.applied.configurationDigest, reconciliation };
      this.#db.prepare('INSERT INTO recoveries VALUES(?,?,?)').run(id, canonical(record), digest(record));
      const audit: AuditEvent = { auditVersion: 'arbi.audit/1.0', eventId, realm: a.gate.realm, executionMode: 'simulation', siteId: a.gate.siteId,
        actor: reconciliation.actor, source: { module: 'edge', identity: a.gate.receiver },
        sequence: String(Number(this.#db.prepare('SELECT coalesce(max(ordinal),0)+1 AS n FROM audit_intents').get()!.n)),
        sourceTime: { utc: null, uncertaintyMs: null, monotonicMs: a.gate.nowMonotonicMs }, ingestTime: null,
        resource: { kind: 'site', id: a.gate.siteId, deviceId: a.gate.receiver.deviceId }, action: 'authorization.check', evidence: 'authorization', outcome: 'allow', effect: 'none', reason: 'authorized',
        links: { correlationId: reconciliation.authorizationId, intentEventId: null, causationEventId: null, jobId: null, sessionId: null, commandId: null, requestSource: null, target: a.gate.receiver },
        record: null, metadata: { permission: 'control', configRevision: a.gate.configRevision, calibrationRevision: a.applied.request.configuration.calibration!.revision }, change: null };
      checked(audit);
      this.#db.prepare('INSERT INTO audit_intents(event_id,record_id,body,hash) VALUES(?,?,?,?)').run(eventId, id, canonical(audit), digest(audit));
      this.#db.prepare('UPDATE control SET recovery=0').run();
    });
  }
  pendingAudit(limit = 64): AuditEvent[] {
    if (!Number.isInteger(limit) || limit < 1 || limit > 64) throw new JobError('INVALID_RANGE');
    return this.#db.prepare('SELECT body,hash FROM audit_intents WHERE event_id NOT IN (SELECT event_id FROM audit_copies) ORDER BY ordinal LIMIT ?').all(limit).map(row => {
      const event = checked(JSON.parse(String(row.body))); if (digest(event) !== row.hash) throw new JobError('STORAGE_UNAVAILABLE'); return event;
    });
  }
  /** Copy-then-ack: a crash after append repeats the exact ID/content into the audit spool. */
  flushAudit(spool: (event: AuditEvent) => SqliteAuditSpool, limit = 64): number {
    let count = 0;
    try {
      for (const event of this.pendingAudit(limit)) {
        spool(event).append(event); this.#options.fault?.('after-audit-append');
        this.#transaction(() => { this.#db.prepare('INSERT OR IGNORE INTO audit_copies VALUES(?)').run(event.eventId); }); count++;
      }
      return count;
    } catch (e) { this.#degraded = true; throw e instanceof JobError ? e : new JobError('STORAGE_UNAVAILABLE'); }
  }
  status() {
    try { return { enabled: true, degraded: this.#degraded, recoveryRequired: this.recoveryRequired, active: this.active().length,
      jobs: Number(this.#db.prepare('SELECT count(*) AS n FROM jobs').get()!.n), auditPending: Number(this.#db.prepare('SELECT count(*) AS n FROM audit_intents WHERE event_id NOT IN (SELECT event_id FROM audit_copies)').get()!.n) }; }
    catch { return { enabled: true, degraded: true, recoveryRequired: true, active: null, jobs: null, auditPending: null }; }
  }
}
