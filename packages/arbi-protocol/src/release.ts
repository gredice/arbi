import { createHash, sign, verify, type KeyObject } from "node:crypto";
import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { Ajv2020 } from "ajv/dist/2020.js";
import { validateConfigurationRecord, configurationDigest } from "./configuration.js";
import type { Configuration } from "./configuration-types.js";
import type { ReleaseInventory, ReleaseManifest, ReleaseSelection, ReleaseSet, ReleaseVersionRange, ReleaseContractRange } from "./release-types.js";

export const RELEASE_VERSION = "arbi.release/1.0";
export type ReleaseError = "UNSUPPORTED_SCHEMA" | "INVALID_RECORD" | "INVALID_RANGE" | "IDENTITY_MISMATCH" | "UNAVAILABLE_TARGET" | "INCOMPATIBLE" | "INVALID_ORDER" | "INVALID_ROLLBACK" | "INVALID_SIGNATURE" | "ARTIFACT_MISMATCH";
export type ReleaseResult<T> = { ok: true; value: T } | { ok: false; error: { code: ReleaseError; path: string } };
export const releaseFailure = (code: ReleaseError, path = "/"): ReleaseResult<never> => ({ ok: false, error: { code, path } });
const success = <T>(value: T): ReleaseResult<T> => ({ ok: true, value });
const ajv = new Ajv2020({ strict: true, strictTypes: false, allErrors: true });
ajv.addFormat("date-time", { type: "string", validate: (value: string) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value });
for (const name of ["message", "configuration", "release"]) ajv.addSchema(JSON.parse(readFileSync(new URL(`../schema/${name}.schema.json`, import.meta.url), "utf8")));
const schemaId = "https://arbi.gredice.com/schemas/release/1.0/release.schema.json";
const checks = {
  inventory: ajv.compile({ $ref: `${schemaId}#/$defs/ReleaseInventory` }),
  manifest: ajv.compile({ $ref: `${schemaId}#/$defs/ReleaseManifest` }),
  set: ajv.compile({ $ref: `${schemaId}#/$defs/ReleaseSet` }),
};
interface Records { inventory: ReleaseInventory; manifest: ReleaseManifest; set: ReleaseSet }
const unique = (ids: string[]): boolean => new Set(ids).size === ids.length;
export function compareReleaseVersions(a: string, b: string): number {
  const x = a.split(".").map(Number), y = b.split(".").map(Number);
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  return 0;
}
export const releaseVersionInRange = (version: string, range: ReleaseVersionRange | ReleaseContractRange): boolean => compareReleaseVersions(range.min, version) <= 0 && compareReleaseVersions(version, range.max) <= 0;
const validRange = (range: ReleaseVersionRange | ReleaseContractRange): boolean => compareReleaseVersions(range.min, range.max) <= 0;

function manifestSemantics(m: ReleaseManifest): ReleaseResult<ReleaseManifest> {
  if (![m.protocolRange, m.configuration.schemaRange, m.configuration.dataRange, ...m.dependencies.map(d => d.versions)].every(validRange)) return releaseFailure("INVALID_RANGE");
  // This implementation understands protocol/configuration 1.0 only. Future ranges may span it.
  if (!releaseVersionInRange("1.0", m.protocolRange) || !releaseVersionInRange("1.0", m.configuration.schemaRange)) return releaseFailure("INCOMPATIBLE");
  if (!unique(m.dependencies.map(d => d.moduleId)) || m.dependencies.some(d => d.moduleId === m.target.moduleId)) return releaseFailure("INVALID_ORDER");
  if (m.target.targetClass === "pico-motion" && m.artifact.kind !== "firmware" || m.target.targetClass !== "pico-motion" && m.artifact.kind === "firmware") return releaseFailure("INCOMPATIBLE", "/artifact/kind");
  if (m.target.targetClass === "pico-motion" && m.minimumBootloader === null) return releaseFailure("INCOMPATIBLE", "/minimumBootloader");
  const migration = m.configuration.migration;
  if (migration && (migration.from === migration.to || !releaseVersionInRange(migration.to, m.configuration.dataRange) || migration.rollbackTo !== null && migration.rollbackTo !== migration.from)) return releaseFailure("INCOMPATIBLE", "/configuration/migration");
  return success(m);
}

