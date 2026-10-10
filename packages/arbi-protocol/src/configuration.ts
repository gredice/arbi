import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { Ajv2020 } from "ajv/dist/2020.js";
import type { Actor, Capability, Command, Identity, Realm, VectorMm } from "./messages.js";
import type { AppliedConfiguration, Configuration, ConfigurationBox, ConfigurationCalibration, ConfigurationJournal, ConfigurationLimits, ConfigurationReport, ConfigurationRequest } from "./configuration-types.js";
import { validateMessage } from "./validate.js";

export const CONFIGURATION_VERSION = "arbi.configuration/1.0";
export const MAX_CONFIGURATION_BYTES = 1_048_576;
export type ConfigurationErrorCode = "INVALID_JSON" | "CONFIGURATION_TOO_LARGE" | "UNSUPPORTED_SCHEMA" | "INVALID_CONFIGURATION" | "UNKNOWN_FIELD" | "INVALID_GEOMETRY" | "INVALID_REGISTRY" | "HARDWARE_MISMATCH" | "MISSING_CALIBRATION" | "CALIBRATION_MISMATCH" | "CALIBRATION_NOT_APPROVED" | "LIMIT_EXPANSION" | "STALE_CONFIGURATION" | "REVISION_CONFLICT" | "TARGET_MISMATCH" | "NOT_AUTHORIZED" | "LOCAL_INHIBIT_REQUIRED" | "ROLLBACK_INCOMPATIBLE" | "PERSISTENCE_FAILED" | "APPLY_IN_PROGRESS" | "INVALID_COMMAND" | "FRAME_MISMATCH" | "OUTSIDE_LIMITS";
export type ConfigurationResult<T> = { ok: true; value: T } | { ok: false; error: { code: ConfigurationErrorCode; path: string } };
const failure = (code: ConfigurationErrorCode, path = "/"): ConfigurationResult<never> => ({ ok: false, error: { code, path } });
const success = <T>(value: T): ConfigurationResult<T> => ({ ok: true, value });
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const same = (a: unknown, b: unknown): boolean => configurationDigest(a) === configurationDigest(b);
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (record(value)) return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
/** SHA-256 identity, not authentication or a signature. Only hash validated JSON data. */
export function configurationDigest(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}
/** Includes declared sensor ownership/interfaces and firmware/update inventory. */
export const configurationHardwareDigest = (config: Configuration): string => configurationDigest({ components: config.components, signals: config.signals });

const messageSchema = JSON.parse(readFileSync(new URL("../schema/message.schema.json", import.meta.url), "utf8"));
const schema = JSON.parse(readFileSync(new URL("../schema/configuration.schema.json", import.meta.url), "utf8"));
const ajv = new Ajv2020({ strict: true, strictTypes: false, allErrors: true });
// Register the canonical shared definitions only. validateMessage owns full message validation.
ajv.addSchema({ $schema: messageSchema.$schema, $id: messageSchema.$id, $defs: messageSchema.$defs });
ajv.addSchema(schema);
interface ConfigurationRecords {
  configuration: Configuration;
  request: ConfigurationRequest;
  applied: AppliedConfiguration;
  report: ConfigurationReport;
  journal: ConfigurationJournal;
  limits: ConfigurationLimits;
}
const definitions = { configuration: "Configuration", request: "ConfigurationRequest", applied: "AppliedConfiguration", report: "ConfigurationReport", journal: "ConfigurationJournal", limits: "ConfigurationLimits" };
const validators = Object.fromEntries(Object.entries(definitions).map(([kind, name]) => [kind, ajv.compile({ $ref: `${schema.$id}#/$defs/${name}` })]));
const axes = ["x", "y", "z"] as const;
const boxValid = (box: ConfigurationBox): boolean => axes.every((axis) => box.minMm[axis] < box.maxMm[axis]);
const inside = (position: VectorMm, box: ConfigurationBox, margin = 0): boolean => axes.every((axis) => position[axis] >= box.minMm[axis] + margin && position[axis] <= box.maxMm[axis] - margin);
const contained = (box: ConfigurationBox, outer: ConfigurationBox): boolean => inside(box.minMm, outer) && inside(box.maxMm, outer);
const rangeValid = (range: { min: number; max: number }): boolean => range.min < range.max;
const limitsValid = (limits: ConfigurationLimits): boolean => boxValid(limits.workspace) && [limits.tensionN, limits.panDeg, limits.tiltDeg].every(rangeValid) && limits.tensionN.min > 0 && limits.panDeg.min >= -180 && limits.panDeg.max <= 180 && limits.tiltDeg.min >= -180 && limits.tiltDeg.max <= 180;
const unique = (ids: string[]): boolean => new Set(ids).size === ids.length;

