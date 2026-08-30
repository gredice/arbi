import {
  ceilRatio,
  Decimal,
  roundUpToIncrement,
} from "./decimal.js";
import { validateRepository } from "./validate.js";
import type {
  BomRepository,
  CalculationResult,
  CoverageResult,
  Offer,
  RequirementResult,
  Scenario,
  SelectionResult,
  ShippingResult,
} from "./types.js";

interface RequirementAccumulator {
  quantity: Decimal;
  assemblies: Map<string, Decimal>;
}

function findScenario(
  repository: BomRepository,
  scenarioId: string,
): Scenario {
  const scenario = repository.scenarios.scenarios.find(
    (candidate) => candidate.id === scenarioId,
  );
  if (scenario === undefined) {
    throw new Error("Unknown scenario: " + scenarioId);
  }
  return scenario;
}

function convertMoney(
  repository: BomRepository,
  amount: Decimal,
  currency: string,
  reportCurrency: string,
): Decimal | null {
  if (repository.quote.exchangeRates.reportCurrency !== reportCurrency) {
    return null;
  }
  const rate = repository.quote.exchangeRates.rates[currency];
  return rate === undefined
    ? null
    : amount.multiply(Decimal.parse(rate)).round(2);
}

function allocateByWeight(
  amount: Decimal,
  weights: Array<{ id: string; weight: Decimal }>,
): Array<{ id: string; amount: Decimal }> {
  if (weights.length === 0) {
    return [];
  }
  const rounded = amount.round(2);
  const cents =
    rounded.coefficient * 10n ** BigInt(Math.max(0, 2 - rounded.scale));
  const scale = Math.max(...weights.map((item) => item.weight.scale));
  const normalized = weights.map((item) => ({
    id: item.id,
    weight:
      item.weight.coefficient *
      10n ** BigInt(scale - item.weight.scale),
  }));
  const totalWeight = normalized.reduce(
    (total, item) => total + item.weight,
    0n,
  );
  if (totalWeight === 0n) {
    return [];
  }
  const shares = normalized.map((item) => {
    const numerator = cents * item.weight;
    return {
      id: item.id,
      cents: numerator / totalWeight,
      remainder: numerator % totalWeight,
    };
  });
  let remaining =
    cents - shares.reduce((total, item) => total + item.cents, 0n);
  const remainderOrder = [...shares].sort((left, right) => {
    if (left.remainder !== right.remainder) {
      return left.remainder > right.remainder ? -1 : 1;
    }
    return left.id.localeCompare(right.id);
  });
  for (const share of remainderOrder) {
    if (remaining === 0n) {
      break;
    }
    share.cents += 1n;
    remaining -= 1n;
  }
  return shares
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((item) => ({
      id: item.id,
      amount: Decimal.fromScaled(item.cents, 2),
    }));
}

function selectedContents(
  offer: Offer,
  requirements: Map<string, RequirementAccumulator>,
  scenario: Scenario,
): Offer["purchaseUnit"]["contents"] {
  return offer.purchaseUnit.contents.filter(
    (content) =>
      requirements.has(content.partId) &&
      scenario.selection.pins[content.partId] === offer.id,
  );
}

