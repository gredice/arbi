import { Decimal, isDecimalString } from "./decimal.js";
import type { BomRepository, ValidationResult } from "./types.js";

const ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const COUNTRY_PATTERN = /^[A-Z]{2}$/;

function duplicateIds(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }
  return [...duplicates].sort();
}

function requireDecimal(
  result: ValidationResult,
  value: unknown,
  path: string,
  allowZero: boolean,
): void {
  if (!isDecimalString(value)) {
    result.errors.push(`${path} must be a non-negative decimal string`);
    return;
  }
  if (!allowZero && Decimal.parse(value).compare(Decimal.zero()) === 0) {
    result.errors.push(`${path} must be greater than zero`);
  }
}

function requireId(
  result: ValidationResult,
  value: string,
  path: string,
): void {
  if (!ID_PATTERN.test(value)) {
    result.errors.push(`${path} is not a stable kebab-case ID: ${value}`);
  }
}

export function validateRepository(repository: BomRepository): ValidationResult {
  const result: ValidationResult = { errors: [], warnings: [] };

  const partIds = repository.parts.parts.map((part) => part.id);
  const assemblyIds = repository.assemblies.assemblies.map(
    (assembly) => assembly.id,
  );
  const buildIds = repository.builds.builds.map((build) => build.id);
  const supplierIds = repository.suppliers.suppliers.map(
    (supplier) => supplier.id,
  );
  const offerIds = repository.offers.offers.map((offer) => offer.id);
  const locationIds = repository.locations.locations.map(
    (location) => location.id,
  );
  const scenarioIds = repository.scenarios.scenarios.map(
    (scenario) => scenario.id,
  );

  const collections: Array<[string, string[]]> = [
    ["part", partIds],
    ["assembly", assemblyIds],
    ["build", buildIds],
    ["supplier", supplierIds],
    ["offer", offerIds],
    ["location", locationIds],
    ["scenario", scenarioIds],
  ];
  for (const [label, ids] of collections) {
    for (const id of ids) {
      requireId(result, id, `${label} ID`);
    }
    for (const duplicate of duplicateIds(ids)) {
      result.errors.push(`Duplicate ${label} ID: ${duplicate}`);
    }
  }

  const partSet = new Set(partIds);
  const assemblySet = new Set(assemblyIds);
  const buildSet = new Set(buildIds);
  const supplierSet = new Set(supplierIds);
  const offerSet = new Set(offerIds);
  const locationSet = new Set(locationIds);
  const checkoutGroupToSupplier = new Map<string, string>();

  for (const duplicate of duplicateIds(
    repository.quote.offerPrices.map((price) => price.offerId),
  )) {
    result.errors.push(`Duplicate quote row for offer: ${duplicate}`);
  }
  for (const duplicate of duplicateIds(
    repository.quote.checkoutGroups.map((group) => group.checkoutGroupId),
  )) {
    result.errors.push(
      `Duplicate checkout-group quote row: ${duplicate}`,
    );
  }

  for (const supplier of repository.suppliers.suppliers) {
    for (const checkoutGroupId of supplier.checkoutGroupIds) {
      requireId(result, checkoutGroupId, "checkout group ID");
      const existing = checkoutGroupToSupplier.get(checkoutGroupId);
      if (existing !== undefined) {
        result.errors.push(
          `Checkout group ${checkoutGroupId} is declared more than once`,
        );
      }
      checkoutGroupToSupplier.set(checkoutGroupId, supplier.id);
    }
  }

  for (const assembly of repository.assemblies.assemblies) {
    if (
      assembly.kind === "shared-procurement-stock" &&
      assembly.id !== "shared-procurement-stock"
    ) {
      result.errors.push(
        `Non-physical procurement bucket must use stable ID shared-procurement-stock, found ${assembly.id}`,
      );
    }
    for (const usage of assembly.usages) {
      if (!partSet.has(usage.partId)) {
        result.errors.push(
          `Assembly ${assembly.id} references unknown part ${usage.partId}`,
        );
      }
      requireDecimal(
        result,
        usage.quantity,
        `assembly ${assembly.id} usage ${usage.partId} quantity`,
        false,
      );
    }
  }

  for (const part of repository.parts.parts) {
    if (part.fabrication?.modelStatus === "planned" && part.fabrication.sources.length > 0) {
      result.errors.push(
        `Planned fabrication part ${part.id} must not claim an implemented manufacturing source`,
      );
    }
    if (
      part.fabrication !== undefined &&
      part.fabrication.modelStatus !== "planned" &&
      part.fabrication.sources.length === 0
    ) {
      result.errors.push(
        `Non-planned fabrication part ${part.id} must link at least one OpenSCAD source`,
      );
    }
  }

  for (const build of repository.builds.builds) {
    for (const item of build.assemblies) {
      if (!assemblySet.has(item.assemblyId)) {
        result.errors.push(
          `Build ${build.id} references unknown assembly ${item.assemblyId}`,
        );
      }
      requireDecimal(
        result,
        item.quantity,
        `build ${build.id} assembly ${item.assemblyId} quantity`,
        false,
      );
    }
  }

  for (const offer of repository.offers.offers) {
    if (offer.listing.url !== null) {
      const url = new URL(offer.listing.url);
      if ([...url.searchParams.keys()].some((key) => key.startsWith("utm_"))) {
        result.errors.push(
          `Offer ${offer.id} canonical URL contains a tracking parameter`,
        );
      }
    }
    if (!supplierSet.has(offer.supplierId)) {
      result.errors.push(
        `Offer ${offer.id} references unknown supplier ${offer.supplierId}`,
      );
    }
    const checkoutSupplier = checkoutGroupToSupplier.get(offer.checkoutGroupId);
    if (checkoutSupplier !== offer.supplierId) {
      result.errors.push(
        `Offer ${offer.id} checkout group does not belong to ${offer.supplierId}`,
      );
    }
    if (offer.purchaseUnit.contents.length === 0) {
      result.errors.push(`Offer ${offer.id} has no package contents`);
    }
    for (const content of offer.purchaseUnit.contents) {
      if (!partSet.has(content.partId)) {
        result.errors.push(
          `Offer ${offer.id} contains unknown part ${content.partId}`,
        );
      }
      requireDecimal(
        result,
        content.quantity,
        `offer ${offer.id} content ${content.partId} quantity`,
        false,
      );
    }
    if (offer.purchaseUnit.packagingKnown) {
      if (
        offer.purchaseUnit.minimum === null ||
        offer.purchaseUnit.increment === null
      ) {
        result.errors.push(
          `Offer ${offer.id} has known packaging without minimum/increment`,
        );
      } else {
        requireDecimal(
          result,
          offer.purchaseUnit.minimum,
          `offer ${offer.id} minimum`,
          false,
        );
        requireDecimal(
          result,
          offer.purchaseUnit.increment,
          `offer ${offer.id} increment`,
          false,
        );
        if (
          Decimal.parse(offer.purchaseUnit.minimum).scale !== 0 ||
          Decimal.parse(offer.purchaseUnit.increment).scale !== 0
        ) {
          result.errors.push(
            `Offer ${offer.id} minimum/increment must be integer purchase units`,
          );
        }
      }
    } else if (
      offer.purchaseUnit.minimum !== null ||
      offer.purchaseUnit.increment !== null
    ) {
      result.errors.push(
        `Offer ${offer.id} has unknown packaging but a minimum/increment`,
      );
    }
  }

  if (!locationSet.has(repository.quote.destinationId)) {
    result.errors.push(
      `Quote snapshot references unknown destination ${repository.quote.destinationId}`,
    );
  }
  if (!CURRENCY_PATTERN.test(repository.quote.exchangeRates.reportCurrency)) {
    result.errors.push("Quote report currency is not ISO 4217");
  }
  for (const [currency, rate] of Object.entries(
    repository.quote.exchangeRates.rates,
  )) {
    if (!CURRENCY_PATTERN.test(currency)) {
      result.errors.push(`Invalid exchange-rate currency: ${currency}`);
    }
    requireDecimal(result, rate, `exchange rate ${currency}`, false);
  }
  for (const price of repository.quote.offerPrices) {
    if (!offerSet.has(price.offerId)) {
      result.errors.push(
        `Quote references unknown offer ${price.offerId}`,
      );
    }
    if (price.price !== null) {
      if (!CURRENCY_PATTERN.test(price.price.currency)) {
        result.errors.push(
          `Offer ${price.offerId} price currency is not ISO 4217`,
        );
      }
      requireDecimal(
        result,
        price.price.amount,
        `offer ${price.offerId} price`,
        true,
      );
    }
  }
  for (const shipping of repository.quote.checkoutGroups) {
    const supplier = checkoutGroupToSupplier.get(shipping.checkoutGroupId);
    if (supplier !== shipping.supplierId) {
      result.errors.push(
        `Shipping group ${shipping.checkoutGroupId} has inconsistent supplier`,
      );
    }
    if (!CURRENCY_PATTERN.test(shipping.currency)) {
      result.errors.push(
        `Shipping group ${shipping.checkoutGroupId} currency is not ISO 4217`,
      );
    }
    if (shipping.status === "unknown" && shipping.amount !== null) {
      result.errors.push(
        `Unknown shipping group ${shipping.checkoutGroupId} must have null amount`,
      );
    }
    if (shipping.status !== "unknown") {
      requireDecimal(
        result,
        shipping.amount,
        `shipping group ${shipping.checkoutGroupId} amount`,
        true,
      );
    }
  }

  for (const location of repository.locations.locations) {
    if (!COUNTRY_PATTERN.test(location.country)) {
      result.errors.push(
        `Location ${location.id} country is not ISO 3166-1 alpha-2`,
      );
    }
    if (!CURRENCY_PATTERN.test(location.reportCurrency)) {
      result.errors.push(
        `Location ${location.id} report currency is not ISO 4217`,
      );
    }
  }

  for (const scenario of repository.scenarios.scenarios) {
    if (!buildSet.has(scenario.buildId)) {
      result.errors.push(
        `Scenario ${scenario.id} references unknown build ${scenario.buildId}`,
      );
    }
    if (!locationSet.has(scenario.destinationId)) {
      result.errors.push(
        `Scenario ${scenario.id} references unknown destination ${scenario.destinationId}`,
      );
    }
    const isLoadedScenario = scenario.id === repository.loadedScenarioId;
    if (isLoadedScenario && scenario.quoteSnapshotId !== repository.quote.id) {
      result.errors.push(
        `Scenario ${scenario.id} quote snapshot was not loaded`,
      );
    }
    if (
      isLoadedScenario &&
      scenario.destinationId !== repository.quote.destinationId
    ) {
      result.errors.push(
        `Scenario ${scenario.id} destination ${scenario.destinationId} does not match quote destination ${repository.quote.destinationId}`,
      );
    }
    const destination = repository.locations.locations.find(
      (location) => location.id === scenario.destinationId,
    );
    if (
      destination !== undefined &&
      scenario.reportCurrency !== destination.reportCurrency
    ) {
      result.errors.push(
        `Scenario ${scenario.id} currency ${scenario.reportCurrency} does not match destination currency ${destination.reportCurrency}`,
      );
    }
    if (
      isLoadedScenario &&
      scenario.reportCurrency !== repository.quote.exchangeRates.reportCurrency
    ) {
      result.errors.push(
        `Scenario ${scenario.id} currency ${scenario.reportCurrency} does not match quote report currency ${repository.quote.exchangeRates.reportCurrency}`,
      );
    }
    for (const [partId, offerId] of Object.entries(
      scenario.selection.pins,
    )) {
      if (!partSet.has(partId)) {
        result.errors.push(
          `Scenario ${scenario.id} pins unknown part ${partId}`,
        );
      }
      if (!offerSet.has(offerId)) {
        result.errors.push(
          `Scenario ${scenario.id} pins unknown offer ${offerId}`,
        );
      }
      const offer = repository.offers.offers.find(
        (candidate) => candidate.id === offerId,
      );
      if (
        offer !== undefined &&
        !scenario.selection.allowedQualifications.includes(
          offer.qualification,
        )
      ) {
        result.errors.push(
          `Scenario ${scenario.id} does not allow qualification ${offer.qualification} for ${offerId}`,
        );
      }
      if (
        offer !== undefined &&
        !offer.purchaseUnit.contents.some(
          (content) => content.partId === partId,
        )
      ) {
        result.errors.push(
          `Scenario ${scenario.id} pins ${offerId}, which does not contain ${partId}`,
        );
      }
    }
  }

  const assemblyById = new Map(
    repository.assemblies.assemblies.map((assembly) => [assembly.id, assembly]),
  );
  const expectedRootIds = [
    "camera-pod",
    "control-cabinet",
    "corner-support-set",
    "dock",
    "positioning-line-set",
    "site-installation",
    "winch-set",
  ];
  const physicalRootIds = repository.assemblies.assemblies
    .filter(
      (assembly) =>
        assembly.kind === "physical" && assembly.parentAssemblyId === null,
    )
    .map((assembly) => assembly.id)
    .sort();
  if (physicalRootIds.join(",") !== expectedRootIds.join(",")) {
    result.errors.push(
      "ARBI V1 taxonomy must preserve the seven canonical physical root assemblies",
    );
  }
  for (const assembly of repository.assemblies.assemblies) {
    if (assembly.kind === "shared-procurement-stock") {
      if (assembly.parentAssemblyId !== null) {
        result.errors.push(
          `Shared procurement bucket ${assembly.id} cannot belong to the physical assembly hierarchy`,
        );
      }
      continue;
    }
    if (assembly.parentAssemblyId !== null) {
      if (assembly.parentAssemblyId === assembly.id) {
        result.errors.push(`Assembly ${assembly.id} cannot parent itself`);
      }
      const parent = assemblyById.get(assembly.parentAssemblyId);
      if (parent === undefined) {
        result.errors.push(
          `Assembly ${assembly.id} references unknown parent ${assembly.parentAssemblyId}`,
        );
      } else if (parent.kind !== "physical") {
        result.errors.push(
          `Assembly ${assembly.id} parent ${parent.id} is not physical`,
        );
      }
    }
  }
  for (const assembly of repository.assemblies.assemblies) {
    if (assembly.kind !== "physical") {
      continue;
    }
    const seen = new Set<string>();
    let current: typeof assembly | undefined = assembly;
    while (current !== undefined && current.parentAssemblyId !== null) {
      if (seen.has(current.id)) {
        result.errors.push(
          `Physical assembly hierarchy contains a cycle through ${assembly.id}`,
        );
        break;
      }
      seen.add(current.id);
      current = assemblyById.get(current.parentAssemblyId);
      if (current === undefined || current.kind !== "physical") {
        break;
      }
    }
  }
  const procurementBuckets = repository.assemblies.assemblies.filter(
    (assembly) => assembly.kind === "shared-procurement-stock",
  );
  if (procurementBuckets.length !== 1) {
    result.errors.push(
      `ARBI V1 taxonomy must contain one typed shared-procurement-stock bucket, found ${procurementBuckets.length}`,
    );
  }

  result.errors.sort();
  result.warnings.sort();
  return result;
}
