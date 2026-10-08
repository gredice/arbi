// Shapes of the data compiled by scripts/compile-data.mjs. Safe to import from client components.

export type Vec3 = [number, number, number];

export type Model = {
    id: string;
    revision: string;
    status: string;
    artifactRole: "fabrication" | "reference";
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
export type MeshRef = { kind: "glb"; node: string; glb: string } | { kind: "stl"; url: string };

export type BomPart = {
    id: string;
    name: string;
    baseUnit: string;
    kind: string;
    lifecycle: string;
    disciplines: string[];
    traits: string[];
    requirements: string[];
    required: string | null;
    unit: string;
    usedIn: { assemblyId: string; kind: string; quantity: string }[];
    offerId: string | null;
    supplierId: string | null;
    qualification: string | null;
    purchaseUnits: string | null;
    bundle: boolean;
    knownGoods: string | null;
    offerUrl: string | null;
    warnings: string[];
};

export type Download = { url: string; label: string; sha256: string | null; verified: boolean };

export type InventoryItem = { id: string; figure: string | null; count: number | null };
