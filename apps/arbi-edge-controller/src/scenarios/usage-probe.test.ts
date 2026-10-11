import assert from 'node:assert/strict';
import test from 'node:test';
import {runControlledUsageProbe} from './usage-probe.js';
test('actual controlled TCP and Linux counters retain retry/residual coverage; exhausted optional budget cannot block local stop or essential payload',{timeout:15000},async()=>{
  const report=await runControlledUsageProbe();assert.equal(report.cases.length,6);assert.equal(report.cases.find(c=>c.id==='bounded-reconnect')!.connections,8);assert.equal(report.cases.find(c=>c.id==='optional-exhaustion-essential-stop')!.localStop,true);
  assert.equal(report.cases.find(c=>c.id==='idle-short-sample')!.application.uploadBytes,'0');assert.equal(report.invoiceSavings,null);assert.equal(report.physicalAcceptance,false);assert.ok(report.cases.every(c=>c.link.coverage==='partial'&&c.link.carrierBytes===null));
});
