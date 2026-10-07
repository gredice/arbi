import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Configuration } from "@arbi/protocol";
import { checkPlantExpected, runPlant } from "./plant.js";
import { validatePlant } from "./plant-validation.js";

export function loadPlant(file: string, root: string) {
  if (statSync(file).size > 262144) throw new Error("INVALID_PLANT");
  const config = JSON.parse(readFileSync(resolve(root, "fixtures/configuration.json"), "utf8")).valid.configuration as Configuration;
  const referenceDigest = createHash("sha256").update(readFileSync(resolve(root, "fixtures/reference/1.0/vectors.json"))).digest("hex");
  const p = validatePlant(JSON.parse(readFileSync(file, "utf8")), config, referenceDigest);
  return { plant: p, config, referenceDigest };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const root = resolve(process.argv[3] ?? fileURLToPath(new URL("../../arbi-protocol", import.meta.url)));
    const file = resolve(process.argv[2] ?? fileURLToPath(new URL("../fixtures/plant/1.0/nominal.json", import.meta.url)));
    const { plant, config, referenceDigest } = loadPlant(file, root);
    const run = runPlant(plant, config, referenceDigest); checkPlantExpected(plant, run);
    const { trace, ...report } = run; console.log(JSON.stringify(process.argv.includes("--trace") ? run : report));
  } catch (e) {
    const code = e instanceof Error ? e.message : "INVALID_PLANT";
    console.error(/^(INVALID_PLANT|UNSUPPORTED_PLANT|RESULT_MISMATCH|OUTSIDE_LIMITS|NUMERIC_LIMIT|INVALID_GEOMETRY|INVALID_SCENARIO|UNSUPPORTED_SCHEMA|UNKNOWN_FIELD|UNIT_MISMATCH|FRAME_MISMATCH|IDENTITY_MISMATCH|INVALID_CONFIGURATION|IMPOSSIBLE_INITIAL|CLOCK_INVALID|ORDER_CONFLICT|INVALID_COMMAND|UNSUPPORTED_MODEL)$/.test(code) ? code : "INVALID_PLANT");
    process.exitCode = 2;
  }
}
