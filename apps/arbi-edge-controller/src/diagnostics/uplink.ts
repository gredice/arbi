import { randomUUID } from 'node:crypto';
import { setImmediate as yieldTurn } from 'node:timers/promises';
import { isDeepStrictEqual } from 'node:util';
import { canonical, type DurableReceipt, type SqliteAuditSpool } from '@arbi/audit';
import { bounded } from '@arbi/gredice';
import type { AuditEvent } from '@arbi/protocol';
import { TransferBudget, TransferError } from '../transfers/budget.js';
import { DiagnosticError, type DiagnosticRecord } from './store.js';
import { DiagnosticPipeline } from './pipeline.js';

export interface DeliveryResult {attemptedBytes:number;acceptedBytes:number;receipt?:DurableReceipt}
export interface UplinkOptions {
  pipeline:DiagnosticPipeline;budget:TransferBudget;auditSpools:()=>readonly SqliteAuditSpool[];
  mode:()=> 'normal'|'low-data'|'essential-only';
  /** Builds a fresh signed request for the ORIGINAL event, including retired boot attribution. */
  auditFrame:(event:AuditEvent,signal:AbortSignal)=>Promise<string>;
  /** Authenticated transport only; respect cancellation and deduplicate audit event IDs at durable ingest. */
  send:(kind:'audit'|'diagnostic',frame:string,signal:AbortSignal)=>Promise<DeliveryResult>;
}
/** Opt-in reconnect pump. No credentials, remote endpoint, timer or default upload authority. */
export class DiagnosticUplink {
  #busy=false;
  #transportRunning=false;
  #stopped=false;
  #abort?:AbortController;
  #deferred=0;
  #uploaded=0;
  #auditUploaded=0;
  #attemptedBytes=0;
  #upperBoundBytes=0;
  #reason:string|null=null;
  constructor(readonly options:UplinkOptions){
    const d=options.pipeline.store.options,b=options.budget.options;
    if(d.siteId!==b.siteId||!isDeepStrictEqual(d.realm,b.realm)||!isDeepStrictEqual(d.source,b.source))throw new DiagnosticError('UPLINK_SCOPE');
  }
  #defer(reason:string){this.#reason=reason;this.#deferred=Math.min(2147483647,this.#deferred+1);}
  async #attempt(kind:'audit'|'diagnostic',frame:string):Promise<DeliveryResult>{
    const b=this.options.budget,bytes=Buffer.byteLength(frame),id=randomUUID();let started=false,grant:{id:string;bytes:number}|undefined,settled=false;
    if(bytes<1||bytes>16384)throw new DiagnosticError('FRAME_LIMIT');
    if(this.#stopped||this.#transportRunning)throw new DiagnosticError('CANCELLED');
    try {
      b.start({id,class:kind==='audit'?'essential':'diagnostic',direction:'upload',expectedBytes:bytes,artifactDigest:null,stream:false,bitrate:null,overrideId:null});started=true;
      grant=b.grant(id,bytes); // Durable upper debit precedes every transport call, including retries.
      const result=await bounded(1000,async signal=>{
        this.#abort=new AbortController();const abort=()=>this.#abort?.abort();signal.addEventListener('abort',abort,{once:true});
        this.#transportRunning=true;
        try{return await this.options.send(kind,frame,this.#abort.signal);}
        finally{signal.removeEventListener('abort',abort);this.#transportRunning=false;this.#abort=undefined;}
      });
      if(this.#stopped)throw new DiagnosticError('CANCELLED');
      if(!result||!Number.isSafeInteger(result.attemptedBytes)||!Number.isSafeInteger(result.acceptedBytes)||result.attemptedBytes<0||
        result.attemptedBytes>bytes||result.acceptedBytes<0||result.acceptedBytes>result.attemptedBytes)throw new DiagnosticError('INVALID_RECEIPT');
      b.settle(id,grant.id,result.attemptedBytes,result.acceptedBytes);settled=true;
      this.#attemptedBytes=Math.min(Number.MAX_SAFE_INTEGER,this.#attemptedBytes+result.attemptedBytes);
      if(result.acceptedBytes!==bytes)throw new DiagnosticError('PARTIAL_DELIVERY');return result;
    }finally{
      // An absent/invalid receipt is ambiguous, including an aborted socket. Keep its full preflight debit.
      if(grant&&!settled){b.settle(id,grant.id,grant.bytes,0);this.#upperBoundBytes=Math.min(Number.MAX_SAFE_INTEGER,this.#upperBoundBytes+grant.bytes);}
      if(started)b.finish(id,!settled);
    }
  }
  async flush():Promise<ReturnType<DiagnosticUplink['statusSnapshot']>>{
    if(this.#stopped||this.#busy||this.#transportRunning){this.#defer(this.#stopped?'STOPPED':'IN_FLIGHT');return this.statusSnapshot();}
    this.#busy=true;this.#reason=null;
    try {
      const spools=this.options.auditSpools();if(spools.length>8)throw new DiagnosticError('SPOOL_LIMIT');
      let sent=0;
      for(const spool of spools){
        for(;;){const event=spool.pendingBounded(1)[0];if(!event)break;
          const scope=this.options.pipeline.store.options;
          if(event.siteId!==scope.siteId||!isDeepStrictEqual(event.realm,scope.realm)||event.executionMode!=='simulation')throw new DiagnosticError('AUDIT_SCOPE');
          if(sent>=8){this.#defer('AUDIT_BACKLOG');return this.statusSnapshot();}
          if(this.#stopped)throw new DiagnosticError('CANCELLED');
          const frame=await bounded(1000,signal=>this.options.auditFrame(structuredClone(event),signal));
          const result=await this.#attempt('audit',frame);
          if(!result.receipt)throw new DiagnosticError('AUDIT_RECEIPT_REQUIRED');
          // Prefix removal follows the authenticated durable receipt, never a broker hint or byte count.
          spool.acknowledgeBounded(result.receipt);this.#auditUploaded=Math.min(2147483647,this.#auditUploaded+1);sent++;await yieldTurn();
        }
      }
      const mode=this.options.mode();if(!['normal','low-data','essential-only'].includes(mode))throw new DiagnosticError('INVALID_POLICY');
      if(mode==='essential-only'){this.#defer('ESSENTIAL_ONLY');return this.statusSnapshot();}
      const p=this.options.pipeline,upper=p.store.snapshot(),page=p.store.page(0,upper,p.clock(),mode==='low-data'?1:8);
      for(const row of page){
        if(this.#stopped)throw new DiagnosticError('CANCELLED');
        const currentMode=this.options.mode();if(currentMode==='essential-only'){this.#defer('ESSENTIAL_ONLY');break;}
        if(!['normal','low-data'].includes(currentMode))throw new DiagnosticError('INVALID_POLICY');
        await this.#attempt('diagnostic',canonical(row.record satisfies DiagnosticRecord));p.store.uploaded([row.record.id]);
        this.#uploaded=Math.min(2147483647,this.#uploaded+1);await yieldTurn();
        if(currentMode==='low-data')break;
      }
      if(mode==='low-data'&&p.store.status.retained)this.#defer('LOW_DATA_BATCH');
    }catch(error){this.#defer(error instanceof DiagnosticError||error instanceof TransferError?error.code:'TRANSPORT_OR_STORAGE_UNAVAILABLE');}
    finally{this.#busy=false;}
    return this.statusSnapshot();
  }
  statusSnapshot(){return {deferred:this.#deferred,uploaded:this.#uploaded,auditUploaded:this.#auditUploaded,busy:this.#busy||this.#transportRunning,
    stopped:this.#stopped,reason:this.#reason,accounting:{layer:'application-payload' as const,source:'authenticated transport adapter' as const,
      sourceIdentity:this.options.pipeline.store.options.source,counterEpoch:this.options.pipeline.store.options.source.bootId,counterPersistence:'process epoch; durable attempt debits remain in TransferBudget' as const,
      attemptedBytes:this.#attemptedBytes,ambiguousUpperBoundBytes:this.#upperBoundBytes,accuracy:'reported attempts; ambiguous sends conservatively charged' as const,carrierBillingTruth:false}};}
  get status(){return this.statusSnapshot();}
  stop(){this.#stopped=true;this.#abort?.abort();}
}
