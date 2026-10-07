import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { Ajv2020 } from "ajv/dist/2020.js";
import { configurationDigest } from "./configuration.js";
import { quantityToBytes } from "./accounting.js";
import { checkReleaseCompatibility, checkReleaseStep, releaseVersionInRange, validateReleaseRecord } from "./release.js";
import type { ReleaseInventory, ReleaseManifest, ReleaseSelection, ReleaseSet } from "./release-types.js";
import type { Identity } from "./messages.js";
import type { AuditLinks, AuditMetadata, AuditRecordReference, AuditResource } from "./audit-types.js";
import type { UpdateArtifactVerification, UpdateBootObservation, UpdateEvent, UpdateJournal, UpdatePreflight, UpdateRequest, UpdateScope } from "./update-types.js";

export const UPDATE_VERSION = "arbi.update/1.0";
export type UpdateError = "UNSUPPORTED_SCHEMA" | "INVALID_RECORD" | "INCOMPATIBLE" | "NOT_AUTHORIZED" | "SCOPE_MISMATCH" | "SOURCE_MISMATCH" | "TARGET_MISMATCH" | "DEADLINE_EXPIRED" | "IDEMPOTENCY_CONFLICT" | "INVALID_TRANSITION" | "LOCAL_PREFLIGHT_REQUIRED" | "PHYSICAL_UPDATES_DISABLED" | "OPERATION_IN_PROGRESS" | "RESOURCE_LIMIT";
export type UpdateResult<T> = { ok: true; value: T } | { ok: false; error: { code: UpdateError; path: string } };
const failure = (code: UpdateError, path = "/"): UpdateResult<never> => ({ ok: false, error: { code, path } });
const success = <T>(value: T): UpdateResult<T> => ({ ok: true, value });
const ajv = new Ajv2020({ strict: true, strictTypes: false, allErrors: true });
export const updateUtcValid = (value: string): boolean => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value;
ajv.addFormat("date-time", { type: "string", validate: updateUtcValid });
for (const name of ["message", "configuration", "release", "update"]) ajv.addSchema(JSON.parse(readFileSync(new URL(`../schema/${name}.schema.json`, import.meta.url), "utf8")));
interface Records { request: UpdateRequest; boot: UpdateBootObservation; event: UpdateEvent; journal: UpdateJournal }
const definitions = { request: "UpdateRequest", boot: "UpdateBootObservation", event: "UpdateEvent", journal: "UpdateJournal" };
const checks = Object.fromEntries(Object.entries(definitions).map(([kind, name]) => [kind, ajv.compile({ $ref: `https://arbi.gredice.com/schemas/update/1.0/update.schema.json#/$defs/${name}` })]));

function requestSemantics(r: UpdateRequest): UpdateResult<UpdateRequest> {
  if (!validateReleaseRecord("manifest", r.manifest).ok) return failure("INCOMPATIBLE", "/manifest");
  if (r.source.deviceId !== r.coordinatorId || r.manifest.releaseId === r.expectedInstalledReleaseId) return failure("INVALID_RECORD");
  if (!(r.issuedAt < r.startDeadline && r.startDeadline < r.confirmationDeadline)) return failure("INVALID_RECORD", "/startDeadline");
  if (!releaseVersionInRange(r.configurationDataVersion, r.manifest.configuration.dataRange)) return failure("INCOMPATIBLE", "/configurationDataVersion");
  const bytes = quantityToBytes({ value: r.budget.payloadBytes, unit: "bytes" });
  if (!bytes.ok || r.budget.payloadBytes !== String(r.manifest.artifact.sizeBytes) || BigInt(r.budget.maximumWanBytes) > (1n << 64n) - 1n || BigInt(r.budget.maximumWanBytes) < BigInt(r.budget.payloadBytes) || r.budget.category !== (r.manifest.artifact.kind === "os" ? "os-update" : "ota")) return failure("INVALID_RECORD", "/budget");
  return success(r);
}

