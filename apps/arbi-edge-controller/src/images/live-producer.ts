import { performance } from 'node:perf_hooks';
import { DatabaseSync } from 'node:sqlite';
import { lstatSync,openSync,closeSync } from 'node:fs';
import { dirname } from 'node:path';
import { canonical } from '@arbi/audit';
import type { Identity,Realm } from '@arbi/protocol';
import { validateLiveProducerDemand,type LiveProducerDemand } from '@arbi/protocol/live-demand';
import { transferFail,transferIdentity,payloadDigest } from '@arbi/protocol/capture-transfer';
import { UpdateSecurityJournal,fields } from '../updates/journal.js';
import type { CapturePreview } from './preview.js';
import { TransferError } from '../transfers/budget.js';

export interface LiveFrameReceipt {frameId:string;sha256:string;acceptedPayloadBytes:number}
export interface LiveProducerHook {id:string;producerId:string;generation:string;event:'leased'|'frame'|'stopped';reason:string|null;
  frameId:string|null;encodedBytes:number|null;acceptedPayloadBytes:number|null;boundary:'isolated-producer-uplink';layer:'application-payload';coverage:'partial';physicalMedia:false}
interface ProducerRecord {demand:LiveProducerDemand;previewGeneration:number;sequence:number;event:'leased'|'frame'|'stopped';reason:string|null;receipt:LiveFrameReceipt|null;encodedBytes:number|null}
/** Explicit private native frame reference. Backend demand retains authority;
 * CapturePreview owns the camera/budget. No listener or production transport. */
