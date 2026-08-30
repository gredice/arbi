const REPORT_SUFFIXES = [".json", ".md"] as const;

export function unexpectedScenarioReportFiles(
  fileNames: string[],
  scenarioIds: string[],
): string[] {
  const expected = new Set(
    scenarioIds.flatMap((scenarioId) =>
      REPORT_SUFFIXES.map((suffix) => scenarioId + suffix),
    ),
  );
  return fileNames
    .filter((fileName) =>
      REPORT_SUFFIXES.some((suffix) => fileName.endsWith(suffix)),
    )
    .filter((fileName) => !expected.has(fileName))
    .sort();
}
