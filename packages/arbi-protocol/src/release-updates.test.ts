import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { bindReleaseInventory, checkReleaseCompatibility, inspectReleaseSet, produceRelease, validateReleaseRecord, verifyReleaseArtifact, type ReleaseResult } from "./release.js";
import { admitUpdateEvent, recoverUpdate, requestUpdate, reserveReferenceInstallation, validateUpdateRecord, updateAuditReferences, type UpdateResult, type UpdateAdmission, type UpdateEventBoundary } from "./update.js";
import { configurationDigest } from "./configuration.js";
import type { ReleaseInventory, ReleaseManifest, ReleaseSet } from "./release-types.js";
import type { UpdateBootObservation, UpdateEvent, UpdateJournal, UpdateRequest } from "./update-types.js";

const read = (name: string): any => JSON.parse(readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), "utf8"));
const releases = read("releases") as { inventory: ReleaseInventory; releaseSet: ReleaseSet; payloads: Record<string, string>; invalid: { name: string; kind: string; base: string; path: (string | number)[]; value: unknown; remove?: boolean }[] };
const updates = read("updates") as { request: UpdateRequest; baseline: UpdateBootObservation; baselineManifest: ReleaseManifest; events: UpdateEvent[]; rollback: UpdateEvent };
const config = read("configuration").valid.configuration;
function value<T>(r: ReleaseResult<T> | UpdateResult<T>): T { assert.equal(r.ok, true, JSON.stringify(r)); return r.value; }
function error(r: ReleaseResult<unknown> | UpdateResult<unknown>, code?: string): void { assert.equal(r.ok, false); if (!r.ok && code) assert.equal(r.error.code, code); }
const manifest = (id: string): ReleaseManifest => structuredClone(releases.releaseSet.manifests.find(m => m.releaseId === id)!);
const admission = (r = updates.request): UpdateAdmission => ({ scope: r.scope, inventory: releases.inventory, releaseSet: releases.releaseSet, currentSelections: value(inspectReleaseSet(releases.releaseSet)).updateStates[1], authenticatedSource: r.source, authorizedAuditContext: r.auditContext, baseline: updates.baseline, baselineManifest: updates.baselineManifest, nowUtc: r.issuedAt });
const boundary = (e: UpdateEvent): UpdateEventBoundary => ({ scope: updates.request.scope, authenticatedSource: e.source, owner: e.boot ? "target" : "edge", nowUtc: e.observedAt, localBootObservation: e.boot, artifactVerification: e.verification, preflight: e.preflight });
const journal = (): UpdateJournal => value(requestUpdate([], updates.request, admission())).journal;
function through(n: number): UpdateJournal { let j = journal(); for (const e of updates.events.slice(0, n)) j = value(admitUpdateEvent(j, e, boundary(e))); return j; }

test("inventory binds every canonical configuration component and never creates physical update support", () => {
  value(bindReleaseInventory(releases.inventory, config));
  for (const id of ["edge", "pico", "pod"]) value(checkReleaseCompatibility(manifest(id + "-1.1.0"), releases.inventory, "1.0.0"));
  const driver = releases.inventory.modules.find(m => m.component.id === "driver-a")!;
  assert.equal(driver.capability.kind, "unavailable");
  const unsupported = manifest("pico-1.1.0"); unsupported.target.moduleId = "driver-a";
  error(checkReleaseCompatibility(unsupported, releases.inventory, "1.0.0"));
  const changed = structuredClone(releases.inventory); changed.modules[0].component.hardwareId = "new-board";
  error(bindReleaseInventory(changed, config), "IDENTITY_MISMATCH");
  const hardware = structuredClone(releases.inventory); hardware.executionMode = "hardware";
  error(validateReleaseRecord("inventory", hardware), "UNAVAILABLE_TARGET");
  const passive = structuredClone(releases.inventory); passive.modules.find(m => m.targetClass === "passive")!.capability = structuredClone(releases.inventory.modules[0].capability);
  error(validateReleaseRecord("inventory", passive), "UNAVAILABLE_TARGET");
});

for (const fixture of releases.invalid) test(`invalid release vector: ${fixture.name}`, () => {
  const input: any = fixture.kind === "set" ? structuredClone(releases.releaseSet) : manifest(fixture.base);
  let parent = input; for (const key of fixture.path.slice(0, -1)) parent = parent[key];
  const key = fixture.path.at(-1)!;
  if (fixture.remove) delete parent[key]; else parent[key] = structuredClone(fixture.value);
  error(fixture.kind === "compatibility" ? checkReleaseCompatibility(input, releases.inventory, "1.0.0") : validateReleaseRecord(fixture.kind === "set" ? "set" : "manifest", input));
});

