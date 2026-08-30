import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { calculateBom } from "./calculate.js";
import { Decimal } from "./decimal.js";
import { unexpectedScenarioReportFiles } from "./generated-reports.js";
import { loadBomRepository } from "./load.js";
import { renderJson, renderMarkdown } from "./report.js";
import { assertJsonSchema } from "./schema-validation.js";
import { validateRepository } from "./validate.js";
import type { CalculationResult } from "./types.js";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));

async function result(): Promise<CalculationResult> {
  const repository = await loadBomRepository(repositoryRoot);
  return calculateBom(repository);
}

function selection(
  calculation: CalculationResult,
  offerId: string,
): CalculationResult["selections"][number] {
  const selected = calculation.selections.find(
    (candidate) => candidate.offerId === offerId,
  );
  assert.ok(selected, "missing selection " + offerId);
  return selected;
}

function coverage(
  calculation: CalculationResult,
  offerId: string,
  partId: string,
): CalculationResult["selections"][number]["coverage"][number] {
  const covered = selection(calculation, offerId).coverage.find(
    (candidate) => candidate.partId === partId,
  );
  assert.ok(covered, "missing coverage " + offerId + " -> " + partId);
  return covered;
}

test("exact decimal arithmetic does not use binary floats", () => {
  assert.equal(
    Decimal.parse("0.1").add(Decimal.parse("0.2")).toString(),
    "0.3",
  );
});

test("removed or renamed scenarios leave detectable orphan reports", () => {
  assert.deepEqual(
    unexpectedScenarioReportFiles(
      [
        "arbi-v1-hr-zagreb.json",
        "arbi-v1-hr-zagreb.md",
        "retired-scenario.json",
        "notes.txt",
      ],
      ["arbi-v1-hr-zagreb"],
    ),
    ["retired-scenario.json"],
  );
});

test("180 m requirement rounds to four 50 m Dyneema spools", async () => {
  const calculated = await result();
  const selected = selection(
    calculated,
    "dive-store-dyneema-positioning-line",
  );
  const covered = coverage(
    calculated,
    "dive-store-dyneema-positioning-line",
    "dyneema-positioning-line",
  );
  assert.equal(selected.purchaseUnits, "4");
  assert.equal(covered.purchased, "200");
  assert.equal(covered.surplus, "20");
});

test("85 m requirement rounds to one 100 m Cat5e reel", async () => {
  const calculated = await result();
  const selected = selection(
    calculated,
    "ronis-outdoor-cat5e-signal-cable",
  );
  const covered = coverage(
    calculated,
    "ronis-outdoor-cat5e-signal-cable",
    "outdoor-cat5e-signal-cable",
  );
  assert.equal(selected.purchaseUnits, "1");
  assert.equal(covered.purchased, "100");
  assert.equal(covered.surplus, "15");
});

test("washer box and servo pack expose procurement surplus", async () => {
  const calculated = await result();
  const washer = coverage(
    calculated,
    "bauhaus-pulley-bracket-washer-m12",
    "pulley-bracket-washer-m12",
  );
  assert.equal(washer.purchased, "100");
  assert.equal(washer.surplus, "84");

  const servoSelection = selection(
    calculated,
    "aliexpress-micro-pan-tilt-servo",
  );
  const servo = coverage(
    calculated,
    "aliexpress-micro-pan-tilt-servo",
    "micro-pan-tilt-servo",
  );
  assert.equal(servoSelection.purchaseUnits, "1");
  assert.equal(servo.purchased, "3");
  assert.equal(servo.surplus, "1");
  assert.equal(servoSelection.knownGoodsAmount, "16.72");
});

test("TME shipping is applied once per checkout group", async () => {
  const calculated = await result();
  const tme = calculated.shipping.filter(
    (shipping) => shipping.checkoutGroupId === "tme-hr",
  );
  assert.equal(tme.length, 1);
  assert.equal(tme[0]?.knownAmount, "2.46");
  assert.equal(tme[0]?.chargedOnce, true);
});

test("StepperOnline kit covers all physical component requirements once", async () => {
  const calculated = await result();
  const kit = selection(calculated, "stepperonline-4-axis-v2-kit");
  assert.equal(kit.purchaseUnits, "1");
  assert.deepEqual(
    kit.coverage.map((item) => [
      item.partId,
      item.required,
      item.purchased,
      item.surplus,
    ]),
    [
      ["cl57y-v20-driver", "4", "4", "0"],
      ["matched-motor-cable", "4", "4", "0"],
      ["nema23-closed-loop-motor", "4", "4", "0"],
      ["power-supply-48v-350w", "2", "2", "0"],
    ],
  );
});

