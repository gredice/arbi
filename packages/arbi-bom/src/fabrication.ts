import { Decimal } from "./decimal.js";
import type { BomRepository, FabricationEstimate, PrintRecipe } from "./types.js";

/** Consumption cost, not full-roll procurement or a complete fabrication quote. */
export function estimatePrintMaterials(
  repository: BomRepository,
  recipe: PrintRecipe,
  required: string,
  reportCurrency: string,
): FabricationEstimate {
  const geometry = new Map(repository.fabrication.geometry.models.map((model) => [model.modelId, model]));
  const batchVolume = recipe.components.reduce((total, component) => {
    const model = geometry.get(component.modelId);
    if (!model) throw new Error(`Missing print volume: ${component.modelId}`);
    return total.add(Decimal.parse(model.volumeCm3).multiply(Decimal.parse(component.quantity)));
  }, Decimal.zero());
  const volume = batchVolume.multiply(Decimal.parse(required)).divide(Decimal.parse(recipe.representedQuantity), 9);
  const alternatives = repository.fabrication.materials.map((material) => {
    const weight = volume.multiply(Decimal.parse(material.densityGramsPerCm3));
    const rate = material.currency === reportCurrency ? "1"
      : repository.quote.exchangeRates.reportCurrency === reportCurrency
        ? repository.quote.exchangeRates.rates[material.currency] : undefined;
    const cost = material.spoolPrice === null || rate === undefined ? null
      : weight.multiply(Decimal.parse(material.spoolPrice))
        .divide(Decimal.parse(material.spoolWeightGrams), 12)
        .multiply(Decimal.parse(rate)).round(2).toString();
    return {
      materialId: material.id, name: material.name, weightGrams: weight.round(3).toString(),
      materialCost: cost, spoolPrice: material.spoolPrice, spoolWeightGrams: material.spoolWeightGrams,
      priceSourceUrl: material.priceSourceUrl, observedAt: material.observedAt,
    };
  });
  const selected = alternatives.find((item) => item.materialId === recipe.materialId);
  if (!selected) throw new Error(`Unknown print material: ${recipe.materialId}`);
  return {
    partId: recipe.partId, required, basis: "solid-volume-estimate", materialId: recipe.materialId,
    weightGrams: selected.weightGrams, materialCost: selected.materialCost, currency: reportCurrency,
    note: recipe.note + " " + repository.fabrication.note, alternatives,
  };
}