test("mixed-version release checks all four update states and rollback from all three prefixes", () => {
  const report = value(inspectReleaseSet(releases.releaseSet));
  assert.equal(report.updateStates.length, 4);
  assert.deepEqual(report.updateStates[1].map(s => s.releaseId), ["edge-1.1.0", "pico-1.0.0", "pod-1.0.0"]);
  assert.deepEqual(report.rollbackStates.map(p => p.states.length), [2, 3, 4]);
  for (const p of report.rollbackStates) assert.deepEqual(p.states.at(-1), releases.releaseSet.initial);
  const incompatible = structuredClone(releases.releaseSet);
  // Final combination is valid, but old Pico refuses the newly upgraded edge.
  incompatible.manifests.find(m => m.releaseId === "pico-1.0.0")!.dependencies[0].versions.max = "1.0.0";
  error(inspectReleaseSet(incompatible), "INCOMPATIBLE");
  const wrongData = structuredClone(releases.releaseSet); wrongData.steps[0].configurationDataVersion = "2.0.0";
  error(inspectReleaseSet(wrongData), "INCOMPATIBLE");
});

test("ephemeral release signing binds immutable artifact bytes AND board/channel/dependency/configuration metadata", () => {
  const keys = generateKeyPairSync("ed25519"), other = generateKeyPairSync("ed25519");
  const m = manifest("pico-1.1.0"), bytes = Buffer.from(releases.payloads[m.releaseId]);
  const signed = value(produceRelease(m, bytes, { keyId: m.artifact.signature.keyId, privateKey: keys.privateKey }));
  const trusted = { keyId: signed.artifact.signature.keyId, publicKey: keys.publicKey };
  value(verifyReleaseArtifact(signed, bytes, trusted));
  error(verifyReleaseArtifact(m, bytes, trusted), "INVALID_SIGNATURE");
  error(verifyReleaseArtifact(signed, Buffer.from("corrupted"), trusted), "ARTIFACT_MISMATCH");
  error(verifyReleaseArtifact(signed, bytes, { ...trusted, publicKey: other.publicKey }), "INVALID_SIGNATURE");
  error(verifyReleaseArtifact(signed, bytes, { ...trusted, keyId: "wrong-key" }), "INVALID_SIGNATURE");
  for (const mutate of [(x: ReleaseManifest) => { x.target.boardId = "wrong-board"; }, (x: ReleaseManifest) => { x.channel = "stable"; }, (x: ReleaseManifest) => { x.dependencies = []; }, (x: ReleaseManifest) => { x.configuration.dataRange.max = "1.1.0"; }, (x: ReleaseManifest) => { x.build.commit = "f".repeat(40); }]) {
    const changed = structuredClone(signed); mutate(changed); error(verifyReleaseArtifact(changed, bytes, trusted), "INVALID_SIGNATURE");
  }
});

test("available/desired/staged do not change installed or confirmed; only bound local boot health does", () => {
  const first = value(recoverUpdate(journal())).status;
  assert.equal(first.state, "requested"); assert.equal(first.available.releaseId, "pico-1.1.0"); assert.equal(first.desired.releaseId, "pico-1.1.0"); assert.equal(first.installed.releaseId, "pico-1.0.0");
  const staged = value(recoverUpdate(through(2))).status;
  assert.equal(staged.state, "staged"); assert.equal(staged.installed.releaseId, "pico-1.0.0");
  const trial = value(recoverUpdate(through(3))).status;
  assert.equal(trial.installed.releaseId, "pico-1.1.0"); assert.equal(trial.confirmed.releaseId, "pico-1.0.0"); assert.equal(trial.installed.health, "unknown");
  const confirmed = value(recoverUpdate(through(4))).status;
  assert.equal(confirmed.state, "confirmed"); assert.equal(confirmed.confirmed.releaseId, "pico-1.1.0"); assert.equal(confirmed.installed.source.bootId, "pico-trial-boot");
});

