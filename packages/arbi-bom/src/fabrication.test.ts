import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { calculateBom } from "./calculate.js";
import { Decimal } from "./decimal.js";
import { estimatePrintMaterials } from "./fabrication.js";
import { loadBomRepository } from "./load.js";
import { assertJsonSchema } from "./schema-validation.js";
import { validateRepository } from "./validate.js";

const root = fileURLToPath(new URL("../../../", import.meta.url));

test("print evidence cannot require an ignored local booklet source copy", async () => {
  const fabrication = JSON.parse(await readFile(join(root, "bom/catalog/fabrication.json"), "utf8"));
  fabrication.geometry.sourceHashes = { "hardware/generated/booklet/source/model.scad": "a".repeat(64) };
  await assert.rejects(assertJsonSchema("fabrication.json", fabrication,
    join(root, "bom/schemas/fabrication.schema.json")), /sourceHashes.*pattern/);
});

test("weight costing uses density and the conditional bulk rate, without rounding to whole rolls", async () => {
  const repository = await loadBomRepository(root);
  const recipe = repository.fabrication.recipes.find((item) => item.partId === "dock-funnel")!;
  recipe.components = [{ modelId: "dock-guide-quarter", quantity: "1" }];
  repository.fabrication.geometry.models.find((item) => item.modelId === "dock-guide-quarter")!.volumeCm3 = "100";
  const estimate = estimatePrintMaterials(repository, recipe, "3", "EUR");
  assert.equal(estimate.weightGrams, "375");
  assert.equal(estimate.materialCost, "4.27");
  assert.equal(estimate.materialUsages[0]!.minimumBulkRolls, 10);
  assert.equal(estimate.alternatives.find((item) => item.materialId === "pla")!.weightGrams, "372");
  assert.equal(estimate.alternatives.find((item) => item.materialId === "asa")!.materialCost, "7.87");
  assert.equal(Decimal.parse("1").divide(Decimal.parse("3"), 3).toString(), "0.333");
  assert.equal(Decimal.parse("1").divide(Decimal.parse("8"), 2).toString(), "0.13");
});

test("base print kits exclude alternatives and multiply repeated pieces and variants", async () => {
  const repository = await loadBomRepository(root);
  const recipe = repository.fabrication.recipes.find((item) => item.partId === "winch-drum")!;
  assert.equal(recipe.representedQuantity, "4");
  assert.equal(recipe.components.find((item) => item.modelId === "winch-drum-alignment-pin")!.quantity, "13");
  assert.equal(recipe.components.find((item) => item.modelId === "winch-drum-passive-1")!.quantity, "3");
  const chassis = repository.fabrication.recipes.find((item) => item.partId === "camera-pod-chassis")!;
  assert.equal(chassis.components.find((item) => item.modelId === "camera-pod-spider-spacer")!.quantity, "4");
  assert.ok(!chassis.components.some((item) => item.modelId === "camera-pod-electronics-deck"));
  const base = calculateBom(repository);
  assert.ok(!base.fabrication.some((item) => item.partId === "winch-desk-feet"));
  const cover = base.fabrication.find((item) => item.partId === "winch-full-cover")!;
  assert.ok(cover.materialCost); // priced despite having no procurement offer
  const double = estimatePrintMaterials(repository, recipe, "8", "EUR");
  assert.equal(double.weightGrams, "9961.213"); // round after multiplying, not before
});

test("dock bundle costs are attributed once and print estimates do not turn unknown costs into zero", async () => {
  const repository = await loadBomRepository(root);
  const base = calculateBom(repository);
  assert.equal(base.knownSubtotal, "987.22");
  assert.equal(base.estimatedMaterialSubtotal, "254.45");
  assert.equal(base.estimatedPartialSubtotal, "1241.67");
  assert.equal(base.completeLandedTotal, null);
  const allocated = base.assemblyEstimatedMaterials.reduce((sum, row) => sum.add(Decimal.parse(row.amount)), Decimal.zero());
  assert.equal(allocated.toString(), base.estimatedMaterialSubtotal);
  assert.ok(base.fabrication.some((item) => item.partId === "dock-funnel"));
  assert.ok(base.fabrication.some((item) => item.partId === "dock-nest"));
  assert.ok(base.fabrication.some((item) => item.partId === "dock-latch-hardware"));
  assert.ok(base.fabrication.some((item) => item.partId === "dock-support-arm"));
  repository.fabrication.materials.find((item) => item.id === "petg")!.spoolPrice = null;
  assert.equal(calculateBom(repository).fabrication.find((item) => item.partId === "dock-nest")!.materialCost, null);
});

