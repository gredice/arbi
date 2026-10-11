import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync,rmSync,readFileSync,readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { canonical,missingRanges } from '@arbi/audit';
import { correlateAuditEvent,recoverUpdate } from '@arbi/protocol';
import { TransferBudget } from '../transfers/budget.js';
import { UpdateOrchestrator as Orchestrator } from './orchestrator.js';
import { createUpdateReference } from './reference.js';
import type { UpdateOrchestrator } from './orchestrator.js';
import type { LocalUpdateSafety } from './safety.js';
type View=ReturnType<UpdateOrchestrator['view']>;
type Fixture=Awaited<ReturnType<typeof createUpdateReference>>;
async function fixture(t:test.TestContext,options:Parameters<typeof createUpdateReference>[1]={}){const dir=mkdtempSync(join(tmpdir(),'arbi-update-operations-'));const f=await createUpdateReference(dir,options);t.after(async()=>{await f.close();rmSync(dir,{recursive:true,force:true});});return Object.assign(f,{dir});}
const choice=(f:Fixture,key='synthetic-operation',targets=['pico','pod','edge'])=>({key,releaseSetId:f.set.releaseSetId,targets,allowMetered:true});
async function admit(f:Fixture,input=choice(f)){const r=await f.request('request',input);assert.equal(r.status,202,JSON.stringify(await r.clone().json()));return await r.json() as View;}
async function step(f:Fixture,id:string){const r=await f.request('advance',{operationId:id});assert.equal(r.status,200,JSON.stringify(await r.clone().json()));return await r.json() as View;}
async function finish(f:Fixture,id:string,max=24){let v:View|undefined;for(let i=0;i<max;i++){v=await step(f,id);if(['healthy','rolled-back','recovery-required','blocked','failed'].includes(v.state))return v;}assert.fail('bounded flow did not finish');}
test('actual SDK/HTTP/SQLite path serializes coordinator-last installation, retains identity, and survives reconnect without duplicate dispatch',async t=>{
  const f=await fixture(t),body=choice(f);const requests=await Promise.all([f.request('request',body),f.request('request',body)]);assert.deepEqual(requests.map(r=>r.status),[202,202]);const a=await requests[0]!.json() as View,b=await requests[1]!.json() as View;assert.equal(a.operationId,b.operationId);assert.equal(f.store.list().length,1);
  const downloading=await step(f,a.operationId);assert.equal(downloading.targets[0]!.status.installed.releaseId,'pico-1.0.0');assert.equal(downloading.targets[0]!.transfer?.offset,65536);
  f.restart();const recovered=await f.request('status',undefined,undefined,`?operationId=${a.operationId}`);assert.equal(recovered.status,200);assert.equal((await recovered.json() as View).targets[0]!.transfer?.offset,65536);
  const done=await finish(f,a.operationId);assert.equal(done.state,'healthy');assert.deepEqual([...f.targets.values()].map(x=>x.status.installations),[1,1,1]);
  await step(f,a.operationId);assert.deepEqual([...f.targets.values()].map(x=>x.status.installations),[1,1,1]);
  assert.equal(done.sessionId,f.credential.sessionId);assert.equal(done.physicalInstallationEnabled,false);assert.equal(f.dataStores.get('edge')!.status.active.dataVersion,'1.1.0');
  const audit=f.store.audit(),boots=audit.filter(e=>e.evidence==='device-outcome');assert.deepEqual(boots.map(e=>e.resource.deviceId),['pico','pod','edge']);
  for(const event of audit.filter(e=>e.evidence==='update-observation'||e.evidence==='device-outcome')){const root=audit.find(e=>e.eventId===event.links.intentEventId)!;assert.equal(correlateAuditEvent(root,event).ok,true);assert.equal(event.links.sessionId,f.credential.sessionId);assert.deepEqual(event.actor,f.actor);}
  const streams=new Map<string,string[]>();for(const e of audit){const key=canonical(e.source);const values=streams.get(key)??[];values.push(e.sequence);streams.set(key,values);}for(const sequence of streams.values())assert.deepEqual(missingRanges(sequence),[]);
  const usage=done.targets.flatMap(t=>t.usageCharges).reduce((n,c)=>n+c.bytes,0);assert.equal(usage,210000);assert.equal(audit.filter(e=>e.metadata.byteCount).reduce((n,e)=>n+e.metadata.byteCount!,0),usage);
  const duplicate=await admit(f,body);assert.equal(duplicate.operationId,a.operationId);assert.equal((await f.request('request',{...body,allowMetered:false})).status,409);
});
test('a real socket interruption resumes the observed durable prefix and reconciles every response-body byte',async t=>{
  const f=await fixture(t);f.sourceMode('interrupt-once');const a=await admit(f,choice(f,'socket-drop',['pico']));const partial=await step(f,a.operationId);assert.equal(partial.targets[0]!.transfer?.offset,4096);assert.equal(partial.targets[0]!.receipts[0]!.reason,'interrupted-range');assert.equal(partial.targets[0]!.receipts[0]!.prefixIntegrity,'pending-whole-artifact-verification');
  const done=await finish(f,a.operationId);assert.equal(done.state,'healthy');assert.deepEqual(f.requests.map(r=>r.offset),[0,4096,69632]);assert.equal(f.requests.reduce((n,r)=>n+r.sentPayloadBytes,0),70000);assert.equal(done.targets[0]!.usageCharges.reduce((n,c)=>n+c.bytes,0),70000);assert.deepEqual(done.targets[0]!.receiptCoverage.missingChargeIds,[]);
});
test('discarded/retried bytes exhaust quota; explicit current dual-role override resumes without bypassing safety',async t=>{
  const f=await fixture(t,{allowanceBytes:70000});f.sourceMode('reject-once');const a=await admit(f,choice(f,'budget-retry',['pico']));const first=await step(f,a.operationId);assert.equal(first.targets[0]!.transfer?.offset,0);assert.equal(first.targets[0]!.usageCharges[0]!.bytes,8192);assert.equal(first.targets[0]!.receipts[0]!.acceptedPrefixBytes,0);
  const paused=await step(f,a.operationId);assert.equal(paused.reason,'QUOTA_EXHAUSTED');assert.equal(paused.state,'paused');assert.equal(f.targets.get('pico')!.status.installations,0);assert.equal(f.requests.length,1);
  f.roles(f.actor.id,['update-admin']);const denied=await f.request('override',{operationId:a.operationId,bytes:16384});assert.equal(denied.status,403);assert.equal(f.budget.pendingAudit().length,0);
  f.roles(f.actor.id,['update-admin','engineer']);assert.equal((await f.request('override',{operationId:a.operationId,bytes:16384})).status,200);
  f.safety({localInterlock:false});const blocked=await finish(f,a.operationId);assert.equal(blocked.reason,'LOCAL_INTERLOCK_REQUIRED');assert.equal(f.targets.get('pico')!.status.installations,0);
  f.safety({localInterlock:true});const done=await finish(f,a.operationId);assert.equal(done.state,'healthy');assert.equal(done.targets[0]!.usageCharges.reduce((n,c)=>n+c.bytes,0),78192);assert.deepEqual(f.requests.map(r=>r.offset),[0,0,65536]);
  assert.equal(f.store.audit().filter(e=>e.metadata.configRevision&&e.links.correlationId===a.operationId).length,1);
});
test('each local loaded-system precondition blocks activation; public ordering/safety fields cannot grant authority',async t=>{
  const f=await fixture(t,{payloadBytes:256});assert.equal((await f.request('request',choice(f,'wrong-order',['edge','pico']))).status,409);assert.equal((await f.request('request',{...choice(f),updateSafe:true})).status,400);
  const a=await admit(f,choice(f,'safety',['pico']));const cases:[Partial<LocalUpdateSafety>,string][]=[
    [{activeMotion:true},'ACTIVE_MOTION'],[{manualControl:true},'MANUAL_CONTROL_ACTIVE'],[{maintenanceConflict:true},'MAINTENANCE_CONFLICT'],[{mode:'parked'},'UPDATE_SAFE_MODE_REQUIRED'],[{retentionValidated:false},'RETENTION_NOT_VALIDATED'],[{lineClearanceValidated:false},'LINE_CLEARANCE_NOT_VALIDATED'],[{stablePower:false},'POWER_NOT_STABLE'],[{localInterlock:false},'LOCAL_INTERLOCK_REQUIRED'],[{targetProcedureValidated:false},'TARGET_PROCEDURE_NOT_VALIDATED'],[{independentProtectionOwnerId:'pico'},'INDEPENDENT_PROTECTION_REQUIRED']];
  for(const [flags,reason] of cases){f.safety(flags);const view=await step(f,a.operationId);assert.equal(view.reason,reason);assert.equal(f.targets.get('pico')!.status.installations,0);f.safety({activeMotion:false,manualControl:false,maintenanceConflict:false,mode:'update-safe',retentionValidated:true,lineClearanceValidated:true,stablePower:true,localInterlock:true,targetProcedureValidated:true,independentProtectionOwnerId:'synthetic-independent-retention'});}
  assert.equal((await step(f,a.operationId)).state,'healthy');
});
test('authorization is rechecked after real download and before activation; engineers/viewers cannot request updates',async t=>{
  const f=await fixture(t,{payloadBytes:256});for(const id of ['synthetic-viewer','synthetic-engineer']){const credential=await f.provider.issue({kind:'human',id});assert.equal((await f.request('request',choice(f),credential.token)).status,403);}assert.equal(f.store.list().length,0);assert.equal(f.requests.length,0);
  const a=await admit(f,choice(f,'revocation',['pico']));f.onRange(()=>f.provider.revoke(f.credential.sessionId));assert.equal((await f.request('advance',{operationId:a.operationId})).status,401);assert.equal(f.targets.get('pico')!.status.installations,0);assert.equal(f.store.get(a.operationId).reason,'CURRENT_APPROVAL_REQUIRED');assert.equal(f.store.audit().some(e=>e.actor.id===f.actor.id&&e.outcome==='deny'),true);
});
test('lost acknowledgement at reservation never resends; lost slot acknowledgement recovers one actual simulated boot',async t=>{
  let interrupted=true;const f=await fixture(t,{payloadBytes:256,afterReservation:()=>{if(interrupted){interrupted=false;throw Error('synthetic reservation reply lost');}}});const a=await admit(f,choice(f,'reservation-lost',['pico']));assert.equal((await f.request('advance',{operationId:a.operationId})).status,503);assert.equal(f.targets.get('pico')!.status.installations,0);assert.equal(f.store.get(a.operationId).state,'recovery-required');assert.equal(f.store.get(a.operationId).reason,'INSTALLATION_RESULT_UNAVAILABLE');assert.equal(f.store.audit().some(e=>e.evidence==='authorization'&&e.outcome==='deny'),false);const j=f.store.get(a.operationId).targets[0]!.journal;const state=recoverUpdate(j);assert.ok(state.ok);assert.equal(state.value.status.installationReserved,true);
  f.restart();const unknown=await step(f,a.operationId);assert.equal(unknown.reason,'RESERVED_INSTALLATION_UNOBSERVED_NO_RESEND');assert.equal(f.targets.get('pico')!.status.installations,0);assert.equal((await f.request('request',choice(f,'unsafe-second',['pico']))).status,409);
  const g=await fixture(t,{payloadBytes:256});g.slotFault('pico','after-commit');const b=await admit(g,choice(g,'slot-reply-lost',['pico']));assert.equal((await g.request('advance',{operationId:b.operationId})).status,503);assert.equal(g.targets.get('pico')!.status.installations,1);g.slotFault('pico',null);g.restart();assert.equal((await step(g,b.operationId)).state,'healthy');assert.equal(g.targets.get('pico')!.status.installations,1);
});
test('failed canary halts the group and observes rollback; a raised floor preserves the target and requires compatible recovery',async t=>{
  const f=await fixture(t,{payloadBytes:256});f.health('pico','failed');const a=await admit(f);const restored=await finish(f,a.operationId);assert.equal(restored.state,'rolled-back');assert.equal(f.targets.get('pico')!.status.rollbacks,1);assert.equal(f.targets.get('pod')!.status.installations,0);assert.equal(f.targets.get('edge')!.status.installations,0);const outcome=f.store.audit().find(e=>e.action==='update.rollback')!;assert.equal(outcome.effect,'device-reported');assert.equal(outcome.metadata.recoveryPolicy,'update-recovery/1');
  const g=await fixture(t,{payloadBytes:256});g.health('pico','unknown');const b=await admit(g,choice(g,'floor',['pico']));assert.equal((await step(g,b.operationId)).reason,'TARGET_HEALTH_PENDING');g.raiseFloor('pico');g.health('pico','failed');const blocked=await step(g,b.operationId);assert.equal(blocked.state,'recovery-required');assert.equal(blocked.reason,'SECURITY_DOWNGRADE_BLOCKED');assert.equal(g.targets.get('pico')!.status.installations,1);assert.equal(g.targets.get('pico')!.status.rollbacks,0);
});
test('missing audit acknowledgement prevents admission; committed charges survive lost progress without invented receipt coverage',async t=>{
  const f=await fixture(t,{storeFault:'before-commit'});assert.equal((await f.request('request',choice(f))).status,503);assert.equal(f.store.list().length,0);assert.equal(f.requests.length,0);
  f.storeFault(null);const a=await admit(f,choice(f,'progress-loss',['pico']));f.onRange(()=>f.storeFault('before-commit'));assert.equal((await f.request('advance',{operationId:a.operationId})).status,503);assert.equal(f.targets.get('pico')!.status.installations,0);f.storeFault(null);f.onRange(null);const durable=f.orchestrator.view(a.operationId);assert.equal(durable.targets[0]!.usageCharges[0]!.bytes,65536);assert.equal(durable.targets[0]!.receiptCoverage.missingChargeIds.length,1);assert.equal((await finish(f,a.operationId)).state,'healthy');
});
test('metered consent, original deadlines, and serialized concurrent advances remain durable and secret-free',async t=>{
  const f=await fixture(t,{payloadBytes:256});const a=await admit(f,{...choice(f,'no-metered',['pico']),allowMetered:false});assert.equal((await step(f,a.operationId)).reason,'METERED_CONSENT_REQUIRED');assert.equal(f.requests.length,0);f.advanceClock(121000);assert.equal((await step(f,a.operationId)).state,'failed');assert.equal((await admit(f,{...choice(f,'no-metered',['pico']),allowMetered:false})).deadlineMs,a.deadlineMs);
  const g=await fixture(t,{payloadBytes:256});const b=await admit(g,choice(g,'concurrency',['pico']));const responses=await Promise.all([g.request('advance',{operationId:b.operationId}),g.request('advance',{operationId:b.operationId})]);assert.ok(responses.some(r=>r.status===409));assert.equal(g.targets.get('pico')!.status.installations,1);
  for(const file of readdirSync(g.dir).filter(f=>f.endsWith('.sqlite'))){const contents=readFileSync(join(g.dir,file));assert.equal(contents.includes(Buffer.from(g.credential.token)),false);assert.equal(contents.includes(Buffer.from('PRIVATE KEY')),false);assert.equal(contents.includes(Buffer.from('http://127.0.0.1:')),false);}
});