test("scoped idempotency rejects changed target/artifact/source/deadline and retries return the same journal even after expiry", () => {
  const j = through(2), b = admission(); b.nowUtc = "2026-10-08T00:00:00.000Z";
  const duplicate = value(requestUpdate([j], updates.request, b));
  assert.equal(duplicate.duplicate, true); assert.deepEqual(duplicate.journal, j);
  for (const mutate of [(r: UpdateRequest) => { r.manifest.target.boardId = "changed-board"; }, (r: UpdateRequest) => { r.manifest.artifact.sha256 = "f".repeat(64); }, (r: UpdateRequest) => { r.manifest.target.moduleId = "other-target"; }, (r: UpdateRequest) => { r.startDeadline = "2026-10-07T12:00:31.000Z"; }]) {
    const r = structuredClone(updates.request); mutate(r); error(requestUpdate([j], r, admission(r)), "IDEMPOTENCY_CONFLICT");
  }
  const other = structuredClone(updates.request); other.operationId = "second-operation";
  error(requestUpdate([j], other, admission(other)), "OPERATION_IN_PROGRESS");
  error(requestUpdate([], updates.request, { ...admission(), authenticatedSource: { ...updates.request.source, bootId: "new-edge-boot" } }), "SOURCE_MISMATCH");
});

test("reservation is serialized before hypothetical dispatch and reconnect/reboot never emits a second installation", () => {
  const staged = through(1), e = updates.events[1], b = boundary(e);
  const reservation = value(reserveReferenceInstallation(staged, e, b));
  assert.equal(reservation.dispatchInstallation, true);
  const recovered = value(recoverUpdate(JSON.parse(JSON.stringify(reservation.journal))));
  assert.equal(recovered.dispatchInstallation, false); assert.equal(recovered.status.installationReserved, true);
  const duplicate = value(reserveReferenceInstallation(recovered.journal, e, b));
  assert.equal(duplicate.dispatchInstallation, false); assert.deepEqual(duplicate.journal, recovered.journal);
  const second = { ...e, eventId: "second-reservation" };
  error(reserveReferenceInstallation(recovered.journal, second, boundary(second)), "INVALID_TRANSITION");
});

test("provenance, scope, source, local health and independent preflight cannot be supplied by a notification", () => {
  const e = updates.events[0];
  error(admitUpdateEvent(journal(), e, { ...boundary(e), artifactVerification: null }), "NOT_AUTHORIZED");
  const reserve = updates.events[1];
  error(admitUpdateEvent(through(1), reserve, { ...boundary(reserve), preflight: null }), "LOCAL_PREFLIGHT_REQUIRED");
  error(admitUpdateEvent(through(1), reserve, { ...boundary(reserve), preflight: { recordId: "parked", independentProtectionOwnerId: "pico", updateSafe: true } }), "LOCAL_PREFLIGHT_REQUIRED");
  const confirm = updates.events[3];
  error(admitUpdateEvent(through(3), confirm, { ...boundary(confirm), localBootObservation: null }), "NOT_AUTHORIZED");
  error(admitUpdateEvent(through(3), confirm, { ...boundary(confirm), owner: "edge" }), "NOT_AUTHORIZED");
  error(admitUpdateEvent(through(3), confirm, { ...boundary(confirm), scope: { ...updates.request.scope, siteId: "wrong-site" } }), "SCOPE_MISMATCH");
  const badBoot = structuredClone(confirm); badBoot.boot!.source.bootId = "cloud-invented-boot";
  error(admitUpdateEvent(through(3), badBoot, boundary(badBoot)), "SOURCE_MISMATCH");
  const unhealthy = structuredClone(confirm); unhealthy.boot!.health = "failed";
  error(admitUpdateEvent(through(3), unhealthy, boundary(unhealthy)), "INVALID_TRANSITION");
  const wrongDigest = structuredClone(confirm); wrongDigest.boot!.artifactDigest = "f".repeat(64);
  error(admitUpdateEvent(through(3), wrongDigest, boundary(wrongDigest)), "TARGET_MISMATCH");
  const hardware = structuredClone(updates.request); hardware.scope.executionMode = "hardware";
  const hardwareInventory = structuredClone(releases.inventory); hardwareInventory.executionMode = "hardware"; for (const m of hardwareInventory.modules) m.capability = { kind: "unavailable", reason: "not-reviewed" };
  error(requestUpdate([], hardware, { ...admission(hardware), inventory: hardwareInventory }), "PHYSICAL_UPDATES_DISABLED");
});

test("deadlines refuse new starts; late boot evidence is retained with recovery-required instead of confirmation", () => {
  error(requestUpdate([], updates.request, { ...admission(), nowUtc: updates.request.startDeadline }), "DEADLINE_EXPIRED");
  const staged = structuredClone(updates.events[0]); staged.observedAt = updates.request.startDeadline;
  error(admitUpdateEvent(journal(), staged, boundary(staged)), "DEADLINE_EXPIRED");
  const confirm = structuredClone(updates.events[3]); confirm.observedAt = updates.request.confirmationDeadline; confirm.boot!.observedAt = confirm.observedAt;
  const late = value(admitUpdateEvent(through(3), confirm, boundary(confirm)));
  const status = value(recoverUpdate(late)).status;
  assert.equal(status.state, "recovery-required"); assert.equal(status.installed.releaseId, "pico-1.1.0"); assert.equal(status.confirmed.releaseId, "pico-1.0.0");
});

