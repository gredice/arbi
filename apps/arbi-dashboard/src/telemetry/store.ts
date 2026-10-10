import { isDeepStrictEqual } from 'node:util';
import { digest } from '@arbi/audit';
import { isRealm, sameRealm } from '@arbi/gredice';
import type { AuthorizedContext } from '@arbi/gredice';
import { ageSample, applyTelemetry, transportAgeUpperBound, validateMessage } from '@arbi/protocol';
import type { Event, Telemetry, TelemetryState } from '@arbi/protocol';
import { scope } from '../audit/store';
import { prove } from '../enrollment/crypto';
import { exact, id, JobError, milliseconds } from '../jobs/contracts';
import type { PostgresJobStore } from '../jobs/store';
import { FRESH_MS, historyQuery, pageCursor, queryHash, TIERS, VERSION } from './contracts';
import type { Aggregate, Head, Reading, Tier } from './contracts';

type Tx = Parameters<Parameters<PostgresJobStore['transaction']>[1]>[0];
type Row = {id: string; record: Record<string,unknown>};
const keyOf = (m: Pick<Telemetry|Event,'source'|'kind'|'sequence'>) => digest([m.source,m.kind,m.sequence]);
const bytes = (v: unknown) => Buffer.byteLength(JSON.stringify(v));
const provenance = (m:Telemetry):Reading['message']=>({messageId:m.messageId,source:m.source,sequence:m.sequence,
  sourceTime:m.sourceTime,ingestTime:m.ingestTime,capabilitiesRevision:m.body.capabilitiesRevision});
// The protocol delay calculator reads only these validated clock fields; no reconstructed payload is emitted.
const delayOf = (m:Pick<Telemetry,'sourceTime'|'ingestTime'>)=>transportAgeUpperBound(m as Telemetry);

