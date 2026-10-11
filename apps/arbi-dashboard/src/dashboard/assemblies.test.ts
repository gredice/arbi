import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assemblyInventory, appendObservation, detailObservation, diagnosticExport, diagnosticReadings } from './assemblies';
import { createSimulatorRead, syntheticConfiguration } from './simulator';
const realm={environment:'test' as const,namespaceId:'diagnostics-test'};
async function fixture(){let now=1000;const read=createSimulatorRead(realm,()=>now),state=await read('synthetic-site'),config=syntheticConfiguration(realm,'synthetic-site');
  const assemblies=assemblyInventory(config,state);return {state,config,assemblies,next:async()=>{now++;return read('synthetic-site');}};}
test('inventory includes every baseline assembly and uninstrumented channels without synthesized measurements',async()=>{
  const f=await fixture();assert.equal(f.assemblies.length,19);
  for(const id of ['cabinet','edge','pico','station-a','station-b','station-c','station-d','winch-a','winch-b','winch-c','winch-d','line-a','line-b','line-c','line-d','pod','gimbal','camera','dock'])assert.ok(f.assemblies.some(a=>a.id===id));
  const line=f.assemblies.find(a=>a.id==='line-a')!;assert.equal(diagnosticReadings(line,f.state,1000).find(r=>r.metric==='line.tension.a')!.value,null);
  const pico=f.assemblies.find(a=>a.id==='pico')!;assert.equal(diagnosticReadings(pico,f.state,1000)[0]!.quality,'unavailable');
  assert.equal(assemblyInventory(null,{...f.state,snapshot:null,telemetry:null}).length,19);
});
test('measured quality requires declared capability; stale estimated/commanded values preserve original provenance',async()=>{
  const f=await fixture(),pod=f.assemblies.find(a=>a.id==='pod')!;const sample=f.state.telemetry!.body.samples.find(s=>s.metric==='position.z')!;
  sample.quality='measured';assert.equal(diagnosticReadings(pod,f.state,1000).find(r=>r.metric===sample.metric)!.quality,'unavailable');
  pod.capabilities=[{metric:'position.z',qualities:['measured']}];assert.equal(diagnosticReadings(pod,f.state,1000).find(r=>r.metric===sample.metric)!.quality,'measured');
  sample.quality='estimated';const old=diagnosticReadings(pod,f.state,12000).find(r=>r.metric===sample.metric)!;
  assert.equal(old.quality,'stale');assert.equal(old.originQuality,'estimated');assert.equal(old.sourceTime!.utc,null);assert.equal(old.receivedAtMs,1000);
});
test('late/repeated samples never regress history; missing sequences, boot/config changes and bounded retention are explicit',async()=>{
  const f=await fixture(),a=f.assemblies.find(a=>a.id==='pod')!;const first=detailObservation(a,f.state,1000);
  const duplicate=appendObservation([first],first);assert.equal(duplicate.history.length,1);assert.match(duplicate.reason!,/duplicate/);
  const next=detailObservation(a,await f.next(),1001);next.protocol!.sequence='9';const gap=appendObservation([first],next);assert.match(gap.reason!,/Missing/);
  const late={...next,observedAtMs:999};assert.equal(appendObservation(gap.history,late).history.length,2);
  const reboot=structuredClone(next);reboot.protocol!.source.bootId='new-boot';assert.equal(appendObservation(gap.history,reboot).history.length,1);
  const changed=structuredClone(next);changed.configurationRevision='new-config';assert.equal(appendObservation(gap.history,changed).history.length,1);
  let history=[first];for(let n=2;n<100;n++){const p=structuredClone(first);p.protocol!.sequence=String(n);p.observedAtMs=1000+n;history=appendObservation(history,p).history;}assert.equal(history.length,60);
});
test('diagnostic export allowlists timestamps/quality and omits credentials, arbitrary protocol/config/media fields',async()=>{
  const f=await fixture(),a=f.assemblies.find(a=>a.id==='pod')!,p=detailObservation(a,f.state,1000);
  const poisoned={...p,token:'secret-marker',media:'private-marker',configuration:f.config};
  Object.assign(poisoned.readings[0]!,{credential:'nested-secret-marker'});Object.assign(poisoned.protocol!.source,{signedUrl:'nested-private-marker'});
  const output=diagnosticExport('synthetic-site',realm,[poisoned]);const json=JSON.stringify(output);
  assert.ok(!json.includes('secret-marker'));assert.ok(!json.includes('private-marker'));assert.ok(!json.includes('positionMm'));
  assert.equal(output.points[0]!.readings[0]!.sourceTime?.utc,null);assert.match(output.coverage,/partial/);
});
