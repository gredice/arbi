import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { admitCommand,checkConfiguredCommand,configurationDigest,createCommandLedger,validateConfigurationRecord } from '@arbi/protocol';
import type { AppliedConfiguration,Command,CommandGate,ConfigurationBoundary,VectorMm } from '@arbi/protocol';
import { CaptureError,CaptureStore } from './capture-store.js';
import type { CaptureRecord } from './capture-store.js';
import type { CaptureCameraAdapter,CaptureProfile,FocusResult } from './capture-camera.js';
import type { GimbalModel } from './gimbal.js';
import { GimbalError } from './gimbal.js';
export interface CaptureClock {monotonicMs:number;utcMs:number|null;uncertaintyMs:number|null}
export interface CaptureContext {jobId:string;targetId:string;requestedPoseMm:VectorMm|null;availablePose:{origin:'simulated'|'unavailable';quality:'estimated'|'unavailable';positionMm:VectorMm|null;sampleMonotonicMs:number|null;uncertaintyMm:number|null}}
const id=(v:string)=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/u.test(v);
const same=(a:unknown,b:unknown)=>configurationDigest(a)===configurationDigest(b);
const semantic=(c:Command)=>({protocol:c.protocol,realm:c.realm,executionMode:c.executionMode,siteId:c.siteId,source:c.source,command:c.command,body:c.body});
function reject(code:string):never {throw new CaptureError(code);}
const fields=(v:unknown,n:string[])=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join()!==[...n].sort().join())reject('INVALID_CAPTURE_INPUT');};
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const cameraOwners=new WeakSet<CaptureCameraAdapter>();
/** Source-only camera sequence. Real camera/GPIO, upload, rectification and
 * media authorization are separate owners and are unavailable here. */
