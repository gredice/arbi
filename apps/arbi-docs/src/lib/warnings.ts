import type { BomWarning, Model, WarningCounts } from "./types.ts";

export const warningPriorities = ["critical", "warning", "issue"] as const;
export const warningLabels = { critical: "Critical", warning: "Warning", issue: "Issues" };

export function uniqueWarnings(warnings: BomWarning[]): BomWarning[] {
    const entries = new Map<string, BomWarning>();
    for (const warning of warnings) {
        const key = JSON.stringify([warning.code, warning.message, warning.partIds]);
        const existing = entries.get(key);
        if (!existing || warningPriorities.indexOf(warning.severity) < warningPriorities.indexOf(existing.severity)) entries.set(key, warning);
    }
    return [...entries.values()]
        .sort((a, b) => warningPriorities.indexOf(a.severity) - warningPriorities.indexOf(b.severity) ||
            Number(b.code === "temporary-cable-tie") - Number(a.code === "temporary-cable-tie") || a.message.localeCompare(b.message, "en"));
}

export function warningCounts(warnings: BomWarning[]): WarningCounts {
    return { critical: warnings.filter((warning) => warning.severity === "critical").length,
        warning: warnings.filter((warning) => warning.severity === "warning").length,
        issue: warnings.filter((warning) => warning.severity === "issue").length };
}

export function modelWarnings(model: Model, bomWarnings: BomWarning[]): BomWarning[] {
    const warnings = [...bomWarnings];
    if (["planned", "concept-unvalidated", "prototype"].includes(model.status) && !warnings.some((warning) => warning.code === "unconfirmed-concept")) {
        warnings.push({ severity: "warning", code: "unconfirmed-concept", message: `Model status is ${model.status}; physical acceptance still needs committed evidence.`, partIds: model.bomPartIds, assemblyIds: [model.assembly] });
    }
    if (model.geometry) {
        const measured = model.geometry.status === "measured-envelope";
        warnings.push({ severity: measured ? "warning" : "critical", code: measured ? "simplified-details" : "approximate-geometry", message: measured ? `Measured envelope; simplified details: ${model.geometry.rework}` : `Approximate geometry · needs rework (${model.id}): ${model.geometry.rework} Resolve dimensions and interfaces before dependent assembly design.`, partIds: model.bomPartIds, assemblyIds: [model.assembly] });
    }
    return uniqueWarnings(warnings);
}