test('audit pages retain one immutable snapshot while new authorization facts append, and operation admission fields cannot be rewritten',async t=>{
  const f=await fixture(t,{payloadBytes:256}),a=await admit(f,choice(f,'audit-pages',['pico']));await step(f,a.operationId);
  const first=await f.request('audit',undefined,undefined,'?limit=2');assert.equal(first.status,200);const page=await first.json() as {events:{eventId:string}[];through:number;nextAfter:number|null};assert.equal(page.events.length,2);const events=[...page.events];let cursor=page.nextAfter;
  while(cursor!==null){const response=await f.request('audit',undefined,undefined,`?limit=2&after=${cursor}&through=${page.through}`);assert.equal(response.status,200);const next=await response.json() as typeof page;assert.equal(next.through,page.through);events.push(...next.events);cursor=next.nextAfter;}
  assert.equal(events.length,page.through);assert.equal(new Set(events.map(e=>e.eventId)).size,page.through);
  assert.throws(()=>f.store.update(a.operationId,op=>{op.deadlineMs--;return [];}),{code:'IDEMPOTENCY_CONFLICT'});
  assert.throws(()=>f.store.update(a.operationId,op=>{op.targets[0]!.journal.events=[];return [];}),{code:'IDEMPOTENCY_CONFLICT'});
});

