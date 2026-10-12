import type { BomRepository, BomWarning, DesignWarning, Part } from "./types.js";

export const warningPriorities = ["critical", "warning", "issue"] as const;
export const warningLabels = { critical: "Critical", warning: "Warning", issue: "Issues" };

export function designWarnings(part: Part): DesignWarning[] {
  const warnings = [...(part.designWarnings ?? [])];
  if (part.requirements.length === 0) warnings.push({
    severity: "critical", code: "missing-information", message: "Part requirements are missing; record the specification before selecting or building this part.",
  });
  if (part.lifecycle === "planned") warnings.push({
    severity: "warning", code: "unconfirmed-concept", message: "This part is planned; confirm its specification and selection with committed evidence.",
  });
  if (part.fabrication) {
    if (part.fabrication.sources.length === 0) warnings.push({
      severity: "critical", code: "missing-information", message: "Fabrication sources are missing; record the manufacturing definition.",
    });
    if (["planned", "concept-unvalidated", "prototype"].includes(part.fabrication.modelStatus)) warnings.push({
      severity: "warning", code: "unconfirmed-concept", message: `Fabrication status is ${part.fabrication.modelStatus}; fit, materials and physical acceptance still need committed evidence.`,
    });
  }
  return warnings;
}

export function compareWarnings(a: DesignWarning, b: DesignWarning): number {
  return warningPriorities.indexOf(a.severity) - warningPriorities.indexOf(b.severity) ||
    Number(b.code === "temporary-cable-tie") - Number(a.code === "temporary-cable-tie") || a.message.localeCompare(b.message, "en");
}

/** Keep the legacy text list while recording priority and ownership at emission. */
export class BomWarnings {
  private readonly entries = new Map<string, BomWarning>();
  constructor(private readonly repository: BomRepository) {}

  add(message: string, partIds: string[] = [], severity: DesignWarning["severity"] = "issue", code = "procurement-information"): void {
    const ids = [...new Set(partIds)].sort();
    this.entries.set(message, { message, severity, code, partIds: ids,
      assemblyIds: this.repository.assemblies.assemblies.filter((assembly) => assembly.usages.some((usage) => ids.includes(usage.partId))).map((assembly) => assembly.id).sort(),
    });
  }

  details(): BomWarning[] { return [...this.entries.values()].sort(compareWarnings); }
  texts(): string[] { return [...this.entries.keys()].sort(); }
}
