import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import { test, type TestContext } from 'node:test';
import { validateAuditEvent, validateMessage, type AuditEvent, type Command } from '@arbi/protocol';
import { checked, SqliteAuditSpool } from '@arbi/audit';
import { createJobReference } from './reference.js';
import { JobJournal } from './journal.js';
import { REQUIRED_INPUTS, type CrashPoint, type JobRecord, type LocalAuthority } from './types.js';

function directory(t: TestContext): string { const d = mkdtempSync(join(tmpdir(), 'arbi-local-jobs-')); t.after(() => rmSync(d, { recursive: true, force: true })); return d; }
function rig(t: TestContext, patches: Parameters<typeof createJobReference>[1] = {}) {
  const r = createJobReference(directory(t), patches); t.after(() => r.close()); return r;
}
function run(r: ReturnType<typeof createJobReference>, dock: boolean | null = true): JobRecord {
  let result = r.journal.get(r.command.command.commandId)!;
  for (let now = r.authority.gate.nowMonotonicMs; now <= 10000 && !['completed', 'failed', 'rejected', 'cancelled'].includes(result.outcome); now += 50) result = r.advance(now, dock)!;
  return result;
}
function next(command: Command, sequence: number): Command {
  const c = structuredClone(command); c.sequence = String(sequence); c.messageId = `msg-${sequence}`;
  c.command.commandId = `command-${sequence}`; c.command.idempotencyKey = `key-${sequence}`; return c;
}

