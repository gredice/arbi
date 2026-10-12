import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { calculateBom } from "./calculate.js";
import { loadBomRepository } from "./load.js";
import { assertJsonSchema } from "./schema-validation.js";
import { designWarnings } from "./warnings.js";
import { renderMarkdown } from "./report.js";

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

test("procurement issues are separate from unconfirmed selections and concept warnings", async () => {
  const repository = await loadBomRepository(root);
  const result = calculateBom(repository);
  assert.ok(result.warningDetails.some((warning) => warning.code === "procurement-information" && warning.severity === "issue"));
  assert.ok(result.warningDetails.filter((warning) => warning.code === "procurement-information").every((warning) => warning.severity === "issue"));
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
  assert.ok(result.partWarnings["bulk-capacitor-1000uf"]?.some((warning) => warning.message.includes("no pinned offer") && warning.severity === "issue"));
  assert.ok(Object.values(result.partWarnings).flat().some((warning) => warning.message.includes("Shipping is unknown") && warning.severity === "issue"));
});

test("cable-tie and approximate-geometry warnings cannot be downgraded; missing specifications are critical", async () => {
  const repository = await loadBomRepository(root);
  const part = repository.parts.parts.find((part) => part.id === "camera-pod-chassis")!;
  part.designWarnings![0]!.severity = "warning";
  await assert.rejects(assertJsonSchema("part catalog", repository.parts, `${root}/bom/schemas/parts.schema.json`), /JSON Schema validation failed/);
  part.requirements = [];
  assert.ok(designWarnings(part).some((warning) => warning.code === "missing-information" && warning.severity === "critical"));
  part.designWarnings = [{ code: "approximate-geometry", severity: "issue", message: "Measure dimensions." }];
  await assert.rejects(assertJsonSchema("part catalog", repository.parts, `${root}/bom/schemas/parts.schema.json`), /JSON Schema validation failed/);
  part.designWarnings = [{ code: "procurement-information", severity: "issue", message: "Price is unknown." }];
  await assertJsonSchema("part catalog", repository.parts, `${root}/bom/schemas/parts.schema.json`);
});

test("tax, shipping, availability and observation dates remain visible as Issues without completing cost evidence", async () => {
  const repository = await loadBomRepository(root);
  const baseline = calculateBom(repository);
  const price = repository.quote.offerPrices.find((row) => row.offerId === "tme-raspberry-pi-pico-2-w")!;
  price.taxTreatment = "unknown";
  price.availability = "unknown";
  price.observedAt = null;
  const shipping = repository.quote.checkoutGroups.find((row) => row.checkoutGroupId === "tme-hr")!;
  shipping.status = "unknown";
  shipping.amount = null;
  shipping.observedAt = null;
  const result = calculateBom(repository);
  const partWarnings = result.partWarnings["raspberry-pi-pico-2-w"]!;
  for (const message of ["Tax/VAT treatment is unknown", "Availability is unknown", "Price and availability observation date is unknown", "Shipping is unknown", "Shipping observation date is unknown"]) {
    const warning = partWarnings.find((warning) => warning.message.includes(message));
    assert.ok(warning, message);
    assert.equal(warning.severity, "issue", message);
    assert.ok(warning.assemblyIds.includes("control-cabinet"), message);
  }
  assert.equal(result.complete, false);
  assert.equal(result.completeLandedTotal, null);
  assert.equal(result.knownGoodsSubtotal, baseline.knownGoodsSubtotal);
  const markdown = renderMarkdown(result);
  assert.match(markdown, /### Issues \(\d+\)/);
  assert.match(markdown, /\*\*Issues:\*\* tme-raspberry-pi-pico-2-w: Tax\/VAT treatment is unknown/);
});
