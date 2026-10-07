import assert from "node:assert/strict";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { issueSignedToken, presignUrl } from "@vercel/blob";
import type { IssueSignedTokenOptions } from "@vercel/blob";
import { PGlite } from "@electric-sql/pglite";
import sharp from "sharp";
import { createIsolatedIdentityProvider } from "@arbi/gredice/testing";
import type { SqlDatabase } from "../enrollment/store";
import type { MediaImage, UploadInput } from "./contracts";
import { VercelPrivateBlob } from "./blob";
import { PostgresMediaStore } from "./store";
import { createMediaServer } from "./server";

export const realm = { environment: "test" as const, namespaceId: "media-fixture" };
export const site = { realm, siteId: "site-a", accountId: "account-a", executionMode: "simulation" as const };
export const migration = await readFile(new URL("../../migrations/0002-media.sql", import.meta.url), "utf8");
export function database(db: PGlite): SqlDatabase {
  return { transaction: (work) => db.transaction((tx) => work({ query: async (sql, parameters) => tx.query(sql, parameters) })) };
}
export async function blobFixture(t: { after: (work: () => Promise<void>) => void }, now: () => number) {
  const objects = new Map<string, { bytes: Buffer; contentType: string; etag: string }>();
  const tokens = new Map<string, string>();
  const signingRoot = randomBytes(32);
  const issued: IssueSignedTokenOptions[] = [];
  const controls = { failDelete: false, failIssue: false, beforeIssue: undefined as (() => void) | undefined };
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url!, "http://localhost");
      const chunks: Buffer[] = [];
      for await (const part of request) { chunks.push(part); assert.ok(Buffer.concat(chunks).length <= 17_000_000); }
      const bytes = Buffer.concat(chunks);
      if (url.pathname === "/signed-token") {
        controls.beforeIssue?.();
        if (controls.failIssue) { response.writeHead(403, { "content-type": "application/json" }).end(JSON.stringify({ error: { code: "forbidden", message: "isolated failure" } })); return; }
        const body = JSON.parse(bytes.toString()); issued.push(body);
        assert.ok(body.pathname.startsWith("arbi/test/") && body.operations.length === 1);
        const delegationToken = `${Buffer.from(JSON.stringify({ ...body, storeId: "fixture" })).toString("base64url")}.isolated`;
        const clientSigningToken = createHmac("sha256", signingRoot).update(delegationToken).digest("base64url"); tokens.set(delegationToken, clientSigningToken);
        response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ delegationToken, clientSigningToken, validUntil: body.validUntil })); return;
      }
      const delegation = url.searchParams.get("vercel-blob-delegation")!;
      const key = tokens.get(delegation); if (!key) { response.writeHead(403).end(); return; }
      const scope = JSON.parse(Buffer.from(delegation.split(".")[0], "base64url").toString());
      const path = url.searchParams.get("pathname") ?? decodeURIComponent(url.pathname.slice(1));
      const operation = request.method!.toLowerCase();
      const params = [...url.searchParams].filter(([name]) => name.startsWith("vercel-blob-") && !["vercel-blob-delegation", "vercel-blob-signature"].includes(name));
      const canonical = [`operation=${operation}`, `pathname=${path}`, ...params.map(([k, v]) => `${k}=${v}`)].sort().join("\n");
      const signature = createHmac("sha256", key).update(canonical).digest("base64url");
      const expires = Number(url.searchParams.get("vercel-blob-valid-until") ?? scope.validUntil);
      if (signature !== url.searchParams.get("vercel-blob-signature") || scope.pathname !== path ||
        !scope.operations.includes(operation) || now() >= Math.min(expires, scope.validUntil)) { response.writeHead(403).end(); return; }
      if (operation === "put") {
        const type = request.headers["content-type"] as string;
        const allowed = url.searchParams.get("vercel-blob-allowed-content-types")?.split(",") ?? scope.allowedContentTypes;
        const max = Number(url.searchParams.get("vercel-blob-maximum-size-in-bytes") ?? scope.maximumSizeInBytes);
        if (!allowed.includes(type) || bytes.length > max) { response.writeHead(413).end(); return; }
        if (objects.has(path)) { response.writeHead(409).end(); return; }
        objects.set(path, { bytes, contentType: type, etag: `"${createHash("sha256").update(bytes).digest("hex")}"` });
        response.writeHead(200).end(); return;
      }
      if (operation === "delete") {
        if (controls.failDelete) { response.writeHead(503).end(); return; }
        objects.delete(path); response.writeHead(200).end(); return;
      }
      const object = objects.get(path); if (!object) { response.writeHead(404).end(); return; }
      response.writeHead(200, { "content-type": object.contentType, "content-length": object.bytes.length,
        etag: object.etag, "cache-control": "private, max-age=60" });
      response.end(operation === "head" ? undefined : object.bytes);
    } catch { response.writeHead(500).end(); }
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const previous = process.env.VERCEL_BLOB_API_URL; process.env.VERCEL_BLOB_API_URL = base;
  t.after(async () => {
    if (previous === undefined) delete process.env.VERCEL_BLOB_API_URL; else process.env.VERCEL_BLOB_API_URL = previous;
    server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  const adapter = new VercelPrivateBlob({ storeId: "fixture" }, {
    // Real SDK HTTP /signed-token serialization. Fixture-only token, with no provider account capability.
    issue: (options) => issueSignedToken({ ...options, token: "vercel_blob_rw_fixture_isolated" }),
    sign: async (token, options) => {
      const result = await presignUrl(token, options);
      const url = new URL(result.presignedUrl);
      if (options.operation === "get" || options.operation === "head") {
        assert.equal(url.hostname, "fixture.private.blob.vercel-storage.com");
        return { presignedUrl: `${base}${url.pathname}${url.search}` };
      }
      assert.equal(url.origin, base); return result;
    },
  }, fetch, now);
  return { adapter, objects, controls, issued };
}
export async function setup(t: { after: (work: () => Promise<void>) => void }) {
  let now = Date.now();
  const db = new PGlite(); t.after(() => db.close()); await db.exec(migration);
  const sql = database(db); const store = new PostgresMediaStore(sql); await store.provision(site);
  await store.provision({ ...site, siteId: "site-b", accountId: "account-b" });
  const provider = createIsolatedIdentityProvider(realm, () => now);
  provider.putSite("site-a", "account-a"); provider.putSite("site-b", "account-b");
  for (const [id, roles] of [["operator", ["operator"]], ["viewer", ["viewer"]], ["engineer", ["engineer"]]] as const) {
    provider.putPrincipal({ actor: { kind: "human", id }, accountId: "account-a", member: true,
      sites: { "site-a": { roles: [...roles], serviceScopes: [], active: true, revision: "membership-1" } } });
  }
  provider.putPrincipal({ actor: { kind: "service", id: "uploader" }, accountId: "account-a", member: true,
    sites: { "site-a": { roles: [], serviceScopes: ["capture.request"], active: true, revision: "membership-1" } } });
  const tokens = { operator: await provider.issue({ kind: "human", id: "operator" }, 900),
    viewer: await provider.issue({ kind: "human", id: "viewer" }, 900), engineer: await provider.issue({ kind: "human", id: "engineer" }, 900),
    uploader: await provider.issue({ kind: "service", id: "uploader" }, 900) };
  const blob = await blobFixture(t, () => now);
  const compose = (db = sql, resolveCapture?: Parameters<typeof createMediaServer>[0]["resolveCapture"]) => createMediaServer({ realm,
    identity: provider.adapter, resolveSite: provider.resolveResource, browserOrigins: ["https://fixture.invalid"], db, objects: blob.adapter,
    now: () => now, ...(resolveCapture ? { resolveCapture } : {}) });
  const http = compose();
  const bytes = await sharp({ create: { width: 32, height: 24, channels: 3, background: "#808080" } }).png().toBuffer();
  const upload = (requestId: string, variant: "full" | "thumbnail" = "full", imageId: string | null = null): UploadInput => ({
    requestId, variant, imageId, captureId: null, size: bytes.length, contentType: "image/png",
    sha256: createHash("sha256").update(bytes).digest("hex"), width: 32, height: 24,
  });
  const request = (action: string, body: unknown, actor: keyof typeof tokens = action === "access" || action === "metadata" ? "viewer" :
    ["delete", "revoke", "cleanup"].includes(action) ? "engineer" : "operator") => new Request("https://fixture.invalid/api", {
    method: action === "metadata" ? "GET" : "POST", headers: { authorization: `Bearer ${tokens[actor].token}`,
      ...(actor === "uploader" ? {} : { origin: "https://fixture.invalid", "x-arbi-request": "1" }), "content-type": "application/json" },
    ...(action === "metadata" ? {} : { body: JSON.stringify(body) }),
  });
  const call = async (action: string, body: unknown, imageId?: string, actor?: keyof typeof tokens, siteId = "site-a", target = http) => {
    const response = await target.handle(request(action, body, actor), { siteId, action, ...(imageId ? { imageId } : {}) });
    return { status: response.status, headers: response.headers, value: await response.json() as any };
  };
  const put = (url: string, body = bytes, type = "image/png") => fetch(url, { method: "PUT", headers: { "content-type": type }, body });
  const prepare = async (id: string, variant: "full" | "thumbnail" = "full", imageId: string | null = null) => {
    const result = await call("upload", upload(id, variant, imageId)); assert.equal(result.status, 200); return result.value;
  };
  const complete = (value: any, variant = "full") => call("complete", { imageId: value.imageId, uploadId: value.uploadId, variant });
  const ready = async (id: string) => {
    const value = await prepare(id); assert.equal((await put(value.putUrl)).status, 200);
    assert.equal((await complete(value)).status, 200); return value;
  };
  const image = (id: string): Promise<MediaImage> => store.read(realm, "site-a", id);
  return { db, store, sql, provider, tokens, blob, bytes, upload, request, call, put, prepare, complete, ready, image, compose,
    now: () => now, advance: (ms: number) => { now += ms; } };
}
