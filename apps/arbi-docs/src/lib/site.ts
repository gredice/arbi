// Build-time access to the data compiled by scripts/compile-data.mjs into public/data.
// Server components only: it reads the filesystem.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { links } from "./format";
import type { BomPart, Download, InventoryItem, MeshRef, Model, Scene, SceneMeta, ScenePart } from "./types";

const DATA = join(process.cwd(), "public/data");
const readJson = <T,>(path: string): T => JSON.parse(readFileSync(join(DATA, path), "utf8")) as T;

type Assembly = { id: string; kind: string; name: string; description: string; documentation: string; usages: { partId: string; quantity: string; inclusion: string }[] };
type DocEntry = { path: string; title: string; section: string; summary: string; bytes: number };
type ReleaseInfo = {
    tag: string;
    commit: string;
    url: string;
    assetCount: number;
    missingOutputs: string[];
    booklets: { name: string; url: string; sha256: string }[];
};
type Snapshot = { path: string; name: string; bytes: number; url: string; kind: string };
type RawSite = {
    repository: string;
    commit: string;
    commitDate: string;
    registry: { models: Model[]; archivedModels?: Model[] };
    bom: {
        summary: {
            scenarioId: string;
            scenarioName: string;
            destinationName: string;
            quoteSnapshotId: string;
            complete: boolean;
            knownGoodsSubtotal: string;
            knownShippingSubtotal: string; knownCustomsSubtotal: string;
            knownSubtotal: string;
            estimatedMaterialSubtotal: string;
            estimatedPartialSubtotal: string;
            assemblyPartialGoods: { assemblyId: string; amount: string }[];
            assemblyEstimatedMaterials: { assemblyId: string; amount: string }[];
            assemblyKnownGoods: { assemblyId: string; amount: string }[];
            sharedProcurementStockKnownGoods: string;
            warningCount: number;
        };
        parts: BomPart[];
        assemblies: Assembly[];
    };
    docs: DocEntry[];
    release: ReleaseInfo | null;
    scenes: Record<string, SceneMeta>;
    meshes: Record<string, { kind: "glb" | "stl"; node?: string; url?: string }>;
    figures: Record<string, string>;
    downloads: Record<string, { release: { url: string; sha256: string; tag: string } | null; packs: { path: string; name: string; url: string }[] }>;
    snapshots: Snapshot[];
};

export type System = Assembly & {
    slug: string;
    number: string;
    scene: SceneMeta | null;
    models: Model[];
    goods: string | null;
    doc: DocEntry | undefined;
};

