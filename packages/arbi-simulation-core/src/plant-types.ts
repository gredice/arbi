import type { CommandBody, EventBody, Sample, Scenario, ScenarioInput, VectorMm } from "@arbi/protocol";

export const PLANT_VERSION = "arbi.plant/1.0";
export const PLANT_FIDELITY = "bounded-affine-modules-no-dynamics";
export const LINES = ["a", "b", "c", "d"] as const;
export type Line = typeof LINES[number];
export type LocalInput = "home" | "limit" | "dock";
export interface DrumParameters {
  radiusMm: number; stepsPerRevolution: number; direction: 1 | -1;
  zeroPayoutMm: number; minPayoutMm: number; maxPayoutMm: number; maxStepRatePerS: number;
}
export interface PlantParameters {
  drums: Record<Line, DrumParameters>;
  motor: { enabled: boolean; delayMs: number; jitterMs: number };
  sensors: Record<LocalInput, "unavailable" | "virtual-input">;
  dock: { positionMm: VectorMm; toleranceMm: number; debounceMs: number; timeoutMs: number };
  power: { minVoltageV: number; maxVoltageV: number; bootMs: number };
  gimbal: { rateDegPerS: number; delayMs: number; jitterMs: number; settleMs: number };
  camera: { delayMs: number; jitterMs: number };
  noise: { positionAmplitudeMm: number };
}
export type PlantInput = ScenarioInput
  | { atMs: number; order: number; kind: "sensor"; sensor: LocalInput; value: boolean }
  | { atMs: number; order: number; kind: "driver-enabled" | "motor-stall" | "camera-fault"; active: boolean };
/** Additive model boundary: borrows the accepted scenario envelope, never changes scenario/1.0 semantics. */
export interface PlantScenario {
  schemaVersion: typeof PLANT_VERSION;
  context: Pick<Scenario, "id" | "executionMode" | "identity" | "units" | "clock" | "seed" | "gate" | "initial">;
  parameters: PlantParameters;
  inputs: PlantInput[];
  returnCommandIds: string[];
  expected: { states: Array<{ atMs: number; state: PlantState; captures: number }>; traceDigest: string };
}
export type PlantState = Extract<EventBody, { type: "state.snapshot" }>["state"];
export interface InputReading {
  quality: "estimated" | "measured" | "unavailable";
  origin: "virtual-input" | "physical" | "unavailable";
  value: boolean | null; sampleMonotonicMs: number | null;
}
export interface ModuleResult { complete: boolean; error: string | null }
/** Portable local method contracts. No endpoint, deployment default or protocol admission authority. */
export interface MotionModule {
  move(target: VectorMm, speedMmPerS: number, atMs: number): number;
  advance(atMs: number): ModuleResult;
  stop(): void;
  positionEstimateMm(): VectorMm;
}
export interface CameraModule {
  ready(atMs: number): boolean;
  settled(atMs: number): boolean;
  execute(body: Extract<CommandBody, { type: "camera.gimbal" | "camera.capture" }>, atMs: number): number;
  advance(atMs: number): ModuleResult;
  stop(): void;
  gimbalCommandedDeg(): { pan: number; tilt: number };
  captureCount(): number;
}
export interface LocalInputsModule { read(atMs: number): Record<LocalInput, InputReading> }
export interface PodPowerModule { healthy(): boolean; ready(atMs: number): boolean; voltageEstimateV(): number | null }
export interface PortablePlantModules { motion: MotionModule; camera: CameraModule; sensors: LocalInputsModule; power: PodPowerModule }
export interface SimulatedPlantModules extends PortablePlantModules {
  executionMode: "simulation";
  disturb(event: Exclude<PlantInput, { kind: "command" | "cloud" }>): void;
  driverFaulted(): boolean;
  randomState(): number;
  noisyPositionMm(): VectorMm;
  feedback(atMs: number): Sample[];
}
export interface PlantRow {
  atMs: number; state: PlantState; positionQ6: VectorMm; virtualPositionQ6: VectorMm;
  lines: Record<Line, { lengthQ6: number; steps: number; reconstructedPayoutQ6: number }>;
  positionQuality: "estimated"; lengthQuality: "estimated"; drumQuality: "estimated"; gimbalQuality: "commanded"; voltageQuality: "estimated" | "unavailable"; virtualPositionOrigin: "simulated"; origin: "simulated"; encoderFeedback: "unavailable";
  feedback: Array<Omit<Sample, "value"> & { valueQ6: number | null }>; localInputs: Record<LocalInput, InputReading>;
  powerReady: boolean; voltageQ6: number | null; gimbalCommandQ6: { pan: number; tilt: number };
  captures: number; randomState: number;
  outcomes: Array<{ commandId: string; outcome: string; error: string | null }>; dispatches: string[];
}
export interface PlantRun {
  schemaVersion: typeof PLANT_VERSION; fidelity: typeof PLANT_FIDELITY;
  evidence: "synthetic-host-reference"; identity: Scenario["identity"]; parameters: PlantParameters;
  assumptions: string[]; trace: PlantRow[]; traceDigest: string;
  invariants: Record<"withinWorkspace" | "truthfulFeedback" | "independentDock" | "captureStationary" | "boundedTrace", boolean>;
}
export const PLANT_ASSUMPTIONS = [
  "synthetic-unsurveyed-geometry", "constant-single-layer-drum-radius", "affine-synchronized-reference",
  "unmeasured-delay-noise-and-settling-parameters", "virtual-inputs-are-not-physical-confirmation",
  "no-elasticity-sag-wind-mass-damping-thermal-structural-or-tension-physics",
  "no-acceleration-braking-slip-pid-autofocus-image-bytes-or-update-authority",
];
