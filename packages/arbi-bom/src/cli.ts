#!/usr/bin/env node

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { calculateBom } from "./calculate.js";
import { unexpectedScenarioReportFiles } from "./generated-reports.js";
import { loadBomRepository } from "./load.js";
import { renderJson, renderMarkdown } from "./report.js";
import { validateRepository } from "./validate.js";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const generatedDirectory = resolve(repositoryRoot, "bom/generated");

async function scenarioIds(): Promise<string[]> {
  const raw = await readFile(
    resolve(repositoryRoot, "bom/scenarios/scenarios.json"),
    "utf8",
  );
  const parsed = JSON.parse(raw) as {
    scenarios?: Array<{ id?: unknown }>;
  };
  if (!Array.isArray(parsed.scenarios)) {
    throw new Error("Scenario catalog does not contain a scenarios array");
  }
  const ids = parsed.scenarios.map((scenario) => scenario.id);
  if (ids.some((id) => typeof id !== "string")) {
    throw new Error("Every scenario must have a string ID");
  }
  return (ids as string[]).sort();
}

async function selectedScenarioIds(): Promise<string[]> {
  const requested = process.argv[3];
  const all = await scenarioIds();
  if (requested === undefined) {
    return all;
  }
  if (!all.includes(requested)) {
    throw new Error("Unknown BOM scenario: " + requested);
  }
  return [requested];
}

async function assertNoOrphanReports(allScenarioIds: string[]): Promise<void> {
  const files = await readdir(generatedDirectory).catch((error: unknown) => {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return [];
    }
    throw error;
  });
  const unexpected = unexpectedScenarioReportFiles(files, allScenarioIds);
  if (unexpected.length > 0) {
    throw new Error(
      "Generated BOM reports exist for removed or renamed scenarios: " +
        unexpected.map((file) => "bom/generated/" + file).join(", ") +
        ". Review and remove these exact files explicitly.",
    );
  }
}

async function expectedReports(scenarioId: string): Promise<{
  json: string;
  markdown: string;
  warningCount: number;
}> {
  const repository = await loadBomRepository(repositoryRoot, scenarioId);
  const validation = validateRepository(repository);
  if (validation.errors.length > 0) {
    throw new Error(validation.errors.join("\n"));
  }
  const result = calculateBom(repository, scenarioId);
  return {
    json: renderJson(result),
    markdown: renderMarkdown(result),
    warningCount: result.warnings.length,
  };
}

async function generate(): Promise<void> {
  const allIds = await scenarioIds();
  await assertNoOrphanReports(allIds);
  const ids = await selectedScenarioIds();
  await mkdir(generatedDirectory, { recursive: true });
  let warningCount = 0;
  for (const scenarioId of ids) {
    const reports = await expectedReports(scenarioId);
    warningCount += reports.warningCount;
    await Promise.all([
      writeFile(resolve(generatedDirectory, scenarioId + ".json"), reports.json, "utf8"),
      writeFile(resolve(generatedDirectory, scenarioId + ".md"), reports.markdown, "utf8"),
    ]);
  }
  console.log(
    "Generated " +
      ids.length +
      " deterministic BOM scenario report(s) with " +
      warningCount +
      " visible warnings.",
  );
}

async function check(): Promise<void> {
  const allIds = await scenarioIds();
  await assertNoOrphanReports(allIds);
  const ids = await selectedScenarioIds();
  const stale: string[] = [];
  let warningCount = 0;
  for (const scenarioId of ids) {
    const reports = await expectedReports(scenarioId);
    warningCount += reports.warningCount;
    const [currentJson, currentMarkdown] = await Promise.all([
      readFile(resolve(generatedDirectory, scenarioId + ".json"), "utf8").catch(() => null),
      readFile(resolve(generatedDirectory, scenarioId + ".md"), "utf8").catch(() => null),
    ]);
    if (currentJson !== reports.json) {
      stale.push("bom/generated/" + scenarioId + ".json");
    }
    if (currentMarkdown !== reports.markdown) {
      stale.push("bom/generated/" + scenarioId + ".md");
    }
  }
  if (stale.length > 0) {
    throw new Error(
      "Generated BOM reports are missing or stale: " +
        stale.join(", ") +
        ". Run pnpm --filter @arbi/bom generate.",
    );
  }
  console.log(
    "BOM inputs are valid and generated reports are current (" +
      warningCount +
      " visible incompleteness warnings).",
  );
}

async function validate(): Promise<void> {
  const ids = await selectedScenarioIds();
  let warningCount = 0;
  for (const scenarioId of ids) {
    const repository = await loadBomRepository(repositoryRoot, scenarioId);
    const result = validateRepository(repository);
    if (result.errors.length > 0) {
      throw new Error(result.errors.join("\n"));
    }
    warningCount += result.warnings.length;
  }
  console.log(
    ids.length +
      " BOM scenario(s) are structurally valid with " +
      warningCount +
      " validation warnings.",
  );
}

const command = process.argv[2] ?? "check";
const actions: Record<string, () => Promise<void>> = {
  check,
  generate,
  validate,
};
const action = actions[command];
if (action === undefined) {
  console.error("Usage: arbi-bom <check|generate|validate> [scenario-id]");
  process.exitCode = 2;
} else {
  action().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
