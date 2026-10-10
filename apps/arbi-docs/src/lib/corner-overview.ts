import type { Model } from "./types.ts";

/** The existing support owner also contains the head's historical alternatives. */
export function isPulleyHeadPart(id: string) {
    return /^(?:corner-head-|pole-pulley-|pulley-bracket-|top-pulley-|top-positioning-line-pulley$|zinc-spray$)/.test(id);
}

export function pulleyHeadModels(models: Model[]) {
    return models.filter((model) => model.assembly === "corner-station"
        && (isPulleyHeadPart(model.id) || model.bomPartIds.some(isPulleyHeadPart)));
}

type OverviewAssembly = {
    id: string;
    parentAssemblyId: string | null;
    models: { id: string }[];
    usages: { partId: string }[];
};

/** Physical children and display groups use the same descendant selection. */
export function descendantIds(id: string, assemblies: Pick<OverviewAssembly, "id" | "parentAssemblyId">[]) {
    const included = new Set([id]);
    for (let changed = true; changed;) {
        changed = false;
        for (const assembly of assemblies) {
            if (assembly.parentAssemblyId !== null && included.has(assembly.parentAssemblyId) && !included.has(assembly.id)) {
                included.add(assembly.id);
                changed = true;
            }
        }
    }
    return included;
}

/** Count unique parts across a system and its descendants, including display groups. */
export function overviewCounts(system: OverviewAssembly, assemblies: OverviewAssembly[]) {
    const included = descendantIds(system.id, assemblies);
    const owners = assemblies.filter((assembly) => included.has(assembly.id));
    return {
        models: new Set(owners.flatMap((assembly) => assembly.models.map((model) => model.id))).size,
        bomLines: new Set(owners.flatMap((assembly) => assembly.usages.map((usage) => usage.partId))).size,
    };
}
