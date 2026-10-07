import { randomUUID } from "node:crypto";
import { isId, isObject, isRealm, sameRealm } from "@arbi/gredice";
import type { AuthorizedContext } from "@arbi/gredice";
import { configurationCapabilities, configurationDigest, configurationHardwareDigest, validateConfigurationRecord } from "@arbi/protocol";
import type { Capability, Configuration, Identity, Realm } from "@arbi/protocol";
import { CHALLENGE_TTL_MS, CREDENTIAL_TTL_MS, EnrollmentError, MAX_ROTATION_OVERLAP_MS, VERSION } from "./contracts";
import type { Challenge, Credential, Device, DeviceRequest, Registry, RegistryStore, Transaction, TransitionObservation } from "./contracts";
import { prove, publicKey } from "./crypto";

function fail(code: EnrollmentError["code"]): never { throw new EnrollmentError(code); }
function shape(value: unknown, keys: string[]): asserts value is Record<string, unknown> {
  if (!isObject(value) || Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) fail("INVALID_REQUEST");
}
function id(value: unknown): string { return isId(value) ? value : fail("INVALID_REQUEST"); }
function counter(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : fail("INVALID_REQUEST");
}
function identity(value: unknown): Identity {
  shape(value, ["deviceId", "bootId", "sessionId"]);
  return { deviceId: id(value.deviceId), bootId: id(value.bootId), sessionId: id(value.sessionId) };
}
function sameIdentity(a: Identity | null, b: Identity | null): boolean {
  return a === null || b === null ? a === b : a.deviceId === b.deviceId && a.bootId === b.bootId && a.sessionId === b.sessionId;
}
function credential(key: string, now: number): Credential {
  return { id: randomUUID(), publicKey: key, createdAtMs: now, expiresAtMs: now + CREDENTIAL_TTL_MS,
    revokedAtMs: null, lastSequence: -1 };
}
function lastDevice(state: Registry, componentId: string): Device | undefined {
  return state.devices.filter((device) => device.componentId === componentId).at(-1);
}
function usedKey(state: Registry, key: string): boolean {
  return state.devices.some((device) => device.credentials.some((c) => c.publicKey === key));
}
function observation(tx: Transaction, now: number, kind: TransitionObservation["kind"],
  actor: TransitionObservation["actor"], componentId: string, deviceId: string | null): void {
  tx.observations.push({ id: randomUUID(), atMs: now, kind, actor, componentId, deviceId });
}
/** Recursive identity invalidation never removes historical components, devices or boots. */
function revokeTree(state: Registry, device: Device, now: number, replaced = false): void {
  device.status = replaced ? "replaced" : "revoked";
  device.revokedAtMs ??= now;
  for (const c of device.credentials) c.revokedAtMs ??= now;
  if (device.current) device.retiredIdentities.push(device.current);
  device.current = null;
  for (const child of state.devices.filter((d) => d.parentDeviceId === device.id && d.status === "active")) revokeTree(state, child, now);
}
function newDevice(state: Registry, componentId: string, key: string, now: number,
  expectedDeviceId: string | null, parentDeviceId: string | null): Device {
  const component = state.components.find((c) => c.id === componentId);
  if (component?.kind !== "module" || !["edge", "pico", "pod"].includes(component.role) ||
    (component.role === "edge") !== (parentDeviceId === null)) fail("DENIED");
  const previous = lastDevice(state, componentId);
  if ((previous?.id ?? null) !== expectedDeviceId || usedKey(state, key)) fail("CONFLICT");
  if (previous?.status === "active" && previous.parentDeviceId !== parentDeviceId) fail("DENIED");
  if (state.devices.length >= 512) fail("CAPACITY");
  if (previous) revokeTree(state, previous, now, true);
  const device: Device = { id: randomUUID(), componentId, role: component.role as Device["role"], status: "active",
    parentDeviceId, replacesDeviceId: expectedDeviceId, enrolledAtMs: now, revokedAtMs: null,
    credentials: [credential(key, now)], current: null, retiredIdentities: [], lastSeenAtMs: null,
    softwareRevision: null, appliedConfigRevision: null, capabilities: [] };
  state.devices.push(device);
  return device;
}
/** Protected configuration/catalog provisioning, never an anonymous bootstrap endpoint. */
export function simulationRegistry(input: unknown, accountId: string): Registry {
  const result = validateConfigurationRecord(input, "configuration");
  if (!result.ok || result.value.executionMode !== "simulation" || result.value.realm.environment === "production" ||
    !isId(accountId) || result.value.components.length > 64) fail("DENIED");
  const config = result.value;
  return { version: VERSION, realm: config.realm, siteId: config.siteId, accountId, configRevision: config.revision,
    hardwareDigest: configurationHardwareDigest(config), components: config.components, signals: config.signals,
    devices: [], challenges: [] };
}
/** Only metric/quality declarations are needed to bound reported capability inventory. */
function allowedCapabilities(state: Registry, componentId: string): Capability[] {
  return configurationCapabilities({ signals: state.signals } as Configuration, componentId);
}
function report(state: Registry, device: Device, payload: Record<string, unknown>): void {
  if (payload.configRevision !== state.configRevision) fail("STALE_CONFIGURATION");
  device.appliedConfigRevision = id(payload.configRevision);
  device.softwareRevision = id(payload.softwareRevision);
  if (!Array.isArray(payload.capabilities) || configurationDigest(payload.capabilities) !==
    configurationDigest(allowedCapabilities(state, device.componentId))) fail("DENIED");
  device.capabilities = structuredClone(payload.capabilities) as Capability[];
}
export function enrollmentProof(realm: Realm, siteId: string, challenge: Challenge) {
  return { version: VERSION, purpose: "commission", realm, siteId, challenge };
}
export function rotationProof(request: Omit<DeviceRequest, "signature">) {
  return { version: VERSION, purpose: "rotate-key", realm: request.realm, siteId: request.siteId,
    deviceId: request.deviceId, credentialId: request.credentialId, sequence: request.sequence,
    publicKey: request.payload.publicKey, overlapMs: request.payload.overlapMs };
}
export function delegationProof(request: Omit<DeviceRequest, "signature">) {
  return { version: VERSION, purpose: "delegate-key", realm: request.realm, siteId: request.siteId,
    deviceId: request.deviceId, credentialId: request.credentialId, sequence: request.sequence,
    componentId: request.payload.componentId, expectedDeviceId: request.payload.expectedDeviceId,
    publicKey: request.payload.publicKey, identity: request.payload.identity };
}
export class EnrollmentService {
  constructor(readonly store: RegistryStore, readonly realm: Realm, readonly now: () => number = Date.now) {
    if (!isRealm(realm) || realm.environment === "production") fail("DENIED");
    this.realm = Object.freeze({ ...realm });
  }
  async human(context: AuthorizedContext, action: string, input: unknown): Promise<unknown> {
    if (context.actor.kind !== "human" || !sameRealm(context.realm, this.realm) || context.expiresAtMs <= this.now() ||
      context.resource.kind !== "site" || context.resource.id !== context.siteId ||
      context.capability !== (action === "inventory" ? "diagnostics.read" : "configuration.write")) fail("DENIED");
    return this.store.transact(this.realm, context.siteId, (tx) => {
      const now = this.now();
      if (context.accountId !== tx.state.accountId || context.expiresAtMs <= now) fail("DENIED");
      const actor = { kind: "human" as const, id: context.actor.id };
      if (action === "inventory") return diagnostics(tx.state);
      if (action === "challenge") {
        shape(input, ["componentId", "publicKey", "expectedDeviceId", "purpose"]);
        const componentId = id(input.componentId);
        const component = tx.state.components.find((c) => c.id === componentId);
        if (component?.kind !== "module" || component.role !== "edge") fail("DENIED");
        const key = publicKey(input.publicKey);
        const expected = input.expectedDeviceId === null ? null : id(input.expectedDeviceId);
        if (!["enroll", "replace", "service-recovery"].includes(String(input.purpose)) ||
          (input.purpose === "enroll") !== (expected === null) ||
          (lastDevice(tx.state, componentId)?.id ?? null) !== expected || usedKey(tx.state, key)) fail("CONFLICT");
        tx.state.challenges = tx.state.challenges.filter((c) => c.expiresAtMs > now);
        if (tx.state.challenges.length >= 32) fail("CAPACITY");
        const challenge: Challenge = { id: randomUUID(), expiresAtMs: now + CHALLENGE_TTL_MS,
          actorId: actor.id, sessionId: context.sessionId, componentId, publicKey: key,
          expectedDeviceId: expected, configRevision: tx.state.configRevision, purpose: input.purpose as Challenge["purpose"] };
        tx.state.challenges.push(challenge);
        observation(tx, now, "challenge-created", actor, componentId, null);
        return { proof: enrollmentProof(this.realm, context.siteId, challenge) };
      }
      if (action === "complete") {
        shape(input, ["challengeId", "signature"]);
        const challenge = tx.state.challenges.find((c) => c.id === id(input.challengeId));
        if (!challenge || challenge.actorId !== actor.id || challenge.sessionId !== context.sessionId) fail("DENIED");
        if (challenge.expiresAtMs <= now) fail("EXPIRED");
        if (challenge.configRevision !== tx.state.configRevision) fail("STALE_CONFIGURATION");
        prove(challenge.publicKey, enrollmentProof(this.realm, context.siteId, challenge), input.signature);
        const device = newDevice(tx.state, challenge.componentId, challenge.publicKey, now, challenge.expectedDeviceId, null);
        tx.state.challenges = tx.state.challenges.filter((c) => c.id !== challenge.id);
        observation(tx, now, challenge.purpose === "enroll" ? "enrolled" : challenge.purpose === "replace" ? "replaced" : "service-recovered",
          actor, device.componentId, device.id);
        return issuance(tx.state, device);
      }
      if (action === "revoke") {
        shape(input, ["deviceId"]);
        const device = tx.state.devices.find((d) => d.id === id(input.deviceId));
        if (!device || device.status !== "active") fail("CONFLICT");
        revokeTree(tx.state, device, now);
        observation(tx, now, "revoked", actor, device.componentId, device.id);
        return { deviceId: device.id, status: device.status };
      }
      return fail("INVALID_REQUEST");
    });
  }
  async device(siteId: string, input: unknown): Promise<unknown> {
    shape(input, ["version", "realm", "siteId", "deviceId", "credentialId", "sequence", "issuedAtMs", "expiresAtMs", "action", "payload", "signature"]);
    if (input.version !== VERSION || !isRealm(input.realm) || !sameRealm(input.realm, this.realm) || input.siteId !== siteId ||
      !isId(siteId) || !isObject(input.payload) || !["connect", "state", "commands", "rotate", "delegate"].includes(String(input.action))) fail("DENIED");
    const request = structuredClone(input) as unknown as DeviceRequest;
    id(request.deviceId); id(request.credentialId); counter(request.sequence); counter(request.issuedAtMs); counter(request.expiresAtMs);
    return this.store.transact(this.realm, siteId, (tx) => {
      const now = this.now();
      if (request.issuedAtMs > now || request.expiresAtMs <= now || request.expiresAtMs - request.issuedAtMs > 30_000) fail("EXPIRED");
      const device = tx.state.devices.find((d) => d.id === request.deviceId);
      const c = device?.credentials.find((c) => c.id === request.credentialId);
      if (!device || !c || device.role !== "edge" || device.status !== "active" || c.revokedAtMs !== null || c.expiresAtMs <= now ||
        (device.parentDeviceId !== null && tx.state.devices.find((d) => d.id === device.parentDeviceId)?.status !== "active")) fail("DENIED");
      const { signature, ...unsigned } = request;
      prove(c.publicKey, unsigned, signature);
      if (request.sequence <= c.lastSequence) fail("CONFLICT");
      const p = request.payload;
      const actor = { kind: "device" as const, id: device.id };
      if (request.action === "connect") {
        shape(p, ["identity", "previousIdentity", "configRevision", "softwareRevision", "capabilities"]);
        const next = identity(p.identity);
        const previous = p.previousIdentity === null ? null : identity(p.previousIdentity);
        if (next.deviceId !== device.id || !sameIdentity(previous, device.current) ||
          device.current?.bootId === next.bootId || device.retiredIdentities.some((prior) => prior.bootId === next.bootId)) fail("STALE_IDENTITY");
        if (device.retiredIdentities.length >= 512) fail("CAPACITY");
        report(tx.state, device, p);
        if (device.current) device.retiredIdentities.push(device.current);
        device.current = next;
        observation(tx, now, "connected", actor, device.componentId, device.id);
      } else {
        if (!sameIdentity(device.current, identity(p.identity)) || device.current === null) fail("STALE_IDENTITY");
        if (device.appliedConfigRevision !== tx.state.configRevision) fail("STALE_CONFIGURATION");
        if (request.action === "state") {
          shape(p, ["identity", "configRevision", "softwareRevision", "capabilities"]);
          report(tx.state, device, p);
          observation(tx, now, "state-admitted", actor, device.componentId, device.id);
        } else if (request.action === "commands") {
          shape(p, ["identity", "configRevision"]);
          if (device.role !== "edge" || p.configRevision !== tx.state.configRevision) fail("DENIED");
          observation(tx, now, "commands-admitted", actor, device.componentId, device.id);
        } else if (request.action === "rotate") {
          shape(p, ["identity", "publicKey", "overlapMs", "newKeyProof"]);
          const key = publicKey(p.publicKey);
          const overlap = counter(p.overlapMs);
          if (device.role !== "edge" || usedKey(tx.state, key) || overlap > MAX_ROTATION_OVERLAP_MS ||
            device.credentials.filter((x) => x.revokedAtMs === null && x.expiresAtMs > now).length !== 1) fail("CONFLICT");
          if (device.credentials.length >= 64) fail("CAPACITY");
          prove(key, rotationProof(unsigned), p.newKeyProof);
          c.expiresAtMs = Math.min(c.expiresAtMs, now + overlap);
          device.credentials.push(credential(key, now));
          observation(tx, now, "rotated", actor, device.componentId, device.id);
        } else if (request.action === "delegate") {
          shape(p, ["identity", "componentId", "expectedDeviceId", "publicKey", "newKeyProof"]);
          if (device.role !== "edge") fail("DENIED");
          const key = publicKey(p.publicKey);
          prove(key, delegationProof(unsigned), p.newKeyProof);
          const child = newDevice(tx.state, id(p.componentId), key, now,
            p.expectedDeviceId === null ? null : id(p.expectedDeviceId), device.id);
          observation(tx, now, "delegated", actor, child.componentId, child.id);
          c.lastSequence = request.sequence;
          device.lastSeenAtMs = now;
          return { ...issuance(tx.state, child), scope: "local-module", cloudPermissions: [] };
        }
      }
      c.lastSequence = request.sequence;
      device.lastSeenAtMs = now;
      if (request.action === "rotate") return issuance(tx.state, device);
      return { deviceId: device.id, identity: device.current, admitted: request.action,
        executionMode: "simulation", actuationEnabled: false, updatesEnabled: false, recordingEnabled: false,
        ...(request.action === "commands" ? { commands: [] } : {}) };
    });
  }
}
function issuance(state: Registry, device: Device) {
  const c = device.credentials.at(-1)!;
  return { realm: state.realm, siteId: state.siteId, componentId: device.componentId, role: device.role,
    parentDeviceId: device.parentDeviceId, configRevision: state.configRevision,
    deviceId: device.id, credentialId: c.id, credentialExpiresAtMs: c.expiresAtMs,
    proofAlgorithm: "Ed25519", executionMode: "simulation" };
}
/** Deliberate projection. Never spread trusted records into an API response/export. */
export function diagnostics(state: Registry) {
  return { version: state.version, realm: state.realm, siteId: state.siteId, configRevision: state.configRevision,
    hardwareDigest: state.hardwareDigest, components: structuredClone(state.components), signals: structuredClone(state.signals),
    devices: state.devices.map((d) => ({ deviceId: d.id, componentId: d.componentId, role: d.role, status: d.status,
      parentDeviceId: d.parentDeviceId, replacesDeviceId: d.replacesDeviceId, enrolledAtMs: d.enrolledAtMs,
      revokedAtMs: d.revokedAtMs, current: d.current, retiredIdentities: structuredClone(d.retiredIdentities), lastSeenAtMs: d.lastSeenAtMs,
      softwareRevision: d.softwareRevision, appliedConfigRevision: d.appliedConfigRevision, capabilities: structuredClone(d.capabilities),
      credentialHistory: d.credentials.map((c) => ({ createdAtMs: c.createdAtMs, expiresAtMs: c.expiresAtMs, revokedAtMs: c.revokedAtMs })) })) };
}
