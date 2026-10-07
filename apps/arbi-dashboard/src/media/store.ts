import { randomUUID } from "node:crypto";
import { isId, sameRealm } from "@arbi/gredice";
import type { AuthorizationObservation, AuthorizedContext, ResourceScope } from "@arbi/gredice";
import { AUDIT_VERSION, MAX_COUNTER, parseAuditEvent } from "@arbi/protocol";
import type { AuditEvent, AuditSource, Realm } from "@arbi/protocol";
import type { SqlDatabase, SqlSession } from "../enrollment/store";
import { MEDIA_VERSION, MediaError, requireMedia, validSite } from "./contracts";
import type { AccessGrant, MediaImage, MediaSite, MediaUsage } from "./contracts";

export interface MediaDetail {
  operation: string; imageId?: string; uploadId?: string; variant?: "full" | "thumbnail"; grantId?: string;
  expiresAtMs?: number; membershipRevision?: string; result?: string; usage?: MediaUsage;
}
export class MediaTransaction {
  constructor(readonly sql: SqlSession, readonly site: MediaSite,
    readonly append: (sql: SqlSession, site: MediaSite, context: Pick<AuthorizedContext, "actor" | "sessionId">,
      detail: MediaDetail, grant?: AccessGrant, failed?: boolean) => Promise<void>) {}
  key() { return [this.site.realm.environment, this.site.realm.namespaceId, this.site.siteId]; }
  async image(id: string): Promise<MediaImage> {
    requireMedia(isId(id));
    const { rows } = await this.sql.query<{ record: MediaImage }>(
      "SELECT record FROM arbi_media_images WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND id::text=$4", [...this.key(), id]);
    requireMedia(rows[0]?.record.version === MEDIA_VERSION, "DENIED"); return structuredClone(rows[0].record);
  }
  async replay(context: AuthorizedContext, requestId: string): Promise<MediaImage | null> {
    const { rows } = await this.sql.query<{ record: MediaImage }>(
      "SELECT record FROM arbi_media_images WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND actor_kind=$4 AND actor_id=$5 AND request_id=$6",
      [...this.key(), context.actor.kind, context.actor.id, requestId]);
    return rows[0]?.record ?? null;
  }
  async insert(image: MediaImage): Promise<void> {
    const upload = image.variants.full;
    await this.sql.query("INSERT INTO arbi_media_images (id,environment,namespace_id,site_id,actor_kind,actor_id,request_id,record) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)",
      [image.id, ...this.key(), upload.creator.kind, upload.creator.id, upload.request.requestId, JSON.stringify(image)]);
  }
  async save(image: MediaImage): Promise<void> {
    requireMedia(JSON.stringify(image).length <= 16_384, "CAPACITY");
    await this.sql.query("UPDATE arbi_media_images SET record=$5::jsonb WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND id=$4",
      [...this.key(), image.id, JSON.stringify(image)]);
  }
  async grant(grant: AccessGrant): Promise<void> {
    await this.sql.query("INSERT INTO arbi_media_grants (id,image_id,record) VALUES ($1,$2,$3::jsonb)",
      [grant.id, grant.imageId, JSON.stringify(grant)]);
  }
  async revoke(imageId: string, variant?: string): Promise<void> {
    await this.sql.query("UPDATE arbi_media_grants SET record=jsonb_set(record,'{revoked}','true'::jsonb) WHERE image_id=$1 AND ($2::text IS NULL OR record->>'variant'=$2)",
      [imageId, variant ?? null]);
  }
  record(context: Pick<AuthorizedContext, "actor" | "sessionId">, detail: MediaDetail, grant?: AccessGrant, failed = false) {
    return this.append(this.sql, this.site, context, detail, grant, failed);
  }
}

