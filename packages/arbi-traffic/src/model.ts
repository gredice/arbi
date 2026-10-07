import { randomUUID, createHash } from 'node:crypto';
import { validateAccounting, type Identity, type Realm, type UsageObservation, type TrafficCategory } from '@arbi/protocol';

export class MeterError extends Error {
  constructor(readonly code: 'INVALID' | 'CAPACITY' | 'UNAVAILABLE' | 'CONFLICT') { super(`METER_${code}`); }
}
export const MAX_U64 = (1n << 64n) - 1n;
export function uint(value: unknown): bigint {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,19})$/.test(value) || BigInt(value) > MAX_U64) throw new MeterError('INVALID');
  return BigInt(value);
}
export function id(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)) throw new MeterError('INVALID');
}
export function integer(value: number, min: number, max: number): void {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new MeterError('INVALID');
}
export interface Stamp { utc: string | null; monotonicNs: string; clockId: string; uncertaintyMs: number | null }
export function stamp(clockId: string, uncertaintyMs: number | null = null): Stamp {
  return { utc: new Date().toISOString(), monotonicNs: process.hrtime.bigint().toString(), clockId, uncertaintyMs };
}
export function checkStamp(s: Stamp): void {
  uint(s.monotonicNs); id(s.clockId);
  if (s.uncertaintyMs !== null) integer(s.uncertaintyMs, 0, 86_400_000);
  if (s.utc !== null && (typeof s.utc !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(s.utc)
    || !Number.isFinite(Date.parse(s.utc)) || new Date(s.utc).toISOString() !== s.utc)) throw new MeterError('INVALID');
}
export interface Scope {
  realm: Realm; executionMode: UsageObservation['executionMode']; siteId: string; source: Identity;
  boundary: UsageObservation['boundary']; linkId: string;
}
export interface CounterConfig {
  key: string; scope: Scope; layer: 'interface-wan' | 'provider'; collectionPoint: string;
  coverage: UsageObservation['evidence']['coverage']; includes: UsageObservation['evidence']['includes'];
  width: 32 | 64; maxDeltaBytes: string; maxIntervalMs: number; maxAgeMs: number;
}
export interface CounterSample {
  bootId: string; interfaceId: string; counterId: string; time: Stamp;
  upload: string; download: string; wraps: { upload: string; download: string } | null;
}
export type Gap = 'baseline' | 'counter-reset' | 'replacement' | 'reboot' | 'collection-gap' | 'clock-uncertain' | 'not-configured' | 'unsupported-counter' | 'not-reported';
export interface CounterRecord {
  kind: 'counter'; id: string; config: CounterConfig; epoch: string;
  previous: CounterSample | null; current: CounterSample | null; gap: Gap | null;
  deltas: { upload: string; download: string } | null; rollover: boolean; observations: UsageObservation[];
}
export interface TransferSpec {
  scope: Scope; direction: UsageObservation['direction']; category: TrafficCategory;
  includes: UsageObservation['evidence']['includes'];
  retryOf: string | null; media: UsageObservation['media'];
}
export interface TransferRecord {
  kind: 'transfer'; id: string; spec: TransferSpec; start: Stamp; end: Stamp; bytes: string;
  outcome: 'open' | 'completed' | 'failed' | 'aborted' | 'crashed'; gap: Gap | null;
  observations: UsageObservation[];
}
export type MeterRecord = CounterRecord | TransferRecord;
export const hash = (body: string): string => createHash('sha256').update(body).digest('hex');

/** Unknown/reversed clocks retain raw byte evidence without inventing a UTC billing window. */
export function interval(start: Stamp, end: Stamp): UsageObservation['interval'] | null {
  checkStamp(start); checkStamp(end);
  if (!start.utc || !end.utc || start.uncertaintyMs === null || end.uncertaintyMs === null
    || start.clockId !== end.clockId || uint(end.monotonicNs) < uint(start.monotonicNs) || end.utc < start.utc) return null;
  const elapsedMs = Number(uint(end.monotonicNs) - uint(start.monotonicNs)) / 1e6;
  if (Math.abs(Date.parse(end.utc) - Date.parse(start.utc) - elapsedMs) > start.uncertaintyMs + end.uncertaintyMs + 2) return null;
  // Millisecond clock quantization brackets a sub-millisecond transfer. Raw times remain available.
  return { start: start.utc, end: new Date(Date.parse(end.utc) + 1).toISOString() };
}
export function observation(scope: Scope, epoch: string, layer: UsageObservation['layer'], direction: UsageObservation['direction'],
  window: UsageObservation['interval'], bytes: string | null, evidence: Omit<UsageObservation['evidence'], 'quality' | 'observedAt'>,
  category: TrafficCategory | null = null, media: UsageObservation['media'] = null): UsageObservation {
  const value: UsageObservation = { version: 'arbi-accounting/1.0', kind: 'usage', observationId: randomUUID(), ...scope,
    counterEpoch: epoch, layer, direction, interval: window, bytes, scope: category === null ? 'boundary-total' : 'attributed',
    attributionRevision: category === null ? null : 'attempts-v1', deviceId: category === null ? null : scope.source.deviceId, category, media,
    evidence: { ...evidence, quality: bytes === null ? 'unavailable' : 'measured', observedAt: bytes === null ? null : window.end } };
  const checked = validateAccounting(value);
  if (!checked.ok || checked.value.kind !== 'usage') throw new MeterError('INVALID');
  return value;
}
export function checkConfig(c: CounterConfig): void {
  id(c.key); id(c.collectionPoint); integer(c.maxIntervalMs, 1, 86_400_000); integer(c.maxAgeMs, 0, 86_400_000);
  if (!['interface-wan', 'provider'].includes(c.layer) || ![32,64].includes(c.width) || uint(c.maxDeltaBytes) === 0n) throw new MeterError('INVALID');
  observation(c.scope, 'validation', c.layer, 'upload', { start: '2026-01-01T00:00:00.000Z', end: '2026-01-01T00:00:01.000Z' }, '0',
    { coverage: c.coverage, includes: c.includes, maxAgeMs: c.maxAgeMs, reason: c.coverage === 'complete' ? null : 'unattributed' });
}
export function checkSample(s: CounterSample, width: number): void {
  id(s.bootId); id(s.interfaceId); id(s.counterId); checkStamp(s.time);
  for (const dir of ['upload', 'download'] as const) {
    if (uint(s[dir]) >= 1n << BigInt(width)) throw new MeterError('INVALID');
    if (s.wraps !== null) uint(s.wraps[dir]);
  }
}
