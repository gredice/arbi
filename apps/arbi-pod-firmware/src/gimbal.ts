import { admitCommand,checkConfiguredCommand,configurationDigest,createCommandLedger,validateConfigurationRecord } from '@arbi/protocol';
import type { AppliedConfiguration,Command,CommandGate,ConfigurationBoundary,Identity } from '@arbi/protocol';
export interface GimbalAxis {minimumDeg:number;maximumDeg:number;referenceDeg:number;pulseAtReferenceUs:number;direction:1|-1;usPerDeg:number;minimumPulseUs:number;maximumPulseUs:number;maximumVelocityDegPerS:number}
export interface GimbalCalibration {version:'arbi.gimbal-model/1.0';origin:'simulated';configurationDigest:string;calibrationRevision:string;frameRevision:string;
  pan:GimbalAxis;tilt:GimbalAxis;safePose:{panDeg:number;tiltDeg:number};settling:{fixtureRecord:string;intervalMs:number;toleranceDeg:number}}
export interface MotionStopEvidence {origin:'simulated';identity:Identity;generation:number;sequence:string;configurationDigest:string;calibrationRevision:string;stopped:boolean;sampledMs:number}
export interface ServoRequest {commandId:string;panDeg:number;tiltDeg:number;panPulseUs:number;tiltPulseUs:number;startedMs:number;durationMs:number}
export interface ServoObservation {origin:'simulated';commandId:string;panDeg:number;tiltDeg:number;sampledMs:number}
export interface ModelServoAdapter {readonly origin:'simulated'|'unavailable';move(request:ServoRequest):void;observe(nowMs:number):ServoObservation|null;inhibit():void}
export class GimbalError extends Error {constructor(readonly code:string){super(code);}}
function reject(code:string):never {throw new GimbalError(code);}
const same=(a:unknown,b:unknown)=>configurationDigest(a)===configurationDigest(b);
const finite=(v:number)=>typeof v==='number'&&Number.isFinite(v);
const id=(v:string)=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/u.test(v);
const fields=(v:unknown,names:string[])=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join()!==[...names].sort().join())reject('INVALID_EVIDENCE');};
const pulse=(a:GimbalAxis,angle:number)=>a.pulseAtReferenceUs+a.direction*(angle-a.referenceDeg)*a.usPerDeg;
function axis(a:GimbalAxis,limits:{min:number;max:number},zero:number) {
  fields(a,['minimumDeg','maximumDeg','referenceDeg','pulseAtReferenceUs','direction','usPerDeg','minimumPulseUs','maximumPulseUs','maximumVelocityDegPerS']);
  if(!Object.values(a).every(finite)||![1,-1].includes(a.direction)||a.minimumDeg<limits.min||a.maximumDeg>limits.max||a.minimumDeg>=a.maximumDeg
    ||a.referenceDeg!==zero||zero<a.minimumDeg||zero>a.maximumDeg||a.usPerDeg<=0||a.usPerDeg>100||a.minimumPulseUs<500||a.maximumPulseUs>2500
    ||a.minimumPulseUs>=a.maximumPulseUs||a.maximumVelocityDegPerS<=0||a.maximumVelocityDegPerS>180
    ||[a.minimumDeg,a.maximumDeg].some(v=>pulse(a,v)<a.minimumPulseUs||pulse(a,v)>a.maximumPulseUs))reject('INVALID_CALIBRATION');
}
/** Trusted isolated composition only; ordinary runtime has unavailable servos.
 * No physical positioning, measured settling or hardware Ready is asserted. */
