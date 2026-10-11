import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { test } from 'node:test';
import { app } from './toolchain.mjs';
const binary=process.env.ARBI_LOCAL_CONTROL_HOST_BIN??join(app,'dist/host','local-control');
function run(mode){const r=spawnSync(binary,[mode],{encoding:'utf8',timeout:10000});assert.equal(r.status,0,r.error?.message??r.stderr);assert.deepEqual(JSON.parse(r.stdout),{sourceModel:'passed',physicalResponseMeasured:false,physicalAcceptance:false});}
test('local command identity, fence, replay, expiry and finite commanded completion',()=>{for(const mode of ['nominal','replay','completion','capacity'])run(mode);});
test('edge loss, manual expiry and trajectory expiry latch state-dependent model responses',()=>{for(const mode of ['link','lease','deadline','idle-loss'])run(mode);});
test('atomic fault load, loop stall, clock reversal, revision, alarm and reset cannot restore movement',()=>{for(const mode of ['faults','stall','clock','revision','alarm','reset'])run(mode);});
