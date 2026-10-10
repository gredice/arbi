import { AuthorizationError, bounded, capabilities, isResourceScope, sameRealm, SiteRequestBoundary } from "@arbi/gredice";
import type { AuditAuthorization, GrediceIdentityAdapter, ResourceResolver } from "@arbi/gredice";
import { validateCommissioningStatus, validateMessage } from "@arbi/protocol";
import type { CommissioningStatus, Configuration } from "@arbi/protocol";
import { DASHBOARD_VERSION } from "./contracts";
import type { DashboardContext, DashboardSite, DashboardState } from "./contracts";

export interface DashboardServerConfig {
  identity: GrediceIdentityAdapter;
  resolveResource: ResourceResolver;
  auditAuthorization: AuditAuthorization;
  browserOrigins: readonly string[];
  /** Trusted, bounded site candidates; labels are returned only after current authorization. */
  sites: readonly DashboardSite[];
  readState: (siteId: string, signal: AbortSignal) => Promise<DashboardState>;
  readConfiguration: (siteId: string, signal: AbortSignal) => Promise<Configuration | null>;
  /** Protected authoritative edge projection. Missing/offline composition stays unavailable. */
  readCommissioning?: (siteId: string, signal: AbortSignal) => Promise<CommissioningStatus | null>;
}
export class DashboardServer {
  readonly boundary: SiteRequestBoundary;
  constructor(readonly config: DashboardServerConfig) {
    if (!config.sites.length || config.sites.length > 32 || new Set(config.sites.map(s => s.id)).size !== config.sites.length) throw new Error("INVALID_CONFIGURATION");
    this.boundary = new SiteRequestBoundary(config);
  }
  async handle(request: Request, siteId: string, view: string = "context"): Promise<Response> {
    if (request.method !== "GET" || !["context", "state", "diagnostics"].includes(view)) return Response.json({ error: "INVALID_REQUEST" }, { status: 403, headers: { "cache-control": "private, no-store" } });
    return this.boundary.run(request, { surface: "http", capability: view === "diagnostics" ? "diagnostics.read" : "state.read", siteId }, async authorized => {
      try {
        const token = request.headers.get("authorization")!.slice(7);
        const principal = await this.config.identity.authenticate(token);
        if (principal.actor.kind !== "human") throw new AuthorizationError("CAPABILITY_DENIED");
        const scope = await bounded(2000, signal => this.config.resolveResource({ realm: authorized.realm, siteId, resource: { kind: "site", id: siteId }, signal }));
        if (!isResourceScope(scope) || !sameRealm(scope.realm, authorized.realm) || scope.siteId !== siteId) throw new Error();
        const site = this.config.sites.find(s => s.id === siteId);
        if (!site) throw new Error();
        // Same shared policy used by HTTP actions; mode never participates in authorization.
        const allowed = (await Promise.all(capabilities.map(async capability => {
          try { await this.config.identity.authorizeIdentity(principal, capability, scope); return capability; }
          catch (error) {
            if (error instanceof AuthorizationError && ["CAPABILITY_DENIED", "RECORDING_DISABLED"].includes(error.code)) return null;
            throw error;
          }
        }))).filter(c => c !== null);
        const sites: DashboardSite[] = [];
        for (const candidate of this.config.sites) {
          const candidateScope = await bounded(2000, signal => this.config.resolveResource({ realm: authorized.realm, siteId: candidate.id, resource: { kind: "site", id: candidate.id }, signal }));
          if (!isResourceScope(candidateScope)) throw new Error();
          try { await this.config.identity.authorizeIdentity(principal, "state.read", candidateScope); sites.push(candidate); }
          catch (error) {
            if (!(error instanceof AuthorizationError) || !["MEMBERSHIP_REQUIRED", "CAPABILITY_DENIED", "SCOPE_MISMATCH"].includes(error.code)) throw error;
          }
        }
        const state = await bounded(2000, signal => this.config.readState(siteId, signal));
        for (const message of [state.snapshot, state.telemetry]) {
          if (message && (!validateMessage(message).ok || !sameRealm(message.realm, authorized.realm) || message.siteId !== siteId || message.executionMode !== scope.executionMode)) throw new Error();
        }
        if (!Number.isSafeInteger(state.observedAtMs) || state.observedAtMs < 0 || !Number.isSafeInteger(state.staleAfterMs) || state.staleAfterMs < 1 || state.staleAfterMs > 30_000 || !["connected", "offline", "no-device"].includes(state.connection) || (state.snapshot && (state.snapshot.kind !== "event" || state.snapshot.body.type !== "state.snapshot")) || (state.telemetry && state.telemetry.kind !== "telemetry")) throw new Error();
        if (state.telemetry) {
          const snapshot = state.snapshot;
          if (!snapshot || snapshot.body.type !== "state.snapshot" ||
            ["deviceId", "bootId", "sessionId"].some(key => snapshot.source[key as keyof typeof snapshot.source] !== state.telemetry!.source[key as keyof typeof snapshot.source]) ||
            snapshot.body.capabilitiesRevision !== state.telemetry.body.capabilitiesRevision) throw new Error();
        }
        const configuration = await bounded(2000, signal => this.config.readConfiguration(siteId, signal));
        if (configuration && (configuration.siteId !== siteId || !sameRealm(configuration.realm, authorized.realm) || configuration.executionMode !== scope.executionMode)) throw new Error();
        if (configuration && state.snapshot?.body.type === "state.snapshot" && state.snapshot.body.configRevision !== configuration.revision) throw new Error();
        let commissioning: CommissioningStatus | null = null;
        if (view === "diagnostics" && allowed.includes("configuration.read") && this.config.readCommissioning) {
          commissioning = await bounded(2000, signal => this.config.readCommissioning!(siteId, signal));
          if (commissioning && (!validateCommissioningStatus(commissioning) || commissioning.siteId !== siteId ||
            !sameRealm(commissioning.realm, authorized.realm) || commissioning.executionMode !== scope.executionMode)) throw new Error();
        }
        // Slow storage/assembly must not outlive the original grant or a revoked current session.
        await this.config.identity.authorizeIdentity(principal, view === "diagnostics" ? "diagnostics.read" : "state.read", scope);
        if (commissioning) await this.config.identity.authorizeIdentity(principal, "configuration.read", scope);
        if (authorized.expiresAtMs <= this.config.identity.now()) throw new AuthorizationError("EXPIRED_SESSION");
        const context: DashboardContext = { version: DASHBOARD_VERSION, realm: authorized.realm, executionMode: scope.executionMode, site, sites,
          identity: { actorId: authorized.actor.id, accountId: authorized.accountId, sessionId: authorized.sessionId, expiresAtMs: principal.expiresAtMs },
          capabilities: allowed, state, configuration: configuration ? { revision: configuration.revision, schemaVersion: configuration.schemaVersion } : null,
          ...(view === "diagnostics" ? { commissioning } : {}) };
        return Response.json(context);
      } catch (error) {
        const expired = error instanceof AuthorizationError && ["INVALID_CREDENTIAL", "REVOKED_SESSION", "EXPIRED_SESSION"].includes(error.code);
        const denied = error instanceof AuthorizationError && ["MEMBERSHIP_REQUIRED", "SCOPE_MISMATCH", "CAPABILITY_DENIED"].includes(error.code);
        return Response.json({ error: expired ? "EXPIRED_SESSION" : denied ? "FORBIDDEN" : "UNAVAILABLE" }, { status: expired ? 401 : denied ? 403 : 503 });
      }
    });
  }
}