export function validateUpdateRecord<K extends keyof Records>(kind: K, input: unknown): UpdateResult<Records[K]> {
  if (typeof input !== "object" || input === null || (input as { schemaVersion?: unknown }).schemaVersion !== UPDATE_VERSION) return failure("UNSUPPORTED_SCHEMA", "/schemaVersion");
  const check = checks[kind];
  if (!check(input)) return failure("INVALID_RECORD", check.errors?.[0]?.instancePath || "/");
  const value = structuredClone(input) as Records[K];
  if (kind === "request") { const r = requestSemantics(value as UpdateRequest); if (!r.ok) return r; }
  if (kind === "journal") {
    const journal = value as UpdateJournal;
    const r = requestSemantics(journal.request);
    if (!r.ok) return r;
    const state = replay(journal);
    if (!state.ok) return state;
  }
  return success(value);
}

export interface UpdateStatus {
  operationId: string;
  state: "requested" | "staged" | "trial" | "confirmed" | "failed" | "rolled-back" | "recovery-required";
  available: { releaseId: string; build: ReleaseManifest["build"]; artifactDigest: string; provenance: "release-manifest" };
  desired: { releaseId: string; build: ReleaseManifest["build"]; source: Identity; issuedAt: string; provenance: "authorized-request" };
  installed: UpdateBootObservation;
  confirmed: UpdateBootObservation;
  installationReserved: boolean;
  lastEvent: UpdateEvent | null;
}
const bootMatches = (boot: UpdateBootObservation, m: ReleaseManifest, dataVersion: string): boolean => boot.source.deviceId === m.target.moduleId && boot.releaseId === m.releaseId && isDeepStrictEqual(boot.build, m.build) && boot.artifactDigest === m.artifact.sha256 && boot.configurationDataVersion === dataVersion && releaseVersionInRange(dataVersion, m.configuration.dataRange);
const terminal = (state: UpdateStatus["state"]): boolean => ["confirmed", "rolled-back"].includes(state);

function initial(j: UpdateJournal): UpdateResult<UpdateStatus> {
  const r = j.request, m = r.manifest, baseline = j.baseline;
  if (!validateReleaseRecord("manifest", j.baselineManifest).ok || baseline.health !== "passed" || !bootMatches(baseline, j.baselineManifest, baseline.configurationDataVersion) || baseline.releaseId !== r.expectedInstalledReleaseId || !isDeepStrictEqual(j.baselineManifest.target, m.target) || baseline.observedAt > r.issuedAt) return failure("TARGET_MISMATCH", "/baseline");
  if (baseline.configurationDataVersion !== r.configurationDataVersion) {
    const forward = m.configuration.migration, backward = j.baselineManifest.configuration.migration;
    const allowed = r.direction === "install" ? forward?.from === baseline.configurationDataVersion && forward.to === r.configurationDataVersion : backward?.to === baseline.configurationDataVersion && backward.rollbackTo === r.configurationDataVersion;
    if (!allowed) return failure("INCOMPATIBLE", "/configurationDataVersion");
  }
  return success({ operationId: r.operationId, state: "requested", available: { releaseId: m.releaseId, build: m.build, artifactDigest: m.artifact.sha256, provenance: "release-manifest" }, desired: { releaseId: m.releaseId, build: m.build, source: r.source, issuedAt: r.issuedAt, provenance: "authorized-request" }, installed: baseline, confirmed: baseline, installationReserved: false, lastEvent: null });
}

