import type { BomRepository } from "./types.js";

function text(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("|", "\\|")
    .replaceAll("[", "\\[").replaceAll("]", "\\]").replaceAll("\n", " ");
}

/** Paths are relative to bom/generated/parts; identities come from the catalog. */
export function renderPartPages(repository: BomRepository): Map<string, string> {
  const pages = new Map<string, string>();
  const parts = [...repository.parts.parts].sort((a, b) => a.id.localeCompare(b.id, "en"));
  const notice = "> Generated from canonical BOM inputs by `pnpm bom:generate`. Do not edit this page by hand.";
  const index = ["# BOM item pages", "", notice, "",
    "[Back to the BOM](../../README.md)", "",
    "One stable page per catalog part, including optional and deferred items. Usage quantities belong to the named assembly definition; scenario reports apply build quantities and inclusion policy.", "",
    "| Item | Part ID |", "| --- | --- |"];
  for (const part of parts) {
    index.push(`| [${text(part.name)}](${part.id}.md) | ${part.id} |`);
    const lines = [`# ${text(part.name)}`, "", notice, "",
      "[BOM](../../README.md) · [All items](README.md) · [Canonical part catalog](../../catalog/parts.json)", "",
      `- Part ID: \`${part.id}\``, `- Unit: ${part.baseUnit}`, `- Kind: ${part.kind}`,
      `- Lifecycle: ${part.lifecycle}`, `- Disciplines: ${part.disciplines.map(text).join(", ")}`,
      `- Traits: ${part.traits.map(text).join(", ") || "None"}`, "", "## Requirements", "",
      ...part.requirements.map((requirement) => "- " + text(requirement))];
    if (part.notes) lines.push("", "## Notes", "", text(part.notes));
    lines.push("", "## Used in", "",
      "Quantities are per assembly definition, before build multipliers. Optional and deferred usages are shown even when excluded from a scenario. Procurement stock is not an installed physical owner.", "",
      "| Assembly or purchasing bucket | Quantity | Inclusion | Usage note |",
      "| --- | ---: | --- | --- |");
    let usageCount = 0;
    for (const assembly of repository.assemblies.assemblies) {
      for (const usage of assembly.usages.filter((usage) => usage.partId === part.id)) {
        const target = assembly.documentation ? "../../../" + assembly.documentation : "../../assemblies/assemblies.json";
        const label = text(assembly.name) + (assembly.kind === "shared-procurement-stock" ? " (non-physical stock)" : "");
        lines.push(`| [${label}](${target}) | ${usage.quantity} ${part.baseUnit} | ${usage.inclusion} | ${text(usage.note ?? "—")} |`);
        usageCount++;
      }
    }
    if (!usageCount) lines.push("", "No assembly usage recorded.");
    lines.push("", "[Canonical assembly quantities](../../assemblies/assemblies.json)", "", "## BOM reports", "");
    for (const scenario of repository.scenarios.scenarios) {
      const build = repository.builds.builds.find((build) => build.id === scenario.buildId);
      const included = repository.assemblies.assemblies.some((assembly) =>
        build?.assemblies.some((instance) => instance.assemblyId === assembly.id && Number(instance.quantity) > 0) &&
        assembly.usages.some((usage) => usage.partId === part.id && scenario.include.includes(usage.inclusion)));
      lines.push(`- [${text(scenario.name)}](../${scenario.id}.md${included ? "#required-parts-by-physical-owner-or-procurement-bucket" : ""}) — ${included ? "included" : "not included by this build/inclusion policy"}.`);
    }
    if (part.fabrication) {
      lines.push("", "## Fabrication", "", `- Process: ${part.fabrication.process}`, `- Model status: ${part.fabrication.modelStatus}`);
      for (const source of part.fabrication.sources) {
        lines.push(`- [${text(source.path)}](../../../${source.path}) — module \`${source.module}\`${source.revision ? `; revision ${source.revision}` : ""}.`);
      }
      if (!part.fabrication.sources.length) lines.push("- No manufacturing source claimed yet.");
    }
    lines.push("", "Catalog lifecycle, procurement, and generated documentation do not establish physical validation. See the owning assembly for evidence and acceptance requirements.", "");
    pages.set(part.id + ".md", lines.join("\n"));
  }
  pages.set("README.md", index.join("\n") + "\n");
  return pages;
}
