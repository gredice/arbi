import { Decimal } from "./decimal.js";
import type { CalculationResult } from "./types.js";

function money(value: string, currency: string): string {
  return currency + " " + Decimal.parse(value).toFixed(2);
}

function cell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function coverageSummary(
  selection: CalculationResult["selections"][number],
): string {
  return selection.coverage
    .map((coverage) => {
      const purchase =
        coverage.purchased === null
          ? "unknown purchase quantity"
          : coverage.purchased +
            " " +
            coverage.unit +
            " purchased; " +
            coverage.surplus +
            " surplus";
      return (
        coverage.partId +
        ": " +
        coverage.required +
        " " +
        coverage.unit +
        " required, " +
        purchase
      );
    })
    .join("; ");
}

export function renderJson(result: CalculationResult): string {
  return JSON.stringify(result, null, 2) + "\n";
}

export function renderMarkdown(result: CalculationResult): string {
  const lines: string[] = [
    "# BOM — " + result.scenarioName,
    "",
    result.complete
      ? "> **Status: COMPLETE for the pinned scenario and committed evidence.**"
      : "> **Status: INCOMPLETE. This is not a trustworthy complete landed total.**",
    result.complete
      ? "> The complete landed total includes every selected purchase and checkout-group charge under the pinned scenario."
      : "> Unknown package rules, prices, tax treatment, shipping, availability, and unqualified baseline selections remain visible below. Null values are never treated as zero.",
    "",
    "## Calculation identity",
    "",
    "- Scenario: " + result.scenarioId,
    "- Build: " + result.buildId,
    "- Destination: " + result.destinationId,
    "- Quote snapshot: " + result.quoteSnapshotId,
    "- Input digest: " + result.inputDigest,
    "- Complete landed total: **" +
      (result.completeLandedTotal === null
        ? "unavailable"
        : money(result.completeLandedTotal, result.reportCurrency)) +
      "**",
    "- Known quoted goods subtotal: **" +
      money(result.knownGoodsSubtotal, result.reportCurrency) +
      "**",
    "- Known checkout-group shipping subtotal: **" +
      money(result.knownShippingSubtotal, result.reportCurrency) +
      "**",
    "- Known partial subtotal: **" +
      money(result.knownSubtotal, result.reportCurrency) +
      "**",
    "",
    result.complete
      ? "The committed evidence is sufficient for this pinned calculation. Changing destination, supplier selection, availability, or quote date requires a new scenario or quote snapshot."
      : "The known partial subtotal is evidence about recorded values only. It excludes every unresolved amount and must not be presented as the project cost.",
    "",
    "## Physical assembly goods",
    "",
    "| Physical assembly | Known directly attributable goods |",
    "| --- | ---: |",
  ];
  for (const assembly of result.assemblyKnownGoods) {
    lines.push(
      "| " +
        cell(assembly.assemblyId) +
        " | " +
        money(assembly.amount, result.reportCurrency) +
        " |",
    );
  }
  lines.push(
    "| Shared multi-part purchase bundles | " +
      money(result.sharedBundleGoods, result.reportCurrency) +
      " |",
    "| Shared checkout-group shipping | " +
      money(result.sharedShipping, result.reportCurrency) +
      " |",
    "",
    "Bundle and shipping costs stay in explicit shared buckets when the committed record does not provide defensible physical-assembly allocation weights.",
    "",
    "## Non-physical procurement bucket",
    "",
    "| Purchasing bucket | Known directly attributable goods |",
    "| --- | ---: |",
    "| shared-procurement-stock | " +
      money(result.sharedProcurementStockKnownGoods, result.reportCurrency) +
      " |",
    "",
    "This bucket is not a subsystem or physical owner. It holds assortment purchases until consumption can be allocated to an installed assembly.",
    "",
    "## Checkout groups",
    "",
    "| Checkout group | Supplier | Shipping evidence | Charged |",
    "| --- | --- | --- | ---: |",
  );
  for (const shipping of result.shipping) {
    lines.push(
      "| " +
        cell(shipping.checkoutGroupId) +
        " | " +
        cell(shipping.supplierId) +
        " | " +
        shipping.status +
        " | " +
        (shipping.status === "not-applicable"
          ? "not applicable"
          : shipping.knownAmount === null
          ? "unknown"
          : money(shipping.knownAmount, result.reportCurrency)) +
        " |",
    );
  }
  lines.push(
    "",
    result.shipping.some((item) => item.checkoutGroupId === "tme-hr")
      ? "Shipping is evaluated once per checkout group. The recorded TME EUR 2.46 charge is represented once."
      : "Shipping is evaluated once per checkout group.",
    "",
    "## Selected purchase units",
    "",
    "| Offer | Qualification | Purchase units | Coverage and surplus | Known goods |",
    "| --- | --- | ---: | --- | ---: |",
  );
  for (const selection of result.selections) {
    lines.push(
      "| " +
        cell(selection.offerId) +
        " | " +
        selection.qualification +
        " | " +
        (selection.purchaseUnits ?? "unknown") +
        " | " +
        cell(coverageSummary(selection)) +
        " | " +
        (selection.knownGoodsAmount === null
          ? "unknown"
          : money(selection.knownGoodsAmount, result.reportCurrency)) +
        " |",
    );
  }
  lines.push(
    "",
    "## Required parts by physical owner or procurement bucket",
    "",
    "| Part | Required | Owner or typed purchasing bucket | Pinned offer |",
    "| --- | ---: | --- | --- |",
  );
  for (const requirement of result.requirements) {
    const owners = requirement.assemblies
      .map(
        (assembly) =>
          assembly.assemblyId +
          (assembly.kind === "shared-procurement-stock"
            ? " [non-physical]"
            : "") +
          " (" +
          assembly.quantity +
          " " +
          requirement.unit +
          ")",
      )
      .join(", ");
    lines.push(
      "| " +
        cell(requirement.partId) +
        " | " +
        requirement.required +
        " " +
        requirement.unit +
        " | " +
        cell(owners) +
        " | " +
        cell(requirement.selectedOfferId ?? "unresolved") +
        " |",
    );
  }
  lines.push("", "## Incompleteness warnings", "");
  for (const warning of result.warnings) {
    lines.push("- " + warning);
  }
  if (result.warnings.length === 0) {
    lines.push("None.");
  }
  lines.push(
    "",
    "## Evidence boundary",
    "",
    "- The committed BOM inputs are the sole canonical project records. Supplier URLs and dated quote observations are evidence attached to those records, not a competing source of truth.",
    "- The motor kit is modeled as four component types, and the dock funnel and nest are separate generated artifacts; reviewed Git changes may extend the catalog.",
    "- A baseline-selected or unresolved offer is a procurement status, not engineering approval.",
    "- OpenSCAD source consistency, calculation success, procurement, installation, and physical safety validation are separate facts.",
    "",
  );
  return lines.join("\n");
}
