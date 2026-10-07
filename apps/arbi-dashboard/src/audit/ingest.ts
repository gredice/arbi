import { isDeepStrictEqual } from "node:util";
import { isId, isObject, isRealm, sameRealm } from "@arbi/gredice";
import { AuditError, canonical, checked } from "@arbi/audit";
import type { DurableReceipt } from "@arbi/audit";
import type { Identity, Realm } from "@arbi/protocol";
import { VERSION } from "../enrollment/contracts";
import type { Device, Registry } from "../enrollment/contracts";
import { prove } from "../enrollment/crypto";
import type { SqlSession } from "../enrollment/store";
import { PostgresAuditStore, scope } from "./store";
import type { TrustedBinding } from "./store";

/** Bindings resolve by opaque event ID from protected command/local records, never submitted fields. */
export type EvidenceResolver = (sql: SqlSession, query: { eventId: string; uploader: Device; registry: Registry }) => Promise<TrustedBinding | null>;
export interface AuditUpload {
  version: "arbi.audit-upload/1.0"; realm: Realm; siteId: string; deviceId: string; credentialId: string;
  identity: Identity; issuedAtMs: number; expiresAtMs: number; event: unknown; signature: string;
}
export class DeviceAuditIngest {
  constructor(readonly store: PostgresAuditStore, readonly realm: Realm, readonly resolve: EvidenceResolver, readonly now = Date.now) {}
  async ingest(input: unknown, siteId: string): Promise<DurableReceipt> {
    if (!isObject(input) || canonical(Object.keys(input).sort()) !== canonical(["version","realm","siteId","deviceId","credentialId","identity","issuedAtMs","expiresAtMs","event","signature"].sort()) ||
      input.version !== "arbi.audit-upload/1.0" || !isRealm(input.realm) || !sameRealm(input.realm,this.realm) || input.siteId !== siteId || !isId(siteId) ||
      !isId(input.deviceId) || !isId(input.credentialId) || !Number.isSafeInteger(input.issuedAtMs) || !Number.isSafeInteger(input.expiresAtMs)) throw new AuditError("INVALID_REQUEST");
    const request = structuredClone(input) as unknown as AuditUpload;
    const event = checked(request.event);
    let domainError: AuditError | undefined;
    try { const staged = await this.store.db.transaction(async (sql) => {
      try {
        const now = this.now();
        if (request.issuedAtMs > now + 5_000 || request.expiresAtMs <= now || request.expiresAtMs <= request.issuedAtMs ||
          request.expiresAtMs - request.issuedAtMs > 60_000) throw new AuditError("DENIED");
        // Serializes current revocation/rotation with receipt COMMIT on the same inventory row.
        const registry = (await sql.query<{ state: Registry }>("SELECT state FROM arbi_device_registry WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 FOR UPDATE",scope(this.realm,siteId))).rows[0]?.state;
        const uploader = registry?.devices.find((d) => d.id === request.deviceId && d.status === "active" && d.role === "edge");
        const credential = uploader?.credentials.find((c) => c.id === request.credentialId && c.revokedAtMs === null && c.expiresAtMs > now);
        if (!registry || registry.version !== VERSION || !sameRealm(registry.realm,this.realm) || registry.siteId !== siteId ||
          !uploader || uploader.revokedAtMs !== null || !credential || credential.createdAtMs > now ||
          !uploader.current || !isDeepStrictEqual(request.identity,uploader.current)) throw new AuditError("DENIED");
        const { signature, ...unsigned } = request;
        try { prove(credential.publicKey,unsigned,signature); } catch { throw new AuditError("DENIED"); }
        const binding = await this.resolve(sql,{ eventId: event.eventId, uploader: structuredClone(uploader), registry: structuredClone(registry) });
        if (!binding || !sameRealm(binding.realm,this.realm) || binding.siteId !== siteId || binding.executionMode !== "simulation" ||
          !["edge","motion","pod"].includes(binding.authenticatedSource.module)) throw new AuditError("DENIED");
        const source = registry.devices.find((d) => d.id === binding.authenticatedSource.identity.deviceId && d.status === "active");
        const module = source?.role === "pico" ? "motion" : source?.role;
        if (!source || module !== binding.authenticatedSource.module || (source.id !== uploader.id && source.parentDeviceId !== uploader.id) ||
          ![source.current,...source.retiredIdentities].some((identity) => isDeepStrictEqual(identity,binding.authenticatedSource.identity))) throw new AuditError("DENIED");
        return await this.store.stage(sql,event,binding);
      } catch (error) { if (error instanceof AuditError) domainError = error; throw error; }
    }); return { ...staged,durable: true }; } catch { throw domainError ?? new AuditError("UNAVAILABLE"); }
  }
}
