import type { BomPart, Model } from "./types.ts";

type Owner = { id: string; kind: string; documentation?: string; usages: { partId: string }[] };
export type PartEntry = { id: string; name: string; assembly: string; bomPartId?: string; modelIds: string[] };

/** BOM identities own colliding slugs; individual CAD components retain their routes. */
export function partCatalog(parts: Pick<BomPart, "id" | "name">[], models: Model[], owners: Owner[]): PartEntry[] {
    const entries = parts.map((part) => {
        const linked = models.filter((model) => model.bomPartIds.includes(part.id));
        const owner = owners.find((assembly) => assembly.kind === "physical" && assembly.usages.some((usage) => usage.partId === part.id));
        return {
            id: part.id, name: part.name, bomPartId: part.id,
            assembly: owner?.documentation?.match(/assemblies\/([^/]+)\//)?.[1] ?? linked[0]?.assembly ?? "shared-procurement-stock",
            modelIds: linked.map((model) => model.id),
        };
    });
    const bomIds = new Set(parts.map((part) => part.id));
    return [...entries, ...models.filter((model) => !bomIds.has(model.id)).map((model) => ({
        id: model.id, name: model.id, assembly: model.assembly, modelIds: [model.id],
    }))];
}
