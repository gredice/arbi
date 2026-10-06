import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import type { Command, Event, Message, Telemetry } from "./messages.js";
import { parseMessage, validateMessage, MAX_MESSAGE_BYTES, type Result } from "./validate.js";
import { admitCommand, advanceCursor, advanceOutcome, ageSample, applyTelemetry, createCommandLedger, createTelemetryState, transportAgeUpperBound, type CommandGate, type TelemetryContext } from "./reference.js";

interface FixtureSet {
  valid: Record<string, Message>;
  invalid: Array<{ name: string; base: string; changes: Array<{ path: Array<string | number>; value: unknown }>; error: string }>;
}
const fixtures = JSON.parse(readFileSync(new URL("../fixtures/contracts.json", import.meta.url), "utf8")) as FixtureSet;
const move = (): Command => structuredClone(fixtures.valid.move) as Command;
const telemetry = (): Telemetry => structuredClone(fixtures.valid.telemetry) as Telemetry;
const receiver = move().command.target;
const context = (): CommandGate => ({
  realm: move().realm, executionMode: "simulation", siteId: move().siteId, authenticatedSource: move().source,
  receiver, nowMonotonicMs: 1000, maxDeadlineAheadMs: 30000, authorizedActor: { kind: "human", id: "operator-1" },
  allowedTypes: ["motion.move", "control.stop", "camera.gimbal", "camera.capture", "camera.preview.start", "camera.preview.stop", "command.cancel", "state.resync"],
  supportedTypes: ["motion.move", "control.stop", "camera.gimbal", "camera.capture", "camera.preview.start", "camera.preview.stop", "command.cancel", "state.resync"],
  configRevision: "config-1", faultInhibited: false,
  lease: { id: "lease-1", holderId: "operator-1", fence: "9007199254740993", receiver, expiresMonotonicMs: 2000 },
});
const telemetryContext = (): TelemetryContext => ({
  realm: telemetry().realm, executionMode: "simulation", siteId: telemetry().siteId, authenticatedSource: telemetry().source,
  activeSource: receiver, capabilitiesRevision: "cap-1",
  capabilities: [{ metric: "position.x", qualities: ["commanded", "estimated"] }, { metric: "line.tension.a", qualities: [] }],
});
function error(result: Result<unknown>, code: string): void {
  assert.equal(result.ok, false, JSON.stringify(result));
  if (!result.ok) assert.equal(result.error.code, code);
}

