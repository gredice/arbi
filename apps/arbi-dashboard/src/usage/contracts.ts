import { digest } from '@arbi/audit';
import { validateAccounting, type UsageObservation } from '@arbi/protocol';
import { exact, id, JobError } from '../jobs/contracts';

export const VERSION = 'arbi.usage-device/1.0';
export const MAX_ROWS = 4096;
export const MAX_SITE_ROWS = 100_000;
export const MAX_QUERY_MS = 35 * 86_400_000;
export interface UsageWindow { sequence: string; observation: UsageObservation }
export function window(input: unknown): UsageWindow {
  exact(input, ['sequence', 'observation']);
  if (typeof input.sequence !== 'string' || !/^(0|[1-9][0-9]{0,19})$/.test(input.sequence) || BigInt(input.sequence) > (1n<<64n)-1n)
    throw new JobError('INVALID_REQUEST');
  const result = validateAccounting(input.observation);
  if (!result.ok || result.value.kind !== 'usage') throw new JobError('INVALID_REQUEST');
  return { sequence: input.sequence, observation: structuredClone(result.value) };
}
/** Totals have one canonical collection point per link/layer/direction, including across reboots. */
export function domain(o: UsageObservation): string {
  return digest([o.boundary,o.linkId,o.layer,o.direction,o.scope,o.scope==='attributed' ?
    [o.source.deviceId,o.counterEpoch,o.attributionRevision,o.deviceId,o.category] : null]);
}
export function stream(o: UsageObservation): string {
  return digest([o.source,o.counterEpoch,o.boundary,o.linkId,o.layer,o.direction,o.scope,o.attributionRevision,o.deviceId,o.category]);
}
export interface Query { linkId: string; fromMs: number; toMs: number }
export function query(input: unknown): Query {
  exact(input, ['linkId','fromMs','toMs']); id(input.linkId);
  if (![input.fromMs,input.toMs].every(n=>typeof n==='number' && Number.isSafeInteger(n) && n>=0 && n<=253402300799999) ||
    Number(input.toMs)<=Number(input.fromMs) || Number(input.toMs)-Number(input.fromMs)>MAX_QUERY_MS) throw new JobError('INVALID_REQUEST');
  return input as unknown as Query;
}
