import { createHash, randomUUID, X509Certificate } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { createServer, type TLSSocket, type Server } from 'node:tls';
import { admitCommand, configurationCapabilities, configurationDigest, createCommandLedger, parseMessage, PROTOCOL_VERSION, validateConfigurationRecord,
  type AppliedConfiguration, type Configuration, type ConfigurationApplyBoundary, type ConfigurationRequest, type Event, type Identity } from '@arbi/protocol';
import { FrameDecoder, frame } from './framing.js';
import { TRANSPORT_VERSION, type Settings, type ModuleEnrollment } from './settings.js';
import type { Hello } from './adapter.js';

export interface SyntheticCredentials { directory: string; caFile: string; edgeCertFile: string; edgeKeyFile: string; edgePin: string; modules: Record<'pico' | 'pod', { certFile: string; keyFile: string; pin: string }> }
/** Ephemeral keys stay in a private temporary directory and never enter source, logs or fixtures. */
export function createSyntheticCredentials(): SyntheticCredentials {
  const directory = mkdtempSync(join(tmpdir(), 'arbi-edge-simulation-'));
  const path = (file: string): string => join(directory, file);
  const run = (args: string[]): void => {
    try { execFileSync('openssl', args, { stdio: 'ignore', timeout: 10000 }); }
    catch { throw new Error('SYNTHETIC_CERTIFICATE_GENERATION_FAILED'); }
  };
  try {
    run(['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes', '-keyout', path('ca.key'), '-out', path('ca.pem'), '-days', '1', '-subj', '/CN=ARBI ephemeral simulation CA']);
    const issue = (name: string) => {
      run(['req', '-new', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes', '-keyout', path(`${name}.key`), '-out', path(`${name}.csr`), '-subj', `/CN=${name}.sim.arbi.test`]);
      writeFileSync(path(`${name}.ext`), `subjectAltName=DNS:${name}.sim.arbi.test\nextendedKeyUsage=serverAuth,clientAuth\nkeyUsage=digitalSignature\nbasicConstraints=CA:FALSE\n`, { mode: 0o600 });
      run(['x509', '-req', '-in', path(`${name}.csr`), '-CA', path('ca.pem'), '-CAkey', path('ca.key'), '-CAcreateserial', '-out', path(`${name}.pem`), '-days', '1', '-extfile', path(`${name}.ext`)]);
      return { certFile: path(`${name}.pem`), keyFile: path(`${name}.key`), pin: createHash('sha256').update(new X509Certificate(readFileSync(path(`${name}.pem`))).raw).digest('hex') };
    };
    const edge = issue('edge'); const pico = issue('pico'); const pod = issue('pod');
    return { directory, caFile: path('ca.pem'), edgeCertFile: edge.certFile, edgeKeyFile: edge.keyFile, edgePin: edge.pin, modules: { pico, pod } };
  } catch (error) { rmSync(directory, { recursive: true, force: true }); throw error; }
}
export function syntheticAppliedConfiguration(): AppliedConfiguration {
  const fixtures = JSON.parse(readFileSync(new URL('../../../packages/arbi-protocol/fixtures/configuration.json', import.meta.url), 'utf8')) as {
    context: ConfigurationApplyBoundary; valid: { configuration: Configuration }; requests: { request: Omit<ConfigurationRequest, 'configuration'> & { configurationFixture: string } }
  };
  const { configurationFixture: _fixture, ...wire } = fixtures.requests.request;
  const request = { ...wire, configuration: fixtures.valid.configuration };
  const input: AppliedConfiguration = { schemaVersion: 'arbi.configuration/1.0', request, appliedBy: request.target, configurationDigest: configurationDigest(request.configuration) };
  const result = validateConfigurationRecord(input, 'applied');
  if (!result.ok) throw new Error('SYNTHETIC_CONFIGURATION_INVALID');
  return result.value;
}

/** Test-only module. No hardware endpoint, motor pulses, capture or update implementation. */
export class SimulatedModule {
  readonly role: 'pico' | 'pod';
  bootId: string = randomUUID();
  helloPatch: Partial<Hello> = {};
  paused = false;
  diagnosticRequests = 0;
  actuatorRequests = 0;
  localInhibited = true;
  #server?: Server;
  #connections = new Set<TLSSocket>();
  #snapshots = new Map<TLSSocket, () => void>();
  #credentials: SyntheticCredentials;
  #applied: AppliedConfiguration;
  constructor(role: 'pico' | 'pod', credentials: SyntheticCredentials, applied: AppliedConfiguration) {
    this.role = role; this.#credentials = credentials; this.#applied = structuredClone(applied);
  }
  async start(port = 0): Promise<ModuleEnrollment> {
    const credentials = this.#credentials.modules[this.role];
    const server = createServer({ ca: readFileSync(this.#credentials.caFile), cert: readFileSync(credentials.certFile), key: readFileSync(credentials.keyFile),
      requestCert: true, rejectUnauthorized: true, minVersion: 'TLSv1.3', maxVersion: 'TLSv1.3', ALPNProtocols: [TRANSPORT_VERSION], handshakeTimeout: 1500 }, (socket) => this.#connected(socket));
    server.on('tlsClientError', () => {}); server.maxConnections = 4;
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', () => { server.off('error', reject); resolve(); }); });
    this.#server = server;
    return { deviceId: this.role, role: this.role, host: '127.0.0.1', port: (server.address() as { port: number }).port,
      serverName: `${this.role}.sim.arbi.test`, certificateSha256: credentials.pin };
  }
  #connected(socket: TLSSocket): void {
    const raw = socket.getPeerCertificate().raw;
    if (!socket.authorized || socket.alpnProtocol !== TRANSPORT_VERSION || !raw || createHash('sha256').update(raw).digest('hex') !== this.#credentials.edgePin) { socket.destroy(); return; }
    this.#connections.add(socket);
    const source: Identity = { deviceId: this.role, bootId: this.bootId, sessionId: randomUUID() };
    const decoder = new FrameDecoder(); const config = this.#applied.request.configuration;
    const ledger = createCommandLedger(128); let discovered = false; let edge: Identity; let sequence = 0n;
    let interval: NodeJS.Timeout | undefined;
    const snapshot = (): void => {
      if (this.paused || socket.destroyed) return;
      const next = (++sequence).toString();
      const event: Event = { protocol: PROTOCOL_VERSION, messageId: randomUUID(), source, realm: config.realm, siteId: config.siteId, executionMode: 'simulation', sequence: next,
        sourceTime: { utc: null, uncertaintyMs: null, monotonicMs: Math.floor(performance.now()) }, ingestTime: null, kind: 'event',
        body: { type: 'state.snapshot', configRevision: config.revision, capabilitiesRevision: config.revision, capabilities: configurationCapabilities(config, this.role), state: 'Ready',
          eventCursor: { source, sequence: next, stream: 'event' }, telemetryCursor: null, committedCursor: null, supportedCommands: ['state.resync'], supportedProtocols: [PROTOCOL_VERSION] } };
      if (socket.writableLength > 32768) { socket.destroy(); return; }
      socket.write(frame(event));
    };
    socket.on('data', (chunk: Buffer) => {
      try {
        decoder.push(chunk, (input) => {
          if (!discovered) {
            const d = input as Record<string, unknown>;
            if (!d || Object.keys(d).length !== 9 || d.kind !== 'discover' || d.transport !== TRANSPORT_VERSION || d.protocol !== PROTOCOL_VERSION
              || typeof d.challenge !== 'string' || d.executionMode !== 'simulation' || JSON.stringify(d.realm) !== JSON.stringify(config.realm)
              || d.siteId !== config.siteId || d.configurationDigest !== this.#applied.configurationDigest) throw new Error('INVALID_DISCOVERY');
            edge = d.source as Identity;
            if (!edge || edge.deviceId !== 'edge' || typeof edge.bootId !== 'string' || typeof edge.sessionId !== 'string') throw new Error('INVALID_SOURCE');
            const hello: Hello = { transport: TRANSPORT_VERSION, kind: 'hello', challenge: d.challenge, source, role: this.role, realm: config.realm,
              siteId: config.siteId, executionMode: 'simulation', configurationDigest: this.#applied.configurationDigest, protocols: [PROTOCOL_VERSION], ...this.helloPatch };
            socket.write(frame(hello)); discovered = true; this.#snapshots.set(socket, snapshot); snapshot(); interval = setInterval(snapshot, 250);
          } else {
            const parsed = parseMessage(JSON.stringify(input));
            if (!parsed.ok || parsed.value.kind !== 'command') throw new Error('INVALID_COMMAND');
            if (parsed.value.body.type !== 'state.resync') this.actuatorRequests++;
            const result = admitCommand(parsed.value, { realm: config.realm, siteId: config.siteId, executionMode: 'simulation', authenticatedSource: edge,
              receiver: source, nowMonotonicMs: Math.floor(performance.now()), maxDeadlineAheadMs: 1000, authorizedActor: { kind: 'service', id: 'simulation-diagnostics' },
              allowedTypes: ['state.resync'], supportedTypes: ['state.resync'], configRevision: config.revision, faultInhibited: true, lease: null }, ledger);
            if (!result.ok) throw new Error(result.error.code);
            if (result.value.decision === 'accepted') { this.diagnosticRequests++; snapshot(); }
          }
        });
      } catch { socket.destroy(); }
    });
    socket.on('error', () => {});
    socket.on('close', () => { clearInterval(interval); this.#connections.delete(socket); this.#snapshots.delete(socket); this.localStop(); });
  }
  localStop(): void { this.localInhibited = true; }
  sendRaw(bytes: Buffer): void { for (const socket of this.#connections) socket.write(bytes); }
  floodSnapshots(): void { for (const snapshot of this.#snapshots.values()) for (let n = 0; n < 40; n++) snapshot(); }
  disconnect(): void { for (const socket of this.#connections) socket.destroy(); }
  async stop(): Promise<void> {
    this.disconnect(); const server = this.#server; this.#server = undefined;
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
export async function createSimulation() {
  const credentials = createSyntheticCredentials(); const applied = syntheticAppliedConfiguration();
  const peers = [new SimulatedModule('pico', credentials, applied), new SimulatedModule('pod', credentials, applied)];
  try {
    const modules = await Promise.all(peers.map((peer) => peer.start()));
    const settings: Settings = { schemaVersion: 'arbi.edge/1.0', serviceId: 'edge', executionMode: 'simulation', healthPort: 0,
      acceptedConfigurationDigest: applied.configurationDigest, applied,
      tls: { caFile: credentials.caFile, certFile: credentials.edgeCertFile, keyFile: credentials.edgeKeyFile }, modules };
    const configFile = join(credentials.directory, 'simulation.json');
    writeFileSync(configFile, JSON.stringify(settings), { mode: 0o600 });
    return { credentials, peers, settings, configFile, async close() { await Promise.all(peers.map((peer) => peer.stop())); rmSync(credentials.directory, { recursive: true, force: true }); } };
  } catch (error) { await Promise.all(peers.map((peer) => peer.stop())); rmSync(credentials.directory, { recursive: true, force: true }); throw error; }
}
