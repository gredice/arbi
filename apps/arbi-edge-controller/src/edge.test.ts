import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { test, type TestContext } from 'node:test';
import { MAX_MESSAGE_BYTES, validateAuditEvent, validateMessage, type Message, type Event, type Identity } from '@arbi/protocol';
import { frame, FrameDecoder } from './framing.js';
import { createSimulation } from './simulation.js';
import { EdgeRuntime } from './runtime.js';
import { LINK_TIMEOUT_MS, validateSettings } from './settings.js';
import { DevelopmentSupervisor } from './supervisor.js';
import type { Hello } from './adapter.js';
import type { TransferRecord } from '@arbi/traffic';

async function until(predicate: () => boolean, timeoutMs = 8000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) { if (Date.now() > deadline) assert.fail('condition timed out'); await delay(20); }
}
async function rig(t: TestContext) {
  const simulation = await createSimulation(); const runtime = new EdgeRuntime(simulation.settings);
  t.after(async () => { await runtime.stop(); await simulation.close(); });
  const port = await runtime.start();
  await until(() => runtime.status.ready);
  return { ...simulation, runtime, port };
}
const actor = { kind: 'service', id: 'simulation-diagnostics' } as const;

test('bounded framing consumes protocol fixtures through fragmented and coalesced streams', () => {
  const fixtures = JSON.parse(readFileSync(new URL('../../../packages/arbi-protocol/fixtures/contracts.json', import.meta.url), 'utf8')) as { valid: Record<string, Message> };
  const originals = Object.values(fixtures.valid); const bytes = Buffer.concat(originals.map(frame));
  const decoder = new FrameDecoder(); const received: unknown[] = [];
  for (let offset = 0; offset < bytes.length; offset += 7) decoder.push(bytes.subarray(offset, offset + 7), (input) => received.push(input));
  assert.deepEqual(received, originals);
  for (const input of received) assert.equal(validateMessage(input).ok, true);
  const all: unknown[] = []; new FrameDecoder().push(bytes, (input) => all.push(input)); assert.deepEqual(all, originals);
});
test('zero, oversized, malformed JSON and invalid UTF8 frames fail before admission', () => {
  for (const size of [0, MAX_MESSAGE_BYTES + 1, 0xffffffff]) {
    const header = Buffer.alloc(4); header.writeUInt32BE(size);
    assert.throws(() => new FrameDecoder().push(header, () => assert.fail('admitted')));
  }
  for (const payload of [Buffer.from('{'), Buffer.from([0xff])]) {
    const header = Buffer.alloc(4); header.writeUInt32BE(payload.length);
    assert.throws(() => new FrameDecoder().push(Buffer.concat([header, payload]), () => assert.fail('admitted')));
  }
});
test('startup validates accepted configuration, identity, unsupported mode and enrollment', async (t) => {
  const simulation = await createSimulation(); t.after(() => simulation.close());
  const input = simulation.settings;
  for (const change of [
    { schemaVersion: 'arbi.edge/99' }, { executionMode: 'hardware' }, { acceptedConfigurationDigest: '0'.repeat(64) },
    { modules: [input.modules[0], input.modules[0]] }, { ignored: true },
    { applied: { ...input.applied, configurationDigest: '0'.repeat(64) } },
    { modules: input.modules.map((m) => ({ ...m, host: '192.0.2.1' })) }
  ]) assert.throws(() => validateSettings({ ...input, ...change }));
  const config = structuredClone(input); config.applied.request.configuration.schemaVersion = 'unsupported' as never;
  assert.throws(() => validateSettings(config));
  const child = spawn(process.execPath, [fileURLToPath(new URL('./cli.js', import.meta.url)), '--config', join(simulation.credentials.directory, 'invalid.json')], { stdio: 'ignore' });
  assert.deepEqual(await once(child, 'exit'), [78, null]);
});
test('health exposes source/build/applied identity; readiness is diagnostic and HTTP has no mutation path', async (t) => {
  const { runtime, port, settings } = await rig(t);
  const response = await fetch(`http://127.0.0.1:${port}/readyz`); assert.equal(response.status, 200);
  const status = await response.json() as typeof runtime.status;
  assert.equal(status.appliedConfiguration.digest, settings.acceptedConfigurationDigest);
  assert.deepEqual(status.source, runtime.identity); assert.notEqual(status.source.bootId, settings.applied.appliedBy.bootId);
  assert.match((status.build as { sourceDigest: string }).sourceDigest, /^[a-f0-9]{64}$/);
  assert.equal(status.actuationEnabled, false); assert.equal(status.updateEnabled, false); assert.equal(status.recordingEnabled, false);
  assert.equal(status.modules.find((m) => m.deviceId === 'pico')!.capabilities.find((c) => c.metric === 'line.tension.a')!.qualities.length, 0);
  assert.equal((await fetch(`http://127.0.0.1:${port}/readyz`, { method: 'POST' })).status, 404);
  await runtime.stop(); assert.equal(runtime.status.ready, false);
  await assert.rejects(fetch(`http://127.0.0.1:${port}/healthz`));
});
test('configured job storage failure is visible and inhibits readiness while diagnostic/local stop remains independent', async (t) => {
  const simulation = await createSimulation();
  simulation.settings.jobs = { journalFile: join(simulation.credentials.directory, 'missing', 'jobs.sqlite'), auditDirectory: join(simulation.credentials.directory, 'audit'),
    maxJobs: 64, maxBytes: 8388608, maxPages: 4096, minFreeBytes: 2147483648 };
  const runtime = new EdgeRuntime(simulation.settings); t.after(async () => { await runtime.stop(); await simulation.close(); });
  const port = await runtime.start(); await until(() => runtime.adapters.every(a => a.status.ready));
  assert.equal(runtime.status.ready, false); assert.equal(runtime.status.jobs.enabled, true); assert.equal(runtime.status.jobs.degraded, true);
  assert.equal(runtime.status.actuationEnabled, false); assert.equal((await fetch(`http://127.0.0.1:${port}/readyz`)).status, 503);
  await runtime.stop(); for (const peer of simulation.peers) assert.equal(peer.localInhibited, true);
});
test('shutdown during pending startup settles the bind and opens no module connection', { timeout: 3000 }, async (t) => {
  const simulation = await createSimulation(); const runtime = new EdgeRuntime(simulation.settings);
  t.after(async () => { await runtime.stop(); await simulation.close(); });
  const starting = runtime.start(); const stopping = runtime.stop();
  await assert.rejects(starting, /RUNTIME_STOPPING/); await stopping;
  assert.equal(runtime.status.healthy, false); assert.equal(runtime.status.ready, false);
  for (const adapter of runtime.adapters) assert.equal(adapter.status.reason, 'SHUTDOWN');
  for (const peer of simulation.peers) assert.equal(peer.diagnosticRequests, 0);
});
test('disconnect/restart renegotiates identity and rejects grants from old connection, boot and edge', async (t) => {
  const { runtime, peers, settings } = await rig(t); const adapter = runtime.adapters[0];
  const old = adapter.status.source!; const grant = adapter.authorizeDiagnostics(actor)!;
  const port = settings.modules[0].port;
  await peers[0].stop(); await until(() => !runtime.status.ready);
  assert.equal(adapter.resync(grant), false);
  peers[0].bootId = 'restarted-boot'; await peers[0].start(port);
  await until(() => runtime.status.ready); assert.notDeepEqual(adapter.status.source, old);
  assert.equal(adapter.resync(grant), false);
  assert.equal(adapter.authorizeDiagnostics({ kind: 'human', id: 'operator-1' }), null);
  const current = adapter.authorizeDiagnostics(actor)!;
  assert.equal(adapter.resync({ ...current, edge: { ...current.edge, bootId: 'other-edge' } }), false);
  const accepted = adapter.authorizeDiagnostics(actor)!;
  assert.equal(adapter.resync(accepted), true); assert.equal(adapter.resync(accepted), false);
  await until(() => peers[0].diagnosticRequests === 1);
  assert.equal(peers[0].actuatorRequests, 0);
});
test('silent/half-framed peer expires readiness and cannot keep authority by sending partial bytes', async (t) => {
  const { runtime, peers, port } = await rig(t); const grant = runtime.adapters[0].authorizeDiagnostics(actor)!;
  peers[0].paused = true;
  const header = Buffer.alloc(4); header.writeUInt32BE(1024); peers[0].sendRaw(header);
  await until(() => !runtime.status.ready, LINK_TIMEOUT_MS + 1000);
  assert.equal(runtime.adapters[0].resync(grant), false);
  assert.equal((await fetch(`http://127.0.0.1:${port}/readyz`)).status, 503);
  peers[0].localStop(); assert.equal(peers[0].localInhibited, true);
});
test('protocol/realm/config negotiation rejects incompatible peers and recovers only after a fresh handshake', async (t) => {
  const { runtime, peers } = await rig(t);
  const patches: Partial<Hello>[] = [{ protocols: ['arbi/99'] }, { siteId: 'other-site' }, { configurationDigest: '0'.repeat(64) }, { realm: { environment: 'test', namespaceId: 'other' } }];
  for (const patch of patches) {
    peers[0].helloPatch = patch; peers[0].disconnect();
    await until(() => !runtime.status.ready);
    await delay(650); assert.equal(runtime.status.ready, false);
    peers[0].helloPatch = {}; peers[0].disconnect(); await until(() => runtime.status.ready);
  }
});
test('trusted CA with wrong enrollment pin cannot establish a ready connection', async (t) => {
  const simulation = await createSimulation(); const input = structuredClone(simulation.settings);
  input.modules[0].certificateSha256 = input.modules[1].certificateSha256;
  const runtime = new EdgeRuntime(input); t.after(async () => { await runtime.stop(); await simulation.close(); });
  await runtime.start(); await until(() => runtime.adapters[1].status.ready);
  await delay(650); assert.equal(runtime.adapters[0].status.ready, false);
  assert.equal(simulation.peers[0].diagnosticRequests, 0);
});
test('oversized/malformed authenticated peers lose readiness immediately', async (t) => {
  const { runtime, peers } = await rig(t);
  const huge = Buffer.alloc(4); huge.writeUInt32BE(MAX_MESSAGE_BYTES + 1);
  for (const bytes of [huge, Buffer.concat([Buffer.from([0, 0, 0, 1]), Buffer.from('{')])]) {
    peers[0].sendRaw(bytes); await until(() => !runtime.status.ready);
    await until(() => runtime.status.ready);
  }
  peers[0].floodSnapshots(); await until(() => !runtime.status.ready); await until(() => runtime.status.ready);
});
test('diagnostic grants expire and are bounded independently of TLS identity', async (t) => {
  const { runtime, peers } = await rig(t); const adapter = runtime.adapters[0];
  const grants = Array.from({ length: 16 }, () => adapter.authorizeDiagnostics(actor)!);
  assert.equal(adapter.authorizeDiagnostics(actor), null);
  await delay(550); assert.equal(adapter.resync(grants[0]), false);
  const fresh = adapter.authorizeDiagnostics(actor)!; assert.ok(fresh);
  assert.equal(adapter.resync(fresh), true); await until(() => peers[0].diagnosticRequests === 1);
});
test('accepted audit vocabulary records authorization only, without persistence or device-effect claims', async (t) => {
  const { runtime } = await rig(t); const adapter = runtime.adapters[0];
  for (let n = 0; n < 40; n++) {
    const grant = adapter.authorizeDiagnostics(actor)!; assert.ok(grant);
    adapter.resync({ ...grant, generation: 'tampered' });
  }
  const audit = adapter.diagnosticAudit;
  assert.equal(audit.records.length, 32); assert.equal(audit.dropped, 8); assert.equal(audit.durable, false);
  for (const record of audit.records) {
    assert.equal(validateAuditEvent(record).ok, true); assert.equal(record.action, 'authorization.check');
    assert.equal(record.evidence, 'authorization'); assert.equal(record.effect, 'none'); assert.equal(record.ingestTime, null);
    assert.equal(record.links.commandId, null); assert.equal(record.record, null);
  }
  audit.records[0].effect = 'device-reported'; assert.equal(adapter.diagnosticAudit.records[0].effect, 'none');
});
test('Linux service definition verifies with systemd-analyze on Linux', { skip: process.platform !== 'linux' }, () => {
  assert.equal(execFileSync('/usr/bin/node', ['--version'], { encoding: 'utf8', timeout: 10000 }).trim(), process.version);
  execFileSync('systemd-analyze', ['verify', fileURLToPath(new URL('../deploy/arbi-edge-controller.service', import.meta.url))], { stdio: 'pipe', timeout: 10000 });
});
test('stale source/session and sequence replay cannot replace the negotiated state', async (t) => {
  const { runtime, peers } = await rig(t);
  const fixtures = JSON.parse(readFileSync(new URL('../../../packages/arbi-protocol/fixtures/contracts.json', import.meta.url), 'utf8')) as { valid: Record<string, Message> };
  const snapshot = Object.values(fixtures.valid).find((m) => m.kind === 'event' && m.body.type === 'state.snapshot') as Event;
  assert.ok(snapshot);
  for (const source of [{ ...runtime.adapters[0].status.source!, bootId: 'stale' }, runtime.adapters[0].status.source!]) {
    const event = structuredClone(snapshot); event.source = source; event.sequence = '0';
    if (event.body.type === 'state.snapshot') event.body.eventCursor = { source, stream: 'event', sequence: '0' };
    peers[0].sendRaw(frame(event)); await until(() => !runtime.status.ready); await until(() => runtime.status.ready);
  }
});
test('portable supervisor restarts crashed child with a new boot and no actuator replay; SIGTERM is clean', async (t) => {
  const simulation = await createSimulation(); const supervisor = new DevelopmentSupervisor(simulation.configFile);
  t.after(async () => { await supervisor.stop(); await simulation.close(); });
  const starts: Array<{ source: Identity; healthPort: number }> = [];
  supervisor.on('status', (status) => starts.push(status)); supervisor.start();
  await until(() => starts.length === 1);
  await until(() => simulation.peers.every((p) => p.localInhibited));
  const health = await fetch(`http://127.0.0.1:${starts[0].healthPort}/healthz`); assert.equal(health.status, 200);
  supervisor.child!.kill('SIGKILL'); await until(() => starts.length === 2);
  assert.notEqual(starts[0].source.bootId, starts[1].source.bootId);
  for (const peer of simulation.peers) { assert.equal(peer.actuatorRequests, 0); assert.equal(peer.diagnosticRequests, 0); peer.localStop(); }
  const exited = once(supervisor, 'exit'); await supervisor.stop();
  assert.deepEqual((await exited)[0], { code: 0, signal: null });
  await delay(400); assert.equal(starts.length, 2);
});
test('supervisor does not loop on invalid startup configuration', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'arbi-invalid-config-')); t.after(() => rmSync(directory, { recursive: true, force: true }));
  const file = join(directory, 'invalid.json'); writeFileSync(file, '{"schemaVersion":"unsupported"}');
  const supervisor = new DevelopmentSupervisor(file); t.after(() => supervisor.stop());
  const blocked = once(supervisor, 'blocked'); supervisor.start();
  assert.deepEqual(await blocked, ['INVALID_CONFIGURATION']);
  await delay(400); assert.equal(supervisor.child, undefined);
});

