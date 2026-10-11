/** Private Node adapter contract shared by actual pod/edge consumers. This is
 * not a new actuator message, public media grant or physical transport profile. */
import { createHash,sign,verify } from 'node:crypto';
import type { KeyObject } from 'node:crypto';
import { configurationDigest } from './configuration.js';
import type { Identity,IngestTime,Realm } from './messages.js';
export class CaptureTransferError extends Error {constructor(readonly code:string){super(code);}}
export function transferFail(code:string):never {throw new CaptureTransferError(code);}
export const transferId=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(v);
export const transferHash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v);
export const payloadDigest=(bytes:Uint8Array):string=>createHash('sha256').update(bytes).digest('hex');
export function closedTransfer(v:unknown,fields:string[]):asserts v is Record<string,unknown> {
  if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==fields.length||fields.some(k=>!Object.hasOwn(v,k)))transferFail('TRANSFER_INVALID');
}
export function transferIdentity(v:Identity):void {closedTransfer(v,['deviceId','bootId','sessionId']);if(![v.deviceId,v.bootId,v.sessionId].every(transferId))transferFail('TRANSFER_IDENTITY_INVALID');}
export interface CaptureManifest {
  version:'arbi.capture-manifest/1.0';realm:Realm;siteId:string;podDeviceId:string;
  commandId:string;correlationId:string;targetId:string;captureFingerprint:string;
  image:{id:string;sha256:string;bytes:number;contentType:'image/png';widthPx:number;heightPx:number};metadata:Record<string,unknown>;
}
function metadata(v:unknown,depth=0,budget={nodes:0}):void {
  if(++budget.nodes>2048||depth>12)transferFail('TRANSFER_METADATA_INVALID');
  if(v===null||typeof v==='boolean')return;
  if(typeof v==='string'){if(v.length>1024)transferFail('TRANSFER_METADATA_INVALID');return;}
  if(typeof v==='number'){if(!Number.isFinite(v))transferFail('TRANSFER_METADATA_INVALID');return;}
  if(Array.isArray(v)){if(v.length>128)transferFail('TRANSFER_METADATA_INVALID');v.forEach(x=>metadata(x,depth+1,budget));return;}
  if(typeof v!=='object'||Object.getPrototypeOf(v)!==Object.prototype||Object.keys(v).length>64)transferFail('TRANSFER_METADATA_INVALID');
  for(const [key,value] of Object.entries(v)){if(!/^[A-Za-z][A-Za-z0-9]{0,63}$/u.test(key)||/^(password|secret|credential|privateKey|accessToken|refreshToken|authorization|url|path)$/iu.test(key))transferFail('TRANSFER_METADATA_INVALID');metadata(value,depth+1,budget);}
}
export function boundedTransferMetadata(v:unknown):void {metadata(v);if(Buffer.byteLength(JSON.stringify(v))>32768)transferFail('TRANSFER_METADATA_INVALID');}
export function validateCaptureManifest(m:CaptureManifest):void {
  closedTransfer(m,['version','realm','siteId','podDeviceId','commandId','correlationId','targetId','captureFingerprint','image','metadata']);
  // This source slice accepts only the existing isolated test realm.
  closedTransfer(m.realm,['environment','namespaceId']);
  if(m.version!=='arbi.capture-manifest/1.0'||m.realm.environment!=='test'||![m.realm.namespaceId,m.siteId,m.podDeviceId,m.commandId,m.correlationId,m.targetId].every(transferId)||!transferHash(m.captureFingerprint))transferFail('TRANSFER_INVALID');
  const i=m.image;closedTransfer(i,['id','sha256','bytes','contentType','widthPx','heightPx']);
  if(!transferId(i.id)||!transferHash(i.sha256)||!Number.isSafeInteger(i.bytes)||i.bytes<57||i.bytes>8388608||i.contentType!=='image/png'||![i.widthPx,i.heightPx].every(n=>Number.isInteger(n)&&n>=2&&n<=512))transferFail('TRANSFER_INVALID');
  closedTransfer(m.metadata,['version','origin','request','source','realm','siteId','resourceId','jobId','targetId','capturedAt','requestedPose','availablePose','gimbal','camera','focus','preview','profile','build','configuration','processing','upload','physicalCamera']);metadata(m.metadata);
  if(m.metadata.version!=='arbi.raw-capture/1.0'||m.metadata.origin!=='simulated'||m.metadata.physicalCamera!==false||m.metadata.siteId!==m.siteId||m.metadata.resourceId!==m.targetId||m.metadata.targetId!==m.targetId||m.metadata.jobId!==m.correlationId||configurationDigest(m.metadata.realm)!==configurationDigest(m.realm))transferFail('TRANSFER_METADATA_INVALID');
  const source=m.metadata.source as Identity;transferIdentity(source);if(source.deviceId!==m.podDeviceId)transferFail('TRANSFER_METADATA_INVALID');
  const request=m.metadata.request as Record<string,unknown>;if(request.commandId!==m.commandId||request.correlationId!==m.correlationId)transferFail('TRANSFER_METADATA_INVALID');
  if(Buffer.byteLength(JSON.stringify(m))>32768)transferFail('TRANSFER_METADATA_INVALID');
}
export const manifestDigest=(m:CaptureManifest):string=>{validateCaptureManifest(m);return configurationDigest(m);};
export interface CaptureOwnerReceipt {
  version:'arbi.capture-owner/1.0';manifestDigest:string;imageId:string;imageSha256:string;bytes:number;
  realm:Realm;siteId:string;podDeviceId:string;edge:Identity;storageId:string;durable:true;signature:string;
}
function receiptBody(r:CaptureOwnerReceipt):Omit<CaptureOwnerReceipt,'signature'> {const {signature:_,...body}=r;return body;}
function receiptBytes(body:Omit<CaptureOwnerReceipt,'signature'>):Buffer {return Buffer.from(`arbi.capture-owner/1.0\n${configurationDigest(body)}`);}
export function ownerReceipt(m:CaptureManifest,edge:Identity,storageId:string,key:KeyObject):CaptureOwnerReceipt {
  transferIdentity(edge);if(!transferId(storageId)||key.type!=='private'||key.asymmetricKeyType!=='ed25519')transferFail('TRANSFER_TRUST_INVALID');
  const body:Omit<CaptureOwnerReceipt,'signature'>={version:'arbi.capture-owner/1.0',manifestDigest:manifestDigest(m),imageId:m.image.id,imageSha256:m.image.sha256,bytes:m.image.bytes,realm:structuredClone(m.realm),siteId:m.siteId,podDeviceId:m.podDeviceId,edge:structuredClone(edge),storageId,durable:true};
  return {...body,signature:sign(null,receiptBytes(body),key).toString('base64')};
}
export function verifyOwnerReceipt(r:CaptureOwnerReceipt,m:CaptureManifest,edge:Identity,key:KeyObject):void {
  closedTransfer(r,['version','manifestDigest','imageId','imageSha256','bytes','realm','siteId','podDeviceId','edge','storageId','durable','signature']);transferIdentity(r.edge);transferIdentity(edge);
  if(r.version!=='arbi.capture-owner/1.0'||r.durable!==true||r.manifestDigest!==manifestDigest(m)||r.imageId!==m.image.id||r.imageSha256!==m.image.sha256||r.bytes!==m.image.bytes||r.siteId!==m.siteId||r.podDeviceId!==m.podDeviceId||configurationDigest(r.realm)!==configurationDigest(m.realm)||configurationDigest(r.edge)!==configurationDigest(edge)||!transferId(r.storageId)||typeof r.signature!=='string'||r.signature.length!==88||key.type!=='public'||key.asymmetricKeyType!=='ed25519')transferFail('TRANSFER_ACK_INVALID');
  const signature=Buffer.from(r.signature,'base64');if(signature.length!==64||signature.toString('base64')!==r.signature||!verify(null,receiptBytes(receiptBody(r)),key,signature))transferFail('TRANSFER_ACK_INVALID');
}
export type CaptureCursorKind='audit'|'usage'|'diagnostic';
export interface CaptureCursorReceipt {version:'arbi.pod-cursor/1.0';kind:CaptureCursorKind;id:string;contentHash:string;edge:Identity;durable:true;ingestTime:IngestTime;signature:string}
function cursorBytes(r:Omit<CaptureCursorReceipt,'signature'>):Buffer {return Buffer.from(`arbi.pod-cursor/1.0\n${configurationDigest(r)}`);}
function cursorFields(r:CaptureCursorReceipt):void {
  closedTransfer(r,['version','kind','id','contentHash','edge','durable','ingestTime','signature']);transferIdentity(r.edge);
  if(r.version!=='arbi.pod-cursor/1.0'||!['audit','usage','diagnostic'].includes(r.kind)||!transferId(r.id)||!transferHash(r.contentHash)||r.durable!==true||typeof r.signature!=='string'||r.signature.length!==88)transferFail('TRANSFER_CURSOR_INVALID');
  if(r.ingestTime!==null){closedTransfer(r.ingestTime,['utc','uncertaintyMs','deviceId']);const i=r.ingestTime;if(typeof i.utc!=='string'||i.utc.length!==24||!Number.isFinite(Date.parse(i.utc))||new Date(i.utc).toISOString()!==i.utc||!Number.isInteger(i.uncertaintyMs)||i.uncertaintyMs<0||i.uncertaintyMs>60000||!transferId(i.deviceId))transferFail('TRANSFER_CURSOR_INVALID');}
  if(r.kind==='audit'&&r.ingestTime===null)transferFail('TRANSFER_CLOCK_UNAVAILABLE');
}
export function cursorReceipt(kind:CaptureCursorKind,id:string,contentHash:string,edge:Identity,ingestTime:IngestTime,key:KeyObject):CaptureCursorReceipt {
  const body:Omit<CaptureCursorReceipt,'signature'>={version:'arbi.pod-cursor/1.0',kind,id,contentHash,edge:structuredClone(edge),durable:true,ingestTime:structuredClone(ingestTime)};
  if(key.type!=='private'||key.asymmetricKeyType!=='ed25519')transferFail('TRANSFER_TRUST_INVALID');const r={...body,signature:sign(null,cursorBytes(body),key).toString('base64')};cursorFields(r);return r;
}
export function verifyCursorReceipt(r:CaptureCursorReceipt,kind:CaptureCursorKind,id:string,hash:string,edge:Identity,key:KeyObject):void {
  cursorFields(r);const {signature,...body}=r,bytes=Buffer.from(signature,'base64');
  if(r.kind!==kind||r.id!==id||r.contentHash!==hash||configurationDigest(r.edge)!==configurationDigest(edge)||key.type!=='public'||key.asymmetricKeyType!=='ed25519'||bytes.length!==64||bytes.toString('base64')!==signature||!verify(null,cursorBytes(body),key,bytes))transferFail('TRANSFER_CURSOR_INVALID');
}
