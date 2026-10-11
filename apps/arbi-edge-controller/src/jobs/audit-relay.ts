import { chmodSync, existsSync, lstatSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { digest, SqliteAuditSpool } from '@arbi/audit';
import type { AuditEvent } from '@arbi/protocol';
import { JobError } from './types.js';

/** Historical boots retain their original attributable source; they are never relabeled. */
export class JobAuditRelay {
  readonly #directory: string;
  readonly #spools = new Map<string, SqliteAuditSpool>();
  constructor(directory: string) { this.#directory = directory; mkdirSync(directory, { recursive: true, mode: 0o700 });
    const stat=lstatSync(directory);if(!stat.isDirectory()||stat.isSymbolicLink()||(stat.mode&0o077)!==0||process.getuid&&stat.uid!==process.getuid())throw new JobError('STORAGE_UNAVAILABLE');
  }
  spool = (event: AuditEvent): SqliteAuditSpool => {
    const key = digest([event.realm, event.siteId, event.source]), file = `${key}.sqlite`;
    const previous = this.#spools.get(key); if (previous) return previous;
    if(existsSync(join(this.#directory,file))){const stat=lstatSync(join(this.#directory,file));if(!stat.isFile()||stat.isSymbolicLink()||process.getuid&&stat.uid!==process.getuid())throw new JobError('STORAGE_UNAVAILABLE');}
    const files = readdirSync(this.#directory).filter(f => /^[a-f0-9]{64}\.sqlite$/.test(f));
    if ((!files.includes(file) && files.length >= 8) || files.reduce((bytes, f) => bytes + statSync(join(this.#directory, f)).size, 0) > 134217728) throw new JobError('RESOURCE_LIMIT');
    const spool = new SqliteAuditSpool({ path: join(this.#directory, file), realm: event.realm, siteId: event.siteId, executionMode: event.executionMode,
      source: event.source, maxEvents: 4096, maxBytes: 16777216, maxPages: 4096 });
    chmodSync(join(this.#directory,file),0o600);
    this.#spools.set(key, spool); return spool;
  };
  /** Reopen bounded historical backlogs after process restart without replacing their source epochs. */
  pendingSpools():readonly SqliteAuditSpool[]{
    const files=readdirSync(this.#directory).filter(f=>/^[a-f0-9]{64}\.sqlite$/.test(f));if(files.length>8)throw new JobError('RESOURCE_LIMIT');
    for(const file of files){const key=file.slice(0,-7);if(this.#spools.has(key))continue;
      const path=join(this.#directory,file),stat=lstatSync(path);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>16777216)throw new JobError('RESOURCE_LIMIT');
      const db=new DatabaseSync(path,{readOnly:true,timeout:50});let event:AuditEvent|undefined;
      try{const first=db.prepare('SELECT body FROM spool_events ORDER BY ordinal LIMIT 1').get();if(first)event=JSON.parse(String(first.body)) as AuditEvent;}finally{db.close();}
      if(event){if(digest([event.realm,event.siteId,event.source])!==key)throw new JobError('STORAGE_UNAVAILABLE');this.spool(event);}
    }return [...this.#spools.values()];
  }
  close(): void { for (const spool of this.#spools.values()) spool.close(); this.#spools.clear(); }
}
