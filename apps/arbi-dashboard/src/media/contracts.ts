import { isId, isObject, isRealm } from "@arbi/gredice";
import type { AuthorizedContext } from "@arbi/gredice";
import type { Realm, TrafficCategory, UsageLayer } from "@arbi/protocol";

export const MEDIA_VERSION = "arbi.media/1.0";
export const UPLOAD_TTL_MS = 300_000;
export const ACCESS_TTL_MS = 30_000;
export const MAX_IMAGE_BYTES = 16 * 1024 * 1024;
export const MAX_PIXELS = 24_000_000;
export type VariantName = "full" | "thumbnail";
export type ContentType = "image/jpeg" | "image/png" | "image/webp";
export class MediaError extends Error {
  constructor(readonly code: "INVALID_REQUEST" | "DENIED" | "CONFLICT" | "EXPIRED" | "MISSING_OBJECT" |
    "INVALID_OBJECT" | "UNAVAILABLE" | "CAPACITY") { super(code); this.name = "MediaError"; }
}
export function requireMedia(condition: unknown, code: MediaError["code"] = "INVALID_REQUEST"): asserts condition {
  if (!condition) throw new MediaError(code);
}
export function exact(value: unknown, fields: string[]): asserts value is Record<string, unknown> {
  requireMedia(isObject(value) && Object.keys(value).length === fields.length && fields.every((key) => Object.hasOwn(value, key)));
}
export interface MediaSite {
  realm: Realm; siteId: string; accountId: string; executionMode: "simulation" | "hardware";
}
export function validSite(site: MediaSite): boolean {
  return isRealm(site.realm) && isId(site.siteId) && isId(site.accountId) &&
    ["simulation", "hardware"].includes(site.executionMode) &&
    !(site.realm.environment === "production" && site.executionMode === "simulation");
}
export type Association = { status: "available"; id: string } |
  { status: "unavailable"; reason: "upstream-not-implemented" | "not-associated" };
export interface CaptureMetadata {
  capture: Association; job: Association; bed: Association; plant: Association; calibration: Association;
  capturedAt: { status: "available"; utc: string; uncertaintyMs: number | null } | { status: "unavailable" };
  framing: { status: "available"; frameId: string; revision: string } | { status: "unavailable" };
  provenance: "trusted-capture-record" | "unassociated-upload";
}
/** Server adapter must resolve protected capture/job/catalog/config records in one consistent snapshot. */
export type CaptureResolver = (query: {
  site: MediaSite; context: AuthorizedContext; captureId: string; signal: AbortSignal;
}) => Promise<{ site: MediaSite; metadata: CaptureMetadata } | null>;
export function unavailableMetadata(): CaptureMetadata {
  const missing = (): Association => ({ status: "unavailable", reason: "upstream-not-implemented" });
  return { capture: missing(), job: missing(), bed: missing(), plant: missing(), calibration: missing(),
    capturedAt: { status: "unavailable" }, framing: { status: "unavailable" }, provenance: "unassociated-upload" };
}
export function validMetadata(value: unknown): value is CaptureMetadata {
  if (!isObject(value) || Object.keys(value).length !== 8) return false;
  for (const field of ["capture", "job", "bed", "plant", "calibration"]) {
    const item = value[field];
    if (!isObject(item) || Object.keys(item).length !== 2 || !(item.status === "available" ? isId(item.id) :
      item.status === "unavailable" && ["upstream-not-implemented", "not-associated"].includes(String(item.reason)))) return false;
  }
  const time = value.capturedAt, frame = value.framing;
  if (!isObject(time) || !(time.status === "unavailable" ? Object.keys(time).length === 1 :
    time.status === "available" && Object.keys(time).length === 3 && typeof time.utc === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(time.utc) && Number.isFinite(Date.parse(time.utc)) &&
    new Date(time.utc).toISOString() === time.utc && (time.uncertaintyMs === null ||
      typeof time.uncertaintyMs === "number" && Number.isFinite(time.uncertaintyMs) && time.uncertaintyMs >= 0))) return false;
  return isObject(frame) && (frame.status === "unavailable" ? Object.keys(frame).length === 1 :
    frame.status === "available" && Object.keys(frame).length === 3 && isId(frame.frameId) && isId(frame.revision)) &&
    ["trusted-capture-record", "unassociated-upload"].includes(String(value.provenance));
}
export interface UploadInput {
  requestId: string; variant: VariantName; imageId: string | null; captureId: string | null;
  size: number; contentType: ContentType; sha256: string; width: number; height: number;
}
export function uploadInput(value: unknown): UploadInput {
  exact(value, ["requestId", "variant", "imageId", "captureId", "size", "contentType", "sha256", "width", "height"]);
  requireMedia(isId(value.requestId) && ["full", "thumbnail"].includes(String(value.variant)) &&
    ["image/jpeg", "image/png", "image/webp"].includes(String(value.contentType)) &&
    typeof value.sha256 === "string" && /^[a-f0-9]{64}$/.test(value.sha256));
  for (const field of ["size", "width", "height"]) requireMedia(Number.isSafeInteger(value[field]) && Number(value[field]) > 0);
  requireMedia(Number(value.size) <= (value.variant === "thumbnail" ? 1_048_576 : MAX_IMAGE_BYTES) &&
    Number(value.width) * Number(value.height) <= (value.variant === "thumbnail" ? 1_048_576 : MAX_PIXELS));
  requireMedia(value.variant === "full" ? value.imageId === null && (value.captureId === null || isId(value.captureId)) :
    isId(value.imageId) && value.captureId === null);
  return value as unknown as UploadInput;
}
export interface UploadVariant {
  id: string; request: UploadInput; path: string; creator: AuthorizedContext["actor"]; sessionId: string;
  createdAtMs: number; expiresAtMs: number; state: "pending" | "ready" | "deleting" | "deleted";
  verifiedAtMs: number | null; etag: string | null; deletionRequestedAtMs: number | null;
  derived: { sourceSha256: string; provenance: "uploader-declared-thumbnail" } | null;
}
export interface MediaImage {
  version: typeof MEDIA_VERSION; id: string; site: MediaSite; metadata: CaptureMetadata;
  variants: { full: UploadVariant; thumbnail: UploadVariant | null };
}
export interface AccessGrant {
  id: string; imageId: string; variant: VariantName; actor: AuthorizedContext["actor"]; sessionId: string;
  membershipRevision: string; operation: "view" | "download"; expiresAtMs: number; revoked: boolean;
}
/** Object length is a storage observation, not a transfer/WAN/provider meter. */
export interface MediaUsage {
  category: Extract<TrafficCategory, "still" | "thumbnail">; layer: Extract<UsageLayer, "application-payload">;
  objectBytes: number; transferBytes: null; wanBytes: null; providerBytes: null; retryBytes: null;
  evidence: "verified-object-length" | "grant-object-size-only";
}
export interface ObjectExpectation {
  path: string; size: number; contentType: ContentType; sha256: string; width: number; height: number;
}
export interface PrivateObjectStore {
  uploadGrant(object: ObjectExpectation, expiresAtMs: number): Promise<string>;
  inspect(object: ObjectExpectation): Promise<{ etag: string }>;
  exists(object: ObjectExpectation, etag: string): Promise<boolean>;
  accessGrant(path: string, expiresAtMs: number): Promise<string>;
  delete(path: string): Promise<void>;
}
export function expectation(variant: UploadVariant): ObjectExpectation { return { path: variant.path, ...variant.request }; }
