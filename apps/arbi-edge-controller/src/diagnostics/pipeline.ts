import { randomUUID } from 'node:crypto';
import { setImmediate as yieldTurn } from 'node:timers/promises';
import { isDeepStrictEqual } from 'node:util';
import { digest } from '@arbi/audit';
import { advanceCursor, applyTelemetry, createTelemetryState, parseMessage, PROTOCOL_VERSION,
  type ErrorCode, type Event, type TelemetryContext, type TelemetryState } from '@arbi/protocol';
import { DiagnosticError, DiagnosticStore, type DiagnosticKind, type DiagnosticRecord } from './store.js';

interface Cursor {binding:string;telemetry:TelemetryState;event:string|null;monotonic:number;lost:boolean}
const boundedCount=(n:number)=>Math.min(2147483647,n+1);
/** Closed protocol observations only. No arbitrary text, configuration file or command payload enters the ring. */
export class DiagnosticPipeline {
  readonly #queue:DiagnosticRecord[]=[];
  readonly #sources=new Map<string,Cursor>();
  #scheduled?:NodeJS.Immediate;
  #closed=false;
  #dropped=0;
  #rejected=0;
  #codeSequence=0;
  #exports=0;
  constructor(readonly store:DiagnosticStore,readonly clock:()=>number){}
  observe(frame:string,context:TelemetryContext):boolean {
    if(this.#closed)return false;
    try {
      if(typeof frame!=='string'||Buffer.byteLength(frame)>8192)throw new DiagnosticError('FRAME_LIMIT');
      const parsed=parseMessage(frame);if(!parsed.ok||parsed.value.kind==='command')throw new DiagnosticError('INVALID_MESSAGE');
      const message=parsed.value,o=this.store.options;
      if(!isDeepStrictEqual(context.realm,o.realm)||context.siteId!==o.siteId||context.executionMode!=='simulation'||
        !isDeepStrictEqual(message.realm,o.realm)||message.siteId!==o.siteId||message.executionMode!=='simulation'||
        !isDeepStrictEqual(message.source,context.authenticatedSource)||!isDeepStrictEqual(message.source,context.activeSource))throw new DiagnosticError('SCOPE');
      const key=message.source.deviceId,binding=digest(context);let cursor=this.#sources.get(key);
      if(!cursor||cursor.binding!==binding){if(!cursor&&this.#sources.size>=16)throw new DiagnosticError('SOURCE_LIMIT');
        cursor={binding,telemetry:createTelemetryState(),event:null,monotonic:0,lost:false};this.#sources.set(key,cursor);}
      if(message.sourceTime.monotonicMs<cursor.monotonic)throw new DiagnosticError('CLOCK_REGRESSION');
      let gap:boolean;
      if(message.kind==='telemetry'){
        const applied=applyTelemetry(message,context,cursor.telemetry);if(!applied.ok)throw new DiagnosticError(applied.error.code);gap=applied.value.gap;
      }else {
        // Diagnostic history may have gaps. It never supplies an authoritative command/state recovery cursor.
        const next=advanceCursor(context.activeSource,'telemetry',cursor.event,message.source,message.sequence);
        if(!next.ok)throw new DiagnosticError(next.error.code);cursor.event=next.value.sequence;gap=next.value.gap;
      }
      cursor.monotonic=message.sourceTime.monotonicMs;
      const receivedAtMs=this.clock();if(!Number.isSafeInteger(receivedAtMs)||receivedAtMs<0)throw new DiagnosticError('CLOCK_UNKNOWN');
      const kind:DiagnosticKind=message.kind==='telemetry'?'telemetry':message.body.type==='fault.changed'?
        context.capabilitiesRevision==='edge-codes'&&message.source.deviceId===o.source.deviceId?'code':'fault':message.body.type==='command.outcome'?'outcome':'state';
      const cap=kind==='telemetry'?16:kind==='fault'?8:4;
      const same=this.#queue.filter(r=>r.kind===kind);
      if(same.length>=cap||this.#queue.length>=32){
        if(kind==='fault'){
          const index=this.#queue.findIndex(r=>r.kind===(same.length>=cap?'fault':'telemetry'));if(index>=0)this.#queue.splice(index,1);else {cursor.lost=true;this.#dropped=boundedCount(this.#dropped);this.#schedule();return false;}
        }else {cursor.lost=true;this.#dropped=boundedCount(this.#dropped);this.#schedule();return false;}
        this.#dropped=boundedCount(this.#dropped);
      }
      const record:DiagnosticRecord={version:'arbi.edge-diagnostics/1.0',id:message.messageId,kind,realm:structuredClone(o.realm),siteId:o.siteId,
        receivedAtMs,receiver:structuredClone(o.source),message:structuredClone(message),gap:gap||cursor.lost};
      if(Buffer.byteLength(JSON.stringify(record))>12288)throw new DiagnosticError('FRAME_LIMIT');this.#queue.push(record);cursor.lost=false;
      this.#schedule();return true;
    }catch {this.#rejected=boundedCount(this.#rejected);this.#schedule();return false;}
  }
  /** Finite protocol error codes replace free-text logs, including exception messages. */
  code(code:ErrorCode):boolean {
    const o=this.store.options,event:Event={protocol:PROTOCOL_VERSION,messageId:randomUUID(),realm:o.realm,executionMode:'simulation',siteId:o.siteId,
      source:o.source,sequence:String(++this.#codeSequence),sourceTime:{utc:null,uncertaintyMs:null,monotonicMs:Math.floor(performance.now())},ingestTime:null,kind:'event',
      body:{type:'fault.changed',faultId:randomUUID(),state:'raised',severity:'info',error:{code,retryable:false}}};
    return this.observe(JSON.stringify(event),{realm:o.realm,siteId:o.siteId,executionMode:'simulation',authenticatedSource:o.source,activeSource:o.source,capabilities:[],capabilitiesRevision:'edge-codes'});
  }
  #schedule(){if(!this.#scheduled&&!this.#closed)this.#scheduled=setImmediate(()=>this.#step());}
  #step(){
    this.#scheduled=undefined;if(this.#closed)return;
    // Overflow is aggregated: a burst cannot force one synchronous SQLite transaction per rejected input.
    if(this.#dropped){this.store.count('dropped',this.#dropped);this.#dropped=0;}
    if(this.#rejected){this.store.count('rejected',this.#rejected);this.#rejected=0;}
    const record=this.#queue.shift();if(record)try{this.store.append(record);}catch{this.store.count('dropped');}
    if(this.#queue.length||this.#dropped||this.#rejected)this.#schedule();
  }
  async idle(){while(this.#scheduled||this.#queue.length)await yieldTurn();}
  /** Current diagnostics authority is checked for every page. A cancelled/abandoned generator releases its slot. */
  async *export(signal:AbortSignal,authorize:()=>boolean,maxBytes=1048576):AsyncGenerator<string>{
    if(!Number.isSafeInteger(maxBytes)||maxBytes<1024||maxBytes>1048576)throw new DiagnosticError('EXPORT_LIMIT');
    if(this.#closed||this.#exports>=2)throw new DiagnosticError('EXPORT_BUSY');this.#exports++;
    try {
      const upper=this.store.snapshot();let after=0,bytes=0;
      for(;;){
        if(signal.aborted||this.#closed)throw new DiagnosticError('CANCELLED');if(!authorize())throw new DiagnosticError('DENIED');
        const page=this.store.page(after,upper,this.clock(),8);if(!page.length)return;
        for(const row of page){const line=JSON.stringify(row.record)+'\n';bytes+=Buffer.byteLength(line);if(bytes>maxBytes)throw new DiagnosticError('EXPORT_LIMIT');
          if(signal.aborted||this.#closed)throw new DiagnosticError('CANCELLED');if(!authorize())throw new DiagnosticError('DENIED');yield line;after=row.ordinal;}
        await yieldTurn();
      }
    }finally{this.#exports--;}
  }
  get status(){return {...this.store.status,queued:this.#queue.length,pendingDropped:this.#dropped,pendingRejected:this.#rejected,exports:this.#exports,
    limits:{queueRecords:32,frameBytes:8192,recordBytes:12288,sourceBindings:16,exportJobs:2,exportBytes:1048576},physicalTimingEvidence:false};}
  close(){if(this.#closed)return;this.#closed=true;clearImmediate(this.#scheduled);this.#scheduled=undefined;
    const lost=this.#queue.length+this.#dropped;if(lost)this.store.count('dropped',Math.min(lost,2147483647));if(this.#rejected)this.store.count('rejected',this.#rejected);
    this.#queue.length=0;this.#dropped=0;this.#rejected=0;this.store.close();}
}
