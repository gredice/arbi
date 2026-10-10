import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { produceRelease, type ReleaseManifest } from "@arbi/protocol";
import { admitCatalogEntry, readReleaseCatalog, type PublishedRelease } from "./catalog";

function fixture(commit = "a".repeat(40)) {
  const keys = generateKeyPairSync("ed25519"), trust = { keyId: "isolated-key", publicKey: keys.publicKey };
  const fixtures = JSON.parse(readFileSync(new URL("../../../../packages/arbi-protocol/fixtures/releases.json", import.meta.url), "utf8"));
  const unsigned: ReleaseManifest = fixtures.releaseSet.manifests.find((m: ReleaseManifest) => m.target.moduleId === "edge");
  unsigned.build.commit = commit; unsigned.channel = "candidate"; unsigned.artifact.signature.keyId = trust.keyId;
  const result = produceRelease(unsigned, Buffer.from("isolated application"), { keyId: trust.keyId, privateKey: keys.privateKey });
  assert.equal(result.ok, true); if (!result.ok) throw new Error();
  const manifest = result.value, tag = `software-edge-${commit}`;
  const release: PublishedRelease = { tag_name: tag, target_commitish: commit, immutable: true, draft: false,
    assets: ["edge.tar.gz", "edge.manifest.json", "catalog-entry.json"].map(name => ({ name, size: name === "edge.tar.gz" ? manifest.artifact.sizeBytes : 100,
      digest: `sha256:${manifest.artifact.sha256}`, browser_download_url: `https://github.com/gredice/arbi/releases/download/${tag}/${name}` })) };
  const entry = { schemaVersion: "arbi.catalog-entry/1.0", state: "available", scope: "simulation-only", installationRequested: false,
    tag, commit, manifestFile: "edge.manifest.json", artifactFile: "edge.tar.gz" };
  return { trust, release, entry, manifest };
}
test("sealed catalog availability verifies source, artifact digest and independently trusted manifest signature", () => {
  const f = fixture();
  const available = admitCatalogEntry(f.release, f.entry, f.manifest, f.trust);
  assert.equal(available.state, "available"); assert.equal(available.installationRequested, false);
  for (const release of [{ ...f.release, immutable: false }, { ...f.release, draft: true }, { ...f.release, target_commitish: "b".repeat(40) },
    { ...f.release, assets: f.release.assets.map(a => ({ ...a, digest: "sha256:" + "0".repeat(64) })) }]) assert.throws(() => admitCatalogEntry(release, f.entry, f.manifest, f.trust));
  for (const entry of [{ ...f.entry, scope: "hardware" }, { ...f.entry, installationRequested: true }, { ...f.entry, commit: "b".repeat(40) }]) assert.throws(() => admitCatalogEntry(f.release, entry, f.manifest, f.trust));
  assert.throws(() => admitCatalogEntry(f.release, f.entry, { ...f.manifest, channel: "stable" }, f.trust));
  assert.throws(() => admitCatalogEntry(f.release, f.entry, f.manifest, { ...f.trust, publicKey: generateKeyPairSync("ed25519").publicKey }));
});
test("catalog retains older immutable artifacts, never posts installation intent and rejects foreign asset URLs", async () => {
  const f = fixture(), older = structuredClone(f);
  // Same trust; repeatability/retention uses two references to sealed evidence.
  const methods: string[] = [];
  const request: typeof fetch = async (input, options) => {
    const url = String(input); methods.push(options?.method ?? "GET");
    if (url.includes("api.github.com")) return Response.json([f.release, older.release]);
    return Response.json(url.endsWith("catalog-entry.json") ? f.entry : f.manifest);
  };
  const result = await readReleaseCatalog(f.trust, AbortSignal.timeout(5000), request);
  assert.equal(result.length, 2); assert.ok(methods.every(method => method === "GET"));
  const poison: typeof fetch = async () => Response.json([{ ...f.release, assets: f.release.assets.map(a => ({ ...a, browser_download_url: "https://other.invalid/private" })) }]);
  await assert.rejects(readReleaseCatalog(f.trust, AbortSignal.timeout(5000), poison));
  await assert.rejects(readReleaseCatalog(f.trust, AbortSignal.timeout(5000), async () => new Response("", { status: 503 })));
});
