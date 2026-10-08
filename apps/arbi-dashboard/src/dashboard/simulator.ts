import { randomUUID } from "node:crypto";
import { boundedPlantAdapters, validatePlant } from "@arbi/simulation-core";
import type { Configuration, Event, Realm, Telemetry } from "@arbi/protocol";
import configurationFixture from "../../../../packages/arbi-protocol/fixtures/configuration.json";
import plantFixture from "../../../../packages/arbi-simulation-core/fixtures/plant/1.0/nominal.json";
import type { DashboardState } from "./contracts";

export const simulationSites = [
  { id: "synthetic-site", name: "Synthetic garden" },
  { id: "synthetic-offline", name: "Offline garden" },
  { id: "synthetic-stale", name: "Stale garden" },
  { id: "synthetic-empty", name: "Unenrolled garden" },
] as const;
export function syntheticConfiguration(realm: Realm, siteId: string): Configuration {
  const config = structuredClone(configurationFixture.valid.configuration) as Configuration;
  return { ...config, realm, siteId };
}
/** Bounded committed plant model; no endpoint, device credential or actuator adapter. */
export function createSimulatorRead(realm: Realm, now: () => number = Date.now) {
  if (realm.environment !== "test") throw new Error("INVALID_CONFIGURATION");
  const original = structuredClone(configurationFixture.valid.configuration) as Configuration;
  const plant = validatePlant(plantFixture, original, plantFixture.context.identity.referenceDigest);
  const modules = boundedPlantAdapters(plant, original);
  const source = { deviceId: "synthetic-edge", bootId: randomUUID(), sessionId: randomUUID() };
  let sequence = 0n;
  const frozenAt = now() - 60_000;
  return async (siteId: string): Promise<DashboardState> => {
    if (!simulationSites.some(site => site.id === siteId)) throw new Error("INVALID_CONFIGURATION");
    if (siteId === "synthetic-empty") return { connection: "no-device", observedAtMs: now(), staleAfterMs: 10_000, snapshot: null, telemetry: null };
    const observation = siteId === "synthetic-offline" || siteId === "synthetic-stale" ? frozenAt : now();
    const id = String(++sequence);
    const shared = { protocol: "arbi/1.0" as const, realm, siteId, source, sequence: id, executionMode: "simulation" as const,
      sourceTime: { utc: null, monotonicMs: plant.context.clock.startMs, uncertaintyMs: null }, ingestTime: null };
    const snapshot: Event = { ...shared, messageId: randomUUID(), kind: "event", body: { type: "state.snapshot", state: plant.context.initial.state,
      configRevision: original.revision, capabilitiesRevision: "synthetic-capabilities-1", capabilities: [],
      eventCursor: { source, stream: "event", sequence: id }, telemetryCursor: { source, stream: "telemetry", sequence: id }, committedCursor: null,
      supportedCommands: [], supportedProtocols: ["arbi/1.0"] } };
    // Plant configuration associates lines with site geometry. Wire samples of
    // scalar payout/tension use the protocol's NoFrame, rather than a position frame.
    const samples = modules.feedback(plant.context.clock.startMs).map(sample => sample.metric.startsWith("line.") ?
      { ...sample, frame: { name: "none" as const, revision: null } } : sample);
    const telemetry: Telemetry = { ...shared, messageId: randomUUID(), kind: "telemetry", body: { type: "telemetry.samples", capabilitiesRevision: "synthetic-capabilities-1", samples } };
    return { connection: siteId === "synthetic-offline" ? "offline" : "connected", observedAtMs: observation, staleAfterMs: 10_000, snapshot, telemetry };
  };
}
