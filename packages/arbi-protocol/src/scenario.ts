import { readFileSync } from "node:fs";
import { Ajv2020 } from "ajv/dist/2020.js";
import { configurationDigest, validateConfigurationRecord } from "./configuration.js";
import type { Configuration } from "./configuration-types.js";
import type { VectorMm } from "./messages.js";
import type { Scenario, ScenarioInvariantId } from "./scenario-types.js";
import { MAX_COUNTER, validateMessage } from "./validate.js";

export const SCENARIO_VERSION = "arbi.scenario/1.0";
export const MAX_SCENARIO_BYTES = 262_144;
export const MAX_SCENARIO_TICKS = 512;
export const SCENARIO_UNITS = { position: "mm", angle: "deg", speed: "mm/s", acceleration: "mm/s^2", force: "N", time: "ms", voltage: "V" } as const;
export const SCENARIO_IMPLEMENTATION = {
  model: { id: "arbi.affine-reference", revision: "1.0", buildId: "affine-reference-1" },
  controller: { id: "arbi.protocol-reference", revision: "1.0", buildId: "protocol-reference-1" },
  runner: { id: "arbi.offline-runner", revision: "1.0", buildId: "offline-runner-1" },
  evidence: "synthetic-host-reference", fidelity: "affine-kinematic-no-dynamics",
} as const;
export const SCENARIO_INVARIANTS: ScenarioInvariantId[] = ["within-workspace", "truthful-feedback", "rejected-no-dispatch", "local-progress-offline", "bounded-trace"];
export type ScenarioErrorCode = "INVALID_JSON" | "SCENARIO_TOO_LARGE" | "INPUT_LIMIT" | "INVALID_SCENARIO" | "UNSUPPORTED_SCHEMA" | "UNKNOWN_FIELD" | "UNIT_MISMATCH" | "FRAME_MISMATCH" | "IDENTITY_MISMATCH" | "INVALID_CONFIGURATION" | "IMPOSSIBLE_INITIAL" | "CLOCK_INVALID" | "ORDER_CONFLICT" | "INVALID_COMMAND" | "UNSUPPORTED_MODEL";
export type ScenarioResult<T> = { ok: true; value: T } | { ok: false; error: { code: ScenarioErrorCode; path: string } };
const fail = (code: ScenarioErrorCode, path = "/"): ScenarioResult<never> => ({ ok: false, error: { code, path: path.slice(0, 256) } });
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const same = (a: unknown, b: unknown): boolean => configurationDigest(a) === configurationDigest(b);
const message = JSON.parse(readFileSync(new URL("../schema/message.schema.json", import.meta.url), "utf8"));
const schema = JSON.parse(readFileSync(new URL("../schema/scenario.schema.json", import.meta.url), "utf8"));
const ajv = new Ajv2020({ strict: true, strictTypes: false, allErrors: false });
ajv.addFormat("date-time", { type: "string", validate: (v: string) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString() === v });
ajv.addSchema(message);
const validate = ajv.compile(schema);

