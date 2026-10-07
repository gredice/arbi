import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { generateKeyPairSync, sign } from "node:crypto";
import { tmpdir } from "node:os";
import test from "node:test";
import pg from "pg";
import type { Configuration } from "@arbi/protocol";
import type { AuthorizedContext } from "@arbi/gredice";
import { EnrollmentService, simulationRegistry } from "./service";
import { proofBytes } from "./crypto";
import { PostgresRegistryStore, postgresDatabase } from "./store";
import { EnrollmentError } from "./contracts";

const socket = process.env.ARBI_ENROLLMENT_TEST_SOCKET;
test("independent PostgreSQL connections serialize authority and roll back audit/state as one transaction", { skip: !socket }, async (t) => {
  // Only the test launcher-created, disposable filesystem socket is eligible.
  const root = realpathSync(socket!);
  assert.ok(root.startsWith(`${realpathSync(process.platform === "darwin" ? "/private/tmp" : tmpdir())}/arbi-enrollment-pg-`));
  const pool = new pg.Pool({ host: root, user: "arbi_test", port: 54321, database: "postgres", max: 4, connectionTimeoutMillis: 2_000 });
  t.after(() => pool.end());
  const version = await pool.query("SHOW server_version");
  t.diagnostic(`Isolated host PostgreSQL ${version.rows[0].server_version}`);
  await pool.query(await readFile(new URL("../../migrations/0001-enrollment.sql", import.meta.url), "utf8"));
  const fixture = JSON.parse(await readFile(new URL("../../../../packages/arbi-protocol/fixtures/configuration.json", import.meta.url), "utf8"));
  const config = fixture.valid.configuration as Configuration;
  const storeA = new PostgresRegistryStore(postgresDatabase(pool));
  const storeB = new PostgresRegistryStore(postgresDatabase(pool));
  await storeA.provision(simulationRegistry(config, "account"));
  const now = Date.now();
  const context: AuthorizedContext = { actor: { kind: "human", id: "engineer" }, sessionId: "human-session",
    realm: config.realm, siteId: config.siteId, accountId: "account", resource: { kind: "site", id: config.siteId },
    capability: "configuration.write", membershipRevision: "membership-1", expiresAtMs: now + 300_000 };
  const serviceA = new EnrollmentService(storeA, config.realm, () => now);
  const serviceB = new EnrollmentService(storeB, config.realm, () => now);
  const key = generateKeyPairSync("ed25519");
  const challenge = await serviceA.human(context, "challenge", { componentId: "edge",
    publicKey: key.publicKey.export({ type: "spki", format: "der" }).toString("base64url"), expectedDeviceId: null, purpose: "enroll" }) as {
      proof: { challenge: { id: string } };
    };
  const complete = { challengeId: challenge.proof.challenge.id, signature: sign(null, proofBytes(challenge.proof), key.privateKey).toString("base64url") };
  const completions = await Promise.allSettled([serviceA.human(context, "complete", complete), serviceB.human(context, "complete", complete)]);
  assert.equal(completions.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal((await pool.query("SELECT state FROM arbi_device_registry")).rows[0].state.devices.length, 1);
  const issued = completions.find((result) => result.status === "fulfilled") as PromiseFulfilledResult<{ deviceId: string }>;
  await serviceB.human(context, "revoke", { deviceId: issued.value.deviceId });
  const streams = new Map<string, bigint[]>();
  for (const { record } of (await pool.query("SELECT record FROM arbi_device_audit")).rows) {
    const stream = record.source.identity.bootId;
    streams.set(stream, [...(streams.get(stream) ?? []), BigInt(record.sequence)]);
  }
  assert.equal(streams.size, 2);
  for (const sequences of streams.values()) {
    sequences.sort((a, b) => a < b ? -1 : 1);
    assert.deepEqual(sequences, sequences.map((_, index) => BigInt(index + 1)));
  }
  const otherConfig = structuredClone(config); otherConfig.siteId = "other-site";
  await storeB.provision(simulationRegistry(otherConfig, "other-account"));
  const otherContext = { ...context, siteId: otherConfig.siteId, accountId: "other-account",
    resource: { kind: "site" as const, id: otherConfig.siteId } };
  const otherChallenge = await serviceB.human(otherContext, "challenge", { componentId: "edge",
    publicKey: key.publicKey.export({ type: "spki", format: "der" }).toString("base64url"), expectedDeviceId: null, purpose: "enroll" }) as {
      proof: { challenge: { id: string } };
    };
  await assert.rejects(serviceB.human(otherContext, "complete", { challengeId: otherChallenge.proof.challenge.id,
    signature: sign(null, proofBytes(otherChallenge.proof), key.privateKey).toString("base64url") }), { code: "CONFLICT" });
  assert.equal((await pool.query("SELECT state FROM arbi_device_registry WHERE site_id=$1", [otherConfig.siteId])).rows[0].state.devices.length, 0);
  const results = await Promise.allSettled([storeA, storeB].map((store) => store.transact(config.realm, config.siteId, ({ state }) => {
    if (state.configRevision !== config.revision) throw new EnrollmentError("CONFLICT");
    state.configRevision = "config-2";
    return true;
  })));
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const denied = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
  assert.equal(denied.reason.code, "CONFLICT");
  const auditCount = (await pool.query("SELECT count(*) FROM arbi_device_audit")).rows[0].count;
  await pool.query("ALTER TABLE arbi_device_audit ADD CONSTRAINT injected_failure CHECK (false) NOT VALID");
  await assert.rejects(storeA.transact(config.realm, config.siteId, ({ state, observations }) => {
    state.configRevision = "must-rollback";
    observations.push({ id: "00000000-0000-4000-8000-000000000001", atMs: 1, kind: "revoked",
      actor: { kind: "human", id: "engineer" }, componentId: "edge", deviceId: null });
  }), { code: "UNAVAILABLE" });
  const persisted = await pool.query("SELECT state FROM arbi_device_registry WHERE site_id=$1", [config.siteId]);
  assert.equal(persisted.rows[0].state.configRevision, "config-2");
  assert.equal((await pool.query("SELECT count(*) FROM arbi_device_audit")).rows[0].count, auditCount);
});
