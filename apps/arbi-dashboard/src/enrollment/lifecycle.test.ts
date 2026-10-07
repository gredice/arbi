import assert from "node:assert/strict";
import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { SiteRequestBoundary } from "@arbi/gredice";
import { createIsolatedIdentityProvider } from "@arbi/gredice/testing";
import { configurationCapabilities, correlateAuditEvent, parseAuditEvent } from "@arbi/protocol";
import type { AuditEvent, Configuration, Identity } from "@arbi/protocol";
import { MAX_ROTATION_OVERLAP_MS, VERSION } from "./contracts";
import type { Challenge, DeviceRequest, Registry } from "./contracts";
import { proofBytes } from "./crypto";
import { EnrollmentHttp } from "./http";
import { createEnrollmentServer } from "./server";
import { EnrollmentService, delegationProof, rotationProof, simulationRegistry } from "./service";
import { PostgresRegistryStore } from "./store";
import type { SqlDatabase } from "./store";
import { enrollmentRoute, configureEnrollment } from "./runtime";
import { POST } from "../app/api/sites/[siteId]/enrollment/[action]/route";

const fixture = JSON.parse(await readFile(new URL("../../../../packages/arbi-protocol/fixtures/configuration.json", import.meta.url), "utf8"));
const config = fixture.valid.configuration as Configuration;
const migration = await readFile(new URL("../../migrations/0001-enrollment.sql", import.meta.url), "utf8");
function keys() {
  const pair = generateKeyPairSync("ed25519");
  return { publicKey: pair.publicKey.export({ type: "spki", format: "der" }).toString("base64url"),
    sign: (value: unknown) => sign(null, proofBytes(value), pair.privateKey).toString("base64url") };
}
type Key = ReturnType<typeof keys>;
type Issuance = { deviceId: string; credentialId: string; credentialExpiresAtMs: number };
function database(db: PGlite): SqlDatabase {
  return { transaction: (work) => db.transaction(async (tx) => work({
    query: async <T extends Record<string, unknown>>(sql: string, parameters?: unknown[]) => {
      const result = await tx.query<T>(sql, parameters);
      return { rows: result.rows };
    },
  })) };
}
async function setup(t: { after: (work: () => Promise<void>) => void }, path?: string) {
  const db = new PGlite(path);
  t.after(() => db.close());
  await db.exec(migration);
  const store = new PostgresRegistryStore(database(db));
  await store.provision(simulationRegistry(config, "account"));
  const other = structuredClone(config); other.siteId = "other-site";
  await store.provision(simulationRegistry(other, "other-account"));
  let now = Date.UTC(2026, 9, 7, 12);
  const provider = createIsolatedIdentityProvider(config.realm, () => now);
  provider.putSite(config.siteId, "account"); provider.putSite(other.siteId, "other-account");
  for (const [name, role] of [["engineer", "engineer"], ["viewer", "viewer"]] as const) provider.putPrincipal({
    actor: { kind: "human", id: name }, accountId: "account", member: true,
    sites: { [config.siteId]: { roles: [role], serviceScopes: [], active: true, revision: "membership-1" } },
  });
  const service = new EnrollmentService(store, config.realm, () => now);
  const boundary = new SiteRequestBoundary({ identity: provider.adapter, resolveResource: provider.resolveResource,
    browserOrigins: ["https://fixture.invalid"], auditAuthorization: (record, signal) => store.authorization(record, signal) });
  const http = createEnrollmentServer({ realm: config.realm, identity: provider.adapter, resolveResource: provider.resolveResource,
    browserOrigins: ["https://fixture.invalid"], db: database(db), now: () => now });
  const tokens = { engineer: await provider.issue({ kind: "human", id: "engineer" }),
    viewer: await provider.issue({ kind: "human", id: "viewer" }) };
  const humanRequest = (action: string, value: unknown, token = tokens.engineer.token) => new Request("https://fixture.invalid/api", {
    method: action === "inventory" ? "GET" : "POST",
    headers: { authorization: `Bearer ${token}`, origin: "https://fixture.invalid", "x-arbi-request": "1", "content-type": "application/json" },
    ...(action === "inventory" ? {} : { body: JSON.stringify(value) }),
  });
  async function human(action: string, value: unknown, token = tokens.engineer.token, siteId = config.siteId) {
    const response = await http.handle(humanRequest(action, value, token), { siteId, action });
    return { response, value: await response.json() };
  }
  async function enroll(key = keys(), expectedDeviceId: string | null = null, purpose = expectedDeviceId ? "replace" : "enroll") {
    const challenge = await human("challenge", { componentId: "edge", publicKey: key.publicKey, expectedDeviceId, purpose });
    assert.equal(challenge.response.status, 200);
    const value = challenge.value as { proof: { challenge: Challenge } };
    const completed = await human("complete", { challengeId: value.proof.challenge.id, signature: key.sign(value.proof) });
    assert.equal(completed.response.status, 200);
    return { issuance: completed.value as Issuance, key, proof: value.proof };
  }
  async function sendDevice(input: unknown, siteId = config.siteId) {
    const response = await http.handle(new Request("https://fixture.invalid/api", { method: "POST",
      headers: { "content-type": "application/json" }, body: JSON.stringify(input) }), { siteId, action: "device" });
    return { response, value: await response.json() };
  }
  const wire = (issued: Issuance, key: Key, action: DeviceRequest["action"], payload: Record<string, unknown>, sequence: number) => {
    const unsigned: Omit<DeviceRequest, "signature"> = { version: VERSION, realm: config.realm, siteId: config.siteId,
      deviceId: issued.deviceId, credentialId: issued.credentialId, sequence, issuedAtMs: now, expiresAtMs: now + 30_000, action, payload };
    return { ...unsigned, signature: key.sign(unsigned) };
  };
  async function connect(issued: Issuance, key: Key, sequence = 0, previousIdentity: Identity | null = null) {
    const identity = { deviceId: issued.deviceId, bootId: randomUUID(), sessionId: randomUUID() };
    const request = wire(issued, key, "connect", { identity, previousIdentity, configRevision: config.revision,
      softwareRevision: "test-1", capabilities: configurationCapabilities(config, "edge") }, sequence);
    const result = await sendDevice(request);
    assert.equal(result.response.status, 200);
    return { identity, request };
  }
  async function registry(): Promise<Registry> {
    const result = await db.query<{ state: Registry }>("SELECT state FROM arbi_device_registry WHERE site_id=$1", [config.siteId]);
    return result.rows[0].state;
  }
  return { db, store, provider, service, boundary, http, tokens, humanRequest, human, enroll, sendDevice, wire, connect, registry,
    advance: (ms: number) => { now += ms; } };
}

