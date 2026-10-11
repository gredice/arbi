import { Worker } from 'node:worker_threads';
import { performance } from 'node:perf_hooks';
import type { Calibration,Original,ProcessingResult } from './contracts.js';
import { validateCalibration,validateOriginal } from './contracts.js';
import { fallback } from './pipeline.js';
import { fail,ImageError,MAX_PNG_BYTES } from './png.js';
export class ImageProcessor {
  #busy=false;#closed=false;#work:number;#timeout:number;#worker:Worker|null=null;
  constructor(options:{maximumWorkUnits?:number;timeoutMs?:number}={}) {
    this.#work=options.maximumWorkUnits??8000000;this.#timeout=options.timeoutMs??2000;
    if(!Number.isInteger(this.#work)||this.#work<1||this.#work>8000000||!Number.isInteger(this.#timeout)||this.#timeout<1||this.#timeout>5000)fail('PROCESSING_POLICY_INVALID');
  }
  close():void {if(this.#busy)fail('PROCESSING_BUSY');this.#closed=true;}
  async process(original:Original,png:Uint8Array,calibration:Calibration|null,signal?:AbortSignal):Promise<ProcessingResult> {
    if(this.#closed)fail('PROCESSOR_CLOSED');validateOriginal(original);
    if(!(png instanceof Uint8Array)||png.length>MAX_PNG_BYTES)fail('PNG_INVALID');
    if(this.#busy)return fallback(original,'PROCESSING_BUSY');if(signal?.aborted)return fallback(original,'PROCESSING_ABORTED');
    // Closed, bounded calibration fields precede structured-clone allocation.
    try {if(calibration!==null)validateCalibration(calibration,original);}catch(e){return fallback(original,e instanceof ImageError?e.code:'CALIBRATION_INVALID');}
    this.#busy=true;const started=performance.now();let timer:ReturnType<typeof setTimeout>|undefined,abort:(()=>void)|undefined;
    try {
      const worker=new Worker(new URL('./worker.js',import.meta.url),{workerData:{original:structuredClone(original),png:Uint8Array.from(png),calibration:structuredClone(calibration),maximumWorkUnits:this.#work},
        resourceLimits:{maxOldGenerationSizeMb:64,maxYoungGenerationSizeMb:8,stackSizeMb:4}});this.#worker=worker;
      return await new Promise<ProcessingResult>(resolve=>{
        let finished=false;
        const finish=(result:ProcessingResult)=>{if(finished)return;finished=true;result.resources.runtimeMs=performance.now()-started;resolve(result);};
        worker.once('message',finish);worker.once('error',()=>finish(fallback(original,'PROCESSING_WORKER_FAILED')));worker.once('exit',()=>finish(fallback(original,'PROCESSING_WORKER_FAILED')));
        timer=setTimeout(()=>finish(fallback(original,'PROCESSING_TIMEOUT')),this.#timeout);
        abort=()=>finish(fallback(original,'PROCESSING_ABORTED'));signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
      });
    } catch {return fallback(original,'PROCESSING_WORKER_FAILED');}
    finally {if(timer)clearTimeout(timer);if(abort)signal?.removeEventListener('abort',abort);await this.#worker?.terminate();this.#worker=null;this.#busy=false;}
  }
}
/** Pure selection for the later upload owner. A rejected/unavailable derivative
 * can never be selected; insufficient bytes queues instead of losing the raw. */
export function selectUpload(result:ProcessingResult,remainingBytes:number,preference:'derived-first'|'original-first'='derived-first'):{state:'selected'|'queued';artifactId:string|null;kind:'raw'|'rectified'|null;bytes:number} {
  if(!Number.isSafeInteger(remainingBytes)||remainingBytes<0||!['derived-first','original-first'].includes(preference))fail('UPLOAD_BUDGET_INVALID');
  if(['RAW_INTEGRITY_FAILED','PNG_INVALID','PNG_UNSUPPORTED','IMAGE_DIMENSIONS'].includes(result.processing.reason??''))return {state:'queued',artifactId:null,kind:null,bytes:0};
  const raw={artifactId:result.capture.original.id,kind:'raw' as const,bytes:result.capture.original.bytes},d=result.processing.state==='rectified'?result.processing.derivative:null;
  const derivative=d?{artifactId:d.id,kind:'rectified' as const,bytes:d.bytes}:null;
  const choices=preference==='derived-first'?[derivative,raw]:[raw,derivative];const chosen=choices.find(c=>c&&c.bytes<=remainingBytes);
  return chosen?{state:'selected',...chosen}:{state:'queued',artifactId:null,kind:null,bytes:0};
}
