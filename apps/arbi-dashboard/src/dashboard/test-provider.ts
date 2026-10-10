import { randomUUID, timingSafeEqual } from "node:crypto";
import { SignJWT } from "jose";
import { createGrediceAuthorizationDirectory, GrediceIdentityAdapter, sameRealm } from "@arbi/gredice";
import type { DirectorySnapshot } from "@arbi/gredice";
import type { SqlDatabase } from "../enrollment/store";
import { PostgresRegistryStore } from "../enrollment/store";
import { DashboardServer } from "./server";
import { createSimulatorRead, simulationSites, syntheticConfiguration } from "./simulator";
import { configuredCatalog } from "../releases/catalog";

export interface TestProviderConfig {
  realm: { environment: "test"; namespaceId: string };
  verificationKey: Uint8Array;
  accessCode: string;
  viewerCode?: string;
  browserOrigins: readonly string[];
  db: SqlDatabase;
  now?: () => number;
}
/** Explicit isolated test composition, never an automatic fallback or a live Gredice issuer. */
export function createDashboardTestProvider(config: TestProviderConfig) {
  if (config.realm.environment !== "test" || config.accessCode.length < 32 || config.verificationKey.length < 32 ||
    (config.viewerCode && (config.viewerCode.length < 32 || config.viewerCode === config.accessCode))) throw new Error("INVALID_CONFIGURATION");
  const now = config.now ?? Date.now;
  const realm = config.realm;
  const issuer = `urn:arbi:dashboard-test:${realm.namespaceId}`;
  const audiences = { human: `${issuer}:human`, service: `${issuer}:service` };
  const identity = new GrediceIdentityAdapter(realm, { realm, source: "isolated-fixture", issuer, audience: audiences,
    verificationKey: config.verificationKey, now,
    readDirectory: createGrediceAuthorizationDirectory(async query => config.db.transaction(async sql => {
      const result = await sql.query<{ id: string; actor_id: string; account_id: string; expires_at_ms: string; revoked: boolean;
        site_id: string; roles: DirectorySnapshot["membership"]["roles"]; active: boolean; revision: string }>(
        `SELECT s.*, t.site_id, m.roles, m.active, m.revision FROM arbi_dashboard_sessions s
         JOIN arbi_dashboard_sites t ON t.namespace_id=s.namespace_id AND t.account_id=s.account_id
         JOIN arbi_dashboard_memberships m ON m.namespace_id=t.namespace_id AND m.site_id=t.site_id AND m.actor_id=s.actor_id
         WHERE s.namespace_id=$1 AND s.id=$2 AND s.actor_id=$3 AND t.site_id=$4`,
        [realm.namespaceId, query.sessionId, query.actor.id, query.siteId]);
      const row = result.rows[0];
      if (!row || query.actor.kind !== "human" || !sameRealm(query.realm, realm)) return null;
      return { observedAtMs: now(), human: { id: row.actor_id, accountIds: [row.account_id], isTemporary: false }, service: null,
        session: { id: row.id, actor: { kind: "human", id: row.actor_id }, realm, expiresAtMs: Number(row.expires_at_ms), revoked: row.revoked },
        account: { id: row.account_id, active: true }, site: { id: row.site_id, accountId: row.account_id, realm, active: true, executionMode: "simulation" },
        membership: { active: row.active, revision: row.revision, roles: row.roles, serviceScopes: [] } };
    })),
  });
  const registry = new PostgresRegistryStore(config.db);
  const server = new DashboardServer({ identity, browserOrigins: config.browserOrigins, sites: simulationSites,
    auditAuthorization: (record, signal) => registry.authorization(record, signal),
    resolveResource: async query => config.db.transaction(async sql => {
      const row = (await sql.query<{ account_id: string }>("SELECT account_id FROM arbi_dashboard_sites WHERE namespace_id=$1 AND site_id=$2", [realm.namespaceId, query.siteId])).rows[0];
      return row && query.resource.kind === "site" && query.resource.id === query.siteId && sameRealm(query.realm, realm) ?
        { realm, siteId: query.siteId, accountId: row.account_id, executionMode: "simulation", resource: query.resource } : null;
    }), readState: createSimulatorRead(realm, now), readConfiguration: async siteId => syntheticConfiguration(realm, siteId), readReleases: configuredCatalog });
  const equal = (value: string, expected: string) => {
    const a = Buffer.from(value), b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  };
  return { server, async login(code: string) {
    const actorId = equal(code, config.accessCode) ? "synthetic-engineer" : config.viewerCode && equal(code, config.viewerCode) ? "synthetic-viewer" : null;
    if (!actorId) return null;
    const id = randomUUID(), issuedAt = Math.floor(now() / 1000), expiresAtMs = (issuedAt + 300) * 1000;
    // Fixed server profiles. No form/body actor, role, account, site or capability is accepted.
    await config.db.transaction(async sql => {
      await sql.query("DELETE FROM arbi_dashboard_sessions WHERE namespace_id=$1 AND expires_at_ms<$2", [realm.namespaceId, now()]);
      await sql.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`dashboard-session:${realm.namespaceId}`]);
      const count = (await sql.query<{ count: string }>("SELECT COUNT(*) FROM arbi_dashboard_sessions WHERE namespace_id=$1", [realm.namespaceId])).rows[0];
      if (Number(count?.count) >= 1000) throw new Error("CAPACITY");
      await sql.query("INSERT INTO arbi_dashboard_sessions (namespace_id,id,actor_id,account_id,expires_at_ms) VALUES ($1,$2,$3,$4,$5)", [realm.namespaceId, id, actorId, "synthetic-account", expiresAtMs]);
    });
    const token = await new SignJWT({ tokenUse: "arbi_access", realm, accountId: "synthetic-account" }).setProtectedHeader({ alg: "HS256", typ: "arbi-identity+jwt" })
      .setIssuer(issuer).setAudience(audiences.human).setSubject(actorId).setJti(id).setIssuedAt(issuedAt).setExpirationTime(issuedAt + 300).sign(config.verificationKey);
    // Login is a protected resource boundary too. Required audit must commit before a cookie is issued.
    const response = await server.handle(new Request(`${config.browserOrigins[0]}/api/sites/synthetic-site/dashboard/context`, { headers: { authorization: `Bearer ${token}` } }), "synthetic-site");
    if (!response.ok) { await revoke(token); throw new Error("UNAVAILABLE"); }
    return token;
  }, revoke };
  async function revoke(token: string) {
    const principal = await identity.authenticate(token);
    await config.db.transaction(async sql => {
      await sql.query("UPDATE arbi_dashboard_sessions SET revoked=true WHERE namespace_id=$1 AND id=$2", [realm.namespaceId, principal.sessionId]);
    });
  }
}
