import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { checkConfigurationCompatibility, configurationDigest, ConfigurationReference, validateConfigurationRecord, type Actor, type CommissioningStatus, type ConfigurationApplyBoundary, type ConfigurationJournal, type ConfigurationReport, type ConfigurationRequest, type Identity, type Realm } from '@arbi/protocol';
import type { AuthorizedContext } from '@arbi/gredice';
import { CommissioningError, validateSet, type CommissioningSet } from './contracts.js';
import { CommissioningStore, setIdentity, type Enrollment } from './store.js';

export interface DeviceObservation extends Enrollment {
  journal: ConfigurationJournal;
  stagedDigest: string | null;
  activeSetDigest: string | null;
  report: ConfigurationReport | null;
  inhibited: true;
}
/** Trusted local adapters only. Neither TLS identity nor request fields create enrollment authority. */
export interface CommissioningDevice {
  inspect(): DeviceObservation;
  inhibit(): void;
  prepare(set: CommissioningSet, signal: AbortSignal): Promise<string>;
  activate(request: ConfigurationRequest, setDigest: string, boundary: ConfigurationApplyBoundary, signal: AbortSignal): Promise<ConfigurationReport>;
}
export interface LocalCommissioningAuthorization {
  id: string; actor: Actor; sessionId: string; realm: Realm; siteId: string; receiver: Identity;
  origin: 'simulated'; mode: 'maintenance'; stopped: true; idle: true;
  issuedAtMs: number; expiresAtMs: number;
}
export interface CoordinatorOptions {
  store: CommissioningStore; realm: Realm; siteId: string; identity: Identity;
  devices: ReadonlyMap<string, CommissioningDevice>;
  now: () => number;
  localAuthorization: () => LocalCommissioningAuthorization | null;
  interlock: () => { stopped: boolean; idle: boolean; inhibited: boolean };
  localStop: () => void;
  /** Loaded independently from reviewed named records. Request-supplied passed flags cannot approve a set. */
  reviewedSetDigests: () => readonly string[];
  boundary: (observation: Enrollment) => ConfigurationApplyBoundary;
  deviceTimeoutMs?: number;
}
export class CommissioningCoordinator {
  readonly #o: CoordinatorOptions;
  #busy = false;
  #reconciled = false;
  #degraded = false;
  #clockFloor = 0;
  constructor(options: CoordinatorOptions) {
    this.#o = options;
    if (options.realm.environment !== 'test' || options.devices.size !== 3 || !Number.isInteger(options.deviceTimeoutMs ?? 1500)
      || (options.deviceTimeoutMs ?? 1500) < 1 || (options.deviceTimeoutMs ?? 1500) > 5000) throw new CommissioningError('INVALID_COMPOSITION');
    this.#stop();
    const state = options.store.state();
    if (state.active || state.staged) {
      state.phase = 'blocked'; state.blockedReason = 'RESTART_RECONCILIATION_REQUIRED';
      options.store.commit(state, { kind: 'device', id: options.identity.deviceId }, null, 'source-restarted', options.now());
    }
  }
  #stop() {
    this.#reconciled = false;
    this.#o.localStop();
    for (const device of this.#o.devices.values()) device.inhibit();
  }
  #authorize(context: AuthorizedContext) {
    const o = this.#o, grant = o.localAuthorization(), now = o.now(), lock = o.interlock();
    if (!Number.isSafeInteger(now) || now < this.#clockFloor) throw new CommissioningError('CLOCK_INVALID');
    this.#clockFloor = now;
    if (now < 0 || context.actor.kind !== 'human' || context.capability !== 'configuration.write'
      || context.siteId !== o.siteId || !isDeepStrictEqual(context.realm, o.realm) || context.expiresAtMs <= now
      || !grant || grant.origin !== 'simulated' || grant.mode !== 'maintenance' || !grant.stopped || !grant.idle
      || !grant.id || grant.sessionId !== context.sessionId || !isDeepStrictEqual(grant.actor, context.actor)
      || grant.siteId !== o.siteId || !isDeepStrictEqual(grant.realm, o.realm) || !isDeepStrictEqual(grant.receiver, o.identity)
      || !Number.isSafeInteger(grant.issuedAtMs) || !Number.isSafeInteger(grant.expiresAtMs) || grant.issuedAtMs > now
      || grant.issuedAtMs < 0 || grant.expiresAtMs <= now || grant.expiresAtMs - grant.issuedAtMs > 60_000
      || !lock.stopped || !lock.idle || !lock.inhibited) throw new CommissioningError('LOCAL_AUTHORIZATION_REQUIRED');
    if (this.#degraded || o.store.degraded) throw new CommissioningError('STORE_UNAVAILABLE');
    return grant;
  }
  #enrollment(id: string): DeviceObservation {
    const o = this.#o, observation = o.devices.get(id)?.inspect();
    if (!observation || !observation.inhibited || observation.identity.deviceId !== id || observation.component.id !== id
      || observation.component.kind !== 'module' || !['edge', 'pico', 'pod'].includes(observation.component.role)
      || observation.siteId !== o.siteId || !isDeepStrictEqual(observation.realm, o.realm) || observation.executionMode !== 'simulation'
      || observation.protocol !== 'arbi/1.0') throw new CommissioningError('DEVICE_INCOMPATIBLE');
    return structuredClone(observation);
  }
  #check(set: CommissioningSet) {
    const o = this.#o, c = set.configuration, state = o.store.state();
    if (c.siteId !== o.siteId || !isDeepStrictEqual(c.realm, o.realm)) throw new CommissioningError('SCOPE_MISMATCH');
    if (!o.reviewedSetDigests().includes(configurationDigest(set))) throw new CommissioningError('RECALIBRATION_REQUIRED');
    const components = c.components.filter(component => component.kind === 'module' && ['edge', 'pico', 'pod'].includes(component.role));
    if (components.length !== o.devices.size || new Set(components.map(component => component.kind === 'module' ? component.role : '')).size !== 3
      || state.enrollments.length !== components.length) throw new CommissioningError('ENROLLMENT_REQUIRED');
    for (const component of components) {
      const observation = this.#enrollment(component.id), enrolled = state.enrollments.find(e => e.identity.deviceId === component.id);
      if (!enrolled || !isDeepStrictEqual(enrolled, this.#registration(observation)) || !isDeepStrictEqual(component, observation.component)) throw new CommissioningError('DEVICE_CHANGED');
      const boundary = o.boundary(observation);
      if (!isDeepStrictEqual(boundary.receiver, observation.identity) || !boundary.inhibited) throw new CommissioningError('DEVICE_CHANGED');
      const compatibility = checkConfigurationCompatibility(c, boundary);
      if (!compatibility.ok) throw new CommissioningError(compatibility.error.code);
    }
  }
  #registration(observation: DeviceObservation): Enrollment {
    const { journal: _journal, stagedDigest: _staged, activeSetDigest: _active, report: _report, inhibited: _inhibit, ...enrollment } = observation;
    return enrollment;
  }
  enroll(context: AuthorizedContext, deviceId: string, reason: string) {
    this.#authorize(context); if (this.#busy) throw new CommissioningError('ACTIVATION_BUSY');
    const observation = this.#enrollment(deviceId), state = this.#o.store.state();
    this.#stop();
    state.enrollments = [...state.enrollments.filter(e => e.identity.deviceId !== deviceId), this.#registration(observation)];
    state.phase = 'blocked'; state.blockedReason = 'ENROLLMENT_CHANGED';
    this.#o.store.commit(state, context.actor, context.sessionId, reason, this.#o.now());
  }
  stage(context: AuthorizedContext, input: unknown, reason: string) {
    this.#authorize(context); if (this.#busy) throw new CommissioningError('ACTIVATION_BUSY');
    let set: CommissioningSet | null = null;
    try {
      set = validateSet(input); this.#check(set);
      const state = this.#o.store.state();
      if (state.staged && ['activating', 'blocked'].includes(state.phase)) throw new CommissioningError('RECOVERY_REQUIRED');
      for (const historical of this.#o.store.history()) for (const old of [historical.active, historical.staged]) {
        if (old?.configuration.revision === set.configuration.revision && configurationDigest(old) !== configurationDigest(set)) throw new CommissioningError('REVISION_CONFLICT');
      }
      if (state.active && (set.configuration.previousRevision !== state.active.configuration.revision || set.configuration.revision === state.active.configuration.revision)) throw new CommissioningError('STALE_CONFIGURATION');
      this.#stop();
      state.staged = set; state.rejected = null; state.phase = 'staged'; state.blockedReason = 'ACTIVATION_REQUIRED'; state.reports = []; state.activationId = randomUUID();
      this.#o.store.commit(state, context.actor, context.sessionId, reason, this.#o.now());
    } catch (e) {
      const state = this.#o.store.state();
      state.rejected = { identity: set ? setIdentity(set) : null, reason: e instanceof CommissioningError ? e.code : 'INVALID_SET' };
      this.#o.store.commit(state, context.actor, context.sessionId, reason, this.#o.now(), 'deny'); throw e;
    }
  }
  invalidate(context: AuthorizedContext, reason: string) {
    this.#authorize(context); if (this.#busy) throw new CommissioningError('ACTIVATION_BUSY');
    this.#stop(); const state = this.#o.store.state(); state.phase = 'blocked'; state.blockedReason = 'INVALIDATED';
    this.#o.store.commit(state, context.actor, context.sessionId, reason, this.#o.now());
  }
  /** Finish the exact staged transaction or reconcile the exact active set; never replay jobs. */
  async activate(context: AuthorizedContext, reason: string, recovery: boolean, reauthorize: () => Promise<void>) {
    this.#authorize(context); if (this.#busy) throw new CommissioningError('ACTIVATION_BUSY');
    const o = this.#o, initial = o.store.state(), set = initial.staged ?? (recovery ? initial.active : null);
    if (!set || !recovery && initial.phase !== 'staged') throw new CommissioningError('RECOVERY_REQUIRED');
    this.#busy = true;
    try {
      await reauthorize(); this.#authorize(context);
      this.#stop(); this.#check(set);
      const desired = setIdentity(set), proposals = new Map<string, { request: ConfigurationRequest; journal: ConfigurationJournal; boundary: ConfigurationApplyBoundary }>();
      // Validate all device transitions before any device sees preparation/activation.
      for (const [id] of o.devices) {
        const observation = this.#enrollment(id), reference = new ConfigurationReference();
        const journal = observation.journal;
        if (!reference.reboot(journal, observation.identity).ok) throw new CommissioningError('INVALID_DEVICE_JOURNAL');
        for (const retained of initial.journals[id]?.commits ?? []) if (!journal.commits.some(commit => isDeepStrictEqual(commit, retained))) throw new CommissioningError('DEVICE_HISTORY_MISMATCH');
        if (recovery && !initial.staged) {
          if (!reference.applied || reference.applied.configurationDigest !== desired.configurationDigest) throw new CommissioningError('DEVICE_CHANGED');
          continue;
        }
        const previous = reference.applied?.request.configuration;
        const saved = observation.activeSetDigest === desired.digest ? reference.applied : null;
        const request: ConfigurationRequest = saved?.request ?? { schemaVersion: 'arbi.configuration/1.0', transactionId: `${initial.activationId}:${id}`,
          expectedAppliedRevision: previous?.revision ?? null, target: observation.identity, transition: { kind: 'apply' }, configuration: set.configuration,
          auditContext: { actor: context.actor, authorizationId: this.#authorize(context).id, correlationId: initial.activationId!, reasonCode: reason,
            previousConfigRevision: previous?.revision ?? null, previousCalibrationRevision: previous?.calibration?.revision ?? null } };
        const boundary = { ...o.boundary(observation), authorizedActor: request.auditContext.actor, authorizationId: request.auditContext.authorizationId };
        if (saved) {
          // A completed target may have rebooted. Current inspect, not an old cached receipt, must reconcile it.
          if (saved.configurationDigest !== desired.configurationDigest || observation.report?.transactionId !== saved.request.transactionId) throw new CommissioningError('DEVICE_CHANGED');
        } else {
          const result = reference.apply(request, boundary, () => true);
          if (!result.ok) throw new CommissioningError(result.error.code);
        }
        proposals.set(id, { request, journal: reference.exportJournal(), boundary });
      }
      const state = o.store.state(); state.phase = 'activating'; state.blockedReason = 'ACTIVATION_IN_PROGRESS';
      o.store.commit(state, context.actor, context.sessionId, reason, o.now());
      if (initial.staged) {
        for (const [id, device] of o.devices) {
          await reauthorize();
          this.#authorize(context); this.#check(set);
          const prepared = await this.#bounded(signal => device.prepare(structuredClone(set), signal));
          await reauthorize();
          if (prepared !== desired.digest) throw new CommissioningError('PREPARE_MISMATCH');
          this.#authorize(context); this.#check(set);
          if (this.#enrollment(id).stagedDigest !== desired.digest) throw new CommissioningError('PREPARE_MISMATCH');
        }
        for (const [id, device] of o.devices) {
          await reauthorize();
          this.#authorize(context); this.#check(set);
          const proposal = proposals.get(id)!;
          const prior = this.#enrollment(id);
          const report = prior.activeSetDigest === desired.digest ? prior.report : await this.#bounded(signal => device.activate(structuredClone(proposal.request), desired.digest, proposal.boundary, signal));
          await reauthorize();
          this.#authorize(context); this.#check(set);
          this.#report(set, id, report);
          const current = o.store.state(); current.journals[id] = proposal.journal;
          current.reports = [...current.reports.filter(r => r.source.deviceId !== id), report!];
          o.store.commit(current, context.actor, context.sessionId, reason, o.now());
        }
      }
      await reauthorize(); this.#authorize(context); this.#check(set);
      for (const [id] of o.devices) this.#report(set, id, this.#enrollment(id).report);
      const committed = o.store.state(); committed.active = set; committed.staged = null; committed.phase = 'active'; committed.blockedReason = null;
      o.store.commit(committed, context.actor, context.sessionId, reason, o.now(), 'applied');
      this.#reconciled = true;
    } catch (e) {
      this.#stop();
      const state = o.store.state(); state.phase = 'blocked'; state.blockedReason = e instanceof CommissioningError ? e.code : 'DEVICE_ACTIVATION_FAILED';
      state.rejected = { identity: setIdentity(set), reason: state.blockedReason };
      try { o.store.commit(state, context.actor, context.sessionId, reason, o.now(), 'deny'); } catch { this.#degraded = true; }
      throw e;
    } finally { this.#busy = false; }
  }
  #report(set: CommissioningSet, id: string, report: ConfigurationReport | null) {
    const observation = this.#enrollment(id), expected = setIdentity(set);
    if (!report || !validateConfigurationRecord(report, 'report').ok || !isDeepStrictEqual(report, observation.report) || !isDeepStrictEqual(report.source, observation.identity) || report.schemaVersion !== 'arbi.configuration/1.0'
      || !report.inhibited || report.appliedRevision !== expected.revision || report.configurationDigest !== expected.configurationDigest
      || report.calibrationRevision !== expected.calibrationRevision || report.hardwareDigest !== observation.hardwareDigest || observation.activeSetDigest !== expected.digest) throw new CommissioningError('ACTIVATION_MISMATCH');
    const applied = observation.journal.commits.at(-1);
    if (observation.journal.appliedTransactionId !== report.transactionId || applied?.request.transactionId !== report.transactionId
      || applied.configurationDigest !== expected.configurationDigest || configurationDigest(applied.request.configuration) !== expected.configurationDigest) throw new CommissioningError('ACTIVATION_MISMATCH');
  }
  async #bounded<T>(work: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([work(controller.signal), new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new CommissioningError('DEVICE_TIMEOUT')); }, this.#o.deviceTimeoutMs ?? 1500);
    })]); } finally { clearTimeout(timer); controller.abort(); }
  }
  get status(): CommissioningStatus {
    const state = this.#o.store.state();
    let blockedReason = this.#degraded || this.#o.store.degraded ? 'STORE_UNAVAILABLE' : state.blockedReason;
    if (!blockedReason && (!this.#reconciled || !state.active || this.#busy)) blockedReason = 'RECONCILIATION_REQUIRED';
    if (!blockedReason && state.active) {
      try { this.#check(state.active); for (const [id] of this.#o.devices) this.#report(state.active, id, this.#enrollment(id).report); }
      catch (e) { blockedReason = e instanceof CommissioningError ? e.code : 'DEVICE_UNAVAILABLE'; }
      if (blockedReason) {
        this.#stop(); state.phase = 'blocked'; state.blockedReason = blockedReason;
        try { this.#o.store.commit(state, { kind: 'device', id: this.#o.identity.deviceId }, null, 'configuration-invalidated', this.#o.now(), 'deny'); }
        catch { this.#degraded = true; blockedReason = 'STORE_UNAVAILABLE'; }
      }
    }
    return { version: 'arbi.commissioning-status/1.0', realm: this.#o.realm, siteId: this.#o.siteId, executionMode: 'simulation',
      active: state.active ? setIdentity(state.active) : null, staged: state.staged ? setIdentity(state.staged) : null, rejected: state.rejected,
      phase: blockedReason && state.phase === 'active' ? 'blocked' : state.phase, ready: !blockedReason, blockedReason, physicalActuationEnabled: false };
  }
  get identity(): Identity { return structuredClone(this.#o.identity); }
  stop() { this.#degraded = true; this.#stop(); }
}