test('edge and pod taps count actual local TLS frames, reconnects and diagnostics as separate LAN observations', async(t)=>{
  const {runtime,peers}=await rig(t);
  const pod=runtime.adapters.find((a)=>a.status.deviceId==='pod')!;
  assert.equal(pod.resync(pod.authorizeDiagnostics(actor)!),true);
  await until(()=>peers[1].diagnosticRequests===1);await delay(30);
  await Promise.all(peers.map((p)=>p.stop()));await delay(30);
  const edgeRecords=runtime.traffic.pending.map((e)=>e.record).filter((r): r is TransferRecord=>r.kind==='transfer'&&r.spec.scope.linkId==='edge-pod-loopback');
  const podRecords=peers[1].traffic!.spool.pending(64).map((e)=>e.record).filter((r): r is TransferRecord=>r.kind==='transfer');
  const total=(records:typeof edgeRecords,direction:'upload'|'download')=>records.filter((r)=>r.spec.direction===direction).reduce((n,r)=>n+BigInt(r.bytes),0n);
  assert.ok(total(edgeRecords,'upload')>0n);assert.ok(total(edgeRecords,'download')>0n);
  assert.equal(total(edgeRecords,'upload'),total(podRecords,'download'));
  assert.equal(total(edgeRecords,'download'),total(podRecords,'upload'));
  assert.ok(edgeRecords.some((r)=>r.spec.category==='reconnect'));assert.ok(edgeRecords.some((r)=>r.spec.category==='control'));
  for(const r of [...edgeRecords,...podRecords]){assert.equal(r.spec.scope.boundary,'lan');assert.equal(r.gap,'clock-uncertain');assert.equal(r.observations.length,0);}
  assert.equal(runtime.status.metering.gardenWan.bytes,null);assert.equal(runtime.status.metering.provider.bytes,null);
});
test('unavailable or exhausted metering remains explicit and does not gate module diagnostics or local stopping',async(t)=>{
  const simulation=await createSimulation();simulation.settings.metering!.maxRecords=1;simulation.settings.metering!.maxBytes=8192;
  const runtime=new EdgeRuntime(simulation.settings);t.after(async()=>{await runtime.stop();await simulation.close();});
  await runtime.start();await until(()=>runtime.status.ready);assert.equal(runtime.status.metering.spool.degraded,true);
  simulation.peers[1].localStop();assert.equal(simulation.peers[1].localInhibited,true);
  assert.equal(runtime.adapters[1].resync(runtime.adapters[1].authorizeDiagnostics(actor)!),true);
  await until(()=>simulation.peers[1].diagnosticRequests===1);
  await runtime.stop();assert.equal(runtime.status.ready,false);
  const noMetering=structuredClone(simulation.settings);delete noMetering.metering;
  const other=new EdgeRuntime(noMetering);t.after(()=>other.stop());assert.equal(other.status.metering.application,'not-configured');assert.equal(other.status.metering.gardenWan.bytes,null);
});
