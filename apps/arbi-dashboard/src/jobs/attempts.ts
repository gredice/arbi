import { randomUUID } from 'node:crypto';
import { digest } from '@arbi/audit';
import type { Actor, AuditEvent, Realm } from '@arbi/protocol';
import type { SqlSession } from '../enrollment/store';
import { scope } from '../audit/store';

type AttemptClass = NonNullable<AuditEvent['metadata']['attemptClass']>;
interface Bucket extends Record<string, unknown> {
  key: string; window_start_ms: string; attempt_count: number; first_event_id: string;
  attempt_class: AttemptClass; mixed: boolean;
}
/** Caller holds the registry lock. At most 32 attributable buckets + one mixed bucket per site.
 * This mutable counter is an open-window projection; immutable first/closed facts live in the canonical audit. */
export async function recordDeniedAttempt(sql: SqlSession, realm: Realm, siteId: string, now: number,
  kind: AttemptClass, actor: Actor | null, sessionId: string | null,
  make: (actor: Actor, sessionId: string | null) => Promise<AuditEvent>,
  stage: (event: AuditEvent) => Promise<void>) {
  await sql.query('SET LOCAL synchronous_commit=on');
  if((await sql.query<{fsync:string}>('SHOW fsync')).rows[0]?.fsync !== 'on') throw new Error('attempt durability unavailable');
  const key = scope(realm,siteId), start = Math.floor(now/60_000)*60_000;
  const rows = (await sql.query<Bucket>('SELECT * FROM arbi_job_attempts WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 ORDER BY key',key)).rows;
  for(const row of rows) {
    if(Number(row.window_start_ms) > start) throw new Error('attempt clock regressed');
    if(Number(row.window_start_ms) === start) continue;
    if(row.attempt_count > 1) {
      const summary = await make({ kind: 'service',id: 'job-attempt-aggregation' },null);
      summary.evidence = 'authorization';summary.outcome = 'deny';summary.reason = 'not-authorized';
      summary.links = { ...summary.links,intentEventId: null,causationEventId: row.first_event_id };
      summary.metadata = { ...summary.metadata,attemptClass: row.attempt_class,attemptCount: row.attempt_count,attemptWindowStartUtc: new Date(Number(row.window_start_ms)).toISOString(),
        aggregation: row.mixed ? 'mixed-actors-summary' : 'closed-window-summary' };
      await stage(summary);
    }
    await sql.query('DELETE FROM arbi_job_attempts WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND key=$4',[...key,row.key]);
  }
  const current = rows.filter(row => Number(row.window_start_ms) === start);
  const identity = actor ?? { kind: 'service' as const,id: 'unverified-attempt' };
  let bucketKey = digest([kind,identity,sessionId]), mixed = false;
  let bucket = current.find(row => row.key === bucketKey);
  if(!bucket && current.filter(row => !row.mixed).length >= 32) {
    bucketKey = 'overflow';mixed = true;bucket = current.find(row => row.key === bucketKey);
  }
  if(bucket) {
    // Saturation is explicit in the reader: exact count is unknown above the fixed ceiling.
    await sql.query('UPDATE arbi_job_attempts SET attempt_count=least(1000000000,attempt_count+1) WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND key=$4',[...key,bucketKey]);
    return;
  }
  const first = await make(mixed ? { kind: 'service',id: 'job-attempt-aggregation' } : identity,mixed ? null : sessionId);
  first.evidence = 'authorization';first.outcome = 'deny';first.reason = 'not-authorized';
  first.links = { ...first.links,intentEventId: null };
  first.metadata = { ...first.metadata,attemptClass: mixed ? 'other-denied' : kind,attemptCount: 1,attemptWindowStartUtc: new Date(start).toISOString(),
    aggregation: mixed ? 'mixed-actors-summary' : 'first-attempt' };
  await stage(first);
  await sql.query(`INSERT INTO arbi_job_attempts(environment,namespace_id,site_id,key,window_start_ms,attempt_count,first_event_id,attempt_class,mixed)
    VALUES($1,$2,$3,$4,$5,1,$6,$7,$8)`,[...key,bucketKey,start,first.eventId,mixed ? 'other-denied' : kind,mixed]);
}
export async function readDeniedAttempts(sql: SqlSession, realm: Realm, siteId: string) {
  const rows = (await sql.query<Bucket>('SELECT * FROM arbi_job_attempts WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 ORDER BY key LIMIT 33',scope(realm,siteId))).rows;
  return { version: 'arbi.command-attempts/1.0',correlationId: randomUUID(),windows: rows.map(row => ({
    startUtc: new Date(Number(row.window_start_ms)).toISOString(),endUtc: new Date(Number(row.window_start_ms)+60_000).toISOString(),
    count: row.attempt_count,saturated: row.attempt_count === 1_000_000_000,firstEventId: row.first_event_id,
    attemptClass: row.attempt_class,mixedActors: row.mixed,provenance: 'open-window-counter' })) };
}