test("rollback requires a new local healthy boot of the exact baseline and retains requested release", () => {
  const j = value(admitUpdateEvent(through(3), updates.rollback, boundary(updates.rollback)));
  const state = value(recoverUpdate(j)).status;
  assert.equal(state.state, "rolled-back"); assert.equal(state.installed.releaseId, "pico-1.0.0"); assert.equal(state.desired.releaseId, "pico-1.1.0");
  const oldBoot = structuredClone(updates.rollback); oldBoot.boot!.source = updates.baseline.source; oldBoot.source = updates.baseline.source;
  error(admitUpdateEvent(through(3), oldBoot, boundary(oldBoot)), "SOURCE_MISMATCH");
  const failed = { ...updates.events[0], verification: null, kind: "failed" as const, eventId: "failure", observedAt: "2026-10-07T12:00:05.000Z" };
  const failedJournal = value(admitUpdateEvent(through(3), failed, boundary(failed)));
  assert.equal(value(recoverUpdate(failedJournal)).status.state, "failed");
  const other = { ...updates.request, operationId: "second-operation" };
  error(requestUpdate([failedJournal], other, admission(other)), "OPERATION_IN_PROGRESS");
  value(admitUpdateEvent(failedJournal, updates.rollback, boundary(updates.rollback)));
});

test("strict journals reject reordered transitions, changed duplicate events, spoofed baseline and missing identity", () => {
  const j = through(2); j.events.push(structuredClone(j.events[1])); value(recoverUpdate(j));
  j.events.at(-1)!.reasonCode = "changed"; error(recoverUpdate(j), "IDEMPOTENCY_CONFLICT");
  const order = through(3); [order.events[0], order.events[1]] = [order.events[1], order.events[0]];
  error(recoverUpdate(order));
  const baseline = journal(); baseline.baseline.artifactDigest = "0".repeat(64); error(recoverUpdate(baseline), "TARGET_MISMATCH");
  const badRequest: any = structuredClone(updates.request); delete badRequest.source.bootId; error(validateUpdateRecord("request", badRequest));
  badRequest.source.bootId = "edge-boot"; badRequest.schemaVersion = "arbi.update/2.0"; error(validateUpdateRecord("request", badRequest), "UNSUPPORTED_SCHEMA");
  for (const bytes of ["0", "18446744073709551616"]) {
    const r = structuredClone(updates.request); r.budget.maximumWanBytes = bytes; error(validateUpdateRecord("request", r));
  }
});