test("Next route fails closed until explicitly composed; configured route uses current human authorization", async (t) => {
  assert.equal((await enrollmentRoute(new Request("https://fixture.invalid/api"), { siteId: config.siteId, action: "inventory" })).status, 503);
  const h = await setup(t);
  configureEnrollment(h.http);
  const result = await POST(h.humanRequest("challenge", { componentId: "edge", publicKey: keys().publicKey,
    expectedDeviceId: null, purpose: "enroll" }), { params: Promise.resolve({ siteId: config.siteId, action: "challenge" }) });
  assert.equal(result.status, 200);
  assert.equal(result.headers.get("cache-control"), "private, no-store");
});

test("commissioning is site-, session- and proof-bound, replay/concurrent completion grants one identity", async (t) => {
  const h = await setup(t); const key = keys();
  const value = { componentId: "edge", publicKey: key.publicKey, expectedDeviceId: null, purpose: "enroll" };
  assert.equal((await h.human("challenge", value, h.tokens.viewer.token)).response.status, 403);
  assert.equal((await h.human("challenge", value, h.tokens.engineer.token, "other-site")).response.status, 403);
  const challenge = await h.human("challenge", value);
  const { proof } = challenge.value as { proof: { challenge: Challenge } };
  assert.equal((await h.human("complete", { challengeId: proof.challenge.id, signature: keys().sign(proof) })).response.status, 403);
  const second = await h.provider.issue({ kind: "human", id: "engineer" });
  const completion = { challengeId: proof.challenge.id, signature: key.sign(proof) };
  assert.equal((await h.human("complete", completion, second.token)).response.status, 403);
  const results = await Promise.all([h.human("complete", completion), h.human("complete", completion)]);
  assert.deepEqual(results.map((r) => r.response.status).sort(), [200, 403]);
  assert.equal((await h.registry()).devices.length, 1);
  assert.equal((await h.human("complete", completion)).response.status, 403);
  assert.equal((await h.human("challenge", value)).response.status, 409);
});

