// Shapes of the data compiled by scripts/compile-data.mjs. Safe to import from client components.

export type Vec3 = [number, number, number];

export type BomWarning = {
    severity: "critical" | "warning" | "issue";
    code: string;
    message: string;
    partIds: string[];
    assemblyIds: string[];
};

export type Model = {
    archiveReason?: string;
    supersededBy?: string[];
    alternativeConfiguration?: "camera-pod-bench";
    id: string;
    revision: string;
    status: string;
    artifactRole: "fabrication" | "reference" | "visualization";
    geometry?: { status: "approximate" | "measured-envelope" | "drawing-derived"; basis: string; rework: string; evidence?: string };
    bomPartIds: string[];
    assembly: string;
    entrypoint: string;
    output: string;
    documentation: string;
    description: string;
};

export type ScenePart = {
    node: string;
    model: string;
    registered: boolean;
    /** Existing CAD or BOM page for this mesh; absent for unmapped context. */
    href?: string;
    group: string;
    color: Vec3;
    explode: Vec3;
    /** STL path under /data (STL scenes). */
    url?: string;
    /** Source-colored surfaces in the same local coordinates as the STL. */
    components?: MaterialComponent[];
    /** Row-major 4×4 placement (STL scenes). */
    matrix?: number[][];
};

export type SceneSource = { kind: "release" | "snapshot" | "local"; tag?: string; asset?: string; path?: string; current?: boolean };

export type Scene = {
    kind: "glb" | "stl";
    /** GLB path under /data (GLB scenes). */
    glb?: string;
    bounds?: { min: Vec3; max: Vec3 };
    layout: "assembly" | "lineup";
    figureDir?: string;
    figures: string[];
    pose: string | null;
    configuration?: string;
    source: SceneSource;
    parts: ScenePart[];
};

export type SceneMeta = {
    file: string;
    kind: Scene["kind"];
    layout: Scene["layout"];
    pose: string | null;
    source: SceneSource;
    hero: string | null;
    exploded: string | null;
    parts: number;
};

/** A mesh for one model: a node of the pod GLB or an STL path, both under /data. */
export type SurfaceMaterial = { color: Vec3; roughness: number; metalness: number; transmission: number; thickness: number; ior: number };
export type MaterialComponent = { node: string; url: string; material: SurfaceMaterial };
export type MeshRef = { kind: "glb"; node: string; glb: string } | { kind: "stl"; url: string } |
    { kind: "components"; parts: MaterialComponent[]; envelope: Vec3 };

export type PrintEstimate = {
    basis: string;
    required: string;
    materialId: string;
    materialName: string;
    materialUsages: (PrintMaterialCost & { color: string | null })[];
    components: (PrintMaterialCost & { modelId: string; quantity: string; color: string | null })[];
    weightGrams: string;
    materialCost: string | null;
    note: string;
    alternatives: PrintMaterialCost[];
};

export type PrintMaterialCost = {
    materialId: string; name: string; weightGrams: string; materialCost: string | null;
    spoolPrice: string | null; spoolWeightGrams: string; priceSourceUrl: string; observedAt: string;
    priceBasis: "single-spool" | "bulk-spool"; minimumBulkRolls: number | null; bulkSourceUrl: string | null;
};

export type BomPart = {
    archiveReason?: string;
    fabrication?: { sources: { modelId?: string }[] };
    id: string;
    name: string;
    baseUnit: string;
    kind: string;
    lifecycle: string;
    disciplines: string[];
    traits: string[];
    requirements: string[];
    notes?: string;
    required: string | null;
    unit: string;
    usedIn: { assemblyId: string; kind: string; quantity: string; knownGoodsAmount: string | null }[];
    offerId: string | null;
    supplierId: string | null;
    qualification: string | null;
    purchaseUnits: string | null;
    bundle: boolean;
    goodsAllocationBasis: "single-part" | "part-count" | null;
    knownGoods: string | null;
    actualDelivered: { importCharges?: string; amount: string; currency: string; quantity: string; confirmedAt: string; note: string } | null;
    quotedPrice: { amount: string; currency: string; basis: string } | null;
    delivery: { amount: string; currency: string; note: string } | null;
    observedAt: string | null;
    customsPolicy: { amount: string; currency: string; startsOn: string; endsOn: string | null; orderValueBelow: string } | null;
    printEstimate: PrintEstimate | null;
    printReference: PrintEstimate | null;
    offerUrl: string | null;
    warnings: string[];
    warningDetails: BomWarning[];
};

export type Download = { url: string; label: string; sha256: string | null; verified: boolean };

export type WarningCounts = Record<BomWarning["severity"], number>;
export type InventoryItem = { id: string; name?: string; note?: string; figure: string | null; count: number | null; warningCounts?: WarningCounts };
