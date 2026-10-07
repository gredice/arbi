import { isId, isObject } from "@arbi/gredice";
import type { AuthorizedContext } from "@arbi/gredice";
import type { AuditEvent, Command, Event, Identity } from "@arbi/protocol";

export class JobError extends Error {
  constructor(readonly code: "INVALID_REQUEST" | "DENIED" | "CONFLICT" | "STALE_FENCE" | "EXPIRED" | "CLOCK_UNCERTAIN" | "UNAVAILABLE" | "CAPACITY") {
    super(code); this.name = "JobError";
  }
}
export interface ControlLease {
  id: string; fence: string; authority: AuthorizedContext; target: Identity; configRevision: string;
  expiresAtMs: number; expiresMonotonicMs: number; endedAtMs: number | null; intent: AuditEvent;
}
export interface Job {
  id: string; authority: AuthorizedContext; command: Command; intent: AuditEvent; expiresAtMs: number;
  cloudDisposition: "admitted" | "expired" | "lease-lost" | "authority-lost" | "receiver-changed" | "clock-uncertain" | "cancel-requested";
  deviceStatus: "accepted" | "running" | "completed" | "rejected" | "failed" | "cancelled" | null;
  terminal: Event | null;
}
/** Re-read the trusted current directory/resource boundary for the persisted actor/session. Never accept browser claims. */
export type CurrentAuthority = (previous: AuthorizedContext, signal: AbortSignal) => Promise<AuthorizedContext | null>;
export function exact(input: unknown, keys: string[]): asserts input is Record<string, unknown> {
  if (!isObject(input) || Object.keys(input).sort().join(",") !== keys.sort().join(",")) throw new JobError("INVALID_REQUEST");
}
export function id(input: unknown): asserts input is string { if (!isId(input)) throw new JobError("INVALID_REQUEST"); }
export function milliseconds(input: unknown, min: number, max: number): asserts input is number {
  if (typeof input !== "number" || !Number.isSafeInteger(input) || input < min || input > max) throw new JobError("INVALID_REQUEST");
}
export const commandActions = { "motion.move": "motion.move", "camera.gimbal": "gimbal.move", "camera.capture": "capture.request", "control.stop": "control.stop" } as const;
