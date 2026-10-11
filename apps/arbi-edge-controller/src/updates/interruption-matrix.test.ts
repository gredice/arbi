import assert from 'node:assert/strict';
import test from 'node:test';
import {runUpdateInterruptionMatrix,updateFaultScenarios} from './interruption-matrix.js';
test('reproducible host interruption matrix independently reconciles actual HTTP payload, audited outcomes and native SIGKILL recovery',{timeout:60000},async()=>{
  const report=await runUpdateInterruptionMatrix();assert.deepEqual(report.cases.map(c=>c.id),updateFaultScenarios);assert.equal(report.cases.length,9);assert.equal(report.crashes.length,4);
  assert.equal(report.physicalAcceptance,false);assert.equal(report.publicOperationReady,false);assert.ok(report.physicalGates.every(g=>g.status==='blocked'));
  assert.ok(report.cases.every(c=>c.traffic.carrierBytes===null&&c.audit.sequenceGaps===0&&c.audit.missingReceipts===0));assert.ok(report.crashes.every(c=>c.installations===1&&c.signal==='SIGKILL'));
});
