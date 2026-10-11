import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EdgeUpdatePreflight } from './edge-preflight.js';
import { createLinuxUpdateReference } from './linux-reference.js';
import { createJobReference } from '../jobs/reference.js';
import { captureStageFixture } from '../images/stage-fixture.js';
import { CaptureStage } from '../images/stage.js';
import { ImageProcessor } from '../images/processor.js';
import { CaptureUploader } from '../images/upload.js';
import { CapturePreview } from '../images/preview.js';
import { CaptureWorkflow } from '../images/workflow.js';
import type { UpdateOrchestrator } from './orchestrator.js';
type View=ReturnType<UpdateOrchestrator['view']>;
async function fixture(t:test.TestContext,media=false){
  const f=await createLinuxUpdateReference(),r=f.r,start=r.now();let guard:EdgeUpdatePreflight|undefined;
  t.after(async()=>{if(!guard)await f.close();});
  const jobs=createJobReference(join(f.root,'jobs'),{scope:{realm:r.realm,siteId:r.siteId,receiver:r.identity},consumer:{admissionInhibit:()=>guard?.admissionInhibit()??null},manual:{deadmanMs:1000,maxJogMs:100,maxLeaseMs:15000,admissionInhibit:()=>guard?.admissionInhibit()??null}});
  let workflow:CaptureWorkflow|undefined,closeMedia:()=>void=()=>{},cameraOwners=0,stuck=false,releaseDrain:()=>void=()=>{};
  const drainGate=new Promise<void>(resolve=>{releaseDrain=resolve;});
  if(media){const c=captureStageFixture(false,{realm:r.realm,siteId:r.siteId}),root=mkdtempSync(join(tmpdir(),'arbi-capture-stage-'));
    const stage=new CaptureStage({root,realm:r.realm,siteId:r.siteId}),processor=new ImageProcessor();
    const uploader=new CaptureUploader({stage,budget:r.budget,authorized:()=>true,nowUtcMs:r.now,higherPriorityPending:()=>false,timeoutMs:2000,port:{inspect:async()=>{if(stuck)await drainGate;return null;},upload:async()=>{throw Error('isolated-offline');}}});
    const preview=new CapturePreview({budget:r.budget,nowUtcMs:r.now,authorized:()=>true,acquireCamera:()=>{cameraOwners++;return ()=>{cameraOwners--;};},frame:async()=>c.bytes,append:()=>{}});
    workflow=new CaptureWorkflow({jobs:jobs.consumer,receiver:c.receiver,stage,processor,uploader,budget:r.budget,preview,calibration:()=>null,nowUtcMs:r.now,priority:'raw-first'});
    closeMedia=()=>{stage.close();processor.close();c.receiver.close();rmSync(c.root,{recursive:true,force:true});rmSync(root,{recursive:true,force:true});};
  }
  const options={path:join(f.root,'local-update-lock.sqlite'),orchestrator:()=>r.orchestrator,authority:()=>jobs.authority,jobs:jobs.consumer,manual:jobs.manual!,capture:workflow,drainTimeoutMs:50};
  guard=new EdgeUpdatePreflight(options);r.orchestrator.options.local=guard;
  function fresh(){const now=r.now()-start+1000;jobs.authority.gate.nowMonotonicMs=now;for(const c of Object.values(jobs.authority.conditions)){c.sampledAtMs=now;c.validUntilMs=now+1000;}}
  const request=async(key='isolated-local-update',afterFresh?:()=>void)=>{fresh();afterFresh?.();const response=await r.request('request',{key,releaseSetId:r.set.releaseSetId,targets:['pico','pod','edge'],allowMetered:true});assert.equal(response.status,202);return await response.json() as View;};
  const advance=async(id:string)=>{fresh();const response=await r.request('advance',{operationId:id});return {status:response.status,view:await response.json() as View};};
  const run=async(id:string)=>{for(let i=0;i<24;i++){const result=await advance(id);if(result.status>=500||['healthy','rolled-back','blocked','recovery-required'].includes(result.view.state))return result;}assert.fail('bounded operation did not settle');};
  t.after(async()=>{releaseDrain();await workflow?.stopAndDrain();try{guard?.close();}catch{}closeMedia();jobs.close();await f.close();});
  return {f,r,jobs,workflow,request,advance,run,fresh,get guard(){return guard!;},get cameraOwners(){return cameraOwners;},stuck(value:boolean){stuck=value;},releaseDrain,
    reopen(){guard!.close();guard=new EdgeUpdatePreflight(options);r.orchestrator.options.local=guard;},
    restartOwner(){r.restart();r.orchestrator.options.local=guard;}};
}
test('real local states reject requests durably before download or installation',async t=>{
  const cases=['motion','manual','maintenance','dock','unknown','stale','stale-time','power','pod-loss','mcu-loss','config','parked','restraint','line-clearance','procedure'] as const;
  for(const scenario of cases)await t.test(scenario,async sub=>{const f=await fixture(sub),a=f.jobs.authority;let reason='';
    switch(scenario){
      case 'motion':a.stationary=false;reason='ACTIVE_MOTION';break;
      case 'manual':f.jobs.manual!.acquire();reason='MANUAL_CONTROL_ACTIVE';break;
      case 'maintenance':a.state='Maintenance';reason='MAINTENANCE_CONFLICT';break;
      case 'dock':a.conditions.dock.value='unknown';reason='DOCK_STATE_AMBIGUOUS';break;
      case 'unknown':a.conditions.lines.value='unknown';reason='LOCAL_CONDITIONS_UNKNOWN';break;
      case 'stale-time':reason='LOCAL_CONDITIONS_UNKNOWN';break;
      case 'stale':a.conditions.reference.configurationDigest='0'.repeat(64);reason='LOCAL_CONDITIONS_UNKNOWN';break;
      case 'power':a.conditions.power.value='deny';reason='LOCAL_CONDITIONS_UNKNOWN';break;
      case 'pod-loss':a.modules.pod.generation=0;reason='MODULE_RECONCILIATION_REQUIRED';break;
      case 'mcu-loss':a.modules.motion.generation=0;reason='MODULE_RECONCILIATION_REQUIRED';break;
      case 'config':a.gate.configRevision='unknown';reason='LOCAL_CONFIG_MISMATCH';break;
      case 'parked':a.state='Parked';f.r.safety({mode:'parked'});reason='UPDATE_SAFE_MODE_REQUIRED';break;
      case 'restraint':f.r.safety({retentionValidated:false});reason='RETENTION_NOT_VALIDATED';break;
      case 'line-clearance':f.r.safety({lineClearanceValidated:false});reason='LINE_CLEARANCE_NOT_VALIDATED';break;
      case 'procedure':f.r.safety({targetProcedureValidated:false});reason='TARGET_PROCEDURE_NOT_VALIDATED';break;
    }
    const view=await f.request('isolated-local-update',()=>{if(scenario==='stale-time'){a.gate.nowMonotonicMs=5000;a.conditions.reference.sampledAtMs=0;a.conditions.reference.validUntilMs=6000;for(const [name,c] of Object.entries(a.conditions))if(name!=='reference'){c.sampledAtMs=5000;c.validUntilMs=6000;}}});assert.equal(view.state,'blocked');assert.equal(view.reason,reason);assert.equal(f.r.store.get(view.operationId).reason,reason);assert.equal(f.r.requests.length,0);assert.equal(f.f.native.get('pod')!.status.installations,0);assert.equal(f.r.store.audit().some(e=>e.reason==='local-inhibit'&&e.links.correlationId===view.operationId),true);f.restartOwner();assert.equal(f.r.store.get(view.operationId).reason,reason);
  });
});
test('actual preview and native capture drain before one ordered group; reviewed completion leaves jobs/leases inhibited',async t=>{
  const f=await fixture(t,true),w=f.workflow!;assert.equal((await w.mediaStep()).state,'staged');
  w.options.preview!.start({id:'isolated-preview',generation:1,actor:f.r.actor,source:f.r.identity,expiresUtcMs:f.r.now()+15000,bitrate:65536,expectedBytes:10000});assert.equal(f.cameraOwners,1);await w.options.preview!.frame(new AbortController().signal);
  const requested=await f.request(),result=await f.run(requested.operationId);assert.equal(result.view.state,'healthy');assert.equal(f.cameraOwners,0);assert.equal(w.status.closed,true);assert.equal(w.status.busy,false);assert.equal(w.status.images.retained,1);assert.equal(w.status.images.uploaded,0);assert.equal(f.guard.status.lock?.phase,'ready');assert.equal(f.jobs.adapter.dispatches.length,0);assert.equal(f.jobs.manual!.status.active,null);
  assert.throws(()=>f.jobs.manual!.acquire());assert.throws(()=>f.jobs.consumer.authorizeRecovery(),/FAULT_INHIBITED/);
  const command=structuredClone(f.jobs.command);command.command.commandId='after-update';command.command.idempotencyKey='after-update-key';assert.equal(f.jobs.consumer.receive(command).error,'FAULT_INHIBITED');
  f.reopen();assert.equal(f.guard.admissionInhibit(),'FAULT_INHIBITED');f.fresh();assert.equal(f.guard.reconcile(requested.operationId,'isolated-reviewed-reconciliation').lock,null);assert.equal(f.jobs.consumer.status.recoveryRequired,true);assert.equal(f.jobs.consumer.status.degraded,true);assert.equal(f.jobs.manual!.status.active,null);assert.throws(()=>f.jobs.manual!.acquire(),/LEASE_STALE/);assert.throws(()=>f.jobs.consumer.authorizeRecovery());assert.equal(f.f.native.get('pod')!.status.installations,1);assert.equal(f.f.native.get('edge')!.status.installations,1);f.f.preserve();
});
test('active native job is rejected, and a bounded drain timeout retains lock without installation or automatic late resume',async t=>{
  const f=await fixture(t,true),w=f.workflow!;const job=f.jobs.consumer.receive(f.jobs.command);assert.equal(job.outcome,'accepted');const blocked=await f.request();assert.equal(blocked.reason,'LOCAL_JOB_ACTIVE');f.jobs.consumer.localSafetyStop();
  // A separate fresh composition is needed after local job inhibition.
  const g=await fixture(t,true),v=g.workflow!;await v.mediaStep();g.stuck(true);const pending=v.mediaStep();await new Promise<void>(resolve=>setImmediate(resolve));
  const requested=await g.request(),began=performance.now(),result=await g.run(requested.operationId);assert.equal(result.view.reason,'UPDATE_DRAIN_UNCONFIRMED');assert.ok(performance.now()-began<1500);assert.equal(g.guard.status.lock?.phase,'draining');assert.equal(g.r.targets.get('pico')!.status.installations,0);assert.throws(()=>g.guard.reconcile(requested.operationId,'premature-review'),/UPDATE_NOT_TERMINAL/);
  g.releaseDrain();await pending;await new Promise<void>(resolve=>setImmediate(resolve));assert.equal(g.guard.status.lock?.phase,'draining');g.reopen();assert.equal((await g.advance(requested.operationId)).view.reason,'UPDATE_DRAIN_REVIEW_REQUIRED');g.fresh();assert.equal(await g.guard.resumeDrain(requested.operationId,'pico','isolated-drain-review'),null);assert.equal((await g.run(requested.operationId)).view.state,'healthy');assert.equal(w.status.closed,false);
});
test('lost installation acknowledgement keeps inhibition and reconciles native target without resending',async t=>{
  const f=await fixture(t);f.f.faults.set('pod','confirmed');const requested=await f.request(),result=await f.run(requested.operationId);assert.equal(result.status,503);assert.equal(f.f.native.get('pod')!.status.installations,1);assert.equal(f.guard.admissionInhibit(),'FAULT_INHIBITED');f.f.faults.set('pod',null);f.restartOwner();f.reopen();assert.equal((await f.run(requested.operationId)).view.state,'healthy');assert.equal(f.f.native.get('pod')!.status.installations,1);
});
test('current module epoch change and unavailable lock storage inhibit even after a healthy update',async t=>{
  const f=await fixture(t),requested=await f.request();assert.equal((await f.run(requested.operationId)).view.state,'healthy');f.jobs.authority.modules.pod.generation++;f.fresh();assert.equal(f.guard.check(requested.operationId,'pod'),'POST_UPDATE_RECONCILIATION_REQUIRED');assert.throws(()=>f.guard.reviewLocalRecovery(requested.operationId,'old-review'),/LOCAL_RECONCILIATION_REQUIRED/);f.jobs.authority.reconciliation!.modules=structuredClone(f.jobs.authority.modules);f.jobs.authority.reconciliation!.atMs=f.jobs.authority.gate.nowMonotonicMs;f.guard.reviewLocalRecovery(requested.operationId,'fresh-local-review');assert.equal(f.guard.check(requested.operationId,'pod'),null);assert.equal(f.guard.admissionInhibit(),'FAULT_INHIBITED');f.guard.close();assert.equal(f.guard.admissionInhibit(),'FAULT_INHIBITED');assert.equal(f.guard.status.available,false);f.reopen();
});

test('native job journal unavailability and loss of private Internet source retain inhibition without installation',async t=>{
  const f=await fixture(t),requested=await f.request();f.jobs.journal.close();assert.equal((await f.advance(requested.operationId)).view.reason,'LOCAL_JOB_RECOVERY_REQUIRED');assert.equal(f.r.targets.get('pico')!.status.installations,0);
  const g=await fixture(t),next=await g.request();g.r.sourceMode('unavailable');const blocked=await g.advance(next.operationId);assert.equal(blocked.view.state,'paused');assert.equal(g.guard.admissionInhibit(),'FAULT_INHIBITED');assert.equal(g.r.targets.get('pico')!.status.installations,0);g.r.sourceMode('complete');assert.equal((await g.run(next.operationId)).view.state,'healthy');assert.equal(g.jobs.adapter.dispatches.length,0);
});