test("challenge expiry, changed membership and changed configuration invalidate bootstrap", async (t) => {
  const h = await setup(t); const key = keys();
  const challenge = await h.human("challenge", { componentId: "edge", publicKey: key.publicKey, expectedDeviceId: null, purpose: "enroll" });
  const { proof } = challenge.value as { proof: { challenge: Challenge } };
  const input = { challengeId: proof.challenge.id, signature: key.sign(proof) };
  await h.store.transact(config.realm, config.siteId, ({ state }) => { state.configRevision = "config-2"; });
  assert.equal((await h.human("complete", input)).response.status, 409);
  await h.store.transact(config.realm, config.siteId, ({ state }) => { state.configRevision = config.revision; });
  h.advance(120_000);
  assert.equal((await h.human("complete", input)).value.error, "EXPIRED");
  h.provider.revoke(h.tokens.engineer.sessionId);
  assert.equal((await h.human("challenge", input)).response.status, 401);
});

test("unenrolled, cross-realm/site, tampered and replayed requests cannot admit trusted state or commands", async (t) => {
  const h = await setup(t); const enrolled = await h.enroll();
  const connected = await h.connect(enrolled.issuance, enrolled.key);
  const command = h.wire(enrolled.issuance, enrolled.key, "commands", { identity: connected.identity, configRevision: config.revision }, 1);
  assert.equal((await h.sendDevice({ ...command, deviceId: "unknown" })).response.status, 403);
  assert.equal((await h.sendDevice({ ...command, realm: { ...config.realm, namespaceId: "other-run" } })).response.status, 403);
  assert.equal((await h.sendDevice(command, "other-site")).response.status, 403);
  assert.equal((await h.sendDevice({ ...command, sequence: 2 })).response.status, 403);
  const accepted = await h.sendDevice(command);
  assert.equal(accepted.response.status, 200);
  assert.deepEqual(accepted.value.commands, []);
  assert.equal(accepted.value.actuationEnabled, false);
  assert.equal((await h.sendDevice(command)).response.status, 409);
  const state = h.wire(enrolled.issuance, enrolled.key, "state", { identity: connected.identity, configRevision: config.revision,
    softwareRevision: "test-2", capabilities: configurationCapabilities(config, "edge") }, 2);
  assert.equal((await h.sendDevice(state)).response.status, 200);
  assert.equal((await h.registry()).devices[0].softwareRevision, "test-2");
  h.advance(30_000);
  assert.equal((await h.sendDevice(state)).value.error, "EXPIRED");
});

test("rotation needs both key proofs, enforces bounded overlap and expiry, and never reuses a historical key", async (t) => {
  const h = await setup(t); const enrolled = await h.enroll(); const next = keys();
  const { identity } = await h.connect(enrolled.issuance, enrolled.key);
  const unsigned = h.wire(enrolled.issuance, enrolled.key, "rotate", { identity, publicKey: next.publicKey,
    overlapMs: MAX_ROTATION_OVERLAP_MS + 1, newKeyProof: "" }, 1);
  unsigned.payload.newKeyProof = next.sign(rotationProof(unsigned));
  const signed = () => { const { signature: _, ...rest } = unsigned; return { ...rest, signature: enrolled.key.sign(rest) }; };
  assert.equal((await h.sendDevice(signed())).response.status, 409);
  unsigned.payload.overlapMs = 20_000;
  unsigned.payload.newKeyProof = keys().sign(rotationProof(unsigned));
  assert.equal((await h.sendDevice(signed())).response.status, 403);
  unsigned.payload.newKeyProof = next.sign(rotationProof(unsigned));
  const rotated = await h.sendDevice(signed()); assert.equal(rotated.response.status, 200);
  const newCredential = rotated.value as Issuance;
  assert.equal((await h.sendDevice(h.wire(enrolled.issuance, enrolled.key, "commands", { identity, configRevision: config.revision }, 2))).response.status, 200);
  assert.equal((await h.sendDevice(h.wire(newCredential, next, "commands", { identity, configRevision: config.revision }, 0))).response.status, 200);
  const again = h.wire(newCredential, next, "rotate", { identity, publicKey: keys().publicKey, overlapMs: 1, newKeyProof: "" }, 1);
  assert.equal((await h.sendDevice(again)).response.status, 409);
  h.advance(20_000);
  assert.equal((await h.sendDevice(h.wire(enrolled.issuance, enrolled.key, "commands", { identity, configRevision: config.revision }, 3))).response.status, 403);
  assert.equal((await h.sendDevice(h.wire(newCredential, next, "commands", { identity, configRevision: config.revision }, 1))).response.status, 200);
  const reuse = h.wire(newCredential, next, "rotate", { identity, publicKey: enrolled.key.publicKey, overlapMs: 0, newKeyProof: "" }, 2);
  assert.equal((await h.sendDevice(reuse)).response.status, 409);
});

