import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { correlateAuditEvent, parseAuditEvent } from "@arbi/protocol";
import type { AuditEvent } from "@arbi/protocol";
import type { SqlDatabase } from "../enrollment/store";
import { MEDIA_VERSION, UPLOAD_TTL_MS, unavailableMetadata } from "./contracts";
import { configureMedia, mediaRoute } from "./runtime";
import { POST } from "../app/api/sites/[siteId]/media/[action]/route";
import { setup, realm, site } from "./test-support";

test("unconfigured routes fail closed; explicit composition handles bounded JSON and rejects authority claims", async (t) => {
  assert.equal((await mediaRoute(new Request("https://fixture.invalid/api"), { siteId: "site-a", action: "upload" })).status, 503);
  const h = await setup(t); configureMedia(h.compose());
  const response = await POST(h.request("upload", h.upload("route")), { params: Promise.resolve({ siteId: "site-a", action: "upload" }) });
  if (response.status !== 200) {
    const failure = await response.clone().json() as { error?: unknown };
    assert.fail(`expected upload admission 200; received ${response.status} (${typeof failure.error === "string" ? failure.error : "redacted"})`);
  }
  assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "private, no-store");
  for (const extra of ["siteId", "accountId", "jobId", "calibration", "metadata", "actor", "path", "url", "engineeringMode"]) {
    assert.equal((await h.call("upload", { ...h.upload(`bad-${extra}`), [extra]: "synthetic-private-marker" })).status, 400);
  }
  const huge = await h.call("upload", { ...h.upload("huge"), padding: "x".repeat(20_000) });
  assert.equal(huge.status, 400); assert.ok(!JSON.stringify(huge.value).includes("padding"));
  assert.equal((await h.call("upload", { ...h.upload("too-large"), size: 20_000_000 })).status, 400);
  assert.equal((await h.call("upload", { ...h.upload("pixels"), width: 10000000 })).status, 400);
  assert.equal((await h.call("upload", { ...h.upload("active-format"), contentType: "image/svg+xml" })).status, 400);
  assert.equal((await h.call("upload", { ...h.upload("catalog"), captureId: "unknown" })).status, 403);
  assert.equal((await h.call("upload", h.upload("viewer"), undefined, "viewer")).status, 403);
  assert.equal((await h.call("upload", h.upload("cross-site"), undefined, "operator", "site-b")).status, 403);
});

test("interruption, retry after lost PUT response, concurrent/replayed completion yield one logical record", async (t) => {
  const h = await setup(t); const input = h.upload("same-request");
  const [a, b] = await Promise.all([h.call("upload", input), h.call("upload", input)]);
  assert.equal(a.status, 200); assert.equal(b.status, 200); assert.equal(a.value.imageId, b.value.imageId);
  assert.equal(a.value.uploadId, b.value.uploadId);
  assert.equal((await h.complete(a.value)).value.error, "MISSING_OBJECT");
  assert.equal((await h.put(a.value.putUrl)).status, 200);
  assert.equal((await h.put(b.value.putUrl)).status, 409); // Retry cannot replace already stored bytes.
  const results = await Promise.all([h.complete(a.value), h.complete(b.value)]);
  assert.deepEqual(results.map((r) => r.status), [200, 200]);
  assert.deepEqual(results[0].value, results[1].value);
  assert.equal((await h.complete(a.value)).status, 200);
  const replay = await h.call("upload", input); assert.equal(replay.value.putUrl, null);
  assert.equal((await h.call("upload", { ...input, sha256: "a".repeat(64) })).status, 409);
  assert.equal((await h.db.query("SELECT * FROM arbi_media_images")).rows.length, 1);
  const completed = await h.db.query<{ detail: any }>("SELECT detail FROM arbi_media_audit WHERE detail->>'operation'='upload.complete' AND detail->>'result'='verified-object'");
  assert.equal(completed.rows.length, 1);
  assert.deepEqual(completed.rows[0].detail.usage, { category: "still", layer: "application-payload", objectBytes: h.bytes.length,
    transferBytes: null, wanBytes: null, providerBytes: null, retryBytes: null, evidence: "verified-object-length" });
  const image = await h.image(a.value.imageId); assert.equal(image.version, MEDIA_VERSION);
  assert.deepEqual(image.metadata, unavailableMetadata());
  assert.ok(!JSON.stringify(results[0].value).includes(image.variants.full.path));
});

