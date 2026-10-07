import { randomUUID } from 'node:crypto';
import { admitCommand, createCommandLedger, validateConfigurationRecord, type AuditEvent, type ErrorCode } from '@arbi/protocol';
import type { SqliteAuditSpool } from '@arbi/audit';
import { admit, commandInput, plan, policy, same } from './admission.js';
import { JobJournal } from './journal.js';
import { JobError, type CrashPoint, type JobAdapter, type JobRecord, type LocalAuthority, type Operation, type Proof } from './types.js';

export interface ConsumerOptions {
  journal: JobJournal; adapter: JobAdapter; authority: () => LocalAuthority;
  auditSpool: (event: AuditEvent) => SqliteAuditSpool;
  fault?: (point: CrashPoint, record: JobRecord) => void;
}
/** A single supervised local consumer. No network or cloud callback is on its stop path. */
export class LocalJobConsumer {
  #options: ConsumerOptions;
  #degraded = false;
  constructor(options: ConsumerOptions) {
    this.#options = options;
    if (options.adapter.executionMode !== 'simulation') throw new JobError('NOT_AUTHORIZED');
    // Boot never restores moving/capturing state, even with the same supplied epoch.
    options.adapter.localStop();
    try { options.journal.recover(); options.journal.latch(); this.#flushAudit(); }
    catch { this.#degraded = true; }
  }
  get status() { return { ...this.#options.journal.status(), degraded: this.#degraded || this.#options.journal.status().degraded, physicalActuationEnabled: false }; }
  receive(input: unknown): JobRecord {
    const c = commandInput(input), o = this.#options, a = o.authority();
    // An authenticated boundary is needed even for cached results of a retired boot.
    if (!same(c.source, a.gate.authenticatedSource) || !same(c.realm, a.gate.realm) || c.siteId !== a.gate.siteId
      || c.executionMode !== 'simulation' || !same(c.command.actor, a.gate.authorizedActor) || c.command.target.deviceId !== a.gate.receiver.deviceId) throw new JobError('NOT_AUTHORIZED');
    const prior = o.journal.duplicate(c); if (prior) return prior;
    let error = admit(c, a), steps: JobRecord['steps'] = [];
    if (!error) try { steps = plan(c, a); } catch (e) { error = e instanceof JobError && e.code !== 'STORAGE_UNAVAILABLE' ? e.code : 'EXECUTION_FAILED'; }
    if (this.status.degraded && c.body.type !== 'control.stop') error = 'RESOURCE_LIMIT';
    if (c.body.type === 'control.stop' && !error) {
      // Best-effort remote stop after protocol authorization, before any disk/audit work.
      o.adapter.localStop();
      for (const active of o.journal.active()) this.#fail(active, 'CANCELLED');
    }
    try {
      const record = o.journal.create(c, a, steps, error);
      this.#flushAudit();
      return record;
    } catch (e) { this.#degraded = true; o.adapter.localStop(); throw e; }
  }
  /** Called by an independently required local stop source. Stops first, evidence best effort. */
  localSafetyStop(reason: ErrorCode = 'FAULT_INHIBITED'): void {
    const o = this.#options;
    o.adapter.localStop();
    this.#degraded = true;
    try { for (const r of o.journal.active()) this.#fail(r, reason); o.journal.latch(); }
    catch { /* Required stopping has already happened. */ }
  }
  authorizeRecovery(): void {
    const a = this.#options.authority();
    // All local prerequisites are rechecked; a remote grant is insufficient.
    const pending = this.#options.journal.active();
    if (pending.length || this.#degraded || this.#options.journal.status().degraded) throw new JobError('FAULT_INHIBITED');
    const reconciliation = a.reconciliation, now = a.gate.nowMonotonicMs;
    if (!reconciliation || !reconciliation.authorizationId || reconciliation.actor.kind !== 'human' || reconciliation.origin !== 'simulated' || !reconciliation.stopped || !reconciliation.referencesReady || !reconciliation.dockReleased
      || !same(reconciliation.modules, a.modules) || !Number.isSafeInteger(reconciliation.atMs) || reconciliation.atMs < 0 || reconciliation.atMs > now || now - reconciliation.atMs > 1500
      || !a.clockReliable || a.gate.faultInhibited || !validateConfigurationRecord(a.applied, 'applied').ok
      || !same(a.gate.receiver, a.boundary.receiver) || a.gate.configRevision !== a.applied.request.configuration.revision) throw new JobError('FAULT_INHIBITED');
    if (Object.values(a.conditions).some(c => c.value !== 'allow' || !c.supported || c.origin !== 'simulated' || !Number.isSafeInteger(c.sampledAtMs) || c.sampledAtMs < 0 || !Number.isSafeInteger(c.validUntilMs) || c.sampledAtMs > a.gate.nowMonotonicMs || c.validUntilMs <= a.gate.nowMonotonicMs
      || a.gate.nowMonotonicMs - c.sampledAtMs > 1500 || c.configurationDigest !== a.applied.configurationDigest || c.calibrationRevision !== a.applied.request.configuration.calibration?.revision)) throw new JobError('FAULT_INHIBITED');
    this.#options.journal.authorizeRecovery(a);
    this.#flushAudit();
  }
  #current(r: JobRecord, a: LocalAuthority): ErrorCode | null {
    if (!same(r.command.command.target, a.gate.receiver)) return 'TARGET_RESTARTED';
    if (!same(r.modules, a.modules)) return 'RESYNC_REQUIRED';
    if (!same(r.appliedIdentity, { transactionId: a.applied.request.transactionId, appliedBy: a.applied.appliedBy })) return 'CONFIG_MISMATCH';
    if (r.configurationDigest !== a.applied.configurationDigest || r.calibrationRevision !== a.applied.request.configuration.calibration?.revision) return 'CONFIG_MISMATCH';
    // Admission is repeated with current lease/actor/capability/deadline, with no cached grant.
    const result = admitCommand(r.command, a.gate, createCommandLedger(1));
    if (!result.ok) return result.error.code;
    return policy(r.command, a, true);
  }
  #fail(r: JobRecord, reason: ErrorCode): JobRecord {
    const o = this.#options;
    o.adapter.localStop();
    const next = o.journal.change(r.command.command.commandId, value => { value.phase = 'operator-required'; value.state = 'Fault'; }, reason === 'CANCELLED' ? 'cancelled' : 'failed', reason);
    o.journal.latch(); this.#flushAudit(); return next;
  }
  #flushAudit(): void {
    const o = this.#options; o.journal.flushAudit(o.auditSpool);
    if (o.journal.pendingAudit(1).length) throw new JobError('RESOURCE_LIMIT');
  }
  tick(): JobRecord | null {
    const o = this.#options;
    let r: JobRecord | undefined;
    try {
      r = o.journal.active()[0]; if (!r) return null;
      if (this.status.degraded) return this.#fail(r, 'RESOURCE_LIMIT');
      const a = o.authority(), now = a.gate.nowMonotonicMs;
      o.journal.observeClock(a);
      if (now >= r.expiresAtMs) return this.#fail(r, 'DEADLINE_EXPIRED');
      // maxDuration is an admission bound; remaining lifetime shrinks as the job runs.
      const currentGate = { ...a.gate };
      const currentCommand = { ...r.command, body: 'maxDurationMs' in r.command.body ? { ...r.command.body, maxDurationMs: Math.max(1, Math.min(r.command.body.maxDurationMs, r.command.command.deadline.expiresMonotonicMs - now)) } : r.command.body };
      // Preserve original payload; only the check's remaining phase duration is narrowed.
      const checkRecord = { ...r, command: currentCommand };
      const error = this.#current(checkRecord, { ...a, gate: currentGate });
      if (error) return this.#fail(r, error);
      if (now < r.lastAtMs) return this.#fail(r, 'CLOCK_INVALID');
      if (!r.operation) {
        const step = r.steps[r.stepIndex];
        if (!step) throw new JobError('INVALID_TRANSITION');
        if (['return', 'approach', 'move'].includes(step.phase) && !a.safeMotionPose) return this.#fail(r, 'FAULT_INHIBITED');
        const epoch = ['gimbal', 'settle', 'capture'].includes(step.phase) ? a.modules.pod : a.modules.motion;
        const operation: Operation = { id: randomUUID(), commandId: r.command.command.commandId, phase: step.phase, epoch,
          startedAtMs: now, deadlineMs: Math.min(now + step.timeoutMs, r.expiresAtMs), step };
        r = o.journal.change(r.command.command.commandId, value => { value.operation = operation; value.phase = step.phase; value.state = step.state; value.sent = false; value.lastAtMs = now; }, r.outcome === 'accepted' ? 'running' : undefined);
        // Intent and operation are committed and copied before a discretionary dispatch.
        this.#flushAudit();
        o.fault?.('before-send', r);
        o.adapter.dispatch(operation);
        o.fault?.('after-send', r);
        o.fault?.('before-receipt', r);
        r = o.journal.change(r.command.command.commandId, value => { value.sent = true; });
        o.fault?.('after-receipt', r);
        return r;
      }
      if (!r.sent) return this.#fail(r, 'INTERRUPTED');
      const operation = r.operation;
      if (now >= operation.deadlineMs) return this.#fail(r, 'DEADLINE_EXPIRED');
      const proof = o.adapter.observe(operation, now);
      if (!proof) return r;
      if (!this.#proof(operation, proof, now)) return this.#fail(r, 'EXECUTION_FAILED');
      o.fault?.('before-proof', r);
      const finished = r.stepIndex + 1 === r.steps.length;
      r = o.journal.change(r.command.command.commandId, value => {
        value.lastAtMs = now; value.stepIndex++; value.operation = null; value.sent = false;
        if (finished) { value.phase = 'complete'; value.state = operation.phase === 'latch' ? 'Parked' : operation.phase === 'stop' && value.command.body.type === 'control.stop' ? 'Fault' : 'Ready'; }
      }, finished ? 'completed' : undefined, null, proof);
      o.fault?.('after-proof', r);
      this.#flushAudit();
      return r;
    } catch (e) {
      // No successful persistence, dispatch receipt or catch branch fabricates physical evidence.
      o.adapter.localStop(); this.#degraded = true;
      try { if (r) this.#fail(r, e instanceof JobError && e.code !== 'STORAGE_UNAVAILABLE' ? e.code : 'RESOURCE_LIMIT'); } catch { /* Visible degradation survives failed best-effort evidence. */ }
      throw e;
    }
  }
  #proof(operation: Operation, proof: Proof, now: number): boolean {
    return proof.origin === 'simulated' && proof.confirmed === true && proof.operationId === operation.id && proof.kind === operation.step.proof
      && same(proof.epoch, operation.epoch) && Number.isSafeInteger(proof.atMs) && proof.atMs >= operation.startedAtMs && proof.atMs <= now
      && now - proof.atMs <= 1500 && proof.atMs < operation.deadlineMs;
  }
}
