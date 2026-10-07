import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { readFileSync } from 'node:fs';
import { PROTOCOL_VERSION, type Identity } from '@arbi/protocol';
import { ModuleAdapter } from './adapter.js';
import { readBoundedFile, validateSettings, type Settings } from './settings.js';

export class EdgeRuntime {
  readonly identity: Identity;
  #adapters: ModuleAdapter[];
  #server?: Server;
  #settings: Settings;
  #stopping = false;
  #build: unknown;
  constructor(input: Settings) {
    this.#settings = validateSettings(input);
    this.identity = Object.freeze({ deviceId: this.#settings.serviceId, bootId: randomUUID(), sessionId: randomUUID() });
    this.#build = JSON.parse(readFileSync(new URL('./build-identity.json', import.meta.url), 'utf8'));
    const tls = { ca: readBoundedFile(this.#settings.tls.caFile, 16384), cert: readBoundedFile(this.#settings.tls.certFile, 16384), key: readBoundedFile(this.#settings.tls.keyFile, 16384) };
    this.#adapters = this.#settings.modules.map((m) => new ModuleAdapter(this.#settings, m, this.identity, tls));
  }
  get adapters(): readonly ModuleAdapter[] { return this.#adapters.slice(); }
  get status() {
    const modules = this.adapters.map((adapter) => adapter.status);
    return { healthy: !this.#stopping, ready: !this.#stopping && modules.every((m) => m.ready), build: structuredClone(this.#build),
      protocol: PROTOCOL_VERSION, source: this.identity, executionMode: 'simulation', actuationEnabled: false, updateEnabled: false, recordingEnabled: false,
      appliedConfiguration: { revision: this.#settings.applied.request.configuration.revision, digest: this.#settings.applied.configurationDigest,
        calibrationRevision: this.#settings.applied.request.configuration.calibration!.revision, appliedBy: this.#settings.applied.appliedBy }, modules };
  }
  async start(): Promise<number> {
    if (this.#server || this.#stopping) throw new Error('RUNTIME_ALREADY_STARTED');
    const server = createServer({ maxHeaderSize: 4096, requestTimeout: 2000, headersTimeout: 2000 }, (req, res) => {
      if (req.method !== 'GET' || !['/healthz', '/readyz'].includes(req.url ?? '')) { res.writeHead(404).end(); return; }
      const status = this.status;
      res.writeHead(req.url === '/readyz' && !status.ready ? 503 : 200, { 'content-type': 'application/json', 'cache-control': 'no-store', connection: 'close' });
      res.end(JSON.stringify(status));
    });
    server.maxConnections = 8; server.keepAliveTimeout = 1000;
    this.#server = server;
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(this.#settings.healthPort, '127.0.0.1', () => { server.off('error', reject); resolve(); }); });
    if (this.#stopping) { await this.stop(); throw new Error('RUNTIME_STOPPING'); }
    for (const adapter of this.adapters) adapter.start();
    return (server.address() as { port: number }).port;
  }
  async stop(): Promise<void> {
    this.#stopping = true; for (const adapter of this.adapters) adapter.stop();
    if (this.#server) {
      const server = this.#server; this.#server = undefined;
      await new Promise<void>((resolve) => { server.close(() => resolve()); server.closeAllConnections(); });
    }
  }
}
