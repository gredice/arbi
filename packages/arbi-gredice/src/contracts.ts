import type { Actor, CommandContext, Realm } from "@arbi/protocol";
import type { Capability, Role, Surface } from "./policy.js";

export type PrincipalActor = Actor & { kind: "human" | "service" };
export type ResourceKind = "site" | "still" | "artifact" | "audit-export";
export interface ResourceReference { kind: ResourceKind; id: string }
/** Loaded from protected metadata, never from request claims or an object URL. */
export interface ResourceScope {
  resource: ResourceReference;
  realm: Realm;
  siteId: string;
  accountId: string;
  executionMode: "simulation" | "hardware";
}
export interface DirectoryQuery {
  actor: PrincipalActor;
  sessionId: string;
  siteId: string;
  realm: Realm;
  signal: AbortSignal;
}
/** One consistent authoritative read. observedAtMs is the original read time, not cache delivery time. */
export interface DirectorySnapshot {
  observedAtMs: number;
  session: { id: string; actor: PrincipalActor; realm: Realm; expiresAtMs: number; revoked: boolean };
  account: { id: string; active: boolean; member: boolean };
  site: { id: string; accountId: string; realm: Realm; active: boolean; executionMode: "simulation" | "hardware" };
  membership: {
    active: boolean;
    revision: string;
    roles: readonly Role[];
    serviceScopes: readonly Capability[];
  };
}
export type AuthorizationDirectory = (query: DirectoryQuery) => Promise<unknown>;
export type ResourceResolver = (query: {
  siteId: string; resource: ResourceReference; realm: Realm; signal: AbortSignal;
}) => Promise<unknown>;
export type DenialCode = "UNPROVISIONED" | "INVALID_CREDENTIAL" | "EXPIRED_SESSION" | "REVOKED_SESSION" |
  "SCOPE_MISMATCH" | "MEMBERSHIP_REQUIRED" | "CAPABILITY_DENIED" | "RECORDING_DISABLED" |
  "DEPENDENCY_UNAVAILABLE" | "STALE_DIRECTORY" | "INVALID_REQUEST" | "ORIGIN_DENIED" | "AUDIT_UNAVAILABLE";
export class AuthorizationError extends Error {
  constructor(readonly code: DenialCode,
    readonly verifiedIdentity?: { actor: PrincipalActor; sessionId: string }) {
    super(code); this.name = "AuthorizationError";
  }
}
export interface AuthorizedContext {
  /** Matches arbi/1.0 CommandContext.actor; handlers must copy this, never the body actor. */
  actor: CommandContext["actor"];
  sessionId: string;
  realm: Realm;
  siteId: string;
  accountId: string;
  resource: ResourceReference;
  capability: Capability;
  membershipRevision: string;
  expiresAtMs: number;
}
export interface RequestPolicy {
  surface: Surface;
  capability: Capability;
  siteId: string;
  resource?: ResourceReference;
}
/** Authorization evidence only: never a transport receipt or device outcome. */
export interface AuthorizationObservation {
  correlationId: string;
  observedAtMs: number;
  realm: Realm;
  siteId: string | null;
  actor: PrincipalActor | null;
  sessionId: string | null;
  capability: Capability | null;
  surface: Surface | null;
  resource: ResourceReference | null;
  decision: "authorized" | "denied";
  reason: DenialCode | null;
  membershipRevision: string | null;
}
/** Must acknowledge durable authorization evidence before the handler runs. No default no-op. */
export type AuditAuthorization = (observation: AuthorizationObservation, signal: AbortSignal) => Promise<boolean>;

export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function isId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
}
export function sameRealm(a: Realm, b: Realm): boolean {
  return a.environment === b.environment && a.namespaceId === b.namespaceId;
}
export function isRealm(value: unknown): value is Realm {
  return isObject(value) && ["production", "preview", "test"].includes(String(value.environment)) &&
    isId(value.namespaceId) && Object.keys(value).length === 2;
}
export function isActor(value: unknown): value is PrincipalActor {
  return isObject(value) && ["human", "service"].includes(String(value.kind)) && isId(value.id) && Object.keys(value).length === 2;
}
export function isResource(value: unknown): value is ResourceReference {
  return isObject(value) && ["site", "still", "artifact", "audit-export"].includes(String(value.kind)) && isId(value.id) && Object.keys(value).length === 2;
}
export function isResourceScope(value: unknown): value is ResourceScope {
  return isObject(value) && isResource(value.resource) && isRealm(value.realm) && isId(value.siteId) &&
    isId(value.accountId) && ["simulation", "hardware"].includes(String(value.executionMode));
}
export function time(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
/** Bounds dependencies even when an adapter ignores AbortSignal. No dependency failure grants access. */
export async function bounded<T>(timeoutMs: number, work: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(() => work(controller.signal)),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new AuthorizationError("DEPENDENCY_UNAVAILABLE"));
        }, timeoutMs);
      }),
    ]);
  } finally { clearTimeout(timer); controller.abort(); }
}
