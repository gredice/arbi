import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { createDashboardTestProvider } from "./test-provider";
import { provisionDashboardTest } from "./provision-test";
import { DashboardServer } from "./server";
import { displayedSample, freshness } from "./contracts";
import type { SqlDatabase } from "../enrollment/store";
import type { DashboardContext } from "./contracts";
import type { CommissioningStatus } from "@arbi/protocol";

async function fixture() {
  const pg = await PGlite.create(); let clock = Date.now();
  const db: SqlDatabase = { transaction: work => pg.transaction(tx => work({ query: async <T extends Record<string, unknown>>(sql: string, parameters?: unknown[]) => {
    if (!parameters) { await tx.exec(sql); return { rows: [] as T[] }; }
    const result = await tx.query<T>(sql, parameters); return { rows: result.rows };
  } })) };
  const realm = { environment: "test" as const, namespaceId: "synthetic-dashboard" };
  await provisionDashboardTest(db, realm);
  const provider = createDashboardTestProvider({ realm, verificationKey: randomBytes(32), accessCode: "s".repeat(48), viewerCode: "v".repeat(48), browserOrigins: ["http://localhost:3000"], db, now: () => clock });
  const token = (await provider.login("s".repeat(48)))!;
  const request = (site = "synthetic-site", credential = token, headers = {}) => new Request(`http://localhost:3000/api/sites/${site}/dashboard/context`, { headers: { authorization: `Bearer ${credential}`, ...headers } });
  return { pg, db, provider, token, request, advance: (ms: number) => { clock += ms; } };
}
test("signed identity, current site capabilities and bounded module data are protected and uncached", async () => {
  const f = await fixture();
  try {
    const response = await f.provider.server.handle(f.request(), "synthetic-site"); assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    const body = await response.json() as DashboardContext;
    assert.equal(body.identity.actorId, "synthetic-engineer"); assert.equal(body.executionMode, "simulation");
    assert.ok(body.capabilities.includes("diagnostics.read")); assert.ok(!body.capabilities.includes("manipulation.request"));
    assert.equal(body.state.snapshot?.body.type, "state.snapshot");
    assert.ok(body.state.telemetry?.body.samples.every(sample => sample.quality !== "measured"));
    assert.equal(body.state.telemetry?.body.samples.find(s => s.metric === "line.tension.a")?.value, null);
    assert.ok(!JSON.stringify(body).includes(f.token));
    const records = await f.pg.query<{ count: string }>("SELECT COUNT(*) FROM arbi_audit_history"); assert.ok(Number(records.rows[0].count) >= 2);
  } finally { await f.pg.close(); }
});
test("current membership, diagnostics permission, expired and revoked sessions deny direct reads", async () => {
  const f = await fixture();
  try {
    const viewer = (await f.provider.login("v".repeat(48)))!;
    assert.equal((await f.provider.server.handle(f.request("synthetic-offline", viewer), "synthetic-offline")).status, 403);
    assert.equal((await f.provider.server.handle(f.request("synthetic-site", viewer, { "x-arbi-role": "engineer" }), "synthetic-site", "diagnostics")).status, 403);
    await f.pg.query("UPDATE arbi_dashboard_memberships SET active=false,revision='membership-2' WHERE actor_id='synthetic-engineer'");
    assert.equal((await f.provider.server.handle(f.request(), "synthetic-site")).status, 403);
    await f.provider.revoke(viewer);
    assert.equal((await f.provider.server.handle(f.request("synthetic-site", viewer), "synthetic-site")).status, 401);
    f.advance(300_000);
    assert.equal((await f.provider.server.handle(f.request(), "synthetic-site")).status, 401);
    assert.equal((await f.provider.server.handle(new Request("http://localhost/"), "synthetic-site")).status, 401);
  } finally { await f.pg.close(); }
});
test("resource/realm mismatches, unaudited reads and mismatched state never reach the browser", async () => {
  const f = await fixture();
  try {
    let reads = 0;
    for (const change of [
      { resolveResource: async () => ({ realm: { environment: "production", namespaceId: "other" }, siteId: "synthetic-site", accountId: "synthetic-account", resource: { kind: "site", id: "synthetic-site" }, executionMode: "hardware" }) },
      { resolveResource: async () => ({ realm: f.provider.server.config.identity.realm, siteId: "other-site", accountId: "synthetic-account", resource: { kind: "site", id: "synthetic-site" }, executionMode: "simulation" }) },
      { auditAuthorization: async () => false },
    ]) {
      const server = new DashboardServer({ ...f.provider.server.config, ...change, readState: async (site, signal) => { reads++; return f.provider.server.config.readState(site, signal); } });
      assert.ok([403, 503].includes((await server.handle(f.request(), "synthetic-site")).status));
    }
    assert.equal(reads, 0);
    for (const poison of [
      (state: DashboardContext["state"]) => { state.telemetry!.siteId = "other-site"; },
      (state: DashboardContext["state"]) => { state.telemetry!.source = { ...state.telemetry!.source, bootId: "another-boot" }; },
      (state: DashboardContext["state"]) => { state.telemetry!.body.capabilitiesRevision = "another-revision"; },
      (state: DashboardContext["state"]) => { if (state.snapshot!.body.type === "state.snapshot") state.snapshot!.body.configRevision = "another-config"; },
    ]) {
      const server = new DashboardServer({ ...f.provider.server.config, readState: async (site, signal) => {
        const state = await f.provider.server.config.readState(site, signal); poison(state); return state;
      } });
      const response = await server.handle(f.request(), "synthetic-site"); assert.equal(response.status, 503); assert.deepEqual(await response.json(), { error: "UNAVAILABLE" });
    }
  } finally { await f.pg.close(); }
});
test("stale readings retain provenance; no-device and offline status are explicit", async () => {
  const f = await fixture();
  try {
    const stale = await (await f.provider.server.handle(f.request("synthetic-stale"), "synthetic-stale")).json() as DashboardContext;
    assert.equal(freshness(stale.state, Date.now()), "stale");
    const sample = stale.state.telemetry!.body.samples.find(s => s.quality === "estimated")!;
    assert.equal(displayedSample(sample, stale.state, Date.now()).originQuality, "estimated");
    assert.equal(displayedSample(sample, stale.state, Date.now()).quality, "stale");
    const empty = await (await f.provider.server.handle(f.request("synthetic-empty"), "synthetic-empty")).json(); assert.equal(empty.state.connection, "no-device"); assert.equal(empty.state.snapshot, null);
    const offline = await (await f.provider.server.handle(f.request("synthetic-offline"), "synthetic-offline")).json(); assert.equal(offline.state.connection, "offline");
  } finally { await f.pg.close(); }
});