/** Strict structure plus semantics. It neither authenticates artifacts nor authorizes installation. */
export function validateReleaseRecord<K extends keyof Records>(kind: K, input: unknown): ReleaseResult<Records[K]> {
  if (typeof input !== "object" || input === null || (input as { schemaVersion?: unknown }).schemaVersion !== RELEASE_VERSION) return releaseFailure("UNSUPPORTED_SCHEMA", "/schemaVersion");
  const check = checks[kind];
  if (!check(input)) return releaseFailure("INVALID_RECORD", check.errors?.[0]?.instancePath || "/");
  const value = structuredClone(input) as Records[K];
  if (kind === "manifest") {
    const result = manifestSemantics(value as ReleaseManifest);
    if (!result.ok) return result;
  }
  if (kind === "inventory") {
    const inventory = value as ReleaseInventory;
    if (!unique(inventory.modules.map(m => m.component.id))) return releaseFailure("IDENTITY_MISMATCH", "/modules");
    for (const m of inventory.modules) {
      const role = m.component.kind === "passive" ? "passive" : m.component.role;
      const expected = { pico: "pico-motion", pod: "pi-pod", edge: "linux-edge", driver: "driver", passive: "passive", peripheral: "passive" }[role];
      if (m.targetClass !== expected) return releaseFailure("IDENTITY_MISMATCH", "/modules/targetClass");
      if (m.capability.kind === "reference-only" && (inventory.executionMode !== "simulation" || ["passive", "driver"].includes(m.targetClass) || m.capability.evidence.stage !== "simulation" || m.capability.evidence.result !== "passed" || m.updaterVersion === null || !unique(m.capability.targets))) return releaseFailure("UNAVAILABLE_TARGET", "/modules/capability");
      if ((m.targetClass === "passive" || m.targetClass === "driver") && (m.updaterVersion !== null || m.bootloaderVersion !== null)) return releaseFailure("UNAVAILABLE_TARGET", "/modules");
    }
  }
  if (kind === "set") {
    const result = validateReleasePaths(value as ReleaseSet);
    if (!result.ok) return result;
  }
  return success(value);
}

/** Bind the overlay to accepted configuration identities; labels do not create a flash interface. */
export function bindReleaseInventory(input: unknown, configurationInput: unknown): ReleaseResult<ReleaseInventory> {
  const result = validateReleaseRecord("inventory", input);
  if (!result.ok) return result;
  const config = validateConfigurationRecord(configurationInput, "configuration");
  if (!config.ok) return releaseFailure("INVALID_RECORD", "/configuration");
  const inventory = result.value, configuration: Configuration = config.value;
  if (!isDeepStrictEqual(inventory.realm, configuration.realm) || inventory.siteId !== configuration.siteId || inventory.executionMode !== configuration.executionMode || inventory.configurationRevision !== configuration.revision) return releaseFailure("IDENTITY_MISMATCH");
  if (inventory.modules.length !== configuration.components.length || inventory.modules.some(m => !isDeepStrictEqual(m.component, configuration.components.find(c => c.id === m.component.id)))) return releaseFailure("IDENTITY_MISMATCH", "/modules/component");
  return result;
}

export function checkReleaseCompatibility(input: unknown, inventoryInput: unknown, configurationDataVersion: string): ReleaseResult<ReleaseManifest> {
  const manifest = validateReleaseRecord("manifest", input), inventory = validateReleaseRecord("inventory", inventoryInput);
  if (!manifest.ok) return manifest;
  if (!inventory.ok) return inventory;
  const m = manifest.value, module = inventory.value.modules.find(x => x.component.id === m.target.moduleId);
  if (!module) return releaseFailure("IDENTITY_MISMATCH", "/target/moduleId");
  const c = module.component;
  if (module.boardId !== m.target.boardId || module.targetClass !== m.target.targetClass || ["hardwareId", "hardwareRevision", "assemblyId", "assemblyRevision"].some(key => c[key as keyof typeof c] !== m.target[key as keyof typeof m.target])) return releaseFailure("IDENTITY_MISMATCH", "/target");
  if (module.capability.kind !== "reference-only" || !module.capability.targets.includes(m.artifact.kind)) return releaseFailure("UNAVAILABLE_TARGET");
  if (module.updaterVersion === null || compareReleaseVersions(module.updaterVersion, m.minimumUpdater) < 0 || m.minimumBootloader !== null && (module.bootloaderVersion === null || compareReleaseVersions(module.bootloaderVersion, m.minimumBootloader) < 0)) return releaseFailure("INCOMPATIBLE", "/minimumUpdater");
  if (!/^(0|[1-9][0-9]{0,4})\.(0|[1-9][0-9]{0,4})\.(0|[1-9][0-9]{0,4})$/.test(configurationDataVersion) || !releaseVersionInRange(configurationDataVersion, m.configuration.dataRange) && m.configuration.migration?.from !== configurationDataVersion) return releaseFailure("INCOMPATIBLE", "/configuration/dataRange");
  return manifest;
}

