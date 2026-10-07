import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { configurationDigest } from "./configuration.js";
import { MAX_SCENARIO_BYTES, parseScenario, validateScenario } from "./scenario.js";
import type { Scenario } from "./scenario-types.js";

const config = JSON.parse(readFileSync(new URL("../fixtures/configuration.json", import.meta.url), "utf8")).valid.configuration;
const fixture = JSON.parse(readFileSync(new URL("../fixtures/scenarios/1.0/healthy.json", import.meta.url), "utf8")) as Scenario;
const digest = fixture.identity.referenceDigest;
test("scenario types and runtime validator consume the committed format and copy input", () => {
  const parsed = validateScenario(fixture, config, digest);
  assert.ok(parsed.ok); if (!parsed.ok) return;
  parsed.value.initial.positionMm.z++;
  assert.equal(fixture.initial.positionMm.z, 2490);
});
test("decoded scenario rejects cycles, accessors, nonfinite numbers, prototypes and unbounded depth", () => {
  const cycle: Record<string, unknown> = {}; cycle.self = cycle;
  let calls = 0;
  const accessor = { get schemaVersion() { calls++; return fixture.schemaVersion; } };
  let deep: unknown = null; for (let i = 0; i < 40; i++) deep = { child: deep };
  const arrayWithProperty = Object.assign(Array(1), { extra: "discarded" });
  for (const [input, code] of [[cycle, "INVALID_SCENARIO"], [accessor, "INVALID_SCENARIO"], [NaN, "INVALID_SCENARIO"], [new Date(), "INVALID_SCENARIO"], [Object.create(Array.prototype), "INVALID_SCENARIO"], [arrayWithProperty, "INVALID_SCENARIO"], [deep, "INPUT_LIMIT"], [Array(20001).fill(0), "INPUT_LIMIT"], [{ unknown: "x".repeat(32769) }, "INPUT_LIMIT"]] as const) {
    const result = validateScenario(input, config, digest);
    assert.ok(!result.ok); if (!result.ok) { assert.equal(result.error.code, code); assert.ok(result.error.path.length <= 256); }
  }
  assert.equal(calls, 0);
});
test("text input is bounded before parsing and errors expose no input contents", () => {
  assert.deepEqual(parseScenario("x".repeat(MAX_SCENARIO_BYTES + 1), config, digest), { ok: false, error: { code: "SCENARIO_TOO_LARGE", path: "/" } });
  assert.deepEqual(parseScenario('{"private":"synthetic-sensitive-data"', config, digest), { ok: false, error: { code: "INVALID_JSON", path: "/" } });
});
test("schema is closed and config/calibration are simulation-only even with refreshed identity", () => {
  const unknown = { ...fixture, credentials: "never-consumed" };
  const result = validateScenario(unknown, config, digest); assert.ok(!result.ok); if (!result.ok) assert.equal(result.error.code, "UNKNOWN_FIELD");
  const production = structuredClone(config); production.realm.environment = "production";
  const input = structuredClone(fixture); input.identity.configurationDigest = configurationDigest(production);
  const rejected = validateScenario(input, production, digest); assert.ok(!rejected.ok); if (!rejected.ok) assert.equal(rejected.error.code, "IDENTITY_MISMATCH");
});
