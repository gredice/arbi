import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { AuthorizationError } from "./contracts.js";
import { GrediceIdentityAdapter } from "./identity.js";
import { createGrediceAuthorizationDirectory } from "./directory.js";
import { capabilities, roles } from "./policy.js";
import type { Capability } from "./policy.js";
import { createIsolatedIdentityProvider } from "./testing.js";
import { profile, realm, scope } from "./test-support.js";

const denial = (code: string) => (error: unknown) => error instanceof AuthorizationError && error.code === code;
const matrix = JSON.parse(await readFile(new URL("../fixtures/authorization-matrix.json", import.meta.url), "utf8")) as Record<string, string[]>;

test("executable human matrix covers each role and capability independently", async (t) => {
  for (const role of roles) {
    for (const capability of capabilities) await t.test(`${role}: ${capability}`, async () => {
      const p = profile(); p.snapshot().membership.roles = [role];
      const operation = p.adapter.authorize(await p.token(), capability, scope);
      if (matrix[role].includes(capability)) {
        const context = await operation;
        assert.equal(context.capability, capability);
        assert.equal(context.actor.id, "human-a");
        assert.equal(context.expiresAtMs, 2_005_000);
      } else await assert.rejects(operation, denial(matrix.disabled.includes(capability) ? "RECORDING_DISABLED" : "CAPABILITY_DENIED"));
    });
  }
});
test("role combinations are explicit and services never inherit human roles", async () => {
  const p = profile(); const token = await p.token();
  p.snapshot().membership.roles = ["operator", "engineer"];
  await p.adapter.authorize(token, "manipulation.request", scope);
  await p.adapter.authorize(token, "configuration.write", scope);
  await assert.rejects(p.adapter.authorize(token, "update.request", scope), denial("CAPABILITY_DENIED"));
  p.snapshot().session.actor.kind = "service";
  const service = await p.token({ tokenUse: "arbi_service", aud: p.config.audience.service });
  await assert.rejects(p.adapter.authorize(service, "capture.request", scope), denial("CAPABILITY_DENIED"));
  p.snapshot().membership.roles = [];
  p.snapshot().membership.serviceScopes = matrix.service as Capability[];
  for (const capability of capabilities) {
    const operation = p.adapter.authorize(service, capability, scope);
    if (matrix.service.includes(capability)) await operation;
    else await assert.rejects(operation, denial(matrix.disabled.includes(capability) ? "RECORDING_DISABLED" : "CAPABILITY_DENIED"));
  }
  p.snapshot().membership.serviceScopes = ["state.read"];
  await assert.rejects(p.adapter.authorize(service, "capture.request", scope), denial("CAPABILITY_DENIED"));
});
test("signature, fixed algorithm, issuer, audience, purpose and claims fail closed", async (t) => {
  const claims: Record<string, unknown>[] = [
    { iss: "untrusted" }, { aud: "urn:gredice:audience:web" }, { aud: ["wrong", "urn:gredice:audience:arbi:test:human"] },
    { tokenUse: "access" }, { tokenUse: "oauth_state" }, { tokenUse: "account_delete" },
    { tokenUse: "arbi_service" }, { sub: "" }, { sub: "victim" }, { jti: "" }, { accountId: "other-account" },
    { exp: undefined }, { iat: undefined }, { jti: undefined }, { realm: undefined },
    { iat: 2_001 }, { exp: 2_000 }, { exp: 2_901 }, { exp: 2_300.5 },
    { realm: { ...realm, environment: "production" } }, { realm: { ...realm, namespaceId: "other-preview" } },
    { role: "update-admin" }, { accountIds: ["account-a"] }, { actor: { kind: "service", id: "spoofed" } },
  ];
  for (const [i, patch] of claims.entries()) await t.test(`invalid claims ${i}`, async () => {
    const p = profile();
    await assert.rejects(p.adapter.authorize(await p.token(patch), "state.read", scope),
      denial(i === 8 || i === 10 ? "SCOPE_MISMATCH" : "INVALID_CREDENTIAL"));
  });
  for (const patch of [{ alg: "HS384" }, { typ: "JWT" }, { jku: "https://attacker.invalid/keys" }, { kid: "unknown" }]) {
    const p = profile();
    await assert.rejects(p.adapter.authorize(await p.token({}, patch), "state.read", scope), denial("INVALID_CREDENTIAL"));
  }
  const p = profile();
  await assert.rejects(p.adapter.authorize(await p.token({}, {}, true), "state.read", scope), denial("INVALID_CREDENTIAL"));
  const good = await p.token();
  await assert.rejects(p.adapter.authorize(`${good.slice(0, -8)}badbytes`, "state.read", scope), denial("INVALID_CREDENTIAL"));
  await assert.rejects(p.adapter.authorize("x".repeat(8_193), "state.read", scope), denial("INVALID_CREDENTIAL"));
});
test("every call reads current revocation, membership and account state", async (t) => {
  const mutations = [
    { change: (p: ReturnType<typeof profile>) => { p.snapshot().session.revoked = true; }, code: "REVOKED_SESSION" },
    { change: (p: ReturnType<typeof profile>) => { p.snapshot().session.expiresAtMs = p.now(); }, code: "EXPIRED_SESSION" },
    { change: (p: ReturnType<typeof profile>) => { p.snapshot().account.member = false; }, code: "MEMBERSHIP_REQUIRED" },
    { change: (p: ReturnType<typeof profile>) => { p.snapshot().account.active = false; }, code: "MEMBERSHIP_REQUIRED" },
    { change: (p: ReturnType<typeof profile>) => { p.snapshot().site.active = false; }, code: "MEMBERSHIP_REQUIRED" },
    { change: (p: ReturnType<typeof profile>) => { p.snapshot().membership.active = false; }, code: "MEMBERSHIP_REQUIRED" },
    { change: (p: ReturnType<typeof profile>) => { p.snapshot().membership.roles = ["viewer"]; }, code: "CAPABILITY_DENIED" },
    { change: (p: ReturnType<typeof profile>) => { p.snapshot().site.id = "site-b"; }, code: "SCOPE_MISMATCH" },
    { change: (p: ReturnType<typeof profile>) => { p.snapshot().site.accountId = "account-b"; }, code: "SCOPE_MISMATCH" },
    { change: (p: ReturnType<typeof profile>) => { p.snapshot().session.actor.id = "victim"; }, code: "SCOPE_MISMATCH" },
    { change: (p: ReturnType<typeof profile>) => { p.snapshot().session.realm.environment = "production"; }, code: "SCOPE_MISMATCH" },
    { change: (p: ReturnType<typeof profile>) => { p.snapshot().membership.roles = ["superuser" as never]; }, code: "DEPENDENCY_UNAVAILABLE" },
    { change: (p: ReturnType<typeof profile>) => { p.replace(null); }, code: "DEPENDENCY_UNAVAILABLE" },
  ];
  for (const { change, code } of mutations) await t.test(code, async () => {
    const p = profile(); const token = await p.token();
    await p.adapter.authorize(token, "capture.request", scope); change(p);
    await assert.rejects(p.adapter.authorize(token, "capture.request", scope), denial(code));
    assert.equal(p.reads, 2);
  });
});
test("freshness uses original observation time and bounds provider outages", async () => {
  const p = profile(); const token = await p.token();
  p.advance(5_000);
  await assert.rejects(p.adapter.authorize(token, "state.read", scope), denial("STALE_DIRECTORY"));
  p.snapshot().observedAtMs = p.now() + 1;
  await assert.rejects(p.adapter.authorize(token, "state.read", scope), denial("STALE_DIRECTORY"));
  const slow = new GrediceIdentityAdapter(realm, { ...p.config, readDirectory: async () => new Promise(() => {}) });
  await assert.rejects(slow.authorize(token, "state.read", scope), denial("DEPENDENCY_UNAVAILABLE"));
  p.advance(300_000);
  await assert.rejects(p.adapter.authorize(token, "state.read", scope), denial("INVALID_CREDENTIAL"));
});
test("unprovisioned deployment and isolated provider cannot grant production or hardware authority", async () => {
  const production = { environment: "production" as const, namespaceId: "isolated-production" };
  await assert.rejects(new GrediceIdentityAdapter(production).authorize("any", "state.read", { ...scope, realm: production }), denial("UNPROVISIONED"));
  assert.throws(() => createIsolatedIdentityProvider(production), denial("INVALID_REQUEST"));
  const p = profile();
  assert.throws(() => new GrediceIdentityAdapter(production, { ...p.config, realm: production, source: "isolated-fixture" }), denial("INVALID_REQUEST"));
  assert.throws(() => new GrediceIdentityAdapter(realm, { ...p.config, verificationKey: new Uint8Array(16) }), denial("INVALID_REQUEST"));
  assert.throws(() => new GrediceIdentityAdapter(realm, { ...p.config, maxDirectoryAgeMs: 30_001 }), denial("INVALID_REQUEST"));
  const fixture = createIsolatedIdentityProvider(realm, () => 2_000_000);
  fixture.putSite("site-a", "account-a");
  fixture.putPrincipal({ actor: { kind: "human", id: "human-a" }, accountId: "account-a", member: true,
    sites: { "site-a": { roles: ["operator"], serviceScopes: [], active: true, revision: "1" } } });
  const { token } = await fixture.issue({ kind: "human", id: "human-a" });
  await assert.rejects(fixture.adapter.authorize(token, "capture.request", { ...scope, executionMode: "hardware" }), denial("SCOPE_MISMATCH"));
  await assert.rejects(p.adapter.authorize(token, "state.read", scope), denial("INVALID_CREDENTIAL"));
  await assert.rejects(fixture.adapter.authorize(await p.token(), "state.read", scope), denial("INVALID_CREDENTIAL"));
});
test("Gredice account adapter derives membership from current account IDs and excludes temporary users", async () => {
  const p = profile();
  const user = { id: "human-a", accountIds: ["account-a"], isTemporary: false, role: "admin" };
  const readDirectory = createGrediceAuthorizationDirectory(async () => ({ ...p.snapshot(),
    human: user, service: null }));
  const adapter = new GrediceIdentityAdapter(realm, { ...p.config, readDirectory });
  const token = await p.token();
  await adapter.authorize(token, "capture.request", scope);
  // Global Gredice admin is not an ARBI update-admin.
  await assert.rejects(adapter.authorize(token, "update.request", scope), denial("CAPABILITY_DENIED"));
  user.accountIds = ["account-b"];
  await assert.rejects(adapter.authorize(token, "state.read", scope), denial("MEMBERSHIP_REQUIRED"));
  user.accountIds = ["account-a"]; user.isTemporary = true;
  await assert.rejects(adapter.authorize(token, "state.read", scope), denial("MEMBERSHIP_REQUIRED"));
  user.isTemporary = false; user.id = "victim";
  await assert.rejects(adapter.authorize(token, "state.read", scope), denial("DEPENDENCY_UNAVAILABLE"));
});
test("Gredice service registry membership and identity objects cannot impersonate humans", async () => {
  const p = profile(); p.snapshot().session.actor.kind = "service";
  p.snapshot().membership.roles = []; p.snapshot().membership.serviceScopes = ["capture.request"];
  const service = { id: "human-a", accountIds: ["account-a"], active: true };
  const adapter = new GrediceIdentityAdapter(realm, { ...p.config,
    readDirectory: createGrediceAuthorizationDirectory(async () => ({ ...p.snapshot(), human: null, service })) });
  const token = await p.token({ tokenUse: "arbi_service", aud: p.config.audience.service });
  await adapter.authorize(token, "capture.request", scope);
  service.active = false;
  await assert.rejects(adapter.authorize(token, "capture.request", scope), denial("MEMBERSHIP_REQUIRED"));
  const authenticated = await p.adapter.authenticate(await p.token());
  await assert.rejects(p.adapter.authorizeIdentity({ ...authenticated }, "state.read", scope), denial("INVALID_CREDENTIAL"));
  await assert.rejects(adapter.authorizeIdentity(authenticated, "state.read", scope), denial("INVALID_CREDENTIAL"));
});
