import type { CommandBody, Configuration, Sample, ScenarioInitial, VectorMm } from "@arbi/protocol";

export interface TimeAdapter { nowMs(): number; advanceTo(atMs: number): void }
export interface MotorDriverAdapter {
  advance(atMs: number): boolean;
  positionEstimateMm(): VectorMm;
  move(targetMm: VectorMm, durationMs: number, atMs: number): void;
  stop(): void;
  setFault(active: boolean): void;
  faulted(): boolean;
}
export interface LocalSensorValue { quality: "measured" | "unavailable"; value: boolean | null }
export interface SensorAdapter {
  read(atMs: number): Sample[];
  readLocalInputs(atMs: number): { home: LocalSensorValue; limit: LocalSensorValue; dock: LocalSensorValue };
}
export interface PodCameraAdapter {
  execute(body: Extract<CommandBody, { type: "camera.gimbal" | "camera.capture" }>): void;
  gimbalCommandedDeg(): { pan: number; tilt: number };
  simulatedCaptureCount(): number;
}
export interface PowerAdapter {
  set(available: boolean, voltageV: number): void;
  available(): boolean;
  voltageEstimateV(): number | null;
}
/** Same method boundaries can be implemented by future local device adapters; this runner accepts simulation only. */
export interface SimulationAdapters {
  executionMode: "simulation";
  time: TimeAdapter; motors: MotorDriverAdapter; sensors: SensorAdapter; pod: PodCameraAdapter; power: PowerAdapter;
}
export function referenceTrajectory(start: VectorMm, target: VectorMm, durationMs: number, elapsedMs: number): VectorMm {
  if (!Number.isSafeInteger(durationMs) || durationMs <= 0 || !Number.isSafeInteger(elapsedMs) || elapsedMs < 0 || [...Object.values(start), ...Object.values(target)].some((v) => !Number.isFinite(v))) throw new Error("INVALID_TRAJECTORY");
  const fraction = Math.min(elapsedMs / durationMs, 1);
  return { x: start.x + (target.x - start.x) * fraction, y: start.y + (target.y - start.y) * fraction, z: start.z + (target.z - start.z) * fraction };
}
/** LCG with exact uint32 wrap, one draw per noise input, including zero amplitude. Not cryptographic. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state; };
}
export function simulatedAdapters(config: Configuration, initial: ScenarioInitial, startMs: number): SimulationAdapters {
  let now = startMs, position = structuredClone(initial.positionMm), fault = initial.driverFault;
  let movement: { start: VectorMm; target: VectorMm; at: number; duration: number } | null = null;
  let pan = initial.panDeg, tilt = initial.tiltDeg, captures = 0, available = initial.powerAvailable, voltage = initial.voltageV;
  return {
    executionMode: "simulation",
    time: { nowMs: () => now, advanceTo: (at) => { if (!Number.isSafeInteger(at) || at < now) throw new Error("CLOCK_INVALID"); now = at; } },
    motors: {
      advance(at) {
        if (!movement) return false;
        position = referenceTrajectory(movement.start, movement.target, movement.duration, at - movement.at);
        if (at - movement.at < movement.duration) return false;
        movement = null; return true;
      },
      positionEstimateMm: () => structuredClone(position),
      move: (target, duration, at) => { movement = { start: structuredClone(position), target: structuredClone(target), at, duration }; },
      stop: () => { movement = null; }, setFault: (active) => { fault = active; }, faulted: () => fault,
    },
    sensors: {
      read: () => config.signals.flatMap((s): Sample[] => s.metric?.startsWith("position.") || s.metric?.startsWith("line.tension.") ? [{ metric: s.metric, quality: "unavailable", value: null, unit: s.metric.startsWith("position.") ? "mm" : "N", frame: s.frame, sampleMonotonicMs: null, ageMs: null, uncertainty: null, reason: "sensor-not-installed", originQuality: null }] : []),
      readLocalInputs: () => ({ home: { quality: "unavailable", value: null }, limit: { quality: "unavailable", value: null }, dock: { quality: "unavailable", value: null } }),
    },
    pod: {
      execute(body) { if (body.type === "camera.gimbal") { pan = body.panDeg; tilt = body.tiltDeg; } else captures++; },
      gimbalCommandedDeg: () => ({ pan, tilt }), simulatedCaptureCount: () => captures,
    },
    power: { set: (a, v) => { available = a; voltage = v; }, available: () => available, voltageEstimateV: () => available ? voltage : null },
  };
}
