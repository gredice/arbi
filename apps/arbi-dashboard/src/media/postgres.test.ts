import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import test from "node:test";
import pg from "pg";
import sharp from "sharp";
import type { AuthorizedContext } from "@arbi/gredice";
import type { PrivateObjectStore, UploadInput } from "./contracts";
import { UPLOAD_TTL_MS } from "./contracts";
import { postgresDatabase } from "../enrollment/store";
import { MediaService } from "./service";
import { PostgresMediaStore } from "./store";
import { blobFixture, migration, realm, site } from "./test-support";

const socket = process.env.ARBI_ENROLLMENT_TEST_SOCKET;
test("host PostgreSQL preserves enrollment and serializes independent media processes, replay and atomic audit failures", { skip: !socket }, async (t) => {
  const root = realpathSync(socket!);
  assert.ok(root.startsWith(`${realpathSync(process.platform === "darwin" ? "/private/tmp" : tmpdir())}/arbi-enrollment-pg-`));
  const pool = new pg.Pool({ host: root, user: "arbi_test", port: 54321, database: "postgres", max: 6, connectionTimeoutMillis: 2_000 });
  t.after(() => pool.end());
  t.diagnostic(`Isolated host PostgreSQL ${(await pool.query("SHOW server_version")).rows[0].server_version}`);
  await pool.query(await readFile(new URL("../../migrations/0001-enrollment.sql", import.meta.url), "utf8"));
  const priorEnrollment = (await pool.query("SELECT * FROM arbi_device_registry ORDER BY site_id")).rows;
  const priorHistory = (await pool.query("SELECT * FROM arbi_device_audit ORDER BY id")).rows;
  await pool.query(migration); await pool.query(migration);
  assert.deepEqual((await pool.query("SELECT * FROM arbi_device_registry ORDER BY site_id")).rows, priorEnrollment);
  assert.deepEqual((await pool.query("SELECT * FROM arbi_device_audit ORDER BY id")).rows, priorHistory);
  const sql = postgresDatabase(pool); const storeA = new PostgresMediaStore(sql), storeB = new PostgresMediaStore(sql);
  await storeA.provision(site);
  let now = Date.now();
  const blob = await blobFixture(t, () => now);
  const serviceA = new MediaService(storeA, blob.adapter, undefined, () => now), serviceB = new MediaService(storeB, blob.adapter, undefined, () => now);
  const context: AuthorizedContext = { actor: { kind: "service", id: "edge-uploader" }, sessionId: "upload-session", realm,
    siteId: site.siteId, accountId: site.accountId, resource: { kind: "site", id: site.siteId }, capability: "capture.request",
    membershipRevision: "membership-1", expiresAtMs: now + 900_000 };
  const bytes = await sharp({ create: { width: 32, height: 24, channels: 3, background: "#808080" } }).png().toBuffer();
  const upload: UploadInput = { requestId: "pg-upload", variant: "full", imageId: null, captureId: null, size: bytes.length,
    contentType: "image/png", sha256: createHash("sha256").update(bytes).digest("hex"), width: 32, height: 24 };
  const prepared = await Promise.all([serviceA.upload(context, upload), serviceB.upload(context, upload)]);
  assert.equal(prepared[0].imageId, prepared[1].imageId);
  assert.equal((await fetch(prepared[0].putUrl!, { method: "PUT", headers: { "content-type": "image/png" }, body: bytes })).status, 200);
  const complete = { imageId: prepared[0].imageId, uploadId: prepared[0].uploadId, variant: "full" };
  const completed = await Promise.all([serviceA.complete(context, complete), serviceB.complete(context, complete)]);
  assert.deepEqual(completed[0], completed[1]);
  assert.equal((await pool.query("SELECT * FROM arbi_media_images")).rows.length, 1);
  assert.equal((await pool.query("SELECT * FROM arbi_media_audit WHERE detail->>'operation'='upload.complete' AND detail->>'result'='verified-object'")).rows.length, 1);
  const next = await serviceA.upload(context, { ...upload, requestId: "pg-rollback" });
  await fetch(next.putUrl!, { method: "PUT", headers: { "content-type": "image/png" }, body: bytes });
  await pool.query("ALTER TABLE arbi_media_audit ADD CONSTRAINT injected_failure CHECK (false) NOT VALID");
  const auditCount = (await pool.query("SELECT count(*) FROM arbi_media_audit")).rows[0].count;
  await assert.rejects(serviceB.complete(context, { ...complete, imageId: next.imageId, uploadId: next.uploadId }), { code: "UNAVAILABLE" });
  assert.equal((await storeA.read(realm, site.siteId, next.imageId)).variants.full.state, "pending");
  assert.equal((await pool.query("SELECT count(*) FROM arbi_media_audit")).rows[0].count, auditCount);
  await pool.query("ALTER TABLE arbi_media_audit DROP CONSTRAINT injected_failure");
  // Completion inspects outside the transaction. A concurrent deletion fences its subsequent metadata commit.
  let signalInspected!: () => void, resume!: () => void;
  const inspected = new Promise<void>((resolve) => { signalInspected = resolve; });
  const release = new Promise<void>((resolve) => { resume = resolve; });
  const delayed: PrivateObjectStore = {
    uploadGrant: (object, deadline) => blob.adapter.uploadGrant(object, deadline),
    accessGrant: (path, deadline) => blob.adapter.accessGrant(path, deadline),
    exists: (object, etag) => blob.adapter.exists(object, etag), delete: (path) => blob.adapter.delete(path),
    inspect: async (object) => { const result = await blob.adapter.inspect(object); signalInspected(); await release; return result; },
  };
  const race = new MediaService(storeA, delayed, undefined, () => now).complete(context, { ...complete, imageId: next.imageId, uploadId: next.uploadId });
  await inspected;
  const engineer = { ...context, actor: { kind: "human" as const, id: "engineer" }, capability: "configuration.write" as const };
  await serviceB.delete(engineer, { imageId: next.imageId, variant: "full" }); resume();
  await assert.rejects(race, { code: "CONFLICT" });
  assert.equal((await storeB.read(realm, site.siteId, next.imageId)).variants.full.state, "deleting");
  now += UPLOAD_TTL_MS + 60_000;
  await serviceB.cleanup(engineer, { afterId: null, limit: 32 });
  const restarted = new PostgresMediaStore(postgresDatabase(pool));
  assert.equal((await restarted.read(realm, site.siteId, next.imageId)).variants.full.state, "deleted");
  assert.equal((await restarted.read(realm, site.siteId, complete.imageId)).variants.full.state, "ready");
  await assert.rejects(restarted.read({ ...realm, namespaceId: "wrong" }, site.siteId, complete.imageId), { code: "DENIED" });
  assert.deepEqual((await pool.query("SELECT * FROM arbi_device_registry ORDER BY site_id")).rows, priorEnrollment);
  assert.deepEqual((await pool.query("SELECT * FROM arbi_device_audit ORDER BY id")).rows, priorHistory);
});
