import test from 'node:test';
import assert from 'node:assert/strict';
import type {Event,Telemetry,Sample} from '@arbi/protocol';
import {dashboardTelemetryState} from './telemetry-state';
import {freshness} from './contracts';
const realm={environment:'test' as const,namespaceId:'isolated-state'},siteId='site-1',now=1700000001000;
function fixture(){
  const source={deviceId:'edge',bootId:'boot-1',sessionId:'link-1'},base={protocol:'arbi/1.0' as const,realm,siteId,source,executionMode:'simulation' as const,sequence:'1',
    sourceTime:{utc:new Date(now-200).toISOString(),monotonicMs:1000,uncertaintyMs:10},ingestTime:{utc:new Date(now-100).toISOString(),uncertaintyMs:100,deviceId:'telemetry-service'}};
  const snapshot:Event={...base,kind:'event',messageId:'snapshot-1',body:{type:'state.snapshot',configRevision:'config-1',capabilitiesRevision:'caps-1',capabilities:[],state:'Ready',
    eventCursor:{source,stream:'event',sequence:'1'},telemetryCursor:null,committedCursor:null,supportedCommands:['motion.move','control.stop'],supportedProtocols:['arbi/1.0']}};
  const sample:Sample={metric:'position.z',value:2491,unit:'mm',frame:{name:'site',revision:'frame-1'},quality:'estimated',originQuality:null,reason:null,uncertainty:null,sampleMonotonicMs:1000,ageMs:0};
  const telemetry:Telemetry={...base,kind:'telemetry',messageId:'telemetry-1',body:{type:'telemetry.samples',capabilitiesRevision:'caps-1',samples:[sample]}};
  return {states:[{currentIdentity:true,fresh:true,snapshotFresh:true,message:snapshot,snapshot,receivedAtMs:now-100,readings:[]},
    {currentIdentity:true,fresh:true,snapshotFresh:true,message:telemetry,snapshot,receivedAtMs:now-150,readings:[{sample,provenance:{messageId:telemetry.messageId}}]}]};
}
test('dashboard telemetry preserves authentic receipt/source clocks, derived quality and conservative freshness',()=>{
  const input=fixture(),state=dashboardTelemetryState(input,realm,siteId,now);
  assert.equal(state.observedAtMs,now-150);assert.equal(state.connection,'connected');assert.equal(state.telemetry?.body.samples[0].value,2491);
  assert.deepEqual(state.snapshot?.sourceTime,input.states[0].message.sourceTime);
  input.states.forEach(view=>{view.fresh=false;view.receivedAtMs=now-6000;});
  Object.assign(input.states[1].readings[0].sample,{quality:'stale',originQuality:'estimated',reason:'expired'});
  const stale=dashboardTelemetryState(input,realm,siteId,now);assert.equal(stale.connection,'offline');assert.equal(stale.observedAtMs,now-6000);
  assert.equal(stale.telemetry?.body.samples[0].quality,'stale');
  assert.equal(dashboardTelemetryState({states:[]},realm,siteId,now).snapshot,null);
  const unknownClock=fixture();unknownClock.states[0].snapshotFresh=false;
  assert.equal(freshness(dashboardTelemetryState(unknownClock,realm,siteId,now),now),'stale');
});
test('mixed realms, boots, capabilities, source payloads or current identity cannot become dashboard data',()=>{
  for(const mutate of [
    (v:ReturnType<typeof fixture>)=>{v.states[1].message.realm={...realm,environment:'production'};},
    (v:ReturnType<typeof fixture>)=>{v.states[1].message=structuredClone(v.states[1].message);v.states[1].message.source.bootId='different-boot';},
    (v:ReturnType<typeof fixture>)=>{v.states[0].currentIdentity=false;},
    (v:ReturnType<typeof fixture>)=>{v.states[0].receivedAtMs=now+1;},
    (v:ReturnType<typeof fixture>)=>{v.states[1].readings[0].provenance!.messageId='older-partial-update';},
    (v:ReturnType<typeof fixture>)=>{v.states[0].snapshot=structuredClone(v.states[0].snapshot);v.states[0].snapshot.siteId='different-site';},
  ]){const input=fixture();mutate(input);assert.throws(()=>dashboardTelemetryState(input,realm,siteId,now),/UNAVAILABLE/);}
});
