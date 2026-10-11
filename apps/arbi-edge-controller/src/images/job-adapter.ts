import { configurationDigest } from '@arbi/protocol';
import type { Command } from '@arbi/protocol';
import { JobError } from '../jobs/types.js';
import type { JobAdapter,Operation,Proof } from '../jobs/types.js';
import { originalFromCapture } from './contracts.js';
export interface CapturePodPort {
  gimbal(command:Command):void;settled():boolean;
  capture(command:Command,gimbal:Command):Promise<unknown>;localStop():void;
}
/** Actual pod capture replaces the plant's synthetic capture-count witness.
 * Native JobJournal owns dispatch intent; the pod owns durable image identity. */
export class CaptureJobAdapter implements JobAdapter {
  readonly executionMode='simulation' as const;
  #active:Operation|null=null;#movement:Command|null=null;#result:unknown=null;#error=false;#generation=0;
  readonly results=new Map<string,unknown>();
  constructor(readonly options:{motion:JobAdapter;pod:CapturePodPort;command:(operation:Operation)=>Command;stationary:()=>boolean}) {
    if(options.motion.executionMode!=='simulation')throw new JobError('NOT_AUTHORIZED');
  }
  localStop():void {this.#generation++;this.options.motion.localStop();this.options.pod.localStop();this.#active=null;this.#error=false;this.#result=null;}
  dispatch(o:Operation):void {
    if(this.#active)throw new JobError('INVALID_TRANSITION');
    if(!['gimbal','settle','capture'].includes(o.phase)){this.options.motion.dispatch(o);return;}
    if(!this.options.stationary())throw new JobError('INVALID_TRANSITION');
    this.#active=structuredClone(o);this.#error=false;this.#result=null;
    if(o.phase==='gimbal') {const c=this.options.command(o);if(c.body.type!=='camera.gimbal')throw new JobError('INVALID_TRANSITION');this.options.pod.gimbal(c);this.#movement=c;}
    else if(o.phase==='capture') {
      if(!this.#movement||!this.options.pod.settled()||this.results.size>=128&&!this.results.has(o.commandId))throw new JobError('INVALID_TRANSITION');
      const c=this.options.command(o),generation=this.#generation;
      void this.options.pod.capture(c,this.#movement).then(result=>{
        // Retain the true failed result too; a transport outcome cannot rewrite it.
        this.results.set(o.commandId,structuredClone(result));
        if(generation!==this.#generation)return;
        try{const original=originalFromCapture(result);if(original.jobId!==c.command.correlationId)throw new Error('CAPTURE_JOB_MISMATCH');this.#result=result;}catch{this.#error=true;}
      },()=>{if(generation===this.#generation)this.#error=true;});
    }
  }
  observe(o:Operation,atMs:number):Proof|null {
    if(!['gimbal','settle','capture'].includes(o.phase))return this.options.motion.observe(o,atMs);
    if(configurationDigest(o)!==configurationDigest(this.#active))throw new JobError('RESYNC_REQUIRED');
    if(!this.options.stationary()||this.#error)throw new JobError('EXECUTION_FAILED');
    if(o.phase==='capture'?!this.#result:!this.options.pod.settled())return null;
    this.#active=null;return {operationId:o.id,kind:o.step.proof,epoch:structuredClone(o.epoch),atMs,origin:'simulated',confirmed:true};
  }
}