function semantics(config: Configuration): ConfigurationResult<Configuration> {
  const { components, signals, geometry, limits, calibration } = config;
  const component = (id: string) => components.find((c) => c.id === id);
  if (!unique(components.map((c) => c.id)) || !unique(signals.map((s) => s.id))) return failure("INVALID_REGISTRY");
  for (const c of components) if (c.kind === "module" && c.update.kind === "supported") {
    if (!unique(c.update.targets) || c.firmwareVersion === null || c.update.evidence.result !== "passed") return failure("INVALID_REGISTRY", "/components");
  }
  for (const s of signals) {
    if (component(s.ownerComponentId)?.kind !== "module" || (s.physicalComponentId !== null && !component(s.physicalComponentId))) return failure("INVALID_REGISTRY", "/signals");
    if (s.frame.name === "site" && !same(s.frame, geometry.siteFrame) || s.frame.name === "pod-gimbal" && !same(s.frame, geometry.gimbalFrame)) return failure("INVALID_REGISTRY", "/signals/frame");
    const expectedFrame = s.metric?.startsWith("gimbal.") ? "pod-gimbal" : s.metric === "power.voltage" || s.metric === null ? "none" : "site";
    if (s.frame.name !== expectedFrame) return failure("INVALID_REGISTRY", "/signals/frame");
    if (s.reading.kind === "unavailable") {
      if (s.reading.reason === "sensor-not-installed" && s.physicalComponentId !== null) return failure("INVALID_REGISTRY", "/signals");
    } else {
      if (!s.reading.qualities.length || !unique(s.reading.qualities) || s.reading.evidence.result !== "passed" || (s.reading.qualities.includes("measured") && s.physicalComponentId === null)) return failure("INVALID_REGISTRY", "/signals/reading");
    }
  }
  if (!unique(signals.flatMap((s) => s.metric === null ? [] : [`${s.ownerComponentId}/${s.metric}`]))) return failure("INVALID_REGISTRY", "/signals/metric");
  if (!unique(geometry.anchors.map((a) => a.line)) || !unique(geometry.anchors.map((a) => a.componentId)) || geometry.anchors.some((a) => !component(a.componentId))) return failure("INVALID_GEOMETRY", "/geometry/anchors");
  const [a, b, c, d] = ["a", "b", "c", "d"].map((line) => geometry.anchors.find((anchor) => anchor.line === line)!.positionMm);
  // V1 rectangular, horizontal surveyed anchor layout; no arbitrary transform inference.
  if (!(a.x < b.x && a.y < d.y && a.y === b.y && b.x === c.x && c.y === d.y && d.x === a.x && [b, c, d].every((p) => p.z === a.z))) return failure("INVALID_GEOMETRY", "/geometry/anchors");
  const footprint: ConfigurationBox = { minMm: { x: a.x, y: a.y, z: -1_000_000 }, maxMm: { x: c.x, y: c.y, z: a.z } };
  if (!limitsValid(limits) || !contained(limits.workspace, footprint) || limits.workspace.maxMm.z >= a.z) return failure("INVALID_GEOMETRY", "/limits");
  if (!unique(geometry.beds.map((bed) => bed.bedId)) || !unique(geometry.plants.map((plant) => plant.plantId))) return failure("INVALID_GEOMETRY", "/geometry");
  if (geometry.beds.some((bed) => !boxValid(bed.bounds) || !contained(bed.bounds, footprint))) return failure("INVALID_GEOMETRY", "/geometry/beds");
  if (geometry.plants.some((plant) => { const bed = geometry.beds.find((b) => b.bedId === plant.bedId); return !bed || !inside(plant.positionMm, bed.bounds); })) return failure("INVALID_GEOMETRY", "/geometry/plants");
  if (calibration) {
    if (calibration.revision === calibration.previousRevision || calibration.hardwareDigest !== configurationHardwareDigest(config) || calibration.geometryDigest !== configurationDigest(geometry) || calibration.limitsDigest !== configurationDigest(limits)) return failure("CALIBRATION_MISMATCH", "/calibration");
    if (!unique(calibration.evidence.map((e) => e.id)) || calibration.evidence.some((e) => e.result !== "passed") || !calibration.evidence.some((e) => e.stage === calibration.scope)) return failure("CALIBRATION_MISMATCH", "/calibration/evidence");
    if ((config.executionMode === "simulation") !== (calibration.scope === "simulation") || axes.some((axis) => limits.workspace.maxMm[axis] - limits.workspace.minMm[axis] <= calibration.uncertaintyMm * 2)) return failure("CALIBRATION_MISMATCH", "/calibration");
    for (const anchor of geometry.anchors) {
      const distance = Math.hypot(...axes.map((axis) => anchor.positionMm[axis] - Math.max(limits.workspace.minMm[axis], Math.min(anchor.positionMm[axis], limits.workspace.maxMm[axis]))));
      if (distance + calibration.lineLengthOffsetsMm[anchor.line] <= calibration.uncertaintyMm) return failure("CALIBRATION_MISMATCH", "/calibration/lineLengthOffsetsMm");
    }
  }
  if (config.previousRevision === config.revision) return failure("REVISION_CONFLICT", "/revision");
  return success(config);
}

