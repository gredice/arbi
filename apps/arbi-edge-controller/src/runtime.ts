import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { readFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import { isDeepStrictEqual } from 'node:util';
import { PROTOCOL_VERSION, type Identity } from '@arbi/protocol';
import { ModuleAdapter } from './adapter.js';
import { readBoundedFile, validateSettings, type Settings } from './settings.js';
import { EdgeTraffic } from './metering.js';
import { EdgeJobs } from './jobs/runtime.js';
import type { CommissioningServer } from './commissioning/server.js';
import type { TransferBudget } from './transfers/budget.js';

export class EdgeRuntime {
  readonly identity: Identity;
  #adapters: ModuleAdapter[];
  #server?: Server;
  #starting?: Promise<void>;
  #settings: Settings;
  #stopping = false;
  #build: unknown;
  readonly traffic: EdgeTraffic;
  readonly jobs: EdgeJobs;
  #commissioning?: CommissioningServer;
  #transfers?:TransferBudget;
  constructor(input: Settings) {
    this.#settings = validateSettings(input);
    this.identity = Object.freeze({ deviceId: this.#settings.serviceId, bootId: randomUUID(), sessionId: randomUUID() });
    this.#build = JSON.parse(readFileSync(new URL('./build-identity.json', import.meta.url), 'utf8'));
    const tls = { ca: readBoundedFile(this.#settings.tls.caFile, 16384), cert: readBoundedFile(this.#settings.tls.certFile, 16384), key: readBoundedFile(this.#settings.tls.keyFile, 16384) };
    this.traffic = new EdgeTraffic(this.#settings, this.identity);
    this.jobs = new EdgeJobs(this.#settings, this.identity);
    this.#adapters = this.#settings.modules.map((m) => new ModuleAdapter(this.#settings, m, this.identity, tls, this.traffic));
  }
  get adapters(): readonly ModuleAdapter[] { return this.#adapters.slice(); }
  /** Trusted optional WAN composition. Existing local stopping/transport never waits on transfer policy. */
  composeTransfers(budget:TransferBudget){
    const c=this.#settings.applied.request.configuration;
    if(this.#server || this.#transfers || budget.options.siteId!==c.siteId || !isDeepStrictEqual(budget.options.realm,c.realm) || !isDeepStrictEqual(budget.options.source,this.identity))throw new Error('INVALID_TRANSFER_COMPOSITION');
    this.#transfers=budget;
  }
  /** Trusted local composition only; configuration files and TLS peers cannot supply human/local grants. */
  composeCommissioning(server: CommissioningServer) {
    const scope = server.coordinator.status, configuration = this.#settings.applied.request.configuration;
    if (this.#server || this.#commissioning || !isDeepStrictEqual(server.coordinator.identity, this.identity)
      || scope.siteId !== configuration.siteId || !isDeepStrictEqual(scope.realm, configuration.realm)) throw new Error('INVALID_COMMISSIONING_COMPOSITION');
    this.#commissioning = server;
    this.jobs.requireCommissioning(() => { const state = server.coordinator.status; return { ready: state.ready, configurationDigest: state.active?.configurationDigest ?? null }; });
  }
  get status() {
    const modules = this.adapters.map((adapter) => adapter.status);
    const commissioning = this.#commissioning?.coordinator.status;
    return { healthy: !this.#stopping, ready: !this.#stopping && modules.every((m) => m.ready) && !this.jobs.status.degraded && !this.jobs.status.recoveryRequired
      && (!commissioning || commissioning.ready && commissioning.active?.configurationDigest === this.#settings.applied.configurationDigest), build: structuredClone(this.#build),
      ...(commissioning ? { commissioning } : {}),
      protocol: PROTOCOL_VERSION, source: this.identity, executionMode: 'simulation', actuationEnabled: false, updateEnabled: false, recordingEnabled: false,
      metering: this.traffic.status,
      transfers:this.#transfers?.status??{configured:false,coverage:'unknown',remainingBytes:null},
      jobs: this.jobs.status,
      appliedConfiguration: { revision: this.#settings.applied.request.configuration.revision, digest: this.#settings.applied.configurationDigest,
        calibrationRevision: this.#settings.applied.request.configuration.calibration!.revision, appliedBy: this.#settings.applied.appliedBy }, modules };
  }
  async start(): Promise<number> {
    if (this.#server || this.#stopping) throw new Error('RUNTIME_ALREADY_STARTED');
    const server = createServer({ maxHeaderSize: 4096, requestTimeout: 2000, headersTimeout: 2000 }, (req, res) => {
      const route = req.url?.match(/^\/sites\/([A-Za-z0-9._:-]+)\/commissioning\/([a-z]+)$/);
      if (route && this.#commissioning) {
        const request = new Request(`http://127.0.0.1${req.url}`, { method: req.method, headers: new Headers(Object.entries(req.headers).flatMap(([key, value]) =>
          value === undefined ? [] : [[key, Array.isArray(value) ? value.join(',') : value]])),
          ...(['GET', 'HEAD'].includes(req.method ?? '') ? {} : { body: Readable.toWeb(req) as ReadableStream<Uint8Array>, duplex: 'half' as const }) });
        void this.#commissioning.handle(request, route[1]!, route[2]!).then(async response => {
          res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(await response.text());
        }).catch(() => { res.writeHead(503, { 'cache-control': 'no-store' }).end(); });
        return;
      }
      if (req.method !== 'GET' || !['/healthz', '/readyz'].includes(req.url ?? '')) { res.writeHead(404).end(); return; }
      const status = this.status;
      res.writeHead(req.url === '/readyz' && !status.ready ? 503 : 200, { 'content-type': 'application/json', 'cache-control': 'no-store', connection: 'close' });
      res.end(JSON.stringify(status));
    });
    server.maxConnections = 8; server.keepAliveTimeout = 1000;
    this.#server = server;
    this.#starting = new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(this.#settings.healthPort, '127.0.0.1', () => { server.off('error', reject); resolve(); }); });
    try { await this.#starting; } finally { this.#starting = undefined; }
    if (this.#stopping) { await this.stop(); throw new Error('RUNTIME_STOPPING'); }
    for (const adapter of this.adapters) adapter.start();
    this.traffic.start();
    return (server.address() as { port: number }).port;
  }
  async stop(): Promise<void> {
    this.#stopping = true; for (const adapter of this.adapters) adapter.stop();
    this.jobs.stop();
    this.#commissioning?.coordinator.stop();
    // Local socket inhibition happens before accounting cleanup, even on failed storage.
    this.traffic.stop();
    try{this.#transfers?.close();}catch{ /* transfer degradation remains visible; local stop already ran */ }
    // A signal may arrive before the pending bind completes. Closing first can
    // cancel its callback and leave start() unresolved, so settle the bind first.
    await this.#starting?.catch(() => {});
    if (this.#server) {
      const server = this.#server; this.#server = undefined;
      await new Promise<void>((resolve) => { server.close(() => resolve()); server.closeAllConnections(); });
    }
    this.#commissioning?.store.close();
  }
}
