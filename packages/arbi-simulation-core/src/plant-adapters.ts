import { scenarioPositionInside, type Configuration, type Sample, type VectorMm } from "@arbi/protocol";
import { referenceTrajectory, seededRandom } from "./adapters.js";
import { LINES, type DrumParameters, type InputReading, type Line, type LocalInput, type PlantScenario, type SimulatedPlantModules } from "./plant-types.js";

export function cableLengths(position: VectorMm, config: Configuration): Record<Line, number> {
  if (!config.calibration || Object.values(position).some((v) => !Number.isFinite(v))) throw new Error("INVALID_GEOMETRY");
  return Object.fromEntries(config.geometry.anchors.map((a) => [a.line,
    Math.sqrt((a.positionMm.x - position.x) ** 2 + (a.positionMm.y - position.y) ** 2 + (a.positionMm.z - position.z) ** 2) + config.calibration!.lineLengthOffsetsMm[a.line],
  ])) as Record<Line, number>;
}
/** Signed absolute pulse estimate from a synthetic home reference. Never an encoder observation. */
export function drumMapping(payoutMm: number, d: DrumParameters): { steps: number; reconstructedPayoutMm: number } {
  if (!Number.isFinite(payoutMm) || payoutMm < d.minPayoutMm || payoutMm > d.maxPayoutMm || !Number.isFinite(d.radiusMm) || d.radiusMm <= 0 || !Number.isSafeInteger(d.stepsPerRevolution) || d.stepsPerRevolution < 1 || ![1, -1].includes(d.direction)) throw new Error("OUTSIDE_LIMITS");
  const mmPerStep = 2 * Math.PI * d.radiusMm / d.stepsPerRevolution;
  const steps = Math.floor((payoutMm - d.zeroPayoutMm) / mmPerStep * d.direction + 0.5);
  if (!Number.isSafeInteger(steps)) throw new Error("NUMERIC_LIMIT");
  return { steps: steps === 0 ? 0 : steps, reconstructedPayoutMm: d.zeroPayoutMm + steps * d.direction * mmPerStep };
}
/** Check entire affine segment: closest point to each anchor and the convex endpoint maximum. */
export function checkPlantMove(start: VectorMm, target: VectorMm, speed: number, p: PlantScenario, c: Configuration): void {
  if (!scenarioPositionInside(start, c) || !scenarioPositionInside(target, c) || !Number.isFinite(speed) || speed <= 0 || speed > c.limits.maxSpeedMmPerS) throw new Error("OUTSIDE_LIMITS");
  const delta = { x: target.x - start.x, y: target.y - start.y, z: target.z - start.z };
  const squared = delta.x ** 2 + delta.y ** 2 + delta.z ** 2;
  for (const a of c.geometry.anchors) {
    const d = p.parameters.drums[a.line];
    const f = squared === 0 ? 0 : Math.max(0, Math.min(1, ((a.positionMm.x - start.x) * delta.x + (a.positionMm.y - start.y) * delta.y + (a.positionMm.z - start.z) * delta.z) / squared));
    const closest = { x: start.x + delta.x * f, y: start.y + delta.y * f, z: start.z + delta.z * f };
    for (const point of [start, target, closest]) drumMapping(cableLengths(point, c)[a.line], d);
    // |d cable length/dt| <= Cartesian speed; conservative driver rate check.
    if (speed * d.stepsPerRevolution / (2 * Math.PI * d.radiusMm) > d.maxStepRatePerS) throw new Error("OUTSIDE_LIMITS");
  }
}
export function boundedPlantAdapters(p: PlantScenario, config: Configuration): SimulatedPlantModules {
  const a = p.parameters, step = p.context.clock.stepMs;
  let position = structuredClone(p.context.initial.positionMm), randomState = p.context.seed;
  const random = seededRandom(randomState);
  const draw = (): number => { randomState = random(); return randomState / 4294967296; };
  const grid = (ms: number): number => Math.ceil(ms / step) * step;
  const delay = (base: number, jitter: number): number => grid(base + Math.floor(draw() * (jitter + 1)));
  let enabled = a.motor.enabled, fault = p.context.initial.driverFault, stall = false, cameraFault = false;
  let available = p.context.initial.powerAvailable, voltage = p.context.initial.voltageV, bootAt = p.context.clock.startMs + grid(a.power.bootMs);
  const powered = (): boolean => available && voltage >= a.power.minVoltageV && voltage <= a.power.maxVoltageV;
  const ready = (at: number): boolean => powered() && at >= bootAt;
  let movement: { start: VectorMm; target: VectorMm; at: number; duration: number } | null = null;
  let pan = p.context.initial.panDeg, tilt = p.context.initial.tiltDeg, captures = 0;
  let settleUntil = p.context.clock.startMs;
  let operation: { kind: "camera.gimbal" | "camera.capture"; end: number } | null = null;
  const inputs: Record<LocalInput, { value: boolean | null; at: number | null }> = {
    home: { value: null, at: null }, limit: { value: null, at: null }, dock: { value: null, at: null },
  };
  for (const line of LINES) drumMapping(cableLengths(position, config)[line], a.drums[line]);
  return {
    executionMode: "simulation",
    motion: {
      move(target, speed, at) {
        if (!enabled || fault || !ready(at) || movement) throw new Error("FAULT_INHIBITED");
        checkPlantMove(position, target, speed, p, config);
        const distance = Math.sqrt((target.x - position.x) ** 2 + (target.y - position.y) ** 2 + (target.z - position.z) ** 2);
        const latency = delay(a.motor.delayMs, a.motor.jitterMs), duration = Math.max(step, grid(distance / speed * 1000));
        movement = { start: structuredClone(position), target: structuredClone(target), at: at + latency, duration };
        return latency + duration;
      },
      advance(at) {
        if (!movement) return { complete: false, error: null };
        if (!enabled || fault || !ready(at)) { movement = null; return { complete: false, error: "FAULT_INHIBITED" }; }
        if (stall || at < movement.at) return { complete: false, error: null };
        position = referenceTrajectory(movement.start, movement.target, movement.duration, at - movement.at);
        if (at - movement.at < movement.duration) return { complete: false, error: null };
        movement = null; return { complete: true, error: null };
      },
      stop() { movement = null; }, positionEstimateMm: () => structuredClone(position),
    },
    camera: {
      ready: (at) => ready(at) && !cameraFault, settled: (at) => at >= settleUntil,
      execute(body, at) {
        if (!ready(at) || cameraFault || operation) throw new Error("FAULT_INHIBITED");
        let duration: number;
        if (body.type === "camera.gimbal") {
          if (body.panDeg < config.limits.panDeg.min || body.panDeg > config.limits.panDeg.max || body.tiltDeg < config.limits.tiltDeg.min || body.tiltDeg > config.limits.tiltDeg.max) throw new Error("OUTSIDE_LIMITS");
          duration = delay(a.gimbal.delayMs, a.gimbal.jitterMs) + grid(Math.max(Math.abs(body.panDeg - pan), Math.abs(body.tiltDeg - tilt)) / a.gimbal.rateDegPerS * 1000) + grid(a.gimbal.settleMs);
          pan = body.panDeg; tilt = body.tiltDeg; settleUntil = at + duration;
        } else { if (at < settleUntil) throw new Error("INVALID_TRANSITION"); duration = Math.max(step, delay(a.camera.delayMs, a.camera.jitterMs)); }
        operation = { kind: body.type, end: at + duration }; return duration;
      },
      advance(at) {
        if (!operation) return { complete: false, error: null };
        if (!ready(at) || cameraFault) { operation = null; return { complete: false, error: "EXECUTION_FAILED" }; }
        if (at < operation.end) return { complete: false, error: null };
        if (operation.kind === "camera.capture") captures++;
        operation = null; return { complete: true, error: null };
      },
      stop() { operation = null; }, gimbalCommandedDeg: () => ({ pan, tilt }), captureCount: () => captures,
    },
    sensors: { read: () => Object.fromEntries(Object.entries(inputs).map(([name, v]): [string, InputReading] => [name,
      a.sensors[name as LocalInput] === "virtual-input" && v.value !== null
        ? { quality: "estimated", origin: "virtual-input", value: v.value, sampleMonotonicMs: v.at }
        : { quality: "unavailable", origin: "unavailable", value: null, sampleMonotonicMs: null },
    ])) as Record<LocalInput, InputReading> },
    power: { healthy: powered, ready, voltageEstimateV: () => available ? voltage : null },
    disturb(e) {
      if (e.kind === "sensor") inputs[e.sensor] = { value: e.value, at: e.atMs };
      else if (e.kind === "driver-fault") fault = e.active;
      else if (e.kind === "driver-enabled") enabled = e.active;
      else if (e.kind === "motor-stall") stall = e.active;
      else if (e.kind === "camera-fault") cameraFault = e.active;
      else if (e.kind === "power") { const was = powered(); available = e.available; voltage = e.voltageV; if (!was && powered()) bootAt = e.atMs + grid(a.power.bootMs); }
      else if (e.kind === "voltage-noise") { const was = powered(); const noise = (2 * draw() - 1) * e.amplitudeV; if (available) voltage = Math.max(0, voltage + noise); if (!was && powered()) bootAt = e.atMs + grid(a.power.bootMs); }
    },
    driverFaulted: () => fault || !enabled,
    randomState: () => randomState,
    noisyPositionMm: () => ({ x: position.x + (2 * draw() - 1) * a.noise.positionAmplitudeMm, y: position.y + (2 * draw() - 1) * a.noise.positionAmplitudeMm, z: position.z + (2 * draw() - 1) * a.noise.positionAmplitudeMm }),
    feedback(at): Sample[] {
      const lengths = cableLengths(position, config);
      return config.signals.flatMap((s): Sample[] => {
        if (!s.metric) return [];
        const unit = s.metric.startsWith("position.") || s.metric.startsWith("line.length.") ? "mm" : s.metric.startsWith("line.tension.") ? "N" : s.metric === "power.voltage" ? "V" : "deg";
        const unavailable = (): Sample[] => [{ metric: s.metric!, quality: "unavailable", value: null, unit, frame: s.frame, sampleMonotonicMs: null, ageMs: null, uncertainty: null, reason: s.reading.kind === "unavailable" ? s.reading.reason : "not-reported", originQuality: null }];
        if (s.reading.kind === "unavailable" || s.metric.startsWith("line.tension.")) return unavailable();
        let value: number | null = null;
        const quality = s.metric.startsWith("gimbal.") ? "commanded" : "estimated";
        if (!s.reading.qualities.includes(quality)) return unavailable();
        if (s.metric.startsWith("position.")) value = position[s.metric.slice(-1) as keyof VectorMm];
        else if (s.metric.startsWith("line.length.")) value = lengths[s.metric.slice(-1) as Line];
        else if (s.metric === "power.voltage") value = available ? voltage : null;
        else if (s.metric === "gimbal.pan") value = pan;
        else if (s.metric === "gimbal.tilt") value = tilt;
        return value === null ? unavailable() : [{ metric: s.metric, quality, value, unit, frame: s.frame, sampleMonotonicMs: at, ageMs: 0, uncertainty: null, reason: null, originQuality: null }];
      });
    },
  };
}