function transition(j: UpdateJournal, previous: UpdateStatus, e: UpdateEvent): UpdateResult<UpdateStatus> {
  const r = j.request, m = r.manifest, state = structuredClone(previous);
  if (e.operationId !== r.operationId || e.artifactDigest !== m.artifact.sha256) return failure("TARGET_MISMATCH");
  if (e.observedAt < (state.lastEvent?.observedAt ?? r.issuedAt)) return failure("INVALID_RECORD", "/observedAt");
  if (terminal(state.state)) return failure("INVALID_TRANSITION");
  const bootKind = ["trial", "confirmed", "rolled-back"].includes(e.kind);
  if (bootKind !== (e.boot !== null)) return failure("INVALID_RECORD", "/boot");
  if ((e.kind === "staged") !== (e.verification !== null) || (e.kind === "installation-reserved") !== (e.preflight !== null)) return failure("INVALID_RECORD", "/verification");
  if (bootKind) {
    const boot = e.boot!;
    if (!isDeepStrictEqual(boot.source, e.source) || boot.observedAt !== e.observedAt) return failure("SOURCE_MISMATCH", "/boot");
    if (e.kind === "rolled-back") {
      if (!state.installationReserved || !["trial", "failed", "recovery-required"].includes(state.state) || boot.health !== "passed" || !bootMatches(boot, j.baselineManifest, j.baseline.configurationDataVersion)) return failure("INVALID_TRANSITION");
      const migration = r.direction === "install" ? m.configuration.migration : j.baselineManifest.configuration.migration;
      const restoreAllowed = r.direction === "install" ? migration?.rollbackTo === j.baseline.configurationDataVersion : migration?.from === r.configurationDataVersion && migration.to === j.baseline.configurationDataVersion;
      if (r.configurationDataVersion !== j.baseline.configurationDataVersion && !restoreAllowed) return failure("INCOMPATIBLE", "/boot/configurationDataVersion");
      if (boot.source.bootId === j.baseline.source.bootId || boot.source.bootId === state.installed.source.bootId) return failure("SOURCE_MISMATCH", "/boot/source");
      state.installed = boot; state.confirmed = boot; state.state = "rolled-back";
    } else {
      if (!state.installationReserved || !bootMatches(boot, m, r.configurationDataVersion) || boot.source.bootId === j.baseline.source.bootId) return failure("TARGET_MISMATCH", "/boot");
      if (e.kind === "trial" && state.state !== "staged") return failure("INVALID_TRANSITION");
      if (e.kind === "confirmed" && (state.state !== "trial" || !isDeepStrictEqual(boot.source, state.installed.source) || boot.health !== "passed")) return failure("INVALID_TRANSITION");
      state.installed = boot;
      if (e.observedAt >= r.confirmationDeadline) state.state = "recovery-required";
      else if (e.kind === "confirmed") { state.confirmed = boot; state.state = "confirmed"; }
      else state.state = "trial";
    }
  } else {
    if (e.source.deviceId !== r.coordinatorId) return failure("SOURCE_MISMATCH");
    switch (e.kind) {
      case "staged":
        if (state.state !== "requested") return failure("INVALID_TRANSITION");
        if (e.observedAt >= r.startDeadline) return failure("DEADLINE_EXPIRED");
        if (e.verification!.manifestDigest !== configurationDigest(m) || e.verification!.keyId !== m.artifact.signature.keyId || e.verification!.artifactDigest !== m.artifact.sha256) return failure("INVALID_RECORD", "/verification");
        state.state = "staged"; break;
      case "installation-reserved":
        if (state.state !== "staged" || state.installationReserved) return failure("INVALID_TRANSITION");
        if (e.observedAt >= r.startDeadline) return failure("DEADLINE_EXPIRED");
        if (e.preflight!.independentProtectionOwnerId === m.target.moduleId) return failure("LOCAL_PREFLIGHT_REQUIRED");
        state.installationReserved = true; break;
      case "failed": state.state = "failed"; break;
      case "recovery-required": state.state = "recovery-required"; break;
      default: return failure("INVALID_TRANSITION");
    }
  }
  state.lastEvent = e;
  return success(state);
}

function replay(j: UpdateJournal): UpdateResult<UpdateStatus> {
  let state = initial(j);
  if (!state.ok) return state;
  const seen = new Map<string, UpdateEvent>();
  for (const event of j.events) {
    const duplicate = seen.get(event.eventId);
    if (duplicate) {
      if (!isDeepStrictEqual(duplicate, event)) return failure("IDEMPOTENCY_CONFLICT", "/events");
      continue;
    }
    seen.set(event.eventId, event);
    state = transition(j, state.value, event);
    if (!state.ok) return state;
  }
  return state;
}

/** Trusted storage owns the log. Replay validates coherence; it cannot authenticate a file's author. */
export function recoverUpdate(input: unknown): UpdateResult<{ journal: UpdateJournal; status: UpdateStatus; dispatchInstallation: false }> {
  const parsed = validateUpdateRecord("journal", input);
  if (!parsed.ok) return parsed;
  const state = replay(parsed.value);
  return state.ok ? success({ journal: parsed.value, status: state.value, dispatchInstallation: false }) : state;
}