test("scoped direct credentials enforce operation/path/size/type/deadline; no store secret reaches API/audit", async (t) => {
  const h = await setup(t); const prepared = await h.prepare("constraints");
  const original = new URL(prepared.putUrl);
  const tampered = new URL(original); tampered.searchParams.set("pathname", "arbi/test/other-object");
  assert.equal((await h.put(tampered.toString())).status, 403);
  assert.equal((await h.put(original.toString(), h.bytes, "text/html")).status, 413);
  assert.equal((await h.put(original.toString(), Buffer.alloc(h.bytes.length + 1))).status, 413);
  assert.equal((await fetch(original, { method: "GET" })).status, 403);
  assert.ok(h.blob.issued.every((issued) => issued.pathname !== "*" && issued.operations?.length === 1));
  const detail = await h.db.query("SELECT detail,record FROM arbi_media_audit");
  const audit = JSON.stringify(detail.rows);
  assert.ok(!/putUrl|presignedUrl|delegationToken|clientSigningToken|vercel_blob_rw|vercel-blob-signature/.test(audit));
  h.advance(prepared.expiresAtMs - h.now());
  assert.equal((await h.put(prepared.putUrl)).status, 403);
  // A fresh request can mint another short URL to the same immutable path, until the absolute upload deadline.
  const fresh = await h.prepare("constraints"); assert.equal(fresh.imageId, prepared.imageId);
  assert.equal((await h.put(fresh.putUrl)).status, 200);
  assert.equal((await h.complete(fresh)).status, 200);
});

test("trusted capture metadata is bound to persisted site, inherited by thumbnails and rejects wrong site/calibration claims", async (t) => {
  const h = await setup(t);
  const metadata = { ...unavailableMetadata(), provenance: "trusted-capture-record" as const,
    capture: { status: "available" as const, id: "capture-1" }, job: { status: "available" as const, id: "job-1" },
    bed: { status: "available" as const, id: "bed-1" }, calibration: { status: "available" as const, id: "cal-1" },
    capturedAt: { status: "available" as const, utc: "2026-10-07T12:00:00.000Z", uncertaintyMs: null },
    framing: { status: "available" as const, frameId: "camera-1", revision: "frame-1" } };
  const trusted = h.compose(h.sql, async ({ captureId }) => captureId === "capture-1" ? { site, metadata } : null);
  const value = { ...h.upload("linked"), captureId: "capture-1" };
  const prepared = await h.call("upload", value, undefined, undefined, "site-a", trusted); assert.equal(prepared.status, 200);
  await h.put(prepared.value.putUrl);
  const completed = await h.call("complete", { imageId: prepared.value.imageId, variant: "full", uploadId: prepared.value.uploadId },
    undefined, undefined, "site-a", trusted);
  assert.equal(completed.status, 200); assert.deepEqual(completed.value.metadata, metadata);
  const thumb = await h.prepare("thumb-linked", "thumbnail", prepared.value.imageId);
  await h.put(thumb.putUrl); assert.equal((await h.complete(thumb, "thumbnail")).status, 200);
  const persisted = await h.image(prepared.value.imageId);
  assert.equal(persisted.variants.thumbnail?.derived?.sourceSha256, h.upload("unused").sha256);
  assert.equal(persisted.variants.thumbnail?.derived?.provenance, "uploader-declared-thumbnail");
  const wrong = h.compose(h.sql, async () => ({ site: { ...site, siteId: "site-b" }, metadata }));
  assert.equal((await h.call("upload", value, undefined, undefined, "site-a", wrong)).status, 403);
  const hostile = h.compose(h.sql, async () => ({ site, metadata: { ...metadata, calibration: { status: "available", id: "../secret" } } }));
  assert.equal((await h.call("upload", value, undefined, undefined, "site-a", hostile)).status, 403);
});