/** Inventory-first locking shares revocation/COMMIT order with enrollment, jobs and realtime. No actuator effects. */
export class TelemetryStore {
  constructor(readonly jobs: PostgresJobStore) {}
  private async budget(tx: Tx, kind: 'ingest'|'read'|'trace') {
    const ceiling = {ingest:600,read:120,trace:10}[kind], window = Math.floor(tx.now/60_000)*60_000;
    const row = (await tx.sql.query<{attempts:number}>(`INSERT INTO arbi_telemetry_budgets VALUES($1,$2,$3,$4,$5,1)
      ON CONFLICT(environment,namespace_id,site_id,kind) DO UPDATE SET window_ms=EXCLUDED.window_ms,
      attempts=CASE WHEN arbi_telemetry_budgets.window_ms=EXCLUDED.window_ms THEN arbi_telemetry_budgets.attempts+1 ELSE 1 END RETURNING attempts`,
    [...scope(this.jobs.realm,tx.registry.siteId),kind,window])).rows[0];
    if (row.attempts > ceiling) throw new JobError('CAPACITY');
  }
  private async heads(tx: Tx): Promise<{device_id:string;stream:string;record:Head}[]> {
    return (await tx.sql.query<{device_id:string;stream:string;record:Head}>(`SELECT device_id,stream,record FROM arbi_telemetry_heads
      WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 ORDER BY device_id,stream LIMIT 65`,scope(this.jobs.realm,tx.registry.siteId))).rows;
  }
  private async snapshotMap(tx:Tx,heads:{device_id:string;record:Head}[]):Promise<Map<string,Event>> {
    const receivers=(await tx.sql.query<{record:{event:Event}}>(`SELECT record FROM arbi_job_receivers
      WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND device_id=ANY($4::text[]) LIMIT 65`,
      [...scope(this.jobs.realm,tx.registry.siteId),[...new Set(heads.map(h=>h.device_id))]])).rows;
    const snapshots=new Map<string,Event>();
    for(const e of [...heads.map(h=>h.record.snapshot),...receivers.map(r=>r.record.event)]) {
      if(!e || e.body.type!=='state.snapshot' || e.body.configRevision!==tx.registry.configRevision) continue;
      const device=tx.registry.devices.find(d=>d.id===e.source.deviceId);
      if(!device || !isDeepStrictEqual(e.source,device.current) || !isDeepStrictEqual(e.body.capabilities,device.capabilities)) continue;
      const previous=snapshots.get(device.id);
      if(!previous || BigInt(e.sequence)>BigInt(previous.sequence)) snapshots.set(device.id,e);
    }
    return snapshots;
  }
  private async prune(tx: Tx) {
    const key = scope(this.jobs.realm,tx.registry.siteId);
    for (const [tier,policy] of Object.entries(TIERS)) {
      await tx.sql.query(`DELETE FROM arbi_telemetry_history WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND tier=$4 AND at_ms < $5`,[...key,tier,tx.now-policy.ageMs]);
      await tx.sql.query(`DELETE FROM arbi_telemetry_history WHERE id IN (SELECT id FROM arbi_telemetry_history
        WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND tier=$4 ORDER BY id DESC OFFSET $5)`,[...key,tier,policy.rows]);
    }
    const active = tx.registry.devices.filter(d=>d.status==='active' && d.revokedAtMs===null).map(d=>d.id);
    await tx.sql.query(`DELETE FROM arbi_telemetry_heads WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND NOT(device_id=ANY($4::text[]))`,[...key,active]);
  }
  private async save(tx: Tx, tier: Tier, key: string, message: Pick<Telemetry,'source'> & Partial<Pick<Telemetry|Event,'kind'|'sequence'>>, config: string, record: unknown,
    fields: {atMs?:number;metric?:string;quality?:string;faultId?:string;severity?:string;eventType?:string} = {}) {
    if (bytes(record)>60_000) throw new JobError('CAPACITY');
    const streamKey=message.kind!==undefined && message.sequence!==undefined?keyOf({...message,kind:message.kind,sequence:message.sequence}):key;
    await tx.sql.query(`INSERT INTO arbi_telemetry_history(environment,namespace_id,site_id,tier,key,device_id,config_revision,
      at_ms,received_at_ms,metric,quality,fault_id,severity,event_type,fingerprint,record,stream_key)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17)
      ON CONFLICT(environment,namespace_id,site_id,tier,key) DO UPDATE SET received_at_ms=EXCLUDED.received_at_ms,record=EXCLUDED.record`,
    [...scope(this.jobs.realm,tx.registry.siteId),tier,key,message.source.deviceId,config,fields.atMs??tx.now,tx.now,
      fields.metric??null,fields.quality??null,fields.faultId??null,fields.severity??null,fields.eventType??null,digest(message),JSON.stringify(record),streamKey]);
  }
  private async aggregate(tx: Tx, tier: 'minute'|'hour', reading: Reading, config: string, gap: string) {
    const m=reading.message,s=reading.sample;
    const delay=delayOf(m),effective=ageSample(s,0,delay.ok?delay.value:null,FRESH_MS);
    const atMs=Math.floor(tx.now/TIERS[tier].widthMs)*TIERS[tier].widthMs;
    // Never average across boots, capabilities, configuration, frames, units, quality or unavailability reasons.
    const group=digest([m.source,config,m.capabilitiesRevision,atMs,s.metric,s.unit,s.frame,effective.quality,effective.originQuality,effective.reason]);
    const prior=(await tx.sql.query<{record:Aggregate}>(`SELECT record FROM arbi_telemetry_history WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND tier=$4 AND key=$5`,
      [...scope(this.jobs.realm,tx.registry.siteId),tier,group])).rows[0]?.record;
    const numeric=s.value!==null, count=(prior?.count??0)+1,numericCount=(prior?.numericCount??0)+(numeric?1:0);
    const sum=(prior?.sum??0)+(s.value??0);
    if (!Number.isFinite(sum)) throw new JobError('CAPACITY');
    const record={source:m.source,configRevision:config,capabilitiesRevision:m.capabilitiesRevision,bucketStartMs:atMs,bucketWidthMs:TIERS[tier].widthMs,
      metric:s.metric,unit:s.unit,frame:s.frame,quality:effective.quality,originQuality:effective.originQuality,reason:effective.reason,
      count,numericCount,sum:numericCount?sum:null,mean:numericCount?sum/numericCount:null,
      min:numeric?Math.min(prior?.min??s.value!,s.value!):prior?.min??null,max:numeric?Math.max(prior?.max??s.value!,s.value!):prior?.max??null,
      uncertaintyMax:s.uncertainty===null?(prior?.uncertaintyMax??null):Math.max(prior?.uncertaintyMax??0,s.uncertainty),
      unknownUncertaintyCount:(prior?.unknownUncertaintyCount??0)+(s.uncertainty===null?1:0),ageUnknownCount:(prior?.ageUnknownCount??0)+(!delay.ok || delay.value===null?1:0),
      firstSourceTime:prior?.firstSourceTime??m.sourceTime,lastSourceTime:m.sourceTime,
      firstReceivedAtMs:prior?.firstReceivedAtMs??tx.now,lastReceivedAtMs:tx.now,
      missingSequences:String(BigInt(prior?.missingSequences??'0')+BigInt(gap))};
    await this.save(tx,tier,group,m,config,record,{atMs,metric:s.metric,quality:effective.quality});
  }
  async device(siteId: string, input: unknown): Promise<unknown> {
    exact(input,['version','realm','siteId','deviceId','credentialId','identity','configRevision','issuedAtMs','expiresAtMs','action','payload','signature']);
    if (input.version!==VERSION || !isRealm(input.realm) || !sameRealm(input.realm,this.jobs.realm) || input.siteId!==siteId || !['ingest','trace'].includes(String(input.action))) throw new JobError('INVALID_REQUEST');
    id(input.deviceId);id(input.credentialId);id(input.configRevision);
    milliseconds(input.issuedAtMs,0,Number.MAX_SAFE_INTEGER);milliseconds(input.expiresAtMs,0,Number.MAX_SAFE_INTEGER);
    if (bytes(input)>60_000) throw new JobError('CAPACITY');
    const request=structuredClone(input);
    return this.jobs.transaction(siteId,async tx=>{
      const device=this.jobs.activeDevice(tx,String(request.deviceId));
      const credential=device.credentials.find(c=>c.id===request.credentialId && c.revokedAtMs===null && c.createdAtMs<=tx.now && c.expiresAtMs>tx.now);
      if (!credential || !isDeepStrictEqual(device.current,request.identity) || request.configRevision!==tx.registry.configRevision ||
        Number(request.issuedAtMs)>tx.now+this.jobs.receiverUncertaintyMs || Number(request.expiresAtMs)<=tx.now ||
        Number(request.expiresAtMs)-Number(request.issuedAtMs)>10000 || Number(request.expiresAtMs)<=Number(request.issuedAtMs)) throw new JobError('DENIED');
      const {signature,...unsigned}=request;
      try {prove(credential.publicKey,unsigned,signature);} catch {throw new JobError('DENIED');}
      await this.budget(tx,request.action==='trace'?'trace':'ingest');
      await this.prune(tx);
      const parse=(input:unknown):Telemetry|Event=>{
        const v=validateMessage(input);
        if (!v.ok || v.value.kind==='command' || v.value.ingestTime!==null || v.value.executionMode!=='simulation' ||
          !sameRealm(v.value.realm,this.jobs.realm) || v.value.siteId!==siteId || !isDeepStrictEqual(v.value.source,device.current)) throw new JobError('INVALID_REQUEST');
        return v.value;
      };
      const heads=await this.heads(tx);
      const snapshotHead=heads.find(h=>h.device_id===device.id && h.stream==='event')?.record;
      const receiver=(await tx.sql.query<{record:{event:Event;receivedAtMs:number}}>(`SELECT record FROM arbi_job_receivers
        WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND device_id=$4`,[...scope(this.jobs.realm,siteId),device.id])).rows[0]?.record;
      const snapshots=[snapshotHead?.snapshot,receiver?.event].filter((e):e is Event=>!!e && e.body.type==='state.snapshot' &&
        isDeepStrictEqual(e.source,device.current) && e.body.configRevision===tx.registry.configRevision);
      const snapshot=snapshots.sort((a,b)=>BigInt(a.sequence)>BigInt(b.sequence)?-1:1)[0];
      const validateTelemetry=(m:Telemetry,previous?:Head,traceState?:TelemetryState)=>{
        if (!snapshot || snapshot.body.type!=='state.snapshot' || !isDeepStrictEqual(snapshot.body.capabilities,device.capabilities)) throw new JobError('DENIED');
        const same=previous && isDeepStrictEqual(previous.message.source,m.source) && previous.configRevision===tx.registry.configRevision;
        const result=applyTelemetry(m,{realm:this.jobs.realm,executionMode:'simulation',siteId,authenticatedSource:device.current!,activeSource:device.current!,
          capabilitiesRevision:snapshot.body.capabilitiesRevision,capabilities:device.capabilities},traceState??{sequence:null,sourceMonotonicMs:same?previous.message.sourceTime.monotonicMs:null,
          samples:new Map(same?previous.readings.map(r=>[r.sample.metric,r.sample]):[])});
        if (!result.ok) throw new JobError('INVALID_REQUEST');
      };
      if (request.action==='trace') {
        exact(request.payload,['traceId','eventId','messages']);id(request.payload.traceId);id(request.payload.eventId);
        if (!Array.isArray(request.payload.messages) || !request.payload.messages.length || request.payload.messages.length>128) throw new JobError('CAPACITY');
        const messages=request.payload.messages.map(parse);
        let previous:Telemetry|undefined;
        const traceState:TelemetryState={sequence:null,sourceMonotonicMs:null,samples:new Map()};
        for (const m of messages) {
          if(m.kind!=='telemetry') throw new JobError('INVALID_REQUEST');validateTelemetry(m,undefined,traceState);
          if (previous && (BigInt(m.sequence)<=BigInt(previous.sequence) || m.sourceTime.monotonicMs<previous.sourceTime.monotonicMs)) throw new JobError('INVALID_REQUEST');
          previous=m;
        }
        if(messages[messages.length-1].sourceTime.monotonicMs-messages[0].sourceTime.monotonicMs>10000 ||
          messages.reduce((n,m)=>n+(m.kind==='telemetry'?m.body.samples.length:0),0)>512) throw new JobError('CAPACITY');
        const event=(await tx.sql.query<{record:{message:Event;configRevision:string}}>(`SELECT record FROM arbi_telemetry_history
          WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND tier='event' AND key=$4`,[...scope(this.jobs.realm,siteId),String(request.payload.eventId)])).rows[0]?.record;
        if(!event || event.configRevision!==tx.registry.configRevision || !isDeepStrictEqual(event.message.source,device.current)) throw new JobError('DENIED');
        const record={traceId:request.payload.traceId,eventId:request.payload.eventId,configRevision:tx.registry.configRevision,receivedAtMs:tx.now,messages};
        const old=(await tx.sql.query<{record:typeof record}>(`SELECT record FROM arbi_telemetry_history WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND tier='trace' AND key=$4`,[...scope(this.jobs.realm,siteId),String(request.payload.traceId)])).rows[0]?.record;
        if(old) {
          if(!isDeepStrictEqual({...old,receivedAtMs:0},{...record,receivedAtMs:0})) throw new JobError('CONFLICT');
          return {decision:'duplicate',durable:true};
        }
        await this.save(tx,'trace',String(request.payload.traceId),messages[0],tx.registry.configRevision,record);
        await this.prune(tx);return {decision:'recorded',durable:true};
      }
      const message=parse(request.payload),fingerprint=digest(message);
      const streamPrior=(await tx.sql.query<{fingerprint:string}>(`SELECT fingerprint FROM arbi_telemetry_history
        WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND tier=$4 AND stream_key=$5 LIMIT 14`,
        [...scope(this.jobs.realm,siteId),message.kind==='telemetry'?'raw':'event',keyOf(message)])).rows;
      if(streamPrior.some(p=>p.fingerprint!==fingerprint)) throw new JobError('CONFLICT');
      if(message.kind==='event') {
        const prior=(await tx.sql.query<{fingerprint:string}>(`SELECT fingerprint FROM arbi_telemetry_history
          WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND tier='event' AND key=$4`,[...scope(this.jobs.realm,siteId),message.messageId])).rows[0];
        if(prior && prior.fingerprint!==fingerprint) throw new JobError('CONFLICT');
      }
      const previous=heads.find(h=>h.device_id===device.id && h.stream===message.kind)?.record;
      const same=previous && isDeepStrictEqual(previous.message.source,message.source);
      if(message.kind==='telemetry') validateTelemetry(message);
      if(message.kind==='event' && message.body.type==='state.snapshot' &&
        (message.body.configRevision!==tx.registry.configRevision || !isDeepStrictEqual(message.body.capabilities,device.capabilities))) throw new JobError('DENIED');
      if(same && BigInt(message.sequence)<=BigInt(previous.message.sequence)) {
        if(message.sequence===previous.message.sequence && fingerprint!==previous.fingerprint) throw new JobError('CONFLICT');
        if(message.sequence===previous.message.sequence) return {decision:'duplicate',durable:true};
        const late={...message,ingestTime:{utc:new Date(tx.now).toISOString(),uncertaintyMs:this.jobs.receiverUncertaintyMs,deviceId:'telemetry-service'}};
        const saveLate=async(key:string,record:unknown,fields:Parameters<TelemetryStore['save']>[6])=>{
          const prior=(await tx.sql.query<{fingerprint:string}>(`SELECT fingerprint FROM arbi_telemetry_history WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND tier=$4 AND key=$5`,
            [...scope(this.jobs.realm,siteId),message.kind==='event'?'event':'raw',key])).rows[0];
          if(prior && prior.fingerprint!==fingerprint) throw new JobError('CONFLICT');
          if(!prior) await this.save(tx,message.kind==='event'?'event':'raw',key,message,tx.registry.configRevision,record,fields);
        };
        if(late.kind==='event') await saveLate(message.messageId,{message:late,configRevision:tx.registry.configRevision,receivedAtMs:tx.now,late:true},
          {eventType:late.body.type,...(late.body.type==='fault.changed'?{faultId:late.body.faultId,severity:late.body.severity}:{})});
        else for(const sample of late.body.samples) {
          const delay=transportAgeUpperBound(late),effective=ageSample(sample,0,delay.ok?delay.value:null,FRESH_MS);
          await saveLate(`${keyOf(message)}:${sample.metric}`,{sample,message:provenance(late),configRevision:tx.registry.configRevision,receivedAtMs:tx.now,late:true,effectiveSample:effective},
            {metric:sample.metric,quality:effective.quality});
        }
        await this.prune(tx);return {decision:'late',durable:true};
      }
      if(same && message.sourceTime.monotonicMs<previous.message.sourceTime.monotonicMs) throw new JobError('INVALID_REQUEST');
      if(message.kind==='telemetry') validateTelemetry(message,previous);
      const gap=same?String(BigInt(message.sequence)-BigInt(previous.message.sequence)-1n):'0';
      const configSame=same && previous.configRevision===tx.registry.configRevision &&
        (message.kind!=='telemetry' || previous.message.kind!=='telemetry' || previous.message.body.capabilitiesRevision===message.body.capabilitiesRevision);
      const admitted={...message,ingestTime:{utc:new Date(tx.now).toISOString(),uncertaintyMs:this.jobs.receiverUncertaintyMs,deviceId:'telemetry-service'}};
      const head:Head={message:admitted,configRevision:tx.registry.configRevision,receivedAtMs:tx.now,fingerprint,gap,
        missingSequences:String(BigInt(previous?.missingSequences??'0')+BigInt(gap)),reset:!!previous && !same,
        resets:(previous?.resets??0)+(previous && !same?1:0),
        readings:configSame?previous.readings:[],snapshot:configSame?previous.snapshot:null,faults:configSame?previous.faults:[]};
      if(admitted.kind==='telemetry') {
        for(const sample of admitted.body.samples) {
          const reading={sample,message:provenance(admitted),receivedAtMs:tx.now};
          head.readings=head.readings.filter(r=>r.sample.metric!==sample.metric);head.readings.push(reading);
          const delay=transportAgeUpperBound(admitted),effective=ageSample(sample,0,delay.ok?delay.value:null,FRESH_MS);
          await this.save(tx,'raw',`${keyOf(message)}:${sample.metric}`,message,head.configRevision,{...reading,configRevision:head.configRevision,gap,reset:head.reset,effectiveSample:effective},{metric:sample.metric,quality:effective.quality});
          await this.aggregate(tx,'minute',reading,head.configRevision,gap);await this.aggregate(tx,'hour',reading,head.configRevision,gap);
        }
      } else {
        if(admitted.body.type==='state.snapshot') head.snapshot=admitted;
        if(admitted.body.type==='fault.changed') {
          const faultId=admitted.body.faultId;
          head.faults=head.faults.filter(e=>e.body.type!=='fault.changed' || e.body.faultId!==faultId);head.faults.push(admitted);
          if(head.faults.length>64) {
            const cleared=head.faults.findIndex(e=>e.body.type==='fault.changed' && e.body.state==='cleared');
            if(cleared>=0) head.faults.splice(cleared,1);
          }
          if(head.faults.length>64) throw new JobError('CAPACITY');
        }
        await this.save(tx,'event',message.messageId,message,head.configRevision,{message:admitted,configRevision:head.configRevision,receivedAtMs:tx.now,gap,reset:head.reset},
          {eventType:admitted.body.type,...(admitted.body.type==='fault.changed'?{faultId:admitted.body.faultId,severity:admitted.body.severity}:{})});
      }
      if(heads.length>=64 && !previous) throw new JobError('CAPACITY');
      await tx.sql.query(`INSERT INTO arbi_telemetry_heads VALUES($1,$2,$3,$4,$5,$6::jsonb)
        ON CONFLICT(environment,namespace_id,site_id,device_id,stream) DO UPDATE SET record=EXCLUDED.record`,[...scope(this.jobs.realm,siteId),device.id,message.kind,JSON.stringify(head)]);
      await this.prune(tx);return {decision:'recorded',durable:true,gap,reset:head.reset};
    },1500);
  }
  private view(head:Head,tx:Tx,currentSnapshot?:Event) {
    const device=tx.registry.devices.find(d=>d.id===head.message.source.deviceId);
    const compatible=device?.status==='active' && device.revokedAtMs===null && device.appliedConfigRevision===tx.registry.configRevision &&
      isDeepStrictEqual(device.current,head.message.source) && head.configRevision===tx.registry.configRevision;
    const delay=transportAgeUpperBound(head.message),bound=delay.ok?delay.value:null;
    const {fingerprint:_,...publicHead}=head;
    const snapshot=currentSnapshot??head.snapshot;
    const capabilitiesCurrent=head.message.kind!=='telemetry' || (snapshot?.body.type==='state.snapshot' && snapshot.body.capabilitiesRevision===head.message.body.capabilitiesRevision);
    const snapshotDelay=snapshot?transportAgeUpperBound(snapshot):null;
    const snapshotReceived=snapshot?.ingestTime?Date.parse(snapshot.ingestTime.utc):null;
    const snapshotAge=snapshotReceived!==null && snapshotDelay?.ok && snapshotDelay.value!==null?tx.now-snapshotReceived+snapshotDelay.value:null;
    return {...publicHead,snapshot,currentIdentity:compatible,capabilitiesCurrent:!!capabilitiesCurrent,
      fresh:!!compatible && !!capabilitiesCurrent && bound!==null && tx.now-head.receivedAtMs+bound<=FRESH_MS,
      snapshotFresh:!!compatible && snapshotAge!==null && snapshotAge<=FRESH_MS,snapshotAgeUpperBoundMs:snapshotAge,
      coverage:{startKnown:false,missingSequences:head.missingSequences,lastGap:head.gap,resets:head.resets,reset:head.reset},
      readings:head.readings.map(r=>{
        const delay=delayOf(r.message),bound=delay.ok?delay.value:null;
        const elapsed=tx.now-r.receivedAtMs;
        return {sample:ageSample(r.sample,elapsed,compatible && capabilitiesCurrent?bound:null,FRESH_MS),receivedAtMs:r.receivedAtMs,
          provenance:{messageId:r.message.messageId,source:r.message.source,sequence:r.message.sequence,sourceTime:r.message.sourceTime,
            ingestTime:r.message.ingestTime,capabilitiesRevision:r.message.capabilitiesRevision},
          ageUpperBoundMs:bound===null?null:(r.sample.ageMs??0)+elapsed+bound,fresh:!!compatible && !!capabilitiesCurrent && r.sample.quality!=='unavailable' && ageSample(r.sample,elapsed,bound,FRESH_MS).quality!=='stale'};
      })};
  }
  async read(context:AuthorizedContext,action:'current'|'history'|'inventory',input:unknown):Promise<unknown> {
    const required=action==='current'?'state.read':action==='inventory' || (input as {tier?:string})?.tier==='trace'?'diagnostics.read':'history.read';
    if(context.actor.kind!=='human' || context.capability!==required) throw new JobError('DENIED');
    return this.jobs.transaction(context.siteId,async tx=>{
      await this.jobs.authority(tx,context);await this.budget(tx,'read');
      let result:unknown;
      let materialize:(()=>unknown)|undefined;
      if(action==='current') {
        const q=input as Record<string,unknown>;
        if(!q || typeof q!=='object' || Array.isArray(q) || Object.keys(q).some(k=>!['deviceId','after','limit'].includes(k))) throw new JobError('INVALID_REQUEST');
        const limit=q.limit??8;milliseconds(limit,1,32);if(q.deviceId!==undefined) id(q.deviceId);
        if(q.after!==undefined) {
          if(typeof q.after!=='string' || q.after.length>256 || !/:(event|telemetry)$/.test(q.after)) throw new JobError('INVALID_REQUEST');
          id(q.after.slice(0,q.after.lastIndexOf(':')));
        }
        const allHeads=await this.heads(tx);
        const heads=allHeads.filter(h=>(q.deviceId===undefined || h.device_id===q.deviceId) && (q.after===undefined || `${h.device_id}:${h.stream}`>String(q.after)));
        const snapshots=await this.snapshotMap(tx,allHeads);
        materialize=()=>({configRevision:tx.registry.configRevision,observedAtMs:tx.now,maxAgeMs:FRESH_MS,states:heads.slice(0,Number(limit)).map(h=>this.view(h.record,tx,snapshots.get(h.device_id))),
          next:heads.length>Number(limit)?`${heads[Number(limit)-1].device_id}:${heads[Number(limit)-1].stream}`:null});
      } else if(action==='inventory') {
        const q=input as Record<string,unknown>;
        if(!q || typeof q!=='object' || Array.isArray(q) || Object.keys(q).some(k=>!['assemblyId','after','limit'].includes(k))) throw new JobError('INVALID_REQUEST');
        milliseconds(q.limit,1,100);if(q.assemblyId!==undefined) id(q.assemblyId);if(q.after!==undefined) id(q.after);
        const items=tx.registry.components.filter(c=>(q.assemblyId===undefined || c.assemblyId===q.assemblyId) && (q.after===undefined || c.id>String(q.after))).sort((a,b)=>a.id<b.id?-1:1);
        const heads=await this.heads(tx),limit=Number(q.limit);
        const snapshots=await this.snapshotMap(tx,heads);
        materialize=()=>({configRevision:tx.registry.configRevision,hardwareDigest:tx.registry.hardwareDigest,observedAtMs:tx.now,
          items:items.slice(0,limit).map(component=>({...component,
            signals:tx.registry.signals.filter(s=>s.ownerComponentId===component.id || s.physicalComponentId===component.id).map(s=>({...s,
              unit:s.metric?.startsWith('position.')||s.metric?.startsWith('line.length.')?'mm':s.metric?.startsWith('line.tension.')?'N':s.metric==='power.voltage'?'V':s.metric?.startsWith('gimbal.')?'deg':null})),
            devices:tx.registry.devices.filter(d=>d.componentId===component.id).map(d=>({id:d.id,role:d.role,status:d.status,identity:d.current,
              appliedConfigRevision:d.appliedConfigRevision,softwareRevision:d.softwareRevision,lastSeenAtMs:d.lastSeenAtMs,
              fresh:d.status==='active' && d.revokedAtMs===null && d.appliedConfigRevision===tx.registry.configRevision && d.lastSeenAtMs!==null && tx.now>=d.lastSeenAtMs && tx.now-d.lastSeenAtMs<=FRESH_MS,
              telemetry:heads.filter(h=>h.device_id===d.id).map(h=>this.view(h.record,tx,snapshots.get(d.id)))}))})),
          next:items.length>limit?items[limit-1].id:null});
      } else {
        const q=historyQuery(input),hash=queryHash(JSON.stringify([this.jobs.realm,context.siteId]),q);
        const page=q.cursor?pageCursor(q.cursor,hash):{upper:(await tx.sql.query<{id:string}>(`SELECT coalesce(max(id),0)::text AS id FROM arbi_telemetry_history WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND tier=$4`,[...scope(this.jobs.realm,context.siteId),q.tier])).rows[0].id,after:'9223372036854775807'};
        const params:unknown[]=[...scope(this.jobs.realm,context.siteId),q.tier,Math.max(q.fromMs,tx.now-TIERS[q.tier].ageMs),q.toMs,page.upper,page.after];
        const predicates=['environment=$1','namespace_id=$2','site_id=$3','tier=$4','at_ms >= $5','at_ms < $6','id <= $7','id < $8'];
        for(const [field,column] of Object.entries({deviceId:'device_id',configRevision:'config_revision',metric:'metric',quality:'quality',faultId:'fault_id',severity:'severity',eventType:'event_type',traceId:'key'})) {
          const value=q[field as keyof typeof q];if(value!==undefined){params.push(value);predicates.push(`${column}=$${params.length}`);}
        }
        params.push(q.limit+1);
        const rows=(await tx.sql.query<Row>(`SELECT id::text,record FROM arbi_telemetry_history WHERE ${predicates.join(' AND ')} ORDER BY id DESC LIMIT $${params.length}`,params)).rows;
        const items=rows.slice(0,q.limit);
        result={tier:q.tier,observedAtMs:tx.now,retention:TIERS[q.tier],window:{fromMs:params[4],toMs:q.toMs},
          coverage:'bounded-observations',items:items.map(r=>({id:r.id,...r.record})),
          next:rows.length>q.limit?Buffer.from(JSON.stringify({version:VERSION,hash,upper:page.upper,after:items[items.length-1].id})).toString('base64url'):null};
      }
      // Directory/session may change while the database is reading. Recheck before returning protected data.
      await this.jobs.authority(tx,context);
      if(materialize) result=materialize();
      if(bytes(result)>256_000) throw new JobError('CAPACITY');
      return result;
    },1500);
  }
  /** Operator calls one known site per invocation; no unbounded all-site scan or reliance on a scheduled prune for query limits. */
  async maintain(siteId:string):Promise<void> {
    await this.jobs.transaction(siteId,async tx=>{await this.prune(tx);},1500);
  }
}
