import type { Identity, TrafficCategory, UsageDirection } from '@arbi/protocol';
import { ApplicationMeter, TrafficSpool, LinuxInterfaceCollector, stamp, type Scope, type CounterConfig } from '@arbi/traffic';
import type { Settings } from './settings.js';

/** Diagnostics only. Stop/readiness/authorization never await accounting or Internet. */
export class EdgeTraffic {
  #spool?: TrafficSpool;
  #meter?: ApplicationMeter;
  #collector?: LinuxInterfaceCollector;
  #timer?: NodeJS.Timeout;
  #reason: string | null = null;
  #stopped = false;
  readonly #scope: Scope;
  constructor(settings: Settings, source: Identity) {
    const config = settings.applied.request.configuration;
    this.#scope = { realm: config.realm, siteId: config.siteId, executionMode: 'simulation', source, boundary: 'lan', linkId: 'edge-loopback' };
    const m = settings.metering;
    if (!m) { this.#reason = 'not-configured'; return; }
    try {
      this.#spool = new TrafficSpool({ path: m.spoolFile, binding: { realm: config.realm, siteId: config.siteId, executionMode: 'simulation', deviceId: source.deviceId },
        maxRecords: m.maxRecords, maxBytes: m.maxBytes, maxPages: m.maxPages, maxCounters: 1 });
      this.#meter = new ApplicationMeter(this.#spool, () => stamp(source.bootId));
    } catch { this.#reason = 'storage-unavailable'; return; }
    if (m.linuxLoopback && process.platform === 'linux') {
      const counter: CounterConfig = { key: 'loopback', scope: this.#scope, collectionPoint: 'linux-lo-sysfs', layer: 'interface-wan',
        width: 64, coverage: 'partial', includes: ['payload', 'retries', 'transport-overhead', 'non-arbi'], maxDeltaBytes: '67108864', maxIntervalMs: 15000, maxAgeMs: 15000 };
      this.#collector = new LinuxInterfaceCollector(counter, 'lo', 'edge-loopback-v1');
    }
  }
  observe(module: 'pico' | 'pod', direction: UsageDirection, category: TrafficCategory, bytes: Uint8Array): void {
    if (this.#stopped) return;
    this.#meter?.observe({ scope: { ...this.#scope, linkId: `edge-${module}-loopback` }, direction, category, includes: ['payload', 'retries'], retryOf: null, media: null }, bytes);
  }
  submit(module: 'pico' | 'pod', category: TrafficCategory, bytes: Uint8Array, write: (done: (error?: Error | null) => void) => void): void {
    if (!this.#meter || this.#stopped) { write(() => {}); return; }
    this.#meter.submit({ scope: { ...this.#scope, linkId: `edge-${module}-loopback` }, direction: 'upload', category, includes: ['payload', 'retries'], retryOf: null, media: null }, bytes, write);
  }
  get pending() { return this.#spool?.pending(64) ?? []; }
  get status() {
    return { application: this.#reason ?? 'partial', collectionPoint: 'local-tls-plaintext-frames', boundary: 'lan',
      clockUncertaintyMs: null, interface: this.#collector ? 'linux-lo-sysfs-partial' : 'unsupported-counter',
      gardenWan: { bytes: null, coverage: 'unknown', reason: 'not-configured' }, provider: { bytes: null, coverage: 'unknown', reason: 'unsupported-counter' },
      spool: this.#spool?.status() ?? { pending: null, active: null, reservedBytes: null, losses: null, degraded: true } };
  }
  start(): void {
    if (!this.#collector || !this.#spool || this.#stopped) return;
    const collect = () => { try { this.#collector!.poll(this.#spool!); } catch { /* durable/volatile loss remains in status */ } };
    collect(); this.#timer = setInterval(collect, 5000);
  }
  stop(): void {
    if (this.#stopped) return;
    this.#stopped = true; clearInterval(this.#timer); this.#spool?.close();
  }
}
