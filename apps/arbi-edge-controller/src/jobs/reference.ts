import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configurationDigest, configurationHardwareDigest, type Command, type ConfigurationBoundary } from '@arbi/protocol';
import { syntheticAppliedConfiguration } from '../simulation.js';
import { JobAuditRelay } from './audit-relay.js';
import { JobJournal, type JournalOptions } from './journal.js';
import { LocalJobConsumer, type ConsumerOptions } from './orchestrator.js';
import { BoundedJobSimulator } from './simulator.js';
import { REQUIRED_INPUTS, type LocalAuthority, type Phase } from './types.js';

/** Explicit fixture runner only; runtime settings never import or select this authority. */
export function createJobReference(directory: string, patches: { journal?: Partial<JournalOptions>; consumer?: Partial<ConsumerOptions>; plant?: string } = {}) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const applied = syntheticAppliedConfiguration(), config = applied.request.configuration;
  // dist/jobs is one level deeper than the existing edge runtime fixture helper.
  const root = new URL('../../../../', import.meta.url);
  const plant = JSON.parse(readFileSync(new URL(`packages/arbi-simulation-core/fixtures/plant/1.0/${patches.plant ?? 'nominal'}.json`, root), 'utf8'));
  const referenceDigest = createHash('sha256').update(readFileSync(new URL('packages/arbi-protocol/fixtures/reference/1.0/vectors.json', root))).digest('hex');
  const adapter = new BoundedJobSimulator(plant, config, referenceDigest);
  const gate = { realm: config.realm, siteId: config.siteId, executionMode: 'simulation' as const, authenticatedSource: plant.context.gate.source,
    receiver: applied.appliedBy, nowMonotonicMs: plant.context.clock.startMs, maxDeadlineAheadMs: 10000,
    authorizedActor: plant.context.gate.actor, allowedTypes: ['motion.move', 'camera.gimbal', 'camera.capture', 'control.stop'] as Command['body']['type'][],
    supportedTypes: ['motion.move', 'camera.gimbal', 'camera.capture', 'control.stop'] as Command['body']['type'][], configRevision: config.revision, faultInhibited: false,
    lease: { ...plant.context.gate.lease, receiver: applied.appliedBy, expiresMonotonicMs: 15000 } };
  const boundary: ConfigurationBoundary = { receiver: gate.receiver, realm: config.realm, siteId: config.siteId, executionMode: 'simulation',
    calibrationScope: 'simulation', installedHardwareDigest: configurationHardwareDigest(config), localLimits: config.limits,
    approvedCalibrationDigests: [configurationDigest(config.calibration)], readableSchemaVersions: [config.schemaVersion], rollbackReadableSchemaVersions: [config.schemaVersion] };
  const conditions = Object.fromEntries(REQUIRED_INPUTS.map(name => [name, { value: 'allow', origin: 'simulated', supported: true, sampledAtMs: gate.nowMonotonicMs,
    validUntilMs: gate.nowMonotonicMs + 1000, configurationDigest: applied.configurationDigest, calibrationRevision: config.calibration!.revision }])) as LocalAuthority['conditions'];
  const epoch = (id: string) => ({ source: { deviceId: id, bootId: `${id}-synthetic-boot`, sessionId: `${id}-synthetic-session` }, generation: 1,
    configurationDigest: applied.configurationDigest, calibrationRevision: config.calibration!.revision });
  const authority: LocalAuthority = { gate, applied, boundary, clockReliable: true, mode: 'manual', state: 'Ready', cloudConnected: true, continueOffline: false,
    stationary: true, safeMotionPose: true, conditions, modules: { motion: epoch('pico'), pod: epoch('pod') },
    supportedPhases: ['move', 'stop', 'gimbal', 'settle', 'capture', 'return', 'approach', 'dock-stop', 'latch'] as Phase[],
    capturePlan: { configurationDigest: applied.configurationDigest, calibrationRevision: config.calibration!.revision, resourceId: 'synthetic-still',
      positionMm: { x: 1000, y: 2000, z: 2500 }, panDeg: 10, tiltDeg: -5, preDockMm: { x: 1000, y: 2000, z: 2495 }, dockMm: plant.parameters.dock.positionMm,
      speedMmPerS: 50, approachSpeedMmPerS: 25 },
    reconciliation: { authorizationId: 'synthetic-local-inspection', actor: gate.authorizedActor, modules: { motion: epoch('pico'), pod: epoch('pod') }, atMs: gate.nowMonotonicMs,
      origin: 'simulated', stopped: true, referencesReady: true, dockReleased: true } };
  let armed = false;
  const journal = new JobJournal({ path: join(directory, 'jobs.sqlite'), realm: config.realm, siteId: config.siteId, deviceId: gate.receiver.deviceId,
    maxJobs: 64, maxBytes: 8388608, maxPages: 4096, minFreeBytes: 0, ...patches.journal,
    fault: (point, record) => { if (armed) patches.journal?.fault?.(point, record); } });
  const relay = new JobAuditRelay(join(directory, 'audit'));
  const priorJobs = journal.status().jobs;
  const consumer = new LocalJobConsumer({ journal, adapter, authority: () => authority, auditSpool: relay.spool, ...patches.consumer });
  // Explicit isolated recipe is the local operator for a fresh experiment only.
  if (priorJobs === 0 && !consumer.status.degraded) consumer.authorizeRecovery();
  armed = true;
  const original = plant.inputs.find((i: { kind: string }) => i.kind === 'command').message as Command;
  const command = structuredClone(original);
  command.messageId = 'durable-capture-message'; command.command.commandId = 'durable-capture'; command.command.idempotencyKey = 'durable-capture-key';
  command.command.deadline.expiresMonotonicMs = 10000;
  command.body = { type: 'camera.capture', resourceId: 'synthetic-still', maxDurationMs: 8000 };
  function advance(now: number, dock: boolean | null = true) {
    gate.nowMonotonicMs = now;
    for (const c of Object.values(conditions)) { c.sampledAtMs = now; c.validUntilMs = now + 1000; }
    authority.stationary = adapter.stationary;
    const gimbal = adapter.modules.camera.gimbalCommandedDeg(); authority.safeMotionPose = gimbal.pan === 0 && gimbal.tilt === 0;
    conditions.power.value = adapter.modules.power.ready(now) ? 'allow' : 'deny'; conditions.fault.value = adapter.modules.driverFaulted() ? 'deny' : 'allow';
    if (adapter.modules.sensors.read(now).limit.value === true) conditions.protection.value = 'deny';
    if (dock !== null) adapter.modules.disturb({ kind: 'sensor', sensor: 'dock', atMs: now, order: 0, value: dock });
    return consumer.tick();
  }
  return { applied, plant: adapter.plant, authority, adapter, journal, relay, consumer, command, advance,
    close() { adapter.localStop(); relay.close(); journal.close(); } };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // A persistent directory is explicit; no fixture identity becomes deployment configuration.
  if (process.argv.length !== 4 || process.argv[2] !== '--directory') { console.error('ISOLATED_DIRECTORY_REQUIRED'); process.exitCode = 2; }
  else {
    let rig: ReturnType<typeof createJobReference> | undefined;
    try {
      rig = createJobReference(resolve(process.argv[3]));
      let result = rig.consumer.receive(rig.command);
      for (let now = 1000; !['completed', 'failed', 'rejected', 'cancelled'].includes(result.outcome) && now <= 10000; now += 50) result = rig.advance(now)!;
      console.log(JSON.stringify({ evidence: 'synthetic-host-reference', protocol: rig.command.protocol, configurationDigest: rig.applied.configurationDigest,
        calibrationRevision: rig.authority.capturePlan!.calibrationRevision, outcome: result.outcome, state: result.state, error: result.error,
        dispatches: rig.adapter.dispatches.length, captures: rig.adapter.modules.camera.captureCount(), physicalActuationEnabled: false }));
      if (result.outcome !== 'completed') process.exitCode = 1;
    } catch { console.error('LOCAL_JOB_UNAVAILABLE'); process.exitCode = 1; }
    finally { rig?.close(); }
  }
}
