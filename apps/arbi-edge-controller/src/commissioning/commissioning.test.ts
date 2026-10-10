import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { configurationDigest, configurationHardwareDigest, validateAuditEvent } from '@arbi/protocol';
import { CommissioningError, resolveLineReference, resolveTarget, validateSet, type CommissioningSet } from './contracts.js';
import { createCommissioningReference } from './reference.js';
import { JobAuditRelay } from '../jobs/audit-relay.js';
import { createJobReference } from '../jobs/reference.js';
import { policy } from '../jobs/admission.js';
import { CommissioningStore } from './store.js';
import { createSimulation } from '../simulation.js';
import { EdgeRuntime } from '../runtime.js';

const cleanups = new WeakMap<TestContext, (() => void)[]>();
function cleanup(t: TestContext, action: () => void) {
  let callbacks = cleanups.get(t);
  if (!callbacks) { callbacks = []; cleanups.set(t, callbacks); t.after(() => { for (const callback of callbacks!.reverse()) callback(); }); }
  callbacks.push(action);
}
function directory(t: TestContext) { const path = mkdtempSync(join(tmpdir(), 'arbi-commission-')); cleanup(t, () => rmSync(path, { recursive: true, force: true })); return path; }
async function rig(t: TestContext, options: Parameters<typeof createCommissioningReference>[1] = {}) {
  const path = directory(t), reference = await createCommissioningReference(path, options); cleanup(t, () => reference.close()); return { ...reference, path };
}
async function stage(r: Awaited<ReturnType<typeof rig>>, set = r.set) {
  await r.enrollAll();
  const response = await r.request('stage', { set, reason: 'fixture-review' });
  assert.equal(response.status, 200, JSON.stringify(await response.json()));
}
test('golden site, bed and plant optical targets produce explicit pod coordinates and corrected framing', async t => {
  const r = await rig(t);
  for (const [id, positionMm] of [['site-target', { x: 990, y: 2000, z: 2480 }], ['bed-target', { x: 1190, y: 1750, z: 2480 }], ['plant-target', { x: 990, y: 1500, z: 2480 }]] as const) {
    assert.deepEqual(resolveTarget(r.set, id), { positionMm, panDeg: 8, tiltDeg: -24, siteFrame: r.set.configuration.geometry.siteFrame, gimbalFrame: r.set.configuration.geometry.gimbalFrame });
  }
  for (const line of ['a', 'b', 'c', 'd'] as const) assert.equal(resolveLineReference(r.set, line, r.set.dock.positionMm).turnsFromHome, 0);
  assert.ok(resolveLineReference(r.set, 'a', { ...r.set.dock.positionMm, z: 2000 }).turnsFromHome > 0);
  assert.ok(resolveLineReference(r.set, 'b', { ...r.set.dock.positionMm, z: 2000 }).turnsFromHome < 0);
  const mutations: ((s: CommissioningSet) => void)[] = [
    s => { (s as unknown as Record<string, unknown>).units = 'm'; },
    s => { s.camera.frame.revision = 'other-frame'; },
    s => { s.configuration.schemaVersion = 'arbi.configuration/99' as never; },
    s => { s.targets[0]!.positionMm.x = 100_000; },
    s => { s.targets[0]!.plantId = 'unknown-plant'; },
    s => { s.axes[0]!.positiveDirection = 0 as never; },
    s => { s.axes[0]!.homePayoutMm = 100; },
    s => { s.dock.positionMm.z = -20; },
    s => { s.camera.rotationDeg.x = 10; },
    s => { s.configuration.calibration!.scope = 'installed'; },
  ];
  for (const mutation of mutations) { const set = structuredClone(r.set); mutation(set); assert.throws(() => validateSet(set), CommissioningError); }
});
test('signed site capabilities and fresh matching local maintenance authorization are both required and denials are audited', async t => {
  const r = await rig(t);
  assert.equal((await r.request('enroll', { deviceId: 'edge', reason: 'fixture' }, 'invalid')).status, 401);
  const viewer = { kind: 'human' as const, id: 'viewer' };
  r.provider.putPrincipal({ actor: viewer, accountId: 'fixture-account', member: true, sites: { [r.set.configuration.siteId]: { roles: ['viewer'], active: true, revision: 'v1', serviceScopes: [] } } });
  const viewerToken = await r.provider.issue(viewer);
  assert.equal((await r.request('enroll', { deviceId: 'edge', reason: 'fixture' }, viewerToken.token)).status, 403);
  assert.equal((await r.request('enroll', { deviceId: 'edge', reason: 'fixture' }, undefined, 'other-site')).status, 409);
  r.local(null);
  assert.equal((await r.request('enroll', { deviceId: 'edge', reason: 'fixture' })).status, 403);
  assert.equal(r.store.state().enrollments.length, 0);
  assert.ok(r.store.pendingAudit().some(e => e.outcome === 'deny'));
  for (const event of r.store.pendingAudit()) assert.equal(validateAuditEvent(event).ok, true);
  assert.equal((await r.request('status', undefined, viewerToken.token)).status, 403);
});
test('request bodies cannot smuggle actor, local grants, units or device credentials', async t => {
  const r = await rig(t);
  for (const field of ['actor', 'authorizationId', 'credentials', 'localAuthorization']) {
    assert.equal((await r.request('enroll', { deviceId: 'edge', reason: 'fixture', [field]: 'forged' })).status, 409);
  }
  r.advance(60_000);
  assert.equal((await r.request('enroll', { deviceId: 'edge', reason: 'fixture' })).status, 403);
  assert.equal(r.store.state().enrollments.length, 0);
});
test('activation commits exact all-device identities and reports active/staged/rejected status', async t => {
  const r = await rig(t); await stage(r);
  assert.equal(r.coordinator.status.ready, false);
  assert.equal(r.coordinator.status.staged!.digest, configurationDigest(r.set));
  const activation = await r.request('activate'); assert.equal(activation.status, 200, JSON.stringify(await activation.json()));
  assert.equal(r.coordinator.status.ready, true); assert.equal(r.coordinator.status.staged, null);
  assert.equal(r.store.state().reports.length, 3);
  for (const [id, device] of r.devices) { assert.equal(device.inspect().activeSetDigest, configurationDigest(r.set)); assert.equal(device.inspect().identity.deviceId, id); }
  const bad = structuredClone(r.set); bad.camera.translationMm.x++;
  assert.equal((await r.request('stage', { set: bad, reason: 'fixture-drift' })).status, 409);
  assert.equal(r.coordinator.status.rejected!.reason, 'RECALIBRATION_REQUIRED');
  assert.equal(r.coordinator.status.active!.digest, configurationDigest(r.set));
  assert.ok(r.store.pendingAudit().some(e => e.action === 'configuration.change' && e.change?.after.state === 'active' && e.actor.kind === 'human'));
});
test('all preparation precedes activation; failed preparation changes no active device', async t => {
  const r = await rig(t); await stage(r);
  r.devices.get('pod')!.fault = point => { if (point === 'prepare') throw new Error('isolated-failure'); };
  assert.equal((await r.request('activate')).status, 503);
  assert.equal(r.coordinator.status.ready, false);
  for (const device of r.devices.values()) assert.equal(device.inspect().activeSetDigest, null);
});
test('partial activation blocks admission and phases; deliberate recovery completes the exact staged set', async t => {
  const r = await rig(t); await stage(r);
  const pico = r.devices.get('pico')!;
  pico.fault = point => { if (point === 'before-device-commit') throw new CommissioningError('INCOMPATIBLE_DEVICE'); };
  assert.equal((await r.request('activate')).status, 409);
  assert.equal(r.devices.get('edge')!.inspect().activeSetDigest, configurationDigest(r.set));
  assert.equal(r.devices.get('pod')!.inspect().activeSetDigest, null);
  assert.equal(r.coordinator.status.ready, false);
  const jobs = createJobReference(join(r.path, 'jobs')); cleanup(t, () => jobs.close());
  jobs.authority.commissioning = () => ({ ready: r.coordinator.status.ready, configurationDigest: r.coordinator.status.active?.configurationDigest ?? null });
  assert.equal(policy(jobs.command, jobs.authority), 'CONFIG_MISMATCH');
  assert.equal(policy(jobs.command, jobs.authority, true), 'CONFIG_MISMATCH');
  const stop = structuredClone(jobs.command); stop.body = { type: 'control.stop', reason: 'operator' };
  assert.equal(policy(stop, jobs.authority), null);
  pico.fault = undefined;
  const recovery = await r.request('recover'); assert.equal(recovery.status, 200, JSON.stringify(await recovery.json()));
  assert.equal(r.coordinator.status.ready, true);
  assert.equal(r.devices.get('edge')!.activationRequests.length, 1, 'committed device is observed, never blindly reapplied');
  jobs.authority.applied.request.configuration = structuredClone(r.set.configuration);
  jobs.authority.applied.configurationDigest = configurationDigest(r.set.configuration);
  jobs.command.command.configRevision = r.set.configuration.revision;
  jobs.authority.gate.configRevision = r.set.configuration.revision;
  jobs.authority.boundary.installedHardwareDigest = configurationHardwareDigest(r.set.configuration);
  jobs.authority.boundary.approvedCalibrationDigests = [configurationDigest(r.set.configuration.calibration)];
  jobs.authority.boundary.localLimits.panDeg = { min: -180, max: 180 }; jobs.authority.boundary.localLimits.tiltDeg = { min: -180, max: 180 };
  for (const input of Object.values(jobs.authority.conditions)) input.configurationDigest = jobs.authority.applied.configurationDigest;
  for (const epoch of Object.values(jobs.authority.modules)) epoch.configurationDigest = jobs.authority.applied.configurationDigest;
  assert.equal(policy(jobs.command, jobs.authority), null);
  await r.request('invalidate'); assert.equal(policy(jobs.command, jobs.authority), 'CONFIG_MISMATCH');
});
test('drum, line, anchor, camera, firmware and schema changes revoke readiness until exact independent review/recalibration', async t => {
  const r = await rig(t); await stage(r); assert.equal((await r.request('activate')).status, 200);
  for (const id of ['drum-a', 'powered-line', 'anchor-a', 'camera', 'edge']) {
    const set = structuredClone(r.set); set.configuration.components.find(component => component.id === id)!.hardwareRevision = '2.0.0';
    set.configuration.calibration!.hardwareDigest = configurationHardwareDigest(set.configuration);
    assert.equal((await r.request('stage', { set, reason: 'fixture-replacement' })).status, 409);
    assert.equal(r.coordinator.status.rejected!.reason, 'RECALIBRATION_REQUIRED');
  }
  const original = r.devices.get('pod')!.inspect.bind(r.devices.get('pod')!);
  r.devices.get('pod')!.inspect = () => { const observation = original(); observation.component.firmwareVersion = 'incompatible-2'; return observation; };
  assert.equal(r.coordinator.status.blockedReason, 'DEVICE_CHANGED');
  r.devices.get('pod')!.inspect = original;
  assert.equal(r.coordinator.status.ready, false, 'restored metadata alone cannot release the latched inhibit');
  assert.equal((await r.request('recover')).status, 200);
  r.calibrationApprovals.length = 0;
  assert.equal(r.coordinator.status.blockedReason, 'CALIBRATION_NOT_APPROVED');
});
test('incompatible readers, excessive limits and identity/site replacement are rejected before activation', async t => {
  const r = await rig(t); await r.enrollAll();
  const boundary = r.composition.boundary;
  r.composition.boundary = e => ({ receiver: e.identity, realm: e.realm, siteId: e.siteId, executionMode: 'simulation', calibrationScope: 'simulation',
    installedHardwareDigest: e.hardwareDigest, localLimits: r.set.configuration.limits, approvedCalibrationDigests: [configurationDigest(r.set.configuration.calibration)],
    readableSchemaVersions: [], rollbackReadableSchemaVersions: [], authorizedActor: r.grant!.actor, authorizationId: r.grant!.id, inhibited: true });
  assert.equal((await r.request('stage', { set: r.set, reason: 'fixture-reader' })).status, 409);
  assert.equal(r.coordinator.status.rejected!.reason, 'UNSUPPORTED_SCHEMA');
  r.composition.boundary = e => { const local = boundary(e); local.localLimits = structuredClone(local.localLimits); local.localLimits.maxSpeedMmPerS = 1; return local; };
  assert.equal((await r.request('stage', { set: r.set, reason: 'fixture-limit' })).status, 409);
  assert.equal(r.coordinator.status.rejected!.reason, 'LIMIT_EXPANSION');
  r.composition.boundary = boundary;
  const device = r.devices.get('pico')!, inspect = device.inspect.bind(device);
  device.inspect = () => ({ ...inspect(), siteId: 'other-site' });
  assert.equal((await r.request('enroll', { deviceId: 'pico', reason: 'fixture-site' })).status, 409);
  device.inspect = () => ({ ...inspect(), identity: { ...inspect().identity, bootId: 'new-boot' } });
  assert.equal((await r.request('stage', { set: r.set, reason: 'fixture-boot' })).status, 409);
  assert.equal(r.coordinator.status.rejected!.reason, 'DEVICE_CHANGED');
});
test('mismatched applied reports and changed approved revisions cannot produce readiness', async t => {
  const r = await rig(t); await stage(r);
  const device = r.devices.get('pico')!, activate = device.activate.bind(device);
  device.activate = async (...args) => ({ ...await activate(...args), configurationDigest: '0'.repeat(64) });
  assert.equal((await r.request('activate')).status, 409);
  assert.equal(r.coordinator.status.blockedReason, 'ACTIVATION_MISMATCH');
  assert.equal(r.devices.get('pod')!.inspect().activeSetDigest, null);
  device.activate = activate;
  assert.equal((await r.request('recover')).status, 200);
  const changed = structuredClone(r.set); changed.camera.translationMm.x++;
  r.approved.push(configurationDigest(changed));
  assert.equal((await r.request('stage', { set: changed, reason: 'fixture-revision' })).status, 409);
  assert.equal(r.coordinator.status.rejected!.reason, 'REVISION_CONFLICT');
});
test('bounded missing device response and revoked technician session never release readiness', async t => {
  const r = await rig(t, { timeoutMs: 10 }); await stage(r);
  r.devices.get('pod')!.prepare = () => new Promise(() => {});
  assert.equal((await r.request('activate')).status, 409);
  assert.equal(r.coordinator.status.blockedReason, 'DEVICE_TIMEOUT');
  const r2 = await rig(t); await stage(r2);
  const original = r2.devices.get('edge')!.activate.bind(r2.devices.get('edge')!);
  r2.devices.get('edge')!.activate = async (...args) => { const result = await original(...args); r2.provider.revoke(r2.credential.sessionId); return result; };
  assert.equal((await r2.request('activate')).status, 409);
  assert.equal(r2.coordinator.status.blockedReason, 'NOT_AUTHORIZED');
  assert.equal(r2.devices.get('pico')!.inspect().activeSetDigest, null);
});
test('SIGKILL after independent device commit reconciles audit and exact identity without replaying that activation', async t => {
  const path = directory(t);
  const child = spawnSync(process.execPath, [new URL('./crash-worker.js', import.meta.url).pathname, path], { timeout: 15000, encoding: 'utf8' });
  assert.equal(child.signal, 'SIGKILL', child.stderr);
  const r = await createCommissioningReference(path); cleanup(t, () => r.close());
  assert.equal(r.coordinator.status.ready, false); assert.equal(r.coordinator.status.blockedReason, 'RESTART_RECONCILIATION_REQUIRED');
  await r.enrollAll();
  const response = await r.request('recover'); assert.equal(response.status, 200, JSON.stringify(await response.json()));
  assert.equal(r.coordinator.status.ready, true);
  assert.equal(r.devices.get('edge')!.activationRequests.length, 0);
  assert.equal(r.devices.get('pico')!.activationRequests.length, 1);
  const relay = new JobAuditRelay(join(path, 'audit')); cleanup(t, () => relay.close());
  while (r.store.pendingAudit().length) r.store.flushAudit(relay.spool);
  assert.equal(r.store.pendingAudit().length, 0);
  r.store.verify();
});
test('store ownership and transaction failure keep state and audit admission atomic', async t => {
  let fail = false;
  const r = await rig(t, { store: { fault: point => { if (fail && point === 'before-commit') throw new Error('simulated-disk-failure'); } } });
  assert.throws(() => new CommissioningStore({ path: join(r.path, 'commissioning.sqlite'), realm: r.set.configuration.realm, siteId: r.set.configuration.siteId, source: r.identity }), /STORE_OWNED/);
  await r.enrollAll();
  const before = r.store.history().length, audits = r.store.pendingAudit().length;
  fail = true;
  assert.equal((await r.request('stage', { set: r.set, reason: 'fixture-storage' })).status, 503);
  assert.equal(r.store.history().length, before); assert.equal(r.store.pendingAudit().length, audits);
  assert.equal(r.store.state().staged, null); assert.equal(r.coordinator.status.ready, false);
});
test('audit handoff lost after append deduplicates exact historical events; capacity denies discretionary requests', async t => {
  const r = await rig(t); await stage(r);
  const event = r.store.pendingAudit()[0]!, relay = new JobAuditRelay(join(r.path, 'audit')); cleanup(t, () => relay.close());
  const spool = relay.spool(event), append = spool.append.bind(spool);
  let crash = true;
  spool.append = input => { const result = append(input); if (crash) throw new Error('lost-copy-ack'); return result; };
  assert.throws(() => r.store.flushAudit(relay.spool)); assert.equal(spool.pending()[0]!.eventId, event.eventId);
  crash = false;
  while (r.store.pendingAudit().length) r.store.flushAudit(relay.spool);
  assert.equal(spool.pending().filter(e => e.eventId === event.eventId).length, 1);
  const small = await rig(t, { store: { maxRecords: 1 } });
  assert.equal((await small.request('enroll', { deviceId: 'edge', reason: 'fixture' })).status, 200);
  assert.equal((await small.request('enroll', { deviceId: 'pico', reason: 'fixture' })).status, 409);
  assert.equal(small.coordinator.status.ready, false);
  assert.equal(small.store.state().enrollments.length, 1);
});
test('trusted runtime composition mounts authenticated loopback routes and keeps mismatched loaded configuration unready', async t => {
  const simulation = await createSimulation(), runtime = new EdgeRuntime(simulation.settings);
  const path = directory(t), r = await createCommissioningReference(path, { identity: runtime.identity });
  runtime.composeCommissioning(r.server);
  let port: number;
  try {
    port = await runtime.start();
    const url = `http://127.0.0.1:${port}/sites/${r.set.configuration.siteId}/commissioning/`;
    assert.equal((await fetch(`${url}status`)).status, 401);
    const headers = { authorization: `Bearer ${r.credential.token}`, origin: 'http://localhost', 'x-arbi-request': '1', 'content-type': 'application/json' };
    const status = await fetch(`${url}status`, { headers }); assert.equal(status.status, 200);
    for (const deviceId of r.devices.keys()) assert.equal((await fetch(`${url}enroll`, { method: 'POST', headers, body: JSON.stringify({ deviceId, reason: 'fixture-http' }) })).status, 200);
    assert.equal((await fetch(`${url}stage`, { method: 'POST', headers, body: JSON.stringify({ set: r.set, reason: 'fixture-http' }) })).status, 200);
    assert.equal((await fetch(`${url}activate`, { method: 'POST', headers, body: JSON.stringify({ reason: 'fixture-http' }) })).status, 200);
    assert.equal(r.coordinator.status.ready, true);
    assert.equal(runtime.status.ready, false, 'diagnostic/runtime loader must match newly active configuration');
    assert.equal((await fetch(`http://127.0.0.1:${port}/readyz`)).status, 503);
  } finally { await runtime.stop(); r.close(); await simulation.close(); }
});
