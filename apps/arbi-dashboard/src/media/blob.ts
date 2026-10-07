import { createHash } from "node:crypto";
import { issueSignedToken, parseStoreIdFromDelegationToken, presignUrl } from "@vercel/blob";
import type { IssueSignedTokenOptions, PresignUrlOptions, IssuedSignedToken } from "@vercel/blob";
import sharp from "sharp";
import { bounded } from "@arbi/gredice";
import { MAX_PIXELS, MediaError, requireMedia } from "./contracts";
import type { ObjectExpectation, PrivateObjectStore } from "./contracts";

export interface BlobSdk {
  issue(options: IssueSignedTokenOptions): Promise<IssuedSignedToken>;
  sign(token: IssuedSignedToken, options: PresignUrlOptions & { access: "private" }): Promise<{ presignedUrl: string }>;
}
const sdk: BlobSdk = { issue: issueSignedToken, sign: presignUrl };
/** Actual SDK signing/control API and HTTP object plane; no supplied URL is ever fetched. */
export class VercelPrivateBlob implements PrivateObjectStore {
  constructor(readonly options: { storeId: string }, readonly provider: BlobSdk = sdk,
    readonly request: typeof fetch = fetch, readonly now: () => number = Date.now) {
    requireMedia(/^(?:store_)?[a-zA-Z0-9]+$/.test(options.storeId));
  }
  async #url(path: string, operation: "get" | "head" | "put" | "delete", expiresAtMs: number,
    object?: ObjectExpectation): Promise<string> {
    requireMedia(/^arbi\/(test|preview|production)\/[a-f0-9]{64}\/[a-f0-9-]{36}\/(full|thumbnail)\/[a-f0-9-]{36}$/.test(path));
    requireMedia(Number.isSafeInteger(expiresAtMs) && expiresAtMs > this.now(), "EXPIRED");
    const constraints = object ? { allowedContentTypes: [object.contentType], maximumSizeInBytes: object.size } : {};
    const token = await bounded(5_000, (signal) => this.provider.issue({ storeId: this.options.storeId, pathname: path, operations: [operation],
      validUntil: expiresAtMs, ...constraints, abortSignal: signal }));
    requireMedia(token.validUntil >= expiresAtMs &&
      parseStoreIdFromDelegationToken(token.delegationToken) === this.options.storeId.replace(/^store_/, ""), "UNAVAILABLE");
    const { presignedUrl } = await this.provider.sign(token, { access: "private", pathname: path, operation,
      validUntil: expiresAtMs, ...(operation === "put" ? { ...constraints, addRandomSuffix: false,
        allowOverwrite: false, cacheControlMaxAge: 60 } : operation === "get" ? { useCache: false } : {}) });
    return presignedUrl;
  }
  uploadGrant(object: ObjectExpectation, expiresAtMs: number) { return this.#url(object.path, "put", expiresAtMs, object); }
  accessGrant(path: string, expiresAtMs: number) { return this.#url(path, "get", expiresAtMs); }
  async #fetch(path: string, operation: "get" | "head" | "delete") {
    const url = await this.#url(path, operation, this.now() + 30_000);
    return this.request(url, { method: operation.toUpperCase(), redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10_000) });
  }
  async inspect(object: ObjectExpectation): Promise<{ etag: string }> {
    const response = await this.#fetch(object.path, "get");
    if (response.status === 404) throw new MediaError("MISSING_OBJECT");
    requireMedia(response.ok && response.body, "UNAVAILABLE");
    try {
      requireMedia(response.headers.get("content-type")?.split(";")[0] === object.contentType &&
        Number(response.headers.get("content-length")) === object.size, "INVALID_OBJECT");
      const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let length = 0;
      try {
        while (true) {
          const part = await reader.read(); if (part.done) break;
          length += part.value.byteLength;
          requireMedia(length <= object.size, "INVALID_OBJECT"); chunks.push(part.value);
        }
      } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
      const bytes = Buffer.concat(chunks);
      requireMedia(length === object.size && createHash("sha256").update(bytes).digest("hex") === object.sha256, "INVALID_OBJECT");
      try {
        const image = sharp(bytes, { limitInputPixels: MAX_PIXELS, failOn: "warning", animated: true });
        const metadata = await image.metadata();
        requireMedia(metadata.width === object.width && metadata.height === object.height &&
          (metadata.pages ?? 1) === 1 && `image/${metadata.format === "jpeg" ? "jpeg" : metadata.format}` === object.contentType, "INVALID_OBJECT");
        // Force a full bounded decode; header parsing alone does not detect a truncated image.
        await image.stats();
      } catch { throw new MediaError("INVALID_OBJECT"); }
      const etag = response.headers.get("etag"); requireMedia(etag && etag.length <= 256, "INVALID_OBJECT");
      return { etag };
    } finally { await response.body.cancel().catch(() => {}); }
  }
  async exists(object: ObjectExpectation, etag: string): Promise<boolean> {
    // GET with cache bypass, canceled after headers. HEAD has no documented origin-cache bypass in this SDK.
    const response = await this.#fetch(object.path, "get");
    await response.body?.cancel();
    if (response.status === 404) return false;
    requireMedia(response.ok, "UNAVAILABLE");
    requireMedia(response.headers.get("etag") === etag && Number(response.headers.get("content-length")) === object.size &&
      response.headers.get("content-type")?.split(";")[0] === object.contentType, "INVALID_OBJECT");
    return true;
  }
  async delete(path: string): Promise<void> {
    const response = await this.#fetch(path, "delete");
    requireMedia(response.ok || response.status === 404, "UNAVAILABLE");
    await response.body?.cancel();
  }
}
