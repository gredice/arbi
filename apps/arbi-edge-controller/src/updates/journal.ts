import { chmodSync,existsSync,openSync,closeSync,lstatSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { canonical,digest } from '@arbi/audit';

export class UpdateSecurityError extends Error { constructor(readonly code:string){super(code);} }
export function reject(code:string):never{throw new UpdateSecurityError(code);}
/** Copy bounded plain JSON without invoking accessors or accepting hidden fields. */
export function plain(input:unknown):unknown{
  let nodes=0,textBytes=0;const seen=new Set<object>();
  function copy(x:unknown,depth:number):unknown{
    if(++nodes>10000||depth>16)reject('RESOURCE_LIMIT');
    if(typeof x==='string'){textBytes+=Buffer.byteLength(x);if(x.length>65536||textBytes>262144)reject('RESOURCE_LIMIT');return x;}
    if(x===null||typeof x==='boolean')return x;
    if(typeof x==='number'&&Number.isFinite(x))return x;
    if(typeof x!=='object'||!x||seen.has(x)||Object.getOwnPropertySymbols(x).length)reject('INVALID_RECORD');
    if(!Array.isArray(x)&&Object.getPrototypeOf(x)!==Object.prototype)reject('INVALID_RECORD');
    seen.add(x);const descriptors=Object.getOwnPropertyDescriptors(x),out:Record<string,unknown>|unknown[]=Array.isArray(x)?[]:{};
    for(const [key,d] of Object.entries(descriptors)){
      textBytes+=Buffer.byteLength(key);if(textBytes>262144)reject('RESOURCE_LIMIT');
      if(Array.isArray(x)&&key==='length')continue;
      if(!('value'in d)||!d.enumerable||key==='__proto__'||Array.isArray(x)&&!/^\d+$/.test(key))reject('INVALID_RECORD');
      (out as Record<string,unknown>)[key]=copy(d.value,depth+1);
    }
    seen.delete(x);return out;
  }
  const result=copy(input,0);if(Buffer.byteLength(JSON.stringify(result))>262144)reject('RESOURCE_LIMIT');return result;
}
export function fields(x:unknown,keys:string[]):asserts x is Record<string,unknown>{
  if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).sort().join('\0')!==keys.slice().sort().join('\0'))reject('INVALID_RECORD');
}
/** Private, test-realm immutable journal. No actuation callback or signing key storage. */
export class UpdateSecurityJournal {
  readonly #db:DatabaseSync;
  constructor(path:string,binding:unknown){
    const parent=lstatSync(dirname(path));if(path===':memory:'||!parent.isDirectory()||(parent.mode&0o077)!==0)reject('PRIVATE_DIRECTORY_REQUIRED');
    if(!existsSync(path)){const fd=openSync(path,'wx',0o600);closeSync(fd);}
    const info=lstatSync(path);if(!info.isFile()||(info.mode&0o077)!==0)reject('PRIVATE_FILE_REQUIRED');chmodSync(path,0o600);
    this.#db=new DatabaseSync(path,{timeout:1000});
    try{
      const version=this.#db.prepare('PRAGMA user_version').get()!.user_version;if(version!==0&&version!==1)reject('UNKNOWN_STORE_VERSION');
      this.#db.exec(`PRAGMA journal_mode=DELETE;PRAGMA synchronous=FULL;PRAGMA fullfsync=ON;PRAGMA max_page_count=4096;
        CREATE TABLE IF NOT EXISTS binding(id INTEGER PRIMARY KEY CHECK(id=1),body TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS clock(id INTEGER PRIMARY KEY CHECK(id=1),floor_ms INTEGER NOT NULL);
        INSERT OR IGNORE INTO clock VALUES(1,0);
        CREATE TABLE IF NOT EXISTS records(ordinal INTEGER PRIMARY KEY,body TEXT NOT NULL,previous_hash TEXT NOT NULL,hash TEXT NOT NULL);
        CREATE TRIGGER IF NOT EXISTS immutable_update BEFORE UPDATE ON records BEGIN SELECT RAISE(ABORT,'immutable'); END;
        CREATE TRIGGER IF NOT EXISTS immutable_delete BEFORE DELETE ON records BEGIN SELECT RAISE(ABORT,'immutable'); END;`);
      this.#db.exec('BEGIN IMMEDIATE');this.#db.prepare('INSERT OR IGNORE INTO binding VALUES(1,?)').run(canonical(binding));
      if(this.#db.prepare('SELECT body FROM binding').get()!.body!==canonical(binding))reject('SCOPE_MISMATCH');
      this.verify();this.#db.exec('PRAGMA user_version=1;COMMIT');
    }catch(e){try{this.#db.exec('ROLLBACK');}catch{}this.#db.close();throw e;}
  }
  close(){this.#db.close();}
  verify():unknown[]{
    const rows=this.#db.prepare('SELECT * FROM records ORDER BY ordinal LIMIT 513').all();if(rows.length>512)reject('RESOURCE_LIMIT');
    let previous='0'.repeat(64);const values=[];
    for(let i=0;i<rows.length;i++){
      const row=rows[i]!;let body:unknown;try{body=plain(JSON.parse(String(row.body)));}catch{reject('CORRUPT_JOURNAL');}
      if(row.ordinal!==i+1||row.previous_hash!==previous||row.hash!==digest({ordinal:i+1,previous,body}))reject('CORRUPT_JOURNAL');
      previous=String(row.hash);values.push(body);
    }
    return values;
  }
  checkpointClock(clock:{utcMs:number;reliable:boolean},minimum=0):number{
    this.#db.exec('BEGIN IMMEDIATE');
    try{
      const floor=Number(this.#db.prepare('SELECT floor_ms FROM clock WHERE id=1').get()!.floor_ms);
      if(!Number.isSafeInteger(floor)||floor<0||clock.reliable!==true||!Number.isSafeInteger(clock.utcMs)||clock.utcMs<0||clock.utcMs<Math.max(floor,minimum))reject('CLOCK_UNCERTAIN');
      this.#db.prepare('UPDATE clock SET floor_ms=? WHERE id=1').run(clock.utcMs);this.#db.exec('COMMIT');return clock.utcMs;
    }catch(e){try{this.#db.exec('ROLLBACK');}catch{}throw e;}
  }
  mutate<T>(make:(prior:unknown[])=>{record:unknown;result:T},fault?:(point:'before-commit'|'after-commit')=>void):T{
    this.#db.exec('BEGIN IMMEDIATE');let result:T;
    try{
      const prior=this.verify();if(prior.length>=512)reject('RESOURCE_LIMIT');const next=make(prior),body=plain(next.record),ordinal=prior.length+1;
      const previous=String(this.#db.prepare('SELECT hash FROM records ORDER BY ordinal DESC LIMIT 1').get()?.hash??'0'.repeat(64));
      this.#db.prepare('INSERT INTO records VALUES(?,?,?,?)').run(ordinal,canonical(body),previous,digest({ordinal,previous,body}));
      fault?.('before-commit');this.#db.exec('COMMIT');result=next.result;
    }catch(e){try{this.#db.exec('ROLLBACK');}catch{}throw e;}
    fault?.('after-commit');return result;
  }
}
