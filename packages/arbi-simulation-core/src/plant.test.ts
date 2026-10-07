import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { configurationDigest, configurationHardwareDigest, type Command, type Configuration } from "@arbi/protocol";
import { boundedPlantAdapters, cableLengths, checkPlantMove, drumMapping } from "./plant-adapters.js";
import { loadPlant } from "./plant-runner.js";
import { checkPlantExpected, runPlant } from "./plant.js";
import { validatePlant } from "./plant-validation.js";
import type { PlantScenario } from "./plant-types.js";

const root = fileURLToPath(new URL("../../arbi-protocol", import.meta.url));
const fixtureRoot = fileURLToPath(new URL("../fixtures/plant/1.0", import.meta.url));
const folder = mkdtempSync(join(tmpdir(), "arbi-plant-"));
const env = { PATH: process.env.PATH, TMPDIR: folder, LANG: "C", LC_ALL: "C", PYTHONDONTWRITEBYTECODE: "1" };
const runtimes = [
  { name: "TypeScript", executable: process.execPath, args: [fileURLToPath(new URL("plant-runner.js", import.meta.url))] },
  { name: "Python", executable: "python3", args: ["-I", "-B", fileURLToPath(new URL("../conformance/plant.py", import.meta.url))] },
];
after(() => rmSync(folder, { recursive: true, force: true }));
const nominal = () => loadPlant(join(fixtureRoot, "nominal.json"), root);
const execute = (r: typeof runtimes[number], file: string) => spawnSync(r.executable, [...r.args, file, root, "--trace"], { encoding: "utf8", env, timeout: 30000, maxBuffer: 2_097_152 });
function command(p: PlantScenario, atMs: number, id: number, body: Command["body"], order = 1): void {
  const source = p.inputs.find((e) => e.kind === "command")!;
  assert.equal(source.kind, "command"); if (source.kind !== "command") return;
  const message = structuredClone(source.message);
  message.messageId = `extra-${id}`; message.sequence = String(id); message.body = body;
  Object.assign(message.command, { commandId: `extra-${id}`, idempotencyKey: `extra-${id}`, deadline: { ...message.command.deadline, expiresMonotonicMs: atMs + 1500 } });
  p.inputs.push({ kind: "command", atMs, order, message });
}
for (const name of readdirSync(fixtureRoot)) test(`${name}: independent plant consumers agree on every trace row and repeat exactly`, () => {
  const reports = runtimes.map((r) => {
    const first = execute(r, join(fixtureRoot, name)), second = execute(r, join(fixtureRoot, name));
    assert.equal(first.status, 0, first.error?.message ?? first.stderr); assert.equal(second.status, 0, second.error?.message ?? second.stderr);
    assert.equal(first.stdout, second.stdout); return JSON.parse(first.stdout);
  });
  assert.deepEqual(reports[0], reports[1]);
  assert.ok(Object.values(reports[0].invariants).every(Boolean));
});
test("geometry retains the independent protocol vectors and calibrated offsets", () => {
  const { config } = nominal();
  const vectors = JSON.parse(readFileSync(join(root, "fixtures/reference/1.0/vectors.json"), "utf8"));
  for (const v of vectors.geometry) for (const line of ["a", "b", "c", "d"] as const) assert.ok(Math.abs(cableLengths(v.positionMm, config)[line] - v.expectedLengthMm[line]) < 1e-7);
  config.calibration!.lineLengthOffsetsMm.a = 12;
  const first = vectors.geometry[0]; assert.ok(Math.abs(cableLengths(first.positionMm, config).a - first.expectedLengthMm.a - 12) < 1e-7);
});
test("drum direction, zero offset, quantization and payout bounds have arithmetic anchors", () => {
  const d = { radiusMm: 10, stepsPerRevolution: 100, direction: 1 as const, zeroPayoutMm: 100, minPayoutMm: 0, maxPayoutMm: 1000, maxStepRatePerS: 1000 };
  assert.equal(drumMapping(100, d).steps, 0);
  assert.equal(drumMapping(100 + 20 * Math.PI, d).steps, 100);
  assert.equal(drumMapping(100 + 20 * Math.PI, { ...d, direction: -1 }).steps, -100);
  for (const payout of [0, 99.7, 100.3, 1000]) assert.ok(Math.abs(drumMapping(payout, d).reconstructedPayoutMm - payout) <= Math.PI * d.radiusMm / d.stepsPerRevolution + 1e-12);
  assert.throws(() => drumMapping(-0.1, d), /OUTSIDE_LIMITS/); assert.throws(() => drumMapping(1000.1, d), /OUTSIDE_LIMITS/);
});
test("shared Cartesian time drives all four drums and a stop freezes the estimate", () => {
  const { plant, config } = nominal(), a = boundedPlantAdapters(plant, config);
  const target = { ...plant.context.initial.positionMm, z: 2500 };
  assert.equal(a.motion.move(target, 50, 1000), 250);
  a.motion.advance(1100); assert.equal(a.motion.positionEstimateMm().z, 2492.5);
  a.motion.advance(1250); assert.deepEqual(a.motion.positionEstimateMm(), target);
  const length = cableLengths(target, config);
  for (const line of ["a", "b", "c", "d"] as const) assert.ok(Number.isSafeInteger(drumMapping(length[line], plant.parameters.drums[line]).steps));
  a.motion.move(plant.context.initial.positionMm, 50, 1300); a.motion.advance(1400); const stopped = a.motion.positionEstimateMm();
  a.motion.stop(); a.motion.advance(1800); assert.deepEqual(a.motion.positionEstimateMm(), stopped);
});
test("entire segment payout and conservative driver pulse rate are bounded", () => {
  const { plant, config } = nominal();
  const start = plant.context.initial.positionMm, target = { ...start, x: 3000 };
  config.geometry.anchors[0].positionMm = { x: 2000, y: 2000, z: 4000 };
  plant.parameters.drums.a.minPayoutMm = 1600;
  assert.ok(cableLengths(start, config).a > 1600); assert.ok(cableLengths(target, config).a > 1600);
  assert.throws(() => checkPlantMove(start, target, 50, plant, config), /OUTSIDE_LIMITS/);
  const fresh = nominal(); fresh.plant.parameters.drums.a.maxStepRatePerS = 1;
  assert.throws(() => checkPlantMove(start, target, 50, fresh.plant, fresh.config), /OUTSIDE_LIMITS/);
});
test("stops cancel a move before its completion and remain available offline/in Fault", () => {
  const { plant, config, referenceDigest } = nominal();
  plant.inputs = plant.inputs.filter((e) => e.kind === "command" && e.atMs === 1000); plant.returnCommandIds = [];
  plant.inputs.push({ atMs: 1100, order: 0, kind: "cloud", connected: false });
  command(plant, 1100, 30, { type: "control.stop", reason: "operator" });
  const r = runPlant(plant, config, referenceDigest), row = r.trace.find((r) => r.atMs === 1100)!;
  assert.equal(row.state, "Ready"); assert.equal(row.positionQ6.z, 2490000000);
  assert.ok(row.outcomes.some((o) => o.commandId === "plant-command-10" && o.outcome === "cancelled"));
  assert.deepEqual(row.positionQ6, r.trace.at(-1)!.positionQ6);
});
for (const kind of ["driver-fault", "driver-enabled", "motor-stall"] as const) test(`${kind}: bounded local failure never needs cloud health`, () => {
  const { plant, config, referenceDigest } = nominal();
  plant.inputs = plant.inputs.filter((e) => e.kind === "command" && e.atMs === 1000); plant.returnCommandIds = [];
  plant.inputs.push({ atMs: 1050, order: 0, kind, active: kind !== "driver-enabled" }, { atMs: 1100, order: 0, kind: "cloud", connected: false });
  const r = runPlant(plant, config, referenceDigest);
  assert.equal(r.trace.at(-1)!.state, "Fault");
  assert.ok(r.trace.flatMap((r) => r.outcomes).some((o) => o.outcome === "failed"));
  assert.equal(r.trace.at(-1)!.captures, 0);
});
for (const mode of ["unavailable", "stuck-true", "early-true", "bounce", "lost"] as const) test(`dock ${mode}: coordinates cannot establish contact`, () => {
  const { plant, config, referenceDigest } = nominal();
  if (mode === "unavailable") plant.parameters.sensors.dock = "unavailable";
  if (mode === "stuck-true") { plant.inputs = plant.inputs.filter((e) => e.kind !== "sensor"); plant.inputs.push({ atMs: 1000, order: 0, kind: "sensor", sensor: "dock", value: true }); }
  if (mode === "early-true") plant.inputs.find((e) => e.kind === "sensor" && e.value)!.atMs = 1900;
  if (mode === "bounce") { plant.inputs.push({ atMs: 2100, order: 0, kind: "sensor", sensor: "dock", value: false }); }
  if (mode === "lost") plant.inputs.push({ atMs: 2200, order: 0, kind: "sensor", sensor: "dock", value: false });
  const r = runPlant(plant, config, referenceDigest);
  assert.equal(r.trace.at(-1)!.state, "Fault");
  if (mode !== "lost") assert.ok(r.trace.every((r) => r.state !== "Parked"));
  else assert.equal(r.trace.find((r) => r.atMs === 2200)!.outcomes.length, 0);
});
test("camera does not capture while moving or before settling, even after cancellation", () => {
  const { plant, config, referenceDigest } = nominal();
  command(plant, 1050, 30, { type: "camera.capture", resourceId: "busy", maxDurationMs: 500 });
  // Remove future lower sequence commands to exercise cancellation/settle timing directly.
  plant.inputs = plant.inputs.filter((e) => e.kind !== "command" || e.atMs <= 1350); plant.returnCommandIds = [];
  command(plant, 1400, 31, { type: "control.stop", reason: "operator" });
  command(plant, 1450, 32, { type: "camera.capture", resourceId: "unsettled", maxDurationMs: 500 });
  command(plant, 1600, 33, { type: "camera.capture", resourceId: "settled", maxDurationMs: 500 });
  const r = runPlant(plant, config, referenceDigest);
  for (const at of [1050, 1450]) assert.equal(r.trace.find((r) => r.atMs === at)!.outcomes.at(-1)!.error, "INVALID_TRANSITION");
  assert.equal(r.trace.at(-1)!.captures, 1);
});
for (const atMs of [1550, 1650] as const) test(`camera fault at ${atMs}: bounded rejection or failure without a capture`, () => {
  const { plant, config, referenceDigest } = nominal();
  plant.inputs.push({ atMs, order: 0, kind: "camera-fault", active: true });
  const r = runPlant(plant, config, referenceDigest);
  assert.equal(r.trace.at(-1)!.captures, 0);
  assert.ok(r.trace.flatMap((r) => r.outcomes).some((o) => o.error === "EXECUTION_FAILED"));
});
test("power boot delay is readiness only; undervoltage latches Fault and restoration does not resume", () => {
  const { plant, config, referenceDigest } = nominal(); plant.parameters.power.bootMs = 100;
  const r = runPlant(plant, config, referenceDigest);
  assert.equal(r.trace[0].powerReady, false); assert.equal(r.trace[0].outcomes.at(-1)!.error, "FAULT_INHIBITED");
  assert.equal(r.trace.find((r) => r.atMs === 1100)!.powerReady, true);
  plant.parameters.power.bootMs = 0;
  plant.inputs.push({ atMs: 1100, order: 0, kind: "power", available: true, voltageV: 39 }, { atMs: 1150, order: 0, kind: "power", available: true, voltageV: 48 });
  const fault = runPlant(plant, config, referenceDigest); assert.equal(fault.trace.at(-1)!.state, "Fault");
});
test("configured unavailable position/tension feedback stays unavailable beside virtual estimates", () => {
  const { plant, config, referenceDigest } = nominal();
  for (const s of config.signals) if (s.metric?.startsWith("position.") || s.metric?.startsWith("line.tension.")) s.reading = { kind: "unavailable", reason: "sensor-not-installed" };
  config.calibration!.hardwareDigest = configurationHardwareDigest(config); plant.context.identity.configurationDigest = configurationDigest(config);
  const r = runPlant(plant, config, referenceDigest);
  assert.ok(r.trace[0].feedback.filter((s) => s.metric.startsWith("position.") || s.metric.startsWith("line.tension.")).every((s) => s.quality === "unavailable" && s.valueQ6 === null));
  assert.ok(r.trace.every((r) => r.encoderFeedback === "unavailable" && r.origin === "simulated"));
  assert.ok(r.trace[0].localInputs.home.quality === "unavailable");
});
test("duplicate admission dispatches once; rejected commands consume no module delay draw", () => {
  const { plant, config, referenceDigest } = nominal(); const source = structuredClone(plant.inputs[0]); source.order = 2; plant.inputs.push(source);
  const r = runPlant(plant, config, referenceDigest);
  assert.equal(r.trace.flatMap((r) => r.dispatches).filter((i) => i === "plant-command-10").length, 1);
  assert.equal(r.trace[0].randomState, 955863294); // one motor draw, then x/y/z virtual noise draws.
  const rejected = loadPlant(join(fixtureRoot, "out-of-envelope.json"), root);
  assert.equal(runPlant(rejected.plant, rejected.config, rejected.referenceDigest).trace[0].randomState, 2479403867); // noise only.
  assert.ok(r.assumptions.includes("no-acceleration-braking-slip-pid-autofocus-image-bytes-or-update-authority"));
});
const mutations: Array<{ name: string; code: string; change: (p: PlantScenario) => void }> = [
  { name: "version", code: "UNSUPPORTED_PLANT", change: (p) => { (p as { schemaVersion: string }).schemaVersion = "arbi.plant/2.0"; } },
  { name: "unknown parameters", code: "INVALID_PLANT", change: (p) => { (p.parameters as unknown as Record<string, unknown>).unknown = 1; } },
  { name: "zero radius", code: "INVALID_PLANT", change: (p) => { p.parameters.drums.a.radiusMm = 0; } },
  { name: "zero pulse rate", code: "INVALID_PLANT", change: (p) => { p.parameters.drums.a.maxStepRatePerS = 0; } },
  { name: "off-grid sensor", code: "ORDER_CONFLICT", change: (p) => { p.inputs.find((e) => e.kind === "sensor")!.atMs++; } },
  { name: "conflicting event order", code: "ORDER_CONFLICT", change: (p) => { p.inputs.push({ atMs: 1000, order: 1, kind: "sensor", sensor: "home", value: true }); } },
  { name: "invalid dock position", code: "INVALID_PLANT", change: (p) => { p.parameters.dock.positionMm.x = 0; } },
  { name: "negative settling", code: "INVALID_PLANT", change: (p) => { p.parameters.gimbal.settleMs = -1; } },
  { name: "nonmove return", code: "INVALID_PLANT", change: (p) => { p.returnCommandIds = ["plant-command-12"]; } },
  { name: "changed seed", code: "RESULT_MISMATCH", change: (p) => { p.context.seed++; } },
  { name: "wrong checkpoint", code: "RESULT_MISMATCH", change: (p) => { p.expected.states[0].state = "Parked"; } },
  { name: "stale identity", code: "IDENTITY_MISMATCH", change: (p) => { p.context.identity.referenceDigest = "0".repeat(64); } },
];
for (const runtime of runtimes) test(`${runtime.name}: rejects model discrepancies with bounded errors`, async (t) => {
  for (const m of mutations) await t.test(m.name, () => {
    const { plant } = nominal(); m.change(plant); const file = join(folder, `${runtime.name}.json`); writeFileSync(file, JSON.stringify(plant));
    const r = execute(runtime, file); assert.equal(r.status, 2, r.stderr); assert.equal(r.stdout, ""); assert.equal(r.stderr.trim(), m.code);
  });
});
test("library boundary rejects getters, cycles, nonfinite values and hardware identity", () => {
  const { plant, config, referenceDigest } = nominal(); let invoked = false;
  const getter = { ...plant }; Object.defineProperty(getter, "context", { enumerable: true, get: () => { invoked = true; return plant.context; } });
  assert.throws(() => validatePlant(getter, config, referenceDigest), /INVALID_PLANT/); assert.equal(invoked, false);
  const cycle: any = structuredClone(plant); cycle.parameters.loop = cycle; assert.throws(() => validatePlant(cycle, config, referenceDigest), /INVALID_PLANT/);
  plant.parameters.noise.positionAmplitudeMm = NaN; assert.throws(() => validatePlant(plant, config, referenceDigest), /INVALID_PLANT/);
  plant.parameters.noise.positionAmplitudeMm = 0; const hardware: Configuration = { ...config, executionMode: "hardware" };
  assert.throws(() => runPlant(plant, hardware, referenceDigest), /INVALID_CONFIGURATION/);
});
test("worst-case latency and exact max-duration boundaries are checked before dispatch", () => {
  const { plant, config, referenceDigest } = nominal(); const move = plant.inputs[0]; assert.equal(move.kind, "command"); if (move.kind !== "command" || move.message.body.type !== "motion.move") return;
  move.message.body.maxDurationMs = 250;
  assert.equal(runPlant(plant, config, referenceDigest).trace.find((r) => r.atMs === 1250)!.state, "Ready");
  plant.parameters.motor.jitterMs = 1;
  assert.equal(runPlant(plant, config, referenceDigest).trace[0].outcomes.at(-1)!.error, "OUTSIDE_LIMITS");
  assert.equal(runPlant(plant, config, referenceDigest).trace[0].dispatches.length, 0);
});
test("event/property reordering is deterministic and accepted reference expectations still check", () => {
  const { plant, config, referenceDigest } = nominal(), before = runPlant(plant, config, referenceDigest);
  plant.inputs.reverse(); const after = runPlant(plant, config, referenceDigest);
  assert.deepEqual(before, after); assert.doesNotThrow(() => checkPlantExpected(plant, after));
});
for (const runtime of runtimes) test(`${runtime.name}: malformed/oversized/deep model files never echo payloads`, () => {
  let deep: unknown = 0; for (let i = 0; i < 40; i++) deep = { child: deep };
  for (const content of ["x".repeat(262145), JSON.stringify(deep), '{"private":"synthetic-sensitive-data"']) {
    const file = join(folder, `${runtime.name}-hostile.json`); writeFileSync(file, content);
    const r = execute(runtime, file); assert.equal(r.status, 2); assert.equal(r.stdout, ""); assert.equal(r.stderr.trim(), "INVALID_PLANT");
  }
});
test("a fresh home virtual input and sensor disablement preserve provenance", () => {
  const { plant, config, referenceDigest } = nominal(); plant.parameters.sensors.home = "virtual-input";
  plant.inputs.push({ atMs: 1100, order: 0, kind: "sensor", sensor: "home", value: true });
  const r = runPlant(plant, config, referenceDigest); const input = r.trace.find((r) => r.atMs === 1100)!.localInputs.home;
  assert.deepEqual(input, { quality: "estimated", origin: "virtual-input", value: true, sampleMonotonicMs: 1100 });
  assert.equal(r.trace.find((r) => r.atMs === 1100)!.state, "Moving");
});
test("out-of-envelope requests have no dispatch and same-tick local faults win by explicit order", () => {
  const bad = loadPlant(join(fixtureRoot, "out-of-envelope.json"), root), row = runPlant(bad.plant, bad.config, bad.referenceDigest).trace[0];
  assert.equal(row.outcomes.at(-1)!.error, "OUTSIDE_LIMITS"); assert.equal(row.dispatches.length, 0);
  const { plant, config, referenceDigest } = nominal();
  plant.inputs.push({ atMs: 1000, order: 0, kind: "sensor", sensor: "limit", value: true });
  const fault = runPlant(plant, config, referenceDigest).trace[0];
  assert.equal(fault.state, "Fault"); assert.equal(fault.dispatches.length, 0); assert.equal(fault.outcomes.at(-1)!.error, "FAULT_INHIBITED");
});
test("partial shapes fail with named errors and initial Parked never supplies dock authority", () => {
  const { plant, config, referenceDigest } = nominal();
  for (const malformed of [{ ...plant, context: {} }, { ...plant, inputs: [null] }, { ...plant, parameters: null }]) assert.throws(() => validatePlant(malformed, config, referenceDigest), /^Error: INVALID_PLANT$/);
  plant.context.initial.state = "Parked"; plant.inputs = []; plant.returnCommandIds = [];
  const r = runPlant(plant, config, referenceDigest); assert.ok(r.trace.every((r) => r.state === "Ready"));
});