export interface UpdateAdmission {
  scope: UpdateScope;
  inventory: ReleaseInventory;
  releaseSet: ReleaseSet;
  currentSelections: ReleaseSelection[];
  authenticatedSource: Identity;
  authorizedAuditContext: UpdateRequest["auditContext"];
  baseline: UpdateBootObservation;
  baselineManifest: ReleaseManifest;
  nowUtc: string;
}
/** Scope is realm/site (not boot/session). An operation ID cannot be reused for a changed target. */
export function requestUpdate(existingInputs: unknown[], input: unknown, boundary: UpdateAdmission): UpdateResult<{ journal: UpdateJournal; duplicate: boolean }> {
  const parsed = validateUpdateRecord("request", input);
  if (!parsed.ok) return parsed;
  const r = parsed.value;
  if (!isDeepStrictEqual(r.scope, boundary.scope)) return failure("SCOPE_MISMATCH");
  if (!isDeepStrictEqual(r.source, boundary.authenticatedSource)) return failure("SOURCE_MISMATCH");
  if (!isDeepStrictEqual(r.auditContext, boundary.authorizedAuditContext)) return failure("NOT_AUTHORIZED");
  const inventory = boundary.inventory;
  if (!isDeepStrictEqual(inventory.realm, r.scope.realm) || inventory.siteId !== r.scope.siteId || inventory.executionMode !== r.scope.executionMode) return failure("SCOPE_MISMATCH");
  const existing: UpdateJournal[] = [];
  const keys = new Map<string, UpdateJournal>();
  for (const item of existingInputs) {
    const p = validateUpdateRecord("journal", item);
    if (!p.ok) return p;
    const key = configurationDigest({ scope: p.value.request.scope, operationId: p.value.request.operationId });
    const duplicate = keys.get(key);
    if (duplicate) {
      if (!isDeepStrictEqual(duplicate, p.value)) return failure("IDEMPOTENCY_CONFLICT");
      continue;
    }
    keys.set(key, p.value);
    existing.push(p.value);
  }
  const found = existing.find(j => isDeepStrictEqual(j.request.scope, r.scope) && j.request.operationId === r.operationId);
  if (found) return isDeepStrictEqual(found.request, r) ? success({ journal: found, duplicate: true }) : failure("IDEMPOTENCY_CONFLICT");
  if (!updateUtcValid(boundary.nowUtc) || boundary.nowUtc < r.issuedAt || boundary.nowUtc >= r.startDeadline) return failure("DEADLINE_EXPIRED");
  if (r.scope.executionMode !== "simulation") return failure("PHYSICAL_UPDATES_DISABLED");
  if (!checkReleaseCompatibility(r.manifest, inventory, r.configurationDataVersion).ok) return failure("INCOMPATIBLE");
  const selection = { moduleId: r.manifest.target.moduleId, releaseId: r.manifest.releaseId, configurationDataVersion: r.configurationDataVersion };
  if (r.releaseSetId !== boundary.releaseSet.releaseSetId || !checkReleaseStep(boundary.releaseSet, boundary.currentSelections, selection, r.direction).ok || !isDeepStrictEqual(r.manifest, boundary.releaseSet.manifests.find(m => m.releaseId === r.manifest.releaseId)) || !isDeepStrictEqual(boundary.baselineManifest, boundary.releaseSet.manifests.find(m => m.releaseId === boundary.baselineManifest.releaseId))) return failure("INCOMPATIBLE", "/releaseSetId");
  const observed = boundary.currentSelections.find(s => s.moduleId === r.manifest.target.moduleId);
  if (!observed || observed.releaseId !== boundary.baseline.releaseId || observed.configurationDataVersion !== boundary.baseline.configurationDataVersion) return failure("TARGET_MISMATCH", "/currentSelections");
  for (const j of existing) if (isDeepStrictEqual(j.request.scope, r.scope) && j.request.manifest.target.moduleId === r.manifest.target.moduleId) {
    const state = replay(j);
    // Failed/ambiguous reserved installations continue blocking until observed rollback/recovery.
    if (!state.ok || !terminal(state.value.state) && (state.value.installationReserved || !["failed", "recovery-required"].includes(state.value.state))) return failure("OPERATION_IN_PROGRESS");
  }
  const journal: UpdateJournal = { schemaVersion: UPDATE_VERSION, request: r, baseline: structuredClone(boundary.baseline), baselineManifest: structuredClone(boundary.baselineManifest), events: [] };
  const state = validateUpdateRecord("journal", journal);
  return state.ok ? success({ journal: state.value, duplicate: false }) : state;
}

export interface UpdateEventBoundary {
  scope: UpdateScope;
  authenticatedSource: Identity;
  owner: "edge" | "target";
  nowUtc: string;
  /** From a trusted local adapter, never from the event payload or cloud notification. */
  localBootObservation: UpdateBootObservation | null;
  artifactVerification: UpdateArtifactVerification | null;
  /** Simulated record; cannot enable physical installation. Parked is not a preflight. */
  preflight: UpdatePreflight | null;
}

