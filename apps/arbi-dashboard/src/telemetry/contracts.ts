import { createHash } from 'node:crypto';
import type { Event, Sample, Telemetry } from '@arbi/protocol';
import { exact, id, JobError, milliseconds } from '../jobs/contracts';

export const VERSION = 'arbi.telemetry/1.0';
export const FRESH_MS = 5000;
export const DAY = 86_400_000;
/** Per site, including all devices, configurations and qualities. Oldest rows yield to these hard caps. */
export const TIERS = {
  raw: { ageMs: DAY, rows: 4096, widthMs: 0 },
  minute: { ageMs: 7*DAY, rows: 8192, widthMs: 60_000 },
  hour: { ageMs: 90*DAY, rows: 8192, widthMs: 3_600_000 },
  event: { ageMs: 90*DAY, rows: 4096, widthMs: 0 },
  trace: { ageMs: 7*DAY, rows: 32, widthMs: 0 },
} as const;
export type Tier = keyof typeof TIERS;
export type Reading = { sample: Sample; message: Pick<Telemetry,'messageId'|'source'|'sequence'|'sourceTime'|'ingestTime'> & {capabilitiesRevision:string}; receivedAtMs: number };
export interface Aggregate {
  count:number; numericCount:number; sum:number|null; min:number|null; max:number|null;
  uncertaintyMax:number|null; unknownUncertaintyCount:number; ageUnknownCount:number;
  firstSourceTime:Telemetry['sourceTime']; firstReceivedAtMs:number; missingSequences:string;
}
export interface Head {
  message: Telemetry | Event;
  configRevision: string;
  receivedAtMs: number;
  fingerprint: string;
  gap: string;
  missingSequences: string;
  reset: boolean;
  resets: number;
  readings: Reading[];
  snapshot: Event | null;
  faults: Event[];
}
export interface HistoryQuery {
  tier: Tier; fromMs: number; toMs: number; limit: number; cursor?: string;
  deviceId?: string; configRevision?: string; metric?: Sample['metric']; quality?: Sample['quality'];
  faultId?: string; severity?: string; eventType?: string; traceId?: string;
}
const metrics = ['position.x','position.y','position.z','line.length.a','line.length.b','line.length.c','line.length.d',
  'line.tension.a','line.tension.b','line.tension.c','line.tension.d','power.voltage','gimbal.pan','gimbal.tilt'];
export function historyQuery(input: unknown): HistoryQuery {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new JobError('INVALID_REQUEST');
  const q = input as Record<string,unknown>;
  const allowed = ['tier','fromMs','toMs','limit','cursor','deviceId','configRevision','metric','quality','faultId','severity','eventType','traceId'];
  if (Object.keys(q).some(k => !allowed.includes(k)) || !Object.hasOwn(TIERS,String(q.tier))) throw new JobError('INVALID_REQUEST');
  milliseconds(q.fromMs,0,Number.MAX_SAFE_INTEGER);milliseconds(q.toMs,0,Number.MAX_SAFE_INTEGER);milliseconds(q.limit,1,100);
  const tier = q.tier as Tier;
  if (Number(q.toMs) <= Number(q.fromMs) || Number(q.toMs)-Number(q.fromMs) > TIERS[tier].ageMs) throw new JobError('INVALID_REQUEST');
  for (const key of ['deviceId','configRevision','faultId','traceId']) if (q[key] !== undefined) id(q[key]);
  if (q.cursor !== undefined && (typeof q.cursor !== 'string' || q.cursor.length > 1024)) throw new JobError('INVALID_REQUEST');
  if (q.metric !== undefined && !metrics.includes(String(q.metric))) throw new JobError('INVALID_REQUEST');
  if (q.quality !== undefined && !['measured','commanded','estimated','stale','unavailable'].includes(String(q.quality))) throw new JobError('INVALID_REQUEST');
  if (q.severity !== undefined && !['info','inhibit','stop'].includes(String(q.severity))) throw new JobError('INVALID_REQUEST');
  if (q.eventType !== undefined && !['state.snapshot','fault.changed','command.outcome'].includes(String(q.eventType))) throw new JobError('INVALID_REQUEST');
  if ((tier === 'event' || tier === 'trace') && (q.metric !== undefined || q.quality !== undefined)) throw new JobError('INVALID_REQUEST');
  if (tier !== 'event' && ['faultId','severity','eventType'].some(k => q[k] !== undefined)) throw new JobError('INVALID_REQUEST');
  if (tier !== 'trace' && q.traceId !== undefined) throw new JobError('INVALID_REQUEST');
  return q as unknown as HistoryQuery;
}
export function queryHash(siteId: string, q: HistoryQuery): string {
  const {cursor: _, ...filter} = q;
  return createHash('sha256').update(JSON.stringify([siteId,Object.entries(filter).sort(([a],[b])=>a.localeCompare(b))])).digest('hex');
}
export function pageCursor(value: string, hash: string): {upper: string; after: string} {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value,'base64url').toString('utf8'));
    exact(parsed,['version','hash','upper','after']);
    if (parsed.version !== VERSION || parsed.hash !== hash ||
      ![parsed.upper,parsed.after].every(v => typeof v === 'string' && /^(0|[1-9][0-9]{0,18})$/.test(v) && BigInt(v) <= 9223372036854775807n) ||
      BigInt(String(parsed.after)) > BigInt(String(parsed.upper))) throw new Error();
    return {upper:String(parsed.upper),after:String(parsed.after)};
  } catch { throw new JobError('INVALID_REQUEST'); }
}
