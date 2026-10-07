import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { MeterError, uint, id, integer, checkStamp, checkConfig, checkSample, interval, observation, hash,
  type Scope, type Stamp, type TransferSpec, type TransferRecord, type CounterConfig, type CounterSample, type CounterRecord, type MeterRecord, type Gap } from './model.js';

export interface SpoolOptions { path: string; binding: Pick<Scope, 'realm' | 'siteId' | 'executionMode'> & { deviceId: string };
  maxRecords: number; maxBytes: number; maxPages: number; maxCounters: number }
interface Row { id: string; body: string; active: number; dirty: number }
interface Baseline { config: CounterConfig; sample: CounterSample; epoch: string }
// Fixed per-row reservation permits terminal metadata to fit after admission.
const RECORD_BYTES = 8192;
export class TrafficSpool {
  readonly #db: DatabaseSync;
  readonly #options: SpoolOptions;
  #volatileLosses = 0;
  #closed = false;
  constructor(options: SpoolOptions) {
    integer(options.maxRecords, 1, 100_000); integer(options.maxBytes, RECORD_BYTES, 128 * 1024 * 1024);
    integer(options.maxPages, 32, 32768); integer(options.maxCounters, 1, 32);
    id(options.binding.deviceId); id(options.binding.siteId);
    if (options.path === ':memory:' || !options.path) throw new MeterError('INVALID');
    this.#options = structuredClone(options);
    this.#db = new DatabaseSync(options.path, { timeout: 25 });
    try {
      this.#db.exec(`PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; PRAGMA fullfsync=ON; PRAGMA max_page_count=${options.maxPages};
        CREATE TABLE IF NOT EXISTS meter_state (id INTEGER PRIMARY KEY CHECK(id=1), binding TEXT NOT NULL, losses INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS meter_records (ordinal INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL, body TEXT NOT NULL,
          active INTEGER NOT NULL, dirty INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS meter_counters (key TEXT PRIMARY KEY, body TEXT NOT NULL, dirty INTEGER NOT NULL DEFAULT 0);`);
      if (Number(this.#db.prepare('PRAGMA max_page_count').get()!.max_page_count) > options.maxPages) throw new MeterError('CAPACITY');
      this.#db.prepare('INSERT OR IGNORE INTO meter_state VALUES(1,?,0)').run(JSON.stringify(options.binding));
      if (!isDeepStrictEqual(JSON.parse(this.#db.prepare('SELECT binding FROM meter_state').get()!.binding as string), options.binding)) throw new MeterError('CONFLICT');
      // A dead process cannot continue a submitted transfer. Recover its committed prefix exactly once.
      this.#transaction(() => {
        const rows = this.#db.prepare('SELECT * FROM meter_records WHERE active=1').all() as unknown as Row[];
        for (const row of rows) {
          const r = JSON.parse(row.body) as TransferRecord;
          r.outcome = 'crashed'; r.gap = 'collection-gap'; this.#finishObservation(r);
          this.#put(r, false);
        }
      });
    } catch (error) { this.#db.close(); throw error instanceof MeterError ? error : new MeterError('UNAVAILABLE'); }
  }
  #transaction<T>(fn: () => T): T {
    this.#db.exec('BEGIN IMMEDIATE');
    try { const value = fn(); this.#db.exec('COMMIT'); return value; }
    catch (error) { try { this.#db.exec('ROLLBACK'); } catch { /* SQLite FULL may roll back itself. */ } throw error; }
  }
  #run<T>(fn: () => T): T {
    try { return this.#transaction(fn); }
    catch (error) {
      this.noteLoss(); throw error instanceof MeterError ? error : new MeterError('UNAVAILABLE');
    }
  }
  /** Called by best-effort adapters after a rejected sample/chunk; never call before a local stop. */
  noteLoss(): void {
    try { this.#transaction(() => {
      this.#db.exec('UPDATE meter_state SET losses=MIN(losses+1,2147483647); UPDATE meter_counters SET dirty=1; UPDATE meter_records SET dirty=1 WHERE active=1;');
    }); } catch { this.#volatileLosses = Math.min(this.#volatileLosses + 1, 2147483647); }
  }
  #put(r: MeterRecord, active: boolean): void {
    const body = JSON.stringify(r);
    if (Buffer.byteLength(body) > RECORD_BYTES) throw new MeterError('CAPACITY');
    const exists = this.#db.prepare('SELECT id FROM meter_records WHERE id=?').get(r.id);
    if (!exists) {
      const count = this.#db.prepare('SELECT COUNT(*) AS n FROM meter_records').get()!.n as number;
      if (count >= this.#options.maxRecords || (count + 1) * RECORD_BYTES > this.#options.maxBytes) throw new MeterError('CAPACITY');
    }
    this.#db.prepare('INSERT INTO meter_records(id,body,active) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body,active=excluded.active').run(r.id, body, Number(active));
  }
  #scope(scope: Scope): void {
    const b = this.#options.binding;
    if (!isDeepStrictEqual(scope.realm, b.realm) || scope.siteId !== b.siteId || scope.executionMode !== b.executionMode || scope.source.deviceId !== b.deviceId) throw new MeterError('CONFLICT');
  }
  begin(spec: TransferSpec, time: Stamp): string {
    this.#scope(spec.scope); checkStamp(time);
    if (spec.retryOf !== null) id(spec.retryOf);
    if (spec.category === 'recording') throw new MeterError('INVALID');
    // Validate all contract fields even when source-clock uncertainty prevents UTC emission.
    observation(spec.scope, 'validation', 'application-payload', spec.direction,
      { start: '2026-01-01T00:00:00.000Z', end: '2026-01-01T00:00:01.000Z' }, '0',
      { coverage: 'partial', includes: spec.includes, maxAgeMs: 60_000, reason: 'unattributed' }, spec.category, spec.media);
    const r: TransferRecord = { kind: 'transfer', id: randomUUID(), spec: structuredClone(spec), start: structuredClone(time), end: structuredClone(time),
      bytes: '0', outcome: 'open', gap: null, observations: [] };
    this.#run(() => this.#put(r, true)); return r.id;
  }
  #transfer(key: string): TransferRecord {
    id(key);
    const row = this.#db.prepare('SELECT * FROM meter_records WHERE id=? AND active=1').get(key) as unknown as Row | undefined;
    if (!row) throw new MeterError('CONFLICT');
    const r = JSON.parse(row.body) as TransferRecord;
    if (row.dirty) r.gap = 'collection-gap';
    return r;
  }
  /** Actual bytes submitted to the app transport, or yielded by its receive stream. Not confirmed wire delivery. */
  progress(key: string, bytes: string, time: Stamp): void {
    const increment = uint(bytes); checkStamp(time);
    this.#run(() => {
      const r = this.#transfer(key); r.bytes = uint((uint(r.bytes) + increment).toString()).toString();
      if (time.clockId !== r.end.clockId || uint(time.monotonicNs) < uint(r.end.monotonicNs)) throw new MeterError('INVALID');
      r.end = structuredClone(time); this.#put(r, true);
    });
  }
  #finishObservation(r: TransferRecord): void {
    const window = interval(r.start, r.end);
    if (!window) { r.gap ??= 'clock-uncertain'; r.observations = []; return; }
    r.observations = [observation(r.spec.scope, r.id, 'application-payload', r.spec.direction, window, r.bytes,
      { coverage: 'partial', includes: r.spec.includes, maxAgeMs: 60_000,
        reason: r.gap === 'collection-gap' ? 'collection-gap' : 'unattributed' }, r.spec.category, r.spec.media)];
  }
  finish(key: string, outcome: Exclude<TransferRecord['outcome'], 'open' | 'crashed'>, time: Stamp): void {
    checkStamp(time);
    if (!['completed', 'failed', 'aborted'].includes(outcome)) throw new MeterError('INVALID');
    this.#run(() => {
      const r = this.#transfer(key); r.outcome = outcome; r.end = structuredClone(time); this.#finishObservation(r); this.#put(r, false);
    });
  }
  collect(config: CounterConfig, sample: CounterSample): CounterRecord {
    this.#scope(config.scope); checkConfig(config); checkSample(sample, config.width);
    return this.#run(() => {
      const stored = this.#db.prepare('SELECT * FROM meter_counters WHERE key=?').get(config.key);
      const prior = stored ? JSON.parse(stored.body as string) as Baseline : null;
      const clean = (c: CounterConfig) => ({ ...c, scope: { ...c.scope, source: { deviceId: c.scope.source.deviceId } } });
      let gap: Gap | null = prior === null ? 'baseline' : stored!.dirty ? 'collection-gap' : null;
      if (prior && !isDeepStrictEqual(clean(config), clean(prior.config))) gap = 'replacement';
      if (prior && prior.sample.bootId !== sample.bootId) gap = 'reboot';
      if (prior && (prior.sample.interfaceId !== sample.interfaceId || prior.sample.counterId !== sample.counterId)) gap = 'replacement';
      const elapsed = prior && sample.time.clockId === prior.sample.time.clockId ? uint(sample.time.monotonicNs) - uint(prior.sample.time.monotonicNs) : -1n;
      if (prior && (elapsed <= 0n || elapsed > BigInt(config.maxIntervalMs) * 1_000_000n)) gap ??= 'collection-gap';
      let rollover = false;
      const deltas = { upload: '0', download: '0' };
      if (prior && gap === null) for (const dir of ['upload', 'download'] as const) {
        const previous = prior.sample, modulus = 1n << BigInt(config.width);
        let delta = uint(sample[dir]) - uint(previous[dir]);
        if ((sample.wraps === null) !== (previous.wraps === null)) { gap = 'counter-reset'; break; }
        if (sample.wraps !== null && previous.wraps !== null) {
          const wraps = uint(sample.wraps[dir]) - uint(previous.wraps[dir]);
          if (wraps < 0n) { gap = 'counter-reset'; break; }
          delta += wraps * modulus; rollover ||= wraps > 0n;
        }
        if (delta < 0n || delta > uint(config.maxDeltaBytes)) { gap = 'counter-reset'; break; }
        deltas[dir] = delta.toString();
      }
      const epoch = prior && gap === null ? prior.epoch : randomUUID();
      const window = prior ? interval(prior.sample.time, sample.time) : null;
      const r: CounterRecord = { kind: 'counter', id: randomUUID(), config: structuredClone(config), epoch,
        previous: prior?.sample ?? null, current: structuredClone(sample), gap, deltas: gap === null ? deltas : null, rollover: gap === null && rollover, observations: [] };
      if (!window) r.gap ??= 'clock-uncertain';
      if (window) r.observations = (['upload', 'download'] as const).map((dir) => observation(config.scope, epoch, config.layer, dir, window,
        r.deltas?.[dir] ?? null, { coverage: r.deltas === null ? 'unknown' : config.coverage, includes: r.deltas === null ? [] : config.includes,
          maxAgeMs: config.maxAgeMs, reason: r.deltas === null ? (gap === 'counter-reset' || gap === 'reboot' || gap === 'replacement' ? 'counter-reset' : 'collection-gap')
            : config.coverage === 'complete' ? null : 'unattributed' }));
      if (!prior && (this.#db.prepare('SELECT COUNT(*) AS n FROM meter_counters').get()!.n as number) >= this.#options.maxCounters) throw new MeterError('CAPACITY');
      this.#put(r, false);
      this.#db.prepare('INSERT INTO meter_counters(key,body,dirty) VALUES(?,?,0) ON CONFLICT(key) DO UPDATE SET body=excluded.body,dirty=0')
        .run(config.key, JSON.stringify({ config, sample, epoch } satisfies Baseline));
      return structuredClone(r);
    });
  }
  unavailable(config: CounterConfig, reason: 'not-configured' | 'unsupported-counter' | 'not-reported', time: Stamp): void {
    this.#scope(config.scope); checkConfig(config); checkStamp(time);
    this.#run(() => {
      const priorRow = this.#db.prepare('SELECT body FROM meter_counters WHERE key=?').get(config.key);
      const prior = priorRow ? JSON.parse(priorRow.body as string) as Baseline : null;
      const r: CounterRecord = { kind: 'counter', id: randomUUID(), config: structuredClone(config), epoch: randomUUID(), previous: prior?.sample ?? null,
        current: null, gap: reason, deltas: null, rollover: false, observations: [] };
      const window = prior ? interval(prior.sample.time, time) : null;
      if (window) r.observations = (['upload', 'download'] as const).map((dir) => observation(config.scope, r.epoch, config.layer, dir, window, null,
        { coverage: 'unknown', includes: [], maxAgeMs: config.maxAgeMs, reason }));
      this.#put(r, false); this.#db.prepare('UPDATE meter_counters SET dirty=1 WHERE key=?').run(config.key);
    });
  }
  pending(limit = 32): { record: MeterRecord; contentHash: string }[] {
    integer(limit, 1, 64);
    return (this.#db.prepare('SELECT body FROM meter_records WHERE active=0 ORDER BY ordinal LIMIT ?').all(limit) as { body: string }[])
      .map(({ body }) => ({ record: JSON.parse(body) as MeterRecord, contentHash: hash(body) }));
  }
  /** Caller must obtain a durable receipt from the eventual #35 sink before prefix removal. */
  acknowledge(receipt: { id: string; contentHash: string; durable: true }): void {
    this.#transaction(() => {
      const row = this.#db.prepare('SELECT * FROM meter_records WHERE active=0 ORDER BY ordinal LIMIT 1').get() as unknown as Row | undefined;
      if (!row || receipt.durable !== true || row.id !== receipt.id || hash(row.body) !== receipt.contentHash) throw new MeterError('CONFLICT');
      this.#db.prepare('DELETE FROM meter_records WHERE id=?').run(row.id);
    });
  }
  status(): { pending: number | null; active: number | null; reservedBytes: number | null; losses: number | null; volatileLosses: number; degraded: boolean } {
    try {
      const total = this.#db.prepare('SELECT COUNT(*) AS n,COALESCE(SUM(active),0) AS a FROM meter_records').get()!;
      const losses = this.#db.prepare('SELECT losses FROM meter_state').get()!.losses as number;
      return { pending: Number(total.n) - Number(total.a), active: Number(total.a), reservedBytes: Number(total.n) * RECORD_BYTES,
        losses, volatileLosses: this.#volatileLosses, degraded: losses > 0 || this.#volatileLosses > 0 };
    } catch { return { pending: null, active: null, reservedBytes: null, losses: null, volatileLosses: this.#volatileLosses, degraded: true }; }
  }
  close(): void { if (!this.#closed) { this.#closed = true; this.#db.close(); } }
}
