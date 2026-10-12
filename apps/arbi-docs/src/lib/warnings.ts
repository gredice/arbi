import type { BomWarning, Model } from "./types.ts";

export function uniqueWarnings(warnings: BomWarning[]): BomWarning[] {
    const entries = new Map<string, BomWarning>();
    for (const warning of warnings) {
        const key = JSON.stringify([warning.code, warning.message, warning.partIds]);
        if (entries.get(key)?.severity !== "critical") entries.set(key, warning);
    }
    return [...entries.values()]
        .sort((a, b) => Number(b.severity === "critical") - Number(a.severity === "critical") ||
            Number(b.code === "temporary-cable-tie") - Number(a.code === "temporary-cable-tie") || a.message.localeCompare(b.message, "en"));
}

export function warningCounts(warnings: BomWarning[]): { critical: number; warning: number } {
    return { critical: warnings.filter((warning) => warning.severity === "critical").length,
        warning: warnings.filter((warning) => warning.severity === "warning").length };
}

export function modelWarnings(model: Model, bomWarnings: BomWarning[]): BomWarning[] {
    const warnings = [...bomWarnings];
    if (["planned", "concept-unvalidated", "prototype"].includes(model.status) && !warnings.some((warning) => warning.code === "unconfirmed-concept")) {
        warnings.push({ severity: "warning", code: "unconfirmed-concept", message: `Model status is ${model.status}; physical acceptance still needs committed evidence.`, partIds: model.bomPartIds, assemblyIds: [model.assembly] });
    }
    if (model.geometry) {
        const measured = model.geometry.status === "measured-envelope";
        warnings.push({ severity: "warning", code: measured ? "simplified-details" : "approximate-geometry", message: `${measured ? "Measured envelope; simplified details" : "Approximate geometry"}: ${model.geometry.rework}`, partIds: model.bomPartIds, assemblyIds: [model.assembly] });
    }
    return uniqueWarnings(warnings);
}
