import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";
import { configurationDigest } from "./configuration.js";
import type { ReferenceVectors } from "./reference-vectors.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const folder = mkdtempSync(join(tmpdir(), "arbi-reference-"));
const binary = join(folder, "reference");
const runtimeEnv = { PATH: process.env.PATH, TMPDIR: folder, LANG: "C", LC_ALL: "C" };
const fixturesPath = "fixtures/reference/1.0/vectors.json";
const vectors = JSON.parse(readFileSync(join(root, fixturesPath), "utf8")) as ReferenceVectors;
const runtimes = [
  { name: "TypeScript", executable: process.execPath, args: [join(root, "dist/reference-vectors.js")] },
  { name: "Linux/Python host", executable: "python3", args: ["-I", join(root, "conformance/reference.py")] },
  { name: "C11 host", executable: binary, args: [] },
];
before(() => {
  const result = spawnSync("cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-pedantic", join(root, "conformance/reference.c"), "-lm", "-o", binary], { encoding: "utf8", timeout: 30000, env: runtimeEnv });
  assert.equal(result.status, 0, `C11 compiler required: ${result.error?.message ?? result.stderr}`);
});
after(() => rmSync(folder, { recursive: true, force: true }));

interface Mutation { name: string; code: string; change: (v: ReferenceVectors, root: string) => void }
// These alter inputs/results/bindings, not the implementations' constants. Each
// executable must fail independently, with no TypeScript preflight on its input.
const mutations: Mutation[] = [
  { name: "fixture version", code: "VERSION_MISMATCH", change: (v) => { v.fixtureVersion = "arbi.reference/2.0"; } },
  { name: "protocol minor version", code: "VERSION_MISMATCH", change: (v) => { v.identity.protocol.version = "arbi/1.1"; } },
  { name: "configuration major version", code: "VERSION_MISMATCH", change: (v) => { v.identity.configurationSchema.version = "arbi.configuration/2.0"; } },
  { name: "metres mislabeled as millimetres", code: "UNIT_MISMATCH", change: (v) => { v.units.position = "m"; } },
  { name: "radians mislabeled as degrees", code: "UNIT_MISMATCH", change: (v) => { v.units.angle = "rad"; } },
  { name: "speed scale", code: "UNIT_MISMATCH", change: (v) => { v.units.speed = "m/s"; } },
  { name: "acceleration scale", code: "UNIT_MISMATCH", change: (v) => { v.units.acceleration = "m/s^2"; } },
  { name: "time scale", code: "UNIT_MISMATCH", change: (v) => { v.units.time = "s"; } },
  { name: "conversion unit discrepancy", code: "UNIT_MISMATCH", change: (v) => { v.conversions[0].from = "mm"; } },
  { name: "conversion value scaled by 1000", code: "RESULT_MISMATCH", change: (v) => { v.conversions[0].value *= 1000; } },
  { name: "stale site frame", code: "FRAME_MISMATCH", change: (v) => { v.identity.siteFrame.revision = "frame-2"; } },
  { name: "wrong gimbal frame", code: "FRAME_MISMATCH", change: (v) => { v.identity.gimbalFrame.name = "site"; } },
  { name: "transform frame discrepancy", code: "FRAME_MISMATCH", change: (v) => { v.transforms[1].siteFrame.revision = "frame-2"; } },
  { name: "geometry frame discrepancy", code: "FRAME_MISMATCH", change: (v) => { v.geometry[0].siteFrame.revision = "frame-2"; } },
  { name: "left-handed yaw sign", code: "RESULT_MISMATCH", change: (v) => { v.transforms[1].yawDeg *= -1; } },
  { name: "radians interpreted as degrees", code: "RESULT_MISMATCH", change: (v) => { v.transforms[1].yawDeg = Math.PI / 2; } },
  { name: "axis swap", code: "RESULT_MISMATCH", change: (v) => { const p = v.transforms[3].expectedSiteMm; [p.x, p.y] = [p.y, p.x]; } },
  { name: "cable length scale", code: "RESULT_MISMATCH", change: (v) => { v.geometry[0].expectedLengthMm.a /= 1000; } },
  { name: "swapped anchor results", code: "RESULT_MISMATCH", change: (v) => { const e = v.geometry[0].expectedSquaredMm2; [e.a, e.b] = [e.b, e.a]; } },
  { name: "out-of-envelope position", code: "GEOMETRY_MISMATCH", change: (v) => { v.geometry[0].positionMm.z = 4000; } },
  { name: "payout offset sign", code: "RESULT_MISMATCH", change: (v) => { v.offsets[0].offsetMm *= -1; } },
  { name: "nonpositive payout", code: "GEOMETRY_MISMATCH", change: (v) => { v.offsets[0].offsetMm = -1000; } },
  { name: "uint64 overflow", code: "COUNTER_MISMATCH", change: (v) => { v.counters[0].value = "18446744073709551616"; } },
  { name: "floating-point counter rounding", code: "COUNTER_MISMATCH", change: (v) => { v.counters[2].successor = "9007199254740993"; } },
  { name: "counter leading zero", code: "COUNTER_MISMATCH", change: (v) => { v.counters[0].value = "00"; } },
  { name: "counter wrap", code: "COUNTER_MISMATCH", change: (v) => { v.counters.at(-1)!.successor = "0"; } },
  { name: "configuration revision", code: "IDENTITY_MISMATCH", change: (v) => { v.identity.configurationRevision = "config-2"; } },
  { name: "calibration revision", code: "IDENTITY_MISMATCH", change: (v) => { v.identity.calibrationRevision = "calibration-2"; } },
  { name: "geometry revision", code: "IDENTITY_MISMATCH", change: (v) => { v.identity.geometryRevision = "geometry-2"; } },
  { name: "content digest", code: "IDENTITY_MISMATCH", change: (v) => { v.identity.configurationDigest = "0".repeat(64); } },
  { name: "protocol schema identity", code: "SCHEMA_MISMATCH", change: (v) => { v.identity.protocol.id += "-wrong"; } },
  { name: "configuration schema digest", code: "SCHEMA_MISMATCH", change: (v) => { v.identity.configurationSchema.sha256 = "0".repeat(64); } },
  { name: "schema bytes changed", code: "SCHEMA_MISMATCH", change: (_, r) => { const path = join(r, "schema/message.schema.json"); writeFileSync(path, readFileSync(path, "utf8") + "\n"); } },
  { name: "configuration content edited under same revision", code: "IDENTITY_MISMATCH", change: (_, r) => edit(r, "fixtures/configuration.json", ["valid", "configuration", "calibration", "lineLengthOffsetsMm", "a"], 1) },
  { name: "wire message protocol discrepancy", code: "VERSION_MISMATCH", change: (_, r) => edit(r, "fixtures/contracts.json", ["valid", "move", "protocol"], "arbi/2.0") },
  { name: "wire message configuration discrepancy", code: "IDENTITY_MISMATCH", change: (_, r) => edit(r, "fixtures/contracts.json", ["valid", "move", "command", "configRevision"], "config-2") },
  { name: "wire message frame discrepancy", code: "FRAME_MISMATCH", change: (_, r) => edit(r, "fixtures/contracts.json", ["valid", "move", "body", "frame", "revision"], "frame-2") },
  { name: "wire counter changed into JSON number", code: "COUNTER_MISMATCH", change: (_, r) => edit(r, "fixtures/contracts.json", ["valid", "move", "sequence"], 10) },
  { name: "configuration version even with refreshed digest", code: "VERSION_MISMATCH", change: (v, r) => {
    edit(r, "fixtures/configuration.json", ["valid", "configuration", "schemaVersion"], "arbi.configuration/1.1");
    refreshDigest(v, r);
  } },
  { name: "nonrectangular anchors even with refreshed digest", code: "GEOMETRY_MISMATCH", change: (v, r) => {
    edit(r, "fixtures/configuration.json", ["valid", "configuration", "geometry", "anchors", "1", "positionMm", "y"], 1);
    refreshDigest(v, r);
  } },
];
function refreshDigest(v: ReferenceVectors, root: string): void {
  v.identity.configurationDigest = configurationDigest(JSON.parse(readFileSync(join(root, "fixtures/configuration.json"), "utf8")).valid.configuration);
}
function edit(root: string, path: string, keys: string[], value: unknown): void {
  const file = join(root, path);
  const object = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  let target = object;
  for (const key of keys.slice(0, -1)) target = target[key] as Record<string, unknown>;
  target[keys.at(-1)!] = value;
  writeFileSync(file, JSON.stringify(object));
}
function isolated(name: string): string {
  const path = join(folder, name);
  cpSync(join(root, "schema"), join(path, "schema"), { recursive: true });
  cpSync(join(root, "fixtures"), join(path, "fixtures"), { recursive: true });
  return path;
}
function reverseKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseKeys);
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).reverse().map(([key, child]) => [key, reverseKeys(child)]));
  return value;
}

