import type { KeyObject } from 'node:crypto';
import { configurationDigest } from '@arbi/protocol';
import type { Identity } from '@arbi/protocol';
import { manifestDigest,payloadDigest,transferFail,transferIdentity,verifyOwnerReceipt } from '@arbi/protocol/capture-transfer';
import type { CaptureManifest,CaptureOwnerReceipt } from '@arbi/protocol/capture-transfer';
import type { ApplicationMeter,TransferSpec } from '@arbi/traffic';
import { CaptureStore } from './capture-store.js';
import type { CaptureTransferProgress } from './capture-store.js';

export interface CaptureTransport {
  begin(manifest:CaptureManifest,pod:Identity,signal:AbortSignal):Promise<{offset:number;owned:boolean}>;
  chunk(imageId:string,manifestDigest:string,offset:number,bytes:Uint8Array,sha256:string,pod:Identity,signal:AbortSignal):Promise<{offset:number;duplicate:boolean}>;
  finish(imageId:string,manifestDigest:string,pod:Identity,signal:AbortSignal):Promise<CaptureOwnerReceipt>;
}
/** Explicit resumable LAN owner. Each step sends at most one bounded chunk; the
 * local control/diagnostic scheduler may defer media without a WAN debit. */
export class CaptureTransfer {
  #busy=false;#closed=false;#abort:AbortController|null=null;#generation=0;#last=-1;#second=-1;#sent=0;#poisoned=false;
  #drained:Promise<void>=Promise.resolve();#drainResolve:(()=>void)|null=null;
  #policy:{chunkBytes:number;bytesPerSecond:number;maxAttempts:number;backoffMs:number;timeoutMs:number};
  constructor(readonly options:{store:CaptureStore;source:Identity;edge:()=>Identity;publicKey:KeyObject;meter:ApplicationMeter;
    authorized:()=>boolean;now:()=>number;higherPriorityPending:()=>boolean;transport:CaptureTransport;
    policy?:Partial<{chunkBytes:number;bytesPerSecond:number;maxAttempts:number;backoffMs:number;timeoutMs:number}>}) {
    this.options={...options,source:structuredClone(options.source)};transferIdentity(options.source);
    if(options.publicKey.type!=='public'||options.publicKey.asymmetricKeyType!=='ed25519')transferFail('TRANSFER_TRUST_INVALID');
    this.#policy={chunkBytes:65536,bytesPerSecond:262144,maxAttempts:512,backoffMs:100,timeoutMs:500,...options.policy};const p=this.#policy;
    if(!Number.isInteger(p.chunkBytes)||p.chunkBytes<1||p.chunkBytes>65536||!Number.isInteger(p.bytesPerSecond)||p.bytesPerSecond<p.chunkBytes||p.bytesPerSecond>1048576||!Number.isInteger(p.maxAttempts)||p.maxAttempts<1||p.maxAttempts>512||!Number.isInteger(p.backoffMs)||p.backoffMs<1||p.backoffMs>5000||!Number.isInteger(p.timeoutMs)||p.timeoutMs<1||p.timeoutMs>1000)transferFail('TRANSFER_POLICY_INVALID');
    if(Math.ceil(options.store.maximumImageBytes/p.chunkBytes)>p.maxAttempts)transferFail('TRANSFER_POLICY_INVALID');
  }
  #clock():number {const now=this.options.now();if(!Number.isSafeInteger(now)||now<0||now<this.#last)transferFail('TRANSFER_CLOCK_INVALID');this.#last=now;return now;}
  #authority(edge:Identity):void {
    if(this.#closed||this.#poisoned||!this.options.authorized()||configurationDigest(this.options.edge())!==configurationDigest(edge))transferFail('TRANSFER_AUTHORITY_LOST');
  }
  async #io<T>(run:(signal:AbortSignal)=>Promise<T>,edge:Identity):Promise<T> {
    this.#authority(edge);const controller=new AbortController();this.#abort=controller;let timer:ReturnType<typeof setTimeout>|undefined;
    // A transport that settles only after timeout is quarantined. No subsequent
    // chunk/receipt can overlap that uncertain operation in this coordinator.
    let timedOut=false;const operation=Promise.resolve().then(()=>run(controller.signal));
    try {const result=await Promise.race([operation,new Promise<never>((_,reject)=>{timer=setTimeout(()=>{timedOut=true;controller.abort();reject(new Error('TRANSFER_TIMEOUT'));},this.#policy.timeoutMs);})]);this.#authority(edge);return result;}
    finally {if(timer)clearTimeout(timer);controller.abort();if(this.#abort===controller)this.#abort=null;if(timedOut)this.#poisoned=true;}
  }
  async step(commandId:string):Promise<{state:'paused'|'transferring'|'owned'|'failed';reason:string|null;offset:number;logicalBytes:number}> {
    if(this.#closed)transferFail('TRANSFER_CLOSED');if(this.#busy)transferFail('TRANSFER_BUSY');if(this.#poisoned)transferFail('TRANSFER_TRANSPORT_QUARANTINED');
    this.#busy=true;this.#drained=new Promise(resolve=>{this.#drainResolve=resolve;});const generation=this.#generation;
    try {
      const m=this.options.store.manifest(commandId),digest=manifestDigest(m),edge=structuredClone(this.options.edge());transferIdentity(edge);this.#authority(edge);
      const now=this.#clock(),prior=this.options.store.transferProgress(commandId),delivery=this.options.store.delivery(commandId);
      if(delivery)return {state:'owned',reason:null,offset:m.image.bytes,logicalBytes:0};
      const p:CaptureTransferProgress=prior??{version:'arbi.capture-progress/1.0',manifestDigest:digest,epoch:this.options.source.bootId,offset:0,attempts:0,nextRetryMs:0,state:'paused'};
      if(p.epoch!==this.options.source.bootId){p.epoch=this.options.source.bootId;p.state='paused';p.nextRetryMs=now;this.options.store.saveTransferProgress(commandId,p);}
      if(p.state==='failed'||p.attempts>=this.#policy.maxAttempts)return {state:'failed',reason:'TRANSFER_ATTEMPTS_EXHAUSTED',offset:p.offset,logicalBytes:0};
      if(this.options.higherPriorityPending()||now<p.nextRetryMs)return {state:'paused',reason:this.options.higherPriorityPending()?'HIGHER_PRIORITY_PENDING':'TRANSFER_BACKOFF',offset:p.offset,logicalBytes:0};
      const bytes=this.options.store.readImage(this.options.store.get(commandId)!);
      // Rate deferral happens before reserving an attempt or contacting the peer.
      // Use the largest possible next chunk: a resumed remote offset may differ.
      const second=Math.floor(this.#clock()/1000);if(second!==this.#second){this.#second=second;this.#sent=0;}
      if(this.#sent+Math.min(this.#policy.chunkBytes,m.image.bytes)>this.#policy.bytesPerSecond)return {state:'paused',reason:'LAN_RATE_LIMIT',offset:p.offset,logicalBytes:0};
      // Reserve an attempt durably before invoking even a control handshake.
      p.attempts++;p.state='transferring';this.options.store.saveTransferProgress(commandId,p);
      try {
        const remote=await this.#io(signal=>this.options.transport.begin(m,this.options.source,signal),edge);
        if(!Number.isSafeInteger(remote.offset)||remote.offset<0||remote.offset>m.image.bytes||typeof remote.owned!=='boolean'||remote.owned&&remote.offset!==m.image.bytes)transferFail('TRANSFER_REMOTE_OFFSET_INVALID');
        // Receiver offsets become authoritative only within current authenticated
        // transport; a missing final ownership receipt never permits retention.
        p.offset=remote.offset;
        if(p.offset<m.image.bytes) {
          const length=Math.min(this.#policy.chunkBytes,m.image.bytes-p.offset);
          const chunk=bytes.subarray(p.offset,p.offset+length),offset=p.offset;this.#sent+=length;
          const spec:TransferSpec={scope:{realm:m.realm,siteId:m.siteId,executionMode:'simulation',source:this.options.source,boundary:'lan',linkId:'pod-edge-capture-model'},direction:'upload',category:'still',includes:['payload','retries'],maxAgeMs:60000,retryOf:null,media:null};
          let response:{offset:number;duplicate:boolean}|undefined;
          await this.#io(signal=>this.options.meter.upload(spec,(async function*(){yield chunk;})(),async data=>{response=await this.options.transport.chunk(m.image.id,digest,offset,data,payloadDigest(data),this.options.source,signal);}),edge);
          if(!response||!Number.isSafeInteger(response.offset)||response.offset<offset+length||response.offset>m.image.bytes||typeof response.duplicate!=='boolean')transferFail('TRANSFER_REMOTE_OFFSET_INVALID');p.offset=response.offset;
        }
        if(generation!==this.#generation)transferFail('TRANSFER_STOPPED');this.#authority(edge);
        if(p.offset===m.image.bytes) {
          const receipt=await this.#io(signal=>this.options.transport.finish(m.image.id,digest,this.options.source,signal),edge);verifyOwnerReceipt(receipt,m,edge,this.options.publicKey);
          this.options.store.acknowledgeTransfer(commandId,receipt,edge,this.options.publicKey);p.state='owned';
        } else p.state='paused';p.nextRetryMs=0;this.options.store.saveTransferProgress(commandId,p);
        return {state:p.state,reason:null,offset:p.offset,logicalBytes:p.state==='owned'?m.image.bytes:0};
      } catch(e) {
        if(e instanceof Error&&e.message==='SIMULATED_PROCESS_CUT')throw e;
        p.state=p.attempts>=this.#policy.maxAttempts?'failed':'paused';p.nextRetryMs=this.#clock()+Math.min(5000,this.#policy.backoffMs*2**Math.min(p.attempts-1,5));this.options.store.saveTransferProgress(commandId,p);
        return {state:p.state,reason:this.#closed?'TRANSFER_STOPPED':e instanceof Error&&e.message==='TRANSFER_TIMEOUT'?'TRANSFER_TIMEOUT':'TRANSFER_RETRY_REQUIRED',offset:p.offset,logicalBytes:0};
      }
    } finally {this.#busy=false;this.#drainResolve?.();this.#drainResolve=null;}
  }
  stop():void {this.#closed=true;this.#generation++;this.#abort?.abort();}
  async stopAndDrain():Promise<void> {this.stop();await this.#drained;}
  get status(){return {busy:this.#busy,closed:this.#closed,quarantined:this.#poisoned,source:structuredClone(this.options.source),boundary:'lan' as const,wanBytes:null,maximumChunkBytes:this.#policy.chunkBytes,physicalWiFiMeasured:false};}
}