export class GimbalModel {
  #applied:AppliedConfiguration;#boundary:ConfigurationBoundary;#calibration:GimbalCalibration;#ledger=createCommandLedger(128);
  #phase:'unknown'|'idle'|'moving'|'settling'|'settled'|'inhibited'='unknown';#pose:{panDeg:number;tiltDeg:number}|null=null;
  #active:{command:Command;request:ServoRequest;deadline:number;withinSince:number|null;lastSample:number|null}|null=null;#authorized:Command|null=null;
  #outcomes=new Map<string,{outcome:'running'|'completed'|'failed';reason:string|null}>();#lastMs=0;#motionSequence=0n;#reason:string|null=null;
  constructor(readonly options:{applied:AppliedConfiguration;boundary:ConfigurationBoundary;calibration:GimbalCalibration;source:Identity;motionSource:Identity;motionGeneration:number;
    gate:()=>CommandGate;motion:()=>MotionStopEvidence|null;now:()=>number;servo:ModelServoAdapter}) {
    const v=validateConfigurationRecord(options.applied,'applied');if(!v.ok)reject(v.error.code);this.#applied=structuredClone(options.applied);this.#boundary=structuredClone(options.boundary);this.#calibration=structuredClone(options.calibration);
    const c=this.#applied.request.configuration,k=this.#calibration;
    fields(k,['version','origin','configurationDigest','calibrationRevision','frameRevision','pan','tilt','safePose','settling']);fields(k.safePose,['panDeg','tiltDeg']);fields(k.settling,['fixtureRecord','intervalMs','toleranceDeg']);
    if(c.realm.environment!=='test'||c.executionMode!=='simulation'||c.calibration?.scope!=='simulation'||k.version!=='arbi.gimbal-model/1.0'||k.origin!=='simulated'
      ||k.configurationDigest!==this.#applied.configurationDigest||k.calibrationRevision!==c.calibration.revision||k.frameRevision!==c.geometry.gimbalFrame.revision
      ||!same(options.source,options.boundary.receiver)||!same(options.source,this.#applied.appliedBy)||!Number.isSafeInteger(options.motionGeneration)||options.motionGeneration<1
      ||!id(k.settling.fixtureRecord)||!Number.isSafeInteger(k.settling.intervalMs)||k.settling.intervalMs<1||k.settling.intervalMs>500
      ||!finite(k.settling.toleranceDeg)||k.settling.toleranceDeg<=0||k.settling.toleranceDeg>2)reject('INCOMPATIBLE_CALIBRATION');
    axis(k.pan,c.limits.panDeg,c.calibration.gimbalZeroDeg.pan);axis(k.tilt,c.limits.tiltDeg,c.calibration.gimbalZeroDeg.tilt);this.#angles(k.safePose.panDeg,k.safePose.tiltDeg);
    options.source=structuredClone(options.source);options.motionSource=structuredClone(options.motionSource);options.servo.inhibit();
  }
  #clock(){const n=this.options.now();if(!Number.isSafeInteger(n)||n<0||n<this.#lastMs){this.inhibit('CLOCK_INVALID');reject('CLOCK_INVALID');}this.#lastMs=n;return n;}
  #gate(){try{return this.options.gate();}catch{this.inhibit('AUTHORITY_UNAVAILABLE');reject('AUTHORITY_UNAVAILABLE');}}
  #angles(pan:number,tilt:number){if(!finite(pan)||!finite(tilt)||pan<this.#calibration.pan.minimumDeg||pan>this.#calibration.pan.maximumDeg||tilt<this.#calibration.tilt.minimumDeg||tilt>this.#calibration.tilt.maximumDeg)reject('OUTSIDE_LIMITS');}
  #stopped(now:number,allowMoving=false){let e:MotionStopEvidence|null;try{e=this.options.motion();}catch{reject('MOTION_STOP_UNAVAILABLE');}if(!e)reject('MOTION_STOP_UNAVAILABLE');fields(e,['origin','identity','generation','sequence','configurationDigest','calibrationRevision','stopped','sampledMs']);
    fields(e.identity,['deviceId','bootId','sessionId']);
    if(e.origin!=='simulated'||!same(e.identity,this.options.motionSource)||e.generation!==this.options.motionGeneration||e.configurationDigest!==this.#applied.configurationDigest
      ||e.calibrationRevision!==this.#calibration.calibrationRevision||typeof e.stopped!=='boolean'||!Number.isSafeInteger(e.sampledMs)||e.sampledMs>now||now-e.sampledMs>=100
      ||typeof e.sequence!=='string'||!/^[1-9][0-9]{0,19}$/u.test(e.sequence)||BigInt(e.sequence)>18446744073709551615n||BigInt(e.sequence)<this.#motionSequence)reject('MOTION_STOP_STALE');
    this.#motionSequence=BigInt(e.sequence);if(!allowMoving&&!e.stopped)reject('MAIN_MOTION_ACTIVE');return e;
  }
  reconcile(fixture:{origin:'simulated';recordId:string;panDeg:number;tiltDeg:number}) {
    if(this.#active)reject('GIMBAL_BUSY');fields(fixture,['origin','recordId','panDeg','tiltDeg']);if(fixture.origin!=='simulated'||!id(fixture.recordId))reject('SIMULATION_REQUIRED');
    this.#stopped(this.#clock());this.#angles(fixture.panDeg,fixture.tiltDeg);this.#pose={panDeg:fixture.panDeg,tiltDeg:fixture.tiltDeg};this.#phase='idle';this.#reason=null;
  }
  move(input:unknown) {
    const now=this.#clock(),gate=this.#gate();if(gate.executionMode!=='simulation'||!same(gate.receiver,this.options.source)||gate.configRevision!==this.#applied.request.configuration.revision)reject('GATE_MISMATCH');
    const valid=checkConfiguredCommand(input,this.#applied,this.#boundary);if(!valid.ok)reject(valid.error.code);if(valid.value.body.type!=='camera.gimbal')reject('UNSUPPORTED_CAPABILITY');
    const admitted=admitCommand(input,{...gate,nowMonotonicMs:now,maxDeadlineAheadMs:1000},this.#ledger);if(!admitted.ok)reject(admitted.error.code);
    const c=admitted.value.command;if(admitted.value.decision==='duplicate')return structuredClone(this.#outcomes.get(c.command.commandId)??{outcome:'failed',reason:'ADMISSION_UNCERTAIN'});
    try {
      this.#stopped(now);if(this.#active||!this.#pose||this.#phase==='inhibited'||this.#phase==='unknown')reject('GIMBAL_NOT_RECONCILED');
      if(this.options.servo.origin!=='simulated')reject('SERVO_UNAVAILABLE');const b=valid.value.body;if(b.type!=='camera.gimbal')reject('UNSUPPORTED_CAPABILITY');this.#angles(b.panDeg,b.tiltDeg);
      const durationMs=Math.ceil(1000*Math.max(Math.abs(b.panDeg-this.#pose.panDeg)/this.#calibration.pan.maximumVelocityDegPerS,Math.abs(b.tiltDeg-this.#pose.tiltDeg)/this.#calibration.tilt.maximumVelocityDegPerS));
      if(durationMs+this.#calibration.settling.intervalMs>b.maxDurationMs)reject('VELOCITY_DEADLINE');
      const request:ServoRequest={commandId:c.command.commandId,panDeg:b.panDeg,tiltDeg:b.tiltDeg,panPulseUs:pulse(this.#calibration.pan,b.panDeg),tiltPulseUs:pulse(this.#calibration.tilt,b.tiltDeg),startedMs:now,durationMs};
      this.#active={command:structuredClone(c),request,deadline:now+b.maxDurationMs,withinSince:null,lastSample:null};this.#authorized=structuredClone(c);this.#phase='moving';this.#outcomes.set(c.command.commandId,{outcome:'running',reason:null});
      this.options.servo.move(request);return {outcome:'running' as const,reason:null};
    } catch(e){const reason=e instanceof GimbalError?e.code:'SERVO_FAILED';this.#outcomes.set(c.command.commandId,{outcome:'failed',reason});if(this.#active?.command.command.commandId===c.command.commandId)this.inhibit(reason);throw new GimbalError(reason);}
  }
  tick(){const now=this.#clock();let motion:MotionStopEvidence;try{motion=this.#stopped(now,true);}catch{this.inhibit('MOTION_STOP_STALE');return this.status;}const a=this.#active,c=this.#authorized;
    let gate:CommandGate;try{gate=this.#gate();}catch{return this.status;}if(c&&(!gate.lease||gate.lease.expiresMonotonicMs<=now||gate.lease.id!==c.command.lease?.id||gate.lease.fence!==c.command.lease?.fence
      ||gate.executionMode!=='simulation'||!same(gate.realm,c.realm)||gate.siteId!==c.siteId||gate.configRevision!==c.command.configRevision||gate.faultInhibited
      ||!same(gate.receiver,this.options.source)||!same(gate.authenticatedSource,c.source)||!same(gate.authorizedActor,c.command.actor)||!gate.allowedTypes.includes('camera.gimbal')||!gate.supportedTypes.includes('camera.gimbal'))){this.inhibit('AUTHORITY_LOST');return this.status;}
    if(!motion.stopped){if(!a&&this.status.safeMotionPose){this.#phase='idle';return this.status;}this.inhibit('MAIN_MOTION_ACTIVE');return this.status;}
    if(!a)return this.status;
    if(now>=a.deadline){this.inhibit('GIMBAL_TIMEOUT');return this.status;}
    let o:ServoObservation|null;try{o=this.options.servo.observe(now);}catch{this.inhibit('SERVO_FAILED');return this.status;}
    if(!o||o.origin!=='simulated'||o.commandId!==a.request.commandId||!finite(o.panDeg)||!finite(o.tiltDeg)||!Number.isSafeInteger(o.sampledMs)||o.sampledMs>now||now-o.sampledMs>=100){this.inhibit('SERVO_OBSERVATION_UNAVAILABLE');return this.status;}
    try{fields(o,['origin','commandId','panDeg','tiltDeg','sampledMs']);}catch{this.inhibit('SERVO_OBSERVATION_UNAVAILABLE');return this.status;}
    if(a.lastSample!==null&&o.sampledMs<a.lastSample){this.inhibit('SERVO_OBSERVATION_REORDERED');return this.status;}
    if(o.sampledMs===a.lastSample)return this.status;a.lastSample=o.sampledMs;
    if(now<a.request.startedMs+a.request.durationMs)return this.status;
    const within=Math.abs(o.panDeg-a.request.panDeg)<=this.#calibration.settling.toleranceDeg&&Math.abs(o.tiltDeg-a.request.tiltDeg)<=this.#calibration.settling.toleranceDeg;
    if(!within){a.withinSince=null;this.#phase='moving';return this.status;}
    this.#phase='settling';a.withinSince??=o.sampledMs;
    if(o.sampledMs-a.withinSince>=this.#calibration.settling.intervalMs){this.#pose={panDeg:o.panDeg,tiltDeg:o.tiltDeg};this.#phase='settled';this.#outcomes.set(a.command.command.commandId,{outcome:'completed',reason:null});this.#active=null;}
    return this.status;
  }
  inhibit(reason='LOCAL_INHIBIT'){if(this.#active)this.#outcomes.set(this.#active.command.command.commandId,{outcome:'failed',reason});this.#active=null;this.#authorized=null;this.#pose=null;this.#phase='inhibited';this.#reason=reason;this.options.servo.inhibit();}
  get status(){return {origin:'simulated' as const,phase:this.#phase,commandedPose:this.#pose?{...this.#pose}:null,quality:this.#pose?'commanded':'unavailable',reason:this.#reason,
    safeMotionPose:this.#active===null&&this.#pose!==null&&Math.abs(this.#pose.panDeg-this.#calibration.safePose.panDeg)<=this.#calibration.settling.toleranceDeg&&Math.abs(this.#pose.tiltDeg-this.#calibration.safePose.tiltDeg)<=this.#calibration.settling.toleranceDeg,
    simulatedCaptureEligible:this.#phase==='settled',physicalCaptureEligible:false,physicalSettlingMeasured:false,configurationDigest:this.#applied.configurationDigest,calibrationRevision:this.#calibration.calibrationRevision};}
  captureEligibility(){this.tick();return this.status.simulatedCaptureEligible;}
}
/** Deterministic angle/PWM sink, with no device path or electrical callback. */
export class SyntheticServoAdapter implements ModelServoAdapter {
  readonly origin='simulated' as const;#request:ServoRequest|null=null;#moves=0;
  move(request:ServoRequest){this.#request=structuredClone(request);this.#moves++;}
  observe(nowMs:number):ServoObservation|null{const r=this.#request;return r?{origin:'simulated',commandId:r.commandId,panDeg:r.panDeg,tiltDeg:r.tiltDeg,sampledMs:nowMs}:null;}
  inhibit(){this.#request=null;}
  get status(){return {moves:this.#moves,last:this.#request?structuredClone(this.#request):null,physicalOutputs:false};}
}
