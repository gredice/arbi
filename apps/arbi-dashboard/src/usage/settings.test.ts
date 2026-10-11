import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { MobilePlan, UsageObservation } from '@arbi/protocol';
import { ruleCrossed, usageReport } from './report';
import { usageSettings, type UsageSettings } from './settings-contracts';

const fixtures=JSON.parse(readFileSync(new URL('../../../../packages/arbi-protocol/fixtures/accounting.json',import.meta.url),'utf8'));
const plan:MobilePlan={...fixtures.plan,allowance:{value:'1000',unit:'bytes'},cycle:{...fixtures.plan.cycle,timezone:'UTC',anchorDay:1},chargedDirections:'upload',rollover:{policy:'none',cap:null}};
const settings:UsageSettings={revision:'usage-1',plan,rules:[{id:'quota-80',kind:'threshold',layer:'interface-wan',thresholdBasisPoints:8000,coverage:'allow-partial',destinationIds:['inbox']}],
  destinations:[{id:'inbox',kind:'operator-inbox'}],forecast:{method:'constant-average',layer:'interface-wan',lookbackHours:1},carryForward:null,transferMode:'low-data'};
const now=Date.parse('2026-01-02T00:00:00.000Z');
const row:UsageObservation={...fixtures.baseObservation,realm:plan.realm,siteId:plan.siteId,linkId:plan.linkId,boundary:'garden-sim',layer:'interface-wan',direction:'upload',scope:'boundary-total',attributionRevision:null,deviceId:null,category:null,
  interval:{start:'2026-01-01T00:00:00.000Z',end:'2026-01-02T00:00:00.000Z'},bytes:'800',media:null,
  evidence:{quality:'measured',coverage:'complete',includes:['payload','transport-overhead','non-arbi','retries'],observedAt:'2026-01-02T00:00:00.000Z',maxAgeMs:60000,reason:null}};
test('usage thresholds include the exact crossing, distinguish estimates, and never treat missing meters as zero',()=>{
  const below=usageReport(settings,now,[{...row,bytes:'799'}],[row],now);
  assert.equal(ruleCrossed(settings.rules[0],below),false);
  const crossed=usageReport(settings,now,[row],[row],now);assert.equal(ruleCrossed(settings.rules[0],crossed),true);
  assert.equal(crossed.layers.find(r=>r.layer==='provider')!.bytes,null);assert.equal(crossed.layers.find(r=>r.layer==='provider')!.remainingBytes,null);
  assert.equal(crossed.currentBitrate.find(r=>r.layer==='interface-wan'&&r.direction==='upload')!.quality,'interval-average-estimate');
  assert.equal(crossed.currentBitrate.find(r=>r.layer==='interface-wan'&&r.direction==='upload')!.bitsPerSecond,'0.074074');
  assert.equal(crossed.carrierBillingTruth,false);assert.equal(crossed.edgePolicyApplication,'not-observed');
  const zero={...settings,plan:{...settings.plan,allowance:{value:'0',unit:'bytes' as const}}};
  assert.equal(ruleCrossed(settings.rules[0],usageReport(zero,now,[{...row,bytes:'0'}],[row],now)),false);
  assert.equal(ruleCrossed(settings.rules[0],usageReport(zero,now,[{...row,bytes:'1'}],[row],now)),true);
});
test('constant-average forecast states its basis; gaps or stale counters remove the projection',()=>{
  const recent={...row,interval:{start:'2026-01-01T23:00:00.000Z',end:row.interval.end},bytes:'10'};
  const report=usageReport(settings,now,[row],[recent],now);
  assert.equal(report.forecast.projectedCycleBytes,'8000');assert.match(report.forecast.assumption,/constant/);
  assert.equal(usageReport(settings,now,[row],[],now).forecast.projectedCycleBytes,null);
  assert.equal(usageReport(settings,now,[row],[recent],now+60001).forecast.projectedCycleBytes,null);
  const unknown=usageReport(settings,now,[],[],now);assert.equal(unknown.layers[1].bytes,null);assert.equal(unknown.layers[1].unknown,true);
});
test('carry is tied to one cycle and settings reject private destinations or forged scope',()=>{
  assert.deepEqual(usageSettings(settings,plan.realm,plan.siteId),settings);
  assert.throws(()=>usageSettings({...settings,plan:{...plan,siteId:'other'}},plan.realm,plan.siteId),{code:'INVALID_REQUEST'});
  assert.throws(()=>usageSettings({...settings,destinations:[{id:'inbox',kind:'webhook',url:'https://private.invalid'}]},plan.realm,plan.siteId),{code:'INVALID_REQUEST'});
  assert.throws(()=>usageSettings({...settings,forecast:{...settings.forecast,lookbackHours:169}},plan.realm,plan.siteId),{code:'INVALID_REQUEST'});
  const carry={...settings,plan:{...plan,rollover:{policy:'capped-one-cycle' as const,cap:{value:'200',unit:'bytes' as const}}},carryForward:{forPeriodStart:'2026-02-01T00:00:00.000Z',unusedBaseBytes:'100'}};
  assert.equal(usageReport(carry,now,[row],[row],now).allowanceBytes,null);
});
