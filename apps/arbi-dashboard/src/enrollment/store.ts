import { randomUUID } from "node:crypto";
import { isId, isRealm, sameRealm } from "@arbi/gredice";
import type { AuthorizationObservation } from "@arbi/gredice";
import type { Realm } from "@arbi/protocol";
import type { Pool } from "pg";
import { EnrollmentError, VERSION } from "./contracts";
import type { Registry, RegistryStore, Transaction } from "./contracts";

export interface SqlSession {
  query<T extends Record<string, unknown>>(sql: string, parameters?: unknown[]): Promise<{ rows: T[] }>;
}
export interface SqlDatabase {
  transaction<T>(work: (sql: SqlSession) => Promise<T>): Promise<T>;
}
/** Same checked-out connection owns BEGIN, row lock, audit, state update and COMMIT. */
export function postgresDatabase(pool: Pool): SqlDatabase {
  return { async transaction(work) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL statement_timeout = '5s'");
      await client.query("SET LOCAL lock_timeout = '2s'");
      await client.query("SET LOCAL idle_in_transaction_session_timeout = '5s'");
      const result = await work({ query: async (sql, parameters) => client.query(sql, parameters) });
      await client.query("COMMIT");
      return result;
    } catch {
      try { await client.query("ROLLBACK"); } catch { /* connection is discarded below */ }
      throw new EnrollmentError("UNAVAILABLE");
    } finally { client.release(); }
  } };
}
function scope(realm: Realm, siteId: string) {
  if (!isRealm(realm) || realm.environment === "production" || !isId(siteId)) throw new EnrollmentError("DENIED");
  return [realm.environment, realm.namespaceId, siteId];
}
export class PostgresRegistryStore implements RegistryStore {
  constructor(readonly db: SqlDatabase) {}
  async provision(state: Registry): Promise<void> {
    const key = scope(state.realm, state.siteId);
    await this.db.transaction(async (sql) => {
      await sql.query("INSERT INTO arbi_device_registry (environment, namespace_id, site_id, state) VALUES ($1,$2,$3,$4::jsonb)",
        [...key, JSON.stringify(state)]);
    });
  }
  async transact<T>(realm: Realm, siteId: string, work: (tx: Transaction) => T): Promise<T> {
    const key = scope(realm, siteId);
    let domainError: EnrollmentError | undefined;
    try {
      return await this.db.transaction(async (sql) => {
        const result = await sql.query<{ state: Registry }>(
          "SELECT state FROM arbi_device_registry WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 FOR UPDATE", key);
        const state = result.rows[0]?.state;
        if (!state || state.version !== VERSION || !sameRealm(state.realm, realm) || state.siteId !== siteId) {
          throw new EnrollmentError("DENIED");
        }
        const tx: Transaction = { state: structuredClone(state), observations: [] };
        let response: T;
        try { response = work(tx); }
        catch (error) { if (error instanceof EnrollmentError) domainError = error; throw error; }
        if (Buffer.byteLength(JSON.stringify(tx.state)) > 2_097_152) throw new EnrollmentError("CAPACITY");
        for (const record of tx.observations) {
          await sql.query("INSERT INTO arbi_device_audit (id, environment, namespace_id, site_id, record) VALUES ($1,$2,$3,$4,$5::jsonb)",
            [record.id, ...key, JSON.stringify(record)]);
        }
        await sql.query("UPDATE arbi_device_registry SET state=$4::jsonb WHERE environment=$1 AND namespace_id=$2 AND site_id=$3",
          [...key, JSON.stringify(tx.state)]);
        return structuredClone(response);
      });
    } catch { throw domainError ?? new EnrollmentError("UNAVAILABLE"); }
  }
  /** Separate durable authorization observation; it does not assert a completed enrollment or device effect. */
  async authorization(record: AuthorizationObservation, signal: AbortSignal): Promise<boolean> {
    if (record.siteId === null || signal.aborted) return false;
    const key = scope(record.realm, record.siteId);
    await this.db.transaction(async (sql) => {
      if (signal.aborted) throw new EnrollmentError("UNAVAILABLE");
      await sql.query("INSERT INTO arbi_device_audit (id, environment, namespace_id, site_id, record) VALUES ($1,$2,$3,$4,$5::jsonb)",
        [randomUUID(), ...key, JSON.stringify({ kind: "authorization", ...record })]);
    });
    return !signal.aborted;
  }
}