test("real offline release producer and updater consume the same fixtures and signed catalog", () => {
  const directory = mkdtempSync(join(tmpdir(), "arbi-release-contract-"));
  try {
    const producer = fileURLToPath(new URL("../scripts/release-producer.mjs", import.meta.url));
    const consumer = fileURLToPath(new URL("../scripts/release-updater.mjs", import.meta.url));
    const catalog = execFileSync(process.execPath, [producer], { encoding: "utf8" });
    assert.equal(catalog.includes("PRIVATE KEY"), false);
    const path = join(directory, "catalog.json"); writeFileSync(path, catalog);
    const result = JSON.parse(execFileSync(process.execPath, [consumer, path], { encoding: "utf8" }));
    assert.equal(result.verifiedArtifactCount, 6); assert.equal(result.updateStateCount, 4); assert.equal(result.rollbackPrefixCount, 3);
    assert.deepEqual(result.statuses.map((s: any) => s.state), ["requested", "staged", "staged", "trial", "confirmed"]);
    assert.equal(result.recoveryDispatch, false);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});


test("operation admission checks observed mixed versions and reversible rollback migration", () => {
  error(requestUpdate([], updates.request, { ...admission(), currentSelections: releases.releaseSet.initial }), "INCOMPATIBLE");
  const signedMismatch = structuredClone(updates.request); signedMismatch.manifest.artifact.signature.value = "f".repeat(128);
  error(requestUpdate([], signedMismatch, admission(signedMismatch)), "INCOMPATIBLE");
  const forward = manifest("edge-1.1.0"), backward = manifest("edge-1.0.0");
  const baseline: UpdateBootObservation = { ...updates.baseline, source: { deviceId: "edge", bootId: "edge-new-boot", sessionId: "edge-new-session" }, releaseId: forward.releaseId, build: forward.build, artifactDigest: forward.artifact.sha256, configurationDataVersion: "1.1.0" };
  const request: UpdateRequest = { ...updates.request, operationId: "edge-rollback-operation", direction: "rollback", manifest: backward, expectedInstalledReleaseId: forward.releaseId, configurationDataVersion: "1.0.0", budget: { ...updates.request.budget, payloadBytes: String(backward.artifact.sizeBytes) } };
  const context = { ...admission(request), baseline, baselineManifest: forward };
  value(requestUpdate([], request, context));
  error(requestUpdate([], request, { ...context, currentSelections: releases.releaseSet.desired }), "INCOMPATIBLE");
  const irreversible = structuredClone(context); irreversible.baselineManifest.configuration.migration!.rollbackTo = null;
  error(requestUpdate([], request, irreversible), "INCOMPATIBLE");
});

test("audit seams preserve intent/source/local-boot correlation without manufacturing device effects", () => {
  const staged = value(updateAuditReferences(through(2), updates.events[1].eventId));
  assert.equal(staged.links.target, null);
  assert.equal(staged.resource.id, updates.request.operationId);
  assert.equal(staged.links.intentEventId, updates.request.auditContext.intentEventId);
  const confirmed = value(updateAuditReferences(through(4), updates.events[3].eventId));
  assert.deepEqual(confirmed.links.target, updates.events[3].boot!.source);
  assert.equal(confirmed.record!.kind, "local-record");
  error(updateAuditReferences(through(4), "unrecorded-event"), "INVALID_RECORD");
});

test("session reconnect cannot fabricate a boot, and persisted verification/preflight records remain bound", () => {
  const trial = structuredClone(updates.events[2]); trial.source.bootId = updates.baseline.source.bootId; trial.boot!.source = trial.source;
  error(admitUpdateEvent(through(2), trial, boundary(trial)), "TARGET_MISMATCH");
  const reserve = through(2); reserve.events[1].preflight!.independentProtectionOwnerId = "pico";
  error(recoverUpdate(reserve), "LOCAL_PREFLIGHT_REQUIRED");
  const artifact = through(1); artifact.events[0].verification!.manifestDigest = "f".repeat(64);
  error(recoverUpdate(artifact), "INVALID_RECORD");
  error(requestUpdate([journal(), through(1)], updates.request, admission()), "IDEMPOTENCY_CONFLICT");
  value(requestUpdate([through(1), through(1)], updates.request, admission()));
});

test("a failed rollback operation can observe restoration of its original newer baseline/data format", () => {
  const old = manifest("edge-1.0.0"), newer = manifest("edge-1.1.0");
  const baseline: UpdateBootObservation = { ...updates.baseline, source: { deviceId: "edge", bootId: "edge-new-boot", sessionId: "edge-new-session" }, releaseId: newer.releaseId, build: newer.build, artifactDigest: newer.artifact.sha256, configurationDataVersion: "1.1.0" };
  const request: UpdateRequest = { ...updates.request, operationId: "edge-rollback-operation", direction: "rollback", manifest: old, expectedInstalledReleaseId: newer.releaseId, configurationDataVersion: "1.0.0", budget: { ...updates.request.budget, payloadBytes: String(old.artifact.sizeBytes) } };
  let j = value(requestUpdate([], request, { ...admission(request), baseline, baselineManifest: newer })).journal;
  const events = structuredClone(updates.events.slice(0, 3));
  for (const e of events) {
    e.operationId = request.operationId; e.artifactDigest = old.artifact.sha256;
    if (e.verification) e.verification = { ...e.verification, manifestDigest: configurationDigest(old), artifactDigest: old.artifact.sha256 };
    if (e.boot) { e.source = { deviceId: "edge", bootId: "edge-old-trial", sessionId: "edge-old-session" }; e.boot = { ...e.boot, source: e.source, releaseId: old.releaseId, build: old.build, artifactDigest: old.artifact.sha256 }; }
    j = value(admitUpdateEvent(j, e, boundary(e)));
  }
  const restored = structuredClone(updates.rollback);
  restored.operationId = request.operationId; restored.artifactDigest = old.artifact.sha256;
  restored.source = { deviceId: "edge", bootId: "edge-restored-boot", sessionId: "edge-restored-session" };
  restored.boot = { ...baseline, source: restored.source, observedAt: restored.observedAt, recordId: "synthetic-restored-new-data" };
  const result = value(recoverUpdate(value(admitUpdateEvent(j, restored, boundary(restored))))).status;
  assert.equal(result.state, "rolled-back"); assert.equal(result.installed.configurationDataVersion, "1.1.0"); assert.equal(result.desired.releaseId, "edge-1.0.0");
});
