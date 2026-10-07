import { isDeepStrictEqual } from "node:util";
import { admitAuditEvent, correlateAuditEvent } from "@arbi/protocol";
import type { AuditBoundary, AuditEvent, Realm } from "@arbi/protocol";
import { AuditError, chainHash, checked, contentHash, digest, GENESIS, streamKey } from "@arbi/audit";
import type { DurableReceipt } from "@arbi/audit";
import type { SqlDatabase, SqlSession } from "../enrollment/store";

export type TrustedBinding = Omit<AuditBoundary, "ingestTime">;
export type StagedReceipt = Omit<DurableReceipt, "durable">;
export interface AuditRow extends Record<string, unknown> {
  id: string; ordinal: string; content_hash: string; previous_hash: string; hash: string; record: AuditEvent;
}
export function scope(realm: Realm, siteId: string): string[] { return [realm.environment, realm.namespaceId, siteId]; }
function receipt(row: AuditRow): StagedReceipt {
  if (!row.record.ingestTime) throw new AuditError("TAMPER");
  return { eventId: row.id, contentHash: row.content_hash, ingestTime: row.record.ingestTime };
}
export class PostgresAuditStore {
  constructor(readonly db: SqlDatabase, readonly receiverId = "audit-ingest", readonly now = Date.now, readonly uncertaintyMs = 1000) {}
  /** Transaction-local staging never advertises durable receipt before the enclosing COMMIT. */
  async stage(sql: SqlSession, input: unknown, binding: TrustedBinding): Promise<StagedReceipt> {
    // A pool/session preference must not downgrade the receipt's WAL durability.
    await sql.query("SET LOCAL synchronous_commit = on");
    const durability = (await sql.query<{ fsync: string }>("SHOW fsync")).rows[0];
    if (durability?.fsync !== "on") throw new AuditError("UNAVAILABLE");
    const event = checked(input);
    const admitted = admitAuditEvent(event, { ...binding, ingestTime: {
      utc: new Date(this.now()).toISOString(), uncertaintyMs: this.uncertaintyMs, deviceId: this.receiverId,
    } });
    if (!admitted.ok) throw new AuditError("DENIED");
    if (event.evidence !== "intent" && event.links.intentEventId !== null) {
      const root = (await sql.query<{ record: AuditEvent }>("SELECT record FROM arbi_audit_history WHERE id=$1 AND environment=$2 AND namespace_id=$3 AND site_id=$4",
        [event.links.intentEventId,...scope(event.realm,event.siteId)])).rows;
      if (root.length !== 1 || !correlateAuditEvent(root[0].record,event).ok) throw new AuditError("DENIED");
    }
    const key = scope(event.realm, event.siteId), hash = contentHash(event), stream = streamKey(event);
    await sql.query("INSERT INTO arbi_audit_heads(environment,namespace_id,site_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING", key);
    const head = (await sql.query<{ ordinal: string; hash: string }>(
      "SELECT ordinal,hash FROM arbi_audit_heads WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 FOR UPDATE", key)).rows[0];
    const prior = (await sql.query<AuditRow>("SELECT * FROM arbi_audit_events WHERE id=$1 OR (stream=$2 AND sequence=$3)", [event.eventId, stream, event.sequence])).rows;
    if (prior.length) {
      if (prior.length !== 1 || prior[0].id !== event.eventId || prior[0].content_hash !== hash ||
        !isDeepStrictEqual({ ...prior[0].record, ingestTime: null }, event)) throw new AuditError("CONFLICT");
      return receipt(prior[0]);
    }
    const ordinal = Number(head.ordinal) + 1;
    if (!Number.isSafeInteger(ordinal)) throw new AuditError("CAPACITY");
    const nextHash = chainHash(head.hash, ordinal, digest(admitted.value));
    const row = (await sql.query<AuditRow>(`INSERT INTO arbi_audit_events
      (id,environment,namespace_id,site_id,ordinal,stream,sequence,content_hash,previous_hash,hash,record)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb) RETURNING *`,
      [event.eventId, ...key, ordinal, stream, event.sequence, hash, head.hash, nextHash, JSON.stringify(admitted.value)])).rows[0];
    await sql.query("UPDATE arbi_audit_heads SET ordinal=$4,hash=$5 WHERE environment=$1 AND namespace_id=$2 AND site_id=$3", [...key, ordinal, nextHash]);
    // Bounded diagnostic output: first 32 missing ranges and source-clock regression.
    const gaps = (await sql.query<{ from: string; to: string }>(`WITH ordered AS (
      SELECT sequence,lag(sequence,1,0::numeric) OVER(ORDER BY sequence) AS prior FROM arbi_audit_events WHERE stream=$1
      ) SELECT (prior+1)::text AS "from",(sequence-1)::text AS "to" FROM ordered WHERE sequence>prior+1 ORDER BY sequence LIMIT 33`, [stream])).rows;
    const adjacent = (await sql.query<{ sequence: string; record: AuditEvent }>(`(
      SELECT sequence,record FROM arbi_audit_events WHERE stream=$1 AND sequence<$2::numeric ORDER BY sequence DESC LIMIT 1
      ) UNION ALL (
      SELECT sequence,record FROM arbi_audit_events WHERE stream=$1 AND sequence>$2::numeric ORDER BY sequence ASC LIMIT 1
      )`, [stream, event.sequence])).rows;
    const clockRegression = adjacent.some((r) => BigInt(r.sequence) < BigInt(event.sequence) ?
      r.record.sourceTime.monotonicMs > event.sourceTime.monotonicMs : r.record.sourceTime.monotonicMs < event.sourceTime.monotonicMs);
    const priorBoot = (await sql.query<{ found: boolean }>(`SELECT EXISTS(SELECT 1 FROM arbi_audit_events
      WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND record->'source'->>'module'=$4
      AND record->'source'->'identity'->>'deviceId'=$5 AND record->'source'->'identity'->>'bootId'<>$6) AS found`,
      [...key, event.source.module, event.source.identity.deviceId, event.source.identity.bootId])).rows[0].found;
    const utc = event.sourceTime.utc, uncertainty = event.sourceTime.uncertaintyMs;
    const clockDisjoint = utc !== null && uncertainty !== null &&
      Math.abs(Date.parse(utc) - Date.parse(admitted.value.ingestTime!.utc)) > uncertainty + this.uncertaintyMs;
    await sql.query("INSERT INTO arbi_audit_evidence(event_id,detail) VALUES($1,$2::jsonb)", [event.eventId, JSON.stringify({
      gaps: gaps.slice(0,32), gapsTruncated: gaps.length > 32, clockRegression, clockDisjoint, unsynchronized: utc === null, otherBootObserved: priorBoot,
    })]);
    return receipt(row);
  }
  /** Intent, allow decision and outbox are admitted atomically; no external delivery runs here. */
  async admit(intentInput: unknown, authorizationInput: unknown, intentBinding: TrustedBinding, authorizationBinding: TrustedBinding): Promise<DurableReceipt> {
    let domainError: AuditError | undefined;
    try { const staged = await this.db.transaction(async (sql) => {
      try { return await this.stageAdmission(sql,intentInput,authorizationInput,intentBinding,authorizationBinding); }
      catch (e) { if (e instanceof AuditError) domainError = e; throw e; }
    }); return { ...staged,durable: true }; } catch { throw domainError ?? new AuditError("UNAVAILABLE"); }
  }
  /** Reusable transaction-local hook for domain intent + authorization + the existing audit outbox. */
  async stageAdmission(sql: SqlSession, intentInput: unknown, authorizationInput: unknown,
    intentBinding: TrustedBinding, authorizationBinding: TrustedBinding): Promise<StagedReceipt> {
    const intent = checked(intentInput), authorization = checked(authorizationInput);
    if (intent.evidence !== "intent" || intent.source.module !== "cloud" || authorization.source.module !== "cloud" ||
      authorization.evidence !== "authorization" || authorization.outcome !== "allow" || !correlateAuditEvent(intent, authorization).ok) throw new AuditError("DENIED");
    const result = await this.stage(sql,intent,intentBinding);
    await this.stage(sql,authorization,authorizationBinding);
    const prior = (await sql.query<{ authorization_id: string }>("SELECT authorization_id FROM arbi_audit_outbox WHERE id=$1",[intent.eventId])).rows[0];
    if (prior && prior.authorization_id !== authorization.eventId) throw new AuditError("CONFLICT");
    await sql.query("INSERT INTO arbi_audit_outbox(id,authorization_id) VALUES($1,$2) ON CONFLICT DO NOTHING",[intent.eventId,authorization.eventId]);
    return result;
  }
  /** At-least-once notification delivery. Receiver must deduplicate id; this grants no actuation. */
  async deliver(realm: Realm, siteId: string, send: (id: string, intent: AuditEvent) => Promise<void>, limit = 32): Promise<number> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 64) throw new AuditError("INVALID_REQUEST");
    const rows = await this.db.transaction(async (sql) => (await sql.query<AuditRow>(`SELECT e.* FROM arbi_audit_outbox o
      JOIN arbi_audit_events e ON e.id=o.id LEFT JOIN arbi_audit_deliveries d ON d.id=o.id
      WHERE e.environment=$1 AND e.namespace_id=$2 AND e.site_id=$3 AND d.id IS NULL ORDER BY e.ordinal LIMIT $4`, [...scope(realm, siteId), limit])).rows);
    for (const row of rows) {
      await send(row.id, structuredClone(row.record));
      await this.db.transaction(async (sql) => { await sql.query("INSERT INTO arbi_audit_deliveries(id) VALUES($1) ON CONFLICT DO NOTHING", [row.id]); });
    }
    return rows.length;
  }
  async verify(realm: Realm, siteId: string): Promise<{ ordinal: number; hash: string }> {
    return this.db.transaction(async (sql) => {
      const key = scope(realm,siteId);
      const head = (await sql.query<{ ordinal: string; hash: string }>("SELECT * FROM arbi_audit_heads WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 FOR UPDATE",key)).rows[0];
      const rows = (await sql.query<AuditRow>("SELECT * FROM arbi_audit_events WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 ORDER BY ordinal",key)).rows;
      let ordinal = 0, hash = GENESIS;
      for (const row of rows) {
        if (Number(row.ordinal) !== ordinal + 1 || row.id !== row.record.eventId || row.content_hash !== contentHash(row.record) ||
          row.previous_hash !== hash || row.hash !== chainHash(hash,ordinal+1,digest(row.record))) throw new AuditError("TAMPER");
        ordinal++; hash = row.hash;
      }
      if (head && (Number(head.ordinal) !== ordinal || head.hash !== hash)) throw new AuditError("TAMPER");
      return { ordinal, hash };
    });
  }
}