test("catalog reads are site-authorized and leave observed installed device state unchanged", async () => {
  const f = await fixture(); let reads = 0;
  try {
    const before = await (await f.provider.server.handle(f.request(), "synthetic-site")).json() as DashboardContext;
    const server = new DashboardServer({ ...f.provider.server.config,
      readState: async () => structuredClone(before.state), readReleases: async () => { reads++; return []; } });
    const forbidden = await server.handle(f.request("other-site"), "other-site", "releases");
    assert.equal(forbidden.status, 403); assert.equal(reads, 0);
    const response = await server.handle(f.request(), "synthetic-site", "releases");
    assert.equal(response.status, 200);
    const after = await response.json() as DashboardContext;
    assert.deepEqual(after.state, before.state); assert.deepEqual(after.configuration, before.configuration);
    assert.deepEqual(after.releases, []); assert.equal(reads, 1);
    assert.equal((await server.handle(new Request("http://localhost/", { method: "POST", headers: { authorization: `Bearer ${f.token}` } }), "synthetic-site", "releases")).status, 403);
  } finally { await f.pg.close(); }
});
test("engineering diagnostics reads scoped commissioning identities and blocks malformed or cross-site projections", async () => {
  const f = await fixture();
  try {
    const identity = { revision: "config-2", digest: "a".repeat(64), configurationDigest: "b".repeat(64), calibrationRevision: "calibration-2" };
    const status: CommissioningStatus = { version: "arbi.commissioning-status/1.0", realm: f.provider.server.config.identity.realm, siteId: "synthetic-site", executionMode: "simulation",
      active: identity, staged: { ...identity, revision: "config-3" }, rejected: { identity, reason: "RECALIBRATION_REQUIRED" }, phase: "blocked", ready: false,
      blockedReason: "RESTART_RECONCILIATION_REQUIRED", physicalActuationEnabled: false };
    let reads = 0;
    const server = new DashboardServer({ ...f.provider.server.config, readCommissioning: async () => { reads++; return structuredClone(status); } });
    const response = await server.handle(f.request(), "synthetic-site", "diagnostics");
    assert.equal(response.status, 200); assert.deepEqual((await response.json()).commissioning, status);
    const context = await server.handle(f.request(), "synthetic-site", "context");
    assert.equal(context.status, 200); assert.equal((await context.json()).commissioning, undefined); assert.equal(reads, 1);
    const viewer = (await f.provider.login("v".repeat(48)))!;
    assert.equal((await server.handle(f.request("synthetic-site", viewer), "synthetic-site", "diagnostics")).status, 403); assert.equal(reads, 1);
    for (const poison of [
      (s: CommissioningStatus) => { s.siteId = "other-site"; },
      (s: CommissioningStatus) => { s.ready = true; },
      (s: CommissioningStatus) => { s.physicalActuationEnabled = true as never; },
      (s: CommissioningStatus) => { s.realm.environment = "production"; },
      (s: CommissioningStatus) => { (s as unknown as Record<string, unknown>).credential = "forged"; },
      (s: CommissioningStatus) => { s.active!.digest = "invalid"; },
    ]) {
      const poisoned = structuredClone(status); poison(poisoned);
      const invalid = new DashboardServer({ ...f.provider.server.config, readCommissioning: async () => poisoned });
      assert.equal((await invalid.handle(f.request(), "synthetic-site", "diagnostics")).status, 503);
    }
  } finally { await f.pg.close(); }
});
