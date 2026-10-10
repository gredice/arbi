import { createPublicKey, verify, type KeyObject } from "node:crypto";
import { releaseSigningBytes, validateReleaseRecord, type ReleaseManifest } from "@arbi/protocol";

export interface AvailableRelease { state: "available"; installationRequested: false; scope: "simulation-only"; manifest: ReleaseManifest }
export interface CatalogTrust { keyId: string; publicKey: KeyObject }
interface Asset { name: string; size: number; digest: string; browser_download_url: string }
export interface PublishedRelease { tag_name: string; target_commitish: string; immutable: boolean; draft: boolean; assets: Asset[] }
export function admitCatalogEntry(release: PublishedRelease, entry: unknown, input: unknown, trust: CatalogTrust): AvailableRelease {
  const parsed = validateReleaseRecord("manifest", input);
  if (!parsed.ok) throw new Error("INVALID_RELEASE");
  const m = parsed.value;
  const metadata = entry as Record<string, unknown>;
  const tag = `software-edge-${m.build.commit}`;
  const artifact = release.assets.filter(a => a.name === "edge.tar.gz");
  const target = m.target;
  if (!release.immutable || release.draft || release.tag_name !== tag || release.target_commitish !== m.build.commit ||
    !metadata || metadata.schemaVersion !== "arbi.catalog-entry/1.0" || metadata.tag !== tag || metadata.commit !== m.build.commit ||
    metadata.state !== "available" || metadata.installationRequested !== false || metadata.scope !== "simulation-only" ||
    metadata.manifestFile !== "edge.manifest.json" || metadata.artifactFile !== "edge.tar.gz" ||
    m.channel !== "candidate" || m.artifact.kind !== "application" || target.moduleId !== "edge" ||
    target.targetClass !== "linux-edge" || target.boardId !== "synthetic-linux-edge" || target.hardwareId !== "edge-model" ||
    target.hardwareRevision !== "1.0.0" || target.assemblyId !== "control-cabinet" || target.assemblyRevision !== "1.0.0" ||
    artifact.length !== 1 || artifact[0]!.size !== m.artifact.sizeBytes || artifact[0]!.digest !== `sha256:${m.artifact.sha256}` ||
    trust.keyId !== m.artifact.signature.keyId || trust.publicKey.asymmetricKeyType !== "ed25519" ||
    !verify(null, releaseSigningBytes(m), trust.publicKey, Buffer.from(m.artifact.signature.value, "hex"))) throw new Error("UNTRUSTED_RELEASE");
  return { state: "available", installationRequested: false, scope: "simulation-only", manifest: m };
}
async function boundedJson(response: Response, limit: number) {
  if (!response.ok || !response.body) throw new Error("CATALOG_UNAVAILABLE");
  const reader = response.body.getReader(); let size = 0; const chunks: Uint8Array[] = [];
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > limit) throw new Error("CATALOG_CAPACITY"); chunks.push(value); }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally { await reader.cancel(); }
}
/** Public immutable availability registry. It has no storage, intent or device-write interface. */
export async function readReleaseCatalog(trust: CatalogTrust, signal: AbortSignal, request: typeof fetch = fetch): Promise<AvailableRelease[]> {
  const catalog: AvailableRelease[] = [];
  const get = (url: string) => request(url, { signal, cache: "no-store", headers: { accept: "application/vnd.github+json" } });
  // Previous immutable releases remain available; bounded pagination never silently truncates.
  for (let page = 1; page <= 5; page++) {
    const releases: PublishedRelease[] = await boundedJson(await get(`https://api.github.com/repos/gredice/arbi/releases?per_page=100&page=${page}`), 4 * 1024 * 1024);
    if (!Array.isArray(releases)) throw new Error("INVALID_CATALOG");
    for (const release of releases.filter(r => r.tag_name.startsWith("software-"))) {
      const read = async (name: string) => {
        const assets = release.assets.filter(a => a.name === name);
        const expected = `https://github.com/gredice/arbi/releases/download/${release.tag_name}/${name}`;
        if (assets.length !== 1 || assets[0]!.browser_download_url !== expected) throw new Error("INVALID_CATALOG_ASSET");
        // Public assets only: no credentials to forward on GitHub's storage redirect.
        return boundedJson(await get(expected), 64 * 1024);
      };
      catalog.push(admitCatalogEntry(release, await read("catalog-entry.json"), await read("edge.manifest.json"), trust));
    }
    if (releases.length < 100) return catalog;
  }
  throw new Error("CATALOG_CAPACITY");
}
export function configuredCatalog(signal: AbortSignal) {
  const keyId = process.env.ARBI_RELEASE_KEY_ID, key = process.env.ARBI_RELEASE_PUBLIC_KEY;
  if (!keyId || !key) throw new Error("CATALOG_UNCONFIGURED");
  // Trust is provisioned independently; never trust a key included in a release.
  return readReleaseCatalog({ keyId, publicKey: createPublicKey(key) }, signal);
}