test("dock capture bundle covers one separately modeled funnel and nest", async () => {
  const calculated = await result();
  const bundle = selection(
    calculated,
    "in-house-fabrication-dock-capture-set",
  );
  assert.equal(bundle.purchaseUnits, "1");
  assert.deepEqual(
    bundle.coverage.map((item) => [item.partId, item.required, item.purchased]),
    [
      ["dock-funnel", "1", "1"],
      ["dock-nest", "1", "1"],
    ],
  );
});

test("in-house fabrication costs remain unknown rather than zero", async () => {
  const repository = await loadBomRepository(repositoryRoot);
  const inHouseIds = new Set(
    repository.offers.offers
      .filter((offer) => offer.supplierId === "in-house-fabrication")
      .map((offer) => offer.id),
  );
  const quotes = repository.quote.offerPrices.filter((price) =>
    inHouseIds.has(price.offerId),
  );
  assert.equal(quotes.length, inHouseIds.size);
  assert.ok(quotes.every((quote) => quote.price === null));
});

test("availability, tax, and destination tax evidence block completeness", async () => {
  const repository = await loadBomRepository(repositoryRoot);
  const price = repository.quote.offerPrices.find(
    (candidate) => candidate.offerId === "tme-raspberry-pi-pico-2-w",
  );
  assert.ok(price);
  price.availability = "out-of-stock";
  price.taxTreatment = "excluded";
  const shipping = repository.quote.checkoutGroups.find(
    (candidate) => candidate.checkoutGroupId === "tme-hr",
  );
  assert.ok(shipping);
  shipping.taxTreatment = "excluded";

  const calculated = calculateBom(repository);
  assert.equal(calculated.complete, false);
  assert.ok(calculated.warnings.some((warning) => warning.includes("out of stock")));
  assert.ok(
    calculated.warnings.some((warning) =>
      warning.includes("no explicit tax amount or rate is modeled"),
    ),
  );
  assert.ok(
    calculated.warnings.some((warning) =>
      warning.includes("Destination tax/VAT status is unknown"),
    ),
  );
});

test("duplicate destination quote keys are rejected", async () => {
  const repository = await loadBomRepository(repositoryRoot);
  const price = repository.quote.offerPrices[0];
  const shipping = repository.quote.checkoutGroups[0];
  assert.ok(price);
  assert.ok(shipping);
  repository.quote.offerPrices.push(structuredClone(price));
  repository.quote.checkoutGroups.push(structuredClone(shipping));
  const validation = validateRepository(repository);
  assert.ok(validation.errors.some((error) => error.includes("Duplicate quote row")));
  assert.ok(
    validation.errors.some((error) =>
      error.includes("Duplicate checkout-group quote row"),
    ),
  );
});

test("checkout groups are uniquely owned even when suppliers have multiple baskets", async () => {
  const repository = await loadBomRepository(repositoryRoot);
  const first = repository.suppliers.suppliers[0];
  const second = repository.suppliers.suppliers[1];
  assert.ok(first);
  assert.ok(second);
  const group = first.checkoutGroupIds[0];
  assert.ok(group);
  second.checkoutGroupIds.push(group);
  const validation = validateRepository(repository);
  assert.ok(
    validation.errors.some((error) =>
      error.includes("Checkout group " + group + " is declared more than once"),
    ),
  );
});

test("scenario destination and report currency must match its quote", async () => {
  const repository = await loadBomRepository(repositoryRoot);
  const scenario = repository.scenarios.scenarios[0];
  assert.ok(scenario);
  scenario.destinationId = "unmatched-destination";
  scenario.reportCurrency = "USD";
  const validation = validateRepository(repository);
  assert.ok(validation.errors.some((error) => error.includes("does not match quote destination")));
  assert.ok(validation.errors.some((error) => error.includes("does not match quote report currency")));
});

test("committed JSON Schemas reject misspelled fields", async () => {
  await assert.rejects(
    assertJsonSchema(
      "test-builds.json",
      {
        schemaVersion: 1,
        builds: [
          {
            id: "test-build",
            name: "Test build",
            assemblies: [{ assemblyId: "dock", quantity: "1" }],
            assembiles: [],
          },
        ],
      },
      resolve(repositoryRoot, "bom/schemas/builds.schema.json"),
    ),
    /must NOT have additional properties/,
  );
});