function appliedValid(applied: AppliedConfiguration): ConfigurationResult<AppliedConfiguration> {
  const result = semantics(applied.request.configuration);
  if (!result.ok) return result;
  if (applied.configurationDigest !== configurationDigest(applied.request.configuration) || !same(applied.appliedBy, applied.request.target)) return failure("REVISION_CONFLICT", "/configurationDigest");
  if (!applied.request.configuration.calibration) return failure("MISSING_CALIBRATION", "/request/configuration/calibration");
  return success(applied);
}

/** External decoded data is size bounded, schema checked, semantically checked and copied. */
export function validateConfigurationRecord<K extends keyof ConfigurationRecords>(input: unknown, kind: K): ConfigurationResult<ConfigurationRecords[K]> {
  try {
    if (Buffer.byteLength(JSON.stringify(input) ?? "", "utf8") > MAX_CONFIGURATION_BYTES) return failure("CONFIGURATION_TOO_LARGE");
  } catch { return failure("INVALID_CONFIGURATION"); }
  if (!record(input)) return failure("INVALID_CONFIGURATION");
  if (kind !== "limits" && input.schemaVersion !== CONFIGURATION_VERSION) return failure("UNSUPPORTED_SCHEMA", "/schemaVersion");
  const validator = validators[kind];
  if (!validator(input)) {
    const unknown = validator.errors?.find((e) => e.keyword === "additionalProperties");
    return failure(unknown ? "UNKNOWN_FIELD" : "INVALID_CONFIGURATION", unknown ? `${unknown.instancePath}/${String(unknown.params.additionalProperty)}` : validator.errors?.[0]?.instancePath || "/");
  }
  const value = structuredClone(input) as ConfigurationRecords[K];
  let result: ConfigurationResult<unknown> = success(value);
  if (kind === "configuration") result = semantics(value as Configuration);
  if (kind === "request") result = semantics((value as ConfigurationRequest).configuration);
  if (kind === "applied") result = appliedValid(value as AppliedConfiguration);
  if (kind === "limits" && !limitsValid(value as ConfigurationLimits)) result = failure("INVALID_GEOMETRY");
  if (kind === "journal") {
    const journal = value as ConfigurationJournal;
    if (!unique(journal.commits.map((commit) => commit.request.transactionId)) || (journal.commits.at(-1)?.request.transactionId ?? null) !== journal.appliedTransactionId) return failure("REVISION_CONFLICT", "/appliedTransactionId");
    let previous: Configuration | null = null;
    const history: Configuration[] = [];
    for (const commit of journal.commits) {
      result = appliedValid(commit);
      if (!result.ok) return result;
      result = transitionValid(commit.request, previous, history);
      if (!result.ok) return result;
      if (history.length && commit.appliedBy.deviceId !== journal.commits[0].appliedBy.deviceId) return failure("TARGET_MISMATCH", "/commits");
      previous = commit.request.configuration;
      history.push(previous);
    }
  }
  return result.ok ? success(value) : result;
}
export function parseConfigurationRecord<K extends keyof ConfigurationRecords>(json: string, kind: K): ConfigurationResult<ConfigurationRecords[K]> {
  if (Buffer.byteLength(json, "utf8") > MAX_CONFIGURATION_BYTES) return failure("CONFIGURATION_TOO_LARGE");
  try { return validateConfigurationRecord(JSON.parse(json), kind); } catch { return failure("INVALID_JSON"); }
}

