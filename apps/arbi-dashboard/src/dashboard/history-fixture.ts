import { generateKeyPairSync, sign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { AuditEvent, Realm, UsageObservation } from '@arbi/protocol';
import { PostgresJobStore } from '../jobs/store';
import { UsageStore } from '../usage/store';
import { VERSION as USAGE_VERSION } from '../usage/contracts';
import type { Registry } from '../enrollment/contracts';
import { proofBytes } from '../enrollment/crypto';
import type { SqlDatabase } from '../enrollment/store';
import { PostgresAuditStore, type TrustedBinding } from '../audit/store';

/** Operator-only synthetic input. Uses real signed usage ingest and immutable audit admission; never invoked by app startup. */
export async function provisionDashboardHistory(db:SqlDatabase,realm:Realm){
  if(realm.environment!=='test')throw Error('DENIED');const siteId='synthetic-site',now=Date.now(),keys=generateKeyPairSync('ed25519');
  const current={deviceId:'synthetic-usage-edge',bootId:'usage-boot-2',sessionId:'usage-link-2'},old={...current,bootId:'usage-boot-1',sessionId:'usage-link-1'};
  await db.transaction(async sql=>{
    const row=(await sql.query<{state:Registry}>('SELECT state FROM arbi_device_registry WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 FOR UPDATE',[realm.environment,realm.namespaceId,siteId])).rows[0];
    if(!row||row.state.devices.length)throw Error('DEDICATED_EMPTY_FIXTURE_REQUIRED');
    row.state.devices.push({id:current.deviceId,componentId:'synthetic-usage-collector',role:'edge',status:'active',parentDeviceId:null,replacesDeviceId:null,enrolledAtMs:now,revokedAtMs:null,
      current,retiredIdentities:[old],lastSeenAtMs:now,softwareRevision:'isolated-fixture',appliedConfigRevision:'config-1',capabilities:[],credentials:[{
        id:'fixture-usage-key',publicKey:keys.publicKey.export({format:'der',type:'spki'}).toString('base64url'),createdAtMs:now-1000,expiresAtMs:now+86400000,revokedAtMs:null,lastSequence:0}]});
    await sql.query('UPDATE arbi_device_registry SET state=$4::jsonb WHERE environment=$1 AND namespace_id=$2 AND site_id=$3',[realm.environment,realm.namespaceId,siteId,JSON.stringify(row.state)]);
  });
  const month=new Date(now);month.setUTCDate(1);month.setUTCHours(0,0,0,0);const start=Math.min(month.getTime(),now-8*86400000),reset=now-4*86400000;
  const store=new UsageStore(new PostgresJobStore(db,realm,async()=>null));
  const base=(id:string,bytes:string|null,layer:UsageObservation['layer']='interface-wan',direction:UsageObservation['direction']='upload'):UsageObservation=>({
    version:'arbi-accounting/1.0',kind:'usage',observationId:id,realm,siteId,executionMode:'simulation',source:current,counterEpoch:'counter-reset-2',boundary:'garden-sim',layer,direction,
    linkId:'sim-1',scope:'boundary-total',attributionRevision:null,deviceId:null,category:null,interval:{start:new Date(start).toISOString(),end:new Date(now).toISOString()},bytes,media:null,
    evidence:{quality:bytes===null?'unavailable':layer==='application-payload'?'estimated':'measured',coverage:bytes===null?'unknown':'complete',includes:bytes===null?[]:layer==='application-payload'?['payload']:['payload','retries','transport-overhead','non-arbi'],
      observedAt:bytes===null?null:new Date(now).toISOString(),maxAgeMs:3600000,reason:bytes===null?'not-reported':null}});
  const before=base('fixture-wan-before-reset','3000');before.source=old;before.counterEpoch='counter-reset-1';before.interval.end=new Date(reset).toISOString();before.evidence.observedAt=before.interval.end;
  const after=base('fixture-wan-after-reset','4500');after.interval.start=new Date(reset).toISOString();
  const rows=[before,after,base('fixture-wan-download',null,'interface-wan','download'),base('fixture-app-upload','4500','application-payload'),base('fixture-app-download','500','application-payload','download'),
    base('fixture-provider-upload','9000','provider'),base('fixture-provider-download',null,'provider','download')];
  for(const [category,bytes] of [['telemetry','1000'],['live-video','1500'],['ota','1200'],['logs-audit','300']] as const){
    const observation=base(`fixture-category-${category}`,bytes,'application-payload');observation.scope='attributed';observation.attributionRevision='fixture-classifier-1';observation.deviceId=current.deviceId;observation.category=category;
    if(category==='live-video')observation.media={topology:'shared',sessionId:'fixture-shared-view',viewerId:null,viewerCount:5};rows.push(observation);
  }
  const issuedAtMs=Date.now(),unsigned={version:USAGE_VERSION,realm,siteId,deviceId:current.deviceId,credentialId:'fixture-usage-key',identity:current,issuedAtMs,expiresAtMs:issuedAtMs+10000,
    action:'ingest',payload:rows.map(observation=>({sequence:'1',observation}))};
  await store.ingest(siteId,{...unsigned,signature:sign(null,proofBytes(unsigned),keys.privateKey).toString('base64url')});
  const fixtures=JSON.parse(await readFile(new URL('../../../../packages/arbi-protocol/fixtures/audit-events.json',import.meta.url),'utf8')).valid;
  const audit=new PostgresAuditStore(db,'fixture-history-ingest'),binding=(e:AuditEvent):TrustedBinding=>({realm:e.realm,siteId:e.siteId,executionMode:e.executionMode,authenticatedSource:e.source,
    actor:e.actor,resource:e.resource,action:e.action,evidence:e.evidence,links:e.links,record:e.record,metadata:e.metadata,change:e.change});
  const request:AuditEvent=structuredClone(fixtures['capture-intent']);request.realm=realm;request.siteId=siteId;request.eventId='fixture-live-intent';request.sequence='1';request.actor={kind:'human',id:'synthetic-engineer'};
  request.resource={kind:'live-session',id:'fixture-live-session',deviceId:null};request.action='live.grant';request.metadata={permission:'view'};request.links={...request.links,correlationId:'fixture-shared-view',intentEventId:request.eventId,
    causationEventId:null,jobId:null,sessionId:'fixture-shared-view',commandId:null,requestSource:null,target:null};request.sourceTime={utc:null,uncertaintyMs:null,monotonicMs:1000};
  const allow:AuditEvent={...structuredClone(request),eventId:'fixture-live-allow',sequence:'2',evidence:'authorization',outcome:'allow',reason:'authorized',links:{...request.links,causationEventId:request.eventId}};
  await audit.admit(request,allow,binding(request),binding(allow));
  for(const [index,name] of ['grant','media-established','media-delivery'].entries()){
    const e:AuditEvent=structuredClone(fixtures[name]);e.realm=realm;e.siteId=siteId;e.actor=request.actor;e.resource=request.resource;e.eventId=`fixture-${name}`;e.links={...request.links,causationEventId:allow.eventId};e.sequence=name==='grant'?'3':'1';
    e.sourceTime={utc:null,uncertaintyMs:null,monotonicMs:1000+index};await db.transaction(sql=>audit.stage(sql,e,binding(e)));
  }
  const ended:AuditEvent=structuredClone(fixtures['media-lost']);ended.realm=realm;ended.siteId=siteId;ended.actor=request.actor;ended.resource=request.resource;
  ended.eventId='fixture-observed-end';ended.sequence='2';ended.sourceTime={utc:null,uncertaintyMs:null,monotonicMs:1003};ended.links={...request.links,causationEventId:'fixture-media-established'};
  await db.transaction(sql=>audit.stage(sql,ended,binding(ended)));
  const expired:AuditEvent={...structuredClone(request),eventId:'fixture-policy-end',sequence:'4',action:'live.end',evidence:'service-outcome',outcome:'succeeded',reason:'timeout',links:{...request.links,causationEventId:'fixture-grant'},metadata:{}};
  await db.transaction(sql=>audit.stage(sql,expired,binding(expired)));
  // Fixture outbox notifications are locally complete; no external provider or media transport is called.
  await db.transaction(async sql=>{await sql.query('INSERT INTO arbi_audit_deliveries(id) VALUES($1)',[request.eventId]);});
  return {observationIds:rows.map(r=>r.observationId),sessionId:'fixture-shared-view'};
}
