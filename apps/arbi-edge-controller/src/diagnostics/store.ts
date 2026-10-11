import { randomUUID } from 'node:crypto';
import { chmodSync, existsSync, lstatSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { canonical, digest } from '@arbi/audit';
import { validateMessage, type Event, type Identity, type Realm, type Telemetry } from '@arbi/protocol';

export type DiagnosticKind='telemetry'|'fault'|'state'|'outcome'|'code';
export interface DiagnosticRecord {
  version:'arbi.edge-diagnostics/1.0';id:string;kind:DiagnosticKind;realm:Realm;siteId:string;
  receivedAtMs:number;receiver:Identity;message:Event|Telemetry;gap:boolean;
}
export interface DiagnosticStoreOptions {
  path:string;realm:Realm;siteId:string;source:Identity;maxRecords:number;maxBytes:number;maxPages:number;retainMs:number;
}
interface Row {ordinal:number;body:string;hash:string}
const id=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(v);
const integer=(v:unknown,min:number,max:number)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
export class DiagnosticError extends Error {constructor(readonly code:string){super(code);}}

/** A lossy diagnostic ring. Authoritative audit events never enter this table. */
export class DiagnosticStore {
  readonly options:DiagnosticStoreOptions;
  readonly #db:DatabaseSync;
  readonly #owner=randomUUID();
  #closed=false;
  #volatileLosses=0;
  constructor(options:DiagnosticStoreOptions){
    this.options=structuredClone(options);Object.freeze(this.options.realm);Object.freeze(this.options.source);Object.freeze(this.options);
    if(options.path===':memory:'||Object.keys(options.realm).length!==2||options.realm.environment!=='test'||!id(options.realm.namespaceId)||!id(options.siteId)||
      Object.keys(options.source).length!==3||!Object.values(options.source).every(id)||!integer(options.maxRecords,32,512)||!integer(options.maxBytes,8192,1048576)||
      !integer(options.maxPages,32,512)||!integer(options.retainMs,1000,3600000))throw new DiagnosticError('INVALID_OPTIONS');
    const directory=lstatSync(dirname(options.path)),owner=process.getuid?.();
    if(!directory.isDirectory()||directory.isSymbolicLink()||(directory.mode&0o077)!==0||owner!==undefined&&directory.uid!==owner)throw new DiagnosticError('PRIVATE_DIRECTORY_REQUIRED');
    if(existsSync(options.path)){const file=lstatSync(options.path);if(!file.isFile()||file.isSymbolicLink()||(file.mode&0o077)!==0||owner!==undefined&&file.uid!==owner)throw new DiagnosticError('PRIVATE_FILE_REQUIRED');}
    this.#db=new DatabaseSync(options.path,{timeout:50});
    try{
      const version=this.#db.prepare('PRAGMA user_version').get()!.user_version;if(version!==0&&version!==1)throw new DiagnosticError('VERSION');
      this.#db.exec(`PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; PRAGMA fullfsync=ON; PRAGMA cache_size=-512;
        PRAGMA max_page_count=${options.maxPages};
        CREATE TABLE IF NOT EXISTS control(id INTEGER PRIMARY KEY CHECK(id=1),binding TEXT NOT NULL,owner TEXT,pid INTEGER,
          ordinal INTEGER NOT NULL,accepted INTEGER NOT NULL,dropped INTEGER NOT NULL,uploaded INTEGER NOT NULL,rejected INTEGER NOT NULL,clock_floor INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS records(ordinal INTEGER PRIMARY KEY,id TEXT UNIQUE NOT NULL,kind TEXT NOT NULL,received_at INTEGER NOT NULL,body TEXT NOT NULL,hash TEXT NOT NULL,bytes INTEGER NOT NULL);
        CREATE TRIGGER IF NOT EXISTS immutable_record BEFORE UPDATE ON records BEGIN SELECT RAISE(ABORT,'immutable diagnostic'); END;`);
      this.#db.exec('BEGIN IMMEDIATE');try{
        const binding=digest([options.realm,options.siteId,options.source.deviceId,'simulation']);
        this.#db.prepare('INSERT OR IGNORE INTO control VALUES(1,?,NULL,NULL,0,0,0,0,0,0)').run(binding);
        const row=this.#db.prepare('SELECT * FROM control WHERE id=1').get()!;
        if(row.binding!==binding)throw new DiagnosticError('SCOPE');
        if(row.pid!==null){let alive=true;try{process.kill(Number(row.pid),0);}catch(e){if((e as NodeJS.ErrnoException).code==='ESRCH')alive=false;}if(alive)throw new DiagnosticError('OWNERSHIP');}
        this.#db.prepare('UPDATE control SET owner=?,pid=? WHERE id=1').run(this.#owner,process.pid);this.#db.exec('COMMIT');
      }catch(e){this.#db.exec('ROLLBACK');throw e;}
      this.verify();this.#db.exec('PRAGMA user_version=1');chmodSync(options.path,0o600);
    }catch(e){this.#db.close();throw e instanceof DiagnosticError?e:new DiagnosticError('STORAGE');}
  }
  #transaction<T>(work:()=>T):T{
    if(this.#closed)throw new DiagnosticError('CLOSED');
    this.#db.exec('BEGIN IMMEDIATE');try{
      if(this.#db.prepare('SELECT owner FROM control WHERE id=1').get()?.owner!==this.#owner)throw new DiagnosticError('OWNERSHIP');
      const result=work();this.#db.exec('COMMIT');return result;
    }catch(e){try{this.#db.exec('ROLLBACK');}catch{/* SQLITE_FULL can roll back first. */}throw e instanceof DiagnosticError?e:new DiagnosticError('STORAGE');}
  }
  verify(){
    if(this.#db.prepare('PRAGMA quick_check').get()?.quick_check!=='ok')throw new DiagnosticError('CORRUPT');
    const rows=this.#db.prepare('SELECT body,hash,bytes FROM records').all();if(rows.length>this.options.maxRecords)throw new DiagnosticError('CORRUPT');
    let bytes=0;for(const row of rows){
      if(typeof row.body!=='string'||digest(JSON.parse(row.body))!==row.hash||Buffer.byteLength(row.body)!==row.bytes)throw new DiagnosticError('CORRUPT');
      this.#record(JSON.parse(row.body));bytes+=Number(row.bytes);
    }if(bytes>this.options.maxBytes)throw new DiagnosticError('CORRUPT');
  }
  #record(record:DiagnosticRecord){
    const parsed=validateMessage(record.message),keys=['version','id','kind','realm','siteId','receivedAtMs','receiver','message','gap'];
    if(!record||Object.keys(record).length!==keys.length||!keys.every(k=>Object.hasOwn(record,k))||record.version!=='arbi.edge-diagnostics/1.0'||!id(record.id)||
      !parsed.ok||parsed.value.kind==='command'||Buffer.byteLength(canonical(record.message))>8192||record.id!==parsed.value.messageId||
      parsed.value.executionMode!=='simulation'||canonical(parsed.value.realm)!==canonical(this.options.realm)||parsed.value.siteId!==this.options.siteId||
      typeof record.gap!=='boolean'||!record.receiver||Object.keys(record.receiver).length!==3||!Object.values(record.receiver).every(id)||record.receiver.deviceId!==this.options.source.deviceId||
      canonical(record.realm)!==canonical(this.options.realm)||record.siteId!==this.options.siteId||!integer(record.receivedAtMs,0,Number.MAX_SAFE_INTEGER))throw new DiagnosticError('INVALID_RECORD');
    const expected=parsed.value.kind==='telemetry'?'telemetry':parsed.value.body.type==='fault.changed'?'fault':parsed.value.body.type==='command.outcome'?'outcome':'state';
    if(record.kind!==expected&&!(record.kind==='code'&&expected==='fault'&&parsed.value.source.deviceId===this.options.source.deviceId))throw new DiagnosticError('INVALID_RECORD');
  }
  count(kind:'dropped'|'rejected',amount=1){
    if(!integer(amount,1,2147483647))throw new DiagnosticError('INVALID_COUNT');
    try{this.#transaction(()=>this.#db.prepare(`UPDATE control SET ${kind}=min(${kind}+?,2147483647) WHERE id=1`).run(amount));}
    catch{this.#volatileLosses=Math.min(2147483647,this.#volatileLosses+amount);}
  }
  append(record:DiagnosticRecord){
    this.#record(record);
    const body=canonical(record),bytes=Buffer.byteLength(body);
    if(bytes>12288||record.realm.environment!==this.options.realm.environment||record.realm.namespaceId!==this.options.realm.namespaceId||record.siteId!==this.options.siteId||
      !integer(record.receivedAtMs,0,Number.MAX_SAFE_INTEGER)||!['telemetry','fault','state','outcome','code'].includes(record.kind))throw new DiagnosticError('INVALID_RECORD');
    return this.#transaction(()=>{
      const hash=digest(record),prior=this.#db.prepare('SELECT hash FROM records WHERE id=?').get(record.id);if(prior){if(prior.hash!==hash)throw new DiagnosticError('ID_CONFLICT');return 'duplicate' as const;}
      const control=this.#db.prepare('SELECT ordinal,clock_floor FROM control WHERE id=1').get()!;
      if(record.receivedAtMs<Number(control.clock_floor))throw new DiagnosticError('CLOCK_REGRESSION');
      const ordinal=Number(control.ordinal)+1;if(!Number.isSafeInteger(ordinal))throw new DiagnosticError('CAPACITY');
      this.#db.prepare('INSERT INTO records VALUES(?,?,?,?,?,?,?)').run(ordinal,record.id,record.kind,record.receivedAtMs,body,hash,bytes);
      let dropped=Number(this.#db.prepare('DELETE FROM records WHERE received_at<=?').run(record.receivedAtMs-this.options.retainMs).changes);
      // Each class has a cap; telemetry cannot take every fault/state slot.
      const cap=Math.max(1,Math.floor(this.options.maxRecords*(record.kind==='telemetry'?0.5:record.kind==='fault'?0.25:0.08)));
      const excess=Number(this.#db.prepare('SELECT count(*) n FROM records WHERE kind=?').get(record.kind)!.n)-cap;
      if(excess>0)dropped+=Number(this.#db.prepare('DELETE FROM records WHERE ordinal IN(SELECT ordinal FROM records WHERE kind=? ORDER BY ordinal LIMIT ?)').run(record.kind,excess).changes);
      let totals=this.#db.prepare('SELECT count(*) n,coalesce(sum(bytes),0) bytes FROM records').get()!;
      while(Number(totals.n)>this.options.maxRecords||Number(totals.bytes)>this.options.maxBytes){
        dropped+=Number(this.#db.prepare("DELETE FROM records WHERE ordinal=(SELECT ordinal FROM records ORDER BY CASE kind WHEN 'telemetry' THEN 0 WHEN 'code' THEN 1 WHEN 'state' THEN 2 WHEN 'outcome' THEN 3 ELSE 4 END,ordinal LIMIT 1)").run().changes);
        totals=this.#db.prepare('SELECT count(*) n,coalesce(sum(bytes),0) bytes FROM records').get()!;
      }
      this.#db.prepare('UPDATE control SET ordinal=?,clock_floor=?,accepted=min(accepted+1,2147483647),dropped=min(dropped+?,2147483647) WHERE id=1').run(ordinal,record.receivedAtMs,dropped);
      return this.#db.prepare('SELECT ordinal FROM records WHERE id=?').get(record.id)?'retained' as const:'dropped' as const;
    });
  }
  snapshot(){return Number(this.#db.prepare('SELECT ordinal FROM control WHERE id=1').get()!.ordinal);}
  page(after:number,upper:number,nowMs:number,limit=8):Array<{ordinal:number;record:DiagnosticRecord}>{
    if(![after,upper,nowMs].every(n=>integer(n,0,Number.MAX_SAFE_INTEGER))||!integer(limit,1,8)||after>upper)throw new DiagnosticError('INVALID_PAGE');
    if(nowMs<Number(this.#db.prepare('SELECT clock_floor FROM control WHERE id=1').get()!.clock_floor))throw new DiagnosticError('CLOCK_REGRESSION');
    const rows=this.#db.prepare('SELECT ordinal,body,hash FROM records WHERE ordinal>? AND ordinal<=? AND received_at>? ORDER BY ordinal LIMIT ?').all(after,upper,nowMs-this.options.retainMs,limit) as unknown as Row[];
    return rows.map(row=>{const record=JSON.parse(row.body) as DiagnosticRecord;if(digest(record)!==row.hash)throw new DiagnosticError('CORRUPT');this.#record(record);return {ordinal:row.ordinal,record};});
  }
  uploaded(ids:string[]){
    if(!Array.isArray(ids)||ids.length>8||!ids.every(id))throw new DiagnosticError('INVALID_RECEIPT');
    this.#transaction(()=>{let deleted=0;for(const value of ids)deleted+=Number(this.#db.prepare('DELETE FROM records WHERE id=?').run(value).changes);
      this.#db.prepare('UPDATE control SET uploaded=min(uploaded+?,2147483647) WHERE id=1').run(deleted);});
  }
  get status(){
    try{const c=this.#db.prepare('SELECT accepted,dropped,uploaded,rejected FROM control WHERE id=1').get()!,s=this.#db.prepare('SELECT count(*) n,coalesce(sum(bytes),0) bytes FROM records').get()!;
      return {retained:Number(s.n),bytes:Number(s.bytes),accepted:Number(c.accepted),dropped:Number(c.dropped),uploaded:Number(c.uploaded),rejected:Number(c.rejected),volatileLosses:this.#volatileLosses,degraded:this.#volatileLosses>0};
    }catch{return {retained:null,bytes:null,accepted:null,dropped:null,uploaded:null,rejected:null,volatileLosses:this.#volatileLosses,degraded:true};}
  }
  close(){if(this.#closed)return;try{this.#db.prepare('UPDATE control SET owner=NULL,pid=NULL WHERE owner=?').run(this.#owner);}finally{this.#closed=true;this.#db.close();}}
}
