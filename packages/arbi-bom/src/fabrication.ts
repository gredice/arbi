import { Decimal } from "./decimal.js";
import type { BomRepository, FabricationEstimate, FilamentCost, FilamentMaterial, PrintRecipe } from "./types.js";

/** Consumption cost, not full-roll procurement or a complete fabrication quote. */
export function estimatePrintMaterials(
  repository: BomRepository,
  recipe: PrintRecipe,
  required: string,
  reportCurrency: string,
): FabricationEstimate {
  const geometry = new Map(repository.fabrication.geometry.models.map((model) => [model.modelId, model]));
  const materials = new Map(repository.fabrication.materials.map((material) => [material.id, material]));
  const volumes = recipe.components.map((component) => {
    const model = geometry.get(component.modelId);
    if (!model) throw new Error(`Missing print volume: ${component.modelId}`);
    return { component, volume: Decimal.parse(model.volumeCm3).multiply(Decimal.parse(component.quantity)) };
  });
  // Extend before rounding. A batch can mix materials and colours without
  // applying matte density to the functional parts in the same BOM item.
  const extend = (volume: Decimal) => volume.multiply(Decimal.parse(required))
    .divide(Decimal.parse(recipe.representedQuantity), 9);
  const costFor = (material: FilamentMaterial, volume: Decimal, color?: string, precision = 2): FilamentCost => {
    const weight = extend(volume).multiply(Decimal.parse(material.densityGramsPerCm3));
    const rate = material.currency === reportCurrency ? "1"
      : repository.quote.exchangeRates.reportCurrency === reportCurrency
        ? repository.quote.exchangeRates.rates[material.currency] : undefined;
    const cost = material.spoolPrice === null || rate === undefined ? null
      : weight.multiply(Decimal.parse(material.spoolPrice))
        .divide(Decimal.parse(material.spoolWeightGrams), 12)
        .multiply(Decimal.parse(rate)).round(precision).toString();
    return {
      materialId: material.id, name: material.name, weightGrams: weight.round(3).toString(),
      materialCost: cost, spoolPrice: material.spoolPrice, spoolWeightGrams: material.spoolWeightGrams,
      priceSourceUrl: material.colors?.find((variant) => variant.id === color)?.priceSourceUrl ?? material.priceSourceUrl,
      observedAt: material.observedAt, priceBasis: material.priceBasis,
      minimumBulkRolls: material.bulkPricing?.minimumRolls ?? null,
      bulkSourceUrl: material.bulkPricing?.sourceUrl ?? null,
    };
  };
  const totalVolume = volumes.reduce((sum, item) => sum.add(item.volume), Decimal.zero());
  // Comparisons assume the whole kit uses one material. The selected recipe
  // below retains its per-component assignments and reports a separate total.
  const alternatives = repository.fabrication.materials.map((material) => costFor(material, totalVolume));
  const groups = new Map<string, { material: FilamentMaterial; color: string | null; volume: Decimal }>();
  for (const { component, volume } of volumes) {
    const materialId = component.materialId ?? recipe.materialId;
    const material = materials.get(materialId);
    if (!material) throw new Error(`Unknown print material: ${materialId}`);
    const color = component.color ?? null;
    const key = `${materialId}/${color ?? ""}`;
    const group = groups.get(key);
    groups.set(key, { material, color, volume: (group?.volume ?? Decimal.zero()).add(volume) });
  }
  const ordered = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, group]) => group);
  const materialUsages = ordered.map(({ material, color, volume }) => ({ ...costFor(material, volume, color ?? undefined), color }));
  const weight = ordered.reduce((sum, { material, volume }) => sum.add(extend(volume)
    .multiply(Decimal.parse(material.densityGramsPerCm3))), Decimal.zero());
  const materialCost = materialUsages.some((usage) => usage.materialCost === null) ? null
    : materialUsages.reduce((sum, usage) => sum.add(Decimal.parse(usage.materialCost!)), Decimal.zero()).toString();
  const components = volumes.map(({ component, volume }) => ({
    ...costFor(materials.get(component.materialId ?? recipe.materialId)!, volume, component.color, 4),
    modelId: component.modelId,
    quantity: extend(Decimal.parse(component.quantity)).toString(),
    color: component.color ?? null,
  }));
  return {
    partId: recipe.partId, required, basis: "solid-volume-estimate", materialId: recipe.materialId,
    materialName: [...new Set(materialUsages.map((usage) => usage.name.replace("Bambu Lab ", "")))].join(" + "),
    materialUsages, components, weightGrams: weight.round(3).toString(), materialCost, currency: reportCurrency,
    note: recipe.note + " " + repository.fabrication.note, alternatives,
  };
}
