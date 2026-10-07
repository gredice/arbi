import type { Actor, AppliedConfiguration, Command, CommandGate, ConfigurationBoundary, ErrorCode, Event, Identity, VectorMm } from '@arbi/protocol';

export type Outcome = Extract<Event['body'], { type: 'command.outcome' }>['outcome'];
export type State = Extract<Event['body'], { type: 'state.snapshot' }>['state'];
export type Phase = 'move' | 'stop' | 'gimbal' | 'settle' | 'capture' | 'return' | 'approach' | 'dock-stop' | 'latch';
export type ProofKind = 'arrived' | 'stopped' | 'settled' | 'captured' | 'latched';
export interface Epoch { source: Identity; generation: number; configurationDigest: string; calibrationRevision: string }
export interface Condition {
  value: 'allow' | 'deny' | 'unknown'; origin: 'simulated'; supported: boolean;
  sampledAtMs: number; validUntilMs: number; configurationDigest: string; calibrationRevision: string;
}
export const REQUIRED_INPUTS = ['workspace', 'weather', 'access', 'maintenance', 'fault', 'power', 'reference', 'lines', 'protection', 'dock'] as const;
export interface CapturePlan {
  configurationDigest: string; calibrationRevision: string; resourceId: string;
  positionMm: VectorMm; panDeg: number; tiltDeg: number; preDockMm: VectorMm; dockMm: VectorMm;
  speedMmPerS: number; approachSpeedMmPerS: number;
}
/** Trusted local composition, never deserialized from a cloud command or browser. */
export interface LocalAuthority {
  gate: CommandGate; applied: AppliedConfiguration; boundary: ConfigurationBoundary;
  clockReliable: boolean; mode: 'manual' | 'autonomous' | 'inhibited'; state: State;
  cloudConnected: boolean; continueOffline: boolean; stationary: boolean; safeMotionPose: boolean;
  conditions: Record<typeof REQUIRED_INPUTS[number], Condition>;
  modules: { motion: Epoch; pod: Epoch };
  supportedPhases: Phase[];
  capturePlan: CapturePlan | null;
  reconciliation: { authorizationId: string; actor: Actor; modules: LocalAuthority['modules']; atMs: number; origin: 'simulated'; stopped: boolean; referencesReady: boolean; dockReleased: boolean } | null;
}
export interface Step {
  phase: Phase; state: State; timeoutMs: number; proof: ProofKind;
  body: Extract<Command['body'], { type: 'motion.move' | 'camera.gimbal' | 'camera.capture' }> | null;
}
export interface Operation {
  id: string; commandId: string; phase: Phase; epoch: Epoch; startedAtMs: number; deadlineMs: number; step: Step;
}
export interface Proof { operationId: string; kind: ProofKind; epoch: Epoch; atMs: number; origin: 'simulated'; confirmed: boolean }
/** Implementations are local. The only implemented adapter is a bounded in-process simulator. */
export interface JobAdapter {
  readonly executionMode: 'simulation';
  dispatch(operation: Operation): void;
  observe(operation: Operation, atMs: number): Proof | null;
  localStop(): void;
}
export interface JobRecord {
  command: Command; fingerprint: string; outcome: Outcome; error: ErrorCode | null;
  phase: Phase | 'admitted' | 'complete' | 'operator-required'; state: State;
  steps: Step[]; stepIndex: number; operation: Operation | null; sent: boolean;
  modules: LocalAuthority['modules']; configurationDigest: string; calibrationRevision: string;
  appliedIdentity: { transactionId: string; appliedBy: Identity };
  lastAtMs: number; expiresAtMs: number; event: Event;
}
export class JobError extends Error { constructor(readonly code: ErrorCode | 'STORAGE_UNAVAILABLE') { super(code); } }
export type CrashPoint = 'before-commit' | 'after-commit' | 'before-send' | 'after-send' | 'before-receipt' | 'after-receipt' | 'before-proof' | 'after-proof' | 'after-audit-append';
