import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import type { Scenario } from "@arbi/protocol";
import { loadScenario } from "./runner.js";
import { checkScenarioExpected, q6, referenceTrajectory, runScenario, seededRandom, simulatedAdapters } from "./index.js";

const root = fileURLToPath(new URL("../../arbi-protocol", import.meta.url));
const folder = mkdtempSync(join(tmpdir(), "arbi-scenario-"));
const env = { PATH: process.env.PATH, TMPDIR: folder, LANG: "C", LC_ALL: "C", PYTHONDONTWRITEBYTECODE: "1" };
const runtimes = [
  { name: "TypeScript", executable: process.execPath, args: [fileURLToPath(new URL("runner.js", import.meta.url))] },
  { name: "Python", executable: "python3", args: ["-I", "-B", join(root, "conformance/scenario.py")] },
];
const names = ["healthy", "rejected-command", "disconnected-cloud", "driver-fault", "power-loss"];
const path = (name: string): string => join(root, `fixtures/scenarios/1.0/${name}.json`);
const fixture = JSON.parse(readFileSync(path("healthy"), "utf8")) as Scenario;
after(() => rmSync(folder, { recursive: true, force: true }));
function execute(runtime: typeof runtimes[number], file: string) {
  return spawnSync(runtime.executable, [...runtime.args, file, root, "--trace"], { encoding: "utf8", env, timeout: 30000, maxBuffer: 1_048_576 });
}
for (const name of names) test(`${name}: independent consumers derive identical traces and repeat deterministically`, () => {
  const results = runtimes.map((runtime) => {
    const first = execute(runtime, path(name)), second = execute(runtime, path(name));
    assert.equal(first.status, 0, first.error?.message ?? first.stderr);
    assert.equal(second.status, 0, second.error?.message ?? second.stderr);
    assert.equal(first.stdout, second.stdout);
    return JSON.parse(first.stdout);
  });
  assert.deepEqual(results[0], results[1]);
  assert.ok(results[0].invariants.every((v: { passed: boolean }) => v.passed));
  const s = JSON.parse(readFileSync(path(name), "utf8")) as Scenario;
  assert.equal(results[0].traceDigest, s.expected.traceDigest);
});
interface Mutation { name: string; code: string; change: (s: Scenario) => void }
const mutations: Mutation[] = [
  { name: "unsupported version", code: "UNSUPPORTED_SCHEMA", change: (s) => { (s as { schemaVersion: string }).schemaVersion = "arbi.scenario/2.0"; } },
  { name: "invalid units", code: "UNIT_MISMATCH", change: (s) => { (s.units as { position: string }).position = "m"; } },
  { name: "stale site frame", code: "FRAME_MISMATCH", change: (s) => { s.identity.siteFrame.revision = "frame-stale"; } },
  { name: "stale gimbal frame", code: "FRAME_MISMATCH", change: (s) => { s.identity.gimbalFrame.revision = "gimbal-stale"; } },
  { name: "configuration revision", code: "IDENTITY_MISMATCH", change: (s) => { s.identity.configurationRevision = "config-stale"; } },
  { name: "calibration revision", code: "IDENTITY_MISMATCH", change: (s) => { s.identity.calibrationRevision = "calibration-stale"; } },
  { name: "reference content", code: "IDENTITY_MISMATCH", change: (s) => { s.identity.referenceDigest = "0".repeat(64); } },
  { name: "unknown model", code: "UNSUPPORTED_MODEL", change: (s) => { s.provenance.model.revision = "2.0"; } },
  { name: "impossible position", code: "IMPOSSIBLE_INITIAL", change: (s) => { s.initial.positionMm.z = 4000; } },
  { name: "uncertainty margin", code: "IMPOSSIBLE_INITIAL", change: (s) => { s.initial.positionMm.x = 201; } },
  { name: "fault/state contradiction", code: "IMPOSSIBLE_INITIAL", change: (s) => { s.initial.driverFault = true; } },
  { name: "zero powered rail", code: "IMPOSSIBLE_INITIAL", change: (s) => { s.initial.voltageV = 0; } },
  { name: "gimbal initial bounds", code: "IMPOSSIBLE_INITIAL", change: (s) => { s.initial.panDeg = 95; } },
  { name: "unbounded ticks", code: "CLOCK_INVALID", change: (s) => { s.clock.stepMs = 1; s.clock.durationMs = 1000; } },
  { name: "off-grid event", code: "CLOCK_INVALID", change: (s) => { s.inputs[0].atMs++; } },
  { name: "ambiguous simultaneous order", code: "ORDER_CONFLICT", change: (s) => { s.inputs[1].order = s.inputs[0].order; } },
  { name: "wrong cable result", code: "RESULT_MISMATCH", change: (s) => { s.expected.checkpoints[0].lengthQ6.a++; } },
  { name: "wrong trajectory", code: "RESULT_MISMATCH", change: (s) => { s.trajectories[1].expectedPositionMm.x++; } },
  { name: "wrong outcome graph", code: "RESULT_MISMATCH", change: (s) => { s.transitions[0].expected = "accepted"; } },
  { name: "wrong expected invariant", code: "RESULT_MISMATCH", change: (s) => { s.expected.invariants[0].passed = false; } },
  { name: "changed seed", code: "RESULT_MISMATCH", change: (s) => { s.seed++; } },
  { name: "swapped noise and command order", code: "RESULT_MISMATCH", change: (s) => { const noise = s.inputs.find((i) => i.kind === "voltage-noise" && i.atMs === 1100)!; noise.atMs = 1000; noise.order = 2; } },
  { name: "invalid deadline boot identity", code: "INVALID_COMMAND", change: (s) => { const e = s.inputs.find((i) => i.kind === "command")!; if (e.kind === "command") e.message.command.deadline.bootId = "wrong-boot"; } },
  { name: "uint64 lease overflow", code: "IDENTITY_MISMATCH", change: (s) => { s.gate.lease.fence = "18446744073709551616"; } },
  { name: "too many events", code: "INVALID_SCENARIO", change: (s) => { s.inputs = Array(257).fill(s.inputs.find((i) => i.kind === "voltage-noise")); } },
];
for (const runtime of runtimes) test(`${runtime.name}: reject deliberate scenario discrepancies directly`, async (t) => {
  for (const mutation of mutations) await t.test(mutation.name, () => {
    const s = structuredClone(fixture); mutation.change(s);
    const file = join(folder, `${runtime.name}.json`); writeFileSync(file, JSON.stringify(s));
    const result = execute(runtime, file);
    assert.equal(result.status, 2, result.error?.message ?? result.stderr);
    assert.equal(result.stdout, ""); assert.equal(result.stderr.trim(), mutation.code);
  });
});
for (const runtime of runtimes) test(`${runtime.name}: explicit event order overrides input array and property order`, () => {
  function reverse(v: unknown): unknown {
    if (Array.isArray(v)) return v.map(reverse);
    if (v !== null && typeof v === "object") return Object.fromEntries(Object.entries(v).reverse().map(([k, child]) => [k, reverse(child)]));
    return v;
  }
  const s = structuredClone(fixture); s.inputs.reverse();
  const file = join(folder, `${runtime.name}-order.json`); writeFileSync(file, JSON.stringify(reverse(s), null, 1));
  const result = execute(runtime, file);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).traceDigest, fixture.expected.traceDigest);
});
test("adapter seams exercise local stop, duplicate admission, truthful feedback and isolation", () => {
  const { scenario, configuration, referenceDigest } = loadScenario(path("healthy"), root);
  scenario.inputs = scenario.inputs.filter((i) => i.kind === "command" && i.atMs === 1000);
  scenario.inputs.push(structuredClone(scenario.inputs[0])); scenario.inputs[1].order = 2;
  const result = runScenario(scenario, configuration, referenceDigest); assert.ok(result.ok); if (!result.ok) return;
  assert.equal(result.value.trace.flatMap((r) => r.dispatches).length, 1);
  const adapters = simulatedAdapters(configuration, scenario.initial, scenario.clock.startMs);
  adapters.sensors.read = (atMs) => [{ metric: "position.x", quality: "measured", value: 1000, unit: "mm", frame: scenario.identity.siteFrame, sampleMonotonicMs: atMs, ageMs: 0, uncertainty: 0, reason: null, originQuality: null }];
  const dishonest = runScenario(scenario, configuration, referenceDigest, adapters); assert.ok(dishonest.ok); if (dishonest.ok) assert.equal(dishonest.value.invariants.find((i) => i.id === "truthful-feedback")?.passed, false);
  const hardware = simulatedAdapters(configuration, scenario.initial, scenario.clock.startMs);
  (hardware as { executionMode: string }).executionMode = "hardware";
  const rejected = runScenario(scenario, configuration, referenceDigest, hardware); assert.ok(!rejected.ok);
});
test("PRNG, quantization and analytical trajectories have fixed independent arithmetic anchors", () => {
  const random = seededRandom(42);
  assert.deepEqual([random(), random(), random(), random()], [1083814273, 378494188, 2479403867, 955863294]);
  assert.equal(q6(0.0000005), 1); assert.equal(q6(-0.0000005), 0); assert.equal(q6(-0.0000015), -1);
  assert.deepEqual(referenceTrajectory({ x: -3, y: 10, z: 1000 }, { x: 7, y: -10, z: 1005 }, 100, 25), { x: -0.5, y: 5, z: 1001.25 });
  assert.throws(() => referenceTrajectory({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }, 0, 0), /INVALID_TRAJECTORY/);
  const { scenario, configuration, referenceDigest } = loadScenario(path("healthy"), root);
  const run = runScenario(scenario, configuration, referenceDigest); assert.ok(run.ok); if (run.ok) assert.doesNotThrow(() => checkScenarioExpected(scenario, run.value));
});
for (const runtime of runtimes) test(`${runtime.name}: raw hostile files fail with bounded errors`, () => {
  let deep: unknown = 0; for (let i = 0; i < 40; i++) deep = { child: deep };
  for (const [content, error] of [["x".repeat(262145), "SCENARIO_TOO_LARGE"], [JSON.stringify(deep), "INPUT_LIMIT"], ['{"private":"synthetic-sensitive-data"', "INVALID_JSON"]]) {
    const file = join(folder, `${runtime.name}-hostile.json`); writeFileSync(file, content);
    const result = execute(runtime, file); assert.equal(result.status, 2); assert.equal(result.stdout, ""); assert.equal(result.stderr.trim(), error);
  }
});
test("simultaneous faults precede commands by explicit order and stop remains available in Fault", () => {
  const { scenario, configuration, referenceDigest } = loadScenario(path("power-loss"), root);
  scenario.inputs.find((e) => e.kind === "power")!.atMs = 1000;
  const result = runScenario(scenario, configuration, referenceDigest); assert.ok(result.ok); if (!result.ok) return;
  assert.equal(result.value.trace[0].state, "Fault");
  assert.equal(result.value.trace[0].dispatches.length, 0);
  assert.equal(result.value.trace[0].outcomes.at(-1)?.error, "FAULT_INHIBITED");
  assert.equal(result.value.trace.find((r) => r.atMs === 1200)?.outcomes.at(-1)?.outcome, "completed");
  assert.equal(result.value.trace.at(-1)?.state, "Fault");
});
test("bounded expiry fails a stalled motor adapter without a cloud or an inferred safe state", () => {
  const { scenario, configuration, referenceDigest } = loadScenario(path("disconnected-cloud"), root);
  const adapters = simulatedAdapters(configuration, scenario.initial, scenario.clock.startMs);
  adapters.motors.advance = () => false;
  const result = runScenario(scenario, configuration, referenceDigest, adapters); assert.ok(result.ok); if (!result.ok) return;
  assert.equal(result.value.trace.at(-1)?.outcomes.at(-1)?.error, "DEADLINE_EXPIRED");
  assert.equal(result.value.invariants.find((i) => i.id === "local-progress-offline")?.passed, false);
});