/** Per-site row lock serializes independent cloud processes; object I/O always occurs outside the transaction. */
export class PostgresMediaStore {
  readonly #source: AuditSource = { module: "cloud", identity: { deviceId: "media-service", bootId: randomUUID(), sessionId: randomUUID() } };
  readonly #startedAt = performance.now();
  readonly #sequences = new Map<string, bigint>();
  constructor(readonly db: SqlDatabase) {}
  async provision(site: MediaSite): Promise<void> {
    requireMedia(validSite(site), "DENIED");
    await this.#safe(() => this.db.transaction(async (sql) => {
      await sql.query("INSERT INTO arbi_media_sites (environment,namespace_id,site_id,site) VALUES ($1,$2,$3,$4::jsonb)",
        [site.realm.environment, site.realm.namespaceId, site.siteId, JSON.stringify(site)]);
    }));
  }
  async #safe<T>(work: () => Promise<T>): Promise<T> {
    // postgresDatabase intentionally redacts underlying failures, including domain exceptions.
    try { return await work(); } catch (error) { throw error instanceof MediaError ? error : new MediaError("UNAVAILABLE"); }
  }
  async transact<T>(realm: Realm, siteId: string, work: (tx: MediaTransaction) => Promise<T>): Promise<T> {
    let domain: MediaError | undefined;
    try {
      return await this.#safe(() => this.db.transaction(async (sql) => {
        try {
          const { rows } = await sql.query<{ site: MediaSite }>(
            "SELECT site FROM arbi_media_sites WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 FOR UPDATE", [realm.environment, realm.namespaceId, siteId]);
          const site = rows[0]?.site;
          requireMedia(site && validSite(site) && sameRealm(site.realm, realm) && site.siteId === siteId, "DENIED");
          return await work(new MediaTransaction(sql, site, (connection, scope, context, detail, grant, failed) =>
            this.#append(connection, scope, context, detail, grant, failed)));
        } catch (error) { if (error instanceof MediaError) domain = error; throw error; }
      }));
    } catch (error) { throw domain ?? error; }
  }
  async read(realm: Realm, siteId: string, id: string) { return this.transact(realm, siteId, (tx) => tx.image(id)); }
  async resolve(realm: Realm, siteId: string, id?: string): Promise<ResourceScope | null> {
    try {
      return await this.transact(realm, siteId, async (tx) => {
        if (id) await tx.image(id);
        return { ...tx.site, resource: { kind: id ? "still" : "site", id: id ?? siteId } };
      });
    } catch (error) { if (error instanceof MediaError && error.code === "DENIED") return null; throw error; }
  }
  async #insert(sql: SqlSession, site: MediaSite, record: AuditEvent, detail: MediaDetail) {
    requireMedia(parseAuditEvent(JSON.stringify(record)).ok, "UNAVAILABLE");
    await sql.query("INSERT INTO arbi_media_audit (id,environment,namespace_id,site_id,record,detail) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb)",
      [record.eventId, site.realm.environment, site.realm.namespaceId, site.siteId, JSON.stringify(record), JSON.stringify(detail)]);
  }
  #event(site: MediaSite, context: Pick<AuthorizedContext, "actor" | "sessionId">): AuditEvent {
    const key = JSON.stringify(site); const last = this.#sequences.get(key) ?? 0n;
    requireMedia(last < MAX_COUNTER, "CAPACITY"); this.#sequences.set(key, last + 1n);
    const id = randomUUID();
    return { auditVersion: AUDIT_VERSION, eventId: id, realm: site.realm, executionMode: site.executionMode,
      siteId: site.siteId, actor: context.actor, source: this.#source, sequence: String(last + 1n),
      sourceTime: { utc: null, uncertaintyMs: null, monotonicMs: Math.floor(performance.now() - this.#startedAt) }, ingestTime: null,
      resource: { kind: "site", id: site.siteId, deviceId: null }, action: "authorization.check", evidence: "intent",
      outcome: "requested", reason: "requested", effect: "none", links: { correlationId: id, intentEventId: id,
        causationEventId: null, jobId: null, sessionId: context.sessionId, commandId: null, requestSource: null, target: null },
      record: null, metadata: {}, change: null };
  }
  async #append(sql: SqlSession, site: MediaSite, context: Pick<AuthorizedContext, "actor" | "sessionId">,
    detail: MediaDetail, grant?: AccessGrant, failed = false) {
    const intent = this.#event(site, context);
    intent.metadata.permission = grant ? "view" : detail.operation.startsWith("upload") ? "capture" : "configure";
    if (grant) {
      intent.action = grant.operation === "view" ? "still.view" : "media.download";
      intent.resource = { kind: "still", id: grant.imageId, deviceId: null }; intent.metadata.grantId = grant.id;
    }
    await this.#insert(sql, site, intent, { ...detail, result: "requested" });
    const result = this.#event(site, context);
    result.action = intent.action; result.resource = intent.resource; result.metadata = intent.metadata;
    result.links = { ...intent.links, causationEventId: intent.eventId };
    result.evidence = grant ? "access-grant" : "service-outcome";
    result.outcome = failed ? "fail" : grant ? "allow" : "succeeded";
    result.reason = failed ? "storage-failed" : grant ? "authorized" : "completed";
    await this.#insert(sql, site, result, detail);
    if (grant) {
      // Separate result for preparing the grant, never a bytes-delivered/view observation.
      await this.#append(sql, site, context, { ...detail, operation: "access.issue-result", result: "prepared-response-delivery-unknown" });
    }
  }
  async authorization(observation: AuthorizationObservation, signal: AbortSignal): Promise<boolean> {
    if (!observation.siteId || signal.aborted) return false;
    await this.transact(observation.realm, observation.siteId, async (tx) => {
      requireMedia(!signal.aborted, "UNAVAILABLE");
      const record = this.#event(tx.site, { actor: observation.actor ?? { kind: "service", id: "unverified-attempt" }, sessionId: observation.sessionId ?? "unverified" });
      record.evidence = "authorization"; record.outcome = observation.decision === "authorized" ? "allow" : "deny";
      record.reason = observation.decision === "authorized" ? "authorized" : "not-authorized";
      record.links = { ...record.links, correlationId: observation.correlationId, intentEventId: null, sessionId: observation.sessionId };
      record.metadata.permission = observation.capability === "capture.request" ? "capture" : observation.capability === "configuration.write" ? "configure" : "view";
      await this.#insert(tx.sql, tx.site, record, { operation: "authorization", result: observation.reason ?? "authorized",
        ...(observation.membershipRevision ? { membershipRevision: observation.membershipRevision } : {}) });
    });
    return !signal.aborted;
  }
}
