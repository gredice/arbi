// Run after a clean pod build. Only the actual synthetic capture implementation
// produces the receipt/PNG. No physical device, authority endpoint or credentials.
import assert from 'node:assert/strict';
import { mkdtempSync,readFileSync,rmSync,writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { ConfigurationReference } from '@arbi/protocol';
import { GimbalModel,SyntheticServoAdapter } from '../dist/gimbal.js';
import { CaptureStore } from '../dist/capture-store.js';
import { CaptureSequencer } from '../dist/capture.js';
import { SyntheticCaptureCamera } from '../dist/capture-camera.js';
if(process.argv.length!==3)throw new Error('Pass the explicit public fixture output filename');
const build=JSON.parse(readFileSync(new URL('../dist/build-identity.json',import.meta.url),'utf8'));
if(build.dirty)throw new Error('Clean source build required');
const configs=JSON.parse(readFileSync(new URL('../../../packages/arbi-protocol/fixtures/configuration.json',import.meta.url),'utf8'));
const contracts=JSON.parse(readFileSync(new URL('../../../packages/arbi-protocol/fixtures/contracts.json',import.meta.url),'utf8'));
const root=mkdtempSync(join(tmpdir(),'arbi-pod-capture-')),source={deviceId:'pod',bootId:'pod-boot-1',sessionId:'pod-session-1'},edge={deviceId:'edge',bootId:'edge-boot-1',sessionId:'edge-session-1'},pico={deviceId:'pico',bootId:'pico-boot-1',sessionId:'pico-session-1'};
const raw=structuredClone(configs.requests.request);delete raw.configurationFixture;raw.configuration=structuredClone(configs.valid.configuration);raw.target=source;
const boundary={...structuredClone(configs.context),receiver:source},reference=new ConfigurationReference();assert.ok(reference.apply(raw,boundary,()=>true).ok);const applied=reference.applied;
const axis=(minimumDeg,maximumDeg)=>({minimumDeg,maximumDeg,referenceDeg:0,pulseAtReferenceUs:1500,direction:1,usPerDeg:10,minimumPulseUs:500,maximumPulseUs:2500,maximumVelocityDegPerS:180});
const calibration={version:'arbi.gimbal-model/1.0',origin:'simulated',configurationDigest:applied.configurationDigest,calibrationRevision:'calibration-1',frameRevision:'gimbal-1',pan:axis(-90,90),tilt:axis(-60,60),safePose:{panDeg:0,tiltDeg:0},settling:{fixtureRecord:'synthetic-settle-42',intervalMs:30,toleranceDeg:0.5}};
const gate={realm:raw.configuration.realm,siteId:raw.configuration.siteId,executionMode:'simulation',authenticatedSource:edge,receiver:source,nowMonotonicMs:0,maxDeadlineAheadMs:3000,authorizedActor:{kind:'human',id:'operator-1'},allowedTypes:['camera.gimbal','camera.capture'],supportedTypes:['camera.gimbal','camera.capture'],configRevision:'config-1',faultInhibited:false,lease:{id:'lease-1',holderId:'operator-1',fence:'1',receiver:source,expiresMonotonicMs:5000}};
let now=0,sequence=0n,store,model;
try {
  const gimbal=new GimbalModel({source,motionSource:pico,motionGeneration:1,applied,boundary,calibration,gate:()=>gate,now:()=>now,servo:new SyntheticServoAdapter(),motion:()=>({origin:'simulated',identity:pico,generation:1,sequence:String(++sequence),configurationDigest:applied.configurationDigest,calibrationRevision:'calibration-1',stopped:true,sampledMs:now})});
  gimbal.reconcile({origin:'simulated',recordId:'known-synthetic-pose',panDeg:0,tiltDeg:0});
  store=new CaptureStore({root,binding:{realm:raw.configuration.realm,siteId:raw.configuration.siteId,deviceId:'pod'}});
  const profile={version:'arbi.capture-profile/1.0',origin:'simulated',id:'profile-1',revision:'profile-revision-1',configurationDigest:applied.configurationDigest,calibrationRevision:'calibration-1',widthPx:32,heightPx:24,exposureTimeUs:10000,analogueGain:1,focusMode:'single',lensRange:{minimum:0,maximum:1},preview:false};
  model=new CaptureSequencer({applied,boundary,profile,store,gimbal,camera:new SyntheticCaptureCamera(),gate:()=>gate,clock:()=>({monotonicMs:now,utcMs:null,uncertaintyMs:null}),wait:async ms=>{now+=ms;},context:()=>({jobId:'capture-job-1',targetId:'bed-target-1',requestedPoseMm:{x:1000,y:1000,z:2000},availablePose:{origin:'unavailable',quality:'unavailable',positionMm:null,sampleMonotonicMs:null,uncertaintyMm:null}}),build});
  const movement=structuredClone(contracts.valid.gimbal),capture=structuredClone(contracts.valid.capture);
  for(const [n,c] of [movement,capture].entries()) {c.source=edge;c.messageId=`fixture-message-${n}`;c.sequence=String(n+1);c.command.target=source;c.command.commandId=`fixture-${n?'capture':'gimbal'}`;c.command.correlationId='capture-job-1';c.command.idempotencyKey=`fixture-key-${n}`;c.command.lease.fence='1';c.command.deadline={bootId:source.bootId,sessionId:source.sessionId,expiresMonotonicMs:n?2000:700};}
  movement.body={type:'camera.gimbal',panDeg:20,tiltDeg:-10,frame:structuredClone(raw.configuration.geometry.gimbalFrame),maxDurationMs:700};capture.body={type:'camera.capture',resourceId:'bed-target-1',maxDurationMs:2000};
  const receipt=await model.capture(capture,movement);assert.equal(receipt.state,'captured');
  writeFileSync(resolve(process.argv[2]),JSON.stringify({version:'arbi.capture-processing-fixture/1.0',producer:{source:build.sha,dirty:build.dirty,adapter:'SyntheticCaptureCamera',physicalCamera:false},receipt,pngBase64:store.readImage(receipt).toString('base64')},null,2)+'\n');
} finally {model?.close();store?.close();rmSync(root,{recursive:true,force:true});}