export interface ReleasePathReport { updateStates: ReleaseSelection[][]; rollbackStates: { afterStep: number; states: ReleaseSelection[][] }[] }
/** Check initial, every update prefix, and a permitted recovery path from every prefix. */
function validateReleasePaths(set: ReleaseSet): ReleaseResult<ReleasePathReport> {
  if (!unique(set.manifests.map(m => m.releaseId)) || !unique(set.initial.map(s => s.moduleId)) || !unique(set.desired.map(s => s.moduleId)) || !unique(set.order.map(o => o.moduleId))) return releaseFailure("INVALID_ORDER");
  for (const m of set.manifests) { const v = manifestSemantics(m); if (!v.ok) return v; }
  const byRelease = new Map(set.manifests.map(m => [m.releaseId, m]));
  const modules = set.initial.map(s => s.moduleId);
  const sameModules = (list: string[]) => list.length === modules.length && list.every(m => modules.includes(m));
  if (!sameModules(set.desired.map(s => s.moduleId)) || !sameModules(set.order.map(o => o.moduleId)) || !unique(set.steps.map(s => s.moduleId)) || !sameModules(set.steps.map(s => s.moduleId))) return releaseFailure("INVALID_ORDER");
  const first = new Map(set.steps.map((s, i) => [s.moduleId, i]));
  for (const order of set.order) if (!unique(order.after) || order.after.some(dep => !first.has(dep) || first.get(dep)! >= first.get(order.moduleId)!)) return releaseFailure("INVALID_ORDER", "/order");
  // A module's hardware and board identity cannot change between catalog entries.
  for (const moduleId of modules) {
    const manifests = set.manifests.filter(m => m.target.moduleId === moduleId);
    if (!manifests.length || manifests.some(m => !isDeepStrictEqual(m.target, manifests[0].target))) return releaseFailure("IDENTITY_MISMATCH", "/manifests/target");
  }
  function stateValid(state: ReleaseSelection[]): boolean {
    return state.every(s => {
      const m = byRelease.get(s.releaseId);
      return m !== undefined && m.target.moduleId === s.moduleId && releaseVersionInRange(s.configurationDataVersion, m.configuration.dataRange) && m.dependencies.every(d => {
        const peer = state.find(x => x.moduleId === d.moduleId);
        const release = peer && byRelease.get(peer.releaseId);
        return release !== undefined && releaseVersionInRange(release.build.version, d.versions);
      });
    });
  }
  function apply(state: ReleaseSelection[], step: ReleaseSelection): ReleaseSelection[] | null {
    const old = state.find(s => s.moduleId === step.moduleId), candidate = byRelease.get(step.releaseId);
    if (!old || !candidate || candidate.target.moduleId !== step.moduleId) return null;
    const previous = byRelease.get(old.releaseId)!;
    if (old.configurationDataVersion !== step.configurationDataVersion) {
      const forward = candidate.configuration.migration, backward = previous.configuration.migration;
      if (!(forward?.from === old.configurationDataVersion && forward.to === step.configurationDataVersion) && !(backward?.to === old.configurationDataVersion && backward.rollbackTo === step.configurationDataVersion)) return null;
    }
    const next = state.map(s => s.moduleId === step.moduleId ? structuredClone(step) : s);
    return stateValid(next) ? next : null;
  }
  if (!stateValid(set.initial)) return releaseFailure("INCOMPATIBLE", "/initial");
  const states = [structuredClone(set.initial)];
  for (const step of set.steps) {
    const next = apply(states.at(-1)!, step);
    if (!next) return releaseFailure("INCOMPATIBLE", "/steps");
    states.push(next);
  }
  const equivalent = (a: ReleaseSelection[], b: ReleaseSelection[]) => a.length === b.length && a.every(s => isDeepStrictEqual(s, b.find(t => t.moduleId === s.moduleId)));
  if (!equivalent(states.at(-1)!, set.desired)) return releaseFailure("INVALID_ORDER", "/desired");
  if (set.rollbackPaths.length !== set.steps.length || !unique(set.rollbackPaths.map(p => String(p.afterStep)))) return releaseFailure("INVALID_ROLLBACK", "/rollbackPaths");
  const rollbackStates: ReleasePathReport["rollbackStates"] = [];
  for (const path of set.rollbackPaths) {
    if (path.afterStep > set.steps.length) return releaseFailure("INVALID_ROLLBACK");
    const recovery = [structuredClone(states[path.afterStep])];
    for (const step of path.steps) {
      const next = apply(recovery.at(-1)!, step);
      if (!next) return releaseFailure("INVALID_ROLLBACK", "/rollbackPaths/steps");
      recovery.push(next);
    }
    if (!equivalent(recovery.at(-1)!, set.initial)) return releaseFailure("INVALID_ROLLBACK", "/rollbackPaths");
    rollbackStates.push({ afterStep: path.afterStep, states: recovery });
  }
  return success({ updateStates: states, rollbackStates });
}

