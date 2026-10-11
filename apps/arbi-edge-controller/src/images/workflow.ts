import type { LocalJobConsumer } from '../jobs/orchestrator.js';
import type { TransferBudget } from '../transfers/budget.js';
import type { Calibration } from './contracts.js';
import type { CaptureManifest } from '@arbi/protocol/capture-transfer';
import { transferFail } from '@arbi/protocol/capture-transfer';
import type { CaptureReceiver } from './capture-receiver.js';
import type { CaptureStage } from './stage.js';
import type { ImageProcessor } from './processor.js';
import type { CaptureUploader } from './upload.js';
import type { CapturePreview } from './preview.js';
/** Explicit isolated composition. Call job tick on the independently supervised
 * local loop; mediaStep is discretionary work and never on the stop path. */
export class CaptureWorkflow {
  #busy=false;#closed=false;#drain:Promise<void>=Promise.resolve();
  constructor(readonly options:{jobs:LocalJobConsumer;receiver:CaptureReceiver;stage:CaptureStage;processor:ImageProcessor;uploader:CaptureUploader;budget:TransferBudget;preview?:CapturePreview;
    calibration:(manifest:CaptureManifest)=>Calibration|null;nowUtcMs:()=>number;priority:'raw-first'|'rectified-first'}) {
    if(!['raw-first','rectified-first'].includes(options.priority))transferFail('CAPTURE_POLICY_INVALID');
  }
  tick(){if(this.#closed)transferFail('CAPTURE_WORKFLOW_CLOSED');this.options.preview?.tick();return this.options.jobs.tick();}
  async mediaStep():Promise<{state:'idle'|'staged'|'uploaded'|'deferred'|'unavailable';captureId:string|null;reason:string|null}> {
    if(this.#closed||this.#busy)transferFail('CAPTURE_WORKFLOW_BUSY');this.#busy=true;let done!:()=>void;this.#drain=new Promise(r=>{done=r;});
    try {
      const o=this.options,now=o.nowUtcMs();
      for(const id of o.receiver.ownedIds()) {
        let row=o.stage.get(id);
        if(!row){const m=o.receiver.readOwned(id).manifest;row=await o.stage.stage(o.receiver,id,o.processor,o.calibration(m),now);return {state:row.state==='retained'?'staged':'unavailable',captureId:id,reason:row.state==='retained'?null:row.events.at(-1)??'STAGE_FAILED'};}
        row=o.stage.expire(id,now);if(row.state!=='retained')continue;
        const choices=row.artifacts.filter(a=>a.upload.state==='pending');choices.sort((a,b)=>Number(a.trace.artifact.kind!==(o.priority==='raw-first'?'raw':'rectified'))-Number(b.trace.artifact.kind!==(o.priority==='raw-first'?'raw':'rectified')));
        if(!choices.length)continue;
        // Inspection precedes budget admission inside the uploader. A lost
        // completion response must be recoverable even at zero byte allowance.
        const a=choices[0];
        if(this.#closed)return {state:'deferred',captureId:id,reason:'WORKFLOW_STOPPED'};
        const result=await o.uploader.step(id,a.trace.artifact.id);return {...result,captureId:id};
      }
      return {state:'idle',captureId:null,reason:null};
    }finally{this.#busy=false;done();}
  }
  /** Safety inhibition comes first; storage/network draining follows it. */
  async stopAndDrain(){this.#closed=true;this.options.jobs.localSafetyStop();this.options.preview?.stop();await this.options.uploader.stopAndDrain();await this.#drain;}
  get status(){return {jobs:this.options.jobs.status,images:this.options.stage.status(),upload:this.options.uploader.status,preview:this.options.preview?.status??null,closed:this.#closed,physicalActuationEnabled:false,recordingEnabled:false};}
}
