import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { validateMessage, validateConfigurationRecord, configurationDigest } from '@arbi/protocol';
import { app } from './toolchain.mjs';

const host = process.env.ARBI_FIRMWARE_HOST_BIN ?? join(app, 'dist/host/firmware');
const fixture = JSON.parse(readFileSync(new URL('../../../packages/arbi-protocol/fixtures/contracts.json', import.meta.url), 'utf8'));
const configuration = readFileSync(join(app, 'dist/generated/configuration.json'));
const key = Buffer.alloc(32, 0x0b);
const command = () => ({ ...structuredClone(fixture.valid.resync), body: { type: 'state.resync', cursor: null, committedCursor: null }, sourceTime: { utc: null, monotonicMs: 1000, uncertaintyMs: null }, ingestTime: null });
const mac = input => createHmac('sha256', key).update('arbi-usb/1.0\0').update(input).digest();
function frame(payload, sequence = 0n, nonce = Buffer.alloc(16)) {
  const json = Buffer.isBuffer(payload) ? payload : Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload));
  const input = Buffer.alloc(29 + json.length);
  input.writeUInt32BE(json.length + 57, 0); input[4] = 1; nonce.copy(input, 5); input.writeBigUInt64BE(sequence, 21); json.copy(input, 29);
  return Buffer.concat([input, mac(input)]);
}
function run(mode, input = Buffer.alloc(0)) {
  const result = spawnSync(host, [mode], { input, timeout: 10000, maxBuffer: 1000000, encoding: 'utf8' });
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
  const observed = JSON.parse(result.stdout);
  assert.equal(observed.status.actuationInhibited, true);
  assert.equal(observed.status.physicalAcceptance, false);
  assert.equal(observed.status.snapshot.body.state, 'Fault');
  assert.deepEqual(observed.status.snapshot.body.capabilities, []);
  assert.deepEqual(observed.status.snapshot.body.supportedCommands, ['state.resync']);
  assert.deepEqual(validateMessage(observed.status.snapshot).ok, true, JSON.stringify(observed.status.snapshot));
  assert.match(observed.status.firmware.revision, /^[a-f0-9]{40}$/u);
  assert.ok(observed.memoryBytes < 65536, `Fixed core memory ${observed.memoryBytes}`);
  return observed;
}
test('target core boot reports every identity and stays inhibited without configuration', () => {
  const boot = run('boot');
  assert.equal(boot.status.configured, false); assert.equal(boot.status.enrolled, false);
  assert.equal(boot.status.configurationDigest, null); assert.equal(boot.status.reason, 'CONFIG_MISSING');
  assert.equal(boot.status.snapshot.body.configRevision, 'unconfigured');
  assert.equal(boot.status.snapshot.source.bootId, 'edge-boot-1');
  assert.equal(boot.status.firmware.board, 'pico2_w');
});
test('same mbedTLS HMAC implementation as target matches independent Node vectors', () => {
  for (const input of [Buffer.alloc(0), Buffer.from('bounded-authentication'), Buffer.alloc(16384, 0xa5)]) {
    const result = spawnSync(host, ['mac'], { input, encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, 0, result.stderr); assert.equal(result.stdout.trim(), mac(input).toString('hex'));
  }
});
test('immutable canonical configuration has shared schema/semantic validation and exact digest', () => {
  const value = JSON.parse(configuration);
  assert.equal(validateConfigurationRecord(value, 'configuration').ok, true);
  const observed = run('config', configuration);
  assert.equal(observed.result, 'CONFIG_LOADED');
  assert.equal(observed.status.configurationDigest, configurationDigest(value));
  assert.equal(observed.status.snapshot.body.configRevision, value.revision);
  for (const changed of [Buffer.alloc(0), configuration.subarray(0, -1), Buffer.concat([configuration, Buffer.from(' ')]), Buffer.alloc(16385), Buffer.from(JSON.stringify({ ...value, schemaVersion: 'arbi.configuration/2.0' })), Buffer.from(configuration.toString().replace('config-1', 'config-2')), Buffer.from('{}')]) {
    const rejected = run('config', changed); assert.equal(rejected.status.configured, false); assert.equal(rejected.status.configurationDigest, null);
  }
});
test('authenticated shared resync command negotiates bounded diagnostic capabilities', () => {
  const payload = command(); assert.equal(validateMessage(payload).ok, true);
  const observed = run('frame', frame(payload));
  assert.equal(observed.result, 'SNAPSHOT'); assert.equal(observed.status.enrolled, true);
  assert.equal(observed.status.reason, 'HARDWARE_READINESS_UNVERIFIED');
  // Key order is not an identity or parser dependency.
  assert.equal(run('frame', frame(Object.fromEntries(Object.entries(payload).reverse()))).result, 'SNAPSHOT');
  const json = Buffer.from(JSON.stringify(payload));
  assert.equal(run('frame', frame(Buffer.concat([json, Buffer.alloc(16384 - json.length, 32)]))).result, 'SNAPSHOT');
});
test('unauthenticated, corrupt and incompatible link frames clear enrollment', () => {
  const good = frame(command());
  assert.equal(run('unenrolled', good).status.enrolled, false);
  for (const offset of [4, 5, 21, 30, good.length - 1]) {
    const bad = Buffer.from(good); bad[offset] ^= 1;
    const observed = run('frame', bad); assert.equal(observed.status.enrolled, false); assert.notEqual(observed.result, 'SNAPSHOT');
  }
  assert.equal(run('frame', frame(command(), 0n, Buffer.alloc(16, 1))).status.enrolled, false);
});
test('truncation and oversize terminate deterministically without trusting later bytes', () => {
  const good = frame(command());
  for (const end of [1, 3, 4, 28, good.length - 1]) {
    const observed = run('timeout', good.subarray(0, end));
    assert.equal(observed.result, 'FRAME_TIMEOUT'); assert.equal(observed.status.enrolled, false);
  }
  for (const size of [0, 57, 16442, 0xffffffff]) {
    const prefix = Buffer.alloc(4); prefix.writeUInt32BE(size);
    const observed = run('frame', prefix); assert.equal(observed.result, 'MESSAGE_TOO_LARGE'); assert.equal(observed.status.enrolled, false);
  }
  assert.equal(run('replay', good).status.enrolled, false);
  assert.equal(run('reconnect', good).status.enrolled, false);
  assert.equal(run('slow', good.subarray(0, 4)).result, 'FRAME_TIMEOUT');
  assert.equal(run('rate', good).status.lastResult, 'RESOURCE_LIMIT');
});
test('malformed JSON, duplicate keys, token/depth bounds and invalid versions cannot bypass admission', () => {
  const valid = JSON.stringify(command());
  for (const raw of ['', '{', valid.slice(0, -1), `${valid}0`, valid.replace('"arbi/1.0"', '"arbi/2.0"'), valid.replace('"protocol":', '"protocol":"arbi/1.0","protocol":'), valid.replace('"state.resync"', '"state.\\u0072esync"'), '{"x":' + '['.repeat(18) + '0' + ']'.repeat(18) + '}', '[' + Array(2049).fill('0').join(',') + ']', valid.replace('"sequence":"10"', '"sequence":"18446744073709551616"'), valid.replace('"sequence":"10"', '"sequence":10'), valid.replace('"monotonicMs":1000', '"monotonicMs":-1'), valid.replace('"cursor":null', '"cursor":false')]) {
    const observed = run('frame', frame(raw)); assert.notEqual(observed.result, 'SNAPSHOT', raw);
  }
});
test('source, target, realm, mode, deadline, unknown fields and all actuator types fail closed', () => {
  const mutations = [
    c => { c.source.bootId = 'other-boot'; }, c => { c.command.target.bootId = 'other-boot'; },
    c => { c.realm.namespaceId = 'other-namespace'; }, c => { c.siteId = 'other-site'; },
    c => { c.executionMode = 'hardware'; }, c => { c.command.deadline.expiresMonotonicMs = 1100; },
    c => { c.command.deadline.expiresMonotonicMs = 11101; }, c => { c.hidden = true; },
    c => { c.command.actor.id = 'bad"actor'; }, c => { c.command.lease = { id: 'lease', holderId: 'cloud', fence: '1' }; },
    ...['motion.move', 'control.stop', 'camera.gimbal', 'camera.capture', 'camera.preview.start', 'camera.preview.stop', 'command.cancel', 'recording.start'].map(type => c => { c.body.type = type; }),
  ];
  for (const mutate of mutations) { const payload = command(); mutate(payload); assert.notEqual(run('frame', frame(payload)).result, 'SNAPSHOT'); }
});