export function inspectReleaseSet(input: unknown): ReleaseResult<ReleasePathReport> {
  const result = validateReleaseRecord("set", input);
  return result.ok ? validateReleasePaths(result.value) : result;
}

/** Admit only a declared adjacent step from the actually observed mixed-version state. */
export function checkReleaseStep(input: unknown, current: ReleaseSelection[], next: ReleaseSelection, direction: "install" | "rollback"): ReleaseResult<ReleaseSelection> {
  const parsed = validateReleaseRecord("set", input);
  if (!parsed.ok) return parsed;
  const report = validateReleasePaths(parsed.value);
  if (!report.ok) return report;
  const sameState = (state: ReleaseSelection[]) => current.length === state.length && new Set(current.map(s => s.moduleId)).size === current.length && state.every(s => isDeepStrictEqual(s, current.find(c => c.moduleId === s.moduleId)));
  if (direction === "install") {
    for (let i = 0; i < parsed.value.steps.length; i++) if (sameState(report.value.updateStates[i]) && isDeepStrictEqual(next, parsed.value.steps[i])) return success(structuredClone(next));
  } else {
    for (const path of report.value.rollbackStates) {
      const declared = parsed.value.rollbackPaths.find(p => p.afterStep === path.afterStep)!;
      for (let i = 0; i < declared.steps.length; i++) if (sameState(path.states[i]) && isDeepStrictEqual(next, declared.steps[i])) return success(structuredClone(next));
    }
  }
  return releaseFailure(direction === "install" ? "INCOMPATIBLE" : "INVALID_ROLLBACK", "/currentSelections");
}

/** Deterministic canonical JSON defined by the configuration contract. Signature covers all metadata. */
export function releaseSigningBytes(manifest: ReleaseManifest): Buffer {
  const unsigned = structuredClone(manifest) as Partial<ReleaseManifest>;
  // Use a domain separated canonical digest to avoid signing ambiguous JSON encodings.
  unsigned.artifact = { ...manifest.artifact, signature: { algorithm: "ed25519", keyId: manifest.artifact.signature.keyId, value: "0".repeat(128) } };
  return Buffer.from(`arbi.release/1.0\n${configurationDigest(unsigned)}`, "utf8");
}

/** Pure reference producer. Caller provides an ephemeral test signer; no key storage or publication. */
export function produceRelease(input: unknown, bytes: Uint8Array, signer: { keyId: string; privateKey: KeyObject }): ReleaseResult<ReleaseManifest> {
  const parsed = validateReleaseRecord("manifest", input);
  if (!parsed.ok) return parsed;
  if (signer.privateKey.asymmetricKeyType !== "ed25519" || parsed.value.artifact.signature.keyId !== signer.keyId) return releaseFailure("INVALID_SIGNATURE");
  const manifest = parsed.value;
  manifest.artifact.sha256 = createHash("sha256").update(bytes).digest("hex");
  manifest.artifact.sizeBytes = bytes.byteLength;
  manifest.artifact.signature.value = sign(null, releaseSigningBytes(manifest), signer.privateKey).toString("hex");
  return validateReleaseRecord("manifest", manifest);
}

/** Authenticity depends on the caller's trusted key binding; format validation alone proves nothing. */
export function verifyReleaseArtifact(input: unknown, bytes: Uint8Array, trustedKey: { keyId: string; publicKey: KeyObject }): ReleaseResult<ReleaseManifest> {
  const parsed = validateReleaseRecord("manifest", input);
  if (!parsed.ok) return parsed;
  const m = parsed.value;
  if (bytes.byteLength !== m.artifact.sizeBytes || createHash("sha256").update(bytes).digest("hex") !== m.artifact.sha256) return releaseFailure("ARTIFACT_MISMATCH");
  if (trustedKey.publicKey.asymmetricKeyType !== "ed25519" || trustedKey.keyId !== m.artifact.signature.keyId || !verify(null, releaseSigningBytes(m), trustedKey.publicKey, Buffer.from(m.artifact.signature.value, "hex"))) return releaseFailure("INVALID_SIGNATURE");
  return parsed;
}
