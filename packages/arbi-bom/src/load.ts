import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { assertJsonSchema } from "./schema-validation.js";

import type {
  AssemblyCatalog,
  BomRepository,
  BuildCatalog,
  LocationCatalog,
  OfferCatalog,
  PartCatalog,
  QuoteSnapshot,
  ScenarioCatalog,
  SupplierCatalog,
} from "./types.js";

interface InputDefinition<T> {
  key: string;
  path: string;
  schemaPath: string;
  assign: (value: T) => void;
}

async function parseJson<T>(path: string): Promise<{ raw: string; value: T }> {
  const raw = await readFile(path, "utf8");
  return { raw, value: JSON.parse(raw) as T };
}

export async function loadBomRepository(
  repositoryRoot: string,
  scenarioId = "arbi-v1-hr-zagreb",
): Promise<BomRepository> {
  let parts: PartCatalog | undefined;
  let assemblies: AssemblyCatalog | undefined;
  let builds: BuildCatalog | undefined;
  let suppliers: SupplierCatalog | undefined;
  let offers: OfferCatalog | undefined;
  let locations: LocationCatalog | undefined;
  let scenarios: ScenarioCatalog | undefined;

  const definitions: Array<InputDefinition<unknown>> = [
    {
      key: "assemblies",
      path: "bom/assemblies/assemblies.json",
      schemaPath: "bom/schemas/assemblies.schema.json",
      assign: (value) => {
        assemblies = value as AssemblyCatalog;
      },
    },
    {
      key: "builds",
      path: "bom/assemblies/builds.json",
      schemaPath: "bom/schemas/builds.schema.json",
      assign: (value) => {
        builds = value as BuildCatalog;
      },
    },
    {
      key: "offers",
      path: "bom/catalog/offers.json",
      schemaPath: "bom/schemas/offers.schema.json",
      assign: (value) => {
        offers = value as OfferCatalog;
      },
    },
    {
      key: "parts",
      path: "bom/catalog/parts.json",
      schemaPath: "bom/schemas/parts.schema.json",
      assign: (value) => {
        parts = value as PartCatalog;
      },
    },
    {
      key: "suppliers",
      path: "bom/catalog/suppliers.json",
      schemaPath: "bom/schemas/suppliers.schema.json",
      assign: (value) => {
        suppliers = value as SupplierCatalog;
      },
    },
    {
      key: "locations",
      path: "bom/locations/locations.json",
      schemaPath: "bom/schemas/locations.schema.json",
      assign: (value) => {
        locations = value as LocationCatalog;
      },
    },
    {
      key: "scenarios",
      path: "bom/scenarios/scenarios.json",
      schemaPath: "bom/schemas/scenario.schema.json",
      assign: (value) => {
        scenarios = value as ScenarioCatalog;
      },
    },
  ];

  const hash = createHash("sha256");
  for (const definition of definitions) {
    const absolutePath = resolve(repositoryRoot, definition.path);
    const loaded = await parseJson<unknown>(absolutePath);
    await assertJsonSchema(
      definition.path,
      loaded.value,
      resolve(repositoryRoot, definition.schemaPath),
    );
    definition.assign(loaded.value);
    hash.update(definition.key);
    hash.update("\0");
    hash.update(loaded.raw);
    hash.update("\0");
  }

  if (
    parts === undefined ||
    assemblies === undefined ||
    builds === undefined ||
    suppliers === undefined ||
    offers === undefined ||
    locations === undefined ||
    scenarios === undefined
  ) {
    throw new Error("Failed to load the canonical BOM inputs");
  }

  const scenario = scenarios.scenarios.find((item) => item.id === scenarioId);
  if (scenario === undefined) {
    throw new Error(`Unknown BOM scenario: ${scenarioId}`);
  }
  const quotePath = `bom/quotes/${scenario.quoteSnapshotId}.json`;
  const quoteLoaded = await parseJson<QuoteSnapshot>(
    resolve(repositoryRoot, quotePath),
  );
  await assertJsonSchema(
    quotePath,
    quoteLoaded.value,
    resolve(repositoryRoot, "bom/schemas/quote.schema.json"),
  );
  hash.update(quotePath);
  hash.update("\0");
  hash.update(quoteLoaded.raw);

  return {
    inputDigest: `sha256:${hash.digest("hex")}`,
    loadedScenarioId: scenarioId,
    parts,
    assemblies,
    builds,
    suppliers,
    offers,
    locations,
    quote: quoteLoaded.value,
    scenarios,
  };
}
