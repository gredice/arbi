import { randomUUID } from 'node:crypto';
import { digest } from '@arbi/audit';
import { isId, isRealm } from '@arbi/gredice';
import type { AuditEvent, Realm } from '@arbi/protocol';
import type { Registry } from '../enrollment/contracts';
import type { SqlDatabase } from '../enrollment/store';
import { PostgresAuditStore, type TrustedBinding } from '../audit/store';
import { OperationsError, OPERATIONS_VERSION } from './contracts';
/** Private operator connection: the public application DB cannot release or bypass quarantine. */
export async function quarantineRestoredRealm(db:SqlDatabase,realm:Realm,recoveryId:string,archiveDigest:string){
  if(!isRealm(realm)||realm.environment!=='test'||!isId(recoveryId)||!/^[a-f0-9]{64}$/.test(archiveDigest))throw new OperationsError('DENIED');
  let domain:OperationsError|undefined;const fail=(code:OperationsError['code']):never=>{domain=new OperationsError(code);throw domain;};
  return db.transaction(async sql=>{
    if(!(await sql.query("SELECT state FROM public.arbi_operations_gate WHERE singleton=true FOR UPDATE")).rows.length)fail('DENIED');
    const previous=(await sql.query<{record:Record<string,unknown>}>('SELECT record FROM arbi_recovery_runs WHERE id=$1',[recoveryId])).rows[0];
    if(previous){if(digest(previous.record.realm)!==digest(realm)||previous.record.archiveDigest!==archiveDigest)fail('TAMPER');return previous.record;}
    const count=Number((await sql.query<{n:string}>('SELECT count(*)::text n FROM arbi_recovery_runs')).rows[0].n);if(count>=128)fail('CAPACITY');
    const foreign=(await sql.query<{n:string}>('SELECT count(*)::text n FROM arbi_device_registry WHERE environment<>$1 OR namespace_id<>$2',[realm.environment,realm.namespaceId])).rows[0];
    if(Number(foreign.n))fail('DENIED');
    const sites=(await sql.query<{site_id:string;state:Registry}>('SELECT site_id,state FROM arbi_device_registry WHERE environment=$1 AND namespace_id=$2 ORDER BY site_id LIMIT 33 FOR UPDATE',[realm.environment,realm.namespaceId])).rows;
    if(!sites.length||sites.length>32||count+sites.length+1>128)fail('CAPACITY');
    const atMs=Date.now(),generation=randomUUID(),audit=new PostgresAuditStore(db,'operations-recovery');let revokedDevices=0,closedLeases=0,quarantinedJobs=0,closedLiveViewers=0;
    const hasLive=(await sql.query<{present:boolean}>("SELECT to_regclass('arbi_live_viewers') IS NOT NULL present")).rows[0].present;
    for(const site of sites){const key=[realm.environment,realm.namespaceId,site.site_id],state=structuredClone(site.state);
      for(const device of state.devices){if(device.status==='active'){device.status='revoked';device.revokedAtMs=atMs;revokedDevices++;}for(const credential of device.credentials)if(credential.revokedAtMs===null)credential.revokedAtMs=atMs;}
      await sql.query('UPDATE arbi_device_registry SET state=$4::jsonb WHERE environment=$1 AND namespace_id=$2 AND site_id=$3',[...key,JSON.stringify(state)]);
      const leases=(await sql.query<{id:string}>(`UPDATE arbi_control_leases SET ended_at_ms=$4,record=jsonb_set(record,'{endedAtMs}',to_jsonb($4::bigint))
        WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND ended_at_ms IS NULL RETURNING id`,[...key,atMs])).rows;closedLeases+=leases.length;
      const jobs=(await sql.query<{id:string}>(`UPDATE arbi_command_jobs SET record=jsonb_set(record,'{cloudDisposition}','"receiver-changed"'::jsonb)
        WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND record->'terminal'='null'::jsonb RETURNING id`,key)).rows;quarantinedJobs+=jobs.length;
      for(const table of ['arbi_job_receivers','arbi_telemetry_heads','arbi_realtime_grants','arbi_realtime_events','arbi_realtime_budgets','arbi_realtime_outbox'])
        await sql.query(`DELETE FROM ${table} WHERE environment=$1 AND namespace_id=$2 AND site_id=$3`,key);
      await sql.query('UPDATE arbi_realtime_sites SET epoch=$4,cursor=0 WHERE environment=$1 AND namespace_id=$2 AND site_id=$3',[...key,generation]);
      if(hasLive){
        closedLiveViewers+=(await sql.query(`UPDATE arbi_live_viewers SET ended_at_ms=$4,record=jsonb_set(jsonb_set(record,'{endedAtMs}',to_jsonb($4::bigint)),'{endReason}','"restore-quarantine"') WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND ended_at_ms IS NULL RETURNING id`,[...key,atMs])).rows.length;
        const producers=(await sql.query<{id:string;record:{demand:Record<string,unknown>;deliveredGeneration:null;observedState:null}}>('SELECT id,record FROM arbi_live_producers WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 ORDER BY id LIMIT 33',key)).rows;
        if(producers.length>32)fail('CAPACITY');
        for(const producer of producers){const fence=(await sql.query<{value:string}>(`UPDATE arbi_job_sites SET fence=fence+1 WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND fence<18446744073709551615 RETURNING fence::text value`,key)).rows[0];if(!fence)fail('CAPACITY');
          Object.assign(producer.record.demand,{generation:fence.value,viewers:0,issuedAtMs:atMs,expiresAtMs:atMs});producer.record.deliveredGeneration=null;producer.record.observedState=null;
          await sql.query('UPDATE arbi_live_producers SET record=$2::jsonb WHERE id=$1',[producer.id,JSON.stringify(producer.record)]);
        }
      }
      const event:AuditEvent={auditVersion:'arbi.audit/1.0',eventId:randomUUID(),realm,executionMode:'simulation',siteId:site.site_id,actor:{kind:'service',id:'restore-quarantine-v1'},
        source:{module:'cloud',identity:{deviceId:'operations-service',bootId:generation,sessionId:recoveryId}},sequence:'1',sourceTime:{utc:null,uncertaintyMs:null,monotonicMs:0},ingestTime:null,
        resource:{kind:'site',id:site.site_id,deviceId:null},action:'authorization.check',evidence:'authorization',outcome:'allow',effect:'none',reason:'authorized',
        links:{correlationId:recoveryId,intentEventId:null,causationEventId:null,jobId:null,sessionId:null,commandId:null,requestSource:null,target:null},record:null,metadata:{permission:'configure'},change:null};
      const binding:TrustedBinding={realm,siteId:site.site_id,executionMode:'simulation',authenticatedSource:event.source,actor:event.actor,resource:event.resource,action:event.action,evidence:event.evidence,
        links:event.links,record:null,metadata:event.metadata,change:null};await audit.stage(sql,event,binding);
      // Receipt links the authorized operator policy to committed database changes;
      // it is not a device completion or physical-state claim.
      const receipt={version:OPERATIONS_VERSION,recoveryId,realm,siteId:site.site_id,archiveDigest,generation,atMs,auditId:event.eventId,policy:'restore-quarantine-v1',state:'quarantined',
        scope:'restored database; immutable evidence retained; new receiver/directory reconciliation required'};
      await sql.query('INSERT INTO arbi_recovery_runs VALUES($1,$2,$3,$4,$5::jsonb)',[`${recoveryId}-${site.site_id}`,...key,JSON.stringify(receipt)]);
    }
    if((await sql.query<{present:boolean}>("SELECT to_regclass('public.arbi_dashboard_sessions') IS NOT NULL present")).rows[0].present)
      await sql.query('UPDATE arbi_dashboard_sessions SET revoked=true WHERE namespace_id=$1',[realm.namespaceId]);
    const receipt={version:OPERATIONS_VERSION,recoveryId,realm,archiveDigest,generation,atMs,state:'quarantined',sites:sites.map(s=>s.site_id),revokedDevices,closedLeases,quarantinedJobs,closedLiveViewers,
      scope:'database as of backup; later device/provider writes and private object bytes are outside this snapshot; no invented terminal outcomes'};
    await sql.query('INSERT INTO arbi_recovery_runs VALUES($1,$2,$3,$4,$5::jsonb)',[recoveryId,realm.environment,realm.namespaceId,sites[0].site_id,JSON.stringify(receipt)]);
    await sql.query("UPDATE public.arbi_operations_gate SET state='quarantined',generation=$1,changed_at_ms=$2,recovery_id=$3 WHERE singleton=true",[generation,atMs,recoveryId]);
    return receipt;
  }).catch(()=>{throw domain??new OperationsError('UNAVAILABLE');});
}
