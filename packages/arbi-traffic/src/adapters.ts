import { openSync, readSync, closeSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { MeterError, id, integer, checkConfig, checkSample, stamp, type CounterConfig, type CounterSample, type Stamp, type TransferSpec } from './model.js';
import { TrafficSpool } from './spool.js';

/** Reusable pod/edge application byte boundary. Every retry is a new attempt, never object-size deduplication. */
export class ApplicationMeter {
  constructor(readonly spool: TrafficSpool, readonly clock: () => Stamp) {}
  /** Observe plaintext/framed bytes actually submitted to a transport, including failed submission attempts. */
  async upload(spec: TransferSpec, chunks: AsyncIterable<Uint8Array>, submit: (chunk: Uint8Array) => Promise<void>): Promise<string> {
    if (spec.direction !== 'upload') throw new MeterError('INVALID');
    const key = this.spool.begin(spec, this.clock());
    try {
      for await (const chunk of chunks) {
        // Count after the submission was invoked, even when it fails. A crash
        // before this durable write is an explicit in-flight collection gap.
        try { await submit(chunk); }
        catch (error) { this.spool.progress(key, chunk.byteLength.toString(), this.clock()); throw error; }
        this.spool.progress(key, chunk.byteLength.toString(), this.clock());
      }
      this.spool.finish(key, 'completed', this.clock()); return key;
    } catch (error) { try { this.spool.finish(key, 'failed', this.clock()); } catch { /* gap already exposed by spool */ } throw error; }
  }
  /** Counts received chunks, including a prefix discarded by the consumer or a failed/aborted download. */
  async *download(spec: TransferSpec, chunks: AsyncIterable<Uint8Array>): AsyncGenerator<Uint8Array> {
    if (spec.direction !== 'download') throw new MeterError('INVALID');
    const key = this.spool.begin(spec, this.clock()); let completed = false, failed = false;
    try {
      for await (const chunk of chunks) { this.spool.progress(key, chunk.byteLength.toString(), this.clock()); yield chunk; }
      completed = true;
    } catch (error) { failed = true; throw error; }
    finally { this.spool.finish(key, failed ? 'failed' : completed ? 'completed' : 'aborted', this.clock()); }
  }
  /** Diagnostic socket tap: accounting failure is visible, and never throws into control/fault transport. */
  observe(spec: TransferSpec, chunk: Uint8Array): void {
    let key: string | undefined;
    try {
      key = this.spool.begin(spec, this.clock()); this.spool.progress(key, chunk.byteLength.toString(), this.clock());
      this.spool.finish(key, 'completed', this.clock());
    } catch {
      // begin/progress/finish storage failures already record a loss. Invalid external inputs do not reach this internal tap.
      if (key) try { this.spool.finish(key, 'failed', this.clock()); } catch { /* status retains persistent/volatile gap */ }
    }
  }
  /** Complete only on the transport's submission callback; a crash leaves the committed attempt open. */
  submit(spec: TransferSpec, chunk: Uint8Array, write: (done: (error?: Error | null) => void) => void): void {
    let key: string | undefined;
    try { key = this.spool.begin(spec, this.clock()); }
    catch { /* Accounting cannot prevent transport or local fault handling. */ }
    let settled = false;
    const done = (error?: Error | null) => {
      if (settled) return; settled = true;
      if (key) try {
        this.spool.progress(key, chunk.byteLength.toString(), this.clock());
        this.spool.finish(key, error ? 'failed' : 'completed', this.clock());
      } catch { /* visible spool loss */ }
    };
    try { write(done); } catch (error) { done(error instanceof Error ? error : new Error('SUBMIT_FAILED')); throw error; }
  }
}

export interface LinuxPaths { sysClassNet: string; bootId: string; uptime: string; netNamespace: string }
const nativePaths: LinuxPaths = { sysClassNet: '/sys/class/net', bootId: '/proc/sys/kernel/random/boot_id', uptime: '/proc/uptime', netNamespace: '/proc/self/ns/net' };
function smallFile(path: string): string {
  // sysfs reports size zero; read bounded content rather than trusting st_size.
  const fd = openSync(path, 'r');
  try {
    const data = Buffer.alloc(4097); let used = 0;
    while (used < data.length) { const n = readSync(fd, data, used, data.length - used, null); if (n === 0) break; used += n; }
    if (used > 4096) throw new MeterError('INVALID');
    return data.subarray(0, used).toString('utf8').trim();
  } finally { closeSync(fd); }
}
/** Linux native sysfs point. RX/TX are garden-facing only when explicitly configured so. */
export class LinuxInterfaceCollector {
  readonly #paths: LinuxPaths;
  constructor(readonly config: CounterConfig, readonly interfaceName: string, readonly deploymentEpoch: string,
    paths?: LinuxPaths, readonly uncertaintyMs: number | null = null) {
    checkConfig(config); id(deploymentEpoch);
    if (!/^[A-Za-z0-9_.:-]{1,15}$/.test(interfaceName) || interfaceName === '.' || interfaceName === '..' || config.width !== 64 || config.layer !== 'interface-wan') throw new MeterError('INVALID');
    if (!paths && process.platform !== 'linux') throw new MeterError('UNAVAILABLE');
    this.#paths = paths ?? nativePaths;
  }
  read(): CounterSample {
    const base = join(this.#paths.sysClassNet, this.interfaceName);
    const bootId = smallFile(this.#paths.bootId); id(bootId);
    const identity = (): string => {
      const values = ['ifindex', 'iflink', 'address', 'type'].map((file) => smallFile(join(base, file)));
      if ((this.interfaceName === 'lo' || values[3] === '772') && this.config.scope.boundary !== 'lan') throw new MeterError('INVALID');
      return createHash('sha256').update(JSON.stringify([this.deploymentEpoch, String(statSync(this.#paths.netNamespace).ino), ...values])).digest('hex');
    };
    const interfaceId = identity();
    const upload = smallFile(join(base, 'statistics/tx_bytes')); const download = smallFile(join(base, 'statistics/rx_bytes'));
    const uptime = smallFile(this.#paths.uptime).split(' ')[0];
    if (!/^\d+\.\d{2}$/.test(uptime)) throw new MeterError('INVALID');
    const [whole, fraction] = uptime.split('.');
    const time: Stamp = { utc: new Date().toISOString(), monotonicNs: (BigInt(whole) * 1_000_000_000n + BigInt(fraction) * 10_000_000n).toString(),
      clockId: bootId, uncertaintyMs: this.uncertaintyMs };
    // Separate sysfs reads are not an atomic snapshot. Detect replacement/reboot during collection, retain time granularity.
    if (identity() !== interfaceId || smallFile(this.#paths.bootId) !== bootId) throw new MeterError('UNAVAILABLE');
    const sample: CounterSample = { bootId, interfaceId, counterId: this.deploymentEpoch, time, upload, download, wraps: null };
    checkSample(sample, 64); return sample;
  }
  poll(spool: TrafficSpool): void {
    let sample: CounterSample;
    try { sample = this.read(); }
    catch { spool.unavailable(this.config, 'not-reported', stamp(this.config.scope.source.bootId)); return; }
    spool.collect(this.config, sample);
  }
}

/** A vendor adapter must produce this bounded snapshot with explicit garden-perspective directions. */
export function parseRouterSnapshot(body: string, width: 32 | 64): CounterSample {
  if (Buffer.byteLength(body) > 4096) throw new MeterError('INVALID');
  let value: CounterSample;
  try { value = JSON.parse(body) as CounterSample; } catch { throw new MeterError('INVALID'); }
  if (!value || Object.keys(value).sort().join() !== 'bootId,counterId,download,interfaceId,time,upload,wraps'
    || !value.time || Object.keys(value.time).sort().join() !== 'clockId,monotonicNs,uncertaintyMs,utc'
    || (value.wraps !== null && (!value.wraps || Object.keys(value.wraps).sort().join() !== 'download,upload'))) throw new MeterError('INVALID');
  checkSample(value, width); return value;
}
export class RouterCollector {
  #polling = false;
  #outstanding = false;
  constructor(readonly config: CounterConfig, readonly timeoutMs: number, readonly readReport: ((signal: AbortSignal) => Promise<string>) | null) {
    checkConfig(config); integer(timeoutMs, 1, 10_000);
  }
  async poll(spool: TrafficSpool, now: () => Stamp): Promise<void> {
    if (this.#polling) throw new MeterError('CONFLICT');
    this.#polling = true;
    try {
      if (!this.readReport) { spool.unavailable(this.config, 'not-configured', now()); return; }
      // A callback that ignores abort remains quarantined. Never accumulate orphan requests on repeated polls.
      if (this.#outstanding) { spool.unavailable(this.config, 'not-reported', now()); return; }
      const controller = new AbortController(); let timer: NodeJS.Timeout | undefined;
      let sample: CounterSample;
      try {
        this.#outstanding = true;
        const report = Promise.resolve().then(() => this.readReport!(controller.signal)).finally(() => { this.#outstanding = false; });
        const body = await Promise.race([report, new Promise<never>((_, reject) => {
          timer = setTimeout(() => { controller.abort(); reject(new MeterError('UNAVAILABLE')); }, this.timeoutMs);
        })]);
        sample = parseRouterSnapshot(body, this.config.width);
      } catch { spool.unavailable(this.config, 'not-reported', now()); return; }
      finally { clearTimeout(timer); controller.abort(); }
      spool.collect(this.config, sample);
    } finally { this.#polling = false; }
  }
}
