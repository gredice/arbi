import { decodeProtectedHeader, jwtVerify } from "jose";
import type { Realm } from "@arbi/protocol";
import {
  AuthorizationError, bounded, isActor, isId, isObject, isRealm, isResourceScope, sameRealm, time,
} from "./contracts.js";
import type { AuthorizationDirectory, AuthorizedContext, DirectorySnapshot, PrincipalActor, ResourceScope } from "./contracts.js";
import { isCapability, isRole, recordingDisabled, roleCapabilities, serviceCapabilities } from "./policy.js";
import type { Capability } from "./policy.js";

export interface GrediceIdentityConfig {
  realm: Realm;
  source: "gredice" | "isolated-fixture";
  issuer: string;
  /** Dedicated environment-specific ARBI audiences. General Gredice web tokens are incompatible. */
  audience: { human: string; service: string };
  /** Dedicated HS256 trust root, compatible with Gredice's committed signing primitive. No fallback key. */
  verificationKey: Uint8Array;
  readDirectory: AuthorizationDirectory;
  maxDirectoryAgeMs?: number;
  dependencyTimeoutMs?: number;
  now?: () => number;
}
export interface AuthenticatedIdentity {
  readonly actor: PrincipalActor;
  readonly sessionId: string;
  readonly accountId: string;
  readonly expiresAtMs: number;
}
export class GrediceIdentityAdapter {
  readonly realm: Readonly<Realm>;
  readonly maxDirectoryAgeMs: number;
  readonly dependencyTimeoutMs: number;
  readonly #config: GrediceIdentityConfig | undefined;
  readonly #now: () => number;
  readonly #identities = new WeakSet<AuthenticatedIdentity>();
  constructor(realm: Realm, config?: GrediceIdentityConfig) {
    if (!isRealm(realm)) throw new AuthorizationError("INVALID_REQUEST");
    this.realm = Object.freeze({ ...realm });
    this.maxDirectoryAgeMs = config?.maxDirectoryAgeMs ?? 5_000;
    this.dependencyTimeoutMs = config?.dependencyTimeoutMs ?? 2_000;
    this.#now = config?.now ?? Date.now;
    if (!Number.isInteger(this.maxDirectoryAgeMs) || this.maxDirectoryAgeMs < 1 || this.maxDirectoryAgeMs > 30_000 ||
      !Number.isInteger(this.dependencyTimeoutMs) || this.dependencyTimeoutMs < 1 || this.dependencyTimeoutMs > 5_000) {
      throw new AuthorizationError("INVALID_REQUEST");
    }
    if (config) {
      if (!sameRealm(realm, config.realm) || !["gredice", "isolated-fixture"].includes(config.source) ||
        (config.source === "isolated-fixture" && realm.environment === "production") ||
        !config.issuer || !config.audience.human || !config.audience.service ||
        config.audience.human === config.audience.service ||
        [config.audience.human, config.audience.service].includes("urn:gredice:audience:web") ||
        !(config.verificationKey instanceof Uint8Array) || config.verificationKey.length < 32 ||
        typeof config.readDirectory !== "function") throw new AuthorizationError("INVALID_REQUEST");
      this.#config = { ...config, realm: { ...realm }, audience: { ...config.audience },
        verificationKey: new Uint8Array(config.verificationKey) };
    }
  }
  now(): number {
    const value = this.#now();
    if (!time(value)) throw new AuthorizationError("DEPENDENCY_UNAVAILABLE");
    return value;
  }
  async authenticate(token: string): Promise<AuthenticatedIdentity> {
    const config = this.#config;
    if (!config) throw new AuthorizationError("UNPROVISIONED");
    try {
      if (typeof token !== "string" || token.length > 8_192) throw new Error();
      const header = decodeProtectedHeader(token);
      // No algorithm negotiation, remote key URL, embedded key, critical extension or purpose fallback.
      if (header.alg !== "HS256" || Object.keys(header).some((key) => !["alg", "typ"].includes(key)) ||
        (header.typ !== undefined && header.typ !== "arbi-identity+jwt")) throw new Error();
      const now = this.now();
      const { payload } = await jwtVerify(token, config.verificationKey, {
        algorithms: ["HS256"], issuer: config.issuer,
        audience: [config.audience.human, config.audience.service],
        requiredClaims: ["sub", "iat", "exp", "jti", "accountId", "realm", "tokenUse"],
        currentDate: new Date(now), clockTolerance: 0,
      });
      const kind = payload.tokenUse === "arbi_access" ? "human" :
        payload.tokenUse === "arbi_service" ? "service" : null;
      if (!kind || payload.aud !== config.audience[kind] || !isId(payload.sub) || !isId(payload.jti) ||
        !isId(payload.accountId) || !isRealm(payload.realm) || !sameRealm(payload.realm, this.realm) ||
        !time(payload.iat) || !time(payload.exp) || payload.iat * 1000 > now ||
        payload.exp <= payload.iat || payload.exp - payload.iat > 900 ||
        payload.exp * 1000 <= this.now() ||
        Object.keys(payload).some((key) => !["iss", "aud", "sub", "iat", "exp", "jti", "nbf", "accountId", "realm", "tokenUse"].includes(key))) {
        throw new Error();
      }
      const identity: AuthenticatedIdentity = Object.freeze({ actor: Object.freeze({ kind, id: payload.sub }),
        sessionId: payload.jti, accountId: payload.accountId, expiresAtMs: payload.exp * 1000 });
      this.#identities.add(identity);
      return identity;
    } catch {
      // Never log token, claims, keys or provider error messages.
      throw new AuthorizationError("INVALID_CREDENTIAL");
    }
  }
  async authorize(token: string, capability: Capability, scope: ResourceScope): Promise<AuthorizedContext> {
    return this.authorizeIdentity(await this.authenticate(token), capability, scope);
  }
  /** Only an object authenticated by this adapter is accepted; serialized/browser principals fail closed. */
  async authorizeIdentity(session: AuthenticatedIdentity, capability: Capability, scope: ResourceScope): Promise<AuthorizedContext> {
    if (!this.#identities.has(session)) throw new AuthorizationError("INVALID_CREDENTIAL");
    if (!isCapability(capability) || !isResourceScope(scope)) throw new AuthorizationError("INVALID_REQUEST");
    scope = { ...scope, realm: { ...scope.realm }, resource: { ...scope.resource } };
    if (!sameRealm(scope.realm, this.realm) || scope.accountId !== session.accountId ||
      (this.#config?.source === "isolated-fixture" && scope.executionMode !== "simulation")) {
      throw new AuthorizationError("SCOPE_MISMATCH");
    }
    let value: unknown;
    try {
      value = await bounded(this.dependencyTimeoutMs, (signal) => this.#config!.readDirectory({
        actor: { ...session.actor }, sessionId: session.sessionId, siteId: scope.siteId, realm: { ...this.realm }, signal,
      }));
    } catch { throw new AuthorizationError("DEPENDENCY_UNAVAILABLE"); }
    if (!isSnapshot(value)) throw new AuthorizationError("DEPENDENCY_UNAVAILABLE");
    const now = this.now();
    if (value.observedAtMs > now || now - value.observedAtMs >= this.maxDirectoryAgeMs) {
      throw new AuthorizationError("STALE_DIRECTORY");
    }
    const current = value.session;
    if (current.id !== session.sessionId || current.actor.kind !== session.actor.kind || current.actor.id !== session.actor.id ||
      !sameRealm(current.realm, this.realm) || value.site.id !== scope.siteId ||
      !sameRealm(value.site.realm, this.realm) || value.site.accountId !== session.accountId ||
      value.account.id !== session.accountId || value.site.executionMode !== scope.executionMode) {
      throw new AuthorizationError("SCOPE_MISMATCH");
    }
    if (current.revoked) throw new AuthorizationError("REVOKED_SESSION");
    if (Math.min(session.expiresAtMs, current.expiresAtMs) <= now) throw new AuthorizationError("EXPIRED_SESSION");
    if (!value.account.active || !value.account.member || !value.site.active || !value.membership.active) {
      throw new AuthorizationError("MEMBERSHIP_REQUIRED");
    }
    if (recordingDisabled(capability)) throw new AuthorizationError("RECORDING_DISABLED");
    const member = value.membership;
    const allowed = session.actor.kind === "human" ?
      member.serviceScopes.length === 0 && member.roles.some((role) => roleCapabilities[role].includes(capability)) :
      member.roles.length === 0 && serviceCapabilities.includes(capability) && member.serviceScopes.includes(capability);
    if (!allowed) throw new AuthorizationError("CAPABILITY_DENIED");
    return Object.freeze({ actor: Object.freeze({ ...session.actor }), sessionId: session.sessionId,
      realm: Object.freeze({ ...this.realm }), siteId: scope.siteId, accountId: scope.accountId,
      resource: Object.freeze({ ...scope.resource }), capability, membershipRevision: member.revision,
      expiresAtMs: Math.min(session.expiresAtMs, current.expiresAtMs, value.observedAtMs + this.maxDirectoryAgeMs) });
  }
}
function isSnapshot(value: unknown): value is DirectorySnapshot {
  if (!isObject(value) || !time(value.observedAtMs) || !isObject(value.session) || !isObject(value.account) ||
    !isObject(value.site) || !isObject(value.membership)) return false;
  const { session, account, site, membership } = value;
  return isId(session.id) && isActor(session.actor) && isRealm(session.realm) && time(session.expiresAtMs) &&
    typeof session.revoked === "boolean" && isId(account.id) && typeof account.active === "boolean" &&
    typeof account.member === "boolean" && isId(site.id) && isId(site.accountId) && isRealm(site.realm) &&
    typeof site.active === "boolean" && ["simulation", "hardware"].includes(String(site.executionMode)) &&
    typeof membership.active === "boolean" && isId(membership.revision) &&
    Array.isArray(membership.roles) && membership.roles.length <= 4 && membership.roles.every(isRole) &&
    Array.isArray(membership.serviceScopes) && membership.serviceScopes.length <= serviceCapabilities.length &&
    membership.serviceScopes.every((capability) => isCapability(capability) && serviceCapabilities.includes(capability));
}
