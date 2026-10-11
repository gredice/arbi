import { DatabaseSync } from 'node:sqlite';
import type { LogRecord } from './bounded.js';
/** Informational local diagnostics, not shared AuditEvent authorization or device-effect evidence. */
export class DiagnosticBuffer {
  #db:DatabaseSync;#degraded=false;
  constructor(path:string) {
    this.#db=new DatabaseSync(path,{timeout:100});
    try{this.#db.exec(`PRAGMA journal_mode=DELETE;PRAGMA synchronous=FULL;PRAGMA max_page_count=256;
      CREATE TABLE IF NOT EXISTS diagnostic_state(id INTEGER PRIMARY KEY CHECK(id=1),dropped INTEGER NOT NULL);
      INSERT OR IGNORE INTO diagnostic_state VALUES(1,0);
      CREATE TABLE IF NOT EXISTS diagnostics(ordinal INTEGER PRIMARY KEY,body TEXT NOT NULL);
    `);
      if(Number(this.#db.prepare('PRAGMA page_count').get()!.page_count)>256 || Number(this.#db.prepare('SELECT count(*) n FROM diagnostics').get()!.n)>128)
        throw new Error('DIAGNOSTICS_LIMIT');
    }catch{this.#db.close();throw new Error('DIAGNOSTICS_UNAVAILABLE');}
  }
  append(record:LogRecord):boolean {
    try{
      const body=JSON.stringify(record);if(Buffer.byteLength(body)>2048)throw new Error('DIAGNOSTIC_LIMIT');
      this.#db.exec('BEGIN IMMEDIATE');
      const count=Number(this.#db.prepare('SELECT count(*) n FROM diagnostics').get()!.n);
      if(count>=128){this.#db.exec('DELETE FROM diagnostics WHERE ordinal=(SELECT min(ordinal) FROM diagnostics);UPDATE diagnostic_state SET dropped=MIN(dropped+1,2147483647)');}
      this.#db.prepare('INSERT INTO diagnostics(body) VALUES (?)').run(body);this.#db.exec('COMMIT');return true;
    }catch{try{this.#db.exec('ROLLBACK');}catch{}this.#degraded=true;return false;}
  }
  pending(){return this.#db.prepare('SELECT body FROM diagnostics ORDER BY ordinal LIMIT 128').all().map(v=>JSON.parse(String(v.body)) as LogRecord);}
  status(){try{return {buffered:Number(this.#db.prepare('SELECT count(*) n FROM diagnostics').get()!.n),dropped:Number(this.#db.prepare('SELECT dropped FROM diagnostic_state WHERE id=1').get()!.dropped),durable:true,degraded:this.#degraded};}catch{return {buffered:null,dropped:null,durable:false,degraded:true};}}
  close(){if(this.#db.isOpen)this.#db.close();}
}