test("mixed recipes use component density, colour evidence and independently priced consumption", async () => {
  const repository = await loadBomRepository(root);
  const recipe = repository.fabrication.recipes.find((item) => item.partId === "camera-pod-chassis")!;
  const selected = recipe.components.filter((item) => ["camera-pod-rain-hood", "camera-pod-enclosure-base", "camera-pod-spider"].includes(item.modelId));
  recipe.components = selected;
  for (const component of selected) {
    component.quantity = "1";
    repository.fabrication.geometry.models.find((item) => item.modelId === component.modelId)!.volumeCm3 = "100";
  }
  const estimate = estimatePrintMaterials(repository, recipe, "2", "EUR");
  assert.equal(estimate.weightGrams, "798"); // 2 × (137 white + 137 black + 125 functional)
  assert.equal(estimate.materialCost, "9.09"); // 3.12 + 3.12 + 2.85
  assert.equal(estimate.materialUsages.length, 3);
  const white = estimate.materialUsages.find((usage) => usage.color === "white")!;
  assert.equal(white.materialId, "petg-matte");
  assert.match(white.priceSourceUrl, /775952393450868758/);
  assert.equal(estimate.alternatives.find((item) => item.materialId === "petg")!.weightGrams, "750");
  repository.fabrication.materials.find((item) => item.id === "petg-matte")!.spoolPrice = null;
  assert.equal(estimatePrintMaterials(repository, recipe, "2", "EUR").materialCost, null);
});

test("cosmetic shell substitutions preserve functional cover components", async () => {
  const repository = await loadBomRepository(root);
  const cover = repository.fabrication.recipes.find((item) => item.partId === "winch-full-cover")!;
  assert.equal(cover.materialId, "asa");
  for (const component of cover.components) {
    if (/clip|cable-anchor/.test(component.modelId)) assert.equal(component.materialId, undefined);
    else assert.equal(component.materialId, "petg-matte");
  }
  const matte = repository.fabrication.materials.find((item) => item.id === "petg-matte")!;
  matte.bulkPricing = undefined;
  const chassis = repository.fabrication.recipes.find((item) => item.partId === "camera-pod-chassis")!;
  chassis.components.find((item) => item.materialId === "petg-matte")!.color = undefined;
  const errors = validateRepository(repository).errors.join("\n");
  assert.match(errors, /minimum eligible roll count/);
  assert.match(errors, /needs an evidenced colour/);
});

test("a full fabrication quote supersedes the material allowance", async () => {
  const repository = await loadBomRepository(root);
  repository.quote.offerPrices.find((item) => item.offerId === "in-house-fabrication-dock-capture-set")!.price = { basis: "purchase-unit", amount: "60", currency: "EUR" };
  const result = calculateBom(repository);
  assert.ok(!result.fabrication.some((item) => ["dock-funnel", "dock-nest"].includes(item.partId)));
  assert.equal(result.knownGoodsSubtotal, "1003.84");
});

test("unknown materials, zero spool weights, foreign model ownership and stale revisions fail validation", async () => {
  const repository = await loadBomRepository(root);
  repository.fabrication.materials[0]!.spoolWeightGrams = "0";
  const recipe = repository.fabrication.recipes[0]!;
  recipe.materialId = "missing";
  recipe.components[0]!.modelId = "dock-nest";
  repository.fabrication.geometry.models.find((item) => item.modelId === "dock-guide-quarter")!.revision = "99.0.0";
  const errors = validateRepository(repository).errors.join("\n");
  assert.match(errors, /spool weight must be greater than zero/);
  assert.match(errors, /unknown material/);
  assert.match(errors, /missing or mismatched geometry/);
});

test("changing CAD makes material evidence stale even when the entrypoint revision stays the same", async () => {
  const repository = await loadBomRepository(root);
  const temp = await mkdtemp(join(tmpdir(), "arbi-print-stale-"));
  try {
    const inputs = ["bom/catalog/customs.json", "bom/catalog/fabrication.json", "bom/catalog/parts.json", "bom/catalog/offers.json", "bom/catalog/suppliers.json", "bom/assemblies/assemblies.json", "bom/assemblies/builds.json", "bom/locations/locations.json", "bom/scenarios/scenarios.json", `bom/quotes/${repository.quote.id}.json`, ...["customs", "fabrication", "parts", "offers", "suppliers", "assemblies", "builds", "locations", "scenario", "quote"].map((id) => `bom/schemas/${id}.schema.json`), ...Object.keys(repository.fabrication.geometry.sourceHashes)];
    for (const path of inputs) {
      await mkdir(join(temp, path, ".."), { recursive: true });
      await writeFile(join(temp, path), await readFile(join(root, path)));
    }
    await writeFile(join(temp, "hardware/lib/arbi.scad"), "// changed geometry\n");
    await assert.rejects(loadBomRepository(temp), /Stale fabrication geometry: hardware\/lib\/arbi.scad/);
  } finally { await rm(temp, { recursive: true, force: true }); }
});
