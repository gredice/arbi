import { transferFail } from '@arbi/protocol/capture-transfer';
import { verifyCaptureUpload } from '@arbi/protocol/capture-upload';
import type { CaptureUploadPort } from '@arbi/protocol/capture-upload';
import { TransferBudget } from '../transfers/budget.js';
import { CaptureStage } from './stage.js';
/** One independently supervised WAN attempt. Native stage and shared budget
 * survive restart; an uncertain remote result is inspected before replay. */
export class CaptureUploader {
  #busy=false;#closed=false;#quarantined=false;#abort:AbortController|null=null;#drain:Promise<void>=Promise.resolve();
  constructor(readonly options:{stage:CaptureStage;budget:TransferBudget;port:CaptureUploadPort;authorized:()=>boolean;nowUtcMs:()=>number;higherPriorityPending:()=>boolean;timeoutMs?:number}) {if(!Number.isInteger(options.timeoutMs??5000)||(options.timeoutMs??5000)<1||(options.timeoutMs??5000)>5000)transferFail('UPLOAD_POLICY_INVALID');}
  #authority(){if(this.#closed||this.#quarantined||!this.options.authorized())transferFail('UPLOAD_AUTHORITY_LOST');}
  async step(captureId:string,artifactId:string):Promise<{state:'uploaded'|'deferred'|'unavailable';reason:string|null}> {
    if(this.#busy||this.#closed||this.#quarantined)transferFail('UPLOAD_BUSY');this.#busy=true;let done!:()=>void;this.#drain=new Promise(r=>{done=r;});
    const controller=new AbortController();this.#abort=controller;let timer:ReturnType<typeof setTimeout>|undefined;
    const run=async()=>{
      const o=this.options;this.#authority();const row=o.stage.expire(captureId,o.nowUtcMs()),artifact=row.artifacts.find(a=>a.trace.artifact.id===artifactId);
      if(row.state!=='retained'||!artifact)return {state:'unavailable' as const,reason:'STAGED_DATA_UNAVAILABLE'};
      if(artifact.upload.state==='uploaded')return {state:'uploaded' as const,reason:null};
      if(o.higherPriorityPending())return {state:'deferred' as const,reason:'HIGHER_PRIORITY_PENDING'};
      const a=o.stage.attempt(captureId,artifactId),trace=a.trace;
      try {
        let receipt=await o.port.inspect(trace,controller.signal);this.#authority();
        if(!receipt) {
          const bytes=o.stage.read(captureId,artifactId),id=`capture:${artifactId}`;
          const t=o.budget.start({id,class:'media',direction:'upload',expectedBytes:bytes.length,artifactDigest:null,stream:false,bitrate:null,overrideId:null});if(t.state==='paused')o.budget.resume(id);if(['complete','cancelled'].includes(t.state))transferFail('UPLOAD_BUDGET_RECONCILIATION_REQUIRED');
          const body=(async function*(owner:CaptureUploader){for(let offset=0;offset<bytes.length;offset+=65536){owner.#authority();if(controller.signal.aborted)transferFail('UPLOAD_ABORTED');if(o.higherPriorityPending())transferFail('HIGHER_PRIORITY_PENDING');const part=bytes.subarray(offset,offset+65536),grant=o.budget.grant(id,part.length);
            // Submission to the HTTP body is charged conservatively; cloud
            // acknowledgement is recorded only after full object inspection.
            o.budget.settle(id,grant.id,part.length,0);yield part;}})(this);
          receipt=await o.port.upload(trace,body,controller.signal);this.#authority();verifyCaptureUpload(receipt,trace);o.budget.finish(id);
        }
        verifyCaptureUpload(receipt,trace);const existing=o.budget.getTransfer(`capture:${artifactId}`);if(existing&&['active','paused'].includes(existing.state))o.budget.finish(existing.id);o.stage.uploaded(captureId,receipt);return {state:'uploaded' as const,reason:null};
      }catch(e){if(e instanceof Error&&e.message==='SIMULATED_PROCESS_CUT')throw e;if(controller.signal.aborted)return {state:'deferred' as const,reason:'UPLOAD_ABORTED'};const reason=(e as {code?:string}).code??'UPLOAD_RETRY_REQUIRED';o.stage.failed(captureId,artifactId,/^[A-Za-z0-9._:-]{1,128}$/.test(reason)?reason:'UPLOAD_RETRY_REQUIRED');return {state:'deferred' as const,reason};}
    };
    try{return await Promise.race([run(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{this.#quarantined=true;controller.abort();reject(new Error('UPLOAD_TIMEOUT'));},this.options.timeoutMs??5000);})]);}
    catch(e){if(e instanceof Error&&e.message==='UPLOAD_TIMEOUT')this.options.stage.failed(captureId,artifactId,'UPLOAD_TIMEOUT');throw e;}
    finally{if(timer)clearTimeout(timer);controller.abort();this.#abort=null;this.#busy=false;done();}
  }
  async stopAndDrain(){this.#closed=true;this.#abort?.abort();await this.#drain;}
  get status(){return {busy:this.#busy,quarantined:this.#quarantined,closed:this.#closed,physicalAcceptance:false};}
}
