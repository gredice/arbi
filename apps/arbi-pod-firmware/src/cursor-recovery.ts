import type { KeyObject } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { configurationDigest } from '@arbi/protocol';
import type { Identity } from '@arbi/protocol';
import { contentHash } from '@arbi/audit';
import type { SqliteAuditSpool } from '@arbi/audit';
import type { TrafficSpool } from '@arbi/traffic';
import { transferFail,transferIdentity,verifyCursorReceipt } from '@arbi/protocol/capture-transfer';
import type { CaptureCursorKind,CaptureCursorReceipt } from '@arbi/protocol/capture-transfer';
import type { DiagnosticBuffer } from './diagnostic-buffer.js';
export interface PodCursorTransport {send(kind:CaptureCursorKind,id:string,body:unknown,pod:Identity,signal:AbortSignal):Promise<CaptureCursorReceipt>}
/** Prefix custody handoff, not a canonical cloud committed cursor. Historical
 * source/actor/epoch/gap fields survive unchanged in the native edge owner. */
export class PodCursorRecovery {
  #busy=false;#closed=false;#quarantined=false;#abort:AbortController|null=null;#done:Promise<void>=Promise.resolve();#resolve:(()=>void)|null=null;#lastReason:string|null=null;
  constructor(readonly options:{source:Identity;edge:()=>Identity;publicKey:KeyObject;authorized:()=>boolean;audit:SqliteAuditSpool;usage:TrafficSpool;diagnostics:DiagnosticBuffer;timeoutMs?:number}) {
    this.options={...options,source:structuredClone(options.source)};transferIdentity(options.source);
    if(options.publicKey.type!=='public'||options.publicKey.asymmetricKeyType!=='ed25519'||!Number.isInteger(options.timeoutMs??1000)||(options.timeoutMs??1000)<1||(options.timeoutMs??1000)>1000)transferFail('TRANSFER_TRUST_INVALID');
  }
  #authority(edge:Identity):void {if(this.#closed||this.#quarantined||!this.options.authorized()||configurationDigest(this.options.edge())!==configurationDigest(edge))transferFail('TRANSFER_AUTHORITY_LOST');}
  async flush(transport:PodCursorTransport):Promise<{audit:number;usage:number;diagnostic:number;cloudCommitted:false;reason:string|null}> {
    if(this.#closed)transferFail('CURSOR_RECOVERY_CLOSED');if(this.#busy)transferFail('CURSOR_RECOVERY_BUSY');if(this.#quarantined)transferFail('CURSOR_TRANSPORT_QUARANTINED');
    const edge=structuredClone(this.options.edge());transferIdentity(edge);
    this.#busy=true;this.#done=new Promise(resolve=>{this.#resolve=resolve;});const until=performance.now()+1000,result={audit:0,usage:0,diagnostic:0,cloudCommitted:false as const,reason:null as string|null};
    const send=async(kind:CaptureCursorKind,id:string,body:unknown,hash:string):Promise<CaptureCursorReceipt>=>{
      this.#authority(edge);if(performance.now()>=until)transferFail('CURSOR_RECOVERY_BUDGET');const controller=new AbortController();this.#abort=controller;let timer:ReturnType<typeof setTimeout>|undefined;
      try {const receipt=await Promise.race([Promise.resolve().then(()=>transport.send(kind,id,body,this.options.source,controller.signal)),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{this.#quarantined=true;controller.abort();reject(new Error('CURSOR_RECOVERY_TIMEOUT'));},this.options.timeoutMs??1000);})]);this.#authority(edge);verifyCursorReceipt(receipt,kind,id,hash,edge,this.options.publicKey);return receipt;}
      finally {if(timer)clearTimeout(timer);controller.abort();if(this.#abort===controller)this.#abort=null;}
    };
    try {
      transferIdentity(edge);this.#authority(edge);
      // Fixed small batches keep recovery bounded and give audit precedence.
      for(const event of this.options.audit.pendingBounded(8)){const receipt=await send('audit',event.eventId,event,contentHash(event));if(receipt.ingestTime===null)transferFail('TRANSFER_CLOCK_UNAVAILABLE');this.options.audit.acknowledgeBounded({durable:true,eventId:receipt.id,contentHash:receipt.contentHash,ingestTime:receipt.ingestTime});result.audit++;}
      for(const item of this.options.usage.pending(8)){const receipt=await send('usage',item.record.id,item.record,item.contentHash);this.options.usage.acknowledge({id:receipt.id,contentHash:receipt.contentHash,durable:true});result.usage++;}
      for(const row of this.options.diagnostics.pendingBounded(8)){const id=`${row.bootId}:${row.sequence}`,receipt=await send('diagnostic',id,row,configurationDigest(row));this.options.diagnostics.acknowledge(receipt.id,receipt.contentHash);result.diagnostic++;}
      this.#lastReason=null;
    } catch(e) {result.reason=e instanceof Error&&e.message==='CURSOR_RECOVERY_TIMEOUT'?'CURSOR_RECOVERY_TIMEOUT':'CURSOR_RECOVERY_REQUIRED';this.#lastReason=result.reason;}
    finally {this.#busy=false;this.#resolve?.();this.#resolve=null;}
    return result;
  }
  async stopAndDrain():Promise<void> {this.#closed=true;this.#abort?.abort();await this.#done;}
  status(){return {source:structuredClone(this.options.source),boundary:'lan' as const,cloudCommitted:false,busy:this.#busy,closed:this.#closed,quarantined:this.#quarantined,coverage:'partial' as const,reason:this.#lastReason,audit:this.options.audit.status(),usage:this.options.usage.status(),diagnostics:this.options.diagnostics.status()};}
}