export function calculateBom(
  repository: BomRepository,
  scenarioId = "arbi-v1-hr-zagreb",
): CalculationResult {
  const validation = validateRepository(repository);
  if (validation.errors.length > 0) {
    throw new Error(
      "Cannot calculate an invalid BOM:\n" + validation.errors.join("\n"),
    );
  }

  const scenario = findScenario(repository, scenarioId);
  const build = repository.builds.builds.find(
    (candidate) => candidate.id === scenario.buildId,
  );
  if (build === undefined) {
    throw new Error("Unknown build: " + scenario.buildId);
  }
  const included = new Set(scenario.include);
  const requirements = new Map<string, RequirementAccumulator>();

  for (const buildAssembly of build.assemblies) {
    const assembly = repository.assemblies.assemblies.find(
      (candidate) => candidate.id === buildAssembly.assemblyId,
    );
    if (assembly === undefined) {
      continue;
    }
    const assemblyMultiplier = Decimal.parse(buildAssembly.quantity);
    for (const usage of assembly.usages) {
      if (!included.has(usage.inclusion)) {
        continue;
      }
      const quantity = Decimal.parse(usage.quantity).multiply(
        assemblyMultiplier,
      );
      const accumulator = requirements.get(usage.partId) ?? {
        quantity: Decimal.zero(),
        assemblies: new Map<string, Decimal>(),
      };
      accumulator.quantity = accumulator.quantity.add(quantity);
      accumulator.assemblies.set(
        assembly.id,
        (accumulator.assemblies.get(assembly.id) ?? Decimal.zero()).add(
          quantity,
        ),
      );
      requirements.set(usage.partId, accumulator);
    }
  }

  const partById = new Map(
    repository.parts.parts.map((part) => [part.id, part]),
  );
  const offerById = new Map(
    repository.offers.offers.map((offer) => [offer.id, offer]),
  );
  const assemblyById = new Map(
    repository.assemblies.assemblies.map((assembly) => [assembly.id, assembly]),
  );
  const priceByOffer = new Map(
    repository.quote.offerPrices.map((price) => [price.offerId, price]),
  );
  const globalWarnings = new Set<string>(validation.warnings);
  const destination = repository.locations.locations.find(
    (location) => location.id === scenario.destinationId,
  );
  if (destination?.tax.status === "unknown") {
    globalWarnings.add(
      destination.id +
        ": Destination tax/VAT status is unknown and blocks a complete landed total.",
    );
  }

  for (const partId of requirements.keys()) {
    if (scenario.selection.pins[partId] === undefined) {
      globalWarnings.add("Required part " + partId + " has no pinned offer.");
    }
  }

  const selectedOfferIds = [
    ...new Set(
      [...requirements.keys()]
        .map((partId) => scenario.selection.pins[partId])
        .filter((offerId): offerId is string => offerId !== undefined),
    ),
  ].sort();
  const selections: SelectionResult[] = [];
  const knownGoodsByOffer = new Map<string, Decimal>();

  for (const offerId of selectedOfferIds) {
    const offer = offerById.get(offerId);
    if (offer === undefined) {
      continue;
    }
    const warnings: string[] = [];
    const coveredContents = selectedContents(offer, requirements, scenario);
    if (offer.qualification !== "approved") {
      warnings.push(
        "Qualification is " +
          offer.qualification +
          "; the recorded selection is not engineering approval.",
      );
    }

    let purchaseUnits: bigint | null = null;
    const coverage: CoverageResult[] = [];
    if (
      !offer.purchaseUnit.packagingKnown ||
      offer.purchaseUnit.minimum === null ||
      offer.purchaseUnit.increment === null
    ) {
      warnings.push("Package size/MOQ is unknown.");
      for (const content of coveredContents) {
        const requirement = requirements.get(content.partId);
        const part = partById.get(content.partId);
        if (requirement !== undefined && part !== undefined) {
          coverage.push({
            partId: content.partId,
            required: requirement.quantity.toString(),
            purchased: null,
            surplus: null,
            unit: part.baseUnit,
          });
        }
      }
    } else {
      let needed = 0n;
      for (const content of coveredContents) {
        const requirement = requirements.get(content.partId);
        if (requirement !== undefined) {
          const ratio = ceilRatio(
            requirement.quantity,
            Decimal.parse(content.quantity),
          );
          if (ratio > needed) {
            needed = ratio;
          }
        }
      }
      purchaseUnits = roundUpToIncrement(
        needed,
        Decimal.parse(offer.purchaseUnit.minimum).coefficient,
        Decimal.parse(offer.purchaseUnit.increment).coefficient,
      );
      for (const content of coveredContents) {
        const requirement = requirements.get(content.partId);
        const part = partById.get(content.partId);
        if (requirement !== undefined && part !== undefined) {
          const purchased = Decimal.parse(content.quantity).multiplyInteger(
            purchaseUnits,
          );
          coverage.push({
            partId: content.partId,
            required: requirement.quantity.toString(),
            purchased: purchased.toString(),
            surplus: purchased.subtract(requirement.quantity).toString(),
            unit: part.baseUnit,
          });
        }
      }
    }

    const quoted = priceByOffer.get(offer.id);
    let knownGoodsAmount: Decimal | null = null;
    if (quoted === undefined) {
      warnings.push("Destination quote row is missing.");
      warnings.push("Price is unknown.");
    } else if (quoted.price === null) {
      warnings.push("Price is unknown.");
    } else if (purchaseUnits === null) {
      warnings.push("A quoted price cannot be extended without package data.");
    } else {
      let nativeAmount: Decimal | null = null;
      if (quoted.price.basis === "purchase-unit") {
        nativeAmount = Decimal.parse(quoted.price.amount).multiplyInteger(
          purchaseUnits,
        );
      } else if (offer.purchaseUnit.contents.length === 1) {
        nativeAmount = Decimal.parse(quoted.price.amount)
          .multiply(Decimal.parse(offer.purchaseUnit.contents[0]!.quantity))
          .multiplyInteger(purchaseUnits);
      } else {
        warnings.push(
          "A bundle cannot use a base-unit price; purchase-unit price is required.",
        );
      }
      if (nativeAmount !== null) {
        knownGoodsAmount = convertMoney(
          repository,
          nativeAmount,
          quoted.price.currency,
          scenario.reportCurrency,
        );
        if (knownGoodsAmount === null) {
          warnings.push(
            "No committed FX rate converts " +
              quoted.price.currency +
              " to " +
              scenario.reportCurrency +
              ".",
          );
        }
      }
      if (quoted.taxTreatment === "unknown") {
        warnings.push("Tax/VAT treatment is unknown.");
      } else if (quoted.taxTreatment === "excluded") {
        warnings.push(
          "Tax/VAT is excluded but no explicit tax amount or rate is modeled.",
        );
      }
    }
    if (quoted?.availability === "unknown") {
      warnings.push("Availability is unknown.");
    } else if (quoted?.availability === "out-of-stock") {
      warnings.push("Offer is out of stock.");
    }
    if (quoted?.observedAt === null) {
      warnings.push(
        "Price and availability observation date is unknown; quote capture time is not verification time.",
      );
    }
    if (knownGoodsAmount !== null) {
      knownGoodsByOffer.set(offer.id, knownGoodsAmount);
    }
    warnings.sort();
    for (const warning of warnings) {
      globalWarnings.add(offer.id + ": " + warning);
    }
    selections.push({
      offerId: offer.id,
      supplierId: offer.supplierId,
      checkoutGroupId: offer.checkoutGroupId,
      qualification: offer.qualification,
      purchaseUnits:
        purchaseUnits === null ? null : purchaseUnits.toString(),
      knownGoodsAmount:
        knownGoodsAmount === null ? null : knownGoodsAmount.toString(),
      currency:
        knownGoodsAmount === null ? null : scenario.reportCurrency,
      coverage: coverage.sort((left, right) =>
        left.partId.localeCompare(right.partId),
      ),
      warnings,
    });
  }

  const selectedGroups = [
    ...new Set(selections.map((selection) => selection.checkoutGroupId)),
  ].sort();
  const shipping: ShippingResult[] = [];
  let knownShipping = Decimal.zero();
  for (const checkoutGroupId of selectedGroups) {
    const quote = repository.quote.checkoutGroups.find(
      (candidate) => candidate.checkoutGroupId === checkoutGroupId,
    );
    const warnings: string[] = [];
    if (quote === undefined) {
      globalWarnings.add(checkoutGroupId + ": Shipping policy is missing.");
      continue;
    }
    let knownAmount: Decimal | null = null;
    if (quote.status === "unknown" || quote.amount === null) {
      warnings.push("Shipping is unknown; null is not treated as free.");
    } else {
      knownAmount = convertMoney(
        repository,
        Decimal.parse(quote.amount),
        quote.currency,
        scenario.reportCurrency,
      );
      if (knownAmount === null) {
        warnings.push(
          "No committed FX rate converts shipping from " +
            quote.currency +
            ".",
        );
      } else {
        knownShipping = knownShipping.add(knownAmount);
      }
      if (quote.taxTreatment === "unknown") {
        warnings.push("Shipping tax/VAT treatment is unknown.");
      } else if (quote.taxTreatment === "excluded") {
        warnings.push(
          "Shipping tax/VAT is excluded but no explicit tax amount or rate is modeled.",
        );
      }
    }
    if (quote.observedAt === null) {
      warnings.push(
        "Shipping observation date is unknown; quote capture time is not verification time.",
      );
    }
    warnings.sort();
    for (const warning of warnings) {
      globalWarnings.add(checkoutGroupId + ": " + warning);
    }
    shipping.push({
      checkoutGroupId,
      supplierId: quote.supplierId,
      chargedOnce: true,
      status: quote.status,
      knownAmount: knownAmount === null ? null : knownAmount.toString(),
      currency: scenario.reportCurrency,
      warnings,
    });
  }

  let knownGoods = Decimal.zero();
  for (const amount of knownGoodsByOffer.values()) {
    knownGoods = knownGoods.add(amount);
  }
  const assemblyAmounts = new Map<string, Decimal>();
  let sharedBundleGoods = Decimal.zero();
  for (const selection of selections) {
    const amount = knownGoodsByOffer.get(selection.offerId);
    const offer = offerById.get(selection.offerId);
    if (amount === undefined || offer === undefined) {
      continue;
    }
    const covered = selectedContents(offer, requirements, scenario);
    if (covered.length !== 1) {
      sharedBundleGoods = sharedBundleGoods.add(amount);
      continue;
    }
    const requirement = requirements.get(covered[0]!.partId);
    if (requirement === undefined) {
      continue;
    }
    const allocations = allocateByWeight(
      amount,
      [...requirement.assemblies.entries()].map(
        ([assemblyId, weight]) => ({ id: assemblyId, weight }),
      ),
    );
    for (const allocation of allocations) {
      assemblyAmounts.set(
        allocation.id,
        (assemblyAmounts.get(allocation.id) ?? Decimal.zero()).add(
          allocation.amount,
        ),
      );
    }
  }

  const requirementResults: RequirementResult[] = [...requirements.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([partId, requirement]) => {
      const part = partById.get(partId);
      if (part === undefined) {
        throw new Error("Unknown part during calculation: " + partId);
      }
      return {
        partId,
        required: requirement.quantity.toString(),
        unit: part.baseUnit,
        assemblies: [...requirement.assemblies.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([assemblyId, quantity]) => ({
            assemblyId,
            kind: assemblyById.get(assemblyId)?.kind ?? "physical",
            quantity: quantity.toString(),
          })),
        selectedOfferId: scenario.selection.pins[partId] ?? null,
      };
    });

  const warnings = [...globalWarnings].sort();
  const complete = warnings.length === 0;
  const knownSubtotal = knownGoods.add(knownShipping);
  return {
    schemaVersion: 1,
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    buildId: build.id,
    destinationId: scenario.destinationId,
    destinationName: destination?.name ?? scenario.destinationId,
    quoteSnapshotId: scenario.quoteSnapshotId,
    inputDigest: repository.inputDigest,
    reportCurrency: scenario.reportCurrency,
    complete,
    completeLandedTotal: complete ? knownSubtotal.toString() : null,
    knownGoodsSubtotal: knownGoods.toString(),
    knownShippingSubtotal: knownShipping.toString(),
    knownSubtotal: knownSubtotal.toString(),
    requirements: requirementResults,
    selections,
    shipping,
    assemblyKnownGoods: [...assemblyAmounts.entries()]
      .filter(
        ([assemblyId]) => assemblyById.get(assemblyId)?.kind === "physical",
      )
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([assemblyId, amount]) => ({
        assemblyId,
        amount: amount.toString(),
      })),
    sharedProcurementStockKnownGoods: [...assemblyAmounts.entries()]
      .filter(
        ([assemblyId]) =>
          assemblyById.get(assemblyId)?.kind === "shared-procurement-stock",
      )
      .reduce((total, [, amount]) => total.add(amount), Decimal.zero())
      .toString(),
    sharedBundleGoods: sharedBundleGoods.toString(),
    sharedShipping: knownShipping.toString(),
    warnings,
  };
}