/** Local trusted inputs, obtained after authentication and independent hardware/evidence review. */
export interface ConfigurationBoundary {
  receiver: Identity;
  realm: Realm;
  siteId: string;
  executionMode: "simulation" | "hardware";
  calibrationScope: ConfigurationCalibration["scope"];
  installedHardwareDigest: string;
  localLimits: ConfigurationLimits;
  approvedCalibrationDigests: string[];
  readableSchemaVersions: string[];
  rollbackReadableSchemaVersions: string[];
}
export interface ConfigurationApplyBoundary extends ConfigurationBoundary {
  authorizedActor: Actor;
  authorizationId: string;
  inhibited: boolean;
}

function compatible(config: Configuration, context: ConfigurationBoundary): ConfigurationResult<true> {
  if (!context.readableSchemaVersions.includes(config.schemaVersion)) return failure("UNSUPPORTED_SCHEMA", "/schemaVersion");
  if (!same(config.realm, context.realm) || config.siteId !== context.siteId || config.executionMode !== context.executionMode) return failure("NOT_AUTHORIZED", "/realm");
  if (configurationHardwareDigest(config) !== context.installedHardwareDigest) return failure("HARDWARE_MISMATCH", "/components");
  const receiver = config.components.find((component) => component.id === context.receiver.deviceId);
  if (receiver?.kind !== "module" || !["edge", "pico", "pod"].includes(receiver.role)) return failure("TARGET_MISMATCH", "/components");
  const calibration = config.calibration;
  if (!calibration) return failure("MISSING_CALIBRATION", "/calibration");
  if (calibration.scope !== context.calibrationScope) return failure("CALIBRATION_MISMATCH", "/calibration/scope");
  if (!context.approvedCalibrationDigests.includes(configurationDigest(calibration))) return failure("CALIBRATION_NOT_APPROVED", "/calibration");
  const local = validateConfigurationRecord(context.localLimits, "limits");
  if (!local.ok) return local;
  const limits = config.limits;
  const rangeContained = (requested: { min: number; max: number }, hard: { min: number; max: number }, offset = 0): boolean => requested.min + offset >= hard.min && requested.max + offset <= hard.max;
  if (!contained(limits.workspace, local.value.workspace) || limits.maxSpeedMmPerS > local.value.maxSpeedMmPerS || limits.maxAccelerationMmPerS2 > local.value.maxAccelerationMmPerS2 || !rangeContained(limits.tensionN, local.value.tensionN) || !rangeContained(limits.panDeg, local.value.panDeg, calibration.gimbalZeroDeg.pan) || !rangeContained(limits.tiltDeg, local.value.tiltDeg, calibration.gimbalZeroDeg.tilt)) return failure("LIMIT_EXPANSION", "/limits");
  return success(true);
}

/** Compatibility without applying a transaction; trusted commissioning rechecks this after restart. */
export function checkConfigurationCompatibility(input: unknown, context: ConfigurationBoundary): ConfigurationResult<true> {
  const parsed = validateConfigurationRecord(input, 'configuration');
  return parsed.ok ? compatible(parsed.value, context) : parsed;
}

