import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { canonical, checked, digest, type SqliteAuditSpool } from '@arbi/audit';
import type { Actor, AuditEvent, CommissioningIdentity, ConfigurationComponent, ConfigurationReport, Identity, Realm } from '@arbi/protocol';
import { CommissioningError, validateSet, type CommissioningSet } from './contracts.js';

export interface Enrollment {
  identity: Identity;
  component: Extract<ConfigurationComponent, { kind: 'module' }>;
  realm: Realm; siteId: string; executionMode: 'simulation'; protocol: string;
  hardwareDigest: string;
  readableSchemas: string[]; rollbackSchemas: string[];
}
export interface CommissioningState {
  active: CommissioningSet | null; staged: CommissioningSet | null;
  rejected: { identity: CommissioningIdentity | null; reason: string } | null;
  phase: 'uncommissioned' | 'staged' | 'activating' | 'active' | 'blocked';
  blockedReason: string | null;
  enrollments: Enrollment[];
  reports: ConfigurationReport[];
  journals: Record<string, import('@arbi/protocol').ConfigurationJournal>;
  activationId: string | null;
}
export const setIdentity = (set: CommissioningSet): CommissioningIdentity => ({ revision: set.configuration.revision, digest: digest(set),
  configurationDigest: digest(set.configuration), calibrationRevision: set.configuration.calibration!.revision });
const empty = (): CommissioningState => ({ active: null, staged: null, rejected: null, phase: 'uncommissioned', blockedReason: 'NOT_COMMISSIONED',
  enrollments: [], reports: [], journals: {}, activationId: null });
