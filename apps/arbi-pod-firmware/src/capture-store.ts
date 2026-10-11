import { createHash,createPublicKey,randomUUID } from 'node:crypto';
import type { KeyObject } from 'node:crypto';
import { constants,chmodSync,closeSync,fstatSync,fsyncSync,lstatSync,openSync,readSync,realpathSync,renameSync,statSync,unlinkSync,writeSync } from 'node:fs';
import { basename,dirname,join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { configurationDigest } from '@arbi/protocol';
import type { Identity,Realm } from '@arbi/protocol';
import { closedTransfer,manifestDigest,validateCaptureManifest,verifyOwnerReceipt } from '@arbi/protocol/capture-transfer';
import type { CaptureManifest,CaptureOwnerReceipt } from '@arbi/protocol/capture-transfer';
import { validateCapturedPng } from './capture-camera.js';
export class CaptureError extends Error {constructor(readonly code:string){super(code);}}
export interface RawImage {id:string;file:string;sha256:string;bytes:number;contentType:'image/png';widthPx:number;heightPx:number}
export interface CaptureRecord {version:'arbi.capture-result/1.0';commandId:string;correlationId:string;resourceId:string;fingerprint:string;
  state:'reserved'|'writing'|'captured'|'failed';phase:string;reason:string|null;image:RawImage|null;metadata:Record<string,unknown>|null}
interface Delivery {version:'arbi.capture-retention/1.0';state:'acknowledged'|'release-intent'|'released';receipt:CaptureOwnerReceipt;publicKeyDer:string}
export interface CaptureTransferProgress {version:'arbi.capture-progress/1.0';manifestDigest:string;epoch:string;offset:number;attempts:number;nextRetryMs:number;state:'paused'|'transferring'|'owned'|'failed'}
const digest=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const id=(v:string)=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/u.test(v);
function reject(code:string):never {throw new CaptureError(code);}
/** Native isolated storage. No hardware capture, cloud upload or authorized
 * media access is implied by a file/receipt. Fixed quota refuses unowned loss. */
export class CaptureStore {
  #db!:DatabaseSync;#lock:DatabaseSync;#root:string;#closed=false;#bindingDigest:string;#maxRecords:number;#maxBytes:number;
  constructor(readonly options:{root:string;binding:unknown;maxRecords?:number;maxBytes?:number;fault?:(point:string)=>void}) {
    this.options={...options,binding:structuredClone(options.binding)};this.#bindingDigest=configurationDigest(this.options.binding);
    const root=realpathSync(options.root);if(dirname(root)!==realpathSync(tmpdir())||!basename(root).startsWith('arbi-pod-capture-')||!statSync(root).isDirectory()||(statSync(root).mode&0o077))reject('ISOLATED_STORAGE_REQUIRED');this.#root=root;
    if(!Number.isSafeInteger(options.maxRecords??128)||(options.maxRecords??128)<1||(options.maxRecords??128)>128||!Number.isSafeInteger(options.maxBytes??67108864)||(options.maxBytes??67108864)<1||(options.maxBytes??67108864)>67108864)reject('STORAGE_POLICY_REQUIRED');
    this.#maxRecords=options.maxRecords??128;this.#maxBytes=options.maxBytes??67108864;
    for(const file of ['capture-lock.sqlite','captures.sqlite']){const s=lstatSync(join(root,file),{throwIfNoEntry:false});if(s&&(!s.isFile()||s.nlink!==1||s.size>8388608||(s.mode&0o077)))reject('ISOLATED_STORAGE_REQUIRED');}
    this.#lock=new DatabaseSync(join(root,'capture-lock.sqlite'));
    try{chmodSync(join(root,'capture-lock.sqlite'),0o600);this.#lock.exec('PRAGMA busy_timeout=0;CREATE TABLE IF NOT EXISTS owner(id INTEGER PRIMARY KEY);BEGIN EXCLUSIVE');}catch{this.#lock.close();reject('CAPTURE_STORE_BUSY');}
    try {
      this.#db=new DatabaseSync(join(root,'captures.sqlite'));chmodSync(join(root,'captures.sqlite'),0o600);
      this.#db.exec('PRAGMA busy_timeout=0;PRAGMA synchronous=FULL;PRAGMA max_page_count=2048;CREATE TABLE IF NOT EXISTS binding(digest TEXT PRIMARY KEY);CREATE TABLE IF NOT EXISTS captures(id TEXT PRIMARY KEY,record TEXT NOT NULL);CREATE TABLE IF NOT EXISTS deliveries(id TEXT PRIMARY KEY,body TEXT NOT NULL,hash TEXT NOT NULL);CREATE TABLE IF NOT EXISTS transfer_progress(id TEXT PRIMARY KEY,body TEXT NOT NULL,hash TEXT NOT NULL)');
      const binding=configurationDigest(options.binding),old=this.#db.prepare('SELECT digest FROM binding').get() as {digest:string}|undefined;
      if(old&&old.digest!==binding)reject('CAPTURE_SCOPE_MISMATCH');if(!old)this.#db.prepare('INSERT INTO binding VALUES(?)').run(binding);
      for(const r of this.records()) {
        const delivery=this.delivery(r.commandId);if(delivery?.state==='release-intent')this.releaseAcknowledged(r.commandId);
        if(r.state==='writing') {try{this.readImage(r);this.#put({...r,state:'captured',phase:'captured',reason:'RECOVERED_COMMITTED_RAW_IMAGE'});}catch{this.fail(r.commandId,'INTERRUPTED_WRITE_NO_REPLAY');}}
        else if(r.state==='reserved')this.fail(r.commandId,'CAPTURE_INTERRUPTED_NO_REPLAY');
      }
    } catch(e){this.close();throw e;}
  }
  close(){if(this.#closed)return;this.#closed=true;this.#db?.close();try{this.#lock.exec('ROLLBACK');}catch{}this.#lock.close();}
  get bindingDigest(){return this.#bindingDigest;}
  get maximumImageBytes(){return Math.min(8388608,this.#maxBytes);}
  #put(r:CaptureRecord){const text=JSON.stringify(r);if(Buffer.byteLength(text)>32768)reject('CAPTURE_METADATA_LIMIT');this.#parse(text);this.#db.prepare('INSERT INTO captures(id,record) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET record=excluded.record').run(r.commandId,text);}
  #parse(text:string):CaptureRecord {
    if(Buffer.byteLength(text)>32768)reject('CORRUPT_CAPTURE_RECEIPT');const r=JSON.parse(text) as CaptureRecord;
    if(Object.keys(r).sort().join()!==['version','commandId','correlationId','resourceId','fingerprint','state','phase','reason','image','metadata'].sort().join()
      ||r.version!=='arbi.capture-result/1.0'||!id(r.commandId)||!id(r.correlationId)||!id(r.resourceId)||!/^[a-f0-9]{64}$/u.test(r.fingerprint)
      ||!['reserved','writing','captured','failed'].includes(r.state)||typeof r.phase!=='string'||r.phase.length>64||!(r.reason===null||id(r.reason)))reject('CORRUPT_CAPTURE_RECEIPT');
    if(r.image&&(Object.keys(r.image).sort().join()!==['id','file','sha256','bytes','contentType','widthPx','heightPx'].sort().join()||!id(r.image.id)||r.image.file!==`${r.image.id}.png`
      ||!/^[a-f0-9]{64}$/u.test(r.image.sha256)||!Number.isSafeInteger(r.image.bytes)||r.image.bytes<24||r.image.bytes>8388608||r.image.contentType!=='image/png'
      ||![r.image.widthPx,r.image.heightPx].every(n=>Number.isSafeInteger(n)&&n>0&&n<=512)))reject('CORRUPT_CAPTURE_RECEIPT');
    if(r.metadata!==null&&(typeof r.metadata!=='object'||Array.isArray(r.metadata)))reject('CORRUPT_CAPTURE_RECEIPT');
    if(['writing','captured'].includes(r.state)&&(!r.image||!r.metadata))reject('CORRUPT_CAPTURE_RECEIPT');return r;
  }
  get(commandId:string){const row=this.#db.prepare('SELECT record FROM captures WHERE id=?').get(commandId) as {record:string}|undefined;return row?this.#parse(row.record):null;}
  records(){const rows=this.#db.prepare('SELECT record FROM captures ORDER BY rowid').all() as {record:string}[];if(rows.length>this.#maxRecords)reject('CAPTURE_RECEIPT_LIMIT');return rows.map(r=>this.#parse(r.record));}
  reserve(input:Pick<CaptureRecord,'commandId'|'correlationId'|'resourceId'|'fingerprint'>){
    if(Object.keys(input).sort().join()!==['commandId','correlationId','resourceId','fingerprint'].sort().join())reject('INVALID_CAPTURE_ID');
    if(!id(input.commandId)||!id(input.correlationId)||!id(input.resourceId)||!/^[a-f0-9]{64}$/u.test(input.fingerprint))reject('INVALID_CAPTURE_ID');const old=this.get(input.commandId);
    if(old){if(old.fingerprint!==input.fingerprint)reject('IDEMPOTENCY_CONFLICT');return old;}if(this.records().length>=this.#maxRecords)reject('CAPTURE_RECEIPT_LIMIT');
    const r:CaptureRecord={version:'arbi.capture-result/1.0',...input,state:'reserved',phase:'admitted',reason:null,image:null,metadata:null};this.#put(r);this.options.fault?.('after-reservation');return r;
  }
  phase(commandId:string,phase:string){const r=this.get(commandId);if(!r||r.state!=='reserved'||!id(phase))reject('CAPTURE_INVALID_STATE');this.#put({...r,phase});}
  fail(commandId:string,reason:string){const r=this.get(commandId);if(!r||!id(reason))reject('CAPTURE_INVALID_STATE');if(r.state!=='captured')this.#put({...r,state:'failed',reason});return this.get(commandId)!;}
  publish(commandId:string,bytes:Buffer,widthPx:number,heightPx:number,metadata:Record<string,unknown>){
    const r=this.get(commandId);if(!r||r.state!=='reserved')reject('CAPTURE_INVALID_STATE');
    if(!Buffer.isBuffer(bytes)||bytes.length<24||bytes.length>8388608||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
      ||bytes.subarray(12,16).toString('ascii')!=='IHDR'||bytes.readUInt32BE(16)!==widthPx||bytes.readUInt32BE(20)!==heightPx
      ||![widthPx,heightPx].every(n=>Number.isSafeInteger(n)&&n>0&&n<=512)||Buffer.byteLength(JSON.stringify(metadata))>24576)reject('INVALID_RAW_CAPTURE');
    try{validateCapturedPng(bytes,widthPx,heightPx);}catch{reject('INVALID_RAW_CAPTURE');}
    const used=this.retentionStatus().retainedBytes;if(used+bytes.length>this.#maxBytes)reject('CAPTURE_STORAGE_FULL');
    const image:RawImage={id:randomUUID(),file:'',sha256:digest(bytes),bytes:bytes.length,contentType:'image/png',widthPx,heightPx};image.file=`${image.id}.png`;
    const writing:CaptureRecord={...r,state:'writing',phase:'write',image,metadata:structuredClone(metadata)};this.#put(writing);this.options.fault?.('after-image-intent');
    const part=join(this.#root,`${image.id}.part`),path=join(this.#root,image.file);let fd:number|undefined;
    try{fd=openSync(part,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);let n=0;while(n<bytes.length){const count=writeSync(fd,bytes,n,bytes.length-n);if(!count)reject('CAPTURE_WRITE_FAILED');n+=count;}fsyncSync(fd);closeSync(fd);fd=undefined;
      this.options.fault?.('after-part-write');renameSync(part,path);const dir=openSync(this.#root,constants.O_RDONLY|constants.O_DIRECTORY);try{fsyncSync(dir);}finally{closeSync(dir);}this.options.fault?.('after-rename');
      this.readImage(writing);this.#put({...writing,state:'captured',phase:'captured'});this.options.fault?.('after-finalize');return this.get(commandId)!;
    } finally{if(fd!==undefined)closeSync(fd);}
  }
  readImage(r:CaptureRecord){if(this.delivery(r.commandId)?.state==='released')reject('RAW_IMAGE_TRANSFERRED');if(!r.image)reject('RAW_IMAGE_UNAVAILABLE');if(!id(r.image.id)||r.image.file!==`${r.image.id}.png`||!Number.isSafeInteger(r.image.bytes)||r.image.bytes<24||r.image.bytes>8388608||!/^[a-f0-9]{64}$/u.test(r.image.sha256))reject('INVALID_RAW_CAPTURE');
    const path=join(this.#root,r.image.file),info=statSync(path,{throwIfNoEntry:false});
    if(!info?.isFile()||info.nlink!==1||info.size!==r.image.bytes||(info.mode&0o077))reject('RAW_IMAGE_CORRUPT');const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);
    try{if(fstatSync(fd).size!==r.image.bytes)reject('RAW_IMAGE_CORRUPT');const bytes=Buffer.alloc(r.image.bytes+1);let n=0;while(n<bytes.length){const count=readSync(fd,bytes,n,bytes.length-n,null);if(!count)break;n+=count;}
      if(n!==r.image.bytes||digest(bytes.subarray(0,n))!==r.image.sha256)reject('RAW_IMAGE_CORRUPT');return bytes.subarray(0,n);}finally{closeSync(fd);}}
  manifest(commandId:string):CaptureManifest {
    const r=this.get(commandId);if(!r||r.state!=='captured'||!r.image||!r.metadata)reject('RAW_IMAGE_UNAVAILABLE');
    const {file:_,...image}=r.image,m:CaptureManifest={version:'arbi.capture-manifest/1.0',realm:r.metadata.realm as Realm,siteId:r.metadata.siteId as string,podDeviceId:(r.metadata.source as Identity).deviceId,
      commandId:r.commandId,correlationId:r.correlationId,targetId:r.resourceId,captureFingerprint:r.fingerprint,image,metadata:structuredClone(r.metadata)};
    validateCaptureManifest(m);if(configurationDigest({realm:m.realm,siteId:m.siteId,deviceId:m.podDeviceId})!==this.#bindingDigest)reject('CAPTURE_SCOPE_MISMATCH');return m;
  }
  #saveDelivery(commandId:string,d:Delivery):void {const body=JSON.stringify(d);if(Buffer.byteLength(body)>8192)reject('CAPTURE_DELIVERY_INVALID');this.#db.prepare('INSERT INTO deliveries VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body,hash=excluded.hash').run(commandId,body,configurationDigest(d));}
  delivery(commandId:string):Delivery|null {
    const row=this.#db.prepare('SELECT body,hash FROM deliveries WHERE id=?').get(commandId);if(!row)return null;if(Buffer.byteLength(String(row.body))>8192)reject('CAPTURE_DELIVERY_INVALID');const d=JSON.parse(String(row.body)) as Delivery;
    closedTransfer(d,['version','state','receipt','publicKeyDer']);if(d.version!=='arbi.capture-retention/1.0'||!['acknowledged','release-intent','released'].includes(d.state)||typeof d.publicKeyDer!=='string'||d.publicKeyDer.length>256||configurationDigest(d)!==row.hash)reject('CAPTURE_DELIVERY_INVALID');
    const key=createPublicKey({key:Buffer.from(d.publicKeyDer,'base64'),type:'spki',format:'der'});verifyOwnerReceipt(d.receipt,this.manifest(commandId),d.receipt.edge,key);return d;
  }
  acknowledgeTransfer(commandId:string,receipt:CaptureOwnerReceipt,edge:Identity,key:KeyObject):void {
    const m=this.manifest(commandId);verifyOwnerReceipt(receipt,m,edge,key);const old=this.delivery(commandId);
    if(old){if(old.receipt.manifestDigest!==receipt.manifestDigest||old.receipt.storageId!==receipt.storageId)reject('CAPTURE_DELIVERY_CONFLICT');return;}
    this.readImage(this.get(commandId)!);this.#saveDelivery(commandId,{version:'arbi.capture-retention/1.0',state:'acknowledged',receipt:structuredClone(receipt),publicKeyDer:key.export({type:'spki',format:'der'}).toString('base64')});this.options.fault?.('after-transfer-ack');
  }
  releaseAcknowledged(commandId:string):void {
    const d=this.delivery(commandId),r=this.get(commandId);if(!d||!r?.image)reject('CAPTURE_OWNERSHIP_REQUIRED');if(d.state==='released')return;
    if(d.state==='acknowledged'){d.state='release-intent';this.#saveDelivery(commandId,d);this.options.fault?.('after-release-intent');}
    const path=join(this.#root,r.image.file),s=lstatSync(path,{throwIfNoEntry:false});if(s){if(!s.isFile()||s.nlink!==1||(s.mode&0o077))reject('RAW_IMAGE_CORRUPT');unlinkSync(path);}
    const dir=openSync(this.#root,constants.O_RDONLY|constants.O_DIRECTORY);try{fsyncSync(dir);}finally{closeSync(dir);}this.options.fault?.('after-release-unlink');d.state='released';this.#saveDelivery(commandId,d);this.options.fault?.('after-release-finalize');
  }
  retentionStatus():{retainedBytes:number;acknowledged:number;released:number;records:number} {
    let retainedBytes=0,acknowledged=0,released=0;const rows=this.records();for(const r of rows){const d=this.delivery(r.commandId);if(d?.state==='released')released++;else{retainedBytes+=r.image?.bytes??0;if(d)acknowledged++;}}
    return {retainedBytes,acknowledged,released,records:rows.length};
  }
  transferProgress(commandId:string):CaptureTransferProgress|null {
    const row=this.#db.prepare('SELECT body,hash FROM transfer_progress WHERE id=?').get(commandId);if(!row)return null;const p=JSON.parse(String(row.body)) as CaptureTransferProgress;this.#validateProgress(commandId,p);if(configurationDigest(p)!==row.hash)reject('CAPTURE_PROGRESS_INVALID');return p;
  }
  #validateProgress(commandId:string,p:CaptureTransferProgress):void {
    closedTransfer(p,['version','manifestDigest','epoch','offset','attempts','nextRetryMs','state']);const m=this.manifest(commandId);
    if(p.version!=='arbi.capture-progress/1.0'||p.manifestDigest!==manifestDigest(m)||!id(p.epoch)||!Number.isSafeInteger(p.offset)||p.offset<0||p.offset>m.image.bytes||!Number.isInteger(p.attempts)||p.attempts<0||p.attempts>512||!Number.isSafeInteger(p.nextRetryMs)||p.nextRetryMs<0||!['paused','transferring','owned','failed'].includes(p.state))reject('CAPTURE_PROGRESS_INVALID');
  }
  saveTransferProgress(commandId:string,p:CaptureTransferProgress):void {this.#validateProgress(commandId,p);this.#db.prepare('INSERT INTO transfer_progress VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body,hash=excluded.hash').run(commandId,JSON.stringify(p),configurationDigest(p));}
}