function transitionValid(request: ConfigurationRequest, previous: Configuration | null, history: Configuration[]): ConfigurationResult<true> {
  const config = request.configuration;
  const edit = request.auditContext;
  if (request.expectedAppliedRevision !== (previous?.revision ?? null) || edit.previousConfigRevision !== (previous?.revision ?? null) || edit.previousCalibrationRevision !== (previous?.calibration?.revision ?? null)) return failure("STALE_CONFIGURATION", "/expectedAppliedRevision");
  for (const old of history) {
    if (old.revision === config.revision && !same(old, config) || old.geometry.revision === config.geometry.revision && !same(old.geometry, config.geometry) || old.limits.revision === config.limits.revision && !same(old.limits, config.limits) || old.calibration && config.calibration && old.calibration.revision === config.calibration.revision && !same(old.calibration, config.calibration)) return failure("REVISION_CONFLICT", "/configuration/revision");
  }
  if (request.transition.kind === "rollback") {
    const targetRevision = request.transition.targetRevision;
    const archived = history.find((old) => old.revision === targetRevision);
    if (!archived || !same(archived, config)) return failure("ROLLBACK_INCOMPATIBLE", "/transition/targetRevision");
  } else {
    if (history.some((old) => old.revision === config.revision) || config.previousRevision !== (previous?.revision ?? null)) return failure("REVISION_CONFLICT", "/configuration/previousRevision");
    if (config.calibration && !same(config.calibration, previous?.calibration ?? null) && config.calibration.previousRevision !== (previous?.calibration?.revision ?? null)) return failure("CALIBRATION_MISMATCH", "/configuration/calibration/previousRevision");
  }
  if (previous && (!same(config.realm, previous.realm) || config.siteId !== previous.siteId || config.executionMode !== previous.executionMode)) return failure("NOT_AUTHORIZED", "/configuration/realm");
  return success(true);
}
function report(applied: AppliedConfiguration, source: Identity, type: ConfigurationReport["type"]): ConfigurationReport {
  const config = applied.request.configuration;
  return { schemaVersion: CONFIGURATION_VERSION, type, source: structuredClone(source), transactionId: applied.request.transactionId, appliedRevision: config.revision, configurationDigest: applied.configurationDigest, calibrationRevision: config.calibration!.revision, hardwareDigest: configurationHardwareDigest(config), inhibited: true };
}