export class IsolatedLiveProducer {
  readonly #journal:UpdateSecurityJournal;readonly #owner:DatabaseSync;
  #current:ProducerRecord|null=null;#deadline=0;#busy=false;#closed=false;#bootFence:string|null=null;#lastFrameAt=-Infinity;#leaseAt=0;#quarantined=false;#sendAbort:AbortController|null=null;
  readonly #timer:ReturnType<typeof setInterval>;
  constructor(readonly options:{path:string;realm:Realm;siteId:string;source:Identity;preview:CapturePreview;nowUtcMs:()=>number;
    health:()=>{ready:boolean;resourceAvailable:boolean;stillCapturePending:boolean;updateInhibited:boolean};
    send:(frame:{demand:LiveProducerDemand;id:string;sha256:string;bytes:Uint8Array},signal:AbortSignal)=>Promise<LiveFrameReceipt>;
    append:(event:LiveProducerHook)=>void;framesPerSecond:number;sendTimeoutMs:number}){
    transferIdentity(options.source);
    if(options.realm.environment!=='test'||!Number.isInteger(options.framesPerSecond)||options.framesPerSecond<1||options.framesPerSecond>5||!Number.isInteger(options.sendTimeoutMs)||options.sendTimeoutMs<10||options.sendTimeoutMs>1000)transferFail('LIVE_REFERENCE_REQUIRED');
    this.options=Object.freeze({...options,realm:Object.freeze(structuredClone(options.realm)),source:Object.freeze(structuredClone(options.source))});
    const parent=lstatSync(dirname(options.path));if(!parent.isDirectory()||(parent.mode&0o077))transferFail('LIVE_PRIVATE_OWNER_REQUIRED');
    const path=options.path+'.owner',old=lstatSync(path,{throwIfNoEntry:false});
    if(old&&(!old.isFile()||old.nlink!==1||(old.mode&0o077)))transferFail('LIVE_PRIVATE_OWNER_REQUIRED');
    if(!old){const fd=openSync(path,'wx',0o600);closeSync(fd);}
    this.#owner=new DatabaseSync(path,{timeout:0});
    try{this.#owner.exec('PRAGMA max_page_count=8;CREATE TABLE IF NOT EXISTS owner(id INTEGER PRIMARY KEY);BEGIN EXCLUSIVE');}
    catch{this.#owner.close();transferFail('LIVE_PRODUCER_BUSY');}
    try{this.#journal=new UpdateSecurityJournal(options.path,[options.realm,options.siteId,options.source.deviceId,'arbi.isolated-live-producer/1.0']);}
    catch(e){this.#owner.close();throw e;}
    try{const last=this.#records().at(-1);this.#bootFence=last?.demand.generation??null;this.#current=last?{...last,event:'stopped',reason:'source-restarted'}:null;options.preview.stop();}
    catch(e){this.#journal.close();this.#owner.close();throw e;}
    this.#timer=setInterval(()=>{try{this.tick();}catch{/* Local camera stop precedes durable evidence. */}},100);this.#timer.unref();
  }
  #records():ProducerRecord[]{return this.#journal.verify().map(input=>{
    fields(input,['demand','previewGeneration','sequence','event','reason','receipt','encodedBytes']);const r=input as unknown as ProducerRecord;validateLiveProducerDemand(r.demand);
    if(!Number.isInteger(r.previewGeneration)||r.previewGeneration<1||r.previewGeneration>32||!Number.isInteger(r.sequence)||r.sequence<0||r.sequence>128||!['leased','frame','stopped'].includes(r.event)||r.reason!==null&&(typeof r.reason!=='string'||r.reason.length>64))transferFail('LIVE_RECORD_INVALID');
    if(canonical(r.demand.realm)!==canonical(this.options.realm)||r.demand.siteId!==this.options.siteId||r.demand.target.deviceId!==this.options.source.deviceId)transferFail('LIVE_RECORD_INVALID');
    if(r.receipt){fields(r.receipt,['frameId','sha256','acceptedPayloadBytes']);if(r.event!=='frame'||r.receipt.frameId!==r.demand.id+':'+r.demand.generation+':'+r.sequence||!(/^[a-f0-9]{64}$/).test(r.receipt.sha256)||!Number.isSafeInteger(r.receipt.acceptedPayloadBytes)||r.receipt.acceptedPayloadBytes<0||!Number.isSafeInteger(r.encodedBytes)||r.encodedBytes!<1||r.encodedBytes!>65536||r.receipt.acceptedPayloadBytes>r.encodedBytes!)transferFail('LIVE_RECORD_INVALID');}
    else if(r.event==='frame'||r.encodedBytes!==null)transferFail('LIVE_RECORD_INVALID');
    return r;
  });}
  #now(){if(this.#closed)transferFail('LIVE_CLOSED');const utcMs=this.options.nowUtcMs();this.#journal.checkpointClock({utcMs,reliable:true});return utcMs;}
  #hook(r:ProducerRecord){this.options.append({id:`${r.demand.id}:${r.demand.generation}:${r.sequence}:${r.event}`,producerId:r.demand.id,generation:r.demand.generation,event:r.event,reason:r.reason,
    frameId:r.receipt?.frameId??null,encodedBytes:r.encodedBytes,acceptedPayloadBytes:r.receipt?.acceptedPayloadBytes??null,boundary:'isolated-producer-uplink',layer:'application-payload',coverage:'partial',physicalMedia:false});}
  #save(r:ProducerRecord){this.#journal.mutate(()=>({record:r,result:null}));this.#current=r;this.#hook(r);}
  #localReason(){const h=this.options.health();return !h||[h.ready,h.resourceAvailable,h.stillCapturePending,h.updateInhibited].some(v=>typeof v!=='boolean')?'local-health-unknown':h.updateInhibited?'update-inhibited':h.stillCapturePending?'still-capture-contention':!h.ready?'local-health-unavailable':!h.resourceAvailable?'resource-limit':null;}
  async apply(input:LiveProducerDemand,signal:AbortSignal){
    const d=structuredClone(input);validateLiveProducerDemand(d);const now=this.#now();
    if(signal.aborted||canonical(d.realm)!==canonical(this.options.realm)||d.siteId!==this.options.siteId||canonical(d.target)!==canonical(this.options.source)||d.issuedAtMs>now+100)transferFail('LIVE_NOT_AUTHORIZED');
    const old=this.#current;
    if(old&&(old.demand.id!==d.id||BigInt(d.generation)<BigInt(old.demand.generation)))transferFail('LIVE_STALE_FENCE');
    if(old&&d.generation===old.demand.generation){if(canonical(d)!==canonical(old.demand))transferFail('LIVE_DEMAND_CONFLICT');this.tick();return this.#reply();}
    this.stop('replaced');const previewGeneration=(old?.previewGeneration??0)+1;if(previewGeneration>32)transferFail('LIVE_GENERATION_LIMIT');
    const r:ProducerRecord={demand:d,previewGeneration,sequence:0,event:'leased',reason:null,receipt:null,encodedBytes:null};
    this.#leaseAt=performance.now();this.#deadline=this.#leaseAt+Math.max(0,d.expiresAtMs-now-100);this.#save(r);
    if(!d.viewers||d.expiresAtMs<=now||this.#bootFence!==null&&BigInt(d.generation)<=BigInt(this.#bootFence)){this.stop(!d.viewers?'no-authorized-demand':'expired');return this.#reply();}
    const reason=this.#quarantined?'sink-quarantined':this.#busy?'frame-in-flight':this.#localReason();if(reason){this.stop(reason);return this.#reply();}
    try{this.options.preview.start({id:d.id,generation:previewGeneration,actor:{kind:'service',id:'isolated-live-producer'},source:d.target,expiresUtcMs:d.expiresAtMs,bitrate:d.profile.maxUpstreamBps,expectedBytes:Math.max(1,Math.ceil(d.profile.maxUpstreamBps*(d.expiresAtMs-now)/8000))});}
    catch(e){this.stop(e instanceof TransferError&&e.code==='QUOTA_EXHAUSTED'?'budget-exhausted':'camera-or-budget-unavailable');}
    return this.#reply();
  }
  #reply(){return {id:this.#current!.demand.id,generation:this.#current!.demand.generation,state:this.#current!.event==='stopped'?'stopped' as const:'leased' as const};}
  tick(){try{const r=this.#current;if(!r||r.event==='stopped')return;const now=this.#now();
    const reason=now>=r.demand.expiresAtMs||performance.now()>=this.#deadline?'expired':performance.now()-Math.max(this.#lastFrameAt,this.#leaseAt)>=this.options.preview.options.budget.policy.stream.idleMs?'idle-timeout':this.#localReason();if(reason)this.stop(reason);else this.options.preview.tick();
    if(!this.options.preview.status.active)this.stop('camera-or-budget-unavailable');
  }catch(e){try{this.stop('local-state-unavailable');}catch{}throw e;}}
  async step(signal:AbortSignal){
    this.tick();const r=this.#current;if(!r||r.event==='stopped')return {state:'stopped' as const,reason:r?.reason??'no-authorized-demand'};
    if(this.#busy)return {state:'deferred' as const,reason:'frame-in-flight'};
    if(performance.now()-this.#lastFrameAt<1000/this.options.framesPerSecond)return {state:'deferred' as const,reason:'frame-rate-limit'};
    if(r.sequence>=128){this.stop('frame-limit');return {state:'stopped' as const,reason:'frame-limit'};}
    this.#busy=true;this.#lastFrameAt=performance.now();const controller=new AbortController(),abort=()=>controller.abort();signal.addEventListener('abort',abort,{once:true});this.#sendAbort=controller;if(signal.aborted)abort();let timer:ReturnType<typeof setTimeout>|undefined;
    try{const bytes=await this.options.preview.frame(controller.signal);this.tick();if(controller.signal.aborted||this.#current!==r)transferFail('LIVE_EXPIRED');
      if(bytes.length>Math.ceil(r.demand.profile.maxUpstreamBps/(8*this.options.framesPerSecond)))transferFail('LIVE_FRAME_BITRATE_LIMIT');
      const id=`${r.demand.id}:${r.demand.generation}:${r.sequence+1}`,sha256=payloadDigest(bytes);
      const sent=this.options.send({demand:structuredClone(r.demand),id,sha256,bytes},controller.signal);
      const receipt=await Promise.race([sent,new Promise<never>((_,fail)=>{timer=setTimeout(()=>{this.#quarantined=true;controller.abort();fail(Error('LIVE_SEND_TIMEOUT'));},this.options.sendTimeoutMs);})]);
      fields(receipt,['frameId','sha256','acceptedPayloadBytes']);
      this.tick();if(controller.signal.aborted||this.#current!==r||receipt.frameId!==id||receipt.sha256!==sha256||!Number.isInteger(receipt.acceptedPayloadBytes)||receipt.acceptedPayloadBytes<0||receipt.acceptedPayloadBytes>bytes.length)transferFail('LIVE_RECEIPT_INVALID');
      this.#save({...r,sequence:r.sequence+1,event:'frame',receipt,encodedBytes:bytes.length});return {state:'sent' as const,receipt};
    }catch{this.stop('frame-or-link-unavailable');return {state:'stopped' as const,reason:'frame-or-link-unavailable'};}
    finally{if(timer)clearTimeout(timer);signal.removeEventListener('abort',abort);controller.abort();this.#sendAbort=null;this.#busy=false;}
  }
  stop(reason:string){this.#sendAbort?.abort();this.options.preview.stop();const r=this.#current;if(r&&r.event!=='stopped')this.#save({...r,event:'stopped',reason:typeof reason==='string'&&reason.length>0&&reason.length<=64?reason:'local-state-unavailable',receipt:null,encodedBytes:null});}
  get status(){this.tick();return {state:this.#current?.event==='stopped'||!this.#current?'stopped':'leased',reason:this.#current?.reason??'no-authorized-demand',producerId:this.#current?.demand.id??null,generation:this.#current?.demand.generation??null,frames:this.#current?.sequence??0,busy:this.#busy,quarantined:this.#quarantined,physicalMediaEnabled:false,recordingEnabled:false,transport:'isolated-frame-reference',coverage:'partial'};}
  close(){if(this.#closed)return;try{this.stop('source-ended');}finally{this.#closed=true;clearInterval(this.#timer);this.#journal.close();this.#owner.close();}}
}