test("reboot fences old identity, replay and prior boots; stale configuration/capability claims fail closed", async (t) => {
  const h = await setup(t); const enrolled = await h.enroll();
  const first = await h.connect(enrolled.issuance, enrolled.key);
  const second = await h.connect(enrolled.issuance, enrolled.key, 1, first.identity);
  assert.equal((await h.sendDevice(h.wire(enrolled.issuance, enrolled.key, "commands", { identity: first.identity, configRevision: config.revision }, 2))).value.error, "STALE_IDENTITY");
  const oldBoot = { ...first.request.payload, previousIdentity: second.identity };
  assert.equal((await h.sendDevice(h.wire(enrolled.issuance, enrolled.key, "connect", oldBoot, 2))).value.error, "STALE_IDENTITY");
  const reported = { identity: second.identity, configRevision: "config-stale", softwareRevision: "test-1", capabilities: [] };
  assert.equal((await h.sendDevice(h.wire(enrolled.issuance, enrolled.key, "state", reported, 2))).value.error, "STALE_CONFIGURATION");
  reported.configRevision = config.revision;
  assert.equal((await h.sendDevice(h.wire(enrolled.issuance, enrolled.key, "state", reported, 2))).response.status, 403);
  await h.store.transact(config.realm, config.siteId, ({ state }) => { state.configRevision = "config-2"; });
  assert.equal((await h.sendDevice(h.wire(enrolled.issuance, enrolled.key, "commands", { identity: second.identity, configRevision: "config-2" }, 2))).value.error, "STALE_CONFIGURATION");
});

test("delegated modules have local scope, passive parts lack identity, parent revocation invalidates descendants", async (t) => {
  const h = await setup(t); const enrolled = await h.enroll(); const local = keys();
  const { identity } = await h.connect(enrolled.issuance, enrolled.key);
  const request = h.wire(enrolled.issuance, enrolled.key, "delegate", { identity, componentId: "pico", expectedDeviceId: null,
    publicKey: local.publicKey, newKeyProof: "" }, 1);
  request.payload.newKeyProof = local.sign(delegationProof(request));
  const { signature: _, ...unsigned } = request;
  const response = await h.sendDevice({ ...unsigned, signature: enrolled.key.sign(unsigned) });
  assert.equal(response.response.status, 200);
  assert.deepEqual(response.value.cloudPermissions, []);
  const issuance = response.value as Issuance;
  assert.equal((await h.sendDevice(h.wire(issuance, local, "commands", { identity: { deviceId: issuance.deviceId, bootId: "boot", sessionId: "session" }, configRevision: config.revision }, 0))).response.status, 403);
  assert.equal((await h.human("challenge", { componentId: "drum-a", publicKey: keys().publicKey, expectedDeviceId: null, purpose: "enroll" })).response.status, 403);
  const revoked = await h.human("revoke", { deviceId: enrolled.issuance.deviceId });
  assert.equal(revoked.response.status, 200);
  assert.equal((await h.registry()).devices[1].status, "revoked");
  assert.equal((await h.sendDevice(h.wire(enrolled.issuance, enrolled.key, "commands", { identity, configRevision: config.revision }, 2))).response.status, 403);
});

test("replacement and factory/service recovery preserve history without credential transfer or old reconnect", async (t) => {
  const h = await setup(t); const initial = await h.enroll();
  const first = await h.connect(initial.issuance, initial.key);
  const replaced = await h.enroll(keys(), initial.issuance.deviceId);
  assert.notEqual(replaced.issuance.credentialId, initial.issuance.credentialId);
  const current = await h.connect(replaced.issuance, replaced.key);
  assert.equal((await h.sendDevice(h.wire(initial.issuance, initial.key, "commands", { identity: first.identity, configRevision: config.revision }, 1))).response.status, 403);
  await h.human("revoke", { deviceId: replaced.issuance.deviceId });
  const revokedAt = (await h.registry()).devices[1].revokedAtMs;
  h.advance(1_000);
  assert.equal((await h.sendDevice(h.wire(replaced.issuance, replaced.key, "connect", { ...current.request.payload, previousIdentity: null }, 1))).response.status, 403);
  const recovered = await h.enroll(keys(), replaced.issuance.deviceId, "service-recovery");
  assert.notEqual(recovered.issuance.deviceId, replaced.issuance.deviceId);
  const state = await h.registry();
  assert.equal(state.devices.length, 3);
  assert.deepEqual(state.devices.map((d) => d.componentId), ["edge", "edge", "edge"]);
  assert.equal(state.devices[2].replacesDeviceId, state.devices[1].id);
  assert.equal(state.devices[1].revokedAtMs, revokedAt);
  assert.deepEqual(state.devices[0].retiredIdentities[0], first.identity);
});

