import { randomBytes, randomUUID } from "node:crypto";
import { SignJWT } from "jose";
import type { Realm } from "@arbi/protocol";
import { AuthorizationError, isRealm } from "./contracts.js";
import type { AuthorizationDirectory, DirectorySnapshot, PrincipalActor, ResourceResolver, ResourceScope } from "./contracts.js";
import { GrediceIdentityAdapter } from "./identity.js";
import type { Capability, Role } from "./policy.js";

interface FixturePrincipal {
  actor: PrincipalActor;
  accountId: string;
  member: boolean;
  sites: Record<string, { roles: Role[]; serviceScopes: Capability[]; active: boolean; revision: string }>;
}
/** Ephemeral secret-free test setup. It has no HTTP mint endpoint, device credentials or hardware mapping. */
export function createIsolatedIdentityProvider(realm: Realm, now: () => number = Date.now) {
  if (!isRealm(realm) || realm.environment === "production") throw new AuthorizationError("INVALID_REQUEST");
  const fixtureRealm = Object.freeze({ ...realm });
  const key = randomBytes(32); // Generated in memory; never returned, serialized or persisted.
  const issuer = `urn:arbi:fixture:${fixtureRealm.environment}:${fixtureRealm.namespaceId}`;
  const audience = { human: `${issuer}:human`, service: `${issuer}:service` };
  const principals = new Map<string, FixturePrincipal>();
  const sessions = new Map<string, DirectorySnapshot["session"]>();
  const sites = new Map<string, DirectorySnapshot["site"]>();
  const resources = new Map<string, ResourceScope>();
  const principalKey = (actor: PrincipalActor) => `${actor.kind}:${actor.id}`;
  const readDirectory: AuthorizationDirectory = async ({ actor, sessionId, siteId }) => {
    const principal = principals.get(principalKey(actor));
    const session = sessions.get(sessionId);
    const site = sites.get(siteId);
    const membership = principal?.sites[siteId];
    if (!principal || !session || !site || !membership) return null;
    return structuredClone({ observedAtMs: now(), session, site,
      account: { id: principal.accountId, active: true, member: principal.member }, membership });
  };
  const adapter = new GrediceIdentityAdapter(fixtureRealm, { realm: fixtureRealm, source: "isolated-fixture", issuer,
    audience, verificationKey: key, readDirectory, now });
  const resolveResource: ResourceResolver = async ({ resource }) =>
    structuredClone(resources.get(`${resource.kind}:${resource.id}`) ?? null);
  return {
    adapter, readDirectory, resolveResource,
    putSite(id: string, accountId: string) {
      sites.set(id, { id, accountId, realm: fixtureRealm, active: true, executionMode: "simulation" });
      resources.set(`site:${id}`, { resource: { kind: "site", id }, realm: fixtureRealm,
        siteId: id, accountId, executionMode: "simulation" });
    },
    putResource(kind: "still" | "artifact" | "audit-export", id: string, siteId: string) {
      const site = sites.get(siteId);
      if (!site) throw new AuthorizationError("SCOPE_MISMATCH");
      resources.set(`${kind}:${id}`, { resource: { kind, id }, realm: fixtureRealm,
        siteId, accountId: site.accountId, executionMode: "simulation" });
    },
    putPrincipal(value: FixturePrincipal) { principals.set(principalKey(value.actor), structuredClone(value)); },
    async issue(actor: PrincipalActor, lifetimeSeconds = 300) {
      const principal = principals.get(principalKey(actor));
      if (!principal || !Number.isInteger(lifetimeSeconds) || lifetimeSeconds < 1 || lifetimeSeconds > 900) {
        throw new AuthorizationError("INVALID_REQUEST");
      }
      const id = randomUUID();
      const issuedAt = Math.floor(now() / 1000);
      sessions.set(id, { id, actor: { ...actor }, realm: fixtureRealm,
        expiresAtMs: (issuedAt + lifetimeSeconds) * 1000, revoked: false });
      const token = await new SignJWT({ tokenUse: actor.kind === "human" ? "arbi_access" : "arbi_service",
        realm: fixtureRealm, accountId: principal.accountId }).setProtectedHeader({ alg: "HS256", typ: "arbi-identity+jwt" })
        .setIssuer(issuer).setAudience(audience[actor.kind]).setSubject(actor.id).setJti(id)
        .setIssuedAt(issuedAt).setExpirationTime(issuedAt + lifetimeSeconds).sign(key);
      return { token, sessionId: id };
    },
    revoke(sessionId: string) {
      const session = sessions.get(sessionId);
      if (session) session.revoked = true;
    },
  };
}
