import { randomUUID } from 'node:crypto';
import { digest } from '@arbi/audit';
import { billingPeriod } from '@arbi/protocol';
import { bounded, type AuthorizedContext } from '@arbi/gredice';
import { scope } from '../audit/store';
import { exact, id, JobError } from '../jobs/contracts';
import { query } from './contracts';
import { REPORT_VERSION, reportQuery, usageSettings, type Destination, type UsageSettings } from './settings-contracts';
import { ruleCrossed, usageReport } from './report';
import type { UsageStore } from './store';

export interface UsageAlert {
  id:string;siteId:string;realm:AuthorizedContext['realm'];linkId:string;settingsRevision:string;ruleId:string;kind:'threshold'|'metering';
  layer:string;period:{start:string;end:string};atMs:number;bytes:string|null;allowanceBytes:string|null;coverageComplete:boolean;stale:boolean;quality:string;
  destinations:Destination[];sourceObservationIds:string[];
}
type Tx=Parameters<Parameters<UsageStore['jobs']['transaction']>[1]>[0];
export class UsageSettingsStore {
  constructor(readonly usage:UsageStore){}
  async #latest(tx:Tx,linkId:string){
    return (await tx.sql.query<{record:UsageSettings;audit_id:string}>(`SELECT record,audit_id FROM arbi_usage_settings WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND link_id=$4 ORDER BY ordinal DESC LIMIT 1`,
      [...scope(this.usage.jobs.realm,tx.registry.siteId),linkId])).rows[0];
  }
  async settings(context:AuthorizedContext,input:unknown,write=false){
    if(!write){exact(input,['linkId']);id(input.linkId);return this.usage.jobs.transaction(context.siteId,async tx=>{
      await this.usage.jobs.authority(tx,context);if(context.capability!=='history.read')throw new JobError('DENIED');const result=await this.#latest(tx,String(input.linkId));
      await this.usage.jobs.authority(tx,context);return result?{settings:result.record,auditId:result.audit_id}:{settings:null,auditId:null};
    },1500);}
    const value=usageSettings(input,this.usage.jobs.realm,context.siteId);
    return this.usage.jobs.transaction(context.siteId,async tx=>{
      await this.usage.jobs.authority(tx,context);if(context.capability!=='configuration.write')throw new JobError('DENIED');
      const key=[...scope(this.usage.jobs.realm,context.siteId),value.plan.linkId,value.revision];
      const prior=(await tx.sql.query<{record:UsageSettings;audit_id:string}>('SELECT record,audit_id FROM arbi_usage_settings WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND link_id=$4 AND revision=$5',key)).rows[0];
      if(prior){if(digest(prior.record)!==digest(value))throw new JobError('CONFLICT');return {settings:prior.record,auditId:prior.audit_id};}
      const count=Number((await tx.sql.query<{n:string}>('SELECT count(*)::text n FROM arbi_usage_settings WHERE environment=$1 AND namespace_id=$2 AND site_id=$3',key.slice(0,3))).rows[0].n);if(count>=128)throw new JobError('CAPACITY');
      const intent=await this.usage.jobs.event(tx,context,'configuration.change',{kind:'configuration',id:value.revision,deviceId:null});intent.metadata={permission:'configure',configRevision:value.revision};
      await this.usage.jobs.admit(tx,intent);await tx.sql.query('INSERT INTO arbi_audit_deliveries(id) VALUES($1)',[intent.eventId]);
      await tx.sql.query('INSERT INTO arbi_usage_settings(environment,namespace_id,site_id,link_id,revision,at_ms,audit_id,record) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb)',[...key,tx.now,intent.eventId,JSON.stringify(value)]);
      await this.usage.jobs.authority(tx,context);return {settings:value,auditId:intent.eventId};
    },1500);
  }
  async report(context:AuthorizedContext,input:unknown,exporting=false){
    const q=reportQuery(input);return this.usage.jobs.transaction(context.siteId,async tx=>{
      await this.usage.jobs.authority(tx,context);if(context.capability!==(exporting?'audit.export':'history.read'))throw new JobError('DENIED');await this.usage.budget(tx,'read');
      const configured=await this.#latest(tx,q.linkId);if(!configured)throw new JobError('UNAVAILABLE');
      const settings=usageSettings(configured.record,this.usage.jobs.realm,context.siteId),cycle=billingPeriod(settings.plan.cycle,new Date(q.atMs).toISOString());if(!cycle.ok||q.atMs>tx.now)throw new JobError('INVALID_REQUEST');
      const source=await this.usage.rows(tx,query({linkId:q.linkId,fromMs:Date.parse(cycle.value.start),toMs:Date.parse(cycle.value.end)}));
      const end=Math.min(tx.now,Date.parse(cycle.value.end));const recent=await this.usage.rows(tx,query({linkId:q.linkId,fromMs:Math.max(0,end-settings.forecast.lookbackHours*3600000),toMs:end}));
      const report=usageReport(settings,q.atMs,source.map(r=>r.record),recent.map(r=>r.record),tx.now);
      const alerts:UsageAlert[]=[];
      if(!exporting)for(const rule of settings.rules){if(!ruleCrossed(rule,report))continue;
        const key=[...scope(this.usage.jobs.realm,context.siteId),q.linkId,Date.parse(cycle.value.start),rule.id];
        if((await tx.sql.query('SELECT id FROM arbi_usage_alerts WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND link_id=$4 AND period_start_ms=$5 AND rule_id=$6',key)).rows.length)continue;
        const count=Number((await tx.sql.query<{n:string}>('SELECT count(*)::text n FROM arbi_usage_alerts WHERE environment=$1 AND namespace_id=$2 AND site_id=$3',key.slice(0,3))).rows[0].n);if(count>=4096)throw new JobError('CAPACITY');
        const layer=report.layers.find(r=>r.layer===rule.layer)!;
        const alert:UsageAlert={id:randomUUID(),siteId:context.siteId,realm:this.usage.jobs.realm,linkId:q.linkId,settingsRevision:settings.revision,ruleId:rule.id,kind:rule.kind,layer:rule.layer,
          period:cycle.value,atMs:tx.now,bytes:layer.bytes,allowanceBytes:report.allowanceBytes,coverageComplete:layer.coverageComplete,stale:layer.stale,quality:layer.quality,
          destinations:settings.destinations.filter(d=>rule.destinationIds.includes(d.id)),sourceObservationIds:report.sourceRefs.map(r=>r.observationId)};
        await tx.sql.query('INSERT INTO arbi_usage_alerts VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)',[alert.id,...key.slice(0,5),rule.id,tx.now,JSON.stringify(alert)]);alerts.push(alert);
      }
      const payload={version:REPORT_VERSION,siteId:context.siteId,realm:this.usage.jobs.realm,atMs:tx.now,requestedPeriodAtMs:q.atMs,report,settingsAuditId:configured.audit_id,
        alertEvaluation:exporting?'not-run-on-export':'on-authorized-report; request historical periods to evaluate late arrivals',newAlerts:alerts,
        collectionGaps:'see per-layer coverage, source windows, stale and unknown markers',notificationDelivery:'durable operator inbox; external delivery requires a trusted adapter'};
      if(Buffer.byteLength(JSON.stringify(payload))>8*1024*1024)throw new JobError('CAPACITY');await this.usage.jobs.authority(tx,context);
      return exporting?{...payload,integrity:{algorithm:'canonical SHA-256',digest:digest(payload),signature:'none'}}:payload;
    },1500);
  }
  async alerts(context:AuthorizedContext,input:unknown){
    const q=query(input);return this.usage.jobs.transaction(context.siteId,async tx=>{
      await this.usage.jobs.authority(tx,context);if(context.capability!=='history.read')throw new JobError('DENIED');
      const rows=(await tx.sql.query<{record:UsageAlert}>(`SELECT record FROM arbi_usage_alerts WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND link_id=$4 AND period_start_ms>=$5 AND period_start_ms<$6 ORDER BY at_ms,id LIMIT 129`,
        [...scope(this.usage.jobs.realm,context.siteId),q.linkId,q.fromMs,q.toMs])).rows;
      if(rows.length>128)throw new JobError('CAPACITY');await this.usage.jobs.authority(tx,context);return {alerts:rows.map(r=>r.record),maxRows:128};
    },1500);
  }
  /** Trusted worker seam; adapters must resolve current destinations and deduplicate the immutable alert/destination key. */
  async deliver(siteId:string,send:(alert:UsageAlert,destination:Destination,key:string,signal:AbortSignal)=>Promise<boolean>,limit=16){
    id(siteId);if(!Number.isSafeInteger(limit)||limit<1||limit>32)throw new JobError('INVALID_REQUEST');
    const pending=await this.usage.jobs.transaction(siteId,async tx=>(await tx.sql.query<{record:UsageAlert;destination:Destination}>(`SELECT a.record,d.value destination FROM arbi_usage_alerts a
      CROSS JOIN LATERAL jsonb_array_elements(a.record->'destinations') d(value) LEFT JOIN arbi_usage_alert_deliveries r ON r.alert_id=a.id AND r.destination_id=d.value->>'id'
      WHERE a.environment=$1 AND a.namespace_id=$2 AND a.site_id=$3 AND r.alert_id IS NULL ORDER BY a.at_ms,a.id,d.value->>'id' LIMIT $4`,[...scope(this.usage.jobs.realm,siteId),limit])).rows,1500);
    let delivered=0;for(const row of pending){const key=digest([this.usage.jobs.realm,siteId,row.record.id,row.destination.id]);
      let acknowledged=false;
      try{acknowledged=await bounded(1000,signal=>send(structuredClone(row.record),structuredClone(row.destination),key,signal));}catch{/* A failed destination remains pending without blocking this batch. */}
      if(!acknowledged)continue;
      await this.usage.jobs.transaction(siteId,async tx=>{await tx.sql.query('INSERT INTO arbi_usage_alert_deliveries VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[row.record.id,row.destination.id,tx.now]);},1500);delivered++;
    }return {attempted:pending.length,delivered};
  }
}
