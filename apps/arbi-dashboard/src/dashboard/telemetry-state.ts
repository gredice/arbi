import {isObject,sameRealm} from '@arbi/gredice';
import {validateMessage,type Event,type Realm,type Sample,type Telemetry} from '@arbi/protocol';
import type {DashboardState} from './contracts';

/** Projection of the existing authorized telemetry read; never advances its receipt clock. */
export function dashboardTelemetryState(input:unknown,realm:Realm,siteId:string,now:number):DashboardState{
  if(!isObject(input)||!Array.isArray(input.states)||input.states.length>2)throw Error('UNAVAILABLE');
  let snapshot:Event|null=null,telemetry:Telemetry|null=null,receivedAtMs:number|null=null,fresh=true;
  for(const state of input.states){
    if(!isObject(state)||state.currentIdentity!==true)throw Error('UNAVAILABLE');
    const parsed=validateMessage(state.message);if(!parsed.ok||parsed.value.kind==='command')throw Error('UNAVAILABLE');
    const message=parsed.value;
    if(message.executionMode!=='simulation'||!sameRealm(message.realm,realm)||message.siteId!==siteId||
      !Number.isSafeInteger(state.receivedAtMs)||Number(state.receivedAtMs)<0||Number(state.receivedAtMs)>now)throw Error('UNAVAILABLE');
    if(message.kind==='telemetry'){
      if(!Array.isArray(state.readings)||state.readings.length>64)throw Error('UNAVAILABLE');
      const readings=state.readings;
      // A telemetry envelope describes one source message. Never relabel carried
      // readings from older partial updates with that message's sequence/clock.
      const samples=message.body.type==='telemetry.samples'?message.body.samples.map(sample=>{
        const reading=readings.find((value:unknown)=>isObject(value)&&isObject(value.sample)&&value.sample.metric===sample.metric&&
          isObject(value.provenance)&&value.provenance.messageId===message.messageId);
        if(!isObject(reading)||!isObject(reading.sample))throw Error('UNAVAILABLE');return reading.sample as unknown as Sample;
      }):[];
      telemetry={...message,body:{...message.body,samples}};
      if(!validateMessage(telemetry).ok)throw Error('UNAVAILABLE');
    }
    if(state.snapshot!==null&&state.snapshot!==undefined){
      const value=validateMessage(state.snapshot);if(!value.ok||value.value.kind!=='event'||value.value.body.type!=='state.snapshot'||
        !sameRealm(value.value.realm,realm)||value.value.siteId!==siteId||value.value.executionMode!=='simulation')throw Error('UNAVAILABLE');
      snapshot=value.value;
    }
    receivedAtMs=Math.min(receivedAtMs??Number(state.receivedAtMs),Number(state.receivedAtMs));fresh&&=state.fresh===true&&state.snapshotFresh===true;
  }
  if(!snapshot||!telemetry)return {connection:'offline',observedAtMs:receivedAtMs??now,staleAfterMs:5000,snapshot:null,telemetry:null};
  if(snapshot.body.type!=='state.snapshot'||snapshot.body.capabilitiesRevision!==telemetry.body.capabilitiesRevision||
    ['deviceId','bootId','sessionId'].some(key=>snapshot!.source[key as keyof Event['source']]!==telemetry!.source[key as keyof Telemetry['source']]))throw Error('UNAVAILABLE');
  const stamp=snapshot.ingestTime?Date.parse(snapshot.ingestTime.utc):null;
  if(stamp===null||!Number.isSafeInteger(stamp)||stamp>now)throw Error('UNAVAILABLE');
  return {connection:fresh?'connected':'offline',observedAtMs:Math.min(receivedAtMs!,stamp),staleAfterMs:fresh?5000:1,snapshot,telemetry};
}
