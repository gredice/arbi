import { constants,chmodSync,closeSync,fstatSync,fsyncSync,lstatSync,openSync,readSync,realpathSync,renameSync,statSync,unlinkSync,writeSync } from 'node:fs';
import { basename,dirname,join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { configurationDigest } from '@arbi/protocol';
import type { Realm } from '@arbi/protocol';
import { payloadDigest,transferFail,transferId,validateCaptureManifest } from '@arbi/protocol/capture-transfer';
import type { CaptureManifest } from '@arbi/protocol/capture-transfer';
import { validateCaptureTrace,verifyCaptureUpload } from '@arbi/protocol/capture-upload';
import type { CaptureTrace,CaptureUploadReceipt } from '@arbi/protocol/capture-upload';
import type { CaptureReceiver } from './capture-receiver.js';
import { originalFromCapture } from './contracts.js';
import type { Calibration } from './contracts.js';
import type { ImageProcessor } from './processor.js';
import { decodePng } from './png.js';
export interface StagedArtifact {trace:CaptureTrace;upload:{state:'pending'|'uploaded'|'failed';attempts:number;reason:string|null;receipt:CaptureUploadReceipt|null}}
export interface StagedCapture {version:'arbi.capture-stage/1.0';manifest:CaptureManifest;state:'writing'|'retained'|'failed'|'expiring'|'expired'|'corrupt';expiresUtcMs:number;artifacts:StagedArtifact[];events:string[]}
/** Bounded private files and native SQLite receipts. Capture custody stays with
 * CaptureReceiver; expiry releases only this optional WAN staging copy. */
export class CaptureStage {
  #db!:DatabaseSync;#lock:DatabaseSync;#root:string;#closed=false;#busy=false;#maxBytes:number;#maxRecords:number;
  constructor(readonly options:{root:string;realm:Realm;siteId:string;maxBytes?:number;maxRecords?:number;fault?:(point:string)=>void}) {
    const root=realpathSync(options.root);if(dirname(root)!==realpathSync(tmpdir())||!basename(root).startsWith('arbi-capture-stage-')||!statSync(root).isDirectory()||(statSync(root).mode&0o077)||options.realm.environment!=='test'||![options.siteId,options.realm.namespaceId].every(transferId))transferFail('ISOLATED_STORAGE_REQUIRED');this.#root=root;
    this.#maxBytes=options.maxBytes??67108864;this.#maxRecords=options.maxRecords??128;
    if(!Number.isSafeInteger(this.#maxBytes)||this.#maxBytes<1||this.#maxBytes>67108864||!Number.isInteger(this.#maxRecords)||this.#maxRecords<1||this.#maxRecords>128)transferFail('STAGE_POLICY_INVALID');
    for(const name of ['stage.sqlite','stage-lock.sqlite']){const s=lstatSync(join(root,name),{throwIfNoEntry:false});if(s&&(!s.isFile()||s.nlink!==1||s.size>16777216||(s.mode&0o077)))transferFail('ISOLATED_STORAGE_REQUIRED');}
    this.#lock=new DatabaseSync(join(root,'stage-lock.sqlite'));
    try{chmodSync(join(root,'stage-lock.sqlite'),0o600);this.#lock.exec('PRAGMA busy_timeout=0;CREATE TABLE IF NOT EXISTS owner(id INTEGER PRIMARY KEY);BEGIN EXCLUSIVE');}catch{this.#lock.close();transferFail('STAGE_BUSY');}
    try {
      this.#db=new DatabaseSync(join(root,'stage.sqlite'));chmodSync(join(root,'stage.sqlite'),0o600);this.#db.exec('PRAGMA synchronous=FULL;PRAGMA max_page_count=4096;CREATE TABLE IF NOT EXISTS binding(id INTEGER PRIMARY KEY CHECK(id=1),digest TEXT NOT NULL);CREATE TABLE IF NOT EXISTS captures(id TEXT PRIMARY KEY,body TEXT NOT NULL,hash TEXT NOT NULL)');
      const binding=configurationDigest({realm:options.realm,siteId:options.siteId}),prior=this.#db.prepare('SELECT digest FROM binding WHERE id=1').get();if(prior&&prior.digest!==binding)transferFail('STAGE_SCOPE_MISMATCH');this.#db.prepare('INSERT OR IGNORE INTO binding VALUES(1,?)').run(binding);
      const rows=this.rows();if(rows.length>this.#maxRecords)transferFail('STAGE_CAPACITY');
      for(const row of rows) {
        if(row.state==='expiring'){this.#remove(row);row.state='expired';this.#event(row,'RETENTION_EXPIRED');this.#save(row);}
        else if(['writing','retained'].includes(row.state)) {
          try{for(const a of row.artifacts)this.read(row.manifest.image.id,a.trace.artifact.id);row.state='retained';this.#save(row);}
          catch{row.state=row.state==='writing'?'failed':'corrupt';this.#event(row,'STAGED_DATA_UNAVAILABLE');this.#save(row);}
        }
      }
    }catch(e){this.close();throw e;}
  }
  close():void {if(this.#busy)transferFail('STAGE_BUSY');if(this.#closed)return;this.#closed=true;this.#db?.close();try{this.#lock.exec('ROLLBACK');}catch{}this.#lock.close();}
  #path(id:string,part=false):string {if(!transferId(id))transferFail('STAGE_INVALID');return join(this.#root,`${id}.${part?'part':'png'}`);}
  #directory(){const fd=openSync(this.#root,constants.O_RDONLY|constants.O_DIRECTORY);try{fsyncSync(fd);}finally{closeSync(fd);}}
  #event(r:StagedCapture,event:string){r.events=[...r.events,event].slice(-16);}
  #parse(body:string,hash:string):StagedCapture {
    if(Buffer.byteLength(body)>131072)transferFail('STAGE_METADATA_INVALID');const r=JSON.parse(body) as StagedCapture;
    if(configurationDigest(r)!==hash||r.version!=='arbi.capture-stage/1.0'||!['writing','retained','failed','expiring','expired','corrupt'].includes(r.state)||!Number.isSafeInteger(r.expiresUtcMs)||r.expiresUtcMs<0||!Array.isArray(r.artifacts)||r.artifacts.length<1||r.artifacts.length>2||!Array.isArray(r.events)||r.events.length>16||r.events.some(e=>!transferId(e)))transferFail('STAGE_METADATA_INVALID');
    validateCaptureManifest(r.manifest);if(r.manifest.siteId!==this.options.siteId||configurationDigest(r.manifest.realm)!==configurationDigest(this.options.realm))transferFail('STAGE_SCOPE_MISMATCH');
    for(const a of r.artifacts){validateCaptureTrace(a.trace);if(configurationDigest(a.trace.manifest)!==configurationDigest(r.manifest)||!['pending','uploaded','failed'].includes(a.upload.state)||!Number.isInteger(a.upload.attempts)||a.upload.attempts<0||a.upload.attempts>32||!(a.upload.reason===null||transferId(a.upload.reason)))transferFail('STAGE_METADATA_INVALID');if(a.upload.state==='uploaded'){if(!a.upload.receipt)transferFail('STAGE_METADATA_INVALID');verifyCaptureUpload(a.upload.receipt,a.trace);}else if(a.upload.receipt!==null)transferFail('STAGE_METADATA_INVALID');}
    return r;
  }
  #save(r:StagedCapture):void {if(this.#closed)transferFail('STAGE_CLOSED');const body=JSON.stringify(r),hash=configurationDigest(r);this.#parse(body,hash);this.#db.prepare('INSERT INTO captures VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body,hash=excluded.hash').run(r.manifest.image.id,body,hash);}
  rows():StagedCapture[] {if(this.#closed)transferFail('STAGE_CLOSED');return this.#db.prepare('SELECT body,hash FROM captures ORDER BY id').all().map(r=>this.#parse(String(r.body),String(r.hash)));}
  get(id:string):StagedCapture|null {if(!transferId(id)||this.#closed)transferFail('STAGE_INVALID');const r=this.#db.prepare('SELECT body,hash FROM captures WHERE id=?').get(id);return r?this.#parse(String(r.body),String(r.hash)):null;}
  #write(id:string,bytes:Uint8Array):void {const part=this.#path(id,true),fd=openSync(part,constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|constants.O_NOFOLLOW,0o600);try{let n=0;while(n<bytes.length){const count=writeSync(fd,bytes,n,bytes.length-n);if(!count)transferFail('STAGE_WRITE_FAILED');n+=count;}fsyncSync(fd);}finally{closeSync(fd);}this.options.fault?.('after-file-sync');renameSync(part,this.#path(id));this.#directory();this.options.fault?.('after-file-rename');}
  read(captureId:string,artifactId:string):Buffer {
    const row=this.get(captureId),a=row?.artifacts.find(a=>a.trace.artifact.id===artifactId);if(!row||!a||!['writing','retained'].includes(row.state))transferFail('STAGED_DATA_UNAVAILABLE');
    const fd=openSync(this.#path(artifactId),constants.O_RDONLY|constants.O_NOFOLLOW);try{const s=fstatSync(fd),e=a.trace.artifact;if(!s.isFile()||s.nlink!==1||(s.mode&0o077)||s.size!==e.bytes)transferFail('STAGED_DATA_UNAVAILABLE');const b=Buffer.alloc(e.bytes);let n=0;while(n<b.length){const count=readSync(fd,b,n,b.length-n,null);if(!count)transferFail('STAGED_DATA_UNAVAILABLE');n+=count;}if(payloadDigest(b)!==e.sha256)transferFail('STAGED_DATA_UNAVAILABLE');const p=decodePng(b);if(p.width!==e.widthPx||p.height!==e.heightPx)transferFail('STAGED_DATA_UNAVAILABLE');return b;}finally{closeSync(fd);}
  }
  async stage(receiver:CaptureReceiver,id:string,processor:ImageProcessor,calibration:Calibration|null,nowUtcMs:number,retentionMs=86400000):Promise<StagedCapture> {
    if(this.#closed||this.#busy)transferFail('STAGE_BUSY');if(!Number.isSafeInteger(nowUtcMs)||nowUtcMs<0||!Number.isInteger(retentionMs)||retentionMs<1||retentionMs>604800000)transferFail('STAGE_CLOCK_INVALID');this.#busy=true;
    try {
      const owned=receiver.readOwned(id),m=owned.manifest,old=this.get(id);if(old){if(configurationDigest(old.manifest)!==configurationDigest(m))transferFail('STAGE_ID_CONFLICT');return old;}
      if(this.rows().length>=this.#maxRecords)transferFail('STAGE_RECEIPT_LIMIT');
      const original=originalFromCapture({version:'arbi.capture-result/1.0',state:'captured',image:m.image,metadata:m.metadata,correlationId:m.correlationId,resourceId:m.targetId}),result=await processor.process(original,owned.bytes,calibration);
      const d=result.processing.derivative,{png:_,...descriptor}=d??{png:null};
      const processing:CaptureTrace['processing']={state:result.processing.state,reason:result.processing.reason,algorithmRevision:result.processing.algorithmRevision,derivative:d?descriptor:null};
      const artifacts:StagedArtifact[]=[{trace:{version:'arbi.capture-upload/1.0',manifest:m,artifact:{...m.image,kind:'raw'},processing},upload:{state:'pending',attempts:0,reason:null,receipt:null}}];
      if(d)artifacts.push({trace:{version:'arbi.capture-upload/1.0',manifest:m,artifact:{id:d.id,kind:'rectified',sha256:d.sha256,bytes:d.bytes,contentType:d.contentType,widthPx:d.widthPx,heightPx:d.heightPx},processing},upload:{state:'pending',attempts:0,reason:null,receipt:null}});
      const row:StagedCapture={version:'arbi.capture-stage/1.0',manifest:m,state:'writing',expiresUtcMs:nowUtcMs+retentionMs,artifacts,events:[]};
      const reserved=this.rows().filter(r=>!['expired'].includes(r.state)).reduce((n,r)=>n+r.artifacts.reduce((s,a)=>s+a.trace.artifact.bytes,0),0),needed=artifacts.reduce((n,a)=>n+a.trace.artifact.bytes,0);
      if(reserved+needed>this.#maxBytes){row.state='failed';this.#event(row,'STAGE_PAYLOAD_QUOTA');this.#save(row);return row;}
      this.#save(row);this.options.fault?.('after-stage-reservation');
      try{this.#write(m.image.id,owned.bytes);if(d)this.#write(d.id,d.png);for(const a of artifacts)this.read(id,a.trace.artifact.id);row.state='retained';this.#event(row,'STAGE_RETAINED');this.#save(row);this.options.fault?.('after-stage-commit');return row;}
      catch(e){if(e instanceof Error&&e.message==='SIMULATED_PROCESS_CUT')throw e;row.state='failed';this.#event(row,'STAGE_WRITE_FAILED');this.#save(row);return row;}
    }finally{this.#busy=false;}
  }
  #remove(row:StagedCapture){for(const a of row.artifacts)for(const part of [false,true]){try{unlinkSync(this.#path(a.trace.artifact.id,part));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}}this.#directory();}
  expire(id:string,nowUtcMs:number):StagedCapture {if(this.#busy||!Number.isSafeInteger(nowUtcMs)||nowUtcMs<0)transferFail('STAGE_BUSY');const r=this.get(id);if(!r)transferFail('STAGE_INVALID');if(r.state==='expired'||nowUtcMs<r.expiresUtcMs)return r;r.state='expiring';this.#save(r);this.options.fault?.('after-expiry-intent');this.#remove(r);this.options.fault?.('after-expiry-unlink');r.state='expired';this.#event(r,'RETENTION_EXPIRED');this.#save(r);return r;}
  attempt(id:string,artifactId:string):StagedArtifact {const r=this.get(id),a=r?.artifacts.find(a=>a.trace.artifact.id===artifactId);if(!r||r.state!=='retained'||!a||a.upload.state==='uploaded'||a.upload.attempts>=32)transferFail('UPLOAD_NOT_ELIGIBLE');a.upload.attempts++;a.upload.reason=null;this.#save(r);return structuredClone(a);}
  failed(id:string,artifactId:string,reason:string):void {const r=this.get(id),a=r?.artifacts.find(a=>a.trace.artifact.id===artifactId);if(!r||!a||a.upload.state==='uploaded')return;a.upload.state=a.upload.attempts>=32?'failed':'pending';a.upload.reason=reason;this.#event(r,reason);this.#save(r);}
  uploaded(id:string,receipt:CaptureUploadReceipt):void {const r=this.get(id),a=r?.artifacts.find(a=>a.trace.artifact.id===receipt.artifactId);if(!r||r.state!=='retained'||!a)transferFail('UPLOAD_NOT_ELIGIBLE');verifyCaptureUpload(receipt,a.trace);a.upload.state='uploaded';a.upload.receipt=structuredClone(receipt);a.upload.reason=null;this.#event(r,'CLOUD_OBJECT_VERIFIED');this.#save(r);this.options.fault?.('after-upload-receipt');}
  status(){const rows=this.rows();return {captures:rows.length,retained:rows.filter(r=>r.state==='retained').length,unavailable:rows.filter(r=>['failed','expired','corrupt'].includes(r.state)).length,uploaded:rows.flatMap(r=>r.artifacts).filter(a=>a.upload.state==='uploaded').length,payloadQuotaBytes:this.#maxBytes,receiptQuota:this.#maxRecords,physicalAcceptance:false};}
}
