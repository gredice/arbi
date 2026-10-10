import type { Capability, Configuration, Event, Identity, Sample } from '@arbi/protocol';
import type { DashboardState } from './contracts';
import { displayedSample } from './contracts';

export interface Assembly {
  id:string;name:string;kind:'assembly'|'module'|'passive';componentIds:string[];
  firmware:Array<{id:string;version:string|null}>;calibrationRevision:string|null;
  metrics:Sample['metric'][];unsupported:string[];capabilities:Capability[];
}
export function assemblyInventory(config:Configuration|null,state:DashboardState):Assembly[]{
  const definitions:Array<[string,string,Assembly['kind'],string[],Sample['metric'][],string[]]>=[
    ['cabinet','Control cabinet','assembly',['edge','pico'],[],['Supply current','Cabinet temperature']],
    ['edge','Linux edge','module',['edge'],[],['CPU / storage diagnostics']],
    ['pico','Motion Pico','module',['pico'],[],['Driver encoder feedback']],
    ...(['a','b','c','d'] as const).flatMap(s=>[
      [`station-${s}`,`Corner station ${s.toUpperCase()}`,'assembly',[`anchor-${s}`,`driver-${s}`,`drum-${s}`],[],['Driver encoder position','Supply current']],
      [`winch-${s}`,`Winch ${s.toUpperCase()}`,'assembly',[`driver-${s}`,`drum-${s}`],[`line.length.${s}`],['Drum slip / mechanical feedback']],
      [`line-${s}`,`Positioning line ${s.toUpperCase()}`,'passive',s==='a'?['powered-line']:[],[`line.length.${s}`,`line.tension.${s}`],['Line inspection / wear']]
    ] as Array<[string,string,Assembly['kind'],string[],Sample['metric'][],string[]]>),
    ['pod','Camera pod','module',['pod'],['position.x','position.y','position.z','power.voltage'],['Measured position without declared sensing']],
    ['gimbal','Camera gimbal','assembly',['servo-pan','servo-tilt'],['gimbal.pan','gimbal.tilt'],['Mechanical angle feedback without declared sensing']],
    ['camera','Camera / optics','assembly',['pod'],[],['Image / focus / encoder diagnostics']],
    ['dock','Dock','passive',[],[],['Latch / dock feedback without declared sensing']]
  ];
  const represented=new Set(definitions.flatMap(d=>d[3]));
  for(const c of config?.components??[])if(!represented.has(c.id))definitions.push([`component:${c.id}`,c.id,c.kind==='module'?'module':'passive',[c.id],[],['Telemetry not mapped by this contract']]);
  const snapshot=state.snapshot?.body,declared=snapshot?.type==='state.snapshot'?snapshot.capabilities:[];
  return definitions.map(([id,name,kind,componentIds,metrics,unsupported])=>({id,name,kind,componentIds,
    firmware:componentIds.flatMap(cid=>{const c=config?.components.find(c=>c.id===cid);return c?.kind==='module'?[{id:cid,version:c.firmwareVersion}]:[];}),
    calibrationRevision:config?.calibration?.revision??null,metrics,unsupported,capabilities:declared.filter(c=>metrics.includes(c.metric))}));
}
export interface DiagnosticReading {
  metric:string;value:number|null;unit:string|null;quality:string;originQuality:string|null;reason:string|null;
  source:Identity|null;
  sequence:string|null;sourceTime:{utc:string|null;monotonicMs:number;uncertaintyMs:number|null}|null;
  receivedAtMs:number|null;sampleMonotonicMs:number|null;ageMs:number|null;uncertainty:number|null;
}
export function diagnosticReadings(assembly:Assembly,state:DashboardState,now:number):DiagnosticReading[]{
  return [...assembly.metrics,...assembly.unsupported].map(metric=>{
    const original=state.telemetry?.body.samples.find(s=>s.metric===metric);
    const declared=original && assembly.capabilities.some(c=>c.metric===original.metric && c.qualities.includes((original.originQuality??original.quality) as 'measured'|'estimated'|'commanded'));
    let sample=original?displayedSample(original,state,now):null;
    // An uninstrumented driver/sensor cannot become a measurement through a label or UI mode.
    if(sample && (sample.originQuality??sample.quality)==='measured' && !declared)sample={...sample,value:null,quality:'unavailable',originQuality:null,reason:'not-reported'};
    return {metric,value:sample?.value??null,unit:sample?.unit??null,quality:sample?.quality??'unavailable',originQuality:sample?.originQuality??null,
      reason:sample?.reason??(sample?null:'not-reported'),source:original?state.telemetry!.source:null,sequence:original?state.telemetry!.sequence:null,
      sourceTime:original?state.telemetry!.sourceTime:null,receivedAtMs:original?state.observedAtMs:null,
      sampleMonotonicMs:sample?.sampleMonotonicMs??null,ageMs:sample?.ageMs??null,uncertainty:sample?.uncertainty??null};
  });
}
export interface DetailObservation {
  assembly:Assembly;readings:DiagnosticReading[];state:string|null;fault:{id:string;active:boolean;code:string}|null;
  protocol:{messageId:string;source:{deviceId:string;bootId:string;sessionId:string};sequence:string;type:string;commandId:string|null}|null;
  observedAtMs:number;pollAfterMs:number;maxPoints:number;maxResponseBytes:number;
  configurationRevision:string|null;capabilitiesRevision:string|null;
  events:DiagnosticEvent[]|null;
}
export interface DiagnosticEvent {
  id:string;type:string;source:Identity;sequence:string;sourceTime:Event['sourceTime'];ingestTime:Event['ingestTime'];
  state:string|null;faultId:string|null;severity:string|null;code:string|null;commandId:string|null;outcome:string|null;
}
export function projectDiagnosticEvent(e:Event):DiagnosticEvent{
  const b=e.body;return {id:e.messageId,type:b.type,source:e.source,sequence:e.sequence,sourceTime:e.sourceTime,ingestTime:e.ingestTime,
    state:b.type==='state.snapshot'?b.state:null,faultId:b.type==='fault.changed'?b.faultId:null,severity:b.type==='fault.changed'?b.severity:null,
    code:b.type==='fault.changed'?b.error.code:b.type==='command.outcome'?b.error?.code??null:null,
    commandId:b.type==='command.outcome'?b.commandId:null,outcome:b.type==='command.outcome'?b.outcome:b.type==='fault.changed'?b.state:null};
}
export function detailObservation(assembly:Assembly,state:DashboardState,now:number):DetailObservation{
  const event=state.snapshot,body=event?.body;
  return {assembly,readings:diagnosticReadings(assembly,state,now),state:body?.type==='state.snapshot'?body.state:null,
    fault:body?.type==='fault.changed'?{id:body.faultId,active:body.state==='raised',code:body.error.code}:null,
    protocol:event?{messageId:event.messageId,source:event.source,sequence:event.sequence,type:event.body.type,commandId:event.body.type==='command.outcome'?event.body.commandId:null}:null,
    observedAtMs:state.observedAtMs,pollAfterMs:5000,maxPoints:60,maxResponseBytes:32768,
    configurationRevision:body?.type==='state.snapshot'?body.configRevision:null,capabilitiesRevision:body?.type==='state.snapshot'?body.capabilitiesRevision:null,events:null};
}
export function appendObservation(history:DetailObservation[],next:DetailObservation):{history:DetailObservation[];reason:string|null}{
  const previous=history.at(-1);if(!previous)return {history:[next],reason:null};
  const p=previous.protocol,n=next.protocol;
  if(previous.assembly.id!==next.assembly.id || previous.configurationRevision!==next.configurationRevision || previous.capabilitiesRevision!==next.capabilitiesRevision || p && n && JSON.stringify(p.source)!==JSON.stringify(n.source))return {history:[next],reason:'Source, revision or assembly changed; history reset'};
  if(next.observedAtMs<previous.observedAtMs || p && n && BigInt(n.sequence)<=BigInt(p.sequence))return {history,reason:'Old or duplicate observation ignored'};
  return {history:[...history,next].slice(-60),reason:p && n && BigInt(n.sequence)>BigInt(p.sequence)+1n?'Missing sequence interval':null};
}
export function diagnosticExport(siteId:string,realm:{environment:string;namespaceId:string},history:DetailObservation[]){
  // Explicit allowlist. No arbitrary configuration, protocol body, session, image, URL, header or credential export.
  const identity=(v:Identity|null)=>v?{deviceId:v.deviceId,bootId:v.bootId,sessionId:v.sessionId}:null;
  const sourceTime=(v:Event['sourceTime']|null)=>v?{utc:v.utc,monotonicMs:v.monotonicMs,uncertaintyMs:v.uncertaintyMs}:null;
  return {schema:'arbi.diagnostics-export/1.0',siteId,realm,coverage:'Selected observations; bounded partial history',
    points:history.slice(-60).map(p=>({assemblyId:p.assembly.id,calibrationRevision:p.assembly.calibrationRevision,firmware:p.assembly.firmware.map(f=>({id:f.id,version:f.version})),
      configurationRevision:p.configurationRevision,capabilitiesRevision:p.capabilitiesRevision,observedAtMs:p.observedAtMs,state:p.state,
      fault:p.fault?{id:p.fault.id,active:p.fault.active,code:p.fault.code}:null,
      protocol:p.protocol?{messageId:p.protocol.messageId,source:identity(p.protocol.source),sequence:p.protocol.sequence,type:p.protocol.type,commandId:p.protocol.commandId}:null,
      readings:p.readings.map(r=>({metric:r.metric,value:r.value,unit:r.unit,quality:r.quality,originQuality:r.originQuality,reason:r.reason,
        source:identity(r.source),sequence:r.sequence,sourceTime:sourceTime(r.sourceTime),receivedAtMs:r.receivedAtMs,sampleMonotonicMs:r.sampleMonotonicMs,ageMs:r.ageMs,uncertainty:r.uncertainty})),
      events:p.events?.map(e=>({id:e.id,type:e.type,source:identity(e.source),sequence:e.sequence,sourceTime:sourceTime(e.sourceTime),
        ingestTime:e.ingestTime?{utc:e.ingestTime.utc,uncertaintyMs:e.ingestTime.uncertaintyMs,deviceId:e.ingestTime.deviceId}:null,
        state:e.state,faultId:e.faultId,severity:e.severity,code:e.code,commandId:e.commandId,outcome:e.outcome}))??null}))};
}