test("public supplier URLs reject executable and custom schemes", async () => {
  await assert.rejects(
    assertJsonSchema(
      "test-suppliers.json",
      {
        schemaVersion: 1,
        suppliers: [
          {
            id: "unsafe-supplier",
            name: "Unsafe supplier",
            checkoutGroupIds: ["unsafe-checkout"],
            website: "javascript:alert(1)",
          },
        ],
      },
      resolve(repositoryRoot, "bom/schemas/suppliers.schema.json"),
    ),
    /must match format "uri"/,
  );
});

test("quote observation timestamps enforce date-time syntax", async () => {
  const repository = await loadBomRepository(repositoryRoot);
  const price = repository.quote.offerPrices[0];
  assert.ok(price);
  price.observedAt = "not-a-date";
  await assert.rejects(
    assertJsonSchema(
      "test-quote.json",
      repository.quote,
      resolve(repositoryRoot, "bom/schemas/quote.schema.json"),
    ),
    /must match format "date-time"/,
  );
});

test("canonical schemas reject external source bookkeeping", async () => {
  const repository = await loadBomRepository(repositoryRoot);
  const part = repository.parts.parts[0];
  assert.ok(part);
  await assert.rejects(
    assertJsonSchema(
      "test-parts.json",
      {
        ...repository.parts,
        parts: [
          { ...part, externalRecordId: "obsolete" },
          ...repository.parts.parts.slice(1),
        ],
      },
      resolve(repositoryRoot, "bom/schemas/parts.schema.json"),
    ),
    /must NOT have additional properties/,
  );
});

test("canonical usages and offers cannot reference unknown parts", async () => {
  const repository = await loadBomRepository(repositoryRoot);
  const usage = repository.assemblies.assemblies[0]?.usages[0];
  const offer = repository.offers.offers[0];
  const content = offer?.purchaseUnit.contents[0];
  assert.ok(usage);
  assert.ok(offer);
  assert.ok(content);
  usage.partId = "unknown-usage-part";
  content.partId = "unknown-offer-part";
  const validation = validateRepository(repository);
  assert.ok(
    validation.errors.some((error) =>
      error.includes("references unknown part unknown-usage-part"),
    ),
  );
  assert.ok(
    validation.errors.some((error) =>
      error.includes("contains unknown part unknown-offer-part"),
    ),
  );
});

test("repository-native part, child usage, and offer extend the canonical graph", async () => {
  const repository = await loadBomRepository(repositoryRoot);
  repository.parts.parts.push({
    id: "pod-environment-sensor",
    name: "Pod environment sensor",
    baseUnit: "each",
    kind: "component",
    lifecycle: "planned",
    disciplines: ["electronics"],
    traits: ["off-the-shelf"],
    requirements: ["Repository-native extension used to prove catalog growth."],
  });
  repository.assemblies.assemblies.push({
    id: "camera-pod-sensor-head",
    kind: "physical",
    parentAssemblyId: "camera-pod",
    name: "Camera pod sensor head",
    description: "Repository-native child assembly beneath the canonical camera-pod root.",
    disciplines: ["electronics"],
    usages: [
      {
        partId: "pod-environment-sensor",
        quantity: "1",
        inclusion: "base",
      },
    ],
  });
  const build = repository.builds.builds[0];
  assert.ok(build);
  build.assemblies.push({
    assemblyId: "camera-pod-sensor-head",
    quantity: "1",
  });
  repository.offers.offers.push({
    id: "repository-pod-environment-sensor",
    supplierId: "tme",
    checkoutGroupId: "tme-hr",
    qualification: "candidate",
    listing: {
      supplierSku: null,
      url: null,
      marketRegion: "HR",
    },
    purchaseUnit: {
      label: "unit",
      packagingKnown: true,
      minimum: "1",
      increment: "1",
      contents: [{ partId: "pod-environment-sensor", quantity: "1" }],
    },
  });

  await Promise.all([
    assertJsonSchema(
      "test-parts.json",
      repository.parts,
      resolve(repositoryRoot, "bom/schemas/parts.schema.json"),
    ),
    assertJsonSchema(
      "test-assemblies.json",
      repository.assemblies,
      resolve(repositoryRoot, "bom/schemas/assemblies.schema.json"),
    ),
    assertJsonSchema(
      "test-offers.json",
      repository.offers,
      resolve(repositoryRoot, "bom/schemas/offers.schema.json"),
    ),
  ]);
  assert.deepEqual(validateRepository(repository).errors, []);
  const calculation = calculateBom(repository);
  const requirement = calculation.requirements.find(
    (item) => item.partId === "pod-environment-sensor",
  );
  assert.deepEqual(requirement, {
    partId: "pod-environment-sensor",
    required: "1",
    unit: "each",
    assemblies: [
      {
        assemblyId: "camera-pod-sensor-head",
        kind: "physical",
        quantity: "1",
      },
    ],
    selectedOfferId: null,
  });

  const cameraPod = repository.assemblies.assemblies.find(
    (assembly) => assembly.id === "camera-pod",
  );
  assert.ok(cameraPod);
  cameraPod.parentAssemblyId = "camera-pod-sensor-head";
  assert.ok(
    validateRepository(repository).errors.some((error) =>
      error.includes("Physical assembly hierarchy contains a cycle"),
    ),
  );
});

