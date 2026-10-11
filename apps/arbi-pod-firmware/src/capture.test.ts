import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync,readFileSync,rmSync,writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { ConfigurationReference,configurationDigest } from '@arbi/protocol';
import type { Command,CommandGate,ConfigurationApplyBoundary,ConfigurationRequest } from '@arbi/protocol';
import { GimbalModel,SyntheticServoAdapter } from './gimbal.js';
import type { GimbalAxis,GimbalCalibration,MotionStopEvidence } from './gimbal.js';
import { CaptureStore } from './capture-store.js';
import { CaptureSequencer } from './capture.js';
import { SyntheticCaptureCamera } from './capture-camera.js';
import type { CaptureProfile } from './capture-camera.js';
const configs=JSON.parse(readFileSync(new URL('../../../packages/arbi-protocol/fixtures/configuration.json',import.meta.url),'utf8'));
const contracts=JSON.parse(readFileSync(new URL('../../../packages/arbi-protocol/fixtures/contracts.json',import.meta.url),'utf8'));
function fixture(t:TestContext,policy:{maxBytes?:number;maxRecords?:number;preview?:boolean}={}) {
  const root=mkdtempSync(join(tmpdir(),'arbi-pod-capture-')),source={deviceId:'pod',bootId:'pod-boot-1',sessionId:'pod-session-1'},edge={deviceId:'edge',bootId:'edge-boot-1',sessionId:'edge-session-1'},pico={deviceId:'pico',bootId:'pico-boot-1',sessionId:'pico-session-1'};
  const boundary:ConfigurationApplyBoundary={...structuredClone(configs.context),receiver:source},raw=structuredClone(configs.requests.request);
  delete raw.configurationFixture;raw.configuration=structuredClone(configs.valid.configuration);raw.target=source;const request:ConfigurationRequest=raw;
  const reference=new ConfigurationReference();assert.ok(reference.apply(request,boundary,()=>true).ok);const applied=reference.applied!;
  const axis=(minimumDeg:number,maximumDeg:number):GimbalAxis=>({minimumDeg,maximumDeg,referenceDeg:0,pulseAtReferenceUs:1500,direction:1,usPerDeg:10,minimumPulseUs:500,maximumPulseUs:2500,maximumVelocityDegPerS:180});
  const calibration:GimbalCalibration={version:'arbi.gimbal-model/1.0',origin:'simulated',configurationDigest:applied.configurationDigest,calibrationRevision:'calibration-1',frameRevision:'gimbal-1',pan:axis(-90,90),tilt:axis(-60,60),safePose:{panDeg:0,tiltDeg:0},settling:{fixtureRecord:'synthetic-settle-42',intervalMs:30,toleranceDeg:0.5}};
  const gate:CommandGate={realm:request.configuration.realm,siteId:request.configuration.siteId,executionMode:'simulation',authenticatedSource:edge,receiver:source,nowMonotonicMs:0,maxDeadlineAheadMs:3000,authorizedActor:{kind:'human',id:'operator-1'},
    allowedTypes:['camera.gimbal','camera.capture'],supportedTypes:['camera.gimbal','camera.capture'],configRevision:'config-1',faultInhibited:false,lease:{id:'lease-1',holderId:'operator-1',fence:'1',receiver:source,expiresMonotonicMs:5000}};
  let now=0,n=0,motionSequence=0n,stopped=true,cut:string|null=null;
  const servo=new SyntheticServoAdapter(),gimbal=new GimbalModel({source,motionSource:pico,motionGeneration:1,applied,boundary,calibration,gate:()=>gate,now:()=>now,servo,
    motion:()=>({origin:'simulated',identity:pico,generation:1,sequence:String(++motionSequence),configurationDigest:applied.configurationDigest,calibrationRevision:'calibration-1',stopped,sampledMs:now} satisfies MotionStopEvidence)});
  gimbal.reconcile({origin:'simulated',recordId:'known-synthetic-pose',panDeg:0,tiltDeg:0});
  const binding={realm:request.configuration.realm,siteId:request.configuration.siteId,deviceId:'pod'},storeOptions={root,binding,maxBytes:policy.maxBytes,maxRecords:policy.maxRecords,
    fault:(point:string)=>{if(cut===point){cut=null;throw new Error('SIMULATED_PROCESS_CUT');}}};let store=new CaptureStore(storeOptions);
  const camera=new SyntheticCaptureCamera(),profile:CaptureProfile={version:'arbi.capture-profile/1.0',origin:'simulated',id:'profile-1',revision:'profile-revision-1',configurationDigest:applied.configurationDigest,calibrationRevision:'calibration-1',
    widthPx:32,heightPx:24,exposureTimeUs:10000,analogueGain:1,focusMode:'single',lensRange:{minimum:0,maximum:1},preview:policy.preview??false};
  const options:ConstructorParameters<typeof CaptureSequencer>[0]={applied,boundary,profile,store,gimbal,camera,gate:()=>gate,clock:()=>({monotonicMs:now,utcMs:null,uncertaintyMs:null}),wait:async(ms:number)=>{now+=ms;},
    context:()=>({jobId:'capture-job-1',targetId:'bed-target-1',requestedPoseMm:{x:1000,y:1000,z:2000},availablePose:{origin:'unavailable' as const,quality:'unavailable' as const,positionMm:null,sampleMonotonicMs:null,uncertaintyMm:null}}),
    build:{version:'0.1.0',sha:'5'.repeat(40),dirty:false},stepTimeoutMs:30};const model=new CaptureSequencer(options);
  const pair=()=>{const capture:Command=structuredClone(contracts.valid.capture),movement:Command=structuredClone(contracts.valid.gimbal);const count=++n;
    for(const [index,c] of [movement,capture].entries()){c.source=edge;c.messageId=`message-${count}-${index}`;c.sequence=String(count*2+index);c.command.target=source;
      c.command.commandId=`${index?'capture':'gimbal'}-${count}`;c.command.correlationId='capture-job-1';c.command.idempotencyKey=`key-${count}-${index}`;c.command.lease!.fence='1';
      c.command.deadline={bootId:source.bootId,sessionId:source.sessionId,expiresMonotonicMs:now+(index?2000:700)};}
    movement.body={type:'camera.gimbal',panDeg:20,tiltDeg:-10,frame:structuredClone(request.configuration.geometry.gimbalFrame),maxDurationMs:700};capture.body={type:'camera.capture',resourceId:'bed-target-1',maxDurationMs:2000};return {capture,movement};};
  t.after(()=>{model.close();store.close();rmSync(root,{recursive:true,force:true});});
  return {root,binding,storeOptions,model,gimbal,servo,camera,options,profile,gate,pair,get store(){return store;},clock:(value:number)=>{now=value;},motion:(value:boolean)=>{stopped=value;},cut:(value:string)=>{cut=value;},
    reopen:()=>{store.close();store=new CaptureStore(storeOptions);return store;}};
}
test('actual PNG and durable capture metadata preserve independent processing/upload state and unavailable pose/clock',async t=>{
  const f=fixture(t,{preview:true}),p=f.pair(),r=await f.model.capture(p.capture,p.movement);assert.equal(r.state,'captured');assert.equal(f.camera.counters.captures,1);assert.equal(f.camera.counters.previews,1);
  const bytes=f.store.readImage(r);assert.equal(createHash('sha256').update(bytes).digest('hex'),r.image!.sha256);assert.equal(bytes.readUInt32BE(16),32);assert.equal(bytes.readUInt32BE(20),24);
  const m=r.metadata!;assert.equal(m.version,'arbi.raw-capture/1.0');assert.equal(m.jobId,p.capture.command.correlationId);assert.equal(m.resourceId,'bed-target-1');
  assert.deepEqual(m.processing,{state:'not-processed',derivedIds:[]});assert.deepEqual(m.upload,{state:'not-uploaded'});assert.equal(m.physicalCamera,false);
  assert.equal((m.capturedAt as {utc:unknown}).utc,null);assert.equal((m.availablePose as {positionMm:unknown}).positionMm,null);assert.equal((m.gimbal as {physicalSettlingMeasured:boolean}).physicalSettlingMeasured,false);
  assert.equal(f.reopen().get(r.commandId)!.image!.sha256,r.image!.sha256);
});
test('durable duplicates, conflicting retries and concurrent requests never trigger another capture',async t=>{
  const f=fixture(t),p=f.pair(),r=await f.model.capture(p.capture,p.movement);const duplicate=await f.model.capture(p.capture,p.movement);assert.deepEqual(duplicate,r);assert.equal(f.camera.counters.captures,1);
  const retried=structuredClone(p.capture);retried.messageId='retried-envelope';retried.sequence='100';assert.deepEqual(await f.model.capture(retried,p.movement),r);assert.equal(f.camera.counters.captures,1);
  const conflict=structuredClone(p.capture);conflict.command.correlationId='another-job';await assert.rejects(f.model.capture(conflict,p.movement),{code:'CAPTURE_SEQUENCE_MISMATCH'});
  const fresh=f.pair();const pending=f.model.capture(fresh.capture,fresh.movement),other=f.pair();assert.equal((await f.model.capture(other.capture,other.movement)).reason,'CAMERA_BUSY');await pending;assert.equal(f.camera.counters.captures,2);
  const old=f.pair();old.capture.command.target={...old.capture.command.target,bootId:'old-pod'};old.capture.command.deadline.bootId='old-pod';await assert.rejects(f.model.capture(old.capture,old.movement),{code:'TARGET_MISMATCH'});
});
test('preview contention has a bounded durable refusal and an old release cannot release a new owner',async t=>{
  const f=fixture(t),release=f.model.acquirePreview(),p=f.pair();assert.equal((await f.model.capture(p.capture,p.movement)).reason,'CAMERA_BUSY');assert.equal(f.camera.counters.captures,0);
  assert.throws(()=>new CaptureSequencer(f.options),{code:'CAMERA_OWNER_EXISTS'});assert.throws(()=>f.model.close(),{code:'CAMERA_BUSY'});
  release();const newer=f.model.acquirePreview();release();assert.throws(()=>f.model.acquirePreview(),{code:'CAMERA_BUSY'});newer();const next=f.pair();assert.equal((await f.model.capture(next.capture,next.movement)).state,'captured');
});
test('focus, initialization, camera failure and timed-out late callbacks remain distinct and cannot publish success',async t=>{
  for(const scenario of ['focus','initialize','camera','timeout']){const f=fixture(t),p=f.pair();
    if(scenario==='focus')f.camera.autofocus=async()=>({origin:'simulated',status:'failed',score:null,lensPosition:null,algorithmRevision:'synthetic-focus-1'});
    if(scenario==='initialize')f.camera.initialize=async()=>({origin:'simulated',ready:false,revision:'synthetic-camera-1'});
    if(scenario==='camera')f.camera.still=async()=>{throw new Error('private-error-not-persisted');};
    if(scenario==='timeout'){const original=f.camera.still.bind(f.camera);f.camera.still=async signal=>{await new Promise(resolve=>setTimeout(resolve,60));return original(signal);};}
    const r=await f.model.capture(p.capture,p.movement);assert.equal(r.state,'failed');assert.equal(r.image,null);
    assert.equal(r.reason,scenario==='focus'?'FOCUS_FAILED':scenario==='initialize'?'CAMERA_UNAVAILABLE':scenario==='timeout'?'CAMERA_STEP_TIMEOUT':'CAMERA_FAILED');
    if(scenario==='timeout')await new Promise(resolve=>setTimeout(resolve,80));assert.equal(f.store.get(r.commandId)!.state,'failed');assert.ok(!JSON.stringify(r).includes('private-error'));}
});
test('current authority and stop proof are renewed across camera IO; full storage and broken clock fail explicitly',async t=>{
  for(const scenario of ['lease','motion','storage','clock']){const f=fixture(t,scenario==='storage'?{maxBytes:24}:{}),p=f.pair();
    if(scenario==='lease'||scenario==='motion'){const original=f.camera.autofocus.bind(f.camera);f.camera.autofocus=async signal=>{const r=await original(signal);if(scenario==='lease')f.gate.lease=null;else f.motion(false);return r;};}
    if(scenario==='clock')f.options.wait=async()=>{};
    const r=await f.model.capture(p.capture,p.movement);assert.equal(r.state,'failed');assert.equal(r.reason,scenario==='lease'?'CAPTURE_AUTHORITY_LOST':scenario==='motion'?'CAPTURE_MOTION_INTERRUPTED':scenario==='storage'?'CAPTURE_STORAGE_FULL':'CLOCK_NOT_ADVANCING');
    assert.equal(f.camera.counters.captures,scenario==='storage'?1:0);}
});
test('native write cuts recover a valid committed raw image or an explicit incomplete result without redispatch',async t=>{
  for(const point of ['after-reservation','after-image-intent','after-part-write','after-rename','after-finalize']){const f=fixture(t),p=f.pair();f.cut(point);
    await assert.rejects(f.model.capture(p.capture,p.movement),{message:'SIMULATED_PROCESS_CUT'});const before=f.camera.counters.captures,store=f.reopen(),r=store.get(p.capture.command.commandId)!;
    assert.equal(r.state,['after-rename','after-finalize'].includes(point)?'captured':'failed');if(r.state==='captured')assert.equal(store.readImage(r).length,r.image!.bytes);
    assert.equal(f.camera.counters.captures,before);assert.ok(r.reason!==null||point==='after-finalize');}
});
test('raw corruption, bounded receipt capacity and scope changes cannot manufacture a successful new result',async t=>{
  const f=fixture(t,{maxRecords:1}),p=f.pair(),r=await f.model.capture(p.capture,p.movement);writeFileSync(join(f.root,r.image!.file),Buffer.alloc(r.image!.bytes));assert.throws(()=>f.store.readImage(r),{code:'RAW_IMAGE_CORRUPT'});
  await assert.rejects(f.model.capture(p.capture,p.movement),{code:'RAW_IMAGE_CORRUPT'});f.store.options.maxRecords=128;
  const next=f.pair();await assert.rejects(f.model.capture(next.capture,next.movement),{code:'CAPTURE_RECEIPT_LIMIT'});assert.equal(f.camera.counters.captures,1);
  f.store.close();assert.throws(()=>new CaptureStore({...f.storeOptions,binding:{...f.binding,siteId:'other-site'}}),{code:'CAPTURE_SCOPE_MISMATCH'});
});
test('actual SIGKILL releases the native owner lock and preserves an interrupted reservation without camera replay',async t=>{
  const root=mkdtempSync(join(tmpdir(),'arbi-pod-capture-')),binding={realm:{environment:'test',namespaceId:'capture-crash'},siteId:'synthetic-site',deviceId:'pod'};t.after(()=>rmSync(root,{recursive:true,force:true}));
  const input=join(root,'fixture.json');writeFileSync(input,JSON.stringify({root,binding}),{mode:0o600});const child=spawn(process.execPath,[new URL('./capture-crash-child.js',import.meta.url).pathname,input],{stdio:['pipe','pipe','pipe']});
  t.after(()=>{if(child.exitCode===null)child.kill('SIGKILL');});const ready=await Promise.race([once(child.stdout,'data'),new Promise<never>((_,bad)=>setTimeout(()=>bad(new Error('CHILD_TIMEOUT')),5000).unref())]);
  assert.equal(JSON.parse(String(ready[0])).state,'reserved');child.kill('SIGKILL');await once(child,'exit');const store=new CaptureStore({root,binding});t.after(()=>store.close());
  assert.equal(store.get('crash-capture')!.state,'failed');assert.equal(store.get('crash-capture')!.reason,'CAPTURE_INTERRUPTED_NO_REPLAY');
});
test('corrupt/truncated encoded frames and mismatched capture profiles fail before image commitment',async t=>{
  for(const kind of ['crc','truncated','dimensions']){const f=fixture(t),p=f.pair(),original=f.camera.still.bind(f.camera);f.camera.still=async signal=>{const image=await original(signal);
    if(kind==='crc')image.bytes[image.bytes.length-1]^=1;if(kind==='truncated')image.bytes=image.bytes.subarray(0,image.bytes.length-8);if(kind==='dimensions')image.bytes.writeUInt32BE(1024,16);return image;};
    const r=await f.model.capture(p.capture,p.movement);assert.equal(r.state,'failed');assert.equal(r.reason,'INVALID_RAW_CAPTURE');assert.equal(r.image,null);}
  const f=fixture(t);assert.throws(()=>new CaptureSequencer({...f.options,profile:{...f.profile,widthPx:513}}),{code:'CAPTURE_PROFILE_INCOMPATIBLE'});
  assert.throws(()=>new CaptureSequencer({...f.options,profile:{...f.profile,calibrationRevision:'old-calibration'}}),{code:'CAPTURE_PROFILE_INCOMPATIBLE'});assert.equal(f.camera.counters.captures,0);
});
test('declared clock uncertainty and aged estimated pose remain traceable instead of becoming a current measurement',async t=>{
  const f=fixture(t);f.clock(2000);const clock=f.options.clock;f.options.clock=()=>({...clock(),utcMs:1791374400000+clock().monotonicMs,uncertaintyMs:5});
  f.options.context=()=>({jobId:'capture-job-1',targetId:'bed-target-1',requestedPoseMm:null,availablePose:{origin:'simulated',quality:'estimated',positionMm:{x:1000,y:1000,z:2000},sampleMonotonicMs:0,uncertaintyMm:2}});
  const p=f.pair(),r=await f.model.capture(p.capture,p.movement);assert.equal(r.state,'captured');const m=r.metadata!,pose=m.availablePose as {quality:string;originQuality:string;ageMs:number;uncertaintyMm:number};
  assert.equal(pose.quality,'stale');assert.equal(pose.originQuality,'estimated');assert.ok(pose.ageMs>=2000);assert.equal(pose.uncertaintyMm,2);assert.equal((m.capturedAt as {uncertaintyMs:number}).uncertaintyMs,5);
});