test("missing/corrupt/unexpected objects cannot complete and mutated ready objects cannot obtain access", async (t) => {
  const h = await setup(t);
  for (const [id, patch] of [
    ["hash", { sha256: "b".repeat(64) }], ["dimensions", { width: 33 }],
    ["truncated", { size: 12, sha256: createHash("sha256").update(h.bytes.subarray(0, 12)).digest("hex") }],
  ] as const) {
    const input = { ...h.upload(id), ...patch };
    const prepared = await h.call("upload", input); assert.equal(prepared.status, 200);
    await h.put(prepared.value.putUrl, id === "truncated" ? h.bytes.subarray(0, 12) : h.bytes);
    assert.equal((await h.complete(prepared.value)).value.error, "INVALID_OBJECT");
    assert.equal((await h.image(prepared.value.imageId)).variants.full.state, "pending");
  }
  const ready = await h.ready("unexpected"); const image = await h.image(ready.imageId);
  const object = h.blob.objects.get(image.variants.full.path)!;
  object.contentType = "image/jpeg";
  assert.equal((await h.call("access", { variant: "full", operation: "view" }, ready.imageId)).value.error, "INVALID_OBJECT");
  h.blob.objects.delete(image.variants.full.path);
  assert.equal((await h.call("access", { variant: "full", operation: "view" }, ready.imageId)).status, 404);
  assert.equal((await h.db.query("SELECT * FROM arbi_media_grants")).rows.length, 0);
});

test("current membership, session, site and owner are rechecked; service can upload but cannot view/delete", async (t) => {
  const h = await setup(t); const ready = await h.ready("acl");
  assert.equal((await h.call("access", { variant: "full", operation: "view" }, ready.imageId, "viewer", "site-b")).status, 403);
  assert.equal((await h.call("metadata", null, ready.imageId)).status, 200);
  assert.equal((await h.call("complete", { imageId: ready.imageId, uploadId: ready.uploadId, variant: "full" }, undefined, "uploader")).status, 403);
  assert.equal((await h.call("access", { variant: "full", operation: "view" }, ready.imageId, "uploader")).status, 403);
  assert.equal((await h.call("delete", { imageId: ready.imageId, variant: "all" }, undefined, "operator")).status, 403);
  assert.equal((await h.call("upload", h.upload("service"), undefined, "uploader")).status, 200);
  h.provider.putPrincipal({ actor: { kind: "human", id: "viewer" }, accountId: "account-a", member: true,
    sites: { "site-a": { roles: [], serviceScopes: [], active: true, revision: "membership-2" } } });
  assert.equal((await h.call("access", { variant: "full", operation: "view" }, ready.imageId)).status, 403);
  h.provider.revoke(h.tokens.operator.sessionId);
  assert.equal((await h.call("upload", h.upload("revoked"))).status, 401);
  h.advance(900_000);
  assert.equal((await h.call("metadata", null, ready.imageId, "engineer")).status, 401);
});

test("attributable view/download grants expire; revocation prevents new authority but held bearer survives until expiry", async (t) => {
  const h = await setup(t); const ready = await h.ready("grant");
  const full = await h.call("access", { variant: "full", operation: "download" }, ready.imageId);
  assert.equal(full.status, 200); assert.ok(full.value.expiresAtMs <= h.now() + 30_000);
  const result = await fetch(full.value.url); assert.equal(result.status, 200); await result.arrayBuffer();
  const revoked = await h.call("revoke", { imageId: ready.imageId, grantId: full.value.grantId }); assert.equal(revoked.status, 200);
  h.provider.revoke(h.tokens.viewer.sessionId);
  assert.equal((await h.call("access", { variant: "full", operation: "view" }, ready.imageId)).status, 401);
  // Documented bounded guarantee: direct Blob has no current-directory lookup or individual URL recall.
  assert.equal((await fetch(full.value.url)).status, 200);
  h.advance(full.value.expiresAtMs - h.now()); assert.equal((await fetch(full.value.url)).status, 403);
  const records = (await h.db.query<{ record: AuditEvent; detail: any }>("SELECT record,detail FROM arbi_media_audit")).rows;
  const grants = records.filter(({ record }) => record.evidence === "access-grant"); assert.equal(grants.length, 1);
  assert.equal(grants[0].record.action, "media.download"); assert.deepEqual(grants[0].record.actor, { kind: "human", id: "viewer" });
  assert.equal(grants[0].record.links.sessionId, h.tokens.viewer.sessionId);
  assert.equal(grants[0].detail.grantId, full.value.grantId); assert.equal(grants[0].detail.variant, "full");
  assert.ok(records.every(({ record }) => record.effect === "none" && record.sourceTime.utc === null && parseAuditEvent(JSON.stringify(record)).ok));
  for (const { record } of records.filter(({ record }) => ["service-outcome", "access-grant"].includes(record.evidence))) {
    const intent = records.find(({ record: candidate }) => candidate.eventId === record.links.intentEventId);
    assert.ok(correlateAuditEvent(intent?.record, record).ok);
  }
  assert.ok(!records.some(({ record }) => ["access-observation", "browser-observation", "media-observation"].includes(record.evidence)));
});

