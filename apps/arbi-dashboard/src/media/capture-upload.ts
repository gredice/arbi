import { Readable } from 'node:stream';
import { configurationDigest } from '@arbi/protocol';
import { validateCaptureTrace,verifyCaptureUpload } from '@arbi/protocol/capture-upload';
import type { CaptureTrace,CaptureUploadPort,CaptureUploadReceipt } from '@arbi/protocol/capture-upload';
import type { CaptureManifest } from '@arbi/protocol/capture-transfer';
import type { AuthorizedContext } from '@arbi/gredice';
import { sameRealm } from '@arbi/gredice';
import { MediaError,requireMedia,unavailableMetadata } from './contracts';
import type { CaptureMetadata,PrivateObjectStore,UploadInput } from './contracts';
import { PostgresMediaStore } from './store';
import { MediaService } from './service';
/** Explicit test-realm service bridge to actual PostgreSQL/PrivateObjectStore.
 * Current service identity is resolved on each boundary. No public route or
 * default provider credentials enable this composition. */
export class CaptureMediaUpload implements CaptureUploadPort {
  constructor(readonly options:{store:PostgresMediaStore;objects:PrivateObjectStore;authority:(signal:AbortSignal)=>Promise<AuthorizedContext>;request?:typeof fetch;now?:()=>number;
    /** Trusted immutable historical configuration resolver; never a browser label. */
    association?:(manifest:CaptureManifest,signal:AbortSignal)=>Promise<{bedId:string;plantId:string|null}|null>}){}
  async #prepare(trace:CaptureTrace,signal:AbortSignal){
    validateCaptureTrace(trace);const context=await this.options.authority(signal),now=(this.options.now??Date.now)();
    requireMedia(!signal.aborted&&context.actor.kind==='service'&&context.capability==='capture.request'&&context.expiresAtMs>now&&trace.manifest.realm.environment==='test'&&sameRealm(context.realm,trace.manifest.realm)&&context.siteId===trace.manifest.siteId,'DENIED');
    const m=trace.manifest,a=trace.artifact,metadata:CaptureMetadata={...unavailableMetadata(),capture:{status:'available',id:a.id},job:{status:'available',id:m.correlationId},provenance:'trusted-capture-record',trace:structuredClone(trace)};
    const config=m.metadata.configuration as {calibrationRevision:string},time=m.metadata.capturedAt as {utc:string|null;uncertaintyMs:number|null},pose=m.metadata.requestedPose as {frame:{name:string;revision:string}};
    metadata.calibration={status:'available',id:config.calibrationRevision};metadata.bed={status:'unavailable',reason:'not-associated'};metadata.plant={status:'unavailable',reason:'not-associated'};
    const requestId=`capture-${configurationDigest([m.realm,m.siteId,a.id]).slice(0,48)}`,existing=await this.options.store.transact(context.realm,context.siteId,tx=>tx.replay(context,requestId));
    if(existing){requireMedia(existing.metadata.trace&&configurationDigest(existing.metadata.trace)===configurationDigest(trace),'CONFLICT');metadata.bed=structuredClone(existing.metadata.bed);metadata.plant=structuredClone(existing.metadata.plant);}
    else {const association=await this.options.association?.(structuredClone(m),signal);if(association){metadata.bed={status:'available',id:association.bedId};if(association.plantId)metadata.plant={status:'available',id:association.plantId};}}
    if(time.utc!==null)metadata.capturedAt={status:'available',utc:time.utc,uncertaintyMs:time.uncertaintyMs};
    metadata.framing={status:'available',frameId:pose.frame.name,revision:pose.frame.revision};
    const service=new MediaService(this.options.store,this.options.objects,async q=>({site:{realm:q.site.realm,siteId:q.site.siteId,accountId:q.site.accountId,executionMode:q.site.executionMode},metadata}),this.options.now??Date.now);
    const request:UploadInput={requestId,variant:'full',imageId:null,captureId:a.id,size:a.bytes,contentType:a.contentType,sha256:a.sha256,width:a.widthPx,height:a.heightPx};
    const prepared=await service.upload(context,request);requireMedia(!signal.aborted,'UNAVAILABLE');return {context,service,prepared,request};
  }
  #receipt(trace:CaptureTrace,image:{id:string;metadata:CaptureMetadata;variants:Record<string,unknown>}):CaptureUploadReceipt {
    requireMedia(image.metadata.trace&&configurationDigest(image.metadata.trace)===configurationDigest(trace),'CONFLICT');
    const r:CaptureUploadReceipt={artifactId:trace.artifact.id,imageId:image.id,sha256:trace.artifact.sha256,bytes:trace.artifact.bytes,traceDigest:configurationDigest(trace),verified:true};verifyCaptureUpload(r,trace);return r;
  }
  async inspect(trace:CaptureTrace,signal:AbortSignal):Promise<CaptureUploadReceipt|null> {
    const p=await this.#prepare(trace,signal);
    try{const image=await p.service.complete(p.context,{imageId:p.prepared.imageId,uploadId:p.prepared.uploadId,variant:'full'});await this.#current(trace,p.context,signal);return this.#receipt(trace,image);}
    catch(e){if(e instanceof MediaError&&e.code==='MISSING_OBJECT')return null;throw e;}
  }
  async #current(trace:CaptureTrace,prior:AuthorizedContext,signal:AbortSignal){const c=await this.options.authority(signal);requireMedia(!signal.aborted&&c.actor.kind==='service'&&c.actor.id===prior.actor.id&&c.capability==='capture.request'&&sameRealm(c.realm,trace.manifest.realm)&&c.siteId===trace.manifest.siteId&&c.accountId===prior.accountId&&c.expiresAtMs>(this.options.now??Date.now)(),'DENIED');}
  async upload(trace:CaptureTrace,body:AsyncIterable<Uint8Array>,signal:AbortSignal):Promise<CaptureUploadReceipt> {
    const p=await this.#prepare(trace,signal);if(p.prepared.state==='ready'){await this.#current(trace,p.context,signal);return this.#receipt(trace,await p.service.complete(p.context,{imageId:p.prepared.imageId,uploadId:p.prepared.uploadId,variant:'full'}));}
    // The URL originates in PrivateObjectStore; no caller URL or redirect is fetched.
    const stream=Readable.from(body),init:RequestInit&{duplex:'half'}={method:'PUT',redirect:'error',headers:{'content-type':'image/png','content-length':String(trace.artifact.bytes)},body:Readable.toWeb(stream) as ReadableStream<Uint8Array>,duplex:'half',signal};
    const response=await (this.options.request??fetch)(p.prepared.putUrl!,init);
    requireMedia(response.ok||response.status===409,'UNAVAILABLE');await this.#current(trace,p.context,signal);
    const image=await p.service.complete(p.context,{imageId:p.prepared.imageId,uploadId:p.prepared.uploadId,variant:'full'});await this.#current(trace,p.context,signal);return this.#receipt(trace,image);
  }
}
