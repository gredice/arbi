import {
  admitCommand, advanceOutcome, checkConfiguredCommand, configurationDigest, configurationHardwareDigest,
  createCommandLedger, MAX_SCENARIO_TICKS, SCENARIO_INVARIANTS, scenarioPositionInside, validateScenario,
  type AppliedConfiguration, type CommandGate, type Configuration, type ConfigurationBoundary, type EventBody,
  type Scenario, type ScenarioCheckpoint, type ScenarioInvariant, type ScenarioResult,
} from "@arbi/protocol";
import { referenceTrajectory, seededRandom, simulatedAdapters, type SimulationAdapters } from "./adapters.js";
export * from "./adapters.js";

type State = Extract<EventBody, { type: "state.snapshot" }>["state"];
type Outcome = Extract<EventBody, { type: "command.outcome" }>["outcome"];
export function q6(value: number): number {
  const result = Math.floor(value * 1_000_000 + 0.5);
  if (!Number.isSafeInteger(result)) throw new Error("NUMERIC_LIMIT");
  return result === 0 ? 0 : result;
}
export interface TraceRow extends ScenarioCheckpoint {
  cloudConnected: boolean; driverFault: boolean; powerAvailable: boolean;
  voltageQ6: number | null; panQ6: number; tiltQ6: number; captures: number; randomState: number;
  positionQuality: "estimated"; lengthQuality: "estimated"; origin: "simulated";
  feedback: "unavailable"; outcomes: Array<{ commandId: string; outcome: Outcome; error: string | null }>;
  dispatches: string[];
}
export interface ScenarioRun {
  schemaVersion: Scenario["schemaVersion"]; id: string; identity: Scenario["identity"]; provenance: Scenario["provenance"];
  trace: TraceRow[]; traceDigest: string; invariants: ScenarioInvariant[];
  outcomes: Scenario["expected"]["outcomes"];
}
function configuredBoundary(s: Scenario, config: Configuration): { applied: AppliedConfiguration; boundary: ConfigurationBoundary } {
  return {
    applied: { schemaVersion: config.schemaVersion, configurationDigest: configurationDigest(config), appliedBy: s.gate.receiver,
      request: { schemaVersion: config.schemaVersion, transactionId: "offline-reference", expectedAppliedRevision: null, target: s.gate.receiver, transition: { kind: "apply" }, configuration: config,
        auditContext: { actor: s.gate.actor, authorizationId: "synthetic-offline", correlationId: s.id, reasonCode: "reference-only", previousConfigRevision: null, previousCalibrationRevision: null } } },
    boundary: { receiver: s.gate.receiver, realm: config.realm, siteId: config.siteId, executionMode: "simulation", calibrationScope: "simulation", installedHardwareDigest: configurationHardwareDigest(config), localLimits: config.limits, approvedCalibrationDigests: [configurationDigest(config.calibration)], readableSchemaVersions: [config.schemaVersion], rollbackReadableSchemaVersions: [config.schemaVersion] },
  };
}
/** Pure host orchestration with no wall clock, network, device, provider or environment access. */
export function runScenario(input: unknown, configuration: Configuration, referenceDigest: string, adapters?: SimulationAdapters): ScenarioResult<ScenarioRun> {
  const parsed = validateScenario(input, configuration, referenceDigest);
  if (!parsed.ok) return parsed;
  const s = parsed.value;
  const a = adapters ?? simulatedAdapters(configuration, s.initial, s.clock.startMs);
  if (a.executionMode !== "simulation" || a.time.nowMs() !== s.clock.startMs) return { ok: false, error: { code: "IDENTITY_MISMATCH", path: "/adapters" } };
  const { applied, boundary } = configuredBoundary(s, configuration);
  const ledger = createCommandLedger(256), supported = ["motion.move", "control.stop", "camera.gimbal", "camera.capture"] as const;
  const gate: CommandGate = { realm: configuration.realm, executionMode: "simulation", siteId: configuration.siteId, authenticatedSource: s.gate.source, receiver: s.gate.receiver, nowMonotonicMs: s.clock.startMs, maxDeadlineAheadMs: s.gate.maxDeadlineAheadMs, authorizedActor: s.gate.actor, allowedTypes: [...supported], supportedTypes: [...supported], configRevision: configuration.revision, faultInhibited: s.initial.state === "Fault", lease: { ...s.gate.lease, receiver: s.gate.receiver } };
  const inputs = [...s.inputs].sort((x, y) => x.atMs - y.atMs || x.order - y.order), random = seededRandom(s.seed);
  let state: State = s.initial.state, cloud = s.initial.cloudConnected, randomState = s.seed;
  let active: { id: string; expires: number } | null = null, cursor = 0;
  const history = new Map<string, Outcome[]>(), trace: TraceRow[] = [];
  let rejectedNoDispatch = true, truthfulFeedback = true, withinWorkspace = true, localProgress = true;
  for (let now = s.clock.startMs; now <= s.clock.startMs + s.clock.durationMs; now += s.clock.stepMs) {
    a.time.advanceTo(now); gate.nowMonotonicMs = now;
    const outcomes: TraceRow["outcomes"] = [], dispatches: string[] = [];
    function outcome(id: string, next: Outcome, error: string | null = null): void {
      const previous = history.get(id) ?? [];
      const valid = advanceOutcome(previous.at(-1) ?? null, next);
      if (!valid.ok) throw new Error("INVALID_TRANSITION");
      previous.push(next); history.set(id, previous); outcomes.push({ commandId: id, outcome: next, error });
    }
    function stopActive(error: string): void {
      a.motors.stop();
      if (active) outcome(active.id, "failed", error);
      active = null;
    }
    if (active && now >= active.expires) { stopActive("DEADLINE_EXPIRED"); state = "Ready"; }
    const before = a.motors.positionEstimateMm();
    if (a.motors.advance(now) && active) { outcome(active.id, "completed"); active = null; state = "Ready"; }
    if (!cloud && state === "Moving" && configurationDigest(before) === configurationDigest(a.motors.positionEstimateMm()) && now > s.clock.startMs) localProgress = false;
    while (cursor < inputs.length && inputs[cursor].atMs === now) {
      const event = inputs[cursor++];
      if (event.kind === "cloud") { cloud = event.connected; continue; }
      if (event.kind === "voltage-noise") {
        randomState = random(); const voltage = a.power.voltageEstimateV();
        if (voltage !== null) a.power.set(true, Math.max(0, voltage + (2 * randomState / 4294967296 - 1) * event.amplitudeV));
        continue;
      }
      if (event.kind === "power" || event.kind === "driver-fault") {
        if (event.kind === "power") a.power.set(event.available, event.voltageV);
        else a.motors.setFault(event.active);
        if (!a.power.available() || a.motors.faulted()) { stopActive("FAULT_INHIBITED"); state = "Fault"; }
        // Removing a disturbance never clears a latched local fault.
        continue;
      }
      const m = event.message, id = m.command.commandId;
      // Repeated commands return cached admission without a second lifecycle or dispatch.
      const candidate = structuredClone(ledger);
      gate.faultInhibited = state === "Fault";
      const admitted = admitCommand(m, gate, candidate);
      let error: string | null = admitted.ok ? null : admitted.error.code;
      if (admitted.ok && admitted.value.decision === "duplicate") continue;
      const configured = checkConfiguredCommand(m, applied, boundary);
      if (error === null && !configured.ok) error = configured.error.code;
      if (error === null && !cloud && m.body.type !== "control.stop") error = "EXECUTION_FAILED";
      if (error === null && m.body.type !== "control.stop" && state !== "Ready" && state !== "Parked") error = "INVALID_TRANSITION";
      let duration = 0;
      if (error === null && m.body.type === "motion.move") {
        const p = a.motors.positionEstimateMm(), t = m.body.positionMm;
        const distance = Math.sqrt((t.x - p.x) ** 2 + (t.y - p.y) ** 2 + (t.z - p.z) ** 2);
        duration = Math.max(s.clock.stepMs, Math.ceil(distance / m.body.maxSpeedMmPerS * 1000 / s.clock.stepMs) * s.clock.stepMs);
        if (duration > m.body.maxDurationMs || now + duration >= m.command.deadline.expiresMonotonicMs) error = "OUTSIDE_LIMITS";
      }
      // A rejected retry with an existing ID is a diagnostic, not another command lifecycle.
      if (history.has(id)) { outcomes.push({ commandId: id, outcome: "rejected", error: error ?? "IDEMPOTENCY_CONFLICT" }); continue; }
      outcome(id, "requested");
      const count = dispatches.length;
      if (error !== null) { outcome(id, "rejected", error); rejectedNoDispatch &&= dispatches.length === count; continue; }
      ledger.receipts = candidate.receipts; ledger.sequenceBySource = candidate.sequenceBySource;
      outcome(id, "accepted"); outcome(id, "running"); dispatches.push(id);
      if (m.body.type === "motion.move") {
        a.motors.move(m.body.positionMm, duration, now); active = { id, expires: m.command.deadline.expiresMonotonicMs }; state = "Moving";
      } else {
        if (m.body.type === "control.stop") { if (active) { a.motors.stop(); outcome(active.id, "cancelled"); active = null; } if (state !== "Fault") state = "Ready"; }
        else if (m.body.type === "camera.gimbal" || m.body.type === "camera.capture") a.pod.execute(m.body);
        outcome(id, "completed");
      }
    }
    const p = a.motors.positionEstimateMm(), gimbal = a.pod.gimbalCommandedDeg();
    withinWorkspace &&= scenarioPositionInside(p, configuration);
    truthfulFeedback &&= a.sensors.read(now).every((sample) => sample.quality === "unavailable" && sample.value === null && sample.sampleMonotonicMs === null);
    truthfulFeedback &&= Object.values(a.sensors.readLocalInputs(now)).every((sample) => sample.quality === "unavailable" && sample.value === null);
    const lengths = Object.fromEntries(configuration.geometry.anchors.map((anchor) => [anchor.line, q6(Math.sqrt((anchor.positionMm.x - p.x) ** 2 + (anchor.positionMm.y - p.y) ** 2 + (anchor.positionMm.z - p.z) ** 2) + configuration.calibration!.lineLengthOffsetsMm[anchor.line])])) as TraceRow["lengthQ6"];
    trace.push({ atMs: now, state, positionQ6: { x: q6(p.x), y: q6(p.y), z: q6(p.z) }, lengthQ6: lengths, cloudConnected: cloud, driverFault: a.motors.faulted(), powerAvailable: a.power.available(), voltageQ6: a.power.voltageEstimateV() === null ? null : q6(a.power.voltageEstimateV()!), panQ6: q6(gimbal.pan), tiltQ6: q6(gimbal.tilt), captures: a.pod.simulatedCaptureCount(), randomState, positionQuality: "estimated", lengthQuality: "estimated", origin: "simulated", feedback: "unavailable", outcomes, dispatches });
  }
  const values = [withinWorkspace, truthfulFeedback, rejectedNoDispatch, localProgress, trace.length <= MAX_SCENARIO_TICKS];
  const invariants = SCENARIO_INVARIANTS.map((id, i) => ({ id, passed: values[i] }));
  const identityTrace = { schemaVersion: s.schemaVersion, identity: s.identity, provenance: s.provenance, clock: s.clock, seed: s.seed, trace, invariants };
  return { ok: true, value: { schemaVersion: s.schemaVersion, id: s.id, identity: s.identity, provenance: s.provenance, trace, traceDigest: configurationDigest(identityTrace), invariants, outcomes: [...history].map(([commandId, outcomes]) => ({ commandId, outcomes })) } };
}
/** Verify analytical vectors and expectations against independently derived run results. */
export function checkScenarioExpected(s: Scenario, run: ScenarioRun): void {
  const same = (a: unknown, b: unknown): void => { if (configurationDigest(a) !== configurationDigest(b)) throw new Error("RESULT_MISMATCH"); };
  for (const vector of s.trajectories) {
    const actual = referenceTrajectory(vector.startMm, vector.targetMm, vector.durationMs, vector.elapsedMs);
    for (const axis of ["x", "y", "z"] as const) if (Math.abs(actual[axis] - vector.expectedPositionMm[axis]) > 1e-7 + 1e-12 * Math.abs(vector.expectedPositionMm[axis])) throw new Error("RESULT_MISMATCH");
  }
  for (const v of s.transitions) { const actual = advanceOutcome(v.current, v.next); same(actual.ok ? actual.value : actual.error.code, v.expected); }
  same(s.expected.invariants, run.invariants); same(s.expected.traceDigest, run.traceDigest); same(s.expected.outcomes, run.outcomes);
  for (const checkpoint of s.expected.checkpoints) {
    const row = run.trace.find((r) => r.atMs === checkpoint.atMs);
    same(checkpoint, row && { atMs: row.atMs, state: row.state, positionQ6: row.positionQ6, lengthQ6: row.lengthQ6 });
  }
}
