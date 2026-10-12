import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { calculateBom } from "./calculate.js";
import { loadBomRepository } from "./load.js";
import { assertJsonSchema } from "./schema-validation.js";
import { designWarnings } from "./warnings.js";

const root = fileURLToPath(new URL("../../../", import.meta.url));

test("temporary cable-tie retention is critical on the owning parts and included BOM", async () => {
  const result = calculateBom(await loadBomRepository(root));
  for (const id of ["camera-pod-chassis", "bulk-capacitor-1000uf", "camera-pod-wiring-kit", "winch-round-pole-covers", "winch-round-pole-hardware"]) {
    assert.ok(result.partWarnings[id]?.some((warning) => warning.code === "temporary-cable-tie" && warning.severity === "critical"), id);
  }
  assert.ok(!result.partWarnings["pod-buck-converter-48v-5v"]?.some((warning) => warning.code === "temporary-cable-tie"), "received converter uses screw mounts");
  assert.ok(result.warningDetails.some((warning) => warning.code === "temporary-cable-tie" && warning.assemblyIds.includes("camera-pod")));
  assert.equal(result.complete, false);
});

test("missing procurement data stays critical while selection and concept evidence is lighter", async () => {
  const repository = await loadBomRepository(root);
  const result = calculateBom(repository);
  assert.ok(result.warningDetails.some((warning) => warning.code === "missing-information" && warning.severity === "critical"));
  assert.ok(result.warningDetails.some((warning) => warning.code === "unconfirmed-selection" && warning.severity === "warning"));
  assert.ok(result.partWarnings["winch-drum"]?.some((warning) => warning.code === "unconfirmed-concept" && warning.severity === "warning"));
  const part = repository.parts.parts.find((part) => part.id === "winch-drum")!;
  part.fabrication!.modelStatus = "validated";
  assert.ok(!calculateBom(repository).partWarnings[part.id]?.some((warning) => warning.code === "unconfirmed-concept"));
});

test("missing pinned offers and basket shipping reach the affected part warning list", async () => {
  const repository = await loadBomRepository(root);
  delete repository.scenarios.scenarios[0]!.selection.pins["bulk-capacitor-1000uf"];
  const result = calculateBom(repository);
  assert.ok(result.partWarnings["bulk-capacitor-1000uf"]?.some((warning) => warning.message.includes("no pinned offer") && warning.severity === "critical"));
  assert.ok(Object.values(result.partWarnings).flat().some((warning) => warning.message.includes("Shipping is unknown") && warning.severity === "critical"));
});

test("cable-tie warnings cannot be downgraded and missing specifications are critical", async () => {
  const repository = await loadBomRepository(root);
  const part = repository.parts.parts.find((part) => part.id === "camera-pod-chassis")!;
  part.designWarnings![0]!.severity = "warning";
  await assert.rejects(assertJsonSchema("part catalog", repository.parts, `${root}/bom/schemas/parts.schema.json`), /JSON Schema validation failed/);
  part.requirements = [];
  assert.ok(designWarnings(part).some((warning) => warning.code === "missing-information" && warning.severity === "critical"));
});