test("membership revocation during provider signing withholds a prepared URL", async (t) => {
  const h = await setup(t); const ready = await h.ready("revoke-during-sign");
  h.blob.controls.beforeIssue = () => { h.provider.revoke(h.tokens.viewer.sessionId); };
  const result = await h.call("access", { variant: "full", operation: "view" }, ready.imageId);
  assert.equal(result.status, 401); assert.equal(Object.hasOwn(result.value, "url"), false);
});

test("thumbnail and full lifecycles, incomplete cleanup, deletion retries and late upload tombstones", async (t) => {
  const h = await setup(t); const ready = await h.ready("delete-full");
  const thumb = await h.prepare("delete-thumb", "thumbnail", ready.imageId);
  await h.put(thumb.putUrl); await h.complete(thumb, "thumbnail");
  const access = await h.call("access", { variant: "thumbnail", operation: "view" }, ready.imageId); assert.equal(access.status, 200);
  h.blob.controls.failDelete = true;
  const failed = await h.call("delete", { imageId: ready.imageId, variant: "thumbnail" }); assert.equal(failed.status, 200);
  assert.equal(failed.value.variants.thumbnail.state, "deleting");
  assert.equal((await h.call("access", { variant: "thumbnail", operation: "view" }, ready.imageId)).status, 404);
  assert.equal((await h.call("access", { variant: "full", operation: "view" }, ready.imageId)).status, 200);
  h.blob.controls.failDelete = false;
  const incomplete = await h.prepare("interrupted"); await h.put(incomplete.putUrl);
  h.advance(UPLOAD_TTL_MS + 60_000);
  const cleaned = await h.call("cleanup", { afterId: null, limit: 32 }); assert.equal(cleaned.status, 200);
  assert.equal((await h.image(incomplete.imageId)).variants.full.state, "deleted");
  assert.equal((await h.image(ready.imageId)).variants.thumbnail?.state, "deleted");
  assert.equal((await h.image(ready.imageId)).variants.full.state, "ready");
  const deleted = await h.call("delete", { imageId: ready.imageId, variant: "full" });
  assert.equal(deleted.value.variants.full.state, "deleted"); assert.equal(h.blob.objects.size, 0);
  assert.equal((await h.call("delete", { imageId: ready.imageId, variant: "all" })).status, 200);
  // Simulate a provider commit that arrived after the cleanup acknowledgement; next sweep retains the deletion decision.
  const old = await h.image(incomplete.imageId);
  h.blob.objects.set(old.variants.full.path, { bytes: h.bytes, contentType: "image/png", etag: "late" });
  await h.call("cleanup", { afterId: null, limit: 32 }); assert.equal(h.blob.objects.size, 0);
  assert.equal((await h.complete(incomplete)).status, 409);
});

test("cleanup is bounded/pageable, expiration fences completion and does not delete another site's objects", async (t) => {
  const h = await setup(t); const uploads = await Promise.all([h.prepare("page-1"), h.prepare("page-2"), h.prepare("page-3")]);
  for (const upload of uploads) await h.put(upload.putUrl);
  h.advance(UPLOAD_TTL_MS);
  assert.equal((await h.complete(uploads[0])).value.error, "EXPIRED");
  assert.equal((await h.call("cleanup", { afterId: null, limit: 33 })).status, 400);
  assert.equal((await h.call("cleanup", { afterId: null, limit: 2 }, undefined, "engineer", "site-b")).status, 403);
  const first = await h.call("cleanup", { afterId: null, limit: 2 }); assert.equal(first.value.scanned, 2); assert.ok(first.value.next);
  const second = await h.call("cleanup", { afterId: first.value.next, limit: 2 }); assert.equal(second.value.scanned, 1); assert.equal(second.value.next, null);
  assert.equal(h.blob.objects.size, 0);
});

