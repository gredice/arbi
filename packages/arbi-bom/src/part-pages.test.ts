import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { calculateBom } from "./calculate.js";
import { loadBomRepository } from "./load.js";
import { renderPartPages } from "./part-pages.js";
import { renderMarkdown } from "./report.js";

const root = fileURLToPath(new URL("../../../", import.meta.url));

test("every catalog part has a stable page and report references link to those pages", async () => {
  const repository = await loadBomRepository(root);
  const pages = renderPartPages(repository);
  assert.equal(pages.size, repository.parts.parts.length + 1);
  for (const part of repository.parts.parts) {
    assert.ok(pages.has(part.id + ".md"));
    assert.ok(pages.get("README.md")?.includes(`](${part.id}.md)`));
  }
  const result = calculateBom(repository);
  const markdown = renderMarkdown(result);
  for (const requirement of result.requirements) {
    assert.ok(markdown.includes(`](parts/${requirement.partId}.md)`));
  }
  const part = repository.parts.parts[0]!;
  part.name = "Renamed item";
  assert.ok(renderPartPages(repository).get(part.id + ".md")?.startsWith("# Renamed item"));
});

test("pages retain every owner and inclusion status, stock distinction, and fabrication links", async () => {
  const repository = await loadBomRepository(root);
  const pages = renderPartPages(repository);
  for (const assembly of repository.assemblies.assemblies) {
    for (const usage of assembly.usages) {
      const page = pages.get(usage.partId + ".md")!;
      assert.ok(page.includes(`](../../../${assembly.documentation})`));
      assert.ok(page.includes(`| ${usage.quantity} ${repository.parts.parts.find((part) => part.id === usage.partId)!.baseUnit} | ${usage.inclusion} |`));
      if (assembly.kind === "shared-procurement-stock") assert.ok(page.includes("(non-physical stock)"));
    }
  }
  for (const part of repository.parts.parts) {
    for (const source of part.fabrication?.sources ?? []) {
      assert.ok(pages.get(part.id + ".md")?.includes(`](../../../${source.path})`));
    }
  }
  assert.ok(pages.get("as5600-angle-sensor.md")?.includes("not included by this build/inclusion policy"));
});

test("new, unallocated parts and assemblies without documentation remain representable", async () => {
  const repository = await loadBomRepository(root);
  const part = structuredClone(repository.parts.parts[0]!);
  part.id = "new-part";
  part.name = "Item [label] | example";
  repository.parts.parts.push(part);
  let page = renderPartPages(repository).get("new-part.md")!;
  assert.ok(page.includes("No assembly usage recorded."));
  assert.ok(page.includes("Item \\[label\\] \\| example"));
  const assembly = repository.assemblies.assemblies[0]!;
  delete assembly.documentation;
  assembly.usages.push({ partId: part.id, quantity: "2", inclusion: "base" });
  page = renderPartPages(repository).get("new-part.md")!;
  assert.ok(page.includes("](../../assemblies/assemblies.json)"));
  assert.ok(page.includes("— included."));
});