test("revocation during overlap denies both credentials and reconnect, including current signed identity", async (t) => {
  const h = await setup(t); const enrolled = await h.enroll(); const next = keys();
  const { identity } = await h.connect(enrolled.issuance, enrolled.key);
  const request = h.wire(enrolled.issuance, enrolled.key, "rotate", { identity, publicKey: next.publicKey,
    overlapMs: MAX_ROTATION_OVERLAP_MS, newKeyProof: "" }, 1);
  request.payload.newKeyProof = next.sign(rotationProof(request));
  const { signature: _, ...unsigned } = request;
  const rotated = await h.sendDevice({ ...unsigned, signature: enrolled.key.sign(unsigned) });
  assert.equal(rotated.response.status, 200);
  const issued = rotated.value as Issuance;
  assert.equal((await h.human("revoke", { deviceId: issued.deviceId })).response.status, 200);
  for (const [credential, key, sequence] of [[enrolled.issuance, enrolled.key, 2], [issued, next, 0]] as const) {
    assert.equal((await h.sendDevice(h.wire(credential, key, "commands", { identity, configRevision: config.revision }, sequence))).response.status, 403);
    assert.equal((await h.sendDevice(h.wire(credential, key, "connect", { identity: { ...identity, bootId: randomUUID() }, previousIdentity: null,
      configRevision: config.revision, softwareRevision: "test-1", capabilities: configurationCapabilities(config, "edge") }, sequence))).response.status, 403);
  }
});

test("ordinary diagnostics and audit contain no keys, proofs, credential identifiers or request dumps", async (t) => {
  const h = await setup(t); const enrolled = await h.enroll(); await h.connect(enrolled.issuance, enrolled.key);
  const inventory = await h.human("inventory", null);
  const audit = await h.db.query<{ record: AuditEvent }>("SELECT record FROM arbi_device_audit");
  const lifecycle = await h.db.query<{ record: { id: string } }>("SELECT record FROM arbi_device_lifecycle");
  const serialized = JSON.stringify({ diagnostics: inventory.value, audit: audit.rows, lifecycle: lifecycle.rows });
  assert.equal(serialized.includes(enrolled.key.publicKey), false);
  assert.equal(serialized.includes(enrolled.issuance.credentialId), false);
  assert.equal(/publicKey|privateKey|signature|newKeyProof|authorization.*Bearer/.test(serialized), false);
  const passive = inventory.value.components.find((c: { id: string }) => c.id === "drum-a");
  assert.equal(passive.kind, "passive"); assert.equal(Object.hasOwn(passive, "firmwareVersion"), false);
  const noSignal = inventory.value.signals.find((s: { id: string }) => s.id === "tension-a");
  assert.deepEqual(noSignal.reading, { kind: "unavailable", reason: "sensor-not-installed" });
  const events = audit.rows.map((row) => row.record as AuditEvent);
  for (const event of events) {
    assert.equal(parseAuditEvent(JSON.stringify(event)).ok, true);
    assert.equal(event.effect, "none");
    assert.equal(event.source.module, "cloud");
    assert.equal(event.sourceTime.utc, null);
    if (event.evidence === "service-outcome") {
      const intent = events.find((candidate) => candidate.eventId === event.links.intentEventId);
      assert.equal(correlateAuditEvent(intent, event).ok, true);
    }
  }
  assert.ok(lifecycle.rows.every((row) => events.some((event) => event.eventId === (row.record as { id: string }).id)));
});

