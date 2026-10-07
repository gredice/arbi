import { boundedPlantAdapters, validatePlant, type PlantScenario, type SimulatedPlantModules } from '@arbi/simulation-core';
import type { Configuration } from '@arbi/protocol';
import { same } from './admission.js';
import { JobError, type JobAdapter, type Operation, type Proof } from './types.js';

/** Synthetic stop/capture/dock witnesses only. Has no socket, device path or physical output. */
export class BoundedJobSimulator implements JobAdapter {
  readonly executionMode = 'simulation';
  readonly modules: SimulatedPlantModules;
  readonly plant: PlantScenario;
  dispatches: Operation[] = [];
  stops = 0;
  #active: Operation | null = null;
  #completeAt = 0;
  #stopped = true;
  #dockSince: number | null = null;
  get stationary(): boolean { return this.#stopped; }
  constructor(input: unknown, configuration: Configuration, referenceDigest: string) {
    this.plant = validatePlant(input, configuration, referenceDigest);
    this.modules = boundedPlantAdapters(this.plant, configuration);
  }
  localStop(): void {
    this.modules.motion.stop(); this.modules.camera.stop(); this.#stopped = true; this.#active = null; this.stops++;
  }
  dispatch(operation: Operation): void {
    if (this.#active || this.dispatches.some(o => o.id === operation.id)) throw new JobError('INVALID_TRANSITION');
    const now = operation.startedAtMs, step = operation.step;
    if (!this.modules.power.ready(now) || this.modules.driverFaulted()) throw new JobError('FAULT_INHIBITED');
    this.dispatches.push(structuredClone(operation)); this.#active = structuredClone(operation); this.#dockSince = null;
    if (step.body?.type === 'motion.move') {
      this.#completeAt = now + this.modules.motion.move(step.body.positionMm, step.body.maxSpeedMmPerS, now); this.#stopped = false;
    } else if (step.body?.type === 'camera.gimbal' || step.body?.type === 'camera.capture') {
      if (!this.#stopped) throw new JobError('INVALID_TRANSITION');
      this.#completeAt = now + this.modules.camera.execute(step.body, now);
    } else if (step.phase === 'stop' || step.phase === 'dock-stop') {
      this.modules.motion.stop(); this.modules.camera.stop(); this.#stopped = true;
      // Separate virtual controller observation after dispatch; send is not the proof.
      this.#completeAt = now + this.plant.context.clock.stepMs;
    } else if (step.phase === 'settle') {
      if (!this.#stopped) throw new JobError('INVALID_TRANSITION');
      this.#completeAt = now + Math.max(this.plant.context.clock.stepMs, this.plant.parameters.gimbal.settleMs);
    } else if (step.phase === 'latch') {
      if (!this.#stopped) throw new JobError('INVALID_TRANSITION');
      this.#completeAt = now;
    } else throw new JobError('UNSUPPORTED_CAPABILITY');
  }
  observe(operation: Operation, atMs: number): Proof | null {
    if (!same(operation, this.#active)) throw new JobError('RESYNC_REQUIRED');
    const m = this.modules, step = operation.step;
    if (m.driverFaulted() || !m.power.ready(atMs)) throw new JobError('FAULT_INHIBITED');
    if (atMs < this.#completeAt) {
      if (step.body?.type === 'motion.move') m.motion.advance(atMs);
      return null;
    }
    if (step.body?.type === 'motion.move' || step.body?.type === 'camera.gimbal' || step.body?.type === 'camera.capture') {
      const result = step.body.type === 'motion.move' ? m.motion.advance(atMs) : m.camera.advance(atMs);
      if (result.error) throw new JobError('EXECUTION_FAILED');
      if (!result.complete) return null;
    }
    if (step.phase === 'latch') {
      const dock = m.sensors.read(atMs).dock;
      const target = this.plant.parameters.dock.positionMm, position = m.motion.positionEstimateMm();
      const near = Math.hypot(target.x - position.x, target.y - position.y, target.z - position.z) <= this.plant.parameters.dock.toleranceMm;
      if (!near || dock.origin !== 'virtual-input' || dock.quality !== 'estimated' || dock.value !== true || dock.sampleMonotonicMs === null
        || dock.sampleMonotonicMs < operation.startedAtMs || dock.sampleMonotonicMs > atMs || atMs - dock.sampleMonotonicMs > 1500) { this.#dockSince = null; return null; }
      this.#dockSince ??= atMs;
      if (atMs - this.#dockSince < this.plant.parameters.dock.debounceMs) return null;
    }
    const proof: Proof = { operationId: operation.id, kind: step.proof, epoch: structuredClone(operation.epoch), atMs, origin: 'simulated', confirmed: true };
    this.#active = null; return proof;
  }
}