export class CaptureSequencer {
  #applied:AppliedConfiguration;#profile:CaptureProfile;#boundary:ConfigurationBoundary;#ledger=createCommandLedger(128);#active=false;#preview=false;#lastMs=0;#wallDeadline:number|null=null;#closed=false;
  constructor(readonly options:{applied:AppliedConfiguration;boundary:ConfigurationBoundary;profile:CaptureProfile;store:CaptureStore;gimbal:GimbalModel;camera:CaptureCameraAdapter;
    gate:()=>CommandGate;clock:()=>CaptureClock;wait:(ms:number)=>Promise<void>;context:()=>CaptureContext;build:{version:string;sha:string;dirty:boolean};stepTimeoutMs?:number}) {
    const v=validateConfigurationRecord(options.applied,'applied');if(!v.ok)reject(v.error.code);this.#applied=structuredClone(options.applied);this.#boundary=structuredClone(options.boundary);this.#profile=structuredClone(options.profile);
    const c=this.#applied.request.configuration,p=this.#profile;
    fields(p,['version','origin','id','revision','configurationDigest','calibrationRevision','widthPx','heightPx','exposureTimeUs','analogueGain','focusMode','lensRange','preview']);fields(p.lensRange,['minimum','maximum']);
    if(c.realm.environment!=='test'||c.executionMode!=='simulation'||c.calibration?.scope!=='simulation'||options.camera.origin!=='simulated'||p.version!=='arbi.capture-profile/1.0'||p.origin!=='simulated'
      ||!id(p.id)||!id(p.revision)||p.configurationDigest!==this.#applied.configurationDigest||p.calibrationRevision!==c.calibration.revision
      ||![p.widthPx,p.heightPx].every(n=>Number.isSafeInteger(n)&&n>=1&&n<=512)||!Number.isSafeInteger(p.exposureTimeUs)||p.exposureTimeUs<1||p.exposureTimeUs>1000000
      ||!Number.isFinite(p.analogueGain)||p.analogueGain<1||p.analogueGain>16||p.focusMode!=='single'||typeof p.preview!=='boolean'
      ||!Number.isFinite(p.lensRange.minimum)||!Number.isFinite(p.lensRange.maximum)||p.lensRange.minimum<0||p.lensRange.maximum>32||p.lensRange.minimum>=p.lensRange.maximum
      ||options.store.bindingDigest!==configurationDigest({realm:c.realm,siteId:c.siteId,deviceId:this.#applied.appliedBy.deviceId})
      ||options.gimbal.status.configurationDigest!==this.#applied.configurationDigest||options.gimbal.status.calibrationRevision!==p.calibrationRevision||!same(options.gimbal.options.source,this.#applied.appliedBy)
      ||!id(options.build.version)||!/^[a-f0-9]{40}$/u.test(options.build.sha)||typeof options.build.dirty!=='boolean'
      ||!Number.isSafeInteger(options.stepTimeoutMs??500)||(options.stepTimeoutMs??500)<1||(options.stepTimeoutMs??500)>1000)reject('CAPTURE_PROFILE_INCOMPATIBLE');
    if(cameraOwners.has(options.camera))reject('CAMERA_OWNER_EXISTS');cameraOwners.add(options.camera);
  }
  close(){if(this.#closed)return;if(this.#active||this.#preview)reject('CAMERA_BUSY');this.#closed=true;cameraOwners.delete(this.options.camera);}
  get status(){return {captureActive:this.#active,previewReserved:this.#preview,closed:this.#closed,physicalCamera:false};}
  #clock(){const c=this.options.clock();fields(c,['monotonicMs','utcMs','uncertaintyMs']);if(!Number.isSafeInteger(c.monotonicMs)||c.monotonicMs<0||c.monotonicMs<this.#lastMs
      ||!(c.utcMs===null||Number.isSafeInteger(c.utcMs)&&Math.abs(c.utcMs)<=8640000000000000)||!(c.uncertaintyMs===null||Number.isSafeInteger(c.uncertaintyMs)&&c.uncertaintyMs>=0&&c.uncertaintyMs<=60000)||((c.utcMs===null)!==(c.uncertaintyMs===null)))reject('CLOCK_INVALID');this.#lastMs=c.monotonicMs;return c;}
  #authority(c:Command){if(this.#closed)reject('CAMERA_CLOSED');const now=this.#clock().monotonicMs,g=this.options.gate(),lease=c.command.lease;
    if(g.executionMode!=='simulation'||!same(g.realm,c.realm)||g.siteId!==c.siteId||!same(g.authenticatedSource,c.source)||!same(g.receiver,c.command.target)||!same(g.authorizedActor,c.command.actor)
      ||!g.allowedTypes.includes('camera.capture')||!g.supportedTypes.includes('camera.capture')||g.configRevision!==c.command.configRevision||g.faultInhibited
      ||!lease||!g.lease||g.lease.id!==lease.id||g.lease.holderId!==c.command.actor.id||g.lease.fence!==lease.fence||g.lease.expiresMonotonicMs<=now||c.command.deadline.expiresMonotonicMs>g.lease.expiresMonotonicMs)reject('CAPTURE_AUTHORITY_LOST');
    if(now>=c.command.deadline.expiresMonotonicMs||this.#wallDeadline!==null&&performance.now()>=this.#wallDeadline)reject('CAPTURE_TIMEOUT');return now;
  }
  async #step<T>(c:Command,phase:string,work:(signal:AbortSignal)=>Promise<T>):Promise<T>{this.#authority(c);if(!this.options.gimbal.captureEligibility())reject('CAPTURE_NOT_SETTLED');this.options.store.phase(c.command.commandId,phase);
    const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
    try{const value=await Promise.race([Promise.resolve().then(()=>work(controller.signal)),new Promise<never>((_,bad)=>{timer=setTimeout(()=>{controller.abort();bad(new CaptureError('CAMERA_STEP_TIMEOUT'));},this.options.stepTimeoutMs??500);})]);
      this.#authority(c);if(!this.options.gimbal.captureEligibility())reject('CAPTURE_MOTION_INTERRUPTED');return value;
    } finally{if(timer)clearTimeout(timer);controller.abort();}}
  acquirePreview(){if(this.#closed)reject('CAMERA_CLOSED');if(this.#active||this.#preview)reject('CAMERA_BUSY');this.#preview=true;let released=false;return ()=>{if(!released){released=true;this.#preview=false;}};}
  async capture(captureInput:unknown,gimbalInput:unknown):Promise<CaptureRecord>{
    if(this.#closed)reject('CAMERA_CLOSED');
    const now=this.#clock().monotonicMs,gate=this.options.gate(),checked=checkConfiguredCommand(captureInput,this.#applied,this.#boundary);if(!checked.ok)reject(checked.error.code);const c=checked.value;
    if(c.body.type!=='camera.capture')reject('UNSUPPORTED_CAPABILITY');const gimbal=checkConfiguredCommand(gimbalInput,this.#applied,this.#boundary);if(!gimbal.ok)reject(gimbal.error.code);
    if(gimbal.value.body.type!=='camera.gimbal'||gimbal.value.command.correlationId!==c.command.correlationId||!same(gimbal.value.command.actor,c.command.actor)||!same(gimbal.value.source,c.source)||!same(gimbal.value.command.lease,c.command.lease))reject('CAPTURE_SEQUENCE_MISMATCH');
    const admitted=admitCommand(captureInput,{...gate,nowMonotonicMs:now,maxDeadlineAheadMs:3000},this.#ledger);if(!admitted.ok)reject(admitted.error.code);
    const fingerprint=configurationDigest({capture:semantic(c),gimbal:semantic(gimbal.value),profile:this.#profile});const previous=this.options.store.get(c.command.commandId);
    if(previous){if(previous.fingerprint!==fingerprint)reject('IDEMPOTENCY_CONFLICT');this.#authority(c);if(previous.state==='captured')this.options.store.readImage(previous);return previous;}
    if(admitted.value.decision==='duplicate')reject('CAPTURE_RECEIPT_MISSING');this.#authority(c);
    this.options.store.reserve({commandId:c.command.commandId,correlationId:c.command.correlationId,resourceId:c.body.resourceId,fingerprint});
    if(this.#active||this.#preview)return this.options.store.fail(c.command.commandId,'CAMERA_BUSY');this.#active=true;this.#wallDeadline=performance.now()+Math.min(c.command.deadline.expiresMonotonicMs-now,c.body.maxDurationMs);
    let phase='gimbal';
    try {
      this.options.store.phase(c.command.commandId,phase);this.options.gimbal.move(gimbal.value);
      phase='settling';this.options.store.phase(c.command.commandId,phase);
      while(!this.options.gimbal.captureEligibility()) {this.#authority(c);if(this.options.gimbal.status.phase==='inhibited')reject('CAPTURE_MOTION_INTERRUPTED');
        // A wall-clock bound also covers a broken trusted scheduler callback.
        const before=this.#clock().monotonicMs;let timer:ReturnType<typeof setTimeout>|undefined;
        try{await Promise.race([this.options.wait(10),new Promise<never>((_,bad)=>{timer=setTimeout(()=>bad(new CaptureError('SETTLING_WAIT_TIMEOUT')),1000);})]);}
        finally{if(timer)clearTimeout(timer);}if(this.#clock().monotonicMs<=before)reject('CLOCK_NOT_ADVANCING');}
      phase='camera-initialize';const initialized=await this.#step(c,phase,s=>this.options.camera.initialize(s));fields(initialized,['origin','ready','revision']);
      if(initialized.origin!=='simulated'||initialized.ready!==true||!id(initialized.revision))reject('CAMERA_UNAVAILABLE');
      phase='profile';await this.#step(c,phase,s=>this.options.camera.apply(this.#profile,s));
      phase='focus';const focus:FocusResult=await this.#step(c,phase,s=>this.options.camera.autofocus(s));fields(focus,['origin','status','score','lensPosition','algorithmRevision']);
      if(focus.origin!=='simulated'||focus.status!=='focused'||!id(focus.algorithmRevision)||!(focus.score===null||Number.isFinite(focus.score)&&focus.score>=0)
        ||focus.lensPosition===null||!Number.isFinite(focus.lensPosition)||focus.lensPosition<this.#profile.lensRange.minimum||focus.lensPosition>this.#profile.lensRange.maximum)reject('FOCUS_FAILED');
      let preview:null|{sha256:string;bytes:number;origin:'simulated'}=null;
      if(this.#profile.preview){phase='preview';const p=await this.#step(c,phase,s=>this.options.camera.preview(s));if(p.origin!=='simulated'||!Buffer.isBuffer(p.bytes)||p.bytes.length>8388608)reject('PREVIEW_FAILED');preview={sha256:sha(p.bytes),bytes:p.bytes.length,origin:'simulated'};}
      phase='capture';const image=await this.#step(c,phase,s=>this.options.camera.still(s));if(image.origin!=='simulated'||image.contentType!=='image/png'||image.widthPx!==this.#profile.widthPx||image.heightPx!==this.#profile.heightPx)reject('CAMERA_FAILED');
      const context=this.options.context();fields(context,['jobId','targetId','requestedPoseMm','availablePose']);fields(context.availablePose,['origin','quality','positionMm','sampleMonotonicMs','uncertaintyMm']);
      if(!id(context.jobId)||!id(context.targetId)||context.jobId!==c.command.correlationId||context.targetId!==c.body.resourceId||!(context.availablePose.origin==='unavailable'&&context.availablePose.quality==='unavailable'&&context.availablePose.positionMm===null&&context.availablePose.sampleMonotonicMs===null&&context.availablePose.uncertaintyMm===null
        ||context.availablePose.origin==='simulated'&&context.availablePose.quality==='estimated'&&context.availablePose.positionMm!==null&&Number.isSafeInteger(context.availablePose.sampleMonotonicMs)&&context.availablePose.sampleMonotonicMs!>=0&&context.availablePose.sampleMonotonicMs!<=this.#clock().monotonicMs
          &&context.availablePose.uncertaintyMm!==null&&Number.isFinite(context.availablePose.uncertaintyMm)&&context.availablePose.uncertaintyMm>=0&&context.availablePose.uncertaintyMm<=1000000))reject('INVALID_CAPTURE_CONTEXT');
      for(const point of [context.requestedPoseMm,context.availablePose.positionMm])if(point!==null){fields(point,['x','y','z']);if(!Object.values(point).every(n=>Number.isFinite(n)&&Math.abs(n)<=1000000))reject('INVALID_CAPTURE_CONTEXT');}
      this.#authority(c);if(!this.options.gimbal.captureEligibility())reject('CAPTURE_MOTION_INTERRUPTED');const clock=this.#clock(),configuration=this.#applied.request.configuration;
      const poseAge=context.availablePose.sampleMonotonicMs===null?null:clock.monotonicMs-context.availablePose.sampleMonotonicMs;
      const metadata={version:'arbi.raw-capture/1.0',origin:'simulated',request:{messageId:c.messageId,sequence:c.sequence,commandId:c.command.commandId,correlationId:c.command.correlationId,idempotencyKey:c.command.idempotencyKey,source:c.source,actor:c.command.actor,deadline:c.command.deadline,lease:c.command.lease},
        source:c.command.target,realm:c.realm,siteId:c.siteId,resourceId:c.body.resourceId,jobId:context.jobId,targetId:context.targetId,
        capturedAt:{monotonicMs:clock.monotonicMs,utc:clock.utcMs===null?null:new Date(clock.utcMs).toISOString(),uncertaintyMs:clock.uncertaintyMs,clockQuality:clock.utcMs===null?'utc-unavailable':'bounded-utc'},
        requestedPose:{positionMm:context.requestedPoseMm,frame:configuration.geometry.siteFrame,units:'mm'},availablePose:{...context.availablePose,quality:poseAge!==null&&poseAge>=1000?'stale':context.availablePose.quality,originQuality:context.availablePose.quality==='estimated'?'estimated':null,ageMs:poseAge,frame:configuration.geometry.siteFrame,units:'mm'},
        gimbal:{...this.options.gimbal.status,frame:configuration.geometry.gimbalFrame,commandId:gimbal.value.command.commandId},camera:initialized,focus,preview,profile:this.#profile,build:structuredClone(this.options.build),
        configuration:{revision:configuration.revision,digest:this.#applied.configurationDigest,calibrationRevision:this.#profile.calibrationRevision,geometryRevision:configuration.geometry.revision},
        processing:{state:'not-processed',derivedIds:[]},upload:{state:'not-uploaded'},physicalCamera:false};
      phase='write';return this.options.store.publish(c.command.commandId,image.bytes,image.widthPx,image.heightPx,metadata);
    } catch(e){if(e instanceof Error&&e.message==='SIMULATED_PROCESS_CUT')throw e;
      const reason=e instanceof CaptureError?e.code:e instanceof GimbalError?'GIMBAL_FAILED':phase==='focus'?'FOCUS_FAILED':phase==='write'?'CAPTURE_STORAGE_FAILED':'CAMERA_FAILED';return this.options.store.fail(c.command.commandId,reason);
    } finally{this.#active=false;this.#wallDeadline=null;}
  }
}
