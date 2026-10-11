/** Private isolated capture-to-media composition. Public actuator and media
 * grants keep their existing versions; this envelope preserves original facts. */
import { configurationDigest } from './configuration.js';
import { boundedTransferMetadata,closedTransfer,transferFail,transferHash,transferId,validateCaptureManifest } from './capture-transfer.js';
import type { CaptureManifest } from './capture-transfer.js';
export interface CaptureArtifact {id:string;kind:'raw'|'rectified';sha256:string;bytes:number;contentType:'image/png';widthPx:number;heightPx:number}
export interface CaptureTrace {
  version:'arbi.capture-upload/1.0';manifest:CaptureManifest;artifact:CaptureArtifact;
  processing:{state:'rectified'|'failed'|'unavailable';reason:string|null;algorithmRevision:string;derivative:Record<string,unknown>|null};
}
export interface CaptureUploadReceipt {artifactId:string;imageId:string;sha256:string;bytes:number;traceDigest:string;verified:true}
export interface CaptureUploadPort {
  /** Inspect existing immutable identity before reading or retransmitting data. */
  inspect(trace:CaptureTrace,signal:AbortSignal):Promise<CaptureUploadReceipt|null>;
  upload(trace:CaptureTrace,body:AsyncIterable<Uint8Array>,signal:AbortSignal):Promise<CaptureUploadReceipt>;
}
export function validateCaptureTrace(t:CaptureTrace):void {
  closedTransfer(t,['version','manifest','artifact','processing']);validateCaptureManifest(t.manifest);
  if(t.version!=='arbi.capture-upload/1.0')transferFail('UPLOAD_TRACE_INVALID');
  const a=t.artifact,p=t.processing;closedTransfer(a,['id','kind','sha256','bytes','contentType','widthPx','heightPx']);
  closedTransfer(p,['state','reason','algorithmRevision','derivative']);
  if(!transferId(a.id)||!transferHash(a.sha256)||!['raw','rectified'].includes(a.kind)||a.contentType!=='image/png'||!Number.isSafeInteger(a.bytes)||a.bytes<57||a.bytes>8388608||![a.widthPx,a.heightPx].every(n=>Number.isInteger(n)&&n>=2&&n<=512)
    ||!['rectified','failed','unavailable'].includes(p.state)||!(p.reason===null||transferId(p.reason))||typeof p.algorithmRevision!=='string'||!/^arbi\.[A-Za-z0-9.-]+\/1\.0$/u.test(p.algorithmRevision))transferFail('UPLOAD_TRACE_INVALID');
  if(p.state==='rectified') {
    const d=p.derivative;if(!d)transferFail('UPLOAD_TRACE_INVALID');boundedTransferMetadata(d);
    if(!transferId(d.id)||!transferHash(d.sha256)||d.originalId!==t.manifest.image.id||d.originalSha256!==t.manifest.image.sha256||d.algorithmRevision!==p.algorithmRevision||!transferId(d.calibrationRevision)||!transferHash(d.calibrationDigest))transferFail('UPLOAD_TRACE_INVALID');
    if(a.kind==='rectified'&&['id','sha256','bytes','contentType','widthPx','heightPx'].some(k=>a[k as keyof CaptureArtifact]!==d[k]))transferFail('UPLOAD_TRACE_INVALID');
  } else if(p.derivative!==null||p.reason===null||a.kind==='rectified')transferFail('UPLOAD_TRACE_INVALID');
  if(a.kind==='raw'&&['id','sha256','bytes','contentType','widthPx','heightPx'].some(k=>a[k as keyof CaptureArtifact]!==t.manifest.image[k as keyof CaptureManifest['image']]))transferFail('UPLOAD_TRACE_INVALID');
  if(Buffer.byteLength(JSON.stringify(t))>49152)transferFail('UPLOAD_TRACE_INVALID');
}
export function verifyCaptureUpload(r:CaptureUploadReceipt,t:CaptureTrace):void {
  validateCaptureTrace(t);closedTransfer(r,['artifactId','imageId','sha256','bytes','traceDigest','verified']);
  if(r.verified!==true||!transferId(r.imageId)||r.artifactId!==t.artifact.id||r.sha256!==t.artifact.sha256||r.bytes!==t.artifact.bytes||r.traceDigest!==configurationDigest(t))transferFail('UPLOAD_RECEIPT_INVALID');
}