export interface StoreOptions {
  path: string; realm: Realm; siteId: string; source: Identity;
  maxRecords?: number; maxBytes?: number; maxPages?: number;
  fault?: (point: 'before-commit' | 'after-commit') => void;
}
/** Immutable snapshots and the audit outbox commit together. No record rotation loses revision history. */
export class CommissioningStore {
  readonly #db: DatabaseSync;
  readonly #owner = randomUUID();
  readonly #options: StoreOptions;
  #degraded = false;
  constructor(options: StoreOptions) {
    this.#options = { maxRecords: 512, maxBytes: 32 * 1024 * 1024, maxPages: 16384, ...options };
    if (options.path === ':memory:' || options.realm.environment !== 'test' ||
      ![this.#options.maxRecords, this.#options.maxBytes, this.#options.maxPages].every(n => Number.isSafeInteger(n) && n! > 0)
      || this.#options.maxRecords! > 4096 || this.#options.maxBytes! > 134217728 || this.#options.maxPages! > 32768) throw new CommissioningError('INVALID_STORE');
    this.#db = new DatabaseSync(options.path, { timeout: 100 });
    try {
      const version = this.#db.prepare('PRAGMA user_version').get()!.user_version;
      if (version !== 0 && version !== 1) throw new CommissioningError('INVALID_STORE');
      this.#db.exec(`PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; PRAGMA fullfsync=ON;
        PRAGMA max_page_count=${this.#options.maxPages}; PRAGMA foreign_keys=ON;
        CREATE TABLE IF NOT EXISTS owner (id INTEGER PRIMARY KEY CHECK(id=1), binding TEXT NOT NULL, token TEXT, pid INTEGER);
        CREATE TABLE IF NOT EXISTS records (ordinal INTEGER PRIMARY KEY, record_id TEXT UNIQUE NOT NULL, reason_code TEXT NOT NULL, actor TEXT NOT NULL, session_id TEXT, body TEXT NOT NULL, hash TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS audit (ordinal INTEGER PRIMARY KEY, event_id TEXT UNIQUE NOT NULL, record_id TEXT REFERENCES records(record_id), body TEXT NOT NULL, hash TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS copies (event_id TEXT PRIMARY KEY REFERENCES audit(event_id));`);
      for (const table of ['records', 'audit']) for (const mutation of ['UPDATE', 'DELETE']) this.#db.exec(`CREATE TRIGGER IF NOT EXISTS immutable_${table}_${mutation} BEFORE ${mutation} ON ${table} BEGIN SELECT RAISE(ABORT,'immutable'); END;`);
      this.#db.exec('BEGIN IMMEDIATE');
      const binding = canonical([options.realm, options.siteId, options.source.deviceId]);
      this.#db.prepare('INSERT OR IGNORE INTO owner VALUES(1,?,NULL,NULL)').run(binding);
      const row = this.#db.prepare('SELECT * FROM owner').get()!;
      if (row.binding !== binding) throw new CommissioningError('SCOPE_MISMATCH');
      if (row.pid !== null) {
        let alive = true;
        try { process.kill(Number(row.pid), 0); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ESRCH') alive = false; }
        if (alive) throw new CommissioningError('STORE_OWNED');
      }
      this.#db.prepare('UPDATE owner SET token=?,pid=?').run(this.#owner, process.pid);
      this.verify(); this.#db.exec('PRAGMA user_version=1; COMMIT');
    } catch (e) { try { this.#db.exec('ROLLBACK'); } catch { /* not in transaction */ } this.#db.close(); throw e; }
  }
  get degraded() { return this.#degraded; }
  close() {
    if (!this.#db.isOpen) return;
    try { this.#db.prepare('UPDATE owner SET token=NULL,pid=NULL WHERE token=?').run(this.#owner); }
    finally { this.#db.close(); }
  }
  verify() {
    if (this.#db.prepare('PRAGMA quick_check').get()?.quick_check !== 'ok') throw new CommissioningError('CORRUPT_STORE');
    for (const table of ['records', 'audit']) for (const row of this.#db.prepare(`SELECT * FROM ${table}`).all()) {
      const value = JSON.parse(String(row.body));
      const content = table === 'records' ? { state: value, reasonCode: row.reason_code, actor: JSON.parse(String(row.actor)), sessionId: row.session_id } : value;
      if (digest(content) !== row.hash) throw new CommissioningError('CORRUPT_STORE');
      if (table === 'audit') { checked(value); if (row.event_id !== value.eventId || String(row.ordinal) !== value.sequence) throw new CommissioningError('CORRUPT_STORE'); }
      else { const s = value as CommissioningState; if (s.active) validateSet(s.active); if (s.staged) validateSet(s.staged); }
    }
  }
  state(): CommissioningState {
    const row = this.#db.prepare('SELECT body FROM records ORDER BY ordinal DESC LIMIT 1').get();
    return row ? JSON.parse(String(row.body)) as CommissioningState : empty();
  }
  history(): CommissioningState[] { return this.#db.prepare('SELECT body FROM records ORDER BY ordinal').all().map(r => JSON.parse(String(r.body))); }
  #transaction(work: () => void) {
    try {
      this.#db.exec('BEGIN IMMEDIATE');
      if (this.#db.prepare('SELECT token FROM owner').get()?.token !== this.#owner) throw new CommissioningError('STORE_OWNED');
      work();
      const records = Number(this.#db.prepare('SELECT count(*) AS n FROM records').get()!.n);
      const bytes = ['records', 'audit'].reduce((n, table) => n + Number(this.#db.prepare(`SELECT coalesce(sum(length(CAST(body AS BLOB))),0) AS n FROM ${table}`).get()!.n), 0);
      const audits = Number(this.#db.prepare('SELECT count(*) AS n FROM audit').get()!.n);
      if (records > this.#options.maxRecords! || audits > this.#options.maxRecords! * 8 || bytes > this.#options.maxBytes!) throw new CommissioningError('STORE_CAPACITY');
      this.#options.fault?.('before-commit'); this.#db.exec('COMMIT'); this.#options.fault?.('after-commit');
    } catch (e) { try { this.#db.exec('ROLLBACK'); } catch { /* commit may have succeeded */ } this.#degraded = true; throw e; }
  }
  /** Every snapshot records authenticated actor and before/after identities with bounded reason codes. */
  commit(state: CommissioningState, actor: Actor, sessionId: string | null, reasonCode: string, atMs: number, decision: 'allow' | 'deny' | 'applied' = 'allow') {
    const previous = this.state(), eventId = randomUUID(), recordId = randomUUID();
    const before = previous.staged ?? previous.active, after = state.staged ?? state.active;
    const intent: AuditEvent = { auditVersion: 'arbi.audit/1.0', eventId, realm: this.#options.realm, executionMode: 'simulation', siteId: this.#options.siteId,
      actor, source: { module: 'edge', identity: this.#options.source }, sequence: '0', sourceTime: { utc: null, uncertaintyMs: null, monotonicMs: atMs }, ingestTime: null,
      resource: { kind: 'configuration', id: after?.configuration.revision ?? 'commissioning', deviceId: this.#options.source.deviceId },
      action: 'configuration.change', evidence: 'intent', outcome: 'requested', effect: 'none', reason: 'requested',
      links: { correlationId: state.activationId ?? recordId, intentEventId: eventId, causationEventId: null, jobId: state.activationId, sessionId,
        commandId: state.activationId ?? recordId, requestSource: this.#options.source, target: this.#options.source },
      record: null, metadata: { permission: 'configure', ...(after ? { configRevision: after.configuration.revision, calibrationRevision: after.configuration.calibration!.revision } : {}) },
      change: { fields: ['references', 'target-mapping', 'motion-envelope', 'gimbal-limits'],
        before: { revisionId: before?.configuration.revision ?? null, state: before ? previous.phase === 'active' ? 'active' : 'staged' : 'absent' },
        after: { revisionId: after?.configuration.revision ?? null, state: !after ? 'absent' : state.phase === 'active' ? 'active' : state.phase === 'blocked' ? 'failed' : 'staged' } } };
    const outcome: AuditEvent = { ...structuredClone(intent), eventId: randomUUID(), evidence: decision === 'applied' ? 'device-outcome' : 'authorization',
      outcome: decision === 'applied' ? 'succeeded' : decision, effect: decision === 'applied' ? 'device-reported' : 'none',
      reason: decision === 'applied' ? 'completed' : decision === 'deny' ? 'local-inhibit' : 'authorized',
      links: { ...intent.links, intentEventId: eventId }, record: decision === 'applied' ? { kind: 'local-record', id: recordId } : null, change: intent.change };
    this.#transaction(() => {
      this.#db.prepare('INSERT INTO records(record_id,reason_code,actor,session_id,body,hash) VALUES(?,?,?,?,?,?)').run(recordId, reasonCode, canonical(actor), sessionId, canonical(state), digest({ state, reasonCode, actor, sessionId }));
      this.#append(intent, recordId); this.#append(outcome, recordId);
    });
  }
  auditAuthorization(actor: Actor, sessionId: string | null, allowed: boolean, correlationId: string, atMs: number) {
    const event: AuditEvent = { auditVersion: 'arbi.audit/1.0', eventId: randomUUID(), realm: this.#options.realm, executionMode: 'simulation', siteId: this.#options.siteId,
      actor, source: { module: 'edge', identity: this.#options.source }, sequence: '0', sourceTime: { utc: null, uncertaintyMs: null, monotonicMs: atMs }, ingestTime: null,
      resource: { kind: 'site', id: this.#options.siteId, deviceId: null }, action: 'authorization.check', evidence: 'authorization', outcome: allowed ? 'allow' : 'deny', effect: 'none', reason: allowed ? 'authorized' : 'not-authorized',
      links: { correlationId, sessionId, intentEventId: null, causationEventId: null, jobId: null, commandId: null, requestSource: null, target: null }, record: null, metadata: { permission: 'configure' }, change: null };
    this.#transaction(() => this.#append(event));
  }
  #append(event: AuditEvent, recordId: string | null = null) {
    event.sequence = String(Number(this.#db.prepare('SELECT coalesce(max(ordinal),0)+1 AS n FROM audit').get()!.n));
    checked(event); this.#db.prepare('INSERT INTO audit(event_id,record_id,body,hash) VALUES(?,?,?,?)').run(event.eventId, recordId, canonical(event), digest(event));
  }
  pendingAudit(): AuditEvent[] {
    return this.#db.prepare('SELECT body FROM audit WHERE event_id NOT IN (SELECT event_id FROM copies) ORDER BY ordinal LIMIT 64').all().map(r => JSON.parse(String(r.body)));
  }
  flushAudit(spool: (event: AuditEvent) => SqliteAuditSpool) {
    for (const event of this.pendingAudit()) {
      spool(event).append(event);
      this.#db.prepare('INSERT OR IGNORE INTO copies VALUES(?)').run(event.eventId);
    }
  }
}
