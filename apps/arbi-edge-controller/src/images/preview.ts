import { configurationDigest } from '@arbi/protocol';
import type { Actor,Identity } from '@arbi/protocol';
import { transferFail,transferId,transferIdentity } from '@arbi/protocol/capture-transfer';
import type { TransferBudget } from '../transfers/budget.js';
export interface PreviewGrant {id:string;generation:number;actor:Actor;source:Identity;expiresUtcMs:number;bitrate:number;expectedBytes:number}
export interface PreviewHook {event:'start'|'reconnect'|'expiry'|'stop'|'frame';grant:PreviewGrant;basis:'authorized-session'|'local-frame';bytes:number|null;utcMs:number;physicalMedia:false;observedDelivery:false}
/** Single camera preview owner. The cloud live service owns viewer authority
 * and audit; these required hooks distinguish local grants from actual bytes. */
export class CapturePreview {
  #grant:PreviewGrant|null=null;#release:(()=>void)|null=null;#lastUtc=0;#frameActive=false;#abort:AbortController|null=null;#quarantined=false;
  constructor(readonly options:{budget:TransferBudget;nowUtcMs:()=>number;authorized:(grant:PreviewGrant)=>boolean;acquireCamera:()=>()=>void;frame:(signal:AbortSignal)=>Promise<Uint8Array>;append:(event:PreviewHook)=>void}){}
  #now(){const n=this.options.nowUtcMs();if(!Number.isSafeInteger(n)||n<0||n<this.#lastUtc){this.stop();transferFail('PREVIEW_CLOCK_INVALID');}this.#lastUtc=n;return n;}
  #valid(g:PreviewGrant){transferIdentity(g.source);const now=this.#now();if(!transferId(g.id)||!transferId(g.actor.id)||!['human','service'].includes(g.actor.kind)||!Number.isInteger(g.generation)||g.generation<1||g.generation>32||!Number.isSafeInteger(g.expiresUtcMs)||g.expiresUtcMs<=now||g.expiresUtcMs-now>15000||!this.options.authorized(g))transferFail('PREVIEW_NOT_AUTHORIZED');}
  #id(g:PreviewGrant){return `preview:${g.id}:${g.generation}`;}
  #hook(event:PreviewHook['event'],g:PreviewGrant,bytes:number|null=null){this.options.append({event,grant:structuredClone(g),basis:event==='frame'?'local-frame':'authorized-session',bytes,utcMs:this.#lastUtc,physicalMedia:false,observedDelivery:false});}
  start(input:PreviewGrant):void {
    const g=structuredClone(input);this.#valid(g);if(this.#frameActive||this.#quarantined)transferFail('PREVIEW_CAMERA_BUSY');const old=this.#grant;
    if(old&&old.id===g.id&&old.generation===g.generation){if(configurationDigest(old)!==configurationDigest(g))transferFail('PREVIEW_ID_CONFLICT');return;}
    if(old&&(old.id!==g.id||old.actor.id!==g.actor.id||old.actor.kind!==g.actor.kind||configurationDigest(old.source)!==configurationDigest(g.source)||g.generation<=old.generation))transferFail('PREVIEW_ID_CONFLICT');
    if(old)this.stop();
    const release=this.options.acquireCamera();
    try{this.options.budget.start({id:this.#id(g),class:'media',direction:'upload',expectedBytes:g.expectedBytes,artifactDigest:null,stream:true,bitrate:g.bitrate,overrideId:null});this.#hook(old?'reconnect':'start',g);this.#grant=g;this.#release=release;}
    catch(e){release();const t=this.options.budget.getTransfer(this.#id(g));if(t&&!t.pending)this.options.budget.finish(t.id,true);throw e;}
  }
  tick():void {if(!this.#grant)return;const n=this.#now();if(n>=this.#grant.expiresUtcMs||!this.options.authorized(this.#grant))this.stop('expiry');}
  async frame(signal:AbortSignal):Promise<Uint8Array> {
    this.tick();const g=this.#grant;if(!g||signal.aborted)transferFail('PREVIEW_EXPIRED');if(this.#frameActive||this.#quarantined)transferFail('PREVIEW_CAMERA_BUSY');this.#valid(g);this.#frameActive=true;
    const controller=new AbortController();this.#abort=controller;const abort=()=>controller.abort();signal.addEventListener('abort',abort,{once:true});let timer:ReturnType<typeof setTimeout>|undefined;
    const operation=Promise.resolve().then(()=>this.options.frame(controller.signal));
    void operation.finally(()=>{this.#frameActive=false;if(!this.#grant){this.#release?.();this.#release=null;}}).catch(()=>{});
    try{const bytes=await Promise.race([operation,new Promise<never>((_,reject)=>{timer=setTimeout(()=>{this.#quarantined=true;controller.abort();this.stop('expiry');reject(new Error('PREVIEW_FRAME_TIMEOUT'));},1000);})]);
      this.tick();if(controller.signal.aborted||!this.#grant||configurationDigest(this.#grant)!==configurationDigest(g)||!(bytes instanceof Uint8Array)||bytes.length<1||bytes.length>65536)transferFail('PREVIEW_EXPIRED');
      this.options.budget.intent(this.#id(g));const charge=this.options.budget.grant(this.#id(g),bytes.length);this.options.budget.settle(this.#id(g),charge.id,bytes.length,0);this.#hook('frame',g,bytes.length);return bytes;
    }finally{if(timer)clearTimeout(timer);signal.removeEventListener('abort',abort);controller.abort();this.#abort=null;}
  }
  stop(event:'stop'|'expiry'='stop'):void {const g=this.#grant;this.#grant=null;this.#abort?.abort();if(!this.#frameActive){this.#release?.();this.#release=null;}if(!g)return;try{const t=this.options.budget.getTransfer(this.#id(g));if(t&&!t.pending)this.options.budget.finish(t.id,true);}finally{this.#hook(event,g);}}
  get status(){this.tick();return {active:this.#grant!==null,busy:this.#frameActive,quarantined:this.#quarantined,grant:this.#grant?structuredClone(this.#grant):null,recordingEnabled:false,physicalMedia:false,observedDelivery:false};}
}
/** LivePolicyEvaluator composition hook. This is a policy snapshot, not a
 * transport reservation or a viewer-delivery observation. */
export function capturePreviewPolicy(budget:TransferBudget,bitrate:number,durationMs=15000){
  const s=budget.status,p=budget.policy,needed=Math.ceil(bitrate*durationMs/8000),known=!s.degraded&&s.coverage==='complete'&&s.remainingBytes!==null;
  const profile=Number.isInteger(bitrate)&&bitrate>0&&bitrate<=p.stream.maxBitrate&&Number.isInteger(durationMs)&&durationMs>=1&&durationMs<=p.stream.maxDurationMs;
  const allow=known&&profile&&s.remainingBytes!>=needed;
  return {allow,reason:!known?'metering-unavailable' as const:!profile?'profile-denied' as const:allow?'within-budget' as const:'budget-exhausted' as const,revision:p.revision,layer:known?'application-payload' as const:'unknown' as const,remainingBytes:known?String(s.remainingBytes):null,maxUpstreamBps:p.stream.maxBitrate};
}
