import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import type {TestContext} from 'node:test';
import {configurationDigest} from '@arbi/protocol';
import {CaptureStage} from './stage.js';
import {ImageProcessor} from './processor.js';
import {captureStageFixture,captureMarkerCalibration} from './stage-fixture.js';
import {CaptureUploader} from './upload.js';
import {CapturePreview,capturePreviewPolicy} from './preview.js';
import {TransferBudget} from '../transfers/budget.js';
import type {TransferPolicy} from '../transfers/budget.js';
import type {CaptureTrace,CaptureUploadReceipt} from '@arbi/protocol/capture-upload';
import {CaptureWorkflow} from './workflow.js';
import {createJobReference} from '../jobs/reference.js';
const policy:TransferPolicy={revision:'capture-policy-1',allowanceBytes:1048576,essentialBytes:65536,maxTransferBytes:1048576,bytesPerSecond:1048576,essentialBytesPerSecond:65536,concurrency:2,essentialConcurrency:1,unknownCoverage:'defer',maxAttempts:32,uploadWindows:[],stream:{maxBitrate:200000,maxDurationMs:15000,idleMs:1500}};
function rig(t:TestContext,p:{maxBytes?:number;fault?:(point:string)=>void;markers?:boolean}={}) {
  const {markers,...stagePolicy}=p,f=captureStageFixture(markers),root=mkdtempSync(join(tmpdir(),'arbi-capture-stage-')),processor=new ImageProcessor(),options={root,realm:f.manifest.realm,siteId:f.manifest.siteId,...stagePolicy};let stage=new CaptureStage(options),utc=Date.now(),epoch='budget-boot';
  const budgetRoot=mkdtempSync(join(tmpdir(),'arbi-capture-budget-')),budgetOptions={path:join(budgetRoot,'budget.sqlite'),realm:f.manifest.realm,siteId:f.manifest.siteId,source:f.source,policy,clock:()=>({epoch,utcMs:utc,monotonicMs:1000,reliable:true}),authorize:()=>true};let budget=new TransferBudget(budgetOptions);
  budget.checkpoint({period:'capture-test',startUtcMs:utc-1000,endUtcMs:utc+3600000,revision:1,usedBytes:0,coverage:'complete',observedUtcMs:utc,maxAgeMs:60000,coveredCharges:[]});
  t.after(()=>{stage.close();budget.close();processor.close();f.receiver.close();for(const d of [root,f.root,budgetRoot])rmSync(d,{recursive:true,force:true});});
  return {...f,root,processor,get stage(){return stage;},get budget(){return budget;},now:()=>utc,advance:(ms:number)=>{utc+=ms;},reopen:()=>{stage.close();budget.close();epoch='budget-boot-2';stage=new CaptureStage(options);budget=new TransferBudget(budgetOptions);}};
}
const receipt=(trace:CaptureTrace):CaptureUploadReceipt=>({artifactId:trace.artifact.id,imageId:'fixture-media-image',sha256:trace.artifact.sha256,bytes:trace.artifact.bytes,traceDigest:configurationDigest(trace),verified:true});
test('actual marker pixels preserve both raw and rectified files, quality/transform lineage and independent upload receipts after restart',async t=>{
  const f=rig(t,{markers:true}),row=await f.stage.stage(f.receiver,f.manifest.image.id,f.processor,captureMarkerCalibration(f.manifest),f.now());assert.equal(row.state,'retained');assert.equal(row.artifacts.length,2);const raw=row.artifacts[0],derived=row.artifacts[1];assert.equal(raw.trace.processing.state,'rectified');assert.equal(derived.trace.processing.derivative!.originalId,f.manifest.image.id);assert.equal(derived.trace.processing.derivative!.originalSha256,f.manifest.image.sha256);assert.deepEqual(f.stage.read(f.manifest.image.id,f.manifest.image.id),f.bytes);assert.equal(f.stage.read(f.manifest.image.id,derived.trace.artifact.id).length,derived.trace.artifact.bytes);
  f.stage.uploaded(f.manifest.image.id,receipt(derived.trace));f.reopen();const retained=f.stage.get(f.manifest.image.id)!;assert.equal(retained.artifacts[0].upload.state,'pending');assert.equal(retained.artifacts[1].upload.state,'uploaded');assert.deepEqual(retained.artifacts[1].trace,derived.trace);assert.equal(f.stage.read(f.manifest.image.id,derived.trace.artifact.id).length,derived.trace.artifact.bytes);
});
test('native staging preserves original metadata and independent unavailable-processing, restart and idempotent identity',async t=>{
  const f=rig(t),r=await f.stage.stage(f.receiver,f.manifest.image.id,f.processor,null,f.now());assert.equal(r.state,'retained');assert.equal(r.artifacts[0].trace.processing.state,'unavailable');assert.equal(r.artifacts[0].upload.state,'pending');assert.deepEqual(r.manifest,f.manifest);
  f.reopen();assert.equal(f.stage.get(f.manifest.image.id)!.state,'retained');assert.deepEqual(f.stage.read(f.manifest.image.id,f.manifest.image.id),f.bytes);assert.deepEqual(await f.stage.stage(f.receiver,f.manifest.image.id,f.processor,null,f.now()),r);
});
test('workflow stages owned captures, defers shared-budget exhaustion and recovers a lost cloud receipt at zero allowance without another job dispatch',async t=>{
  const f=rig(t),root=mkdtempSync(join(tmpdir(),'arbi-capture-jobs-')),jobs=createJobReference(root);t.after(()=>{jobs.close();rmSync(root,{recursive:true,force:true});});
  let remote:CaptureUploadReceipt|null=null,bytes=0;const uploader=new CaptureUploader({stage:f.stage,budget:f.budget,authorized:()=>true,nowUtcMs:f.now,higherPriorityPending:()=>false,port:{inspect:async()=>remote,upload:async(t,body)=>{for await(const part of body)bytes+=part.length;remote=receipt(t);throw new Error('lost-response');}}});
  const workflow=new CaptureWorkflow({jobs:jobs.consumer,receiver:f.receiver,stage:f.stage,processor:f.processor,uploader,budget:f.budget,calibration:()=>null,nowUtcMs:f.now,priority:'raw-first'});
  assert.equal((await workflow.mediaStep()).state,'staged');assert.equal((await workflow.mediaStep()).state,'deferred');f.budget.checkpoint({period:'capture-test',startUtcMs:f.now()-1000,endUtcMs:f.now()+3600000,revision:2,usedBytes:policy.allowanceBytes,coverage:'complete',observedUtcMs:f.now(),maxAgeMs:60000,coveredCharges:[]});assert.equal((await workflow.mediaStep()).state,'uploaded');assert.equal(bytes,f.bytes.length);assert.equal(jobs.adapter.dispatches.length,0);assert.equal(workflow.status.images.uploaded,1);await workflow.stopAndDrain();assert.equal(workflow.status.closed,true);
});
test('payload quota and unavailable/corrupt files are explicit; expiry is durable and never reports retention success',async t=>{
  const full=rig(t,{maxBytes:1}),failure=await full.stage.stage(full.receiver,full.manifest.image.id,full.processor,null,full.now());assert.equal(failure.state,'failed');assert.deepEqual(failure.events,['STAGE_PAYLOAD_QUOTA']);assert.throws(()=>full.stage.read(full.manifest.image.id,full.manifest.image.id));assert.equal(full.stage.status().retained,0);
  const f=rig(t);await f.stage.stage(f.receiver,f.manifest.image.id,f.processor,null,f.now(),1);writeFileSync(join(f.root,`${f.manifest.image.id}.png`),Buffer.alloc(f.bytes.length));f.reopen();assert.equal(f.stage.get(f.manifest.image.id)!.state,'corrupt');f.advance(2);const expired=f.stage.expire(f.manifest.image.id,f.now());assert.equal(expired.state,'expired');assert.ok(expired.events.includes('RETENTION_EXPIRED'));f.reopen();assert.equal(f.stage.get(f.manifest.image.id)!.state,'expired');assert.throws(()=>f.stage.read(f.manifest.image.id,f.manifest.image.id));assert.equal(f.receiver.readOwned(f.manifest.image.id).bytes.length,f.bytes.length);
});
test('reservation/file/receipt/expiry cuts recover deterministically with retained quota and original timestamps',async t=>{
  for(const point of ['after-stage-reservation','after-file-sync','after-file-rename','after-stage-commit','after-expiry-intent','after-expiry-unlink'])await t.test(point,async sub=>{let armed=true;const f=rig(sub,{fault:p=>{if(armed&&p===point){armed=false;throw new Error('SIMULATED_PROCESS_CUT');}}});
    if(point.startsWith('after-expiry')){await f.stage.stage(f.receiver,f.manifest.image.id,f.processor,null,f.now(),1);f.advance(2);assert.throws(()=>f.stage.expire(f.manifest.image.id,f.now()),/SIMULATED_PROCESS_CUT/);}else await assert.rejects(f.stage.stage(f.receiver,f.manifest.image.id,f.processor,null,f.now()),/SIMULATED_PROCESS_CUT/);
    f.reopen();const row=f.stage.get(f.manifest.image.id)!;assert.equal(row.state,point.startsWith('after-expiry')?'expired':['after-file-rename','after-stage-commit'].includes(point)?'retained':'failed');assert.deepEqual(row.manifest.metadata,f.manifest.metadata);});
});
test('outage, lost upload acknowledgement and restart inspect one remote identity; budget charges attempted payload without replacing capture/focus/processing',async t=>{
  const f=rig(t);await f.stage.stage(f.receiver,f.manifest.image.id,f.processor,null,f.now());let online=false,remote:CaptureUploadReceipt|null=null,puts=0,sent=0;
  const port={inspect:async()=>{if(!online)throw new Error('offline');return remote;},upload:async(t:CaptureTrace,body:AsyncIterable<Uint8Array>)=>{puts++;for await(const bytes of body)sent+=bytes.length;remote=receipt(t);throw new Error('lost-after-cloud-commit');}};
  const make=()=>new CaptureUploader({stage:f.stage,budget:f.budget,port,authorized:()=>true,nowUtcMs:f.now,higherPriorityPending:()=>false});let uploader=make();assert.equal((await uploader.step(f.manifest.image.id,f.manifest.image.id)).state,'deferred');assert.equal(sent,0);
  await uploader.stopAndDrain();f.reopen();uploader=make();online=true;assert.equal((await uploader.step(f.manifest.image.id,f.manifest.image.id)).state,'deferred');assert.equal(puts,1);await uploader.stopAndDrain();f.reopen();uploader=make();assert.equal((await uploader.step(f.manifest.image.id,f.manifest.image.id)).state,'uploaded');assert.equal(puts,1);assert.equal(sent,f.bytes.length);const row=f.stage.get(f.manifest.image.id)!;assert.deepEqual(row.manifest.metadata,f.manifest.metadata);assert.equal(row.artifacts[0].trace.processing.state,'unavailable');assert.equal(row.artifacts[0].upload.state,'uploaded');assert.equal(f.budget.status.unreconciledAttemptBytes,f.bytes.length);await uploader.stopAndDrain();
});
test('higher priority, exhausted budget, wrong receipts, revoked grants and hung transport never mark an artifact uploaded',async t=>{
  for(const scenario of ['priority','quota','receipt','revoked','timeout'])await t.test(scenario,async sub=>{const f=rig(sub);await f.stage.stage(f.receiver,f.manifest.image.id,f.processor,null,f.now());if(scenario==='quota')f.budget.checkpoint({period:'capture-test',startUtcMs:f.now()-1000,endUtcMs:f.now()+3600000,revision:2,usedBytes:policy.allowanceBytes,coverage:'complete',observedUtcMs:f.now(),maxAgeMs:60000,coveredCharges:[]});
    let authorized=scenario!=='revoked';const port={inspect:async(t:CaptureTrace)=>scenario==='receipt'?{...receipt(t),sha256:'a'.repeat(64)}:scenario==='timeout'?await new Promise<never>(()=>{}):null,upload:async(t:CaptureTrace,body:AsyncIterable<Uint8Array>)=>{for await(const _ of body){}authorized=false;return receipt(t);}};
    const u=new CaptureUploader({stage:f.stage,budget:f.budget,port,authorized:()=>authorized,nowUtcMs:f.now,higherPriorityPending:()=>scenario==='priority',timeoutMs:20});if(['timeout','revoked'].includes(scenario))await assert.rejects(u.step(f.manifest.image.id,f.manifest.image.id));else assert.equal((await u.step(f.manifest.image.id,f.manifest.image.id)).state,'deferred');assert.equal(f.stage.get(f.manifest.image.id)!.artifacts[0].upload.state,'pending');await u.stopAndDrain();});
});
test('preview start/reconnect/expiry/stop hooks keep actor and grant distinct from delivered bytes and obey the shared budget',async t=>{
  const f=rig(t),hooks:unknown[]=[],camera={owners:0};const preview=new CapturePreview({budget:f.budget,nowUtcMs:f.now,authorized:()=>true,acquireCamera:()=>{if(camera.owners)throw new Error('CAMERA_BUSY');camera.owners++;return ()=>{camera.owners--;};},frame:async()=>f.bytes,append:e=>hooks.push(e)});
  const grant={id:'preview-job-1',generation:1,actor:{kind:'human' as const,id:'viewer-1'},source:f.source,expiresUtcMs:f.now()+1000,bitrate:200000,expectedBytes:25000};assert.equal(capturePreviewPolicy(f.budget,200000).allow,true);preview.start(grant);assert.equal(camera.owners,1);assert.deepEqual(hooks.map(e=>(e as {event:string}).event),['start']);await preview.frame(new AbortController().signal);
  preview.start({...grant,generation:2});assert.equal(camera.owners,1);f.advance(1001);preview.tick();assert.equal(camera.owners,0);assert.deepEqual(hooks.map(e=>(e as {event:string}).event),['start','delivery','stop','reconnect','expiry']);assert.equal((hooks[0] as {bytes:null}).bytes,null);assert.equal((hooks[1] as {bytes:number}).bytes,f.bytes.length);
  preview.start({...grant,generation:3,expiresUtcMs:f.now()+1000});preview.stop();assert.equal(camera.owners,0);assert.equal(preview.status.recordingEnabled,false);assert.throws(()=>preview.start({...grant,generation:4,expiresUtcMs:f.now()+1000,bitrate:200001}),/STREAM_LIMIT/);assert.equal(camera.owners,0);
});
test('a failed preview audit still releases camera ownership and closes the discretionary uploader after local safety inhibition',async t=>{
  const f=rig(t),root=mkdtempSync(join(tmpdir(),'arbi-capture-jobs-')),jobs=createJobReference(root);t.after(()=>{jobs.close();rmSync(root,{recursive:true,force:true});});let owners=0;
  const preview=new CapturePreview({budget:f.budget,nowUtcMs:f.now,authorized:()=>true,acquireCamera:()=>{owners++;return ()=>{owners--;};},frame:async()=>f.bytes,append:e=>{if(e.event==='stop')throw new Error('AUDIT_UNAVAILABLE');}});
  preview.start({id:'preview-stop-failure',generation:1,actor:{kind:'human',id:'viewer-1'},source:f.source,expiresUtcMs:f.now()+1000,bitrate:200000,expectedBytes:25000});
  const uploader=new CaptureUploader({stage:f.stage,budget:f.budget,authorized:()=>true,nowUtcMs:f.now,higherPriorityPending:()=>false,port:{inspect:async()=>null,upload:async()=>{throw new Error('unexpected-send');}}});
  const workflow=new CaptureWorkflow({jobs:jobs.consumer,receiver:f.receiver,stage:f.stage,processor:f.processor,uploader,budget:f.budget,preview,calibration:()=>null,nowUtcMs:f.now,priority:'raw-first'});await assert.rejects(workflow.stopAndDrain(),/AUDIT_UNAVAILABLE/);assert.equal(owners,0);assert.equal(uploader.status.closed,true);assert.equal(jobs.consumer.status.degraded,true);
});
