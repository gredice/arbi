import { randomUUID } from "node:crypto";
import {
  AuthorizationError, bounded, isId, isResource, isResourceScope, sameRealm,
} from "./contracts.js";
import type {
  AuditAuthorization, AuthorizationObservation, AuthorizedContext, RequestPolicy, ResourceResolver,
} from "./contracts.js";
import { GrediceIdentityAdapter } from "./identity.js";
import { isCapability, isRead, permitsSurface } from "./policy.js";

export interface BoundaryConfig {
  identity: GrediceIdentityAdapter;
  resolveResource: ResourceResolver;
  auditAuthorization: AuditAuthorization;
  /** Exact server-configured browser origins. No wildcard or reflected request origin. */
  browserOrigins: readonly string[];
}
export interface SubscriptionGrant {
  realm: AuthorizedContext["realm"];
  siteId: string;
  actor: AuthorizedContext["actor"];
  sessionId: string;
  membershipRevision: string;
  channel: string;
  capability: "subscribe";
  expiresAtMs: number;
}

/** Fetch API middleware usable by the selected Next.js API. It owns no jobs or media implementation. */
export class SiteRequestBoundary {
  readonly #config: BoundaryConfig;
  readonly #origins: ReadonlySet<string>;
  readonly #grants = new WeakMap<SubscriptionGrant, RequestPolicy>();
  constructor(config: BoundaryConfig) {
    if (typeof config.resolveResource !== "function" || typeof config.auditAuthorization !== "function") {
      throw new AuthorizationError("INVALID_REQUEST");
    }
    for (const origin of config.browserOrigins) {
      const url = new URL(origin);
      if (url.origin !== origin || (url.protocol !== "https:" &&
        !(config.identity.realm.environment !== "production" && url.protocol === "http:" &&
          ["localhost", "127.0.0.1"].includes(url.hostname)))) throw new AuthorizationError("INVALID_REQUEST");
    }
    this.#config = { ...config };
    this.#origins = new Set(config.browserOrigins);
  }
  async #authorize(request: Request, policy: RequestPolicy): Promise<AuthorizedContext> {
    const { identity } = this.#config;
    const resource = policy.resource ?? { kind: "site", id: policy.siteId };
    const requiredKind = policy.capability === "still.read" ? "still" :
      policy.capability === "artifact.read" ? "artifact" : policy.capability === "audit.export" ? "audit-export" : "site";
    if (!isId(policy.siteId) || !isResource(resource) || !isCapability(policy.capability) ||
      !permitsSurface(policy.surface, policy.capability) ||
      (resource.kind === "site" && resource.id !== policy.siteId) ||
      resource.kind !== requiredKind ||
      (!["GET", "HEAD", "POST"].includes(request.method)) ||
      (!isRead(policy.capability) && request.method !== "POST")) throw new AuthorizationError("INVALID_REQUEST");
    // Only this dedicated bearer is supported. Ambient Gredice cookies cannot authorize a request.
    const authorization = request.headers.get("authorization");
    const token = authorization?.match(/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i)?.[1];
    if (!token) throw new AuthorizationError("INVALID_CREDENTIAL");
    const principal = await identity.authenticate(token);
    try {
      let scope: unknown;
      try {
        scope = await bounded(identity.dependencyTimeoutMs, (signal) => this.#config.resolveResource({
          siteId: policy.siteId, resource: { ...resource }, realm: { ...identity.realm }, signal,
        }));
      } catch { throw new AuthorizationError("DEPENDENCY_UNAVAILABLE"); }
      if (!isResourceScope(scope) || scope.siteId !== policy.siteId ||
        scope.resource.kind !== resource.kind || scope.resource.id !== resource.id || !sameRealm(scope.realm, identity.realm)) {
        throw new AuthorizationError("SCOPE_MISMATCH");
      }
      const context = await identity.authorizeIdentity(principal, policy.capability, scope);
      const origin = request.headers.get("origin");
      if (context.actor.kind === "human") {
        if ((origin !== null && !this.#origins.has(origin)) ||
          (request.method === "POST" && (!origin || !this.#origins.has(origin) ||
            request.headers.get("x-arbi-request") !== "1"))) throw new AuthorizationError("ORIGIN_DENIED");
      } else if (origin !== null) throw new AuthorizationError("ORIGIN_DENIED");
      return context;
    } catch (error) {
      throw new AuthorizationError(error instanceof AuthorizationError ? error.code : "DEPENDENCY_UNAVAILABLE",
        { actor: principal.actor, sessionId: principal.sessionId });
    }
  }
  /** Each invocation rechecks membership. Handler is unreachable on denial or missing audit acknowledgement. */
  async run(request: Request, policy: RequestPolicy,
    handler: (context: AuthorizedContext) => Promise<Response>): Promise<Response> {
    return this.#run(request, policy, handler);
  }
  async #run(request: Request, policy: RequestPolicy,
    handler: (context: AuthorizedContext) => Promise<Response>, previous?: SubscriptionGrant): Promise<Response> {
    policy = { ...policy, ...(policy.resource ? { resource: { ...policy.resource } } : {}) };
    const correlationId = randomUUID();
    let context: AuthorizedContext;
    try {
      context = await this.#authorize(request, policy);
      if (previous && (context.sessionId !== previous.sessionId || context.actor.kind !== previous.actor.kind ||
        context.actor.id !== previous.actor.id)) throw new AuthorizationError("SCOPE_MISMATCH", {
          actor: { kind: context.actor.kind as "human" | "service", id: context.actor.id }, sessionId: context.sessionId,
        });
    }
    catch (error) {
      const reason = error instanceof AuthorizationError ? error.code : "DEPENDENCY_UNAVAILABLE";
      // Unverified claims never become the actor in audit. Denied persistence failure cannot grant access.
      try { await this.#audit(correlationId, policy, null, reason,
        error instanceof AuthorizationError ? error.verifiedIdentity : undefined); } catch { /* best effort denial evidence */ }
      return failure(reason, correlationId);
    }
    try {
      if (await this.#audit(correlationId, policy, context, null) !== true) throw new AuthorizationError("AUDIT_UNAVAILABLE");
    } catch { return failure("AUDIT_UNAVAILABLE", correlationId); }
    if (context.expiresAtMs <= this.#config.identity.now()) {
      try { await this.#audit(correlationId, policy, context, "EXPIRED_SESSION"); } catch { /* best effort denial evidence */ }
      return failure("EXPIRED_SESSION", correlationId);
    }
    // Evidence above means authorization only. Handler/device outcomes have separate owners.
    const response = await handler(context);
    const headers = new Headers(response.headers);
    headers.set("cache-control", "private, no-store");
    headers.set("vary", [...new Set([...(headers.get("vary")?.split(",").map((v) => v.trim()) ?? []), "Authorization", "Origin"])].join(", "));
    headers.set("x-arbi-correlation-id", correlationId);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
  async #audit(correlationId: string, policy: RequestPolicy, context: AuthorizedContext | null,
    reason: AuthorizationObservation["reason"], verified?: AuthorizationError["verifiedIdentity"]): Promise<boolean> {
    const observation: AuthorizationObservation = {
      correlationId, observedAtMs: this.#config.identity.now(), realm: { ...this.#config.identity.realm },
      siteId: isId(policy.siteId) ? policy.siteId : null,
      actor: context?.actor.kind === "human" || context?.actor.kind === "service" ?
        { kind: context.actor.kind, id: context.actor.id } : verified?.actor ?? null,
      sessionId: context?.sessionId ?? verified?.sessionId ?? null, capability: isCapability(policy.capability) ? policy.capability : null,
      surface: ["http", "realtime", "media", "audit", "artifact"].includes(policy.surface) ? policy.surface : null,
      resource: context?.resource ?? (isResource(policy.resource) ? { ...policy.resource } : null),
      decision: reason ? "denied" : "authorized", reason, membershipRevision: context?.membershipRevision ?? null,
    };
    return bounded(this.#config.identity.dependencyTimeoutMs, (signal) => this.#config.auditAuthorization(observation, signal));
  }
  /** A local short-lived subscribe-only grant; #29 must bind it to revocable provider tokens. */
  async subscribe(request: Request, siteId: string,
    handler: (grant: SubscriptionGrant) => Promise<Response>): Promise<Response> {
    const policy: RequestPolicy = { siteId, surface: "realtime", capability: "state.read" };
    return this.#subscribe(request, policy, handler);
  }
  async #subscribe(request: Request, policy: RequestPolicy,
    handler: (grant: SubscriptionGrant) => Promise<Response>, previous?: SubscriptionGrant): Promise<Response> {
    return this.#run(request, policy, async (context) => {
      const grant = Object.freeze({ realm: context.realm, siteId: context.siteId, actor: context.actor,
        sessionId: context.sessionId, membershipRevision: context.membershipRevision,
        channel: `arbi:${context.realm.environment}:${encodeURIComponent(context.realm.namespaceId)}:${encodeURIComponent(context.siteId)}:state`,
        capability: "subscribe" as const, expiresAtMs: Math.min(context.expiresAtMs, this.#config.identity.now() + 30_000) });
      this.#grants.set(grant, policy);
      return handler(grant);
    }, previous);
  }
  /** Use at attach/resubscribe and before server-mediated delivery. A grant is never a credential. */
  async resubscribe(request: Request, previous: SubscriptionGrant,
    handler: (grant: SubscriptionGrant) => Promise<Response>): Promise<Response> {
    const policy = this.#grants.get(previous);
    if (!policy || previous.expiresAtMs <= this.#config.identity.now()) {
      const correlationId = randomUUID();
      try { await this.#audit(correlationId, policy ?? { siteId: previous?.siteId, surface: "realtime", capability: "state.read" },
        null, "EXPIRED_SESSION"); } catch { /* best effort denial evidence */ }
      return failure("EXPIRED_SESSION", correlationId);
    }
    return this.#subscribe(request, policy, handler, previous);
  }
}
function failure(reason: AuthorizationObservation["reason"], correlationId: string): Response {
  const status = ["UNPROVISIONED", "DEPENDENCY_UNAVAILABLE", "STALE_DIRECTORY", "AUDIT_UNAVAILABLE"].includes(reason ?? "") ? 503 :
    ["INVALID_CREDENTIAL", "EXPIRED_SESSION", "REVOKED_SESSION"].includes(reason ?? "") ? 401 : 403;
  return Response.json({ error: reason, correlationId }, { status,
    headers: { "cache-control": "private, no-store", "x-arbi-correlation-id": correlationId } });
}