for (const runtime of runtimes) {
  test(`${runtime.name}: derive reference results offline and report exact identity`, () => {
    const result = spawnSync(runtime.executable, [...runtime.args, root], { encoding: "utf8", timeout: 30000, env: runtimeEnv });
    assert.equal(result.status, 0, result.error?.message ?? result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { fixtureVersion: vectors.fixtureVersion, protocol: vectors.identity.protocol.version, configurationSchema: vectors.identity.configurationSchema.version, configurationRevision: vectors.identity.configurationRevision, configurationDigest: vectors.identity.configurationDigest, geometryRevision: vectors.identity.geometryRevision, calibrationRevision: vectors.identity.calibrationRevision });
  });
  test(`${runtime.name}: canonical configuration identity ignores JSON property order`, () => {
    const path = isolated(`${runtime.name.replaceAll(/\W/g, "-")}-reordered`);
    for (const file of ["fixtures/configuration.json", "fixtures/contracts.json", fixturesPath]) {
      const content = JSON.parse(readFileSync(join(path, file), "utf8"));
      writeFileSync(join(path, file), JSON.stringify(reverseKeys(content), null, 1));
    }
    const result = spawnSync(runtime.executable, [...runtime.args, path], { encoding: "utf8", timeout: 30000, env: runtimeEnv });
    assert.equal(result.status, 0, result.error?.message ?? result.stderr);
    assert.equal(JSON.parse(result.stdout).configurationDigest, vectors.identity.configurationDigest);
  });
  test(`${runtime.name}: reject deliberate semantic discrepancies`, async (t) => {
    const path = isolated(`${runtime.name.replaceAll(/\W/g, "-")}-mutations`);
    for (const mutation of mutations) await t.test(mutation.name, () => {
      cpSync(join(root, "schema"), join(path, "schema"), { recursive: true });
      cpSync(join(root, "fixtures"), join(path, "fixtures"), { recursive: true });
      const changed = structuredClone(vectors);
      mutation.change(changed, path);
      writeFileSync(join(path, fixturesPath), JSON.stringify(changed));
      const result = spawnSync(runtime.executable, [...runtime.args, path], { encoding: "utf8", timeout: 30000, env: runtimeEnv });
      assert.equal(result.status, 2, result.error?.message ?? result.stderr);
      assert.equal(result.stdout, "", "rejected fixtures must not report success");
      assert.equal(result.stderr.trim(), mutation.code);
    });
  });
}
test("reference vectors remain tied to accepted configuration content", () => {
  const configuration = JSON.parse(readFileSync(join(root, "fixtures/configuration.json"), "utf8")).valid.configuration;
  assert.equal(configurationDigest(configuration), vectors.identity.configurationDigest);
});
