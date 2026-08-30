export type Inclusion = "base" | "optional" | "deferred";
export type BaseUnit = "each" | "m";

export interface Part {
  id: string;
  name: string;
  baseUnit: BaseUnit;
  kind: "component" | "material" | "consumable";
  lifecycle: "active" | "planned";
  disciplines: string[];
  traits: string[];
  requirements: string[];
  notes?: string;
  fabrication?: {
    process: "openscad";
    modelStatus:
      | "planned"
      | "concept-unvalidated"
      | "prototype"
      | "validated"
      | "released"
      | "deprecated";
    sources: Array<{
      path: string;
      module: string;
      modelId?: string;
      revision?: string;
    }>;
  };
}

export interface PartCatalog {
  schemaVersion: 1;
  catalogId: string;
  description: string;
  parts: Part[];
}

export interface AssemblyUsage {
  partId: string;
  quantity: string;
  inclusion: Inclusion;
  note?: string;
}

export interface Assembly {
  id: string;
  kind: "physical" | "shared-procurement-stock";
  parentAssemblyId: string | null;
  name: string;
  description: string;
  disciplines: string[];
  usages: AssemblyUsage[];
}

export interface AssemblyCatalog {
  schemaVersion: 1;
  assemblies: Assembly[];
}

export interface Build {
  id: string;
  name: string;
  assemblies: Array<{ assemblyId: string; quantity: string }>;
}

export interface BuildCatalog {
  schemaVersion: 1;
  builds: Build[];
}

export interface Supplier {
  id: string;
  name: string;
  checkoutGroupIds: string[];
  website: string | null;
}

export interface SupplierCatalog {
  schemaVersion: 1;
  suppliers: Supplier[];
}

export interface OfferContent {
  partId: string;
  quantity: string;
}

export interface Offer {
  id: string;
  supplierId: string;
  checkoutGroupId: string;
  qualification: "approved" | "baseline-selected" | "candidate" | "unresolved";
  listing: {
    supplierSku: string | null;
    url: string | null;
    marketRegion: string | null;
  };
  purchaseUnit: {
    label: string;
    packagingKnown: boolean;
    minimum: string | null;
    increment: string | null;
    contents: OfferContent[];
  };
  note?: string;
}

export interface OfferCatalog {
  schemaVersion: 1;
  offers: Offer[];
}

export interface Location {
  id: string;
  name: string;
  country: string;
  region: string;
  postalCode: string;
  reportCurrency: string;
  tax: {
    status: "known" | "unknown";
    note: string;
  };
}

export interface LocationCatalog {
  schemaVersion: 1;
  locations: Location[];
}

export interface OfferPrice {
  offerId: string;
  availability: "available" | "in-stock" | "out-of-stock" | "unknown";
  observedAt: string | null;
  taxTreatment: "included" | "excluded" | "not-applicable" | "unknown";
  price: null | {
    basis: "base-unit" | "purchase-unit";
    amount: string;
    currency: string;
    normalizationNote?: string;
  };
}

export interface CheckoutGroupQuote {
  checkoutGroupId: string;
  supplierId: string;
  status: "known" | "unknown" | "not-applicable";
  observedAt: string | null;
  amount: string | null;
  currency: string;
  taxTreatment: "included" | "excluded" | "not-applicable" | "unknown";
  note: string;
}

export interface QuoteSnapshot {
  schemaVersion: 1;
  id: string;
  destinationId: string;
  capturedAt: string;
  exchangeRates: {
    reportCurrency: string;
    rates: Record<string, string>;
  };
  offerPrices: OfferPrice[];
  checkoutGroups: CheckoutGroupQuote[];
}

export interface Scenario {
  id: string;
  name: string;
  buildId: string;
  destinationId: string;
  quoteSnapshotId: string;
  reportCurrency: string;
  include: Inclusion[];
  selection: {
    mode: "pinned";
    allowedQualifications: Offer["qualification"][];
    pins: Record<string, string>;
  };
  unknownPolicy: "report-incomplete";
  notes: string[];
}

export interface ScenarioCatalog {
  schemaVersion: 1;
  scenarios: Scenario[];
}

export interface BomRepository {
  inputDigest: string;
  loadedScenarioId: string;
  parts: PartCatalog;
  assemblies: AssemblyCatalog;
  builds: BuildCatalog;
  suppliers: SupplierCatalog;
  offers: OfferCatalog;
  locations: LocationCatalog;
  quote: QuoteSnapshot;
  scenarios: ScenarioCatalog;
}

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

export interface RequirementResult {
  partId: string;
  required: string;
  unit: BaseUnit;
  assemblies: Array<{
    assemblyId: string;
    kind: Assembly["kind"];
    quantity: string;
  }>;
  selectedOfferId: string | null;
}

export interface CoverageResult {
  partId: string;
  required: string;
  purchased: string | null;
  surplus: string | null;
  unit: BaseUnit;
}

export interface SelectionResult {
  offerId: string;
  supplierId: string;
  checkoutGroupId: string;
  qualification: Offer["qualification"];
  purchaseUnits: string | null;
  knownGoodsAmount: string | null;
  currency: string | null;
  coverage: CoverageResult[];
  warnings: string[];
}

export interface ShippingResult {
  checkoutGroupId: string;
  supplierId: string;
  chargedOnce: true;
  status: CheckoutGroupQuote["status"];
  knownAmount: string | null;
  currency: string;
  warnings: string[];
}

export interface CalculationResult {
  schemaVersion: 1;
  scenarioId: string;
  scenarioName: string;
  buildId: string;
  destinationId: string;
  destinationName: string;
  quoteSnapshotId: string;
  inputDigest: string;
  reportCurrency: string;
  complete: boolean;
  completeLandedTotal: string | null;
  knownGoodsSubtotal: string;
  knownShippingSubtotal: string;
  knownSubtotal: string;
  requirements: RequirementResult[];
  selections: SelectionResult[];
  shipping: ShippingResult[];
  assemblyKnownGoods: Array<{ assemblyId: string; amount: string }>;
  sharedProcurementStockKnownGoods: string;
  sharedBundleGoods: string;
  sharedShipping: string;
  warnings: string[];
}