test("audit and metadata transaction failures return no capability, leave retryable state and redact provider errors", async (t) => {
  const h = await setup(t); const ready = await h.ready("sql-ready"); const pending = await h.prepare("sql-pending"); await h.put(pending.putUrl);
  for (const statement of ["INSERT INTO arbi_media_audit", "UPDATE arbi_media_images"]) {
    const faulty: SqlDatabase = { transaction: (work) => h.sql.transaction((sql) => work({ query: async (query, parameters) => {
      if (query.startsWith(statement) && (statement.startsWith("UPDATE") ||
        JSON.parse(String(parameters?.[5])).operation === "upload.complete")) throw new Error("synthetic-private-error-marker");
      return sql.query(query, parameters);
    } })) };
    const failed = await h.call("complete", { imageId: pending.imageId, uploadId: pending.uploadId, variant: "full" },
      undefined, undefined, "site-a", h.compose(faulty));
    assert.equal(failed.status, 503); assert.ok(!JSON.stringify(failed.value).includes("synthetic-private-error-marker"));
    assert.equal((await h.image(pending.imageId)).variants.full.state, "pending");
  }
  const grantFault: SqlDatabase = { transaction: (work) => h.sql.transaction((sql) => work({ query: async (query, parameters) => {
    if (query.startsWith("INSERT INTO arbi_media_grants")) throw new Error("synthetic-private-error-marker"); return sql.query(query, parameters);
  } })) };
  const failed = await h.call("access", { variant: "full", operation: "view" }, ready.imageId, undefined, "site-a", h.compose(grantFault));
  assert.equal(failed.status, 503); assert.equal(Object.hasOwn(failed.value, "url"), false);
  assert.equal((await h.db.query("SELECT * FROM arbi_media_grants")).rows.length, 0);
  const grantAuditFault: SqlDatabase = { transaction: (work) => h.sql.transaction((sql) => work({ query: async (query, parameters) => {
    if (query.startsWith("INSERT INTO arbi_media_audit") && JSON.parse(String(parameters?.[5])).result === "issued-access-not-observed") {
      throw new Error("synthetic-private-error-marker");
    }
    return sql.query(query, parameters);
  } })) };
  const auditFailed = await h.call("access", { variant: "full", operation: "view" }, ready.imageId, undefined, "site-a", h.compose(grantAuditFault));
  assert.equal(auditFailed.status, 503); assert.equal(Object.hasOwn(auditFailed.value, "url"), false);
  assert.equal((await h.db.query("SELECT * FROM arbi_media_grants")).rows.length, 0);
  assert.equal((await h.db.query("SELECT * FROM arbi_media_audit WHERE record->>'evidence'='access-grant'")).rows.length, 0);
  h.blob.controls.failIssue = true;
  const providerFailure = await h.call("upload", h.upload("provider-failure"));
  assert.equal(providerFailure.status, 503); assert.equal(Object.hasOwn(providerFailure.value, "putUrl"), false);
  h.blob.controls.failIssue = false; assert.equal((await h.call("upload", h.upload("provider-failure"))).status, 200);
  assert.equal((await h.complete(pending)).status, 200);
  assert.equal((await h.store.read({ ...realm, namespaceId: "other-run" }, "site-a", ready.imageId).catch((e) => e)).code, "DENIED");
});

test("delete acknowledgement followed by audit failure preserves a retryable tombstone", async (t) => {
  const h = await setup(t); const ready = await h.ready("delete-audit-fault"); h.advance(UPLOAD_TTL_MS + 60_000);
  const faulty: SqlDatabase = { transaction: (work) => h.sql.transaction((sql) => work({ query: async (query, parameters) => {
    if (query.startsWith("INSERT INTO arbi_media_audit") && JSON.parse(String(parameters?.[5])).operation === "delete.complete") {
      throw new Error("synthetic-private-error-marker");
    }
    return sql.query(query, parameters);
  } })) };
  const failed = await h.call("delete", { imageId: ready.imageId, variant: "all" }, undefined, undefined, "site-a", h.compose(faulty));
  assert.equal(failed.status, 503); assert.equal(h.blob.objects.size, 0);
  assert.equal((await h.image(ready.imageId)).variants.full.state, "deleting");
  const retry = await h.call("cleanup", { afterId: null, limit: 32 }); assert.equal(retry.status, 200);
  assert.equal((await h.image(ready.imageId)).variants.full.state, "deleted");
});