test('update composition explicitly rejects a retry policy beyond its bounded receipt capacity and expired periods remain readable',async t=>{
  const f=await fixture(t,{payloadBytes:256});const extended=new TransferBudget({...f.budget.options,path:join(f.dir,'extended-budget.sqlite'),policy:{...f.budget.policy,maxAttempts:128}});try{
  assert.throws(()=>new Orchestrator({...f.composition,budget:extended}),{code:'UPDATE_RETRY_POLICY_LIMIT'});
  const c=extended.options.clock(),end=c.utcMs+1000;extended.checkpoint({period:'synthetic-day',startUtcMs:c.utcMs-1000,endUtcMs:end,revision:2,usedBytes:0,coverage:'complete',observedUtcMs:c.utcMs,maxAgeMs:10000,coveredCharges:[]});
  const grant=extended.override({id:'period-edge-override',class:'artifact',bytes:256,expiresUtcMs:end+10000,actor:f.actor});f.advanceClock(1001);assert.equal(extended.overrideStatus(grant.override.id)!.effectiveRemainingBytes,null);assert.equal(extended.status.coverage,'unknown');}finally{extended.close();}
});
test('dashboard projections preserve manifest provenance and corrupt payload policy without reporting installed success',async t=>{
  const f=await fixture(t,{payloadBytes:256});
  const manifest=f.composition.sets[0]!.manifests.find(m=>m.releaseId==='pico-1.1.0')!,signature=manifest.artifact.signature.value;
  manifest.artifact.signature.value='0'.repeat(128);
  const incompatible=await (await f.request('available')).json();assert.equal(incompatible.version,'arbi.update-view/1.0');assert.equal(incompatible.metered,true);
  assert.equal(incompatible.releases[0].reason,'INVALID_SIGNATURE');assert.equal((await f.request('request',choice(f,'bad-signature',['pico']))).status,409);assert.equal(f.store.list().length,0);
  manifest.artifact.signature.value=signature;const a=await admit(f,choice(f,'corrupt-payload',['pico']));f.sourceMode('corrupt-once');
  const corrupt=await step(f,a.operationId);assert.equal(corrupt.reason,'DIGEST_MISMATCH');assert.equal(corrupt.targets[0]!.usageCharges.reduce((sum,c)=>sum+c.bytes,0),256);
  assert.equal(corrupt.targets[0]!.status.installed.releaseId,'pico-1.0.0');assert.equal(corrupt.targets[0]!.status.confirmed.releaseId,'pico-1.0.0');assert.equal(f.targets.get('pico')!.status.installations,0);
  assert.equal(f.store.audit().some(e=>e.evidence==='device-outcome'),false);
  const view=await (await f.request('available')).json();assert.equal(view.releases[0].targets[0].manifest.build.commit,manifest.build.commit);assert.equal(view.operations[0].key,'corrupt-payload');assert.deepEqual(view.operations[0].actor,f.actor);
});
