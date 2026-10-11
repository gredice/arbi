import { createPublicKey,randomUUID } from 'node:crypto';
import type { KeyObject } from 'node:crypto';
import { constants,chmodSync,closeSync,fstatSync,fsyncSync,ftruncateSync,lstatSync,openSync,readSync,realpathSync,renameSync,statSync,writeSync } from 'node:fs';
import { basename,dirname,join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { configurationDigest,parseAuditEvent,validateAccounting } from '@arbi/protocol';
import type { Identity,IngestTime,Realm } from '@arbi/protocol';
import { boundedTransferMetadata,closedTransfer,cursorReceipt,manifestDigest,ownerReceipt,payloadDigest,transferFail,transferHash,transferId,transferIdentity } from '@arbi/protocol/capture-transfer';
import type { CaptureCursorKind,CaptureCursorReceipt,CaptureManifest,CaptureOwnerReceipt } from '@arbi/protocol/capture-transfer';
import { decodePng } from './png.js';

interface Incoming {version:'arbi.incoming-capture/1.0';manifest:CaptureManifest;digest:string;offset:number;state:'receiving'|'owned'|'corrupt'}
/** Native isolated edge owner. Public media/WAN upload is not implied by a
 * durable ownership receipt. Current peer authorization is renewed every call. */
export class CaptureReceiver {
  #root:string;#db!:DatabaseSync;#lock:DatabaseSync;#storageId:string;#closed=false;#maxBytes:number;#maxRecords:number;#edge:Identity;
  constructor(readonly options:{root:string;realm:Realm;siteId:string;podDeviceId:string;edge:Identity;privateKey:KeyObject;
    authorize:(pod:Identity)=>boolean;ingestClock?:()=>IngestTime;maxBytes?:number;maxRecords?:number;fault?:(point:string)=>void}) {
    this.options={...options,realm:structuredClone(options.realm),edge:structuredClone(options.edge)};transferIdentity(options.edge);this.#edge=structuredClone(options.edge);
    if(options.privateKey.type!=='private'||options.privateKey.asymmetricKeyType!=='ed25519'||options.realm.environment!=='test'||![options.siteId,options.podDeviceId].every(transferId))transferFail('TRANSFER_TRUST_INVALID');
    const root=realpathSync(options.root);if(dirname(root)!==realpathSync(tmpdir())||!basename(root).startsWith('arbi-edge-captures-')||!statSync(root).isDirectory()||(statSync(root).mode&0o077))transferFail('ISOLATED_STORAGE_REQUIRED');this.#root=root;
    this.#maxBytes=options.maxBytes??67108864;this.#maxRecords=options.maxRecords??128;
    if(!Number.isSafeInteger(this.#maxBytes)||this.#maxBytes<1||this.#maxBytes>67108864||!Number.isInteger(this.#maxRecords)||this.#maxRecords<1||this.#maxRecords>128)transferFail('TRANSFER_STORAGE_POLICY');
    for(const file of ['incoming.sqlite','incoming-lock.sqlite']){const s=lstatSync(join(root,file),{throwIfNoEntry:false});if(s&&(!s.isFile()||s.nlink!==1||s.size>8388608||(s.mode&0o077)))transferFail('ISOLATED_STORAGE_REQUIRED');}
    this.#lock=new DatabaseSync(join(root,'incoming-lock.sqlite'));
    try{chmodSync(join(root,'incoming-lock.sqlite'),0o600);this.#lock.exec('PRAGMA busy_timeout=0;CREATE TABLE IF NOT EXISTS owner(id INTEGER PRIMARY KEY);BEGIN EXCLUSIVE');}catch{this.#lock.close();transferFail('TRANSFER_STORE_BUSY');}
    try {
      this.#db=new DatabaseSync(join(root,'incoming.sqlite'));chmodSync(join(root,'incoming.sqlite'),0o600);
      this.#db.exec('PRAGMA synchronous=FULL;PRAGMA max_page_count=2048;CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY CHECK(id=1),binding TEXT NOT NULL,storage_id TEXT NOT NULL);CREATE TABLE IF NOT EXISTS incoming(id TEXT PRIMARY KEY,body TEXT NOT NULL,hash TEXT NOT NULL);CREATE TABLE IF NOT EXISTS cursors(kind TEXT NOT NULL,id TEXT NOT NULL,body TEXT NOT NULL,hash TEXT NOT NULL,ingest TEXT NOT NULL,PRIMARY KEY(kind,id))');
      const binding=configurationDigest({realm:options.realm,siteId:options.siteId,podDeviceId:options.podDeviceId,edgeDeviceId:options.edge.deviceId,key:createPublicKey(options.privateKey).export({type:'spki',format:'der'}).toString('base64')}),old=this.#db.prepare('SELECT * FROM settings WHERE id=1').get();
      if(old){if(old.binding!==binding||!transferId(old.storage_id))transferFail('TRANSFER_SCOPE_MISMATCH');this.#storageId=String(old.storage_id);}else{this.#storageId=randomUUID();this.#db.prepare('INSERT INTO settings VALUES(1,?,?)').run(binding,this.#storageId);}
      const cursors=this.#db.prepare('SELECT * FROM cursors').all();if(cursors.length>512||cursors.reduce((n,r)=>n+Buffer.byteLength(String(r.body)),0)>2097152)transferFail('TRANSFER_CURSOR_CAPACITY');
      for(const r of cursors){if(!['audit','usage','diagnostic'].includes(String(r.kind))||!transferId(r.id)||Buffer.byteLength(String(r.body))>32768)transferFail('TRANSFER_CURSOR_INVALID');const body=JSON.parse(String(r.body));boundedTransferMetadata(body);const hash=r.kind==='usage'?payloadDigest(Buffer.from(String(r.body))):configurationDigest(r.kind==='audit'?{...body,ingestTime:null}:body);if(hash!==r.hash)transferFail('TRANSFER_CURSOR_INVALID');cursorReceipt(r.kind as CaptureCursorKind,String(r.id),hash,this.#edge,JSON.parse(String(r.ingest)),options.privateKey);}
      for(const row of this.#rows()) {
        if(row.state==='receiving') {
          const part=this.#path(row.manifest.image.id,false),file=this.#path(row.manifest.image.id,true),s=lstatSync(part,{throwIfNoEntry:false});
          if(s){const fd=this.#open(part,constants.O_RDWR);try{const bytes=fstatSync(fd).size;if(bytes<row.offset)transferFail('TRANSFER_STORAGE_CORRUPT');if(bytes>row.offset){ftruncateSync(fd,row.offset);fsyncSync(fd);}}finally{closeSync(fd);}}
          else if(lstatSync(file,{throwIfNoEntry:false})&&row.offset===row.manifest.image.bytes){this.#verifyFile(row);row.state='owned';this.#put(row);}
          else if(row.offset>0){row.state='corrupt';this.#put(row);}
        } else if(row.state==='owned'){try{this.#verifyFile(row);}catch{row.state='corrupt';this.#put(row);}}
      }
    }catch(e){this.close();throw e;}
  }
  close():void {if(this.#closed)return;this.#closed=true;this.#db?.close();try{this.#lock.exec('ROLLBACK');}catch{}this.#lock.close();}
  get storageId():string{return this.#storageId;}
  #peer(pod:Identity):void {if(this.#closed)transferFail('TRANSFER_RECEIVER_CLOSED');transferIdentity(pod);if(pod.deviceId!==this.options.podDeviceId||!this.options.authorize(structuredClone(pod)))transferFail('TRANSFER_NOT_AUTHORIZED');}
  #path(id:string,complete:boolean):string {if(!transferId(id))transferFail('TRANSFER_INVALID');return join(this.#root,`${id}.${complete?'png':'part'}`);}
  #open(path:string,flags:number):number {const fd=openSync(path,flags|constants.O_NOFOLLOW,0o600),s=fstatSync(fd);if(!s.isFile()||s.nlink!==1||(s.mode&0o077)||s.size>8388608){closeSync(fd);transferFail('TRANSFER_STORAGE_CORRUPT');}return fd;}
  #put(r:Incoming):void {this.#parse(JSON.stringify(r),configurationDigest(r));this.#db.prepare('INSERT INTO incoming VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body,hash=excluded.hash').run(r.manifest.image.id,JSON.stringify(r),configurationDigest(r));}
  #parse(body:string,hash:string):Incoming {
    if(Buffer.byteLength(body)>49152)transferFail('TRANSFER_STORAGE_CORRUPT');const r=JSON.parse(body) as Incoming;closedTransfer(r,['version','manifest','digest','offset','state']);
    if(r.version!=='arbi.incoming-capture/1.0'||configurationDigest(r)!==hash||manifestDigest(r.manifest)!==r.digest||!Number.isSafeInteger(r.offset)||r.offset<0||r.offset>r.manifest.image.bytes||!['receiving','owned','corrupt'].includes(r.state)||(r.state==='owned'&&r.offset!==r.manifest.image.bytes))transferFail('TRANSFER_STORAGE_CORRUPT');return r;
  }
  #rows():Incoming[] {const rows=this.#db.prepare('SELECT body,hash FROM incoming').all();if(rows.length>this.#maxRecords)transferFail('TRANSFER_RECEIPT_LIMIT');return rows.map(r=>this.#parse(String(r.body),String(r.hash)));}
  #get(imageId:string):Incoming|null {const row=this.#db.prepare('SELECT body,hash FROM incoming WHERE id=?').get(imageId);return row?this.#parse(String(row.body),String(row.hash)):null;}
  #read(path:string,expected:number):Buffer {const fd=this.#open(path,constants.O_RDONLY);try{if(fstatSync(fd).size!==expected)transferFail('TRANSFER_RAW_CORRUPT');const bytes=Buffer.alloc(expected+1);let n=0;while(n<bytes.length){const count=readSync(fd,bytes,n,bytes.length-n,null);if(!count)break;n+=count;}if(n!==expected)transferFail('TRANSFER_RAW_CORRUPT');return bytes.subarray(0,n);}finally{closeSync(fd);}}
  #verifyFile(r:Incoming):Buffer {const bytes=this.#read(this.#path(r.manifest.image.id,true),r.manifest.image.bytes);if(payloadDigest(bytes)!==r.manifest.image.sha256)transferFail('TRANSFER_RAW_CORRUPT');const image=decodePng(bytes);if(image.width!==r.manifest.image.widthPx||image.height!==r.manifest.image.heightPx)transferFail('TRANSFER_RAW_CORRUPT');return bytes;}
  begin(manifest:CaptureManifest,pod:Identity):{offset:number;owned:boolean} {
    this.#peer(pod);const digest=manifestDigest(manifest);
    if(configurationDigest(manifest.realm)!==configurationDigest(this.options.realm)||manifest.siteId!==this.options.siteId||manifest.podDeviceId!==this.options.podDeviceId)transferFail('TRANSFER_SCOPE_MISMATCH');
    const prior=this.#get(manifest.image.id);if(prior){if(prior.digest!==digest)transferFail('TRANSFER_ID_CONFLICT');if(prior.state==='corrupt')transferFail('TRANSFER_RAW_CORRUPT');if(prior.state==='owned')this.#verifyFile(prior);return {offset:prior.offset,owned:prior.state==='owned'};}
    const rows=this.#rows();if(rows.length>=this.#maxRecords||rows.reduce((n,r)=>n+r.manifest.image.bytes,0)+manifest.image.bytes>this.#maxBytes)transferFail('TRANSFER_STORAGE_FULL');
    const row:Incoming={version:'arbi.incoming-capture/1.0',manifest:structuredClone(manifest),digest,offset:0,state:'receiving'};this.#put(row);this.options.fault?.('after-transfer-reservation');return {offset:0,owned:false};
  }
  chunk(imageId:string,digest:string,offset:number,payload:Uint8Array,sha256:string,pod:Identity):{offset:number;duplicate:boolean} {
    this.#peer(pod);const r=this.#get(imageId);if(!r||r.digest!==digest||!transferHash(digest)||!Number.isSafeInteger(offset)||offset<0||!(payload instanceof Uint8Array)||payload.length<1||payload.length>65536||offset+payload.length>r.manifest.image.bytes||payloadDigest(payload)!==sha256)transferFail('TRANSFER_CHUNK_INVALID');
    if(r.state==='corrupt')transferFail('TRANSFER_RAW_CORRUPT');if(offset>r.offset)transferFail('TRANSFER_OFFSET_INVALID');
    if(offset<r.offset||r.state==='owned') {
      if(offset+payload.length>r.offset)transferFail('TRANSFER_OFFSET_INVALID');const fd=this.#open(this.#path(imageId,r.state==='owned'),constants.O_RDONLY);
      try{const bytes=Buffer.alloc(payload.length);if(readSync(fd,bytes,0,bytes.length,offset)!==bytes.length||payloadDigest(bytes)!==sha256)transferFail('TRANSFER_CHUNK_CONFLICT');}finally{closeSync(fd);}return {offset:r.offset,duplicate:true};
    }
    const fd=this.#open(this.#path(imageId,false),constants.O_WRONLY|constants.O_CREAT);
    try{const size=fstatSync(fd).size;if(size<offset)transferFail('TRANSFER_RAW_CORRUPT');if(size>offset)ftruncateSync(fd,offset);let n=0;while(n<payload.length){const wrote=writeSync(fd,payload,n,payload.length-n,offset+n);if(!wrote)transferFail('TRANSFER_STORAGE_FAILED');n+=wrote;}fsyncSync(fd);}finally{closeSync(fd);}
    this.options.fault?.('after-chunk-write');r.offset+=payload.length;this.#put(r);this.options.fault?.('after-chunk-commit');return {offset:r.offset,duplicate:false};
  }
  finish(imageId:string,digest:string,pod:Identity):CaptureOwnerReceipt {
    this.#peer(pod);const r=this.#get(imageId);if(!r||r.digest!==digest||r.state==='corrupt'||r.offset!==r.manifest.image.bytes)transferFail('TRANSFER_INCOMPLETE');
    if(r.state!=='owned') {
      const bytes=this.#read(this.#path(imageId,false),r.manifest.image.bytes);if(payloadDigest(bytes)!==r.manifest.image.sha256)transferFail('TRANSFER_RAW_CORRUPT');const image=decodePng(bytes);if(image.width!==r.manifest.image.widthPx||image.height!==r.manifest.image.heightPx)transferFail('TRANSFER_RAW_CORRUPT');
      renameSync(this.#path(imageId,false),this.#path(imageId,true));const dir=openSync(this.#root,constants.O_RDONLY|constants.O_DIRECTORY);try{fsyncSync(dir);}finally{closeSync(dir);}this.options.fault?.('after-transfer-rename');r.state='owned';this.#put(r);this.options.fault?.('after-owner-commit');
    }
    this.#verifyFile(r);return ownerReceipt(r.manifest,this.#edge,this.#storageId,this.options.privateKey);
  }
  readOwned(imageId:string):{manifest:CaptureManifest;bytes:Buffer} {if(this.#closed)transferFail('TRANSFER_RECEIVER_CLOSED');const r=this.#get(imageId);if(!r||r.state!=='owned')transferFail('TRANSFER_INCOMPLETE');return {manifest:structuredClone(r.manifest),bytes:this.#verifyFile(r)};}
  acceptCursor(kind:CaptureCursorKind,id:string,body:unknown,pod:Identity):CaptureCursorReceipt {
    this.#peer(pod);if(!['audit','usage','diagnostic'].includes(kind)||!transferId(id))transferFail('TRANSFER_CURSOR_INVALID');boundedTransferMetadata(body);
    const data=body as Record<string,unknown>,json=JSON.stringify(data);let hash:string;
    if(kind==='audit') {
      const a=parseAuditEvent(json);if(!a.ok||a.value.ingestTime!==null||a.value.executionMode!=='simulation'||configurationDigest(a.value.realm)!==configurationDigest(this.options.realm)||a.value.siteId!==this.options.siteId||a.value.source.module!=='pod'||a.value.source.identity.deviceId!==this.options.podDeviceId||a.value.eventId!==id)transferFail('TRANSFER_CURSOR_INVALID');hash=configurationDigest({...a.value,ingestTime:null});
    } else if(kind==='usage') {
      closedTransfer(data,['kind','id','spec','start','end','bytes','outcome','gap','observations']);const spec=data.spec as Record<string,unknown>;closedTransfer(spec,['scope','direction','category','includes','maxAgeMs','retryOf','media']);const scope=spec.scope as Record<string,unknown>;closedTransfer(scope,['realm','executionMode','siteId','source','boundary','linkId']);transferIdentity(scope.source as Identity);
      if(data.kind!=='transfer'||data.id!==id||scope.boundary!=='lan'||scope.executionMode!=='simulation'||configurationDigest(scope.realm)!==configurationDigest(this.options.realm)||scope.siteId!==this.options.siteId||(scope.source as Identity).deviceId!==this.options.podDeviceId||typeof data.bytes!=='string'||!/^(0|[1-9][0-9]{0,19})$/u.test(data.bytes)||!['completed','failed','aborted','crashed'].includes(String(data.outcome))||!Array.isArray(data.observations)||data.observations.some(v=>!validateAccounting(v).ok))transferFail('TRANSFER_CURSOR_INVALID');hash=payloadDigest(Buffer.from(json));
    } else {
      closedTransfer(data,['code','atMs','bootId','connectionId','correlationId','sequence']);
      if(!['STARTING','CONFIG_MISSING','CAMERA_UNAVAILABLE','READY','AUTHENTICATION_FAILED','PEER_REJECTED','LINK_EXPIRED','DISCONNECTED','SHUTDOWN','STORAGE_UNAVAILABLE','DIAGNOSTIC_ACCEPTED','COMMAND_REJECTED'].includes(String(data.code))||!Number.isSafeInteger(data.atMs)||(data.atMs as number)<0||!transferId(data.bootId)||typeof data.sequence!=='string'||!/^[1-9][0-9]{0,19}$/u.test(data.sequence)||id!==`${data.bootId}:${data.sequence}`||![data.connectionId,data.correlationId].every(v=>v===null||transferId(v)))transferFail('TRANSFER_CURSOR_INVALID');hash=configurationDigest(data);
    }
    const old=this.#db.prepare('SELECT * FROM cursors WHERE kind=? AND id=?').get(kind,id);if(old){if(old.hash!==hash||old.body!==json)transferFail('TRANSFER_CURSOR_CONFLICT');return cursorReceipt(kind,id,hash,this.#edge,JSON.parse(String(old.ingest)),this.options.privateKey);}
    const count=this.#db.prepare('SELECT count(*) n,COALESCE(sum(length(CAST(body AS BLOB))),0) bytes FROM cursors').get()!;if(Number(count.n)>=512||Number(count.bytes)+Buffer.byteLength(json)>2097152)transferFail('TRANSFER_CURSOR_CAPACITY');
    const ingest=this.options.ingestClock?.()??null,result=cursorReceipt(kind,id,hash,this.#edge,ingest,this.options.privateKey);
    this.#db.prepare('INSERT INTO cursors VALUES(?,?,?,?,?)').run(kind,id,json,hash,JSON.stringify(ingest));this.options.fault?.('after-cursor-commit');return result;
  }
  cursorStatus(){const r=this.#db.prepare('SELECT count(*) n,COALESCE(sum(length(CAST(body AS BLOB))),0) bytes FROM cursors').get()!;return {retained:Number(r.n),bytes:Number(r.bytes),wanDelivery:'not-delivered' as const};}
  pendingCursors(limit=8):{kind:CaptureCursorKind;id:string;body:Record<string,unknown>;contentHash:string;ingestTime:IngestTime}[] {
    if(this.#closed)transferFail('TRANSFER_RECEIVER_CLOSED');if(!Number.isInteger(limit)||limit<1||limit>8)transferFail('TRANSFER_CURSOR_INVALID');
    return this.#db.prepare('SELECT * FROM cursors ORDER BY rowid LIMIT ?').all(limit).map(r=>({kind:r.kind as CaptureCursorKind,id:String(r.id),body:JSON.parse(String(r.body)),contentHash:String(r.hash),ingestTime:JSON.parse(String(r.ingest))}));
  }
  status() {const rows=this.#rows();return {storageId:this.#storageId,edge:structuredClone(this.#edge),records:rows.length,reservedBytes:rows.reduce((n,r)=>n+r.manifest.image.bytes,0),owned:rows.filter(r=>r.state==='owned').length,incomplete:rows.filter(r=>r.state==='receiving').length,corrupt:rows.filter(r=>r.state==='corrupt').length,wanUploadState:'not-uploaded' as const,physicalAcceptance:false};}
}