test("membership removal, browser/service misuse, private fields and production/hardware bootstrap deny", async (t) => {
  const h = await setup(t); const key = keys();
  const value = { componentId: "edge", publicKey: key.publicKey, expectedDeviceId: null, purpose: "enroll" };
  const bad = await h.human("challenge", { ...value, privateKey: "synthetic-private-marker" });
  assert.equal(bad.response.status, 400); assert.equal(JSON.stringify(bad.value).includes("synthetic-private-marker"), false);
  h.provider.putPrincipal({ actor: { kind: "human", id: "engineer" }, accountId: "account", member: true,
    sites: { [config.siteId]: { roles: ["viewer"], serviceScopes: [], active: true, revision: "membership-2" } } });
  assert.equal((await h.human("challenge", value)).response.status, 403);
  const browserDevice = await h.http.handle(h.humanRequest("complete", {}), { siteId: config.siteId, action: "device" });
  assert.equal(browserDevice.status, 403);
  h.provider.putPrincipal({ actor: { kind: "service", id: "worker" }, accountId: "account", member: true,
    sites: { [config.siteId]: { roles: [], serviceScopes: ["state.read"], active: true, revision: "membership-1" } } });
  const service = await h.provider.issue({ kind: "service", id: "worker" });
  assert.equal((await h.human("challenge", value, service.token)).response.status, 403);
  assert.throws(() => simulationRegistry({ ...config, realm: { environment: "production", namespaceId: "live" } }, "account"));
  assert.throws(() => simulationRegistry({ ...config, executionMode: "hardware" }, "account"));
});

test("SQL audit/state failure rolls back authority; errors redact dependency details; oversized bodies reject", async (t) => {
  const h = await setup(t); const enrolled = await h.enroll(); const { identity } = await h.connect(enrolled.issuance, enrolled.key);
  const underlying = database(h.db);
  const fault: SqlDatabase = { transaction: (work) => underlying.transaction((sql) => work({
    query: async (statement, parameters) => {
      if (statement.startsWith("INSERT INTO arbi_device_audit")) throw new Error("synthetic-private-error-marker");
      return sql.query(statement, parameters);
    },
  })) };
  const broken = new EnrollmentHttp(new EnrollmentService(new PostgresRegistryStore(fault), config.realm), h.boundary);
  const request = h.wire(enrolled.issuance, enrolled.key, "commands", { identity, configRevision: config.revision }, 1);
  // Use the fixture clock so the injected SQL fault, not the expiry check, owns the denial.
  const badService = new EnrollmentService(new PostgresRegistryStore(fault), config.realm, () => request.issuedAtMs);
  const response = await new EnrollmentHttp(badService, h.boundary).handle(new Request("https://fixture.invalid/api", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request) }), { siteId: config.siteId, action: "device" });
  assert.equal(response.status, 503); assert.equal((await response.text()).includes("synthetic-private-error-marker"), false);
  assert.equal((await h.registry()).devices[0].credentials[0].lastSequence, 0);
  const tooLarge = await broken.handle(new Request("https://fixture.invalid/api", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ value: "x".repeat(20_000) }) }), { siteId: config.siteId, action: "device" });
  assert.equal(tooLarge.status, 400);
});

test("file-backed PostgreSQL restart retains revocation, history and sequence fencing", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "arbi-enrollment-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const db = new PGlite(dir); await db.exec(migration);
  const store = new PostgresRegistryStore(database(db));
  await store.provision(simulationRegistry(config, "account"));
  const key = keys();
  await store.transact(config.realm, config.siteId, ({ state }) => {
    state.devices.push({ id: "historical-device", componentId: "edge", role: "edge", status: "revoked", parentDeviceId: null,
      replacesDeviceId: null, enrolledAtMs: 1, revokedAtMs: 2, current: null,
      retiredIdentities: [{ deviceId: "historical-device", bootId: "prior-boot", sessionId: "prior-session" }], lastSeenAtMs: 2,
      softwareRevision: "test-1", appliedConfigRevision: config.revision, capabilities: [], credentials: [
        { id: "historical-credential", publicKey: key.publicKey, createdAtMs: 1, expiresAtMs: 3, revokedAtMs: 2, lastSequence: 45 }], });
  });
  await db.close();
  const restarted = new PGlite(dir); t.after(() => restarted.close());
  const recovered = await new PostgresRegistryStore(database(restarted)).transact(config.realm, config.siteId, ({ state }) => state.devices[0]);
  assert.equal(recovered.status, "revoked"); assert.equal(recovered.credentials[0].lastSequence, 45);
  assert.equal(recovered.retiredIdentities[0].bootId, "prior-boot");
});
