import { createHash } from 'node:crypto';
import { configurationDigest,validateMessage,validateAuditEvent,validateAccounting } from '@arbi/protocol';
import type { AuditEvent,Event,Message,Realm,Sample,UsageObservation } from '@arbi/protocol';

export const INCIDENT_VERSION = 'arbi.incident/1.0';
export const INCIDENT_MAX_BYTES = 2_097_152;
export interface CaptureTrace { realm:Realm;siteId:string;captureId:string; commandId:string; correlationId:string; outcome:'stored'|'failed'|'unknown'; media:'omitted' }
export type IncidentRecord = {offsetMs:number;configRevision:string|null;softwareRevision:string|null} & (
  {kind:'protocol';raw:Message}|{kind:'audit';raw:AuditEvent}|{kind:'usage';raw:UsageObservation}|{kind:'capture';raw:CaptureTrace});
export interface IncidentBundle {
  schemaVersion:typeof INCIDENT_VERSION;id:string;realm:Realm;siteId:string;durationMs:number;
  data:{id:string;revision:string;origin:'synthetic'|'bench-recording';provenance:'declared-unverified';createdAtUtc:string;retentionUntilUtc:string};
  model:{id:string;revision:string;assumptionRefs:string[];parameters:Array<{id:string;unit:string;value:number;lower:number;upper:number;evidenceRef:string}>};
  records:IncidentRecord[];digest:string;
}
const invalid = ():never => {throw Error('INVALID_INCIDENT');};
const id = (v:unknown):v is string => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(v);
const utc = (v:unknown):v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString() === v;
function keys(value:any,expected:string[]) {
  if(!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join(',') !== [...expected].sort().join(',')) invalid();
}
function numeric(value:unknown,min:number,max:number,integer=false): asserts value is number {
  if(typeof value !== 'number' || !Number.isFinite(value) || value<min || value>max || integer && !Number.isSafeInteger(value)) invalid();
}
/** Reject accessors/prototypes/cycles before a copy or serializer can invoke user code. */
export function boundedIncidentJson(input:unknown):any {
  let nodes=0,bytes=0;const active=new Set<object>();
  const copy=(v:any,depth:number):any=>{
    if(++nodes>100_000 || depth>32) invalid();
    if(v===null || typeof v==='boolean') return v;
    if(typeof v==='number'){if(!Number.isFinite(v)) invalid();return v;}
    if(typeof v==='string'){bytes+=Buffer.byteLength(v);if(bytes>INCIDENT_MAX_BYTES || v.length>32768) invalid();return v;}
    if(typeof v!=='object' || active.has(v) || Object.getOwnPropertySymbols(v).length) invalid();
    const prototype=Object.getPrototypeOf(v);
    if(Array.isArray(v)?prototype!==Array.prototype:prototype!==Object.prototype && prototype!==null) invalid();
    const names=Object.keys(v);
    if(names.length>100_000 || Array.isArray(v) && (names.length!==v.length || names.some((n,i)=>n!==String(i)))) invalid();
    active.add(v);const out:any=Array.isArray(v)?[]:Object.create(null);
    for(const name of names){bytes+=name.length;if(name.length>128 || bytes>INCIDENT_MAX_BYTES) invalid();
      const d=Object.getOwnPropertyDescriptor(v,name)!;if(!Object.hasOwn(d,'value')) invalid();
      Object.defineProperty(out,name,{value:copy(d.value,depth+1),enumerable:true,writable:true});}
    active.delete(v);return out;
  };
  const result=copy(input,0);if(Buffer.byteLength(JSON.stringify(result))>INCIDENT_MAX_BYTES) invalid();return result;
}
export function incidentDigest(bundle:Omit<IncidentBundle,'digest'>):string {return configurationDigest(bundle);}
export function parseIncident(input:unknown):IncidentBundle {
  if(typeof input==='string'){if(Buffer.byteLength(input)>INCIDENT_MAX_BYTES) invalid();try{input=JSON.parse(input);}catch{invalid();}}
  const b=boundedIncidentJson(input) as IncidentBundle;
  keys(b,['schemaVersion','id','realm','siteId','durationMs','data','model','records','digest']);keys(b.realm,['environment','namespaceId']);
  if(b.schemaVersion!==INCIDENT_VERSION || !id(b.id) || !id(b.siteId) || !id(b.realm.namespaceId) || !['test','preview','production'].includes(b.realm.environment)) invalid();
  numeric(b.durationMs,0,86_400_000,true);
  keys(b.data,['id','revision','origin','provenance','createdAtUtc','retentionUntilUtc']);
  if(!id(b.data.id) || !id(b.data.revision) || !['synthetic','bench-recording'].includes(b.data.origin) || b.data.provenance!=='declared-unverified' || !utc(b.data.createdAtUtc) || !utc(b.data.retentionUntilUtc) || b.data.retentionUntilUtc<=b.data.createdAtUtc) invalid();
  keys(b.model,['id','revision','assumptionRefs','parameters']);
  if(!id(b.model.id) || !id(b.model.revision) || !Array.isArray(b.model.assumptionRefs) || b.model.assumptionRefs.length>32 || !b.model.assumptionRefs.every(id) || !Array.isArray(b.model.parameters) || b.model.parameters.length>32) invalid();
  const parameters=new Set<string>();
  for(const p of b.model.parameters){keys(p,['id','unit','value','lower','upper','evidenceRef']);
    if(!id(p.id) || !id(p.unit) || !id(p.evidenceRef) || parameters.has(p.id)) invalid();parameters.add(p.id);
    numeric(p.value,-1e9,1e9);numeric(p.lower,-1e9,p.value);numeric(p.upper,p.value,1e9);}
  if(!Array.isArray(b.records) || b.records.length>512) invalid();
  for(const record of b.records){keys(record,['offsetMs','configRevision','softwareRevision','kind','raw']);numeric(record.offsetMs,0,b.durationMs,true);
    if(record.configRevision!==null && !id(record.configRevision) || record.softwareRevision!==null && !id(record.softwareRevision)) invalid();
    if(record.kind==='capture'){
      keys(record.raw,['realm','siteId','captureId','commandId','correlationId','outcome','media']);
      keys(record.raw.realm,['environment','namespaceId']);
      if(record.raw.siteId!==b.siteId || configurationDigest(record.raw.realm)!==configurationDigest(b.realm))invalid();
      if(![record.raw.captureId,record.raw.commandId,record.raw.correlationId].every(id) || !['stored','failed','unknown'].includes(record.raw.outcome) || record.raw.media!=='omitted') invalid();
    }else{
      const raw=record.raw;
      const checked=record.kind==='protocol'?validateMessage(raw):record.kind==='audit'?validateAuditEvent(raw):record.kind==='usage'?validateAccounting(raw):null;
      if(!checked?.ok || record.kind==='usage' && (raw as UsageObservation).kind!=='usage' || raw.siteId!==b.siteId || configurationDigest(raw.realm)!==configurationDigest(b.realm)) invalid();
      const knownConfig=record.kind==='protocol'?(record.raw.kind==='command'?record.raw.command.configRevision:record.raw.body.type==='state.snapshot'?record.raw.body.configRevision:null):record.kind==='audit'?record.raw.metadata.configRevision??null:null;
      if(knownConfig!==null && record.configRevision!==knownConfig)invalid();
    }
  }
  const {digest,...payload}=b;if(!/^[a-f0-9]{64}$/.test(digest) || incidentDigest(payload)!==digest) throw Error('INCIDENT_INTEGRITY');
  return structuredClone(b);
}
const identity=(raw:Message|AuditEvent|UsageObservation)=>'auditVersion' in raw?raw.source.identity:raw.source;
export function incidentRows(bundle:IncidentBundle) {
  const streams=new Map<string,bigint>(),seen=new Map<string,string>();
  return bundle.records.map((r,index)=>({r,index})).sort((a,b)=>a.r.offsetMs-b.r.offsetMs || a.index-b.index).map(({r,index})=>{
    const raw=r.raw;
    const recordId=r.kind==='capture'?(raw as CaptureTrace).captureId:'messageId' in raw?raw.messageId:'eventId' in raw?raw.eventId:(raw as UsageObservation).observationId;
    const key=`${r.kind}:${recordId}`,hash=configurationDigest(raw),old=seen.get(key);if(!old)seen.set(key,hash);
    let gap:string|null=null,outOfOrder=false,sequence:string|null=null,sourceTime:Message['sourceTime']|null=null;
    if(r.kind==='protocol' || r.kind==='audit'){
      const v=raw as Message|AuditEvent;sequence=v.sequence;sourceTime=v.sourceTime;
      const stream=JSON.stringify([r.kind,identity(v),'kind' in v?v.kind:v.source.module]),prior=streams.get(stream),current=BigInt(sequence);
      outOfOrder=prior!==undefined && current<prior;
      if(prior!==undefined && current>prior+1n)gap=String(current-prior-1n);
      if(prior===undefined || current>prior)streams.set(stream,current);
    }
    return {index,offsetMs:r.offsetMs,kind:r.kind,recordId,sequence,sourceTime,ingestTime:'ingestTime' in raw?structuredClone(raw.ingestTime):null,gap,outOfOrder,duplicate:old===hash,identityConflict:old!==undefined && old!==hash,
      configRevision:r.configRevision,softwareRevision:r.softwareRevision,raw:structuredClone(raw)};
  });
}
export class IncidentReplay {
  readonly #bundle:Pick<IncidentBundle,"id"|"durationMs"|"data"|"digest"> & {model:Pick<IncidentBundle["model"],"id"|"revision">};readonly #scope:{realm:Realm;siteId:string};readonly #rows:Array<ReturnType<typeof incidentRows>[number]|ReturnType<typeof parseIncidentExport>["rows"][number]>;
  #at=0;#playing=false;#speed=1;
  constructor(input:unknown){
    let value:unknown=input;
    if(typeof value==='string'){if(Buffer.byteLength(value)>INCIDENT_MAX_BYTES)invalid();try{value=JSON.parse(value);}catch{invalid();}}
    const candidate=boundedIncidentJson(value);
    if(candidate?.schemaVersion==='arbi.incident-export/1.0'){
      const exported=parseIncidentExport(candidate);this.#bundle={id:exported.id,durationMs:exported.durationMs,data:exported.data,model:exported.model,digest:exported.digest};this.#scope={realm:{environment:exported.realm.environment as Realm["environment"],namespaceId:exported.realm.namespace},siteId:exported.site};this.#rows=exported.rows;
    }else{const bundle=parseIncident(candidate);this.#bundle=bundle;this.#scope={realm:bundle.realm,siteId:bundle.siteId};this.#rows=incidentRows(bundle);}
  }
  play(){this.#playing=true;return this.snapshot();}
  pause(){this.#playing=false;return this.snapshot();}
  speed(value:number){numeric(value,0.1,16);this.#speed=value;return this.snapshot();}
  seek(atMs:number){numeric(atMs,0,this.#bundle.durationMs);this.#at=atMs;return this.snapshot();}
  advance(elapsedMs:number){numeric(elapsedMs,0,86_400_000);if(this.#playing)this.#at=Math.min(this.#bundle.durationMs,this.#at+elapsedMs*this.#speed);return this.snapshot();}
  snapshot(){return {schemaVersion:INCIDENT_VERSION,id:this.#bundle.id,atMs:this.#at,playing:this.#playing,speed:this.#speed,
    output:'read-only' as const,provenance:'declared-unverified' as const,integrity:'self-hash-not-authentication',bundleDigest:this.#bundle.digest,
    data:structuredClone(this.#bundle.data),model:{id:this.#bundle.model.id,revision:this.#bundle.model.revision},scope:structuredClone(this.#scope),rows:structuredClone(this.#rows.filter(row=>row.offsetMs<=this.#at))};}
}
/** Export projection deliberately omits raw payloads, coordinates, media, arbitrary text and human/session identities. */
export function exportIncident(input:unknown,privateSalt:string) {
  const b=parseIncident(input);if(!/^[a-f0-9]{64}$/.test(privateSalt)) invalid();
  const alias=(value:string)=>createHash('sha256').update(privateSalt).update('\0').update(value).digest('hex');
  const rows=incidentRows(b).map(row=>{
    const raw=row.raw;let summary:Record<string,unknown>;
    if(row.kind==='protocol'){
      const r=raw as Message;summary={type:r.body.type,source:alias(JSON.stringify(r.source)),
        commandId:r.kind==='command'?r.command.commandId:r.body.type==='command.outcome'?r.body.commandId:null,
        correlationId:r.kind==='command'?r.command.correlationId:r.body.type==='command.outcome'?r.body.correlationId:null,
        outcome:r.body.type==='command.outcome'?r.body.outcome:null,state:r.body.type==='state.snapshot'?r.body.state:null,
        faultId:r.body.type==='fault.changed'?r.body.faultId:null,
        error:r.body.type==='fault.changed'?r.body.error.code:r.body.type==='command.outcome'?r.body.error?.code??null:null};
    }else if(row.kind==='audit'){
      const r=raw as AuditEvent;summary={action:r.action,evidence:r.evidence,outcome:r.outcome,effect:r.effect,
        actor:alias(JSON.stringify(r.actor)),correlationId:r.links.correlationId,commandId:r.links.commandId,intentEventId:r.links.intentEventId};
    }else if(row.kind==='usage'){
      const r=raw as UsageObservation;summary={boundary:r.boundary,layer:r.layer,direction:r.direction,category:r.category,bytes:r.bytes,
        interval:r.interval,quality:r.evidence.quality,coverage:r.evidence.coverage};
    }else {const r=raw as CaptureTrace;summary={captureId:r.captureId,commandId:r.commandId,correlationId:r.correlationId,outcome:r.outcome,media:r.media};}
    const {raw:_,...header}=row;return {...header,ingestTime:header.ingestTime?{...header.ingestTime,deviceId:alias(header.ingestTime.deviceId)}:null,summary};
  });
  const payload={schemaVersion:'arbi.incident-export/1.0',id:b.id,site:alias(b.siteId),realm:{environment:b.realm.environment,namespace:alias(b.realm.namespaceId)},
    durationMs:b.durationMs,data:b.data,model:{id:b.model.id,revision:b.model.revision},redactions:['raw-payloads','position-and-sensor-values','media','personal-and-session-identities'],rows};
  return {...payload,digest:configurationDigest(payload),integrity:'self-hash-not-authentication'};
}
export function incidentMeasurements(input:unknown) {
  const b=parseIncident(input);
  const seen=new Set<string>();
  return b.records.flatMap((r,index)=>{
    if(r.kind!=='protocol' || r.raw.kind!=='telemetry')return [];
    const fingerprint=configurationDigest(r.raw);if(seen.has(fingerprint))return [];seen.add(fingerprint);
    return r.raw.body.samples.map((sample:Sample)=>({index,recordId:r.raw.messageId,offsetMs:r.offsetMs,sourceTime:r.raw.sourceTime,...sample}));
  });
}

/** A redacted export can replay its remaining timeline; it cannot recover omitted sensor/model values. */
export function parseIncidentExport(input:unknown):ReturnType<typeof exportIncident> {
  if(typeof input==='string'){if(Buffer.byteLength(input)>INCIDENT_MAX_BYTES)invalid();try{input=JSON.parse(input);}catch{invalid();}}
  const value=boundedIncidentJson(input) as ReturnType<typeof exportIncident>;
  keys(value,['schemaVersion','id','site','realm','durationMs','data','model','redactions','rows','digest','integrity']);
  keys(value.realm,['environment','namespace']);keys(value.data,['id','revision','origin','provenance','createdAtUtc','retentionUntilUtc']);keys(value.model,['id','revision']);
  if(value.schemaVersion!=='arbi.incident-export/1.0' || value.integrity!=='self-hash-not-authentication' || !id(value.id) || !id(value.site) || !id(value.realm.namespace) || !['test','preview','production'].includes(value.realm.environment) ||
    !id(value.data.id) || !id(value.data.revision) || !['synthetic','bench-recording'].includes(value.data.origin) || value.data.provenance!=='declared-unverified' || !utc(value.data.createdAtUtc) || !utc(value.data.retentionUntilUtc) || value.data.retentionUntilUtc<=value.data.createdAtUtc || !id(value.model.id) || !id(value.model.revision))invalid();
  numeric(value.durationMs,0,86_400_000,true);
  if(JSON.stringify(value.redactions)!==JSON.stringify(['raw-payloads','position-and-sensor-values','media','personal-and-session-identities']) || !Array.isArray(value.rows) || value.rows.length>512)invalid();
  let prior=0;
  for(const row of value.rows){
    keys(row,['index','offsetMs','kind','recordId','sequence','sourceTime','ingestTime','gap','outOfOrder','duplicate','identityConflict','configRevision','softwareRevision','summary']);
    numeric(row.index,0,511,true);numeric(row.offsetMs,prior,value.durationMs,true);prior=row.offsetMs;
    if(!id(row.recordId) || row.configRevision!==null && !id(row.configRevision) || row.softwareRevision!==null && !id(row.softwareRevision) || ![row.outOfOrder,row.duplicate,row.identityConflict].every(v=>typeof v==='boolean'))invalid();
    for(const counter of [row.sequence,row.gap])if(counter!==null && (typeof counter!=='string' || !/^(0|[1-9][0-9]{0,19})$/.test(counter) || BigInt(counter)>18446744073709551615n))invalid();
    if(row.sourceTime!==null){keys(row.sourceTime,['utc','monotonicMs','uncertaintyMs']);numeric(row.sourceTime.monotonicMs,0,Number.MAX_SAFE_INTEGER,true);
      if(row.sourceTime.utc===null ? row.sourceTime.uncertaintyMs!==null : !utc(row.sourceTime.utc))invalid();
      if(row.sourceTime.uncertaintyMs!==null)numeric(row.sourceTime.uncertaintyMs,0,Number.MAX_SAFE_INTEGER,true);}
    if(row.ingestTime!==null){keys(row.ingestTime,['utc','uncertaintyMs','deviceId']);if(!utc(row.ingestTime.utc) || !id(row.ingestTime.deviceId))invalid();numeric(row.ingestTime.uncertaintyMs,0,Number.MAX_SAFE_INTEGER,true);}
    const fields:Record<string,string[]>={protocol:['type','source','commandId','correlationId','outcome','state','faultId','error'],
      audit:['action','evidence','outcome','effect','actor','correlationId','commandId','intentEventId'],usage:['boundary','layer','direction','category','bytes','interval','quality','coverage'],capture:['captureId','commandId','correlationId','outcome','media']};
    if(!Object.hasOwn(fields,row.kind))invalid();keys(row.summary,fields[row.kind]!);
    for(const [name,entry] of Object.entries(row.summary)){
      if(name==='interval'){keys(entry,['start','end']);const interval=entry as {start:string;end:string};if(!utc(interval.start)||!utc(interval.end)||interval.end<=interval.start)invalid();}
      else if(entry!==null && !id(entry))invalid();
    }
  }
  const {digest,integrity:_,...payload}=value;if(!/^[a-f0-9]{64}$/.test(digest) || configurationDigest(payload)!==digest)throw Error('INCIDENT_INTEGRITY');
  return structuredClone(value);
}
