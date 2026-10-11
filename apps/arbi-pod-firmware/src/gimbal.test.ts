import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ConfigurationReference,configurationDigest } from '@arbi/protocol';
import type { Command,CommandGate,ConfigurationApplyBoundary,ConfigurationRequest,Identity } from '@arbi/protocol';
import { GimbalModel,SyntheticServoAdapter } from './gimbal.js';
import type { GimbalAxis,GimbalCalibration,ModelServoAdapter,MotionStopEvidence,ServoObservation } from './gimbal.js';
const configs=JSON.parse(readFileSync(new URL('../../../packages/arbi-protocol/fixtures/configuration.json',import.meta.url),'utf8'));
const contracts=JSON.parse(readFileSync(new URL('../../../packages/arbi-protocol/fixtures/contracts.json',import.meta.url),'utf8'));
function fixture(change?:(calibration:GimbalCalibration)=>void,newBoot=false) {
  const source:Identity={deviceId:'pod',bootId:newBoot?'pod-boot-2':'pod-boot-1',sessionId:'pod-session-1'},edge={deviceId:'edge',bootId:'edge-boot-1',sessionId:'edge-session-1'},pico={deviceId:'pico',bootId:'pico-boot-1',sessionId:'pico-session-1'};
  const boundary:ConfigurationApplyBoundary={...structuredClone(configs.context),receiver:source};
  const raw=structuredClone(configs.requests.request);delete raw.configurationFixture;raw.configuration=structuredClone(configs.valid.configuration);raw.target=source;
  const request:ConfigurationRequest=raw;
  const reference=new ConfigurationReference();assert.ok(reference.apply(request,boundary,()=>true).ok);const applied=reference.applied!;
  const a=(minimumDeg:number,maximumDeg:number):GimbalAxis=>({minimumDeg,maximumDeg,referenceDeg:0,pulseAtReferenceUs:1500,direction:1,usPerDeg:10,minimumPulseUs:500,maximumPulseUs:2500,maximumVelocityDegPerS:180});
  const calibration:GimbalCalibration={version:'arbi.gimbal-model/1.0',origin:'simulated',configurationDigest:applied.configurationDigest,calibrationRevision:'calibration-1',frameRevision:'gimbal-1',
    pan:a(-90,90),tilt:a(-60,60),safePose:{panDeg:0,tiltDeg:0},settling:{fixtureRecord:'synthetic-settle-42',intervalMs:30,toleranceDeg:0.5}};change?.(calibration);
  let now=0,n=0,motionSequence=1n;const servo=new SyntheticServoAdapter();let alter=(e:MotionStopEvidence)=>{},observe=(o:ServoObservation|null)=>o;
  const gate:CommandGate={realm:request.configuration.realm,siteId:request.configuration.siteId,executionMode:'simulation',authenticatedSource:edge,receiver:source,nowMonotonicMs:0,maxDeadlineAheadMs:1000,
    authorizedActor:{kind:'human',id:'operator-1'},allowedTypes:['camera.gimbal'],supportedTypes:['camera.gimbal'],configRevision:'config-1',faultInhibited:false,
    lease:{id:'lease-1',holderId:'operator-1',fence:'1',receiver:source,expiresMonotonicMs:5000}};
  const adapter:ModelServoAdapter={origin:'simulated',move:r=>servo.move(r),inhibit:()=>servo.inhibit(),observe:n=>observe(servo.observe(n))};
  const options={source,motionSource:pico,motionGeneration:1,applied,boundary,calibration,gate:()=>gate,now:()=>now,servo:adapter,
    motion:()=>{const e:MotionStopEvidence={origin:'simulated',identity:pico,generation:1,sequence:String(motionSequence++),configurationDigest:applied.configurationDigest,calibrationRevision:'calibration-1',stopped:true,sampledMs:now};alter(e);return e;}};
  const model=new GimbalModel(options);
  const reconcile=()=>model.reconcile({origin:'simulated',recordId:'synthetic-known-pose',panDeg:0,tiltDeg:0});
  const command=(panDeg=20,tiltDeg=-10,duration=700)=>{const c:Command=structuredClone(contracts.valid.gimbal);c.source=edge;c.sequence=String(++n);c.messageId=`message-${n}`;
    c.command.commandId=`gimbal-${n}`;c.command.idempotencyKey=`gimbal-key-${n}`;c.command.target=source;c.command.deadline={bootId:source.bootId,sessionId:source.sessionId,expiresMonotonicMs:now+duration};c.command.lease!.fence='1';
    c.body={type:'camera.gimbal',panDeg,tiltDeg,frame:structuredClone(request.configuration.geometry.gimbalFrame),maxDurationMs:duration};return c;};
  return {model,servo,adapter,gate,options,calibration,command,reconcile,clock:(n:number)=>{now=n;},motion:(fn:(e:MotionStopEvidence)=>void)=>{alter=fn;},observation:(fn:(o:ServoObservation|null)=>ServoObservation|null)=>{observe=fn;}};
}
test('calibrated boundaries map to bounded PWM and require a fresh multi-sample settling window',()=>{
  const f=fixture();assert.equal(f.servo.status.moves,0);assert.equal(f.model.status.commandedPose,null);f.reconcile();assert.equal(f.model.status.safeMotionPose,true);
  const c=f.command(90,-60);assert.equal(f.model.move(c).outcome,'running');assert.equal(f.servo.status.last!.panPulseUs,2400);assert.equal(f.servo.status.last!.tiltPulseUs,900);
  assert.equal(f.model.status.safeMotionPose,false);
  assert.equal(f.model.captureEligibility(),false);f.clock(500);assert.equal(f.model.tick().phase,'settling');f.clock(529);assert.equal(f.model.captureEligibility(),false);
  f.clock(530);assert.equal(f.model.captureEligibility(),true);assert.equal(f.model.status.physicalSettlingMeasured,false);assert.equal(f.model.status.physicalCaptureEligible,false);
  const duplicate=f.model.move(c);assert.equal(duplicate.outcome,'completed');duplicate.outcome='failed';assert.equal(f.model.move(c).outcome,'completed');assert.equal(f.servo.status.moves,1);
});
test('wrong limits, frames, calibration, PWM and velocity cannot reach the servo sink',()=>{
  for(const change of [(c:GimbalCalibration)=>{c.pan.maximumDeg=91;},(c:GimbalCalibration)=>{c.pan.direction=0 as 1;},(c:GimbalCalibration)=>{c.tilt.pulseAtReferenceUs=2400;},
    (c:GimbalCalibration)=>{c.pan.referenceDeg=1;},(c:GimbalCalibration)=>{c.frameRevision='old-frame';},(c:GimbalCalibration)=>{c.configurationDigest='0'.repeat(64);},(c:GimbalCalibration)=>{c.settling.intervalMs=0;}])assert.throws(()=>fixture(change));
  for(const angles of [[90.001,0],[-90.001,0],[0,60.001],[NaN,0]]){const f=fixture();f.reconcile();assert.throws(()=>f.model.move(f.command(...angles)));assert.equal(f.servo.status.moves,0);}
  const f=fixture();f.reconcile();const c=f.command();if(c.body.type==='camera.gimbal')c.body.frame.revision='old-frame';assert.throws(()=>f.model.move(c),{code:'FRAME_MISMATCH'});
  assert.throws(()=>f.model.move(f.command(90,0,100)),{code:'VELOCITY_DEADLINE'});assert.equal(f.servo.status.moves,0);
});
test('actual command admission rejects expiry, duplicate conflicts, reordered commands and old receiver epochs',()=>{
  const f=fixture();f.reconcile();const c=f.command();f.model.move(c);const bad=structuredClone(c);if(bad.body.type==='camera.gimbal')bad.body.panDeg=21;
  assert.throws(()=>f.model.move(bad),{code:'IDEMPOTENCY_CONFLICT'});const expired=f.command();expired.command.deadline.expiresMonotonicMs=0;assert.throws(()=>f.model.move(expired));
  const replay=f.command();replay.sequence=c.sequence;assert.throws(()=>f.model.move(replay),{code:'SEQUENCE_REPLAY'});assert.equal(f.servo.status.moves,1);
  const fresh=fixture(undefined,true);fresh.reconcile();assert.throws(()=>fresh.model.move(c),{code:'TARGET_MISMATCH'});assert.equal(fresh.servo.status.moves,0);
});
test('lost, reordered, stale or wrong main-motion evidence inhibits and never sweeps after restart',()=>{
  const changes=[(e:MotionStopEvidence)=>{e.stopped=false;},(e:MotionStopEvidence)=>{e.sampledMs=100;},(e:MotionStopEvidence)=>{e.identity={...e.identity,bootId:'old-pico'};},
    (e:MotionStopEvidence)=>{e.generation=2;},(e:MotionStopEvidence)=>{e.configurationDigest='0'.repeat(64);},(e:MotionStopEvidence)=>{e.sequence='1';}];
  for(const change of changes){const f=fixture();f.reconcile();f.model.move(f.command());f.model.tick();f.motion(change);assert.equal(f.model.tick().phase,'inhibited');assert.equal(f.model.captureEligibility(),false);assert.equal(f.servo.status.moves,1);}
  const f=fixture();assert.throws(()=>f.model.move(f.command()),{code:'GIMBAL_NOT_RECONCILED'});assert.equal(f.servo.status.moves,0);
});
test('missing, repeated, reordered and unstable servo samples cannot manufacture settling',()=>{
  const f=fixture();f.reconcile();f.model.move(f.command());f.clock(200);f.model.tick();f.observation(o=>o?{...o,sampledMs:200}:o);f.clock(250);assert.equal(f.model.captureEligibility(),false);
  f.observation(o=>o?{...o,sampledMs:199}:o);assert.equal(f.model.tick().phase,'inhibited');
  const unstable=fixture();unstable.reconcile();unstable.model.move(unstable.command());unstable.clock(200);unstable.model.tick();unstable.observation(o=>o?{...o,panDeg:o.panDeg+3}:o);
  unstable.clock(240);assert.equal(unstable.model.tick().phase,'moving');unstable.observation(o=>o);unstable.clock(250);unstable.model.tick();unstable.clock(280);assert.equal(unstable.model.captureEligibility(),true);
  const absent=fixture();absent.reconcile();absent.model.move(absent.command());absent.observation(()=>null);assert.equal(absent.model.tick().phase,'inhibited');
});
test('lease loss, stop loss after settling, timeout and clock reversal retain failed outcomes without another move',()=>{
  for(const scenario of ['lease','stop','timeout','clock']){const f=fixture();f.reconcile();const c=f.command();f.model.move(c);
    if(scenario==='lease')f.gate.lease=null;
    if(scenario==='stop'){f.clock(200);f.model.tick();f.clock(230);assert.equal(f.model.captureEligibility(),true);f.motion(e=>{e.stopped=false;});}
    if(scenario==='timeout')f.clock(700);
    if(scenario==='clock'){f.clock(5);f.model.tick();f.clock(4);assert.throws(()=>f.model.tick(),{code:'CLOCK_INVALID'});f.clock(5);}
    assert.equal(f.model.tick().phase,'inhibited');assert.equal(f.model.move(c).outcome,scenario==='stop'?'completed':'failed');assert.equal(f.servo.status.moves,1);assert.equal(f.model.status.commandedPose,null);
  }
});