/** Synchronous host reference. A successful durable commit must precede acknowledgement. */
export class ConfigurationReference {
  #journal: ConfigurationJournal = { schemaVersion: CONFIGURATION_VERSION, appliedTransactionId: null, commits: [] };
  #committing = false;
  get applied(): AppliedConfiguration | null { return structuredClone(this.#journal.commits.at(-1) ?? null); }
  exportJournal(): ConfigurationJournal { return structuredClone(this.#journal); }
  apply(input: unknown, context: ConfigurationApplyBoundary, persist: (journal: ConfigurationJournal) => boolean): ConfigurationResult<ConfigurationReport> {
    if (this.#committing) return failure("APPLY_IN_PROGRESS");
    const parsed = validateConfigurationRecord(input, "request");
    if (!parsed.ok) return parsed;
    const request = parsed.value;
    if (!same(request.target, context.receiver)) return failure("TARGET_MISMATCH", "/target");
    if (!same(request.auditContext.actor, context.authorizedActor) || request.auditContext.authorizationId !== context.authorizationId) return failure("NOT_AUTHORIZED", "/auditContext");
    const receipt = this.#journal.commits.find((commit) => commit.request.transactionId === request.transactionId);
    if (receipt) return same(receipt.request, request) ? success(report(receipt, receipt.appliedBy, "configuration.applied")) : failure("REVISION_CONFLICT", "/transactionId");
    if (!context.inhibited) return failure("LOCAL_INHIBIT_REQUIRED");
    const previous = this.applied?.request.configuration ?? null;
    const transition = transitionValid(request, previous, this.#journal.commits.map((commit) => commit.request.configuration));
    if (!transition.ok) return transition;
    // A migration/rollback must preserve readability of both the new and prior durable records.
    if (!context.rollbackReadableSchemaVersions.includes(request.configuration.schemaVersion) || previous && !context.rollbackReadableSchemaVersions.includes(previous.schemaVersion)) return failure("ROLLBACK_INCOMPATIBLE", "/schemaVersion");
    const compatibility = compatible(request.configuration, context);
    if (!compatibility.ok) return compatibility;
    if (this.#journal.commits.length >= 128) return failure("CONFIGURATION_TOO_LARGE", "/commits");
    const applied: AppliedConfiguration = { schemaVersion: CONFIGURATION_VERSION, request, appliedBy: structuredClone(context.receiver), configurationDigest: configurationDigest(request.configuration) };
    const next: ConfigurationJournal = { schemaVersion: CONFIGURATION_VERSION, appliedTransactionId: request.transactionId, commits: [...this.#journal.commits, applied] };
    const candidate = validateConfigurationRecord(next, "journal");
    if (!candidate.ok) return candidate;
    this.#committing = true;
    try { if (!persist(structuredClone(candidate.value))) return failure("PERSISTENCE_FAILED"); } catch { return failure("PERSISTENCE_FAILED"); }
    finally { this.#committing = false; }
    this.#journal = candidate.value;
    return success(report(applied, applied.appliedBy, "configuration.applied"));
  }
  /** Restore exact persisted identity. Restart remains inhibited; command compatibility is rechecked. */
  reboot(input: unknown, receiver: Identity): ConfigurationResult<ConfigurationReport | null> {
    if (this.#committing) return failure("APPLY_IN_PROGRESS");
    const parsed = validateConfigurationRecord(input, "journal");
    if (!parsed.ok) return parsed;
    const applied = parsed.value.commits.at(-1);
    if (applied && applied.appliedBy.deviceId !== receiver.deviceId) return failure("TARGET_MISMATCH", "/receiver");
    if (this.applied && this.applied.appliedBy.deviceId !== receiver.deviceId) return failure("TARGET_MISMATCH", "/receiver");
    this.#journal = parsed.value;
    return success(applied ? report(applied, receiver, "configuration.boot") : null);
  }
}

/** Additional compatibility check only: still requires protocol admission, local state/interlocks and physical gates. */
export function checkConfiguredCommand(input: unknown, appliedInput: unknown, context: ConfigurationBoundary): ConfigurationResult<Command> {
  const parsed = validateMessage(input);
  if (!parsed.ok || parsed.value.kind !== "command") return failure("INVALID_COMMAND");
  const command = parsed.value;
  if (!same(command.realm, context.realm) || command.siteId !== context.siteId || command.executionMode !== context.executionMode || !same(command.command.target, context.receiver)) return failure("TARGET_MISMATCH", "/command/target");
  if (["control.stop", "state.resync", "camera.preview.stop", "command.cancel"].includes(command.body.type)) return success(command);
  const applied = validateConfigurationRecord(appliedInput, "applied");
  if (!applied.ok) return applied;
  const config = applied.value.request.configuration;
  if (applied.value.appliedBy.deviceId !== context.receiver.deviceId || command.command.configRevision !== config.revision) return failure("STALE_CONFIGURATION", "/command/configRevision");
  const compatibility = compatible(config, context);
  if (!compatibility.ok) return compatibility;
  if (command.body.type === "motion.move") {
    if (!same(command.body.frame, config.geometry.siteFrame)) return failure("FRAME_MISMATCH", "/body/frame");
    if (!inside(command.body.positionMm, config.limits.workspace, config.calibration!.uncertaintyMm) || command.body.maxSpeedMmPerS > config.limits.maxSpeedMmPerS) return failure("OUTSIDE_LIMITS", "/body");
  }
  if (command.body.type === "camera.gimbal") {
    if (!same(command.body.frame, config.geometry.gimbalFrame)) return failure("FRAME_MISMATCH", "/body/frame");
    if (command.body.panDeg < config.limits.panDeg.min || command.body.panDeg > config.limits.panDeg.max || command.body.tiltDeg < config.limits.tiltDeg.min || command.body.tiltDeg > config.limits.tiltDeg.max) return failure("OUTSIDE_LIMITS", "/body");
  }
  return success(command);
}
/** Protocol capability projection has no numeric placeholder for unavailable readings. */
export function configurationCapabilities(config: Configuration, ownerComponentId: string): Capability[] {
  return config.signals.filter((signal) => signal.ownerComponentId === ownerComponentId && signal.metric !== null).map((signal) => ({ metric: signal.metric!, qualities: signal.reading.kind === "unavailable" ? [] : [...signal.reading.qualities] }));
}
