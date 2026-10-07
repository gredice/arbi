import type { Capability, ConfigurationComponent, ConfigurationSignal, Identity, Realm } from "@arbi/protocol";

export const VERSION = "arbi.enrollment/1.0";
export const CHALLENGE_TTL_MS = 120_000;
export const MAX_ROTATION_OVERLAP_MS = 300_000;
export const CREDENTIAL_TTL_MS = 86_400_000;
export type Failure = "INVALID_REQUEST" | "DENIED" | "CONFLICT" | "STALE_IDENTITY" | "STALE_CONFIGURATION" |
  "EXPIRED" | "UNAVAILABLE" | "CAPACITY";
export class EnrollmentError extends Error {
  constructor(readonly code: Failure) { super(code); this.name = "EnrollmentError"; }
}
export interface Credential {
  id: string;
  /** Ed25519 public key only. The device's private key never crosses this boundary. */
  publicKey: string;
  createdAtMs: number;
  expiresAtMs: number;
  revokedAtMs: number | null;
  lastSequence: number;
}
export interface Device {
  id: string;
  componentId: string;
  role: "edge" | "pico" | "pod";
  status: "active" | "revoked" | "replaced";
  parentDeviceId: string | null;
  replacesDeviceId: string | null;
  enrolledAtMs: number;
  revokedAtMs: number | null;
  credentials: Credential[];
  current: Identity | null;
  retiredIdentities: Identity[];
  lastSeenAtMs: number | null;
  softwareRevision: string | null;
  appliedConfigRevision: string | null;
  capabilities: Capability[];
}
export interface Challenge {
  id: string;
  expiresAtMs: number;
  actorId: string;
  sessionId: string;
  componentId: string;
  publicKey: string;
  expectedDeviceId: string | null;
  configRevision: string;
  purpose: "enroll" | "replace" | "service-recovery";
}
export interface Registry {
  version: typeof VERSION;
  realm: Realm;
  siteId: string;
  accountId: string;
  configRevision: string;
  hardwareDigest: string;
  components: ConfigurationComponent[];
  signals: ConfigurationSignal[];
  devices: Device[];
  challenges: Challenge[];
}
export interface DeviceRequest {
  version: typeof VERSION;
  realm: Realm;
  siteId: string;
  deviceId: string;
  credentialId: string;
  sequence: number;
  issuedAtMs: number;
  expiresAtMs: number;
  action: "connect" | "state" | "commands" | "rotate" | "delegate";
  payload: Record<string, unknown>;
  signature: string;
}
/** Domain transition evidence, distinct from authorization and actuator effects. */
export interface TransitionObservation {
  id: string;
  atMs: number;
  kind: "enrolled" | "replaced" | "service-recovered" | "revoked" | "rotated" | "connected" |
    "state-admitted" | "commands-admitted" | "delegated" | "challenge-created";
  actor: { kind: "human" | "device"; id: string };
  deviceId: string | null;
  componentId: string;
}
export interface Transaction {
  state: Registry;
  observations: TransitionObservation[];
}
export interface RegistryStore {
  transact<T>(realm: Realm, siteId: string, work: (transaction: Transaction) => T): Promise<T>;
}