export function admitUpdateEvent(journalInput: unknown, eventInput: unknown, boundary: UpdateEventBoundary): UpdateResult<UpdateJournal> {
  const parsed = validateUpdateRecord("journal", journalInput), event = validateUpdateRecord("event", eventInput);
  if (!parsed.ok) return parsed;
  if (!event.ok) return event;
  const j = parsed.value, e = event.value, r = j.request;
  if (!isDeepStrictEqual(boundary.scope, r.scope)) return failure("SCOPE_MISMATCH");
  if (!isDeepStrictEqual(boundary.authenticatedSource, e.source)) return failure("SOURCE_MISMATCH");
  if (r.scope.executionMode !== "simulation") return failure("PHYSICAL_UPDATES_DISABLED");
  const bootKind = ["trial", "confirmed", "rolled-back"].includes(e.kind);
  if (boundary.owner !== (bootKind ? "target" : "edge")) return failure("NOT_AUTHORIZED");
  if (bootKind && !isDeepStrictEqual(e.boot, boundary.localBootObservation)) return failure("NOT_AUTHORIZED", "/boot");
  if (!updateUtcValid(boundary.nowUtc) || e.observedAt > boundary.nowUtc) return failure("INVALID_RECORD", "/observedAt");
  const existing = j.events.find(x => x.eventId === e.eventId);
  if (existing) return isDeepStrictEqual(existing, e) ? parsed : failure("IDEMPOTENCY_CONFLICT");
  if (e.kind === "staged" && (!boundary.artifactVerification || !isDeepStrictEqual(e.verification, boundary.artifactVerification))) return failure("NOT_AUTHORIZED", "/artifactVerification");
  if (e.kind === "installation-reserved") {
    const preflight = boundary.preflight;
    if (!preflight || !isDeepStrictEqual(e.preflight, preflight) || preflight.independentProtectionOwnerId === r.manifest.target.moduleId) return failure("LOCAL_PREFLIGHT_REQUIRED");
    if (boundary.nowUtc >= r.startDeadline) return failure("DEADLINE_EXPIRED");
  }
  if (j.events.length >= 256) return failure("RESOURCE_LIMIT");
  j.events.push(e);
  return validateUpdateRecord("journal", j);
}

/** Persist returned journal BEFORE dispatch. After uncertain commit/restart, recover: never resend. */
export function reserveReferenceInstallation(journalInput: unknown, eventInput: unknown, boundary: UpdateEventBoundary): UpdateResult<{ journal: UpdateJournal; dispatchInstallation: boolean }> {
  const p = validateUpdateRecord("journal", journalInput), e = validateUpdateRecord("event", eventInput);
  if (!p.ok) return p;
  if (!e.ok) return e;
  if (e.value.kind !== "installation-reserved") return failure("INVALID_TRANSITION");
  const state = replay(p.value);
  if (!state.ok) return state;
  const result = admitUpdateEvent(p.value, e.value, boundary);
  return result.ok ? success({ journal: result.value, dispatchInstallation: !state.value.installationReserved }) : result;
}

/** Correlation seam only. The audit adapter still binds actor/source/action/evidence at its boundary. */
export function updateAuditReferences(journalInput: unknown, eventId: string | null): UpdateResult<{ links: AuditLinks; resource: AuditResource; metadata: AuditMetadata; record: AuditRecordReference | null }> {
  const parsed = validateUpdateRecord("journal", journalInput);
  if (!parsed.ok) return parsed;
  const j = parsed.value, r = j.request;
  const event = eventId === null ? null : j.events.find(e => e.eventId === eventId);
  if (eventId !== null && !event) return failure("INVALID_RECORD", "/eventId");
  return success({
    links: { correlationId: r.auditContext.correlationId, intentEventId: r.auditContext.intentEventId, causationEventId: r.auditContext.intentEventId, jobId: null, sessionId: null, commandId: null, requestSource: r.source, target: event?.boot?.source ?? null },
    resource: { kind: "update", id: r.operationId, deviceId: r.manifest.target.moduleId },
    metadata: { permission: "update", releaseId: r.manifest.releaseId },
    record: event ? { kind: "local-record", id: event.eventId } : null,
  });
}
