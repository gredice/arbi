import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync,rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { configurationDigest } from '@arbi/protocol';
import type { Command,CommandGate } from '@arbi/protocol';
import {payloadDigest} from '@arbi/protocol/capture-transfer';
import { createJobReference } from '../../arbi-edge-controller/dist/jobs/reference.js';
import { LocalJobConsumer } from '../../arbi-edge-controller/dist/jobs/orchestrator.js';
import { CaptureJobAdapter } from '../../arbi-edge-controller/dist/images/job-adapter.js';
import { CaptureReceiver } from '../../arbi-edge-controller/dist/images/capture-receiver.js';
import { CaptureStage } from '../../arbi-edge-controller/dist/images/stage.js';
import { ImageProcessor } from '../../arbi-edge-controller/dist/images/processor.js';
import { GimbalModel,SyntheticServoAdapter } from './gimbal.js';
import type { GimbalAxis } from './gimbal.js';
import { CaptureSequencer } from './capture.js';
import { CaptureStore } from './capture-store.js';
import { SyntheticCaptureCamera } from './capture-camera.js';
import type { CaptureProfile } from './capture-camera.js';
function directory(t:TestContext,prefix:string){const d=mkdtempSync(join(tmpdir(),prefix));t.after(()=>rmSync(d,{recursive:true,force:true}));return d;}
function rig(t:TestContext){
  const r=createJobReference(directory(t,'arbi-capture-job-')),a=r.authority,source=a.modules.pod.source,pico=a.modules.motion.source,applied=structuredClone(r.applied);
  applied.appliedBy=source;applied.request.target=source;
  const boundary={...a.boundary,receiver:source},gate:CommandGate={...structuredClone(a.gate),authenticatedSource:a.gate.receiver,receiver:source,maxDeadlineAheadMs:3000,allowedTypes:['camera.capture','camera.gimbal'],supportedTypes:['camera.capture','camera.gimbal'],lease:{...a.gate.lease!,receiver:source}};
  let motionSequence=0n;const axis=(min:number,max:number):GimbalAxis=>({minimumDeg:min,maximumDeg:max,referenceDeg:0,pulseAtReferenceUs:1500,direction:1,usPerDeg:10,minimumPulseUs:500,maximumPulseUs:2500,maximumVelocityDegPerS:180});
  const gimbal=new GimbalModel({source,motionSource:pico,motionGeneration:1,applied,boundary,gate:()=>({...gate,nowMonotonicMs:a.gate.nowMonotonicMs}),now:()=>a.gate.nowMonotonicMs,servo:new SyntheticServoAdapter(),
    motion:()=>({origin:'simulated',identity:pico,generation:1,sequence:String(++motionSequence),configurationDigest:applied.configurationDigest,calibrationRevision:applied.request.configuration.calibration!.revision,stopped:r.adapter.stationary,sampledMs:a.gate.nowMonotonicMs}),
    calibration:{version:'arbi.gimbal-model/1.0',origin:'simulated',configurationDigest:applied.configurationDigest,calibrationRevision:applied.request.configuration.calibration!.revision,frameRevision:applied.request.configuration.geometry.gimbalFrame.revision,pan:axis(-90,90),tilt:axis(-60,60),safePose:{panDeg:0,tiltDeg:0},settling:{fixtureRecord:'capture-job-settle',intervalMs:30,toleranceDeg:0.5}}});
  const store=new CaptureStore({root:directory(t,'arbi-pod-capture-'),binding:{realm:a.gate.realm,siteId:a.gate.siteId,deviceId:source.deviceId}}),camera=new SyntheticCaptureCamera();
  const profile:CaptureProfile={version:'arbi.capture-profile/1.0',origin:'simulated',id:'job-profile',revision:'job-profile-1',configurationDigest:applied.configurationDigest,calibrationRevision:applied.request.configuration.calibration!.revision,widthPx:32,heightPx:24,exposureTimeUs:10000,analogueGain:1,focusMode:'single',lensRange:{minimum:0,maximum:1},preview:false};
  const capture=new CaptureSequencer({applied,boundary,profile,store,gimbal,camera,gate:()=>({...gate,nowMonotonicMs:a.gate.nowMonotonicMs}),clock:()=>({monotonicMs:a.gate.nowMonotonicMs,utcMs:Date.parse('2026-10-11T12:00:00.000Z')+a.gate.nowMonotonicMs,uncertaintyMs:10}),wait:async ms=>{a.gate.nowMonotonicMs+=ms;},
    context:()=>({jobId:r.command.command.correlationId,targetId:r.command.body.type==='camera.capture'?r.command.body.resourceId:'invalid',requestedPoseMm:a.capturePlan!.positionMm,availablePose:{origin:'simulated',quality:'estimated',positionMm:r.adapter.modules.motion.positionEstimateMm(),sampleMonotonicMs:a.gate.nowMonotonicMs,uncertaintyMm:10}}),build:{version:'0.1.0',sha:'a'.repeat(40),dirty:false}});
  const pairs=new Map<string,Command>();let sequence=0;
  const adapter=new CaptureJobAdapter({motion:r.adapter,stationary:()=>r.adapter.stationary,pod:{gimbal:c=>{gimbal.move(c);},settled:()=>gimbal.captureEligibility(),capture:(c,g)=>capture.capture(c,g),localStop:()=>gimbal.inhibit()},command:o=>{
    const key=o.phase==='capture'?'capture':`gimbal-${configurationDigest(o.step.body).slice(0,24)}`;const old=pairs.get(key);if(old)return old;
    const c:Command={...structuredClone(r.command),messageId:`pod-message-${++sequence}`,sequence:String(sequence),source:a.gate.receiver,command:{...structuredClone(r.command.command),commandId:`pod-${key}`,idempotencyKey:`pod-key-${key}`,target:source,deadline:{...r.command.command.deadline,bootId:source.bootId,sessionId:source.sessionId,expiresMonotonicMs:a.gate.nowMonotonicMs+(o.phase==='capture'?2000:900)},lease:structuredClone(r.command.command.lease)},body:o.step.body!};
    if('maxDurationMs' in c.body)c.body.maxDurationMs=Math.min(c.body.maxDurationMs,o.phase==='capture'?2000:900);pairs.set(key,c);return c;}});
  const consumer=new LocalJobConsumer({journal:r.journal,adapter,authority:()=>a,auditSpool:r.relay.spool});consumer.authorizeRecovery();gimbal.reconcile({origin:'simulated',recordId:'known-job-start-pose',panDeg:0,tiltDeg:0});
  t.after(()=>{adapter.localStop();capture.close();store.close();r.close();});
  async function run(){let job=consumer.receive(r.command);for(let now=1000;now<10000&&!['completed','failed','rejected'].includes(job.outcome);now+=50){a.gate.nowMonotonicMs=Math.max(now,a.gate.nowMonotonicMs);for(const c of Object.values(a.conditions)){c.sampledAtMs=a.gate.nowMonotonicMs;c.validUntilMs=a.gate.nowMonotonicMs+1000;}a.stationary=r.adapter.stationary;a.safeMotionPose=gimbal.status.safeMotionPose;r.adapter.modules.disturb({kind:'sensor',sensor:'dock',atMs:a.gate.nowMonotonicMs,order:0,value:true});try{job=consumer.tick()!;}catch{job=r.journal.get(r.command.command.commandId)!;}await new Promise<void>(resolve=>setImmediate(resolve));}return job;}
  return {r,a,adapter,consumer,camera,capture,gimbal,store,pairs,run};
}
test('native job -> stopped bounded motion -> actual gimbal -> settle -> autofocus -> one durable PNG -> edge stage',async t=>{
  const f=rig(t),job=await f.run();assert.equal(job.outcome,'completed',job.error??'');assert.equal(f.camera.counters.captures,1);assert.equal(f.camera.counters.focus,1);
  const receipt=f.store.get('pod-capture')!;assert.equal(receipt.state,'captured');assert.equal(receipt.metadata!.jobId,job.command.command.correlationId);
  const captureOp=f.r.journal.records(job.command.command.commandId).find(r=>r.phase==='capture')!;assert.ok(f.r.journal.records(job.command.command.commandId).some(r=>r.stepIndex===2));assert.equal(captureOp.operation!.step.proof,'captured');
  const again=await f.capture.capture(f.pairs.get('capture'),[...f.pairs.entries()].find(([k])=>k.startsWith('gimbal-'))![1]);assert.equal(again.image!.id,receipt.image!.id);assert.equal(f.camera.counters.captures,1);assert.equal(f.consumer.receive(f.r.command).outcome,'completed');
  const keys=generateKeyPairSync('ed25519'),edge=new CaptureReceiver({root:directory(t,'arbi-edge-captures-'),realm:f.a.gate.realm,siteId:f.a.gate.siteId,podDeviceId:'pod',edge:f.a.gate.receiver,privateKey:keys.privateKey,authorize:()=>true});
  const m=f.store.manifest('pod-capture'),bytes=f.store.readImage(receipt);edge.begin(m,f.a.modules.pod.source);edge.chunk(m.image.id,configurationDigest(m),0,bytes,payloadDigest(bytes),f.a.modules.pod.source);edge.finish(m.image.id,configurationDigest(m),f.a.modules.pod.source);
  const stage=new CaptureStage({root:directory(t,'arbi-capture-stage-'),realm:m.realm,siteId:m.siteId}),processor=new ImageProcessor();
  const staged=await stage.stage(edge,m.image.id,processor,null,Date.now());assert.equal(staged.state,'retained');assert.equal(staged.artifacts[0].trace.processing.state,'unavailable');assert.equal(staged.artifacts[0].upload.state,'pending');assert.deepEqual(stage.read(m.image.id,m.image.id),bytes);assert.deepEqual(staged.manifest.metadata,receipt.metadata);assert.equal((await stage.stage(edge,m.image.id,processor,null,Date.now())).artifacts[0].trace.artifact.id,m.image.id);stage.close();processor.close();edge.close();
});
test('focus and physical capture failures remain separate from processing or upload and never produce a durable PNG',async t=>{
  for(const phase of ['focus','capture'])await t.test(phase,async sub=>{const f=rig(sub);if(phase==='focus')f.camera.autofocus=async()=>({origin:'simulated',status:'failed',score:null,lensPosition:null,algorithmRevision:'test-failure'});else f.camera.still=async()=>{throw new Error('camera-adapter-failed');};
    const job=await f.run();assert.equal(job.outcome,'failed');const receipt=f.store.get('pod-capture')!;assert.equal(receipt.state,'failed');assert.equal(receipt.phase,phase);assert.equal(receipt.reason,phase==='focus'?'FOCUS_FAILED':'CAMERA_FAILED');assert.equal(receipt.image,null);assert.equal(receipt.metadata,null);assert.equal(f.adapter.results.has(job.command.command.commandId),true);});
});
