import { SCENARIO_IMPLEMENTATION, SCENARIO_INVARIANTS, scenarioPositionInside, validateScenario, type Configuration } from "@arbi/protocol";
import { LINES, PLANT_VERSION, type PlantScenario } from "./plant-types.js";

const fail = (): never => { throw new Error("INVALID_PLANT"); };
/** Bounded plain JSON copy before shape checking; rejects cycles/accessors without invoking them. */
function copyJson(input: unknown): any {
  let nodes = 0, bytes = 0;
  const active = new Set<object>();
  /** Copy one JSON subtree while enforcing resource limits and rejecting accessors/cycles. */
  function copy(v: any, depth: number): any {
    if (++nodes > 20000 || depth > 32) fail();
    if (v === null || typeof v === "boolean") return v;
    if (typeof v === "number") { if (!Number.isFinite(v)) fail(); return v; }
    if (typeof v === "string") { bytes += Buffer.byteLength(v); if (bytes > 262144 || v.length > 32768) fail(); return v; }
    if (typeof v !== "object" || active.has(v) || Object.getOwnPropertySymbols(v).length) fail();
    const p = Object.getPrototypeOf(v);
    if (Array.isArray(v) ? p !== Array.prototype : p !== Object.prototype && p !== null) fail();
    active.add(v);
    const keys = Object.keys(v), out: any = Array.isArray(v) ? [] : Object.create(null);
    if (keys.length > 20000 || Array.isArray(v) && (v.length !== keys.length || keys.some((k, i) => k !== String(i)))) fail();
    for (const key of keys) {
      bytes += key.length; if (key.length > 128 || bytes > 262144) fail();
      const d = Object.getOwnPropertyDescriptor(v, key)!; if (!Object.hasOwn(d, "value")) fail();
      Object.defineProperty(out, key, { value: copy(d.value, depth + 1), enumerable: true, writable: true });
    }
    active.delete(v); return out;
  }
  const result = copy(input, 0);
  if (Buffer.byteLength(JSON.stringify(result)) > 262144) fail();
  return result;
}
/** Require exactly the closed JSON object fields owned by this boundary. */
function keys(v: any, fields: string[]): void {
  if (!v || typeof v !== "object" || Array.isArray(v) || Object.keys(v).length !== fields.length || fields.some((k) => !Object.hasOwn(v, k))) fail();
}
/** Reject nonfinite, out-of-range or noninteger parameter values with a bounded code. */
function range(n: any, min: number, max: number, integer = false): void {
  if (typeof n !== "number" || !Number.isFinite(n) || n < min || n > max || integer && !Number.isSafeInteger(n)) fail();
}
/** Validate the additive model shape and delegate protocol/scenario context to its owning validator. */
function validatePlantRecord(input: unknown, config: Configuration, referenceDigest: string): PlantScenario {
  const p = copyJson(input) as PlantScenario;
  keys(p, ["schemaVersion", "context", "parameters", "inputs", "returnCommandIds", "expected"]);
  if (p.schemaVersion !== PLANT_VERSION) throw new Error("UNSUPPORTED_PLANT");
  keys(p.context, ["id", "executionMode", "identity", "units", "clock", "seed", "gate", "initial"]);
  if (!Array.isArray(p.inputs) || p.inputs.length > 256) fail();
  const extras = p.inputs.filter((e) => ["sensor", "driver-enabled", "motor-stall", "camera-fault"].includes(e.kind));
  const scenario = validateScenario({ ...p.context, schemaVersion: "arbi.scenario/1.0", provenance: SCENARIO_IMPLEMENTATION,
    inputs: p.inputs.filter((e) => !extras.includes(e)), trajectories: [{ id: "plant-envelope", startMm: p.context.initial.positionMm, targetMm: p.context.initial.positionMm, durationMs: p.context.clock.stepMs, elapsedMs: 0, expectedPositionMm: p.context.initial.positionMm }], transitions: [{ current: null, next: "requested", expected: "requested" }],
    expected: { traceDigest: "0".repeat(64), invariants: SCENARIO_INVARIANTS.map((id) => ({ id, passed: true })), checkpoints: [{ atMs: p.context.clock.startMs, state: p.context.initial.state, positionQ6: { x: 0, y: 0, z: 0 }, lengthQ6: { a: 0, b: 0, c: 0, d: 0 } }], outcomes: [] },
  }, config, referenceDigest);
  if (!scenario.ok) throw new Error(scenario.error.code);
  const { clock } = scenario.value, end = clock.startMs + clock.durationMs;
  const orders = new Set<string>();
  for (const e of p.inputs) {
    range(e.atMs, clock.startMs, end, true); range(e.order, 0, 255, true);
    if ((e.atMs - clock.startMs) % clock.stepMs || orders.has(`${e.atMs}/${e.order}`)) throw new Error("ORDER_CONFLICT");
    orders.add(`${e.atMs}/${e.order}`);
    if (e.kind === "sensor") { keys(e, ["atMs", "order", "kind", "sensor", "value"]); if (!["home", "limit", "dock"].includes(e.sensor) || typeof e.value !== "boolean") fail(); }
    else if (e.kind === "driver-enabled" || e.kind === "motor-stall" || e.kind === "camera-fault") { keys(e, ["atMs", "order", "kind", "active"]); if (typeof e.active !== "boolean") fail(); }
  }
  const a = p.parameters;
  keys(a, ["drums", "motor", "sensors", "dock", "power", "gimbal", "camera", "noise"]);
  keys(a.drums, [...LINES]);
  for (const line of LINES) {
    const d = a.drums[line]; keys(d, ["radiusMm", "stepsPerRevolution", "direction", "zeroPayoutMm", "minPayoutMm", "maxPayoutMm", "maxStepRatePerS"]);
    range(d.radiusMm, 1, 1000); range(d.stepsPerRevolution, 1, 1000000, true); if (d.direction !== 1 && d.direction !== -1) fail();
    range(d.zeroPayoutMm, 0, 1000000); range(d.minPayoutMm, 0, 1000000); range(d.maxPayoutMm, d.minPayoutMm + 1, 1000000); range(d.maxStepRatePerS, 1, 1000000);
  }
  keys(a.motor, ["enabled", "delayMs", "jitterMs"]); if (typeof a.motor.enabled !== "boolean") fail();
  keys(a.gimbal, ["rateDegPerS", "delayMs", "jitterMs", "settleMs"]); range(a.gimbal.rateDegPerS, 0.1, 10000);
  keys(a.camera, ["delayMs", "jitterMs"]);
  keys(a.power, ["minVoltageV", "maxVoltageV", "bootMs"]); range(a.power.minVoltageV, 1, 60); range(a.power.maxVoltageV, a.power.minVoltageV + 0.01, 60);
  keys(a.dock, ["positionMm", "toleranceMm", "debounceMs", "timeoutMs"]); keys(a.dock.positionMm, ["x", "y", "z"]);
  Object.values(a.dock.positionMm).forEach((v) => range(v, -1000000, 1000000));
  range(a.dock.toleranceMm, 0, 100); if (!scenarioPositionInside(a.dock.positionMm, config)) fail();
  for (const value of [a.motor.delayMs, a.motor.jitterMs, a.gimbal.delayMs, a.gimbal.jitterMs, a.gimbal.settleMs, a.camera.delayMs, a.camera.jitterMs, a.power.bootMs, a.dock.debounceMs, a.dock.timeoutMs]) range(value, 0, 30000, true);
  if (a.dock.timeoutMs < clock.stepMs) fail();
  keys(a.noise, ["positionAmplitudeMm"]); range(a.noise.positionAmplitudeMm, 0, 100);
  keys(a.sensors, ["home", "limit", "dock"]); if (Object.values(a.sensors).some((v) => !["unavailable", "virtual-input"].includes(v))) fail();
  if (!Array.isArray(p.returnCommandIds) || p.returnCommandIds.length > 256 || new Set(p.returnCommandIds).size !== p.returnCommandIds.length) fail();
  for (const id of p.returnCommandIds) if (typeof id !== "string" || !p.inputs.some((e) => e.kind === "command" && e.message.command.commandId === id && e.message.body.type === "motion.move")) fail();
  keys(p.expected, ["states", "traceDigest"]);
  if (typeof p.expected.traceDigest !== "string" || !/^[a-f0-9]{64}$/.test(p.expected.traceDigest) || !Array.isArray(p.expected.states) || p.expected.states.length > 512) fail();
  for (const row of p.expected.states) { keys(row, ["atMs", "state", "captures"]); range(row.atMs, clock.startMs, end, true); range(row.captures, 0, 256, true); if ((row.atMs - clock.startMs) % clock.stepMs || !["Ready", "Moving", "Settling", "Capturing", "Returning", "Docking", "Parked", "Fault"].includes(row.state)) fail(); }
  return p;
}

/** All malformed library inputs fail with a bounded code, without echoing their contents. */
export function validatePlant(input: unknown, config: Configuration, referenceDigest: string): PlantScenario {
  try { return validatePlantRecord(input, config, referenceDigest); }
  catch (e) {
    const code = e instanceof Error ? e.message : "INVALID_PLANT";
    throw new Error(/^(INVALID_PLANT|UNSUPPORTED_PLANT|INVALID_SCENARIO|UNSUPPORTED_SCHEMA|UNKNOWN_FIELD|UNIT_MISMATCH|FRAME_MISMATCH|IDENTITY_MISMATCH|INVALID_CONFIGURATION|IMPOSSIBLE_INITIAL|CLOCK_INVALID|ORDER_CONFLICT|INVALID_COMMAND|UNSUPPORTED_MODEL|INPUT_LIMIT|SCENARIO_TOO_LARGE)$/.test(code) ? code : "INVALID_PLANT");
  }
}
