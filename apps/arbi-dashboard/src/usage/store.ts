import { isDeepStrictEqual } from 'node:util';
import { digest } from '@arbi/audit';
import { isRealm, sameRealm, type AuthorizedContext } from '@arbi/gredice';
import { validateAccounting, type MobilePlan, type UsageObservation } from '@arbi/protocol';
import { scope } from '../audit/store';
import { prove } from '../enrollment/crypto';
import { exact, id, JobError, milliseconds } from '../jobs/contracts';
import { PostgresJobStore } from '../jobs/store';
import { domain, MAX_ROWS, MAX_SITE_ROWS, query, stream, VERSION, window, type Query } from './contracts';
import { comparisons, periodReport, rollup } from './rollup';
type Tx=Parameters<Parameters<PostgresJobStore['transaction']>[1]>[0];
function boundedReport<T>(result:T):T {
  if(Buffer.byteLength(JSON.stringify(result))>8*1024*1024)throw new JobError('CAPACITY');return result;
}

export class UsageStore {
  constructor(readonly jobs:PostgresJobStore) {}
  private async budget(tx:Tx,kind:'read'|'ingest') {
    const minute=Math.floor(tx.now/60_000)*60_000;
    const row=(await tx.sql.query<{attempts:number}>(`INSERT INTO arbi_usage_budgets VALUES($1,$2,$3,$4,$5,1)
      ON CONFLICT(environment,namespace_id,site_id,kind) DO UPDATE SET minute_ms=EXCLUDED.minute_ms,
      attempts=CASE WHEN arbi_usage_budgets.minute_ms=EXCLUDED.minute_ms THEN arbi_usage_budgets.attempts+1 ELSE 1 END RETURNING attempts`,
      [...scope(this.jobs.realm,tx.registry.siteId),kind,minute])).rows[0];
    if(row.attempts>(kind==='read'?60:120))throw new JobError('CAPACITY');
  }
  async ingest(siteId:string,input:unknown) {
    exact(input,['version','realm','siteId','deviceId','credentialId','identity','issuedAtMs','expiresAtMs','action','payload','signature']);
    if(input.version!==VERSION || !isRealm(input.realm) || !sameRealm(input.realm,this.jobs.realm) || input.siteId!==siteId || input.action!=='ingest')throw new JobError('INVALID_REQUEST');
    id(input.deviceId);id(input.credentialId);milliseconds(input.issuedAtMs,0,Number.MAX_SAFE_INTEGER);milliseconds(input.expiresAtMs,0,Number.MAX_SAFE_INTEGER);
    if(!Array.isArray(input.payload) || !input.payload.length || input.payload.length>32 || Buffer.byteLength(JSON.stringify(input))>60_000)throw new JobError('CAPACITY');
    const request=structuredClone(input),windows=(request.payload as unknown[]).map(window);
    return this.jobs.transaction(siteId,async tx=>{
      const device=this.jobs.activeDevice(tx,String(request.deviceId),false);
      const credential=device.credentials.find(c=>c.id===request.credentialId && c.revokedAtMs===null && c.createdAtMs<=tx.now && c.expiresAtMs>tx.now);
      if(!credential || !isDeepStrictEqual(device.current,request.identity) || Number(request.issuedAtMs)>tx.now+100 || Number(request.expiresAtMs)<=tx.now ||
        Number(request.expiresAtMs)<=Number(request.issuedAtMs) || Number(request.expiresAtMs)-Number(request.issuedAtMs)>10000)throw new JobError('DENIED');
      const {signature,...unsigned}=request;try{prove(credential.publicKey,unsigned,signature);}catch{throw new JobError('DENIED');}
      await this.budget(tx,'ingest');
      const results=[];
      for(const value of windows) {
        const o=value.observation;
        // Current enrolled collectors may replay their own retired boot windows; enrollment retains exact retired identities.
        if(!sameRealm(o.realm,this.jobs.realm) || o.siteId!==siteId || o.executionMode!=='simulation' ||
          ![device.current,...device.retiredIdentities].some(i=>isDeepStrictEqual(i,o.source)) || Date.parse(o.interval.end)>tx.now+100 ||
          (o.evidence.observedAt!==null && Date.parse(o.evidence.observedAt)>tx.now+100))throw new JobError('DENIED');
        const key=scope(this.jobs.realm,siteId),s=stream(o),d=domain(o),fingerprint=digest(value);
        const prior=(await tx.sql.query<{observation_id:string;fingerprint:string}>(`SELECT observation_id,fingerprint FROM arbi_usage_windows
          WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND (observation_id=$4 OR (stream=$5 AND sequence=$6))`,[...key,o.observationId,s,value.sequence])).rows;
        if(prior.length){if(prior.length!==1 || prior[0].observation_id!==o.observationId || prior[0].fingerprint!==fingerprint)throw new JobError('CONFLICT');
          results.push({observationId:o.observationId,decision:'duplicate'});continue;}
        const start=Date.parse(o.interval.start),end=Date.parse(o.interval.end);
        const overlapping=(await tx.sql.query(`SELECT w.id FROM arbi_usage_windows w WHERE w.environment=$1 AND w.namespace_id=$2 AND w.site_id=$3
          AND domain=$4 AND start_ms<$6 AND end_ms>$5 AND NOT EXISTS(SELECT 1 FROM arbi_usage_corrections c WHERE c.environment=w.environment
          AND c.namespace_id=w.namespace_id AND c.site_id=w.site_id AND c.observation_id=w.observation_id) LIMIT 1`,[...key,d,start,end])).rows;
        if(overlapping.length)throw new JobError('CONFLICT');
        const count=Number((await tx.sql.query<{count:string}>('SELECT count(*)::text AS count FROM arbi_usage_windows WHERE environment=$1 AND namespace_id=$2 AND site_id=$3',key)).rows[0].count);
        if(count>=MAX_SITE_ROWS)throw new JobError('CAPACITY');
        await tx.sql.query(`INSERT INTO arbi_usage_windows(environment,namespace_id,site_id,observation_id,stream,sequence,domain,link_id,start_ms,end_ms,received_at_ms,fingerprint,record)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)`,[...key,o.observationId,s,value.sequence,d,o.linkId,start,end,tx.now,fingerprint,JSON.stringify(o)]);
        results.push({observationId:o.observationId,decision:'recorded'});
      }
      return {durable:true,results};
    },1500);
  }
  private async rows(tx:Tx,q:Query) {
    const rows=(await tx.sql.query<{record:UsageObservation;received_at_ms:string;sequence:string;stream:string}>(`SELECT w.record,w.received_at_ms,w.sequence::text,w.stream FROM arbi_usage_windows w
      WHERE w.environment=$1 AND w.namespace_id=$2 AND w.site_id=$3 AND w.link_id=$4 AND w.start_ms<$6 AND w.end_ms>$5
      AND NOT EXISTS(SELECT 1 FROM arbi_usage_corrections c WHERE c.environment=w.environment AND c.namespace_id=w.namespace_id
      AND c.site_id=w.site_id AND c.observation_id=w.observation_id) ORDER BY w.start_ms,w.id LIMIT $7`,
      [...scope(this.jobs.realm,tx.registry.siteId),q.linkId,q.fromMs,q.toMs,MAX_ROWS+1])).rows;
    if(rows.length>MAX_ROWS)throw new JobError('CAPACITY');return rows;
  }
  async read(context:AuthorizedContext,input:unknown) {
    const q=query(input);
    return this.jobs.transaction(context.siteId,async tx=>{
      await this.jobs.authority(tx,context);if(context.capability!=='history.read')throw new JobError('DENIED');await this.budget(tx,'read');
      const source=await this.rows(tx,q),rows=source.map(r=>r.record),totals=rollup(rows,q.fromMs,q.toMs,tx.now);
      const corrections=(await tx.sql.query<{record:UsageObservation;sequence:string;reason_id:string;audit_id:string;at_ms:string}>(`SELECT w.record,w.sequence::text,c.reason_id,c.audit_id,c.at_ms
        FROM arbi_usage_windows w JOIN arbi_usage_corrections c ON c.environment=w.environment AND c.namespace_id=w.namespace_id AND c.site_id=w.site_id AND c.observation_id=w.observation_id
        WHERE w.environment=$1 AND w.namespace_id=$2 AND w.site_id=$3 AND w.link_id=$4 AND w.start_ms<$6 AND w.end_ms>$5 ORDER BY w.start_ms,w.id LIMIT $7`,
        [...scope(this.jobs.realm,context.siteId),q.linkId,q.fromMs,q.toMs,MAX_ROWS+1])).rows;
      if(corrections.length>MAX_ROWS)throw new JobError('CAPACITY');
      const sequenceGaps=[];
      const streams=new Map<string,typeof source>();
      for(const row of source){const list=streams.get(row.stream)??[];list.push(row);streams.set(row.stream,list);}
      for(const list of streams.values()){
        list.sort((a,b)=>BigInt(a.sequence)<BigInt(b.sequence)?-1:1);
        for(let n=1;n<list.length;n++)if(BigInt(list[n].sequence)>BigInt(list[n-1].sequence)+1n)
          sequenceGaps.push({source:list[n].record.source,counterEpoch:list[n].record.counterEpoch,from:String(BigInt(list[n-1].sequence)+1n),to:String(BigInt(list[n].sequence)-1n)});
      }
      const days=[];for(let start=Math.floor(q.fromMs/86_400_000)*86_400_000;start<q.toMs;start+=86_400_000)
        days.push({dayUtc:new Date(start).toISOString().slice(0,10),totals:rollup(rows,Math.max(q.fromMs,start),Math.min(q.toMs,start+86_400_000),tx.now)});
      return boundedReport({version:VERSION,siteId:context.siteId,realm:this.jobs.realm,executionMode:'simulation',receivedAtMs:tx.now,totals,days,comparisons:comparisons(totals),
        coverage:rows.length?'see-source-windows':'unavailable',source:source.map(r=>({observation:r.record,sequence:r.sequence,receivedAtMs:Number(r.received_at_ms)})),
        corrections:corrections.map(r=>({observation:r.record,sequence:r.sequence,reasonId:r.reason_id,auditId:r.audit_id,atMs:Number(r.at_ms)})),
        sequenceGaps:sequenceGaps.slice(0,32),sequenceGapsTruncated:sequenceGaps.length>32,sequenceCoverage:'within-query-only',
        limits:{maxQueryRows:MAX_ROWS,maxStoredRows:MAX_SITE_ROWS,maxResponseBytes:8*1024*1024},carrierBillingTruth:false});
    },1500);
  }
  async period(context:AuthorizedContext,input:unknown) {
    exact(input,['plan','atMs','previousUnusedBaseBytes']);milliseconds(input.atMs,0,253402300799999);
    if(input.previousUnusedBaseBytes!==null && (typeof input.previousUnusedBaseBytes!=='string' || !/^(0|[1-9][0-9]{0,19})$/.test(input.previousUnusedBaseBytes)))throw new JobError('INVALID_REQUEST');
    const result=validateAccounting(input.plan);
    if(!result.ok || result.value.kind!=='mobile-plan' || !sameRealm(result.value.realm,this.jobs.realm) || result.value.siteId!==context.siteId)throw new JobError('INVALID_REQUEST');
    const plan=result.value as MobilePlan,atMs=Number(input.atMs),carry=input.previousUnusedBaseBytes;
    const initial=periodReport(plan,atMs,[],Date.now(),carry as string|null);
    const q=query({linkId:plan.linkId,fromMs:Date.parse(initial.period.start),toMs:Date.parse(initial.period.end)});
    return this.jobs.transaction(context.siteId,async tx=>{
      await this.jobs.authority(tx,context);if(context.capability!=='history.read')throw new JobError('DENIED');await this.budget(tx,'read');
      return {...periodReport(plan,atMs,(await this.rows(tx,q)).map(r=>r.record),tx.now,carry as string|null),
        assumptions:'caller-supplied plan and prior unused base; not provider billing evidence',carrierBillingTruth:false};
    },1500);
  }
  /** Correct by adding an attributable invalidation; raw source, sequence and fingerprint stay immutable. */
  async correct(context:AuthorizedContext,input:unknown) {
    exact(input,['key','observationId','reasonId']);id(input.key);id(input.observationId);id(input.reasonId);
    return this.jobs.transaction(context.siteId,async tx=>{
      await this.jobs.authority(tx,context);if(context.capability!=='configuration.write')throw new JobError('DENIED');
      const key=scope(this.jobs.realm,context.siteId);
      const prior=(await tx.sql.query<{observation_id:string;reason_id:string;request_key:string;actor_id:string;audit_id:string}>(`SELECT * FROM arbi_usage_corrections WHERE environment=$1 AND namespace_id=$2 AND site_id=$3
        AND (observation_id=$4 OR (actor_id=$5 AND request_key=$6))`,[...key,input.observationId,context.actor.id,input.key])).rows;
      if(prior.length){const p=prior[0];if(prior.length!==1 || p.observation_id!==input.observationId || p.reason_id!==input.reasonId || p.actor_id!==context.actor.id || p.request_key!==input.key)throw new JobError('CONFLICT');
        return {durable:true,auditId:p.audit_id};}
      if(!(await tx.sql.query('SELECT id FROM arbi_usage_windows WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND observation_id=$4',[...key,input.observationId])).rows.length)throw new JobError('DENIED');
      const event=await this.jobs.event(tx,context,'configuration.change',{kind:'configuration',id:String(input.observationId),deviceId:null});
      event.metadata.configRevision=String(input.observationId);
      await this.jobs.admit(tx,event);
      await tx.sql.query('INSERT INTO arbi_usage_corrections VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[...key,input.observationId,input.key,context.actor.id,input.reasonId,event.eventId,tx.now]);
      return {durable:true,auditId:event.eventId};
    },1500);
  }
}
