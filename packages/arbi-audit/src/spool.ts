import { DatabaseSync } from "node:sqlite";
import { isDeepStrictEqual } from "node:util";
import type { AuditEvent, AuditSource, Realm } from "@arbi/protocol";
import { AuditError, canonical, chainHash, checked, contentHash, GENESIS, streamKey } from "./integrity.js";
import type { DurableReceipt } from "./integrity.js";

export interface SpoolOptions {
  path: string; realm: Realm; siteId: string; executionMode: AuditEvent["executionMode"]; source: AuditSource;
  maxEvents: number; maxBytes: number; maxPages: number;
}
interface Row { ordinal: number; event_id: string; body: string; bytes: number; hash: string; previous: string; chain: string }
interface State { tail: number; tail_hash: string; anchor: number; anchor_hash: string; lost: number; blocked: number }
/** A bounded delivery spool shared by supervised edge and pod Node/Linux runtimes. */
export class SqliteAuditSpool {
  readonly #db: DatabaseSync;
  #volatileLosses = 0;
  #volatileBlocked = 0;
  #unavailable = false;
  readonly #options: SpoolOptions;
  constructor(options: SpoolOptions) {
    this.#options = structuredClone(options);
    if (options.path === ":memory:" || !Number.isSafeInteger(options.maxEvents) || options.maxEvents < 1 ||
      options.maxEvents > 100_000 || !Number.isSafeInteger(options.maxBytes) || options.maxBytes < 8192 ||
      !Number.isSafeInteger(options.maxPages) || options.maxPages < 32 || options.maxPages > 1_000_000) throw new AuditError("INVALID_REQUEST");
    this.#db = new DatabaseSync(options.path, { timeout: 250 });
    try {
      // DELETE journaling bounds growth; FULL synchronizes each committed transaction.
      this.#db.exec(`PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; PRAGMA fullfsync=ON;
        PRAGMA max_page_count=${options.maxPages}; PRAGMA foreign_keys=ON;
        CREATE TABLE IF NOT EXISTS spool_state (id INTEGER PRIMARY KEY CHECK(id=1), binding TEXT NOT NULL,
          tail INTEGER NOT NULL, tail_hash TEXT NOT NULL, anchor INTEGER NOT NULL, anchor_hash TEXT NOT NULL,
          lost INTEGER NOT NULL, blocked INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS spool_events (ordinal INTEGER PRIMARY KEY, event_id TEXT UNIQUE NOT NULL,
          body TEXT NOT NULL, bytes INTEGER NOT NULL, hash TEXT NOT NULL, previous TEXT NOT NULL, chain TEXT NOT NULL);
        CREATE TRIGGER IF NOT EXISTS spool_no_update BEFORE UPDATE ON spool_events BEGIN SELECT RAISE(ABORT,'immutable'); END;`);
      // Boot changes reuse a spool; the binding is installation/device/module, not a volatile epoch.
      const binding = canonical([options.realm, options.siteId, options.executionMode, options.source.module, options.source.identity.deviceId]);
      this.#db.prepare("INSERT OR IGNORE INTO spool_state VALUES (1,?,0,?,0,?,0,0)").run(binding, GENESIS, GENESIS);
      if (this.#db.prepare("SELECT binding FROM spool_state").get()?.binding !== binding) throw new AuditError("DENIED");
      this.verify();
    } catch (error) { this.#db.close(); throw error instanceof AuditError ? error : new AuditError("UNAVAILABLE"); }
  }
  close(): void { if (this.#db.isOpen) this.#db.close(); }
  #state(): State { return this.#db.prepare("SELECT * FROM spool_state WHERE id=1").get() as unknown as State; }
  #rows(): Row[] { return this.#db.prepare("SELECT * FROM spool_events ORDER BY ordinal").all() as unknown as Row[]; }
  #transaction<T>(work: () => T): T {
    this.#db.exec("BEGIN IMMEDIATE");
    try { const result = work(); this.#db.exec("COMMIT"); return result; }
    catch (error) { try { this.#db.exec("ROLLBACK"); } catch { /* may already have rolled back on SQLITE_FULL */ } throw error; }
  }
  verify(): { ordinal: number; hash: string } {
    const state = this.#state(); let ordinal = state.anchor, hash = state.anchor_hash;
    for (const row of this.#rows()) {
      let event: AuditEvent;
      try { event = checked(JSON.parse(row.body)); } catch { throw new AuditError("TAMPER"); }
      if (row.ordinal !== ordinal + 1 || row.previous !== hash || row.hash !== contentHash(event) ||
        row.event_id !== event.eventId || row.bytes !== Buffer.byteLength(row.body) ||
        row.chain !== chainHash(hash, row.ordinal, row.hash)) throw new AuditError("TAMPER");
      ordinal = row.ordinal; hash = row.chain;
    }
    if (ordinal !== state.tail || hash !== state.tail_hash) throw new AuditError("TAMPER");
    return { ordinal, hash };
  }
  /** Returns only after COMMIT. Caller may perform sensitive work only after success. */
  append(input: unknown): { eventId: string; contentHash: string } {
    const event = checked(input), options = this.#options;
    if (!isDeepStrictEqual(event.realm, options.realm) || event.siteId !== options.siteId || event.executionMode !== options.executionMode ||
      !isDeepStrictEqual(event.source, options.source)) throw new AuditError("DENIED");
    const hash = contentHash(event), body = canonical(event), bytes = Buffer.byteLength(body);
    try {
      return this.#transaction(() => {
        this.verify();
        const prior = this.#db.prepare("SELECT hash FROM spool_events WHERE event_id=?").get(event.eventId);
        if (prior) { if (prior.hash !== hash) throw new AuditError("CONFLICT"); return { eventId: event.eventId, contentHash: hash }; }
        const rows = this.#rows();
        if (rows.length >= options.maxEvents || rows.reduce((sum, row) => sum + row.bytes, 0) + bytes > options.maxBytes) throw new AuditError("CAPACITY");
        if (rows.some((row) => { const e = JSON.parse(row.body) as AuditEvent; return streamKey(e) === streamKey(event) && e.sequence === event.sequence; })) throw new AuditError("CONFLICT");
        const state = this.#state(), ordinal = state.tail + 1;
        if (!Number.isSafeInteger(ordinal)) throw new AuditError("CAPACITY");
        const chain = chainHash(state.tail_hash, ordinal, hash);
        this.#db.prepare("INSERT INTO spool_events VALUES (?,?,?,?,?,?,?)").run(ordinal, event.eventId, body, bytes, hash, state.tail_hash, chain);
        this.#db.prepare("UPDATE spool_state SET tail=?,tail_hash=? WHERE id=1").run(ordinal, chain);
        return { eventId: event.eventId, contentHash: hash };
      });
    } catch (error) { this.#unavailable = true; throw error instanceof AuditError ? error : new AuditError("UNAVAILABLE"); }
  }
  admit(intent: unknown): { eventId: string; contentHash: string } {
    if (checked(intent).evidence !== "intent") throw new AuditError("INVALID_REQUEST");
    try { return this.append(intent); }
    catch (error) { try { this.#db.prepare("UPDATE spool_state SET blocked=MIN(blocked+1,2147483647) WHERE id=1").run(); }
      catch { this.#volatileBlocked = Math.min(this.#volatileBlocked+1,2147483647); } throw error; }
  }
  /** Stop executes first; no SQLite write, cloud callback or audit validation can gate it. */
  localSafetyStop<T>(stop: () => T, event: () => unknown): { result: T; recorded: boolean } {
    const result = stop();
    try { this.append(event()); return { result, recorded: true }; }
    catch {
      try { this.#db.prepare("UPDATE spool_state SET lost=MIN(lost+1,2147483647) WHERE id=1").run(); }
      catch { this.#volatileLosses = Math.min(this.#volatileLosses + 1, 2147483647); }
      this.#unavailable = true;
      return { result, recorded: false };
    }
  }
  pending(limit = 32): AuditEvent[] {
    if (!Number.isInteger(limit) || limit < 1 || limit > 64) throw new AuditError("INVALID_REQUEST");
    this.verify(); return this.#rows().slice(0, limit).map((row) => JSON.parse(row.body) as AuditEvent);
  }
  /** Only prefix acknowledgement is compacted; a lost response leaves the same event replayable. */
  acknowledge(receipt: DurableReceipt): void {
    this.#transaction(() => {
      this.verify(); const row = this.#rows()[0];
      if (!row || receipt.durable !== true || row.event_id !== receipt.eventId || row.hash !== receipt.contentHash) throw new AuditError("CONFLICT");
      const received = checked({ ...JSON.parse(row.body), ingestTime: receipt.ingestTime }, true);
      if (received.ingestTime === null) throw new AuditError("INVALID_REQUEST");
      this.#db.prepare("DELETE FROM spool_events WHERE ordinal=?").run(row.ordinal);
      this.#db.prepare("UPDATE spool_state SET anchor=?,anchor_hash=? WHERE id=1").run(row.ordinal, row.chain);
    });
  }
  async replay(send: (event: AuditEvent) => Promise<DurableReceipt>, limit = 32): Promise<number> {
    let count = 0;
    for (const event of this.pending(limit)) { this.acknowledge(await send(event)); count++; }
    this.#unavailable = false; return count;
  }
  status(): { pending: number | null; bytes: number | null; lost: number | null; volatileLosses: number;
    blocked: number | null; volatileBlocked: number; degraded: boolean } {
    try {
      const state = this.#state(), rows = this.#rows();
      return { pending: rows.length, bytes: rows.reduce((sum, row) => sum + row.bytes, 0), lost: state.lost,
        volatileLosses: this.#volatileLosses, blocked: state.blocked, volatileBlocked: this.#volatileBlocked,
        degraded: this.#unavailable || state.lost > 0 || state.blocked > 0 };
    } catch {
      return { pending: null, bytes: null, lost: null, blocked: null, volatileLosses: this.#volatileLosses,
        volatileBlocked: this.#volatileBlocked, degraded: true };
    }
  }
}
