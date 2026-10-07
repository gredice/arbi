/** Offline host fixture consumer. Not a production decoder, controller or authority gate. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import { configurationDigest, validateConfigurationRecord } from "./configuration.js";
import { validateMessage } from "./validate.js";
import type { VectorMm } from "./messages.js";

type Frame = { name: string; revision: string };
type Lines = Record<"a" | "b" | "c" | "d", number>;
type SchemaIdentity = { version: string; id: string; sha256: string };
export interface ReferenceVectors {
  fixtureVersion: string;
  identity: {
    protocol: SchemaIdentity; configurationSchema: SchemaIdentity;
    configurationRevision: string; configurationDigest: string;
    geometryRevision: string; calibrationRevision: string; siteFrame: Frame; gimbalFrame: Frame;
  };
  units: Record<string, string>;
  counters: Array<{ value: string; successor: string | null }>;
  conversions: Array<{ from: string; to: string; value: number; expected: number }>;
  transforms: Array<{ id: string; siteFrame: Frame; translationMm: VectorMm; yawDeg: number; localMm: VectorMm; expectedSiteMm: VectorMm }>;
  geometry: Array<{ id: string; siteFrame: Frame; positionMm: VectorMm; expectedSquaredMm2: Lines; expectedLengthMm: Lines }>;
  offsets: Array<{ geometricMm: number; offsetMm: number; expectedPayoutMm: number }>;
}
function fail(code: string): never { throw new Error(code); }
const requireEqual = (a: unknown, b: unknown, code: string): void => { if (configurationDigest(a) !== configurationDigest(b)) fail(code); };
function close(actual: number, expected: number): void {
  if (!Number.isFinite(actual) || !Number.isFinite(expected) || Math.abs(actual - expected) > 1e-7 + 1e-12 * Math.abs(expected)) fail("RESULT_MISMATCH");
}
function counter(value: string): bigint {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]{0,19})$/.test(value)) fail("COUNTER_MISMATCH");
  const n = BigInt(value);
  if (n > 18446744073709551615n) fail("COUNTER_MISMATCH");
  return n;
}

export function checkReferenceVectors(root: string, vectorFile = resolve(root, "fixtures/reference/1.0/vectors.json")): object {
  const read = (path: string): unknown => JSON.parse(readFileSync(resolve(root, path), "utf8"));
  const vectors = JSON.parse(readFileSync(vectorFile, "utf8")) as ReferenceVectors;
  if (vectors.fixtureVersion !== "arbi.reference/1.0" || vectors.identity?.protocol?.version !== "arbi/1.0" || vectors.identity?.configurationSchema?.version !== "arbi.configuration/1.0") fail("VERSION_MISMATCH");
  requireEqual(vectors.units, { position: "mm", angle: "deg", speed: "mm/s", acceleration: "mm/s^2", force: "N", time: "ms" }, "UNIT_MISMATCH");
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  const validate = ajv.compile(read("fixtures/reference/1.0/vectors.schema.json") as object);
  if (!validate(vectors)) fail("INVALID_VECTORS");
  for (const [identity, path, id] of [
    [vectors.identity.protocol, "schema/message.schema.json", "https://arbi.gredice.com/schemas/protocol/1.0/message.schema.json"],
    [vectors.identity.configurationSchema, "schema/configuration.schema.json", "https://arbi.gredice.com/schemas/configuration/1.0/configuration.schema.json"],
  ] as const) {
    const bytes = readFileSync(resolve(root, path));
    if (identity.id !== id || (JSON.parse(bytes.toString()) as { $id: string }).$id !== id || createHash("sha256").update(bytes).digest("hex") !== identity.sha256) fail("SCHEMA_MISMATCH");
  }
  const configuration = (read("fixtures/configuration.json") as { valid: { configuration: unknown } }).valid.configuration;
  requireEqual(configurationDigest(configuration), vectors.identity.configurationDigest, "IDENTITY_MISMATCH");
  if ((configuration as { schemaVersion: string }).schemaVersion !== vectors.identity.configurationSchema.version) fail("VERSION_MISMATCH");
  const validConfig = validateConfigurationRecord(configuration, "configuration");
  if (!validConfig.ok) fail(validConfig.error.code === "INVALID_GEOMETRY" ? "GEOMETRY_MISMATCH" : "INVALID_CONFIGURATION");
  const config = validConfig.value;
  if (config.schemaVersion !== vectors.identity.configurationSchema.version) fail("VERSION_MISMATCH");
  requireEqual([config.revision, config.geometry.revision, config.calibration?.revision], [vectors.identity.configurationRevision, vectors.identity.geometryRevision, vectors.identity.calibrationRevision], "IDENTITY_MISMATCH");
  requireEqual(config.geometry.siteFrame, vectors.identity.siteFrame, "FRAME_MISMATCH");
  requireEqual(config.geometry.gimbalFrame, vectors.identity.gimbalFrame, "FRAME_MISMATCH");
  if (config.executionMode !== "simulation" || !config.calibration || config.calibration.scope !== "simulation" || config.geometry.convention !== "right-handed-x-y-z-mm-deg") fail("IDENTITY_MISMATCH");
  const message = (read("fixtures/contracts.json") as { valid: { move: unknown } }).valid.move;
  // Check compatibility before the complete TypeScript message validator.
  const m = message as { protocol: string; command: { configRevision: string; lease: { fence: string } }; body: { frame: Frame; positionMm: VectorMm }; sequence: string };
  if (m.protocol !== vectors.identity.protocol.version) fail("VERSION_MISMATCH");
  if (m.command.configRevision !== config.revision) fail("IDENTITY_MISMATCH");
  requireEqual(m.body.frame, config.geometry.siteFrame, "FRAME_MISMATCH");
  counter(m.sequence); counter(m.command.lease.fence);
  const validMessage = validateMessage(message);
  if (!validMessage.ok) fail("INVALID_MESSAGE");
  requireEqual([validMessage.value.realm, validMessage.value.siteId, validMessage.value.executionMode], [config.realm, config.siteId, config.executionMode], "IDENTITY_MISMATCH");
  requireEqual(JSON.parse(JSON.stringify(validMessage.value)), message, "SERIALIZATION_MISMATCH");
  for (const c of vectors.counters) {
    const value = counter(c.value);
    requireEqual(value === 18446744073709551615n ? null : (value + 1n).toString(), c.successor, "COUNTER_MISMATCH");
    if (c.successor !== null) counter(c.successor);
  }
  const factors: Record<string, number> = { "m:mm": 1000, "mm:m": 0.001, "rad:deg": 180 / Math.PI, "deg:rad": Math.PI / 180, "s:ms": 1000, "m/s:mm/s": 1000, "m/s^2:mm/s^2": 1000 };
  for (const c of vectors.conversions) {
    const factor = factors[`${c.from}:${c.to}`];
    if (factor === undefined) fail("UNIT_MISMATCH");
    close(c.value * factor, c.expected);
  }
  for (const t of vectors.transforms) {
    requireEqual(t.siteFrame, config.geometry.siteFrame, "FRAME_MISMATCH");
    const radians = t.yawDeg * Math.PI / 180;
    const c = Math.cos(radians), s = Math.sin(radians);
    const { x, y, z } = t.localMm;
    close(t.translationMm.x + c * x - s * y, t.expectedSiteMm.x);
    close(t.translationMm.y + s * x + c * y, t.expectedSiteMm.y);
    close(t.translationMm.z + z, t.expectedSiteMm.z);
    const dx = t.expectedSiteMm.x - t.translationMm.x, dy = t.expectedSiteMm.y - t.translationMm.y;
    close(c * dx + s * dy, x); close(-s * dx + c * dy, y);
    close(t.expectedSiteMm.z - t.translationMm.z, z);
  }
  const axes = ["x", "y", "z"] as const;
  for (const g of vectors.geometry) {
    requireEqual(g.siteFrame, config.geometry.siteFrame, "FRAME_MISMATCH");
    for (const axis of axes) if (g.positionMm[axis] < config.limits.workspace.minMm[axis] + config.calibration.uncertaintyMm || g.positionMm[axis] > config.limits.workspace.maxMm[axis] - config.calibration.uncertaintyMm) fail("GEOMETRY_MISMATCH");
    for (const a of config.geometry.anchors) {
      const squared = axes.reduce((sum, axis) => sum + (a.positionMm[axis] - g.positionMm[axis]) ** 2, 0);
      close(squared, g.expectedSquaredMm2[a.line]);
      close(Math.sqrt(squared), g.expectedLengthMm[a.line]);
      if (Math.sqrt(squared) + config.calibration.lineLengthOffsetsMm[a.line] <= config.calibration.uncertaintyMm) fail("GEOMETRY_MISMATCH");
    }
  }
  const moveVector = vectors.geometry.find((g) => g.id === "motion-message");
  requireEqual(moveVector?.positionMm, m.body.positionMm, "GEOMETRY_MISMATCH");
  for (const o of vectors.offsets) {
    if (o.geometricMm <= 0 || o.geometricMm + o.offsetMm <= 0) fail("GEOMETRY_MISMATCH");
    close(o.geometricMm + o.offsetMm, o.expectedPayoutMm);
  }
  return { fixtureVersion: vectors.fixtureVersion, protocol: m.protocol, configurationSchema: config.schemaVersion, configurationRevision: config.revision, configurationDigest: vectors.identity.configurationDigest, geometryRevision: config.geometry.revision, calibrationRevision: config.calibration.revision };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(checkReferenceVectors(resolve(process.argv[2] ?? fileURLToPath(new URL("..", import.meta.url))), process.argv[3]))); }
  catch (error) { console.error(error instanceof Error ? error.message : "INVALID_VECTORS"); process.exitCode = 2; }
}
