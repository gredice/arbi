import { admitCommand, advanceOutcome, checkConfiguredCommand, configurationDigest, createCommandLedger, MAX_SCENARIO_TICKS, scenarioPositionInside, type CommandGate, type Configuration, type EventBody } from "@arbi/protocol";
import { numericTreeQ6, q6 } from "./numeric.js";
import { configuredBoundary } from "./scenario-boundary.js";
import { boundedPlantAdapters, cableLengths, checkPlantMove, drumMapping } from "./plant-adapters.js";
import { LINES, PLANT_ASSUMPTIONS, PLANT_FIDELITY, PLANT_VERSION, type PlantRow, type PlantRun, type PlantScenario, type PlantState } from "./plant-types.js";
import { validatePlant } from "./plant-validation.js";

type Outcome = Extract<EventBody, { type: "command.outcome" }>["outcome"];
/** Synthetic host runner only. Shared protocol admission precedes every module dispatch. */
export function runPlant(input: unknown, config: Configuration, referenceDigest: string): PlantRun {
  const p = validatePlant(input, config, referenceDigest), c = p.context;
  const modules = boundedPlantAdapters(p, config), { applied, boundary } = configuredBoundary(c, config);
  const ledger = createCommandLedger(256), history = new Map<string, Outcome[]>();
  const gate: CommandGate = { ...c.gate, realm: config.realm, siteId: config.siteId, executionMode: "simulation", authenticatedSource: c.gate.source,
    nowMonotonicMs: c.clock.startMs, authorizedActor: c.gate.actor, allowedTypes: ["motion.move", "control.stop", "camera.gimbal", "camera.capture"], supportedTypes: ["motion.move", "control.stop", "camera.gimbal", "camera.capture"], configRevision: config.revision, faultInhibited: c.initial.state === "Fault", lease: { ...c.gate.lease, receiver: c.gate.receiver } };
  let state: PlantState = c.initial.state, cloud = c.initial.cloudConnected, cursor = 0;
  let active: { id: string; deadline: number; maxUntil: number; capturePose: string | null; kind: "motion.move" | "camera.gimbal" | "camera.capture"; returning: boolean; dockUntil: number | null; sawDockFalse: boolean; dockTrueAt: number | null } | null = null;
  // A Parked starting label cannot establish dock evidence.
  if (state === "Parked") state = "Ready";
  const events = [...p.inputs].sort((a, b) => a.atMs - b.atMs || a.order - b.order), trace: PlantRow[] = [];
  const invariants: PlantRun["invariants"] = { withinWorkspace: true, truthfulFeedback: true, independentDock: true, captureStationary: true, boundedTrace: true };
  for (let now = c.clock.startMs; now <= c.clock.startMs + c.clock.durationMs; now += c.clock.stepMs) {
    gate.nowMonotonicMs = now;
    const outcomes: PlantRow["outcomes"] = [], dispatches: string[] = [];
    const outcome = (id: string, next: Outcome, error: string | null = null): void => {
      const h = history.get(id) ?? []; if (!advanceOutcome(h.at(-1) ?? null, next).ok) throw new Error("INVALID_TRANSITION");
      h.push(next); history.set(id, h); outcomes.push({ commandId: id, outcome: next, error });
    };
    const stop = (error: string, fault: boolean): void => {
      modules.motion.stop(); modules.camera.stop(); if (active) outcome(active.id, "failed", error); active = null; state = fault ? "Fault" : "Ready";
    };
    if (active && (now >= active.deadline || now > active.maxUntil)) stop("DEADLINE_EXPIRED", true);
    // Events (including local protection) precede module progress; a fault at completion prevents completion.
    while (cursor < events.length && events[cursor].atMs === now) {
      const e = events[cursor++];
      if (e.kind === "cloud") { cloud = e.connected; continue; }
      if (e.kind !== "command") {
        modules.disturb(e);
        const limit = modules.sensors.read(now).limit;
        if (modules.driverFaulted() || !modules.power.healthy() || limit.value === true) stop("FAULT_INHIBITED", true);
        continue;
      }
      const m = e.message, id = m.command.commandId, candidate = structuredClone(ledger);
      gate.faultInhibited = state === "Fault";
      const admitted = admitCommand(m, gate, candidate);
      if (admitted.ok && admitted.value.decision === "duplicate") continue;
      let error: string | null = admitted.ok ? null : admitted.error.code;
      const configured = checkConfiguredCommand(m, applied, boundary);
      if (error === null && !configured.ok) error = configured.error.code;
      if (error === null && m.body.type !== "control.stop") {
        if (!cloud) error = "EXECUTION_FAILED";
        else if (active || state !== "Ready") error = "INVALID_TRANSITION";
        else if (!modules.power.ready(now) || modules.driverFaulted() || (m.body.type === "camera.gimbal" || m.body.type === "camera.capture") && !modules.camera.ready(now)) error = "FAULT_INHIBITED";
        else if (m.body.type === "camera.capture" && !modules.camera.settled(now)) error = "INVALID_TRANSITION";
      }
      if (error === null && m.body.type === "motion.move") {
        try {
          checkPlantMove(modules.motion.positionEstimateMm(), m.body.positionMm, m.body.maxSpeedMmPerS, p, config);
          if (p.returnCommandIds.includes(id) && !nearDock(m.body.positionMm, p)) error = "OUTSIDE_LIMITS";
        } catch { error = "OUTSIDE_LIMITS"; }
      }
      if (history.has(id)) { outcomes.push({ commandId: id, outcome: "rejected", error: error ?? "IDEMPOTENCY_CONFLICT" }); continue; }
      outcome(id, "requested");
      if (error !== null) { outcome(id, "rejected", error); continue; }
      // Bound declared worst-case duration before drawing random latency or touching a module.
      let worst = 0;
      if (m.body.type === "motion.move") {
        const start = modules.motion.positionEstimateMm(), t = m.body.positionMm;
        worst = grid(Math.sqrt((t.x - start.x) ** 2 + (t.y - start.y) ** 2 + (t.z - start.z) ** 2) / m.body.maxSpeedMmPerS * 1000, p, true) + grid(p.parameters.motor.delayMs + p.parameters.motor.jitterMs, p);
        if (p.returnCommandIds.includes(id)) worst += p.parameters.dock.timeoutMs;
      } else if (m.body.type === "camera.gimbal") {
        const g = modules.camera.gimbalCommandedDeg();
        worst = grid(Math.max(Math.abs(m.body.panDeg - g.pan), Math.abs(m.body.tiltDeg - g.tilt)) / p.parameters.gimbal.rateDegPerS * 1000, p) + grid(p.parameters.gimbal.delayMs + p.parameters.gimbal.jitterMs, p) + grid(p.parameters.gimbal.settleMs, p);
      } else if (m.body.type === "camera.capture") worst = grid(p.parameters.camera.delayMs + p.parameters.camera.jitterMs, p, true);
      if (m.body.type !== "control.stop" && ("maxDurationMs" in m.body && worst > m.body.maxDurationMs || now + worst >= m.command.deadline.expiresMonotonicMs)) { outcome(id, "rejected", "OUTSIDE_LIMITS"); continue; }
      ledger.receipts = candidate.receipts; ledger.sequenceBySource = candidate.sequenceBySource;
      outcome(id, "accepted"); outcome(id, "running"); dispatches.push(id);
      if (m.body.type === "control.stop") {
        modules.motion.stop(); modules.camera.stop(); if (active) outcome(active.id, "cancelled"); active = null;
        if (state !== "Fault") state = "Ready"; outcome(id, "completed");
      } else if (m.body.type === "motion.move" || m.body.type === "camera.gimbal" || m.body.type === "camera.capture") {
        const returning = p.returnCommandIds.includes(id);
        const duration = m.body.type === "motion.move" ? modules.motion.move(m.body.positionMm, m.body.maxSpeedMmPerS, now) : modules.camera.execute(m.body, now);
        active = { id, kind: m.body.type, deadline: m.command.deadline.expiresMonotonicMs, maxUntil: now + m.body.maxDurationMs, capturePose: m.body.type === "camera.capture" ? configurationDigest(modules.motion.positionEstimateMm()) : null, returning,
          dockUntil: returning ? now + duration + p.parameters.dock.timeoutMs : null, sawDockFalse: false, dockTrueAt: null };
        state = m.body.type === "motion.move" ? returning ? "Returning" : "Moving" : m.body.type === "camera.gimbal" ? "Settling" : "Capturing";
      }
    }
    const sensors = modules.sensors.read(now);
    if (modules.driverFaulted() || !modules.power.healthy() || sensors.limit.value === true) stop("FAULT_INHIBITED", true);
    if (active) {
      if (active.returning) {
        if (sensors.dock.value === false) { active.sawDockFalse = true; active.dockTrueAt = null; }
        // Fresh true transition after a false observation; repeated true events do not restart debounce.
        if (state === "Docking" && sensors.dock.value === true && active.sawDockFalse && active.dockTrueAt === null && sensors.dock.sampleMonotonicMs! >= now) active.dockTrueAt = now;
      }
      const progress = active.kind === "motion.move" ? modules.motion.advance(now) : modules.camera.advance(now);
      if (progress.error) stop(progress.error, true);
      else if (active && progress.complete) {
        if (active.returning) state = "Docking";
        else { if (active.kind === "camera.capture") invariants.captureStationary &&= active.capturePose === configurationDigest(modules.motion.positionEstimateMm()) && state === "Capturing"; outcome(active.id, "completed"); active = null; state = "Ready"; }
      }
      if (active?.returning && state === "Docking") {
        if (sensors.dock.value === true && active.dockTrueAt !== null && now - active.dockTrueAt >= p.parameters.dock.debounceMs && nearDock(modules.motion.positionEstimateMm(), p)) {
          outcome(active.id, "completed"); active = null; state = "Parked";
        } else if (now >= active.dockUntil!) stop("DOCK_TIMEOUT", true);
      }
    }
    if (state === "Parked" && sensors.dock.value !== true) stop("DOCK_CONFIRMATION_LOST", true);
    const position = modules.motion.positionEstimateMm(), noisy = modules.noisyPositionMm(), lengths = cableLengths(position, config);
    const g = modules.camera.gimbalCommandedDeg();
    const feedback = modules.feedback(now).map(({ value, ...s }) => ({ ...s, valueQ6: value === null ? null : q6(value) }));
    invariants.withinWorkspace &&= scenarioPositionInside(position, config);
    invariants.truthfulFeedback &&= feedback.every((s) => s.quality !== "measured" && (s.quality !== "unavailable" || s.valueQ6 === null)) && Object.values(sensors).every((s) => s.quality !== "measured");
    invariants.independentDock &&= state !== "Parked" || sensors.dock.origin === "virtual-input" && sensors.dock.value === true;
    invariants.captureStationary &&= state !== "Capturing" || active?.kind === "camera.capture";
    trace.push({ atMs: now, state, positionQ6: vectorQ6(position), virtualPositionQ6: vectorQ6(noisy),
      lines: Object.fromEntries(LINES.map((line) => { const map = drumMapping(lengths[line], p.parameters.drums[line]); return [line, { lengthQ6: q6(lengths[line]), steps: map.steps, reconstructedPayoutQ6: q6(map.reconstructedPayoutMm) }]; })) as PlantRow["lines"],
      positionQuality: "estimated", lengthQuality: "estimated", drumQuality: "estimated", gimbalQuality: "commanded", voltageQuality: modules.power.voltageEstimateV() === null ? "unavailable" : "estimated", virtualPositionOrigin: "simulated", origin: "simulated", encoderFeedback: "unavailable", feedback, localInputs: sensors,
      powerReady: modules.power.ready(now), voltageQ6: modules.power.voltageEstimateV() === null ? null : q6(modules.power.voltageEstimateV()!), gimbalCommandQ6: { pan: q6(g.pan), tilt: q6(g.tilt) }, captures: modules.camera.captureCount(), randomState: modules.randomState(), outcomes, dispatches });
  }
  invariants.boundedTrace = trace.length <= MAX_SCENARIO_TICKS;
  const report: Omit<PlantRun, "traceDigest"> = { schemaVersion: PLANT_VERSION, fidelity: PLANT_FIDELITY, evidence: "synthetic-host-reference" as const, identity: c.identity, parameters: p.parameters, assumptions: [...PLANT_ASSUMPTIONS], trace, invariants };
  return { ...report, traceDigest: configurationDigest({ ...report, parameters: numericTreeQ6(p.parameters), seed: c.seed, clock: c.clock, returnCommandIds: p.returnCommandIds }) };
}
function grid(ms: number, p: PlantScenario, minimum = false): number { return Math.max(minimum ? p.context.clock.stepMs : 0, Math.ceil(ms / p.context.clock.stepMs) * p.context.clock.stepMs); }
function vectorQ6(v: { x: number; y: number; z: number }) { return { x: q6(v.x), y: q6(v.y), z: q6(v.z) }; }
function nearDock(v: { x: number; y: number; z: number }, p: PlantScenario): boolean {
  const d = p.parameters.dock; return Math.sqrt((v.x - d.positionMm.x) ** 2 + (v.y - d.positionMm.y) ** 2 + (v.z - d.positionMm.z) ** 2) <= d.toleranceMm;
}
export function checkPlantExpected(p: PlantScenario, run: PlantRun): void {
  if (p.expected.traceDigest !== run.traceDigest || Object.values(run.invariants).some((v) => !v)) throw new Error("RESULT_MISMATCH");
  for (const e of p.expected.states) { const row = run.trace.find((r) => r.atMs === e.atMs); if (!row || row.state !== e.state || row.captures !== e.captures) throw new Error("RESULT_MISMATCH"); }
}
