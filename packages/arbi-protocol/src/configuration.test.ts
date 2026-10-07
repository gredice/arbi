import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { AppliedConfiguration, Configuration, ConfigurationJournal, ConfigurationRequest, ConfigurationReport } from "./configuration-types.js";
import type { Command } from "./messages.js";
import { checkConfiguredCommand, configurationCapabilities, configurationDigest, configurationHardwareDigest, ConfigurationReference, CONFIGURATION_VERSION, MAX_CONFIGURATION_BYTES, parseConfigurationRecord, validateConfigurationRecord, type ConfigurationApplyBoundary, type ConfigurationResult } from "./configuration.js";

interface FixtureSet {
  context: ConfigurationApplyBoundary;
  valid: { configuration: Configuration; narrower: Configuration; report: ConfigurationReport };
  requests: Record<string, Omit<ConfigurationRequest, "configuration"> & { configurationFixture: "configuration" | "narrower" }>;
  journalTransactions: string[];
  invalid: Array<{ name: string; base: string; changes: Array<{ path: Array<string | number>; value: unknown }>; error: string }>;
}
const fixtures = JSON.parse(readFileSync(new URL("../fixtures/configuration.json", import.meta.url), "utf8")) as FixtureSet;
const protocol = JSON.parse(readFileSync(new URL("../fixtures/contracts.json", import.meta.url), "utf8")) as { valid: Record<string, Command> };
const context = (): ConfigurationApplyBoundary => structuredClone(fixtures.context);
const config = (): Configuration => structuredClone(fixtures.valid.configuration);
const request = (key = "request"): ConfigurationRequest => {
  const { configurationFixture, ...wire } = structuredClone(fixtures.requests[key]);
  return { ...wire, configuration: structuredClone(fixtures.valid[configurationFixture]) };
};
const applied = (key = "request"): AppliedConfiguration => {
  const wire = request(key);
  return { schemaVersion: CONFIGURATION_VERSION, request: wire, appliedBy: wire.target, configurationDigest: configurationDigest(wire.configuration) };
};
const journal = (): ConfigurationJournal => ({ schemaVersion: CONFIGURATION_VERSION, appliedTransactionId: "rollback-1", commits: fixtures.journalTransactions.map(applied) });
const move = (): Command => structuredClone(protocol.valid.move);
function error(result: ConfigurationResult<unknown>, code: string): void {
  assert.equal(result.ok, false, JSON.stringify(result));
  if (!result.ok) assert.equal(result.error.code, code);
}
function value<T>(result: ConfigurationResult<T>): T { if (!result.ok) assert.fail(JSON.stringify(result)); return result.value; }
function reseal(c: Configuration): void {
  if (c.calibration) Object.assign(c.calibration, { hardwareDigest: configurationHardwareDigest(c), geometryDigest: configurationDigest(c.geometry), limitsDigest: configurationDigest(c.limits) });
}
const initial = (): ConfigurationReference => { const reference = new ConfigurationReference(); value(reference.apply(request(), context(), () => true)); return reference; };

