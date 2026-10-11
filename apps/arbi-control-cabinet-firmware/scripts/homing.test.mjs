import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { test } from 'node:test';
import { app } from './toolchain.mjs';
const binary=process.env.ARBI_HOMING_HOST_BIN??join(app,'dist/host','homing');
function run(mode){const r=spawnSync(binary,[mode],{encoding:'utf8',timeout:5000});assert.equal(r.status,0,r.error?.message??r.stderr);return JSON.parse(r.stdout);}
test('debounce, immediate critical assertion, stale timestamps, bounce and fault latching',()=>{
  assert.deepEqual(run('debounce'),{debounce:'passed',physicalInputs:false});assert.deepEqual(run('policy'),{policy:'passed',physicalInputs:false});
});
test('coordinated model release, seek, backoff and slow reference finish all axes with bounded one-step plans',()=>{
  for(const mode of ['nominal','initial-active']){const r=run(mode);assert.equal(r.referenceValid,true);assert.ok(r.elapsedMs<5000);assert.equal(r.physicalInputs,false);assert.equal(r.physicalAcceptance,false);assert.equal(r.parkedAsserted,false);}
});
test('stuck, disconnected, contradictory, alarm, limit, missing, stale, expired and replaced revision cannot finish',()=>{
  for(const mode of ['stuck-off','stuck-on','disconnected','contradictory','alarm','limit','unavailable','stale','timeout','revision','implausible']){
    const r=run(mode);assert.equal(r.referenceValid,false);assert.equal(r.phase,7);assert.ok(r.elapsedMs<=5000);assert.equal(r.physicalAcceptance,false);
  }
});
