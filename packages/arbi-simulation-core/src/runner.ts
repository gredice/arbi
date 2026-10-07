import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkReferenceVectors, MAX_SCENARIO_BYTES, parseScenario, type Configuration } from "@arbi/protocol";
import { checkScenarioExpected, runScenario } from "./index.js";

export function loadScenario(file: string, protocolRoot: string) {
  if (statSync(file).size > MAX_SCENARIO_BYTES) throw new Error("SCENARIO_TOO_LARGE");
  checkReferenceVectors(protocolRoot);
  const configuration = JSON.parse(readFileSync(resolve(protocolRoot, "fixtures/configuration.json"), "utf8")).valid.configuration as Configuration;
  const referenceDigest = createHash("sha256").update(readFileSync(resolve(protocolRoot, "fixtures/reference/1.0/vectors.json"))).digest("hex");
  const parsed = parseScenario(readFileSync(file, "utf8"), configuration, referenceDigest);
  if (!parsed.ok) throw new Error(parsed.error.code);
  return { scenario: parsed.value, configuration, referenceDigest };
}
export function consumeScenario(file: string, protocolRoot: string, includeTrace = false): object {
  const { scenario, configuration, referenceDigest } = loadScenario(file, protocolRoot);
  const result = runScenario(scenario, configuration, referenceDigest);
  if (!result.ok) throw new Error(result.error.code);
  checkScenarioExpected(scenario, result.value);
  const { trace, ...report } = result.value;
  return includeTrace ? result.value : report;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const root = resolve(process.argv[3] ?? fileURLToPath(new URL("../../arbi-protocol", import.meta.url)));
    const file = resolve(process.argv[2] ?? resolve(root, "fixtures/scenarios/1.0/healthy.json"));
    console.log(JSON.stringify(consumeScenario(file, root, process.argv.includes("--trace"))));
  } catch (error) {
    const codes = new Set(["INVALID_JSON", "SCENARIO_TOO_LARGE", "INPUT_LIMIT", "INVALID_SCENARIO", "UNSUPPORTED_SCHEMA", "UNKNOWN_FIELD", "UNIT_MISMATCH", "FRAME_MISMATCH", "IDENTITY_MISMATCH", "INVALID_CONFIGURATION", "IMPOSSIBLE_INITIAL", "CLOCK_INVALID", "ORDER_CONFLICT", "INVALID_COMMAND", "UNSUPPORTED_MODEL", "RESULT_MISMATCH", "VERSION_MISMATCH", "SCHEMA_MISMATCH", "NUMERIC_LIMIT"]);
    console.error(error instanceof Error && codes.has(error.message) ? error.message : "INVALID_SCENARIO");
    process.exitCode = 2;
  }
}