/** Copy only bounded plain JSON before invoking recursive schema/digest code. No toJSON/getters. */
function boundedJson(input: unknown): unknown {
  const active = new Set<object>();
  let nodes = 0, budget = 0;
  function copy(v: unknown, depth: number): unknown {
    if (++nodes > 20_000 || depth > 32) throw new Error("INPUT_LIMIT");
    if (typeof v === "string") {
      if (v.length > 32_768) throw new Error("INPUT_LIMIT");
      budget += Buffer.byteLength(v, "utf8") + 2;
    } else budget += 8;
    if (budget > MAX_SCENARIO_BYTES) throw new Error("SCENARIO_TOO_LARGE");
    if (v === null || typeof v === "string" || typeof v === "boolean") return v;
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v !== "object" || active.has(v)) throw new Error("INVALID_SCENARIO");
    if (Object.getOwnPropertySymbols(v).length) throw new Error("INVALID_SCENARIO");
    const prototype = Object.getPrototypeOf(v);
    if (Array.isArray(v) ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) throw new Error("INVALID_SCENARIO");
    active.add(v);
    const keys = Object.keys(v);
    if (keys.length > 20_000 || Array.isArray(v) && (v.length > 20_000 || keys.length !== v.length)) throw new Error("INPUT_LIMIT");
    if (Array.isArray(v) && keys.some((key, index) => key !== String(index))) throw new Error("INVALID_SCENARIO");
    const out: Record<string, unknown> | unknown[] = Array.isArray(v) ? [] : Object.create(null);
    for (const key of keys) {
      if (key.length > 128) throw new Error("INPUT_LIMIT");
      const descriptor = Object.getOwnPropertyDescriptor(v, key)!;
      if (!Object.hasOwn(descriptor, "value")) throw new Error("INVALID_SCENARIO");
      budget += key.length;
      Object.defineProperty(out, key, { value: copy(descriptor.value, depth + 1), enumerable: true, writable: true, configurable: true });
    }
    active.delete(v);
    return out;
  }
  const result = copy(input, 0);
  if (Buffer.byteLength(JSON.stringify(result), "utf8") > MAX_SCENARIO_BYTES) throw new Error("SCENARIO_TOO_LARGE");
  return result;
}
export function scenarioPositionInside(position: VectorMm, config: Configuration): boolean {
  return (["x", "y", "z"] as const).every((axis) => position[axis] >= config.limits.workspace.minMm[axis] + config.calibration!.uncertaintyMm && position[axis] <= config.limits.workspace.maxMm[axis] - config.calibration!.uncertaintyMm);
}
/** Offline scenario validation grants no runtime/hardware authority. Config and reference identity are explicit inputs. */
export function validateScenario(input: unknown, configuration: unknown, referenceDigest: string): ScenarioResult<Scenario> {
  let v: unknown, configInput: unknown;
  try { v = boundedJson(input); configInput = boundedJson(configuration); }
  catch (error) { return fail(error instanceof Error && ["INPUT_LIMIT", "SCENARIO_TOO_LARGE"].includes(error.message) ? error.message as ScenarioErrorCode : "INVALID_SCENARIO"); }
  if (!record(v)) return fail("INVALID_SCENARIO");
  if (v.schemaVersion !== SCENARIO_VERSION) return fail("UNSUPPORTED_SCHEMA", "/schemaVersion");
  if (!same(v.units, SCENARIO_UNITS)) return fail("UNIT_MISMATCH", "/units");
  if (!validate(v)) {
    const e = validate.errors?.[0];
    return fail(e?.keyword === "additionalProperties" ? "UNKNOWN_FIELD" : "INVALID_SCENARIO", e?.instancePath || "/");
  }
  const s = v as Scenario;
  const parsed = validateConfigurationRecord(configInput, "configuration");
  if (!parsed.ok) return fail("INVALID_CONFIGURATION", "/configuration");
  const config = parsed.value, identity = s.identity, calibration = config.calibration;
  if (config.executionMode !== "simulation" || config.realm.environment === "production" || !calibration || calibration.scope !== "simulation") return fail("IDENTITY_MISMATCH", "/identity");
  if (!same([config.schemaVersion, config.revision, configurationDigest(config), config.geometry.revision, calibration.revision, referenceDigest], [identity.configurationSchema, identity.configurationRevision, identity.configurationDigest, identity.geometryRevision, identity.calibrationRevision, identity.referenceDigest])) return fail("IDENTITY_MISMATCH", "/identity");
  if (!same(config.geometry.siteFrame, identity.siteFrame) || !same(config.geometry.gimbalFrame, identity.gimbalFrame)) return fail("FRAME_MISMATCH", "/identity");
  if (!same(s.provenance, SCENARIO_IMPLEMENTATION)) return fail("UNSUPPORTED_MODEL", "/provenance");
  const { startMs, durationMs, stepMs } = s.clock, endMs = startMs + durationMs;
  const onGrid = (at: number): boolean => at >= startMs && at <= endMs && (at - startMs) % stepMs === 0;
  if (durationMs % stepMs !== 0 || durationMs / stepMs + 1 > MAX_SCENARIO_TICKS) return fail("CLOCK_INVALID", "/clock");
  if (!scenarioPositionInside(s.initial.positionMm, config) || s.initial.panDeg < config.limits.panDeg.min || s.initial.panDeg > config.limits.panDeg.max || s.initial.tiltDeg < config.limits.tiltDeg.min || s.initial.tiltDeg > config.limits.tiltDeg.max || (s.initial.driverFault || !s.initial.powerAvailable) !== (s.initial.state === "Fault") || s.initial.powerAvailable && s.initial.voltageV <= 0) return fail("IMPOSSIBLE_INITIAL", "/initial");
  if (BigInt(s.gate.lease.fence) > MAX_COUNTER || s.gate.lease.expiresMonotonicMs <= startMs || s.gate.lease.holderId !== s.gate.actor.id || !config.components.some((c) => c.id === s.gate.receiver.deviceId && c.kind === "module" && c.role === "edge")) return fail("IDENTITY_MISMATCH", "/gate");
  const orders = new Set<string>();
  for (const [i, event] of s.inputs.entries()) {
    if (!onGrid(event.atMs)) return fail("CLOCK_INVALID", `/inputs/${i}/atMs`);
    const key = `${event.atMs}/${event.order}`;
    if (orders.has(key)) return fail("ORDER_CONFLICT", `/inputs/${i}/order`);
    orders.add(key);
    if (event.kind === "power" && event.available && event.voltageV <= 0) return fail("INVALID_SCENARIO", `/inputs/${i}/voltageV`);
    if (event.kind === "command" && !validateMessage(event.message).ok) return fail("INVALID_COMMAND", `/inputs/${i}/message`);
  }
  if (new Set(s.expected.invariants.map((i) => i.id)).size !== SCENARIO_INVARIANTS.length || s.expected.checkpoints.some((c) => !onGrid(c.atMs)) || new Set(s.expected.checkpoints.map((c) => c.atMs)).size !== s.expected.checkpoints.length || new Set(s.expected.outcomes.map((o) => o.commandId)).size !== s.expected.outcomes.length) return fail("INVALID_SCENARIO", "/expected");
  return { ok: true, value: s };
}
export function parseScenario(json: string, configuration: unknown, referenceDigest: string): ScenarioResult<Scenario> {
  if (Buffer.byteLength(json, "utf8") > MAX_SCENARIO_BYTES) return fail("SCENARIO_TOO_LARGE");
  try { return validateScenario(JSON.parse(json), configuration, referenceDigest); } catch { return fail("INVALID_JSON"); }
}
