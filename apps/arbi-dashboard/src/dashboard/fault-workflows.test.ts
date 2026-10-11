import assert from 'node:assert/strict';
import test from 'node:test';
import {randomBytes} from 'node:crypto';
import {realpathSync,mkdirSync,writeFileSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import pg from 'pg';
import {digest} from '@arbi/audit';
import type {AuditEvent} from '@arbi/protocol';
import {postgresDatabase} from '../enrollment/store';
import {fixture,realm} from '../jobs/test-support';
import {createJobsServer} from '../jobs/server';
import {createLiveServer} from '../live/server';
import {SimulatedLiveAdapter} from '../live/simulated-adapter';
import type {LivePolicy} from '../live/contracts';
import {recordingAuditHook} from '../media/recording-hooks';
import {setup} from '../media/test-support';
const seed=77,socket=process.env.ARBI_ENROLLMENT_TEST_SOCKET;
const projection=(events:AuditEvent[])=>{const aliases=new Map<string,number>();return events.map(e=>{if(!aliases.has(e.links.correlationId))aliases.set(e.links.correlationId,aliases.size+1);return {action:e.action,evidence:e.evidence,outcome:e.outcome,reason:e.reason,actor:e.actor.id,correlation:aliases.get(e.links.correlationId),intentEventIndex:e.links.intentEventId?events.findIndex(root=>root.eventId===e.links.intentEventId):null};});};
const trace=(id:string,expected:Record<string,unknown>,observed:Record<string,unknown>,events:unknown[])=>{const semantic={version:'arbi.fault-workflow/1.0',id,seed,expected,observed,trace:events,physicalAcceptance:false};return {...semantic,semanticDigest:digest(semantic)};};
test('seeded native services: allowed/rejected manipulation, concurrent viewers, policy stop and disabled recording have authoritative audit traces',{skip:!socket,timeout:15000},async t=>{
  const root=realpathSync(socket!);assert.ok(root.startsWith(`${realpathSync(tmpdir())}/arbi-enrollment-pg-`));const base={host:root,user:'arbi_test',port:54321,max:4};
  const admin=new pg.Pool({...base,database:'postgres',max:1});await admin.query('CREATE DATABASE arbi_fault_workflows');await admin.end();
  const pool=new pg.Pool({...base,database:'arbi_fault_workflows'});t.after(()=>pool.end());
  for(const file of ['0001-enrollment','0002-media','0003-audit','0004-jobs','0013-command-attempts','0011-live'])await pool.query(await readFile(new URL(`../../migrations/${file}.sql`,import.meta.url),'utf8'));
  const f=await fixture('synthetic-fault-workflows');await pool.query('INSERT INTO arbi_device_registry VALUES($1,$2,$3,$4::jsonb)',[realm.environment,realm.namespaceId,f.registry.siteId,JSON.stringify(f.registry)]);
  const options={db:postgresDatabase(pool),realm,identity:f.identity.adapter,resolveSite:f.identity.resolveResource,currentAuthority:f.currentAuthority,browserOrigins:['https://synthetic.test']};
  const jobs=createJobsServer(options),operator=await f.human('fault-operator'),viewer=await f.human('fault-viewer','live.view');
  f.identity.putPrincipal({actor:{kind:'human',id:viewer.context.actor.id},accountId:'account-1',member:true,sites:{[f.registry.siteId]:{roles:['viewer'],serviceScopes:[],active:true,revision:'viewer-only'}}});
  const req=(action:string,body:unknown,token=operator.token)=>new Request(`https://synthetic.test/${action}`,{method:'POST',headers:{authorization:`Bearer ${token}`,origin:'https://synthetic.test','x-arbi-request':'1','content-type':'application/json'},body:JSON.stringify(body)});
  await jobs.store.device(f.registry.siteId,f.upload('snapshot',f.snapshot()));const leaseResponse=await jobs.handle(req('acquire',{key:`lease-${seed}`,deviceId:'edge-1',ttlMs:4500}),{siteId:f.registry.siteId,action:'acquire'});assert.equal(leaseResponse.status,200);const lease=await leaseResponse.json();
  const body={key:`command-${seed}`,deviceId:'edge-1',leaseId:lease.id,fence:lease.fence,timeoutMs:1000,body:{type:'camera.gimbal',panDeg:0,tiltDeg:0,frame:{name:'pod-gimbal',revision:'frame-1'},maxDurationMs:500}};
  assert.equal((await jobs.handle(req('submit',body,viewer.token),{siteId:f.registry.siteId,action:'submit'})).status,403);
  const accepted=await jobs.handle(req('submit',body),{siteId:f.registry.siteId,action:'submit'});assert.equal(accepted.status,202);const job=await accepted.json();
  f.identity.revoke(operator.sessionId);assert.deepEqual(await jobs.store.device(f.registry.siteId,f.upload('poll',{})),{commands:[]});
  const pending=(await pool.query('SELECT record FROM arbi_command_jobs WHERE id=$1',[job.id])).rows[0].record;assert.equal(pending.cloudDisposition,'authority-lost');assert.equal(pending.terminal,null);
  const manipulation=(await pool.query('SELECT record FROM arbi_audit_events WHERE site_id=$1 ORDER BY ordinal',[f.registry.siteId])).rows.map(r=>r.record as AuditEvent);assert.ok(manipulation.some(e=>e.actor.id==='fault-viewer'&&e.outcome==='deny'));assert.ok(manipulation.some(e=>e.actor.id==='fault-operator'&&e.evidence==='intent'));
  let decision:LivePolicy={allow:true,reason:'within-budget',revision:'seeded-policy',layer:'application-payload',remainingBytes:'100000',maxUpstreamBps:200000};const adapter=new SimulatedLiveAdapter();t.after(()=>adapter.close());
  const live=createLiveServer({...options,adapter,tokenKey:randomBytes(32),profiles:[{id:'low',transport:'isolated-signaling',maxUpstreamBps:200000,maxDownstreamBps:400000,maxViewers:2},{id:'lower',transport:'isolated-signaling',maxUpstreamBps:100000,maxDownstreamBps:200000,maxViewers:2}],approveDevice:()=>true,evaluatePolicy:async()=>decision});
  const second=await f.human('fault-second-viewer','live.view');const sessions=[];
  for(const token of [viewer.token,second.token]){const r=await live.handle(req('start',{key:`view-${seed}`,deviceId:'edge-1',profileId:'low'},token),{siteId:f.registry.siteId,action:'start'});assert.equal(r.status,202);sessions.push(await r.json());}
  assert.notEqual(sessions[0].id,sessions[1].id);assert.equal(sessions[0].producerId,sessions[1].producerId);assert.equal(adapter.status.producers[0]!.viewers,2);
  const third=await f.human('fault-third-viewer','live.view');assert.equal((await live.handle(req('start',{key:'limit',deviceId:'edge-1',profileId:'low'},third.token),{siteId:f.registry.siteId,action:'start'})).status,429);
  decision={...decision,maxUpstreamBps:100000};
  for(let i=0;i<2;i++){const r=await live.handle(req('renew',{sessionId:sessions[i].id,token:sessions[i].token},i===0?viewer.token:second.token),{siteId:f.registry.siteId,action:'renew'});assert.equal(r.status,200);assert.equal((await r.json()).policy.reason,'profile-denied');}
  assert.equal(adapter.status.producers.length,0);const lowerResponse=await live.handle(req('start',{key:'explicit-lower',deviceId:'edge-1',profileId:'lower'},viewer.token),{siteId:f.registry.siteId,action:'start'});assert.equal(lowerResponse.status,202);const lower=await lowerResponse.json();assert.equal(lower.profile.maxUpstreamBps,100000);
  decision={...decision,allow:false,reason:'budget-exhausted',remainingBytes:'0'};
  const stop=await live.handle(req('renew',{sessionId:lower.id,token:lower.token},viewer.token),{siteId:f.registry.siteId,action:'renew'});assert.equal(stop.status,200);assert.equal((await stop.json()).policy.reason,'budget-exhausted');
  assert.equal(adapter.status.producers.length,0);assert.equal((await live.handle(req('start',{key:'exhausted',deviceId:'edge-1',profileId:'low'},viewer.token),{siteId:f.registry.siteId,action:'start'})).status,403);
  const recordingActor=await f.human('fault-recording','live.view'),recordings=[];for(const action of ['start','stop','failure','playback','export','delete']){let executed=false;const hook=recordingAuditHook(action);const response=await jobs.humans.run(req('recording',{},recordingActor.token),{siteId:f.registry.siteId,surface:'media',capability:hook.capability},async()=>{executed=true;return Response.json({});});assert.equal(response.status,403);assert.equal(executed,false);recordings.push({action,enabled:hook.enabled,status:response.status});}
  await jobs.store.audit.verify(realm,f.registry.siteId);
  const events=(await pool.query('SELECT record FROM arbi_audit_events WHERE site_id=$1 ORDER BY ordinal',[f.registry.siteId])).rows.map(r=>r.record as AuditEvent);const media=events.filter(e=>e.action.startsWith('live.'));assert.ok(events.some(e=>e.actor.id==='fault-recording'&&e.outcome==='deny'));
  assert.ok(media.some(e=>e.evidence==='access-grant'));assert.ok(media.some(e=>e.outcome==='deny'));assert.ok(!media.some(e=>e.evidence==='access-observation')); // Isolated signaling cannot manufacture video delivery.
  const traces=[trace('manipulation-revocation',{admission:'one-allowed-one-denied',replay:'none',bandwidth:'not-measured'},{jobs:1,disposition:pending.cloudDisposition,deviceOutcome:null},projection(manipulation)),trace('concurrent-viewing-exhaustion',{viewers:2,sharedProducer:1,policy:'profile-denied;explicit-lower;budget-exhausted',deliveryBytes:null},{viewers:2,producersAfterStop:0,deliveryBytes:null},projection(media)),trace('disabled-recording',{enabled:false},{enabled:false,operations:recordings.length},recordings)];
  assert.doesNotMatch(JSON.stringify(traces),/Bearer|arbi-live\+jwt|privateKey|credentialId|vercel-blob/);
  mkdirSync('fault-results',{recursive:true});writeFileSync('fault-results/native-workflows.json',JSON.stringify(traces,null,2)+'\n',{mode:0o600});t.diagnostic(JSON.stringify(traces));
});
test('seeded real media SDK upload retry reconciles actual application bytes and retains one verified image',async t=>{
  const h=await setup(t),input=h.upload(`seeded-upload-${seed}`),first=await h.call('upload',input);assert.equal(first.status,200);assert.equal((await h.complete(first.value)).value.error,'MISSING_OBJECT');
  assert.equal((await h.put(first.value.putUrl)).status,200);const retry=await h.call('upload',input);assert.equal(retry.value.imageId,first.value.imageId);assert.equal((await h.put(retry.value.putUrl)).status,409);
  assert.equal((await h.complete(first.value)).status,200);assert.equal((await h.complete(retry.value)).status,200);assert.equal((await h.db.query('SELECT * FROM arbi_media_images')).rows.length,1);
  assert.equal(h.blob.controls.putPayloadBytes,h.bytes.length*2);
  const rows=(await h.db.query<{record:AuditEvent;detail:{operation?:string;result?:string}}>("SELECT record,detail FROM arbi_media_audit ORDER BY (record->>'sequence')::numeric")).rows;const events=rows.map(r=>r.record);assert.ok(events.every(e=>e.actor.id==='operator'));assert.equal(rows.filter(r=>r.detail.operation==='upload.complete'&&r.detail.result==='verified-object').length,1);
  const report=trace('upload-lost-ack-retry',{images:1,layer:'application-payload',actualBytes:h.bytes.length*2},{images:1,objectBytes:h.bytes.length,actualBytes:h.blob.controls.putPayloadBytes,carrierBytes:null},projection(events));
  mkdirSync('fault-results',{recursive:true});writeFileSync('fault-results/media-workflow.json',JSON.stringify(report,null,2)+'\n',{mode:0o600});t.diagnostic(JSON.stringify(report));
});