for (const [name, value] of Object.entries(fixtures.valid)) test(`valid and JSON round-trip: ${name}`, () => {
  const result = parseMessage(JSON.stringify(value));
  assert.equal(result.ok, true, JSON.stringify(result));
  if (result.ok) assert.deepEqual(result.value, value);
});
for (const fixture of fixtures.invalid) test(`stable boundary failure: ${fixture.name}`, () => {
  const value = structuredClone(fixtures.valid[fixture.base]);
  for (const change of fixture.changes) {
    let target: unknown = value;
    for (const segment of change.path.slice(0, -1)) target = (target as Record<string | number, unknown>)[segment];
    (target as Record<string | number, unknown>)[change.path.at(-1)!] = change.value;
  }
  error(validateMessage(value), fixture.error);
});
test("malformed, oversized and non-finite input", () => {
  error(parseMessage("{"), "INVALID_JSON");
  error(parseMessage(" ".repeat(MAX_MESSAGE_BYTES + 1)), "MESSAGE_TOO_LARGE");
  const m = move();
  if (m.body.type === "motion.move") m.body.positionMm.x = NaN;
  error(validateMessage(m), "INVALID_MESSAGE");
});
test("duplicate admission returns receipt after expiry without replay; changed intent conflicts", () => {
  const ledger = createCommandLedger();
  assert.equal(admitCommand(move(), context(), ledger).ok, true);
  const duplicate = move(); duplicate.sequence = "11"; duplicate.messageId = "retry-1";
  duplicate.command.target = { sessionId: receiver.sessionId, deviceId: receiver.deviceId, bootId: receiver.bootId };
  const replay = admitCommand(duplicate, { ...context(), nowMonotonicMs: 2000 }, ledger);
  assert.equal(replay.ok && replay.value.decision, "duplicate");
  assert.equal(ledger.receipts.size, 1);
  if (duplicate.body.type === "motion.move") duplicate.body.positionMm.x++;
  error(admitCommand(duplicate, context(), ledger), "IDEMPOTENCY_CONFLICT");
});
test("reboot and reconnect invalidate old commands even when a receipt exists", () => {
  const ledger = createCommandLedger(); admitCommand(move(), context(), ledger);
  error(admitCommand(move(), { ...context(), receiver: { ...receiver, bootId: "edge-boot-2" } }, ledger), "TARGET_RESTARTED");
  error(admitCommand(move(), { ...context(), receiver: { ...receiver, sessionId: "edge-session-2" } }, ledger), "SESSION_MISMATCH");
});
test("late command rejected by receiver monotonic time regardless of UTC skew", () => {
  const m = move(); m.sourceTime.utc = "2099-01-01T00:00:00.000Z";
  error(admitCommand(m, { ...context(), nowMonotonicMs: 1500 }, createCommandLedger()), "DEADLINE_EXPIRED");
  m.sourceTime.utc = null; m.sourceTime.uncertaintyMs = null;
  assert.equal(admitCommand(m, context(), createCommandLedger()).ok, true);
  m.command.deadline.expiresMonotonicMs = 31001;
  error(admitCommand(m, context(), createCommandLedger()), "DEADLINE_TOO_FAR");
});
test("exact fence, holder, receiver epoch and lease expiry are required", () => {
  const m = move(); m.command.lease!.fence = "9007199254740992";
  error(admitCommand(m, context(), createCommandLedger()), "LEASE_STALE");
  m.command.lease = null;
  error(admitCommand(m, context(), createCommandLedger()), "LEASE_REQUIRED");
  const c = context(); c.lease!.expiresMonotonicMs = 1499;
  error(admitCommand(move(), c, createCommandLedger()), "LEASE_EXPIRED");
  c.lease!.expiresMonotonicMs = 2000; c.lease!.receiver = { ...receiver, bootId: "old" };
  error(admitCommand(move(), c, createCommandLedger()), "LEASE_STALE");
});
test("authorization, realm, site and source remain mandatory for stop", () => {
  const stop = structuredClone(fixtures.valid.stop);
  assert.equal(admitCommand(stop, { ...context(), lease: null, faultInhibited: true }, createCommandLedger()).ok, true);
  error(admitCommand(stop, { ...context(), authorizedActor: { kind: "human", id: "other" } }, createCommandLedger()), "NOT_AUTHORIZED");
  error(admitCommand(stop, { ...context(), authorizedActor: { kind: "device", id: "operator-1" } }, createCommandLedger()), "NOT_AUTHORIZED");
  error(admitCommand(stop, { ...context(), realm: { ...context().realm, environment: "production" } }, createCommandLedger()), "REALM_MISMATCH");
  error(admitCommand(stop, { ...context(), executionMode: "hardware" }, createCommandLedger()), "REALM_MISMATCH");
  error(admitCommand(stop, { ...context(), siteId: "other" }, createCommandLedger()), "SITE_MISMATCH");
  error(admitCommand(stop, { ...context(), authenticatedSource: receiver }, createCommandLedger()), "SOURCE_MISMATCH");
});
test("config, fault and reordered unique commands inhibit admission", () => {
  error(admitCommand(move(), { ...context(), configRevision: "config-2" }, createCommandLedger()), "CONFIG_MISMATCH");
  error(admitCommand(move(), { ...context(), faultInhibited: true }, createCommandLedger()), "FAULT_INHIBITED");
  error(admitCommand(move(), { ...context(), supportedTypes: ["control.stop"] }, createCommandLedger()), "UNSUPPORTED_CAPABILITY");
  const ledger = createCommandLedger(); admitCommand(move(), context(), ledger);
  const m = move(); m.command.commandId = "command-2"; m.command.idempotencyKey = "key-2"; m.sequence = "9";
  error(admitCommand(m, context(), ledger), "SEQUENCE_REPLAY");
  m.sequence = "11"; m.command.commandId = "command-1";
  error(admitCommand(m, context(), ledger), "IDEMPOTENCY_CONFLICT");
  error(admitCommand(move(), context(), createCommandLedger(0)), "RESOURCE_LIMIT");
});
test("execution duration cannot overrun the remaining receiver deadline", () => {
  const m = move();
  if (m.body.type === "motion.move") m.body.maxDurationMs = 501;
  error(admitCommand(m, context(), createCommandLedger()), "INVALID_RANGE");
});
test("outcomes cannot regress or complete a merely requested command", () => {
  let state: Extract<Event["body"], { type: "command.outcome" }>["outcome"] | null = null;
  for (const next of ["requested", "accepted", "running", "completed"] as const) {
    const result = advanceOutcome(state, next); assert.equal(result.ok, true); state = next;
  }
  error(advanceOutcome(state, "running"), "INVALID_TRANSITION");
  error(advanceOutcome("requested", "completed"), "INVALID_TRANSITION");
  assert.equal(advanceOutcome("running", "failed").ok, true);
  assert.equal(advanceOutcome("running", "cancelled").ok, true);
});
test("event gaps require resync; telemetry gaps tolerate missing samples; epochs never auto-adopt", () => {
  error(advanceCursor(receiver, "event", "1", receiver, "3"), "RESYNC_REQUIRED");
  error(advanceCursor(receiver, "telemetry", "3", receiver, "2"), "SEQUENCE_REPLAY");
  assert.deepEqual(advanceCursor(receiver, "telemetry", "1", receiver, "3"), { ok: true, value: { sequence: "3", gap: true } });
  error(advanceCursor(receiver, "event", "1", { ...receiver, bootId: "boot-2" }, "2"), "RESYNC_REQUIRED");
});
test("telemetry missing measurements stay null; reordered delivery does not mutate state", () => {
  const state = createTelemetryState(); assert.equal(applyTelemetry(telemetry(), telemetryContext(), state).ok, true);
  assert.equal(state.samples.get("line.tension.a")!.value, null);
  assert.equal(state.samples.get("line.tension.a")!.quality, "unavailable");
  const stale = telemetry(); stale.sequence = "9007199254740992"; stale.body.samples[0].value = 2000;
  error(applyTelemetry(stale, telemetryContext(), state), "SEQUENCE_REPLAY");
  assert.equal(state.samples.get("position.x")!.value, 1000);
  const measured = telemetry(); measured.sequence = "9007199254740994"; measured.body.samples[0].quality = "measured";
  error(applyTelemetry(measured, telemetryContext(), state), "QUALITY_UNSUPPORTED");
  assert.equal(state.sequence, "9007199254740993");
});
test("reordered sample time, capability change and reboot require deterministic rejection", () => {
  const state = createTelemetryState(); applyTelemetry(telemetry(), telemetryContext(), state);
  const next = telemetry(); next.sequence = "9007199254740994"; next.body.samples[0].sampleMonotonicMs = 949; next.body.samples[0].ageMs = 51;
  error(applyTelemetry(next, telemetryContext(), state), "SEQUENCE_REPLAY");
  next.body.samples[0].sampleMonotonicMs = 950; next.body.samples[0].ageMs = 50; next.body.capabilitiesRevision = "cap-2";
  error(applyTelemetry(next, telemetryContext(), state), "RESYNC_REQUIRED");
  next.body.capabilitiesRevision = "cap-1"; next.sourceTime.monotonicMs = 999; next.body.samples[0].ageMs = 49;
  error(applyTelemetry(next, telemetryContext(), state), "CLOCK_INVALID");
  next.source.bootId = "boot-2";
  const c = telemetryContext(); c.authenticatedSource = next.source;
  error(applyTelemetry(next, c, state), "RESYNC_REQUIRED");
});
test("unknown transport delay and source staleness cannot appear fresh", () => {
  const sample = telemetry().body.samples[0];
  assert.equal(ageSample(sample, 10, 20, 100).quality, "commanded");
  assert.equal(ageSample(sample, 100, 20, 100).quality, "stale");
  assert.equal(ageSample(sample, 0, null, 100).quality, "stale");
  assert.equal(ageSample(sample, 0, null, 100).originQuality, "commanded");
  const unavailable = telemetry().body.samples[1];
  assert.deepEqual(ageSample(unavailable, 1000, null, 100), unavailable);
});
test("UTC clock uncertainty bounds delay and impossible future clocks fail explicitly", () => {
  const t = telemetry();
  assert.deepEqual(transportAgeUpperBound(t), { ok: true, value: null });
  t.ingestTime = { utc: "2026-10-07T12:00:01.000Z", uncertaintyMs: 100, deviceId: "cloud" };
  assert.deepEqual(transportAgeUpperBound(t), { ok: true, value: 1600 });
  t.sourceTime.utc = "2026-10-07T12:00:01.500Z";
  assert.deepEqual(transportAgeUpperBound(t), { ok: true, value: 100 });
  t.sourceTime.utc = "2026-10-07T12:01:00.000Z";
  error(transportAgeUpperBound(t), "CLOCK_INVALID");
});
test("snapshot cursors bind to the snapshot source and sequence independent of property order", () => {
  const snapshot = structuredClone(fixtures.valid.snapshot) as Event;
  if (snapshot.body.type !== "state.snapshot") assert.fail();
  snapshot.body.eventCursor.source = { sessionId: receiver.sessionId, bootId: receiver.bootId, deviceId: receiver.deviceId };
  assert.equal(validateMessage(snapshot).ok, true);
  snapshot.body.eventCursor.sequence = "12";
  error(validateMessage(snapshot), "INVALID_MESSAGE");
});
test("host Python and C round-trip every representative payload with exact u64 counters", () => {
  const folder = mkdtempSync(join(tmpdir(), "arbi-protocol-"));
  try {
    const binary = join(folder, "roundtrip");
    const compile = spawnSync("cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", fileURLToPath(new URL("../conformance/roundtrip.c", import.meta.url)), "-o", binary], { encoding: "utf8", env: { ...process.env, TMPDIR: folder } });
    assert.equal(compile.status, 0, compile.error?.message ?? compile.stderr);
    for (const [name, message] of Object.entries(fixtures.valid)) {
      for (const [executable, args] of [["python3", [fileURLToPath(new URL("../conformance/roundtrip.py", import.meta.url))]], [binary, []]] as const) {
        const result = spawnSync(executable, [...args], { input: JSON.stringify(message), encoding: "utf8" });
        assert.equal(result.status, 0, `${name}: ${result.error?.message ?? result.stderr}`);
        assert.deepEqual(JSON.parse(result.stdout), message, name);
        assert.equal(parseMessage(result.stdout).ok, true, name);
      }
    }
  } finally { rmSync(folder, { recursive: true, force: true }); }
});
