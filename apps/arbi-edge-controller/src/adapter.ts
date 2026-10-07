import { createHash, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { connect, type TLSSocket, type ConnectionOptions } from 'node:tls';
import { advanceCursor, applyTelemetry, AUDIT_VERSION, configurationCapabilities, configurationDigest, createTelemetryState, parseMessage, PROTOCOL_VERSION, validateAuditEvent, type Actor, type AuditEvent, type Command, type Identity, type TelemetryState } from '@arbi/protocol';
import { FrameDecoder, frame } from './framing.js';
import { LINK_TIMEOUT_MS, MAX_FRAMES_PER_SECOND, RECONNECT_MIN_MS, RECONNECT_MAX_MS, TRANSPORT_VERSION, type ModuleEnrollment, type Settings } from './settings.js';
import type { EdgeTraffic } from './metering.js';

export interface Hello {
  transport: 'arbi.local/1.0'; kind: 'hello'; challenge: string; source: Identity;
  role: 'pico' | 'pod'; realm: Settings['applied']['request']['configuration']['realm']; siteId: string;
  executionMode: 'simulation'; protocols: string[]; configurationDigest: string;
}
export interface DiagnosticGrant { id: string; actor: Actor; generation: string; target: Identity; edge: Identity; expiresMonotonicMs: number }
const same = (a: unknown, b: unknown): boolean => configurationDigest(a) === configurationDigest(b);
const sameIdentity = (a: Identity, b: Identity): boolean => a.deviceId === b.deviceId && a.bootId === b.bootId && a.sessionId === b.sessionId;
const id = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
export function parseHello(input: unknown): Hello {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('INVALID_HELLO');
  const h = input as Hello;
  const keys = ['transport', 'kind', 'challenge', 'source', 'role', 'realm', 'siteId', 'executionMode', 'protocols', 'configurationDigest'];
  if (Object.keys(h).length !== keys.length || !keys.every((k) => Object.hasOwn(h, k)) || h.transport !== TRANSPORT_VERSION || h.kind !== 'hello'
    || !id(h.challenge) || !h.source || Object.keys(h.source).length !== 3 || !id(h.source.deviceId) || !id(h.source.bootId) || !id(h.source.sessionId)
    || !['pico', 'pod'].includes(h.role) || !h.realm || Object.keys(h.realm).length !== 2 || h.realm.environment !== 'test' || !id(h.realm.namespaceId)
    || !id(h.siteId) || h.executionMode !== 'simulation' || !Array.isArray(h.protocols) || h.protocols.length !== 1 || h.protocols[0] !== PROTOCOL_VERSION
    || typeof h.configurationDigest !== 'string' || !/^[a-f0-9]{64}$/.test(h.configurationDigest)) throw new Error('INVALID_HELLO');
  return structuredClone(h);
}

/** Owns one current local connection. There is no command queue or automatic replay. */
export class ModuleAdapter {
  #socket?: TLSSocket;
  #retry?: NodeJS.Timeout;
  #timer?: NodeJS.Timeout;
  #stopped = true;
  #backoff = RECONNECT_MIN_MS;
  #generation = '';
  #hello?: Hello;
  #ready = false;
  #reason = 'NOT_CONNECTED';
  #lastValid = 0;
  #peerMonotonic = 0;
  #sequence: string | null = null;
  #telemetry: TelemetryState = createTelemetryState();
  #grants = new Map<string, DiagnosticGrant>();
  #commandSequence = 0n;
  #auditSequence = 0n;
  #audit: AuditEvent[] = [];
  #auditDropped = 0;
  #settings: Settings;
  #enrollment: ModuleEnrollment;
  #edge: Identity;
  #tls: ConnectionOptions;
  constructor(settings: Settings, enrollment: ModuleEnrollment, edge: Identity, tls: ConnectionOptions, readonly traffic?: EdgeTraffic) {
    this.#settings = structuredClone(settings); this.#enrollment = structuredClone(enrollment);
    this.#edge = structuredClone(edge); this.#tls = { ...tls };
  }
  get status() {
    if (this.#ready && performance.now() - this.#lastValid >= LINK_TIMEOUT_MS) this.#disconnect('LINK_EXPIRED');
    return { deviceId: this.#enrollment.deviceId, ready: this.#ready, reason: this.#reason, generation: this.#generation,
      source: structuredClone(this.#hello?.source ?? null), actuationEnabled: false,
      capabilities: configurationCapabilities(this.#settings.applied.request.configuration, this.#enrollment.deviceId) };
  }
  start(): void { if (!this.#stopped) return; this.#stopped = false; this.#connect(); }
  /** Bounded synthetic observations only; no durable append/receipt or device-effect claim. */
  get diagnosticAudit() { return { records: structuredClone(this.#audit), dropped: this.#auditDropped, durable: false }; }
  stop(): void {
    this.#stopped = true; clearTimeout(this.#retry); clearInterval(this.#timer);
    this.#disconnect('SHUTDOWN');
  }
  #disconnect(reason: string): void {
    this.#ready = false; this.#reason = reason; this.#hello = undefined; this.#grants.clear();
    this.#socket?.destroy();
  }
  #connect(): void {
    if (this.#stopped) return;
    this.#generation = randomUUID(); this.#sequence = null;
    this.#telemetry = createTelemetryState(); this.#peerMonotonic = 0;
    const generation = this.#generation;
    const challenge = randomUUID();
    const decoder = new FrameDecoder();
    let helloReceived = false;
    let rateStart = performance.now(); let rateCount = 0;
    this.#lastValid = performance.now(); this.#reason = 'NEGOTIATING';
    const socket = connect({ ...this.#tls, host: this.#enrollment.host, port: this.#enrollment.port,
      servername: this.#enrollment.serverName, rejectUnauthorized: true, minVersion: 'TLSv1.3', maxVersion: 'TLSv1.3',
      ALPNProtocols: [TRANSPORT_VERSION] });
    this.#socket = socket;
    socket.on('secureConnect', () => {
      if (generation !== this.#generation || this.#stopped) return;
      const peer = socket.getPeerCertificate();
      if (!socket.authorized || socket.alpnProtocol !== TRANSPORT_VERSION || !peer.raw
        || createHash('sha256').update(peer.raw).digest('hex') !== this.#enrollment.certificateSha256) return this.#disconnect('AUTHENTICATION_FAILED');
      this.#write({ transport: TRANSPORT_VERSION, kind: 'discover', challenge, source: this.#edge,
        protocol: PROTOCOL_VERSION, realm: this.#settings.applied.request.configuration.realm,
        siteId: this.#settings.applied.request.configuration.siteId, executionMode: 'simulation',
        configurationDigest: this.#settings.acceptedConfigurationDigest });
    });
    socket.on('data', (chunk: Buffer) => {
      if (generation !== this.#generation || socket.destroyed) return;
      this.traffic?.observe(this.#enrollment.deviceId, 'download', 'unknown', chunk);
      try {
        decoder.push(chunk, (input) => {
          if (socket.destroyed) throw new Error('CLOSED');
          const now = performance.now();
          if (now - rateStart >= 1000) { rateStart = now; rateCount = 0; }
          if (++rateCount > MAX_FRAMES_PER_SECOND) throw new Error('RATE_LIMIT');
          if (!helloReceived) {
            const h = parseHello(input); const config = this.#settings.applied.request.configuration;
            if (h.challenge !== challenge || h.source.deviceId !== this.#enrollment.deviceId || h.role !== this.#enrollment.role
              || !same(h.realm, config.realm) || h.siteId !== config.siteId || h.configurationDigest !== this.#settings.acceptedConfigurationDigest) throw new Error('ENROLLMENT_MISMATCH');
            this.#hello = h; helloReceived = true; this.#reason = 'WAITING_SNAPSHOT';
          } else this.#receive(input);
          this.#lastValid = now;
        });
      } catch { this.#disconnect('PEER_REJECTED'); }
    });
    socket.on('error', () => { if (generation === this.#generation) this.#disconnect('TRANSPORT_ERROR'); });
    socket.on('close', () => {
      if (generation !== this.#generation) return;
      clearInterval(this.#timer); this.#disconnect(this.#reason === 'READY' ? 'DISCONNECTED' : this.#reason);
      if (!this.#stopped) {
        const delay = this.#backoff + Math.floor(Math.random() * this.#backoff / 4);
        this.#backoff = Math.min(RECONNECT_MAX_MS, this.#backoff * 2);
        this.#retry = setTimeout(() => this.#connect(), delay);
      }
    });
    this.#timer = setInterval(() => {
      if (performance.now() - this.#lastValid >= LINK_TIMEOUT_MS) this.#disconnect('LINK_EXPIRED');
    }, 50);
  }
  #receive(input: unknown): void {
    const parsed = parseMessage(JSON.stringify(input));
    if (!parsed.ok || parsed.value.kind === 'command') throw new Error('INVALID_MESSAGE');
    const message = parsed.value; const config = this.#settings.applied.request.configuration; const h = this.#hello!;
    if (!sameIdentity(message.source, h.source) || !same(message.realm, config.realm) || message.siteId !== config.siteId || message.executionMode !== 'simulation'
      || message.sourceTime.monotonicMs < this.#peerMonotonic) throw new Error('STALE_PEER');
    if (message.kind === 'event') {
      const cursor = advanceCursor(h.source, 'event', this.#sequence, message.source, message.sequence);
      if (!cursor.ok) throw new Error(cursor.error.code);
      const body = message.body;
      if (body.type !== 'state.snapshot' || body.configRevision !== config.revision || body.capabilitiesRevision !== config.revision
        || !same(body.capabilities, configurationCapabilities(config, h.source.deviceId)) || body.state !== 'Ready'
        || !same(body.supportedProtocols, [PROTOCOL_VERSION]) || !same(body.supportedCommands, ['state.resync'])) throw new Error('NOT_READY');
      this.#sequence = cursor.value.sequence; this.#ready = true; this.#reason = 'READY'; this.#backoff = RECONNECT_MIN_MS;
    } else {
      if (!this.#ready) throw new Error('SNAPSHOT_REQUIRED');
      const result = applyTelemetry(message, { realm: config.realm, executionMode: 'simulation', siteId: config.siteId,
        authenticatedSource: h.source, activeSource: h.source, capabilitiesRevision: config.revision,
        capabilities: configurationCapabilities(config, h.source.deviceId) }, this.#telemetry);
      if (!result.ok) throw new Error(result.error.code);
    }
    this.#peerMonotonic = message.sourceTime.monotonicMs;
  }
  #write(input: unknown): boolean {
    const bytes = frame(input); const socket = this.#socket;
    if (!socket || socket.destroyed || !socket.authorized || socket.writableLength + bytes.length > 32768) {
      this.#disconnect('WRITE_LIMIT'); return false;
    }
    // No retry on ambiguous delivery. A diagnostic grant is consumed before this call.
    const submit = (done: (error?: Error | null) => void) => { socket.write(bytes, done); };
    if (this.traffic) this.traffic.submit(this.#enrollment.deviceId, (input as { kind?: string }).kind === 'discover' ? 'reconnect' : 'control', bytes, submit);
    else submit(() => {});
    return true;
  }
  /** Deliberate synthetic service authorization; a TLS identity does not grant user authority. */
  authorizeDiagnostics(actor: Actor): DiagnosticGrant | null {
    if (!this.status.ready || actor.kind !== 'service' || actor.id !== 'simulation-diagnostics') return null;
    for (const [key, grant] of this.#grants) if (grant.expiresMonotonicMs <= performance.now()) this.#grants.delete(key);
    if (this.#grants.size >= 16) return null;
    const grant: DiagnosticGrant = { id: randomUUID(), actor: structuredClone(actor), generation: this.#generation,
      target: structuredClone(this.#hello!.source), edge: structuredClone(this.#edge), expiresMonotonicMs: performance.now() + 500 };
    const config = this.#settings.applied.request.configuration;
    const event: AuditEvent = { auditVersion: AUDIT_VERSION, eventId: randomUUID(), realm: config.realm, executionMode: 'simulation', siteId: config.siteId,
      actor: grant.actor, source: { module: 'edge', identity: this.#edge }, sequence: (++this.#auditSequence).toString(),
      sourceTime: { utc: null, uncertaintyMs: null, monotonicMs: Math.floor(performance.now()) }, ingestTime: null,
      resource: { kind: 'site', id: config.siteId, deviceId: null }, action: 'authorization.check', evidence: 'authorization',
      outcome: 'allow', effect: 'none', reason: 'authorized', links: { correlationId: grant.id, intentEventId: null, causationEventId: null,
        jobId: null, sessionId: null, commandId: null, requestSource: null, target: null }, record: null,
      metadata: { permission: 'view', grantId: grant.id, configRevision: config.revision }, change: null };
    const checked = validateAuditEvent(event);
    if (!checked.ok) return null;
    if (this.#audit.length === 32) { this.#audit.shift(); this.#auditDropped++; }
    this.#audit.push(structuredClone(checked.value));
    this.#grants.set(grant.id, grant); return structuredClone(grant);
  }
  resync(grant: DiagnosticGrant): boolean {
    if (!grant || typeof grant.id !== 'string') return false;
    const stored = this.#grants.get(grant.id); this.#grants.delete(grant.id);
    if (!this.status.ready || !stored || !same(stored, grant) || stored.expiresMonotonicMs <= performance.now()
      || stored.generation !== this.#generation || !sameIdentity(stored.target, this.#hello!.source) || !sameIdentity(stored.edge, this.#edge)) return false;
    const message: Command = { protocol: PROTOCOL_VERSION, messageId: randomUUID(), realm: this.#settings.applied.request.configuration.realm,
      executionMode: 'simulation', siteId: this.#settings.applied.request.configuration.siteId, source: this.#edge,
      sequence: (++this.#commandSequence).toString(), sourceTime: { utc: null, monotonicMs: Math.floor(performance.now()), uncertaintyMs: null }, ingestTime: null,
      kind: 'command', body: { type: 'state.resync', cursor: null, committedCursor: null },
      command: { commandId: randomUUID(), correlationId: grant.id, idempotencyKey: grant.id, actor: grant.actor, target: grant.target,
        deadline: { bootId: grant.target.bootId, sessionId: grant.target.sessionId, expiresMonotonicMs: this.#peerMonotonic + 500 },
        lease: null, configRevision: this.#settings.applied.request.configuration.revision } };
    return this.#write(message);
  }
}