for (const name of ["configuration", "narrower"] as const) test(`configuration schema and round-trip: ${name}`, () => {
  assert.deepEqual(value(parseConfigurationRecord(JSON.stringify(fixtures.valid[name]), "configuration")), fixtures.valid[name]);
});
for (const name of Object.keys(fixtures.requests)) test(`expanded language-neutral request fixture: ${name}`, () => {
  assert.deepEqual(value(parseConfigurationRecord(JSON.stringify(request(name)), "request")), request(name));
});
test("persisted journal, acknowledgement and reboot-report fixtures validate", () => {
  assert.deepEqual(value(validateConfigurationRecord(journal(), "journal")), journal());
  assert.deepEqual(value(validateConfigurationRecord(fixtures.valid.report, "report")), fixtures.valid.report);
  assert.deepEqual(value(validateConfigurationRecord({ ...fixtures.valid.report, type: "configuration.boot" }, "report")).type, "configuration.boot");
});
for (const fixture of fixtures.invalid) test(`configuration rejection fixture: ${fixture.name}`, () => {
  const kind = fixture.base === "applied" ? "applied" : fixture.base === "journal" ? "journal" : "configuration";
  const input: unknown = fixture.base === "applied" ? applied() : fixture.base === "journal" ? journal() : config();
  for (const change of fixture.changes) {
    let target = input as Record<string | number, unknown>;
    for (const segment of change.path.slice(0, -1)) target = target[segment] as Record<string | number, unknown>;
    target[change.path.at(-1)!] = change.value;
  }
  error(validateConfigurationRecord(input, kind), fixture.error);
});
test("malformed, huge, cyclic and nonfinite inputs fail at the external boundary", () => {
  error(parseConfigurationRecord("{", "configuration"), "INVALID_JSON");
  error(parseConfigurationRecord(" ".repeat(MAX_CONFIGURATION_BYTES + 1), "configuration"), "CONFIGURATION_TOO_LARGE");
  const huge = { ...config(), ignored: " ".repeat(MAX_CONFIGURATION_BYTES) };
  error(validateConfigurationRecord(huge, "configuration"), "CONFIGURATION_TOO_LARGE");
  const c = config(); c.limits.maxSpeedMmPerS = NaN;
  error(validateConfigurationRecord(c, "configuration"), "INVALID_CONFIGURATION");
  c.limits.maxSpeedMmPerS = Infinity; error(validateConfigurationRecord(c, "configuration"), "INVALID_CONFIGURATION");
  const cyclic: Record<string, unknown> = {}; cyclic.self = cyclic;
  error(validateConfigurationRecord(cyclic, "configuration"), "INVALID_CONFIGURATION");
});
test("inventory separates passive hardware, unsupported updates and driver-local unavailable readings", () => {
  const c = config();
  assert.equal(c.components.find((component) => component.id === "drum-a")?.kind, "passive");
  const driver = c.components.find((component) => component.id === "driver-a");
  assert.equal(driver?.kind === "module" && driver.firmwareVersion, null);
  assert.equal(driver?.kind === "module" && driver.update.kind, "unsupported");
  const encoder = c.signals.find((signal) => signal.id === "pico-encoder-a")!;
  assert.equal(encoder.ownerComponentId, "pico"); assert.equal(encoder.physicalComponentId, "driver-a");
  assert.deepEqual(encoder.reading, { kind: "unavailable", reason: "not-reported" });
  assert.deepEqual(configurationCapabilities(c, "pico").find((capability) => capability.metric === "line.tension.a"), { metric: "line.tension.a", qualities: [] });
  assert.deepEqual(configurationCapabilities(c, "edge")[0].qualities, ["commanded", "estimated"]);
  // A supported update requires an explicit interface and accepted evidence; inventory grants no install authority.
  const edge = c.components[0];
  if (edge.kind === "module") edge.update = { kind: "supported", interfaceId: "synthetic-update", targets: ["application"], evidence: c.calibration!.evidence[0] };
  reseal(c); value(validateConfigurationRecord(c, "configuration"));
});
test("durable commit precedes acknowledgement and exact requested/applied copies are immutable", () => {
  const reference = new ConfigurationReference(); const r = request(); let persisted: ConfigurationJournal | undefined;
  const ack = value(reference.apply(r, context(), (candidate) => { assert.equal(reference.applied, null); persisted = candidate; return true; }));
  assert.deepEqual(ack, fixtures.valid.report);
  assert.deepEqual(reference.applied, persisted!.commits[0]);
  assert.deepEqual(reference.applied!.request, r);
  r.configuration.geometry.beds[0].bedId = "edited-after-request";
  persisted!.commits[0].request.configuration.revision = "edited-after-persistence";
  reference.applied!.request.configuration.revision = "edited-after-read";
  assert.equal(reference.applied!.request.configuration.revision, "config-1");
  assert.equal(reference.applied!.request.configuration.geometry.beds[0].bedId, "synthetic-bed");
});
test("failed persistence and thrown persistence preserve prior config and permit retry", () => {
  const reference = initial(); const before = reference.exportJournal();
  error(reference.apply(request("narrowerRequest"), context(), () => false), "PERSISTENCE_FAILED");
  error(reference.apply(request("narrowerRequest"), context(), () => { throw new Error("injected disk failure"); }), "PERSISTENCE_FAILED");
  assert.deepEqual(reference.exportJournal(), before);
  value(reference.apply(request("narrowerRequest"), context(), () => true));
  assert.equal(reference.applied!.request.configuration.revision, "config-2");
});
test("persistence cannot reenter apply/reboot or change the acknowledged applying identity", () => {
  const reference = new ConfigurationReference(); const local = context();
  const ack = value(reference.apply(request(), local, () => {
    error(reference.apply(request("narrowerRequest"), context(), () => true), "APPLY_IN_PROGRESS");
    error(reference.reboot(journal(), local.receiver), "APPLY_IN_PROGRESS");
    local.receiver.bootId = "mutated-during-persist";
    return true;
  }));
  assert.deepEqual(ack, fixtures.valid.report);
  assert.equal(reference.exportJournal().commits.length, 1);
});
test("duplicates return the original receipt without applying again; changed intent conflicts", () => {
  const reference = initial(); let writes = 0;
  const r = request();
  assert.deepEqual(value(reference.apply(r, context(), () => { writes++; return true; })), fixtures.valid.report);
  assert.equal(writes, 0);
  r.auditContext.reasonCode = "changed-reason";
  error(reference.apply(r, context(), () => true), "REVISION_CONFLICT");
});
test("stale bases, target epochs, unauthorized actors and uninhibited apply cannot mutate state", () => {
  const reference = initial(); const before = reference.exportJournal();
  const stale = request("narrowerRequest"); stale.expectedAppliedRevision = null;
  error(reference.apply(stale, context(), () => true), "STALE_CONFIGURATION");
  const oldAudit = request("narrowerRequest"); oldAudit.auditContext.previousCalibrationRevision = null;
  error(reference.apply(oldAudit, context(), () => true), "STALE_CONFIGURATION");
  error(reference.apply(request("narrowerRequest"), { ...context(), receiver: { ...context().receiver, bootId: "new-boot" } }, () => true), "TARGET_MISMATCH");
  error(reference.apply(request("narrowerRequest"), { ...context(), authorizedActor: { kind: "human", id: "other" } }, () => true), "NOT_AUTHORIZED");
  error(reference.apply(request("narrowerRequest"), { ...context(), authorizationId: "revoked" }, () => true), "NOT_AUTHORIZED");
  error(reference.apply(request("narrowerRequest"), { ...context(), inhibited: false }, () => true), "LOCAL_INHIBIT_REQUIRED");
  assert.deepEqual(reference.exportJournal(), before);
});
test("hardware mismatch and missing calibration reject transactional activation", () => {
  const r = request(); r.configuration.components[0].hardwareRevision = "2.0.0"; reseal(r.configuration);
  error(new ConfigurationReference().apply(r, context(), () => true), "HARDWARE_MISMATCH");
  const missing = request(); missing.configuration.calibration = null;
  value(validateConfigurationRecord(missing.configuration, "configuration"));
  error(new ConfigurationReference().apply(missing, context(), () => true), "MISSING_CALIBRATION");
  error(new ConfigurationReference().apply(request(), { ...context(), calibrationScope: "installed" }, () => true), "CALIBRATION_MISMATCH");
});
test("metric identity is unique per owner while distinct modules retain separate observation capability", () => {
  const c = config(); const other = structuredClone(c.signals[0]); other.id = "pod-position-estimate"; other.ownerComponentId = "pod";
  c.signals.push(other); reseal(c); value(validateConfigurationRecord(c, "configuration"));
  other.ownerComponentId = "edge"; reseal(c);
  error(validateConfigurationRecord(c, "configuration"), "INVALID_REGISTRY");
});
test("calibration edits need a new immutable revision, prior audit context and independent approval", () => {
  const reference = initial();
  const unapproved = request("narrowerRequest"); unapproved.configuration.calibration!.lineLengthOffsetsMm.a = 1;
  error(reference.apply(unapproved, context(), () => true), "CALIBRATION_NOT_APPROVED");
  const aliased = request("narrowerRequest"); aliased.configuration.calibration!.revision = "calibration-1";
  aliased.configuration.calibration!.previousRevision = null;
  error(reference.apply(aliased, context(), () => true), "REVISION_CONFLICT");
  const wrongParent = request("narrowerRequest"); wrongParent.configuration.calibration!.previousRevision = null;
  error(reference.apply(wrongParent, context(), () => true), "CALIBRATION_MISMATCH");
  const alteredGeometry = request("narrowerRequest"); alteredGeometry.configuration.geometry.plants[0].positionMm.x += 1; reseal(alteredGeometry.configuration);
  error(reference.apply(alteredGeometry, context(), () => true), "REVISION_CONFLICT");
  const ack = value(reference.apply(request("narrowerRequest"), context(), () => true));
  assert.equal(ack.calibrationRevision, "calibration-2");
  assert.equal(reference.applied!.request.auditContext.previousCalibrationRevision, "calibration-1");
});
test("even approved calibration cannot expand independent motion or gimbal limits", () => {
  for (const mutate of [
    (c: Configuration) => { c.limits.maxSpeedMmPerS = 51; },
    (c: Configuration) => { c.limits.maxAccelerationMmPerS2 = 101; },
    (c: Configuration) => { c.limits.workspace.minMm.x = 100; },
    (c: Configuration) => { c.limits.tensionN.max = 11; },
    (c: Configuration) => { c.calibration!.gimbalZeroDeg.pan = 5; },
  ]) {
    const r = request(); mutate(r.configuration); reseal(r.configuration);
    const local = context(); local.approvedCalibrationDigests.push(configurationDigest(r.configuration.calibration));
    error(new ConfigurationReference().apply(r, local, () => true), "LIMIT_EXPANSION");
  }
});
test("calibrated payout must remain positive beyond uncertainty throughout the workspace", () => {
  const c = config(); c.calibration!.lineLengthOffsetsMm.a = -1000; c.calibration!.uncertaintyMm = 50;
  error(validateConfigurationRecord(c, "configuration"), "CALIBRATION_MISMATCH");
});
test("reboot reports the exact durable applied config/calibration and inhibits old target commands", () => {
  const reference = initial(); value(reference.apply(request("narrowerRequest"), context(), () => true));
  const receiver = { ...context().receiver, bootId: "edge-boot-2", sessionId: "edge-session-2" };
  const restored = new ConfigurationReference(); const boot = value(restored.reboot(reference.exportJournal(), receiver));
  assert.equal(boot!.appliedRevision, "config-2"); assert.equal(boot!.calibrationRevision, "calibration-2");
  assert.equal(boot!.configurationDigest, reference.applied!.configurationDigest); assert.equal(boot!.source.bootId, receiver.bootId); assert.equal(boot!.inhibited, true);
  error(checkConfiguredCommand(move(), restored.applied, { ...context(), receiver }), "TARGET_MISMATCH");
  const fresh = move(); fresh.command.target = receiver; fresh.command.deadline.bootId = receiver.bootId; fresh.command.deadline.sessionId = receiver.sessionId; fresh.command.configRevision = "config-2";
  if (fresh.body.type === "motion.move") fresh.body.maxSpeedMmPerS = 20;
  value(checkConfiguredCommand(fresh, restored.applied, { ...context(), receiver }));
  error(checkConfiguredCommand(fresh, restored.applied, { ...context(), receiver, installedHardwareDigest: "0".repeat(64) }), "HARDWARE_MISMATCH");
});
test("journal corruption, edited rollback bodies and schema incompatibility fail without losing current state", () => {
  const reference = initial(); value(reference.apply(request("narrowerRequest"), context(), () => true));
  const before = reference.exportJournal(); const corrupt = structuredClone(before); corrupt.commits[0].configurationDigest = "0".repeat(64);
  error(reference.reboot(corrupt, context().receiver), "REVISION_CONFLICT"); assert.deepEqual(reference.exportJournal(), before);
  const rollback = request("rollbackRequest"); rollback.configuration.geometry.plants[0].positionMm.x += 1; reseal(rollback.configuration);
  error(reference.apply(rollback, context(), () => true), "REVISION_CONFLICT");
  error(reference.apply(request("rollbackRequest"), { ...context(), rollbackReadableSchemaVersions: [] }, () => true), "ROLLBACK_INCOMPATIBLE");
  error(reference.apply(request("rollbackRequest"), { ...context(), readableSchemaVersions: ["arbi.configuration/2.0"] }, () => true), "UNSUPPORTED_SCHEMA");
  const future = { ...request("rollbackRequest"), schemaVersion: "arbi.configuration/2.0" };
  error(reference.apply(future, context(), () => true), "UNSUPPORTED_SCHEMA");
  assert.deepEqual(reference.exportJournal(), before);
  value(reference.apply(request("rollbackRequest"), context(), () => true));
  assert.deepEqual(reference.applied!.request.configuration, config());
  assert.equal(reference.applied!.request.auditContext.previousConfigRevision, "config-2");
});
test("rollback still rechecks current evidence and tighter local limits", () => {
  const reference = initial(); value(reference.apply(request("narrowerRequest"), context(), () => true));
  error(reference.apply(request("rollbackRequest"), { ...context(), approvedCalibrationDigests: [configurationDigest(fixtures.valid.narrower.calibration)] }, () => true), "CALIBRATION_NOT_APPROVED");
  error(reference.apply(request("rollbackRequest"), { ...context(), localLimits: fixtures.valid.narrower.limits }, () => true), "LIMIT_EXPANSION");
});
test("affected commands reject stale revisions, frames, bounds and uncertainty; stop is config independent", () => {
  const reference = initial(); const a = reference.applied;
  value(checkConfiguredCommand(move(), a, context()));
  const stale = move(); stale.command.configRevision = "config-old";
  error(checkConfiguredCommand(stale, a, context()), "STALE_CONFIGURATION");
  const frame = move(); if (frame.body.type === "motion.move") frame.body.frame.revision = "unknown-frame";
  error(checkConfiguredCommand(frame, a, context()), "FRAME_MISMATCH");
  const boundary = move(); if (boundary.body.type === "motion.move") boundary.body.positionMm.x = 200;
  error(checkConfiguredCommand(boundary, a, context()), "OUTSIDE_LIMITS");
  const fast = move(); if (fast.body.type === "motion.move") fast.body.maxSpeedMmPerS = 51;
  error(checkConfiguredCommand(fast, a, context()), "OUTSIDE_LIMITS");
  const gimbal = structuredClone(protocol.valid.gimbal); value(checkConfiguredCommand(gimbal, a, context()));
  if (gimbal.body.type === "camera.gimbal") gimbal.body.panDeg = 91;
  error(checkConfiguredCommand(gimbal, a, context()), "OUTSIDE_LIMITS");
  const stop = structuredClone(protocol.valid.stop); stop.command.configRevision = "unavailable-config";
  value(checkConfiguredCommand(stop, null, context()));
  error(checkConfiguredCommand({ ...stop, executionMode: "hardware" }, null, context()), "TARGET_MISMATCH");
});
