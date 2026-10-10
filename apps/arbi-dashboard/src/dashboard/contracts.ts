import type { Capability } from "@arbi/gredice";
import type { CommissioningStatus, Event, Realm, Sample, Telemetry } from "@arbi/protocol";
import type { AvailableRelease } from "../releases/catalog";

export const DASHBOARD_VERSION = "arbi.dashboard/1.0";
export type DashboardMode = "user" | "engineering";
export interface DashboardSite { id: string; name: string }
export interface DashboardState {
  observedAtMs: number;
  connection: "connected" | "offline" | "no-device";
  snapshot: Event | null;
  telemetry: Telemetry | null;
  staleAfterMs: number;
}
export interface DashboardContext {
  version: typeof DASHBOARD_VERSION;
  realm: Realm;
  executionMode: "simulation" | "hardware";
  site: DashboardSite;
  sites: DashboardSite[];
  identity: { actorId: string; accountId: string; sessionId: string; expiresAtMs: number };
  capabilities: Capability[];
  state: DashboardState;
  configuration: { revision: string; schemaVersion: string } | null;
  releases?: AvailableRelease[];
  commissioning?: CommissioningStatus | null;
}
export type DashboardResult = { ok: true; context: DashboardContext } |
  { ok: false; status: number; error: string };
export function freshness(state: DashboardState, now: number): "fresh" | "stale" | "unavailable" {
  if (!state.snapshot) return "unavailable";
  return now < state.observedAtMs || now - state.observedAtMs >= state.staleAfterMs ? "stale" : "fresh";
}
export function displayedSample(sample: Sample, state: DashboardState, now: number): Sample {
  if (sample.quality === "unavailable" || sample.quality === "stale" || freshness(state, now) === "fresh") return sample;
  return { ...sample, quality: "stale", originQuality: sample.quality, reason: "expired" };
}
