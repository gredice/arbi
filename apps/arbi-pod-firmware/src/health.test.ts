import assert from 'node:assert/strict';
import { test } from 'node:test';
import { collectHealth,type HealthIO } from './health.js';
import { BoundedLogs } from './bounded.js';
test('temperature, historical/current OS flags, storage estimates and unavailable voltage retain provenance',async()=>{
  const io:HealthIO={origin:'os',temperature:async()=> '55123\n',flags:async()=> 'throttled=0X10000\n',freeBytes:async()=>1048576,network:async()=>true};
  const h=await collectHealth(io,()=>52);
  assert.equal(h.temperature.value,55.123);assert.equal(h.temperature.quality,'measured');assert.equal(h.temperature.sampleMonotonicMs,52);
  assert.equal(h.undervoltageNow.value,false);assert.equal(h.undervoltageSinceBoot.value,true);assert.equal(h.undervoltageNow.kind,'os-flag');
  assert.equal(h.freeStorage.value,1048576);assert.equal(h.networkConfigured.quality,'estimated');
  assert.equal(h.voltage.value,null);assert.equal(h.voltage.unit,'V');assert.equal(h.voltage.quality,'unavailable');assert.equal(h.voltage.sampleMonotonicMs,null);
});
test('unreadable, malformed, impossible and timed-out probes do not become zero measurements',async()=>{
  const io:HealthIO={origin:'os',temperature:async()=> 'NaN',flags:async()=> 'throttled=unknown',freeBytes:async()=>NaN,network:()=>new Promise(()=>{})};
  const h=await collectHealth(io,()=>0);
  assert.ok(Object.values(h).every(v=>v.value===null && v.quality==='unavailable' && v.sampleMonotonicMs===null));
});
test('structured logs have bounded retention and no arbitrary secret/media/exception field',()=>{
  const logs=new BoundedLogs('boot-1',()=>3);
  for(let n=0;n<200;n++)logs.record('PEER_REJECTED','connection-1','invalid\nPRIVATE KEY');
  const value=logs.snapshot();assert.equal(value.records.length,128);assert.equal(value.dropped,72);
  assert.equal(value.records[0].sequence,'73');assert.equal(value.records[0].correlationId,null);
  assert.ok(!JSON.stringify(value).includes('PRIVATE'));value.records.length=0;assert.equal(logs.snapshot().records.length,128);
});