test('complete capture has separate motion, stop, settle, capture, dock and latch evidence; result and audit are immutable', t => {
  const r = rig(t); assert.equal(r.consumer.receive(r.command).outcome, 'accepted');
  assert.equal(r.adapter.dispatches.length, 0);
  const result = run(r); assert.equal(result.outcome, 'completed'); assert.equal(result.state, 'Parked');
  assert.equal(r.adapter.modules.camera.captureCount(), 1);
  assert.deepEqual(r.adapter.dispatches.map(o => o.phase), ['move', 'stop', 'gimbal', 'settle', 'capture', 'gimbal', 'return', 'stop', 'approach', 'dock-stop', 'latch']);
  const records = r.journal.records(r.command.command.commandId);
  for (const record of records) { assert.equal(validateMessage(record.event).ok, true); assert.deepEqual(record.command, r.command); }
  assert.deepEqual(records[0].event.body.type, 'command.outcome');
  assert.equal(records.find(x => x.phase === 'capture')!.steps.find(x => x.phase === 'capture')!.proof, 'captured');
  for (const sample of r.adapter.modules.feedback(3050)) if (sample.metric.startsWith('line.tension')) { assert.equal(sample.quality, 'unavailable'); assert.equal(sample.value, null); }
  assert.equal(r.consumer.status.auditPending, 0);
});
test('lost result delivery, duplicate and reordered transport metadata return identical logical result after expiry and SQLite restart', t => {
  const d = directory(t), r = createJobReference(d); r.consumer.receive(r.command); const result = run(r), command = structuredClone(r.command);
  const retry = { ...command, messageId: 'lost-ack-retry', sequence: '1', sourceTime: { utc: null, uncertaintyMs: null, monotonicMs: 1 } };
  r.authority.gate.nowMonotonicMs = 20000;
  assert.deepEqual(r.consumer.receive(retry).event, result.event); assert.equal(r.adapter.dispatches.length, 11);
  r.close(); const restarted = createJobReference(d); t.after(() => restarted.close());
  restarted.authority.gate.receiver = { ...restarted.authority.gate.receiver, bootId: 'new-edge-boot' };
  assert.deepEqual(restarted.consumer.receive(retry).event, result.event); assert.equal(restarted.adapter.dispatches.length, 0);
  assert.throws(() => restarted.consumer.receive({ ...retry, body: { type: 'camera.capture', resourceId: 'other', maxDurationMs: 8000 } }), /IDEMPOTENCY_CONFLICT/);
  assert.throws(() => restarted.consumer.receive({ ...retry, command: { ...retry.command, commandId: 'new-id' } }), /IDEMPOTENCY_CONFLICT/);
  assert.throws(() => restarted.consumer.receive({ ...retry, source: { ...retry.source, sessionId: 'forged-source' } }), /NOT_AUTHORIZED/);
});
test('persistent source sequence high-water cannot regress through a rejected out-of-order message', t => {
  const r = rig(t); const c = next(r.command, 20); c.body = { type: 'camera.gimbal', panDeg: 0, tiltDeg: 0, frame: r.applied.request.configuration.geometry.gimbalFrame, maxDurationMs: 500 };
  r.consumer.receive(c); for (let n = 1000; n <= 1500 && r.journal.active().length; n += 50) r.advance(n);
  const low = next(c, 1); assert.equal(r.consumer.receive(low).error, 'SEQUENCE_REPLAY');
  assert.equal(r.consumer.receive(next(c, 19)).error, 'SEQUENCE_REPLAY');
  assert.equal(r.adapter.dispatches.length, 1);
});
test('expired commands, receiver clock uncertainty/rollback and old boot/config never dispatch', async t => {
  for (const change of [
    (r: ReturnType<typeof rig>) => { r.authority.gate.nowMonotonicMs = 10000; },
    (r: ReturnType<typeof rig>) => { r.authority.clockReliable = false; },
    (r: ReturnType<typeof rig>) => { r.command.command.target.bootId = 'retired-boot'; r.command.command.deadline.bootId = 'retired-boot'; },
    (r: ReturnType<typeof rig>) => { r.command.command.configRevision = 'old-config'; },
    (r: ReturnType<typeof rig>) => { r.authority.boundary.approvedCalibrationDigests = []; }
  ]) await t.test('deny', sub => { const r = rig(sub); change(r); assert.equal(r.consumer.receive(r.command).outcome, 'rejected'); assert.equal(r.adapter.dispatches.length, 0); });
  const r = rig(t); r.consumer.receive(r.command); r.advance(1000); r.advance(1100);
  assert.throws(() => r.advance(1050), /CLOCK_INVALID/); assert.equal(r.consumer.status.degraded, true);
  assert.equal(r.journal.get(r.command.command.commandId)!.outcome, 'failed');
});
test('every required local input is fail-closed for unknown, unsupported, stale and conflicting revision', async t => {
  for (const name of REQUIRED_INPUTS) for (const mutate of [
    (a: LocalAuthority) => { a.conditions[name].value = 'unknown'; },
    (a: LocalAuthority) => { a.conditions[name].supported = false; },
    (a: LocalAuthority) => { a.conditions[name].validUntilMs = 1000; },
    (a: LocalAuthority) => { a.conditions[name].configurationDigest = '0'.repeat(64); }
  ]) await t.test(name, sub => { const r = rig(sub); mutate(r.authority); assert.equal(r.consumer.receive(r.command).outcome, 'rejected'); assert.equal(r.adapter.dispatches.length, 0); });
});
test('local mode/capabilities/workspace interlocks do not inherit cloud approval or presentation mode', async t => {
  for (const change of [
    (r: ReturnType<typeof rig>) => { r.authority.mode = 'inhibited'; },
    (r: ReturnType<typeof rig>) => { r.authority.state = 'Maintenance'; },
    (r: ReturnType<typeof rig>) => { r.authority.gate.faultInhibited = true; },
    (r: ReturnType<typeof rig>) => { r.authority.stationary = false; },
    (r: ReturnType<typeof rig>) => { r.authority.safeMotionPose = false; },
    (r: ReturnType<typeof rig>) => { r.authority.supportedPhases = ['capture']; },
    (r: ReturnType<typeof rig>) => { r.authority.capturePlan!.positionMm.z = 0; },
    (r: ReturnType<typeof rig>) => { r.authority.capturePlan = null; },
    (r: ReturnType<typeof rig>) => { r.authority.gate.lease!.fence = '9007199254740994'; }
  ]) await t.test('deny', sub => { const r = rig(sub); change(r); assert.equal(r.consumer.receive(r.command).outcome, 'rejected'); assert.equal(r.adapter.dispatches.length, 0); });
});
test('Internet loss ends manual authority; explicitly approved autonomous simulation can finish locally', t => {
  const manual = rig(t); manual.consumer.receive(manual.command); manual.advance(1000); manual.authority.cloudConnected = false;
  assert.equal(manual.advance(1050)!.outcome, 'failed'); assert.equal(manual.adapter.dispatches.length, 1);
  const auto = rig(t); auto.authority.mode = 'autonomous'; auto.authority.continueOffline = true; auto.authority.cloudConnected = false;
  auto.command.command.actor = { kind: 'service', id: 'synthetic-schedule' }; auto.command.command.lease!.holderId = 'synthetic-schedule';
  auto.authority.gate.authorizedActor = auto.command.command.actor; auto.authority.gate.lease!.holderId = 'synthetic-schedule';
  auto.consumer.receive(auto.command); assert.equal(run(auto).outcome, 'completed');
});
test('fault/weather or configuration/calibration/boot/session/generation replacement during work stops without return-home', async t => {
  for (const change of [
    (r: ReturnType<typeof rig>) => { r.authority.conditions.weather.value = 'unknown'; },
    (r: ReturnType<typeof rig>) => { r.authority.conditions.maintenance.value = 'deny'; },
    (r: ReturnType<typeof rig>) => { r.authority.modules.motion.source.bootId = 'reboot'; },
    (r: ReturnType<typeof rig>) => { r.authority.modules.pod.source.sessionId = 'reconnect'; },
    (r: ReturnType<typeof rig>) => { r.authority.modules.motion.generation++; },
    (r: ReturnType<typeof rig>) => { r.authority.applied.configurationDigest = '0'.repeat(64); },
    (r: ReturnType<typeof rig>) => { r.authority.applied.request.configuration.calibration!.revision = 'new-calibration'; },
    (r: ReturnType<typeof rig>) => { r.adapter.modules.disturb({ kind: 'driver-fault', active: true, atMs: 1050, order: 0 }); }
  ]) await t.test('interrupt', sub => { const r = rig(sub); r.consumer.receive(r.command); r.advance(1000); change(r); const result = r.advance(1050)!;
    assert.equal(result.outcome, 'failed'); assert.equal(result.state, 'Fault'); assert.equal(result.phase, 'operator-required'); assert.equal(r.adapter.dispatches.length, 1); assert.equal(r.consumer.status.recoveryRequired, true); });
});
test('arrival and HOME alone cannot prove stopped or Parked; missing, stale, wrong operation or unconfirmed witnesses fault', async t => {
  for (const dock of [null, false]) await t.test('missing-latch', sub => { const r = rig(sub); r.consumer.receive(r.command); const result = run(r, dock);
    assert.equal(result.outcome, 'failed'); assert.equal(result.state, 'Fault'); assert.equal(result.error, 'DEADLINE_EXPIRED'); });
  const r = rig(t); const observe = r.adapter.observe.bind(r.adapter);
  r.adapter.observe = (op, now) => op.phase === 'stop' ? null : observe(op, now);
  r.consumer.receive(r.command); assert.equal(run(r).outcome, 'failed'); assert.equal(r.adapter.modules.camera.captureCount(), 0);
  const wrong = rig(t); wrong.adapter.observe = (op, atMs) => ({ operationId: 'different', kind: op.step.proof, epoch: op.epoch, atMs, origin: 'simulated', confirmed: true });
  wrong.consumer.receive(wrong.command); assert.equal(run(wrong).error, 'EXECUTION_FAILED');
});
test('unconfirmed, stale and mismatched module proof cannot advance a phase', async t => {
  for (const patch of [
    (p: import('./types.js').Proof) => { p.confirmed = false; },
    (p: import('./types.js').Proof) => { p.atMs = 0; },
    (p: import('./types.js').Proof) => { p.epoch = { ...p.epoch, generation: p.epoch.generation + 1 }; }
  ]) await t.test('reject-proof', sub => {
    const r = rig(sub); const observe = r.adapter.observe.bind(r.adapter);
    r.adapter.observe = (op, at) => { const p = observe(op, at); if (p) patch(p); return p; };
    r.consumer.receive(r.command); assert.equal(run(r).error, 'EXECUTION_FAILED'); assert.equal(r.adapter.dispatches.length, 1);
  });
});
test('whole-job duration is bounded even when the receiver deadline or renewed lease is later', t => {
  const r = rig(t); r.command.body = { type: 'camera.capture', resourceId: 'synthetic-still', maxDurationMs: 500 };
  r.consumer.receive(r.command); assert.equal(run(r).error, 'DEADLINE_EXPIRED'); assert.equal(r.adapter.modules.camera.captureCount(), 0);
  assert.ok(r.adapter.dispatches.length <= 3);
});
test('named committed plant references exercise the durable adapter consumer with exact model/config revisions', async t => {
  for (const name of ['nominal', 'seeded', 'dock-unconfirmed', 'power-loss', 'limit-stop', 'out-of-envelope']) await t.test(name, sub => {
    const r = rig(sub, { plant: name });
    if (name === 'out-of-envelope') {
      const original = r.plant.inputs.find(i => i.kind === 'command');
      assert.ok(original?.kind === 'command');
      assert.equal(r.consumer.receive(original.message).error, 'INVALID_RANGE'); assert.equal(r.adapter.dispatches.length, 0); return;
    }
    r.consumer.receive(r.command); let result = r.journal.get(r.command.command.commandId)!;
    const disturbances = r.plant.inputs.filter(i => i.kind !== 'command' && i.kind !== 'cloud' && i.kind !== 'sensor');
    for (let now = 1000; now <= 10000 && !['completed', 'failed'].includes(result.outcome); now += 50) {
      for (const input of disturbances) if (input.atMs === now) r.adapter.modules.disturb(input);
      if (name === 'limit-stop' && now === 1100) r.adapter.modules.disturb({ atMs: now, order: 0, kind: 'sensor', sensor: 'limit', value: true });
      result = r.advance(now, name === 'dock-unconfirmed' ? null : true)!;
    }
    assert.equal(result.outcome, ['nominal', 'seeded'].includes(name) ? 'completed' : 'failed');
    if (name === 'power-loss' || name === 'limit-stop') assert.equal(result.phase, 'operator-required');
  });
});
test('journal admission, audit outbox and immutable records roll back together; failure stops before evidence', t => {
  let failing = false;
  const r = rig(t, { journal: { fault: at => { if (failing && at === 'before-commit') throw new Error('write-failure'); } } });
  failing = true; assert.throws(() => r.consumer.receive(r.command), /STORAGE_UNAVAILABLE/);
  assert.equal(r.journal.get(r.command.command.commandId), null); assert.equal(r.journal.pendingAudit().length, 0); assert.equal(r.adapter.dispatches.length, 0);
  const stopped = r.adapter.stops; r.consumer.localSafetyStop(); assert.ok(r.adapter.stops > stopped); assert.equal(r.consumer.status.degraded, true);
});
test('journal and audit capacity inhibit work, disk quota and real SQLITE_FULL are visible; stop works with a closed database', t => {
  const r = rig(t, { journal: { maxBytes: 8192 } }); assert.throws(() => r.consumer.receive(r.command), /RESOURCE_LIMIT/); assert.equal(r.adapter.dispatches.length, 0);
  const full = rig(t, { journal: { maxPages: 32, maxBytes: 8388608 } });
  full.consumer.receive(full.command); assert.throws(() => run(full), /STORAGE_UNAVAILABLE/); assert.equal(full.consumer.status.degraded, true);
  const disk = rig(t, { journal: { minFreeBytes: Number.MAX_SAFE_INTEGER } }); assert.throws(() => disk.consumer.receive(disk.command), /RESOURCE_LIMIT/);
  const closed = rig(t); closed.consumer.receive(closed.command); closed.advance(1000); closed.journal.close();
  const count = closed.adapter.stops; closed.consumer.localSafetyStop(); assert.ok(closed.adapter.stops > count); assert.equal(closed.consumer.status.degraded, true);
});
test('audit append before local ack is idempotently replayed after restart; no discretionary send before successful audit handoff', t => {
  let fail = true;
  const d = directory(t), r = createJobReference(d, { journal: { fault: at => { if (fail && at === 'after-audit-append') throw new Error('crash-window'); } } });
  assert.throws(() => r.consumer.receive(r.command), /STORAGE_UNAVAILABLE/); assert.equal(r.adapter.dispatches.length, 0);
  const pending = r.journal.pendingAudit(), first = pending[0], spool = r.relay.spool(first); assert.equal(spool.pending().filter(e => e.eventId === first.eventId).length, 1);
  r.close(); fail = false;
  const recovered = createJobReference(d); t.after(() => recovered.close());
  assert.equal(recovered.journal.get(r.command.command.commandId)!.outcome, 'failed');
  const events = recovered.relay.spool(first).pending(64); assert.equal(events.filter(e => e.eventId === first.eventId).length, 1);
  for (const e of events) { assert.equal(validateAuditEvent(e).ok, true); assert.deepEqual(e.actor, r.command.command.actor); }
  assert.equal(recovered.journal.pendingAudit().length, 0); assert.equal(recovered.adapter.dispatches.length, 0);
});
test('audit spool exhaustion or a lost dispatch/observation never permits another discretionary send', t => {
  const d = directory(t); let spool: SqliteAuditSpool | undefined;
  const r = createJobReference(d, { consumer: { auditSpool: event => {
    spool ??= new SqliteAuditSpool({ path: join(d, 'tiny-audit.sqlite'), realm: event.realm, siteId: event.siteId, executionMode: event.executionMode,
      source: event.source, maxEvents: 1, maxBytes: 8192, maxPages: 32 }); return spool;
  } } });
  t.after(() => { r.close(); spool?.close(); });
  assert.throws(() => r.consumer.receive(r.command), /STORAGE_UNAVAILABLE/); assert.equal(r.adapter.dispatches.length, 0); assert.equal(r.consumer.status.degraded, true);
  const lost = rig(t), dispatch = lost.adapter.dispatch.bind(lost.adapter);
  lost.adapter.dispatch = op => { dispatch(op); throw new Error('ack-lost'); };
  lost.consumer.receive(lost.command); assert.throws(() => lost.advance(1000), /ack-lost/);
  assert.equal(lost.journal.get(lost.command.command.commandId)!.outcome, 'failed');
  assert.equal(lost.consumer.tick(), null); assert.equal(lost.adapter.dispatches.length, 1);
});
test('restart remains inhibited until attributable fresh local reconciliation; cloud command and stale stop booleans cannot release it', t => {
  const d = directory(t), initial = createJobReference(d); initial.consumer.receive(initial.command); initial.advance(1000); initial.close();
  const r = createJobReference(d); t.after(() => r.close());
  assert.equal(r.consumer.status.recoveryRequired, true);
  assert.equal(r.consumer.receive(next(r.command, 20)).outcome, 'rejected');
  const original = r.authority.reconciliation!; r.authority.reconciliation = null;
  assert.throws(() => r.consumer.authorizeRecovery(), /FAULT_INHIBITED/);
  r.authority.reconciliation = { ...original, atMs: -1000 };
  assert.throws(() => r.consumer.authorizeRecovery(), /FAULT_INHIBITED/);
  r.authority.reconciliation = { ...original, stopped: false };
  assert.throws(() => r.consumer.authorizeRecovery(), /FAULT_INHIBITED/);
  r.authority.reconciliation = original; r.consumer.authorizeRecovery(); assert.equal(r.consumer.status.recoveryRequired, false);
  assert.equal(r.consumer.receive(next(r.command, 21)).outcome, 'accepted');
});
test('authorized remote stop preempts before journaling and needs a separate proof without clearing local recovery', t => {
  const r = rig(t); r.consumer.receive(r.command); r.advance(1000);
  const stop = next(r.command, 20); stop.body = { type: 'control.stop', reason: 'operator' }; stop.command.lease = null;
  const stops = r.adapter.stops; assert.equal(r.consumer.receive(stop).outcome, 'accepted'); assert.ok(r.adapter.stops > stops);
  assert.equal(r.journal.get(r.command.command.commandId)!.outcome, 'cancelled');
  r.advance(1050); const completed = r.advance(1100)!; assert.equal(completed.outcome, 'completed'); assert.equal(completed.state, 'Fault');
  assert.equal(r.consumer.status.recoveryRequired, true); assert.equal(r.adapter.modules.camera.captureCount(), 0);
});
test('bounded audit recovery cannot dispatch while older pending copies leave the new intent beyond the batch limit', t => {
  const d = directory(t), r = createJobReference(d);
  for (let sequence = 20; sequence < 55; sequence++) r.journal.create(next(r.command, sequence), r.authority, [], 'NOT_AUTHORIZED');
  assert.equal(r.journal.pendingAudit().length, 64); r.close();
  const restarted = createJobReference(d); t.after(() => restarted.close());
  assert.equal(restarted.consumer.status.degraded, true); assert.ok(restarted.journal.pendingAudit().length > 0);
  assert.equal(restarted.consumer.receive(next(restarted.command, 100)).outcome, 'rejected'); assert.equal(restarted.adapter.dispatches.length, 0);
});
test('a second live owner is denied; records/outcomes/outbox resist update, deletion and contradictory terminal append', t => {
  const d = directory(t), r = createJobReference(d); t.after(() => r.close());
  const options = { path: join(d, 'jobs.sqlite'), realm: r.command.realm, siteId: r.command.siteId, deviceId: 'edge', maxJobs: 64, maxBytes: 8388608, maxPages: 4096, minFreeBytes: 0 };
  assert.throws(() => new JobJournal(options), /RESOURCE_LIMIT/);
  r.consumer.receive(r.command); run(r);
  assert.throws(() => r.journal.change(r.command.command.commandId, () => {}, 'failed', 'EXECUTION_FAILED'), /INVALID_TRANSITION/);
  const db = new DatabaseSync(options.path); t.after(() => db.close());
  for (const table of ['jobs', 'records', 'audit_intents', 'evidence']) { assert.throws(() => db.exec(`DELETE FROM ${table}`), /immutable/); assert.throws(() => db.exec(`UPDATE ${table} SET body='{}'`), /immutable/); }
  for (const row of db.prepare('SELECT body FROM audit_intents').all()) checked(JSON.parse(String(row.body)));
});
test('SIGKILL at every phase commit, send, receipt, proof and audit-copy boundary requires operator recovery and never redispatches', { timeout: 300000 }, async t => {
  const points: CrashPoint[] = ['before-commit', 'after-commit', 'before-send', 'after-send', 'before-receipt', 'after-receipt', 'before-proof', 'after-proof'];
  for (const point of points) for (let index = 1; index <= (point.endsWith('commit') ? 34 : 11); index++) {
    const d = directory(t);
    const child = spawn(process.execPath, [fileURLToPath(new URL('./crash-worker.js', import.meta.url)), d, point, String(index)], { stdio: 'pipe' });
    let errors = ''; child.stderr.on('data', chunk => { errors += String(chunk); });
    const [code, signal] = await once(child, 'exit'); assert.equal(signal, 'SIGKILL', `${point}:${index} exit=${code} ${errors}`);
    const restarted = createJobReference(d);
    try {
      const result = restarted.journal.get(restarted.command.command.commandId)!;
      // The final proof COMMIT is already authoritative when its after-hook crashes.
      const complete = point === 'after-proof' && index === 11 || point === 'after-commit' && index === 34;
      const absent = point === 'before-commit' && index === 1;
      assert.equal(result?.outcome ?? null, absent ? null : complete ? 'completed' : 'failed', `${point}:${index}`);
      if (!absent && !complete) { assert.equal(result.error, 'INTERRUPTED'); assert.equal(result.phase, 'operator-required'); assert.equal(restarted.consumer.status.recoveryRequired, true); }
      if (!absent) assert.deepEqual(restarted.consumer.receive(restarted.command).event, result.event);
      assert.equal(restarted.consumer.tick(), null); assert.equal(restarted.adapter.dispatches.length, 0);
      restarted.journal.verify();
    } finally { restarted.close(); }
  }
  for (const [point, index] of [['before-commit', 1], ['after-commit', 1], ['after-audit-append', 1]] as const) {
    const d = directory(t), child = spawn(process.execPath, [fileURLToPath(new URL('./crash-worker.js', import.meta.url)), d, point, String(index)], { stdio: 'ignore' });
    assert.equal((await once(child, 'exit'))[1], 'SIGKILL');
    const r = createJobReference(d); try { const result = r.journal.get(r.command.command.commandId); assert.equal(result?.outcome ?? null, point === 'before-commit' ? null : 'failed'); assert.equal(r.adapter.dispatches.length, 0); r.journal.verify(); } finally { r.close(); }
  }
});
