import { mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { digest, SqliteAuditSpool } from '@arbi/audit';
import type { AuditEvent } from '@arbi/protocol';
import { JobError } from './types.js';

/** Historical boots retain their original attributable source; they are never relabeled. */
export class JobAuditRelay {
  readonly #directory: string;
  readonly #spools = new Map<string, SqliteAuditSpool>();
  constructor(directory: string) { this.#directory = directory; mkdirSync(directory, { recursive: true, mode: 0o700 }); }
  spool = (event: AuditEvent): SqliteAuditSpool => {
    const key = digest([event.realm, event.siteId, event.source]), file = `${key}.sqlite`;
    const previous = this.#spools.get(key); if (previous) return previous;
    const files = readdirSync(this.#directory).filter(f => /^[a-f0-9]{64}\.sqlite$/.test(f));
    if ((!files.includes(file) && files.length >= 8) || files.reduce((bytes, f) => bytes + statSync(join(this.#directory, f)).size, 0) > 134217728) throw new JobError('RESOURCE_LIMIT');
    const spool = new SqliteAuditSpool({ path: join(this.#directory, file), realm: event.realm, siteId: event.siteId, executionMode: event.executionMode,
      source: event.source, maxEvents: 4096, maxBytes: 16777216, maxPages: 4096 });
    this.#spools.set(key, spool); return spool;
  };
  close(): void { for (const spool of this.#spools.values()) spool.close(); this.#spools.clear(); }
}