test("additional repository quote and destination validate without external source metadata", async () => {
  const repository = await loadBomRepository(repositoryRoot);
  repository.locations.locations.push({
    id: "hr-split",
    name: "Split, Croatia",
    country: "HR",
    region: "Split-Dalmatia",
    postalCode: "21000",
    reportCurrency: "EUR",
    tax: {
      status: "unknown",
      note: "Repository-native destination fixture.",
    },
  });
  repository.quote.id = "hr-split-repository-quote";
  repository.quote.destinationId = "hr-split";
  const baseScenario = repository.scenarios.scenarios[0];
  assert.ok(baseScenario);
  repository.scenarios.scenarios.push({
    ...structuredClone(baseScenario),
    id: "arbi-v1-hr-split",
    name: "ARBI V1 — Split repository quote",
    destinationId: "hr-split",
    quoteSnapshotId: "hr-split-repository-quote",
  });
  repository.loadedScenarioId = "arbi-v1-hr-split";

  await Promise.all([
    assertJsonSchema(
      "test-quote.json",
      repository.quote,
      resolve(repositoryRoot, "bom/schemas/quote.schema.json"),
    ),
    assertJsonSchema(
      "test-scenarios.json",
      repository.scenarios,
      resolve(repositoryRoot, "bom/schemas/scenario.schema.json"),
    ),
    assertJsonSchema(
      "test-locations.json",
      repository.locations,
      resolve(repositoryRoot, "bom/schemas/locations.schema.json"),
    ),
  ]);
  assert.deepEqual(validateRepository(repository).errors, []);
});

test("fabrication status can advance while source invariants remain enforced", async () => {
  const repository = await loadBomRepository(repositoryRoot);
  const fabricated = repository.parts.parts.find(
    (part) => part.id === "camera-pod-chassis",
  );
  assert.ok(fabricated?.fabrication);
  fabricated.fabrication.modelStatus = "released";
  await assertJsonSchema(
    "test-parts.json",
    repository.parts,
    resolve(repositoryRoot, "bom/schemas/parts.schema.json"),
  );
  assert.deepEqual(validateRepository(repository).errors, []);

  fabricated.fabrication.modelStatus = "planned";
  assert.ok(
    validateRepository(repository).errors.some((error) =>
      error.includes("must not claim an implemented manufacturing source"),
    ),
  );
  fabricated.fabrication.modelStatus = "prototype";
  fabricated.fabrication.sources = [];
  assert.ok(
    validateRepository(repository).errors.some((error) =>
      error.includes("must link at least one OpenSCAD source"),
    ),
  );
});

test("report status banner follows calculation completeness", async () => {
  const calculated = await result();
  const complete = structuredClone(calculated);
  complete.complete = true;
  complete.completeLandedTotal = complete.knownSubtotal;
  complete.warnings = [];
  const markdown = renderMarkdown(complete);
  assert.match(markdown, /Status: COMPLETE/);
  assert.doesNotMatch(markdown, /Status: INCOMPLETE/);
  assert.match(markdown, /Incompleteness warnings\n\nNone\./);
});

test("unknown evidence prevents a trustworthy complete total", async () => {
  const calculated = await result();
  assert.equal(calculated.complete, false);
  assert.equal(calculated.completeLandedTotal, null);
  assert.ok(calculated.warnings.length > 0);
  assert.ok(
    calculated.warnings.some((warning) =>
      warning.includes("Shipping is unknown"),
    ),
  );
});

test("JSON and Markdown generation is deterministic", async () => {
  const repository = await loadBomRepository(repositoryRoot);
  const first = calculateBom(repository);
  const second = calculateBom(repository);
  assert.equal(renderJson(first), renderJson(second));
  assert.equal(renderMarkdown(first), renderMarkdown(second));
  assert.match(first.inputDigest, /^sha256:[a-f0-9]{64}$/);
});