function load() {
    const site = readJson<RawSite>("site.json");
    const scenes: Record<string, Scene> = {};
    for (const [slug, meta] of Object.entries(site.scenes)) scenes[slug] = readJson<Scene>(meta.file);
    const docTexts = readJson<Record<string, string>>("docs.json");
    const models = site.registry.models;
    const archivedModels = site.registry.archivedModels ?? [];
    const modelById = new Map([...models, ...archivedModels].map((m) => [m.id, m]));
    const bomById = new Map(site.bom.parts.map((p) => [p.id, p]));
    const goods = new Map(site.bom.summary.assemblyKnownGoods.map((g) => [g.assemblyId, g.amount]));
    const slugOf = (path: string) => path.match(/assemblies\/([^/]+)\//)?.[1] ?? path;
    const systems: System[] = site.bom.assemblies
        .filter((a) => a.kind === "physical")
        .map((a, i) => {
            const slug = slugOf(a.documentation);
            return {
                ...a,
                slug,
                number: String(i + 1).padStart(2, "0"),
                scene: site.scenes[slug] ?? null,
                models: models.filter((m) => m.assembly === slug),
                goods: goods.get(a.id) ?? null,
                doc: site.docs.find((d) => d.path === a.documentation),
            };
        });
    // Installed quantities come only from assembly scenes, never from part lineups.
    const instances = new Map<string, { scene: string; parts: ScenePart[] }>();
    for (const [slug, scene] of Object.entries(scenes)) {
        if (scene.layout !== "assembly") continue;
        for (const p of scene.parts) {
            if (!instances.has(p.model)) instances.set(p.model, { scene: slug, parts: [] });
            // A shared part's default count belongs to its first configured assembly.
            // Variant inventories request their own scene's quantities explicitly.
            if (instances.get(p.model)!.scene !== slug) continue;
            instances.get(p.model)!.parts.push(p);
        }
    }
    return { site, scenes, docTexts, models, archivedModels, modelById, bomById, systems, instances };
}

let cache: ReturnType<typeof load> | undefined;
export const data = () => (cache ??= load());

export const systemBySlug = (slug: string): System | undefined => {
    if (slug === "winch-powered") {
        const winch = data().systems.find((s) => s.slug === "winch");
        return winch && {
            ...winch,
            slug,
            name: "Powered winch set",
            description: "The powered positioning-line winch, with its longer drum, slip-ring interface, and dedicated enclosure parts. One of the four winches in the winch set.",
            scene: data().site.scenes[slug] ?? null,
        };
    }
    return data().systems.find((s) => s.slug === slug);
};
export const installedCount = (id: string, slug?: string) => data().modelById.get(id)?.archiveReason ? null : slug
    ? data().scenes[slug]?.parts.filter((p) => p.model === id).length ?? null
    : data().instances.get(id)?.parts.length ?? null;

export function figureFor(id: string): string | null {
    const preview = data().site.figures[id];
    if (preview) return `/data/${preview}`;
    for (const scene of Object.values(data().scenes)) {
        for (const name of [`part-${id}`, `part-${id.replace(/^winch-/, "")}`])
            if (scene.figures.includes(name)) return `/data/${scene.figureDir}/figures/${name}.png`;
    }
    return null;
}

export function meshFor(id: string): MeshRef | null {
    const m = data().site.meshes[id];
    if (!m) return null;
    if (m.kind === "glb") return { kind: "glb", node: m.node!, glb: data().scenes["camera-pod"].glb! };
    return { kind: "stl", url: m.url! };
}

export const partColor = (id: string) => data().instances.get(id)?.parts[0]?.color ?? ([0.12, 0.14, 0.15] as const);

/** Best verified download: the CAD release asset, else a committed pack containing the mesh. */
export function download(id: string): Download {
    if (data().modelById.get(id)?.archiveReason)
        return { url: links.releases, label: "Archived · excluded from current fabrication", sha256: null, verified: false };
    const d = data().site.downloads[id];
    if (d?.release) return { url: d.release.url, label: "CAD release", sha256: d.release.sha256, verified: true };
    if (d?.packs.length) return { url: d.packs[0].url, label: `In ${d.packs[0].name}`, sha256: null, verified: true };
    return { url: links.releases, label: "Not published", sha256: null, verified: false };
}

export const bomForModel = (m: Model) => m.bomPartIds.map((id) => data().bomById.get(id)).filter((p): p is BomPart => Boolean(p));
export const modelsForBomPart = (id: string) => data().models.filter((m) => m.bomPartIds.includes(id));

/** Registered models of a scene, in first-appearance order. */
export function sceneModels(slug: string): string[] {
    const scene = data().scenes[slug];
    return scene ? [...new Set(scene.parts.filter((p) => p.registered).map((p) => p.model))] : [];
}

export const inventory = (ids: string[], counted = true, slug?: string): InventoryItem[] =>
    ids.map((id) => ({ id, figure: figureFor(id), count: counted ? installedCount(id, slug) : null }));

// ------------------------------------------------------------------ documents

/** Site route for a repository Markdown file, or null when the site does not publish it. */
export function docHref(repoPath: string): string | null {
    if (!(repoPath in data().docTexts)) return null;
    const trimmed = repoPath.replace(/\.md$/, "").replace(/(^|\/)README$/, "");
    if (trimmed.startsWith("docs")) return "/" + trimmed;
    return "/docs/" + trimmed;
}

export function docBySlug(slug: string[]): string | null {
    const href = "/docs/" + slug.join("/");
    return Object.keys(data().docTexts).find((p) => docHref(p) === href) ?? null;
}

export const docTitle = (repoPath: string) =>
    data().docTexts[repoPath]?.match(/^#\s+(.+)$/m)?.[1].trim() ?? repoPath.split("/").pop()!.replace(/\.md$/, "");
