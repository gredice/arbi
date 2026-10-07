import { createHash, randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { bounded, isId, sameRealm } from "@arbi/gredice";
import type { AuthorizedContext } from "@arbi/gredice";
import { ACCESS_TTL_MS, MEDIA_VERSION, MediaError, UPLOAD_TTL_MS, exact, expectation, requireMedia,
  unavailableMetadata, uploadInput, validMetadata, validSite } from "./contracts";
import type { AccessGrant, CaptureResolver, MediaImage, MediaUsage, PrivateObjectStore, UploadVariant, VariantName } from "./contracts";
import { PostgresMediaStore } from "./store";
import type { MediaTransaction } from "./store";

const owner = (context: AuthorizedContext, upload: UploadVariant) =>
  context.actor.kind === upload.creator.kind && context.actor.id === upload.creator.id;
const publicImage = (image: MediaImage) => ({ id: image.id, siteId: image.site.siteId, realm: image.site.realm,
  executionMode: image.site.executionMode, metadata: image.metadata,
  variants: Object.fromEntries(Object.entries(image.variants).map(([name, value]) => [name, value ? {
    state: value.state, size: value.request.size, contentType: value.request.contentType, sha256: value.request.sha256,
    width: value.request.width, height: value.request.height, createdAtMs: value.createdAtMs, verifiedAtMs: value.verifiedAtMs,
    derived: value.derived,
  } : null])) });
function usage(variant: UploadVariant, verified: boolean): MediaUsage {
  return { category: variant.request.variant === "full" ? "still" : "thumbnail", layer: "application-payload",
    objectBytes: variant.request.size, transferBytes: null, wanBytes: null, providerBytes: null, retryBytes: null,
    evidence: verified ? "verified-object-length" : "grant-object-size-only" };
}
export class MediaService {
  constructor(readonly store: PostgresMediaStore, readonly objects: PrivateObjectStore,
    readonly resolveCapture?: CaptureResolver, readonly now: () => number = Date.now) {}
  #context(context: AuthorizedContext, tx: MediaTransaction, capability: string) {
    requireMedia(context.accountId === tx.site.accountId && context.siteId === tx.site.siteId &&
      sameRealm(context.realm, tx.site.realm) && context.capability === capability && context.expiresAtMs > this.now(), "DENIED");
  }
  async upload(context: AuthorizedContext, input: unknown) {
    const request = uploadInput(input);
    // Resolution occurs outside the row lock. Only the trusted adapter may supply provenance.
    let metadata = unavailableMetadata();
    if (request.captureId) {
      requireMedia(this.resolveCapture, "DENIED");
      const scope = await this.store.resolve(context.realm, context.siteId); requireMedia(scope, "DENIED");
      const capture = await bounded(5_000, (signal) => this.resolveCapture!({ site: scope, context, captureId: request.captureId!, signal }));
      requireMedia(capture && validSite(capture.site) && isDeepStrictEqual(capture.site, {
        realm: scope.realm, siteId: scope.siteId, accountId: scope.accountId, executionMode: scope.executionMode }) &&
        validMetadata(capture.metadata) && capture.metadata.provenance === "trusted-capture-record" &&
        capture.metadata.capture.status === "available" && capture.metadata.capture.id === request.captureId, "DENIED");
      metadata = structuredClone(capture.metadata);
    }
    const prepared = await this.store.transact(context.realm, context.siteId, async (tx) => {
      this.#context(context, tx, "capture.request");
      let image: MediaImage;
      if (request.variant === "full") {
        const existing = await tx.replay(context, request.requestId);
        if (existing) {
          requireMedia(isDeepStrictEqual(existing.variants.full.request, request), "CONFLICT"); return existing;
        }
        const { rows } = await tx.sql.query<{ count: string }>("SELECT count(*)::text AS count FROM arbi_media_images WHERE environment=$1 AND namespace_id=$2 AND site_id=$3", tx.key());
        requireMedia(Number(rows[0].count) < 10_000, "CAPACITY");
        const id = randomUUID();
        image = { version: MEDIA_VERSION, id, site: tx.site, metadata, variants: { full: this.#variant(context, id, request), thumbnail: null } };
        await tx.insert(image);
      } else {
        image = await tx.image(request.imageId!);
        requireMedia(image.variants.full.state === "ready", "CONFLICT");
        if (image.variants.thumbnail) {
          requireMedia(owner(context, image.variants.thumbnail) && isDeepStrictEqual(image.variants.thumbnail.request, request), "CONFLICT");
          return image;
        }
        image.variants.thumbnail = this.#variant(context, image.id, request);
        image.variants.thumbnail.derived = { sourceSha256: image.variants.full.request.sha256, provenance: "uploader-declared-thumbnail" };
        await tx.save(image);
      }
      await tx.record(context, { operation: "upload.prepare", imageId: image.id, uploadId: image.variants[request.variant]!.id, variant: request.variant });
      return image;
    });
    const variant = prepared.variants[request.variant]!;
    requireMedia(owner(context, variant), "DENIED");
    if (variant.state === "ready") return { imageId: prepared.id, uploadId: variant.id, state: "ready", putUrl: null };
    requireMedia(variant.state === "pending", "CONFLICT");
    const expiresAtMs = Math.min(variant.expiresAtMs, context.expiresAtMs);
    requireMedia(expiresAtMs > this.now(), "EXPIRED");
    let putUrl: string;
    try { putUrl = await this.objects.uploadGrant(expectation(variant), expiresAtMs); }
    catch (error) { await this.#failed(context, prepared.id, "upload.grant", request.variant, error); throw error; }
    const grantId = randomUUID();
    return this.store.transact(context.realm, context.siteId, async (tx) => {
      this.#context(context, tx, "capture.request");
      const current = (await tx.image(prepared.id)).variants[request.variant];
      requireMedia(current?.id === variant.id && current.state === "pending", "CONFLICT");
      requireMedia(expiresAtMs > this.now(), "EXPIRED");
      await tx.record(context, { operation: "upload.grant", imageId: prepared.id, uploadId: variant.id, variant: request.variant,
        grantId, expiresAtMs, membershipRevision: context.membershipRevision, result: "prepared-response-delivery-unknown" });
      return { imageId: prepared.id, uploadId: variant.id, state: "pending", putUrl, grantId, expiresAtMs,
        method: "PUT", headers: { "content-type": variant.request.contentType } };
    });
  }
  #variant(context: AuthorizedContext, imageId: string, request: UploadVariant["request"]): UploadVariant {
    const id = randomUUID();
    const scopeHash = createHash("sha256").update(JSON.stringify([context.realm, context.siteId])).digest("hex");
    return { id, request, path: `arbi/${context.realm.environment}/${scopeHash}/${imageId}/${request.variant}/${id}`,
      creator: context.actor, sessionId: context.sessionId, createdAtMs: this.now(), expiresAtMs: this.now() + UPLOAD_TTL_MS,
      state: "pending", etag: null, verifiedAtMs: null, deletionRequestedAtMs: null, derived: null };
  }
  async #failed(context: AuthorizedContext, imageId: string, operation: string, variant: VariantName, error: unknown) {
    await this.store.transact(context.realm, context.siteId, async (tx) => {
      await tx.image(imageId);
      await tx.record(context, { operation, imageId, variant, result: error instanceof MediaError ? error.code : "UNAVAILABLE" }, undefined, true);
    });
  }
  async complete(context: AuthorizedContext, input: unknown) {
    exact(input, ["imageId", "variant", "uploadId"]);
    requireMedia(isId(input.imageId) && isId(input.uploadId) && ["full", "thumbnail"].includes(String(input.variant)));
    const variantName = input.variant as VariantName, imageId = input.imageId;
    const initial = await this.store.transact(context.realm, context.siteId, async (tx) => {
      this.#context(context, tx, "capture.request");
      const image = await tx.image(imageId); const variant = image.variants[variantName];
      requireMedia(variant && owner(context, variant) && variant.id === input.uploadId, "DENIED");
      requireMedia(["pending", "ready"].includes(variant.state), "CONFLICT");
      requireMedia(variant.state === "ready" || variant.expiresAtMs > this.now(), "EXPIRED");
      return image;
    });
    if (initial.variants[variantName]!.state === "ready") return publicImage(initial);
    let verified: { etag: string };
    try { verified = await this.objects.inspect(expectation(initial.variants[variantName]!)); }
    catch (error) { await this.#failed(context, imageId, "upload.verify", variantName, error); throw error; }
    return this.store.transact(context.realm, context.siteId, async (tx) => {
      this.#context(context, tx, "capture.request");
      const image = await tx.image(imageId); const variant = image.variants[variantName]!;
      requireMedia(owner(context, variant) && variant.id === input.uploadId, "DENIED");
      if (variant.state === "ready") return publicImage(image);
      requireMedia(variant.state === "pending" && (variantName === "full" || image.variants.full.state === "ready"), "CONFLICT");
      requireMedia(variant.expiresAtMs > this.now(), "EXPIRED");
      variant.state = "ready"; variant.verifiedAtMs = this.now(); variant.etag = verified.etag;
      await tx.save(image);
      await tx.record(context, { operation: "upload.complete", imageId, uploadId: variant.id, variant: variantName,
        result: "verified-object", usage: usage(variant, true) });
      return publicImage(image);
    });
  }
  async metadata(context: AuthorizedContext) {
    return this.store.transact(context.realm, context.siteId, async (tx) => {
      this.#context(context, tx, "still.read"); const image = await tx.image(context.resource.id);
      requireMedia(image.variants.full.state === "ready", "MISSING_OBJECT"); return publicImage(image);
    });
  }
  async access(context: AuthorizedContext, input: unknown) {
    exact(input, ["variant", "operation"]);
    requireMedia(["full", "thumbnail"].includes(String(input.variant)) && ["view", "download"].includes(String(input.operation)));
    const variantName = input.variant as VariantName, imageId = context.resource.id;
    const initial = await this.store.transact(context.realm, context.siteId, async (tx) => {
      this.#context(context, tx, "still.read"); return tx.image(imageId);
    });
    const variant = initial.variants[variantName];
    requireMedia(initial.variants.full.state === "ready" && variant?.state === "ready" && variant.etag, "MISSING_OBJECT");
    const grant: AccessGrant = { id: randomUUID(), imageId, variant: variantName, actor: context.actor,
      sessionId: context.sessionId, membershipRevision: context.membershipRevision, operation: input.operation as "view" | "download",
      expiresAtMs: Math.min(context.expiresAtMs, this.now() + ACCESS_TTL_MS), revoked: false };
    let url: string;
    try {
      requireMedia(await this.objects.exists(expectation(variant), variant.etag), "MISSING_OBJECT");
      url = await this.objects.accessGrant(variant.path, grant.expiresAtMs);
    } catch (error) { await this.#failed(context, imageId, "access.issue", variantName, error); throw error; }
    return this.store.transact(context.realm, context.siteId, async (tx) => {
      this.#context(context, tx, "still.read");
      const current = await tx.image(imageId);
      requireMedia(current.variants.full.state === "ready" && current.variants[variantName]?.state === "ready" &&
        current.variants[variantName]?.id === variant.id, "MISSING_OBJECT");
      requireMedia(grant.expiresAtMs > this.now(), "EXPIRED");
      await tx.grant(grant);
      await tx.record(context, { operation: "access.issue", imageId, variant: variantName, grantId: grant.id,
        expiresAtMs: grant.expiresAtMs, membershipRevision: grant.membershipRevision, result: "issued-access-not-observed", usage: usage(variant, false) }, grant);
      return { grantId: grant.id, expiresAtMs: grant.expiresAtMs, url, operation: grant.operation, variant: variantName };
    });
  }
  async revoke(context: AuthorizedContext, input: unknown) {
    exact(input, ["imageId", "grantId"]); requireMedia(isId(input.imageId) && isId(input.grantId));
    return this.store.transact(context.realm, context.siteId, async (tx) => {
      this.#context(context, tx, "configuration.write"); await tx.image(input.imageId as string);
      const { rows } = await tx.sql.query<{ record: AccessGrant }>("SELECT record FROM arbi_media_grants WHERE id::text=$1 AND image_id::text=$2",
        [input.grantId, input.imageId]); requireMedia(rows[0], "DENIED");
      const grant = rows[0].record; grant.revoked = true;
      await tx.sql.query("UPDATE arbi_media_grants SET record=$2::jsonb WHERE id=$1", [grant.id, JSON.stringify(grant)]);
      await tx.record(context, { operation: "access.revoke", imageId: grant.imageId, grantId: grant.id, result: "issuance-revoked-existing-url-expires" });
      return { revoked: true, existingUrlExpiresAtMs: grant.expiresAtMs };
    });
  }
  async delete(context: AuthorizedContext, input: unknown) {
    exact(input, ["imageId", "variant"]); requireMedia(isId(input.imageId) && ["full", "thumbnail", "all"].includes(String(input.variant)));
    const imageId = input.imageId;
    await this.store.transact(context.realm, context.siteId, async (tx) => {
      this.#context(context, tx, "configuration.write"); const image = await tx.image(imageId);
      for (const name of (input.variant === "thumbnail" ? ["thumbnail"] : ["full", "thumbnail"]) as VariantName[]) {
        const variant = image.variants[name]; if (!variant || variant.state === "deleted") continue;
        variant.state = "deleting"; variant.deletionRequestedAtMs ??= this.now();
        await tx.revoke(imageId, name);
      }
      await tx.save(image); await tx.record(context, { operation: "delete.request", imageId, result: "new-access-denied" });
    });
    return this.#remove(context, imageId);
  }
  async #remove(context: AuthorizedContext, imageId: string) {
    const image = await this.store.read(context.realm, context.siteId, imageId);
    const removed: string[] = [];
    for (const name of ["full", "thumbnail"] as const) {
      const variant = image.variants[name]; if (!variant || !["deleting", "deleted"].includes(variant.state)) continue;
      // A held PUT capability could recreate a deleted path before its deadline. Retain tombstones and sweep again.
      try { await this.objects.delete(variant.path); removed.push(variant.id); }
      catch (error) { await this.#failed(context, imageId, "delete.object", name, error); }
    }
    return this.store.transact(context.realm, context.siteId, async (tx) => {
      const current = await tx.image(imageId);
      for (const variant of Object.values(current.variants)) {
        if (variant?.state === "deleting" && removed.includes(variant.id) && variant.expiresAtMs + 60_000 <= this.now()) {
          variant.state = "deleted";
          await tx.record(context, { operation: "delete.complete", imageId, uploadId: variant.id, variant: variant.request.variant,
            result: "provider-delete-acknowledged-tombstone-retained" });
        }
      }
      await tx.save(current); return publicImage(current);
    });
  }
  async cleanup(context: AuthorizedContext, input: unknown) {
    exact(input, ["afterId", "limit"]);
    requireMedia(input.afterId === null || isId(input.afterId));
    requireMedia(Number.isSafeInteger(input.limit) && Number(input.limit) >= 1 && Number(input.limit) <= 32);
    const candidates = await this.store.transact(context.realm, context.siteId, async (tx) => {
      this.#context(context, tx, "configuration.write");
      const { rows } = await tx.sql.query<{ record: MediaImage }>(
        "SELECT record FROM arbi_media_images WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND ($4::text IS NULL OR id::text>$4) ORDER BY id::text LIMIT $5",
        [...tx.key(), input.afterId, Number(input.limit) + 1]);
      const page = rows.slice(0, Number(input.limit));
      for (const { record: image } of page) {
        for (const variant of Object.values(image.variants)) if (variant?.state === "pending" && variant.expiresAtMs <= this.now()) {
          variant.state = "deleting"; variant.deletionRequestedAtMs = this.now();
          await tx.record(context, { operation: "upload.expire", imageId: image.id, uploadId: variant.id, variant: variant.request.variant });
        }
        await tx.save(image);
      }
      return { images: page.map((row) => row.record), next: rows.length > Number(input.limit) ? page.at(-1)!.record.id : null };
    });
    for (const image of candidates.images) await this.#remove(context, image.id);
    return { scanned: candidates.images.length, next: candidates.next };
  }
}
