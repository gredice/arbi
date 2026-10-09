type Assembly = { id: string; kind: string; parentAssemblyId: string | null };

/** Root systems own navigation numbers; children retain their own pages and BOMs. */
export function numberAssemblies<T extends Assembly>(assemblies: T[]): (T & { number: string; rootId: string })[] {
    const physical = assemblies.filter((assembly) => assembly.kind === "physical");
    const byId = new Map(physical.map((assembly) => [assembly.id, assembly]));
    const numbers = new Map(physical.filter((assembly) => assembly.parentAssemblyId === null)
        .map((assembly, index) => [assembly.id, String(index + 1).padStart(2, "0")]));
    return physical.map((assembly) => {
        let root = assembly;
        const visited = new Set<string>();
        while (root.parentAssemblyId !== null) {
            if (visited.has(root.id)) throw new Error(`Assembly hierarchy cycle: ${root.id}`);
            visited.add(root.id);
            const parent = byId.get(root.parentAssemblyId);
            if (!parent) throw new Error(`Missing physical parent: ${root.parentAssemblyId}`);
            root = parent;
        }
        return { ...assembly, rootId: root.id, number: numbers.get(root.id)! };
    });
}
