import assert from "node:assert/strict";
import test from "node:test";
import { SiteRequestBoundary } from "./boundary.js";
import type { SubscriptionGrant } from "./boundary.js";
import type { AuthorizationObservation, AuthorizedContext, RequestPolicy } from "./contracts.js";
import { GrediceIdentityAdapter } from "./identity.js";
import type { Role } from "./policy.js";
import { createIsolatedIdentityProvider } from "./testing.js";
import { profile, realm, scope } from "./test-support.js";

const origin = "https://preview.arbi.invalid";
function request(token: string, method = "GET", body?: unknown, headers: Record<string, string> = {}) {
  return new Request(`${origin}/api/sites/site-a`, { method,
    headers: { authorization: `Bearer ${token}`, origin, "x-arbi-request": "1", ...headers },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}), });
}
function setup(role: Role = "operator") {
  let nowMs = 2_000_000;
  const fixture = createIsolatedIdentityProvider(realm, () => nowMs);
  fixture.putSite("site-a", "account-a"); fixture.putSite("site-b", "account-b");
  for (const [kind, id] of [["still", "image-a"], ["artifact", "artifact-a"], ["audit-export", "export-a"]] as const) {
    fixture.putResource(kind, id, "site-a"); fixture.putResource(kind, `${id}-other-site`, "site-b");
  }
  const actor = { kind: "human" as const, id: "human-a" };
  const principal = { actor, accountId: "account-a", member: true,
    sites: { "site-a": { roles: [role], serviceScopes: [], active: true, revision: "membership-1" } } };
  fixture.putPrincipal(principal);
  const observations: AuthorizationObservation[] = [];
  let persist = true;
  const boundary = new SiteRequestBoundary({ identity: fixture.adapter, resolveResource: fixture.resolveResource,
    browserOrigins: [origin], auditAuthorization: async (event) => { observations.push(event); return persist; } });
  return { fixture, actor, principal, boundary, observations, advance: (ms: number) => { nowMs += ms; },
    failAudit: () => { persist = false; } };
}
const policies: RequestPolicy[] = [
  { siteId: "site-a", surface: "http", capability: "state.read" },
  { siteId: "site-a", surface: "http", capability: "history.read" },
  { siteId: "site-a", surface: "http", capability: "capture.request" },
  { siteId: "site-a", surface: "http", capability: "manipulation.request" },
  { siteId: "site-a", surface: "http", capability: "configuration.write" },
  { siteId: "site-a", surface: "http", capability: "update.request" },
  { siteId: "site-a", surface: "realtime", capability: "state.read" },
  { siteId: "site-a", surface: "media", capability: "live.view" },
  { siteId: "site-a", surface: "media", capability: "still.read", resource: { kind: "still", id: "image-a" } },
  { siteId: "site-a", surface: "audit", capability: "audit.read" },
  { siteId: "site-a", surface: "audit", capability: "audit.export", resource: { kind: "audit-export", id: "export-a" } },
  { siteId: "site-a", surface: "artifact", capability: "artifact.read", resource: { kind: "artifact", id: "artifact-a" } },
];
test("HTTP, realtime, media, audit and artifacts share fresh server authorization", async (t) => {
  for (const policy of policies) await t.test(`${policy.surface}: ${policy.capability}`, async () => {
    const s = setup(); s.principal.sites["site-a"].roles = ["operator", "engineer", "update-admin"];
    s.fixture.putPrincipal(s.principal);
    const { token, sessionId } = await s.fixture.issue(s.actor);
    let calls = 0;
    const handler = async (context: AuthorizedContext) => {
      calls++; assert.equal(context.actor.id, s.actor.id);
      assert.equal(context.sessionId, sessionId); assert.equal(context.siteId, "site-a");
      assert.equal(s.observations.at(-1)?.decision, "authorized");
      return Response.json({ ok: true }, { headers: { "cache-control": "public, max-age=600" } });
    };
    const good = await s.boundary.run(request(token, "POST"), policy, handler);
    assert.equal(good.status, 200); assert.equal(calls, 1);
    assert.equal(good.headers.get("cache-control"), "private, no-store");
    assert.match(good.headers.get("vary")!, /Authorization/);
    s.principal.member = false; s.fixture.putPrincipal(s.principal);
    assert.equal((await s.boundary.run(request(token, "POST"), policy, handler)).status, 403);
    s.principal.member = true; s.fixture.putPrincipal(s.principal); s.fixture.revoke(sessionId);
    assert.equal((await s.boundary.run(request(token, "POST"), policy, handler)).status, 401);
    assert.equal(calls, 1);
    assert.equal(s.observations.at(-1)?.decision, "denied");
    assert.deepEqual(s.observations.at(-1)?.actor, s.actor);
    assert.equal(s.observations.at(-1)?.sessionId, sessionId);
  });
});
test("browser site, mode, account and principal claims cannot grant authority", async () => {
  const s = setup("viewer"); const { token } = await s.fixture.issue(s.actor);
  let calls = 0;
  const handler = async () => { calls++; return Response.json({ ok: true }); };
  const spoofed = request(token, "POST", { siteId: "site-b", uiMode: "engineering", role: "update-admin",
    actor: { kind: "service", id: "admin" } }, { "x-account-id": "account-b", "x-site-id": "site-b" });
  assert.equal((await s.boundary.run(spoofed, { siteId: "site-a", surface: "http", capability: "manipulation.request" }, handler)).status, 403);
  const state = await s.boundary.run(request(token, "POST", { actor: { kind: "service", id: "admin" } }), policies[0], async (ctx) => {
    assert.deepEqual(ctx.actor, s.actor); assert.equal(ctx.accountId, "account-a"); return Response.json(ctx.actor);
  });
  assert.equal(state.status, 200); assert.equal(calls, 0);
  assert.equal((await s.boundary.run(request(token), { ...policies[0], siteId: "site-b" }, handler)).status, 403);
});
test("cross-site resource IDs, moved resources, missing resources and realm mismatch fail closed", async () => {
  const s = setup("update-admin"); const { token } = await s.fixture.issue(s.actor);
  const handler = async () => { assert.fail("foreign resource handler must be unreachable"); };
  for (const policy of policies.filter((value) => value.resource)) {
    const foreign = { ...policy, resource: { ...policy.resource!, id: `${policy.resource!.id}-other-site` } };
    assert.equal((await s.boundary.run(request(token, "POST"), foreign, handler)).status, 403);
    const missing = { ...policy, resource: { ...policy.resource!, id: "deleted-resource" } };
    assert.equal((await s.boundary.run(request(token, "POST"), missing, handler)).status, 403);
  }
  s.fixture.putResource("still", "image-a", "site-b");
  assert.equal((await s.boundary.run(request(token), policies[8], handler)).status, 403);
  const invalidRealm = new SiteRequestBoundary({ identity: s.fixture.adapter, browserOrigins: [origin],
    auditAuthorization: async () => true, resolveResource: async () => ({ ...scope, realm: { ...realm, namespaceId: "foreign" } }) });
  assert.equal((await invalidRealm.run(request(token), policies[0], handler)).status, 403);
});
test("realtime attach/resubscribe rechecks token, membership revision, roles and revocation", async () => {
  const s = setup(); const { token, sessionId } = await s.fixture.issue(s.actor);
  let grant: SubscriptionGrant | undefined;
  let calls = 0;
  const attach = async (value: SubscriptionGrant) => { calls++; grant = value; return Response.json(value); };
  assert.equal((await s.boundary.subscribe(request(token, "POST"), "site-a", attach)).status, 200);
  assert.equal(grant!.capability, "subscribe"); assert.equal(grant!.expiresAtMs, 2_005_000);
  assert.equal(grant!.channel, "arbi:test:fixture-suite:site-a:state");
  assert.equal(Object.isFrozen(grant), true);
  const previous = grant!;
  s.principal.sites["site-a"].revision = "membership-2";
  s.principal.sites["site-a"].roles = ["viewer"]; s.fixture.putPrincipal(s.principal);
  assert.equal((await s.boundary.resubscribe(request(token, "POST"), previous, attach)).status, 200);
  assert.equal(grant!.membershipRevision, "membership-2");
  s.principal.sites["site-a"].roles = []; s.fixture.putPrincipal(s.principal);
  assert.equal((await s.boundary.resubscribe(request(token, "POST"), previous, attach)).status, 403);
  s.principal.sites["site-a"].roles = ["viewer"]; s.fixture.putPrincipal(s.principal);
  s.fixture.revoke(sessionId);
  assert.equal((await s.boundary.resubscribe(request(token, "POST"), previous, attach)).status, 401);
  assert.equal(calls, 2);
});
test("expired or forged realtime grants and a different signed session cannot resume an old subscription", async () => {
  const s = setup(); const session = await s.fixture.issue(s.actor);
  let grant: SubscriptionGrant | undefined;
  await s.boundary.subscribe(request(session.token, "POST"), "site-a", async (value) => {
    grant = value; return Response.json(value);
  });
  const handler = async () => { assert.fail("stale grant must be denied"); };
  assert.equal((await s.boundary.resubscribe(request(session.token, "POST"), { ...grant! }, handler)).status, 401);
  const other = await s.fixture.issue(s.actor);
  assert.equal((await s.boundary.resubscribe(request(other.token, "POST"), grant!, handler)).status, 403);
  s.advance(5_000);
  assert.equal((await s.boundary.resubscribe(request(session.token, "POST"), grant!, handler)).status, 401);
});
test("bearer-only boundary enforces trusted browser origins and POST intent headers", async () => {
  const s = setup(); const { token } = await s.fixture.issue(s.actor);
  const deny = async () => { assert.fail("invalid browser request"); };
  assert.equal((await s.boundary.run(new Request(origin, { headers: { cookie: `gredice_session=${token}` } }), policies[0], deny)).status, 401);
  const policy = policies[2];
  for (const req of [
    request(token, "GET"), request(token, "POST", undefined, { origin: "https://attacker.invalid" }),
    request(token, "POST", undefined, { "x-arbi-request": "0" }),
    new Request(origin, { method: "POST", headers: { authorization: `Bearer ${token}`, "x-arbi-request": "1" } }),
  ]) assert.equal((await s.boundary.run(req, policy, deny)).status, 403);
  assert.equal((await s.boundary.run(request(token, "GET", undefined, { origin: "https://attacker.invalid" }), policies[0], deny)).status, 403);
});
test("service credentials have separate purpose, current scope and no browser authority", async () => {
  const s = setup();
  const actor = { kind: "service" as const, id: "capture-worker" };
  s.fixture.putPrincipal({ actor, accountId: "account-a", member: true,
    sites: { "site-a": { roles: [], serviceScopes: ["capture.request"], active: true, revision: "1" } } });
  const { token } = await s.fixture.issue(actor);
  const req = () => new Request(origin, { method: "POST", headers: { authorization: `Bearer ${token}` } });
  const allowed = await s.boundary.run(req(), policies[2], async (ctx) => { assert.deepEqual(ctx.actor, actor); return Response.json({ ok: true }); });
  assert.equal(allowed.status, 200);
  const deny = async () => { assert.fail("service escalation"); };
  assert.equal((await s.boundary.run(request(token, "POST"), policies[2], deny)).status, 403);
  assert.equal((await s.boundary.run(req(), policies[3], deny)).status, 403);
  assert.equal((await s.boundary.run(req(), policies[5], deny)).status, 403);
});
test("every future recording capability stays disabled in both UI modes", async () => {
  const s = setup("update-admin"); const { token } = await s.fixture.issue(s.actor);
  for (const capability of ["recording.create", "recording.read", "recording.export", "recording.delete"] as const) {
    const response = await s.boundary.run(request(token, "POST", { uiMode: "engineering" }),
      { siteId: "site-a", surface: "media", capability }, async () => { assert.fail("recording remains disabled"); });
    assert.equal(response.status, 403); assert.equal((await response.json()).error, "RECORDING_DISABLED");
  }
});
test("required audit acceptance is bounded and cannot be replaced by UI success", async () => {
  const s = setup(); const { token } = await s.fixture.issue(s.actor); s.failAudit();
  assert.equal((await s.boundary.run(request(token, "POST"), policies[2], async () => { assert.fail("audit failure must inhibit request"); })).status, 503);
  const p = profile(); const slow = new SiteRequestBoundary({ identity: p.adapter, resolveResource: async () => scope,
    browserOrigins: [origin], auditAuthorization: async () => new Promise(() => {}) });
  assert.equal((await slow.run(request(await p.token(), "POST"), policies[2], async () => { assert.fail("audit timeout"); })).status, 503);
  assert.equal(s.observations[0].decision, "authorized"); // permission is evidence, not action execution
  assert.equal(Object.hasOwn(s.observations[0], "token"), false);
  const malformed = new SiteRequestBoundary({ identity: p.adapter, resolveResource: async () => scope,
    browserOrigins: [origin], auditAuthorization: async () => "yes" as never });
  assert.equal((await malformed.run(request(await p.token()), policies[0], async () => { assert.fail("truthy audit reply is insufficient"); })).status, 503);
});
test("dependency delay cannot extend a session or stale authorization", async () => {
  const p = profile(); const token = await p.token();
  const boundary = new SiteRequestBoundary({ identity: p.adapter, browserOrigins: [origin], resolveResource: async () => scope,
    auditAuthorization: async () => { p.advance(5_000); return true; } });
  assert.equal((await boundary.run(request(token, "POST"), policies[2], async () => { assert.fail("expired authorization"); })).status, 401);
});
test("unauthenticated requests cannot probe resource existence", async () => {
  const s = setup(); let lookups = 0;
  const guard = new SiteRequestBoundary({ identity: s.fixture.adapter, browserOrigins: [origin], auditAuthorization: async () => true,
    resolveResource: async () => { lookups++; return scope; } });
  assert.equal((await guard.run(request("bad.bad.bad"), policies[0], async () => { assert.fail("invalid token"); })).status, 401);
  assert.equal(lookups, 0);
});
test("surface mismatches and unknown resource/capability input fail before handlers", async () => {
  const s = setup("update-admin"); const { token } = await s.fixture.issue(s.actor);
  const deny = async () => { assert.fail("invalid descriptor"); };
  const invalid: RequestPolicy[] = [
    { ...policies[0], capability: "invented" as never }, { ...policies[0], surface: "media" },
    { ...policies[8], resource: undefined }, { ...policies[11], resource: { kind: "site", id: "site-a" } },
    { ...policies[10], resource: undefined }, { ...policies[0], siteId: "../site-b" },
    { ...policies[8], resource: { kind: "still", id: "image-a", secret: "synthetic-redaction-canary" } as never },
  ];
  for (const policy of invalid) assert.equal((await s.boundary.run(request(token, "POST"), policy, deny)).status, 403);
});
