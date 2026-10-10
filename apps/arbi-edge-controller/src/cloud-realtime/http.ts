import { sign } from 'node:crypto';
import type { KeyObject } from 'node:crypto';
import { configurationDigest, validateMessage } from '@arbi/protocol';
import { ApplicationMeter } from '@arbi/traffic';
import type { Scope, TransferSpec } from '@arbi/traffic';
import { VERSION } from './contracts.js';
import type { Admission, ConsumerConfig, Recovery, RecoveryApi } from './contracts.js';
import { RecoveryTraffic } from './traffic.js';
async function* chunk(bytes: Uint8Array) { yield bytes; }
/** Real attempted JSON application bytes, including failed submissions and every
 * received response chunk. SDK framing/TLS/DNS/WAN/provider counters are separate. */
export class HttpsRecoveryApi implements RecoveryApi {
  #busy = false; #transportOutstanding = false;
  readonly origin: string;
  constructor(readonly config: ConsumerConfig & { credentialId: string; key: KeyObject; origin: string }, readonly meter: ApplicationMeter,
    readonly trafficScope: Scope, readonly transport: typeof fetch = fetch, isolatedLoopback = false, readonly traffic = new RecoveryTraffic()) {
    const url = new URL(config.origin);
    if (url.origin !== config.origin || config.realm.environment === 'production' || config.key.asymmetricKeyType !== 'ed25519' ||
      (url.protocol !== 'https:' && !(isolatedLoopback && url.protocol === 'http:' && url.hostname === '127.0.0.1' && trafficScope.boundary === 'lan')) ||
      trafficScope.siteId !== config.siteId || JSON.stringify(trafficScope.realm) !== JSON.stringify(config.realm) || trafficScope.executionMode !== 'simulation' ||
      trafficScope.source.deviceId !== config.identity.deviceId) throw new Error('INVALID_CONFIGURATION');
    this.origin = url.origin;
  }
  spec(direction: 'upload' | 'download', category: TransferSpec['category']): TransferSpec {
    return { scope: this.trafficScope, direction, category, includes: ['payload'], maxAgeMs: 10000, retryOf: null, media: null };
  }
  count(bytes: number): void { this.traffic.account(bytes); }
  async request(version: string, action: string, payload: unknown, path: string, signal?: AbortSignal): Promise<unknown> {
    // Quarantine a transport ignoring abort until it settles; never accumulate
    // orphan submissions when repeated reconnects hit an uncooperative adapter.
    if (this.#busy || this.#transportOutstanding || signal?.aborted) throw new Error('RECOVERY_UNAVAILABLE');
    this.traffic.request(); this.#busy = true;
    const now = Date.now(), controller = new AbortController();
    let rejectAborted!: (error: Error) => void;
    const aborted = new Promise<never>((_resolve, reject) => { rejectAborted = reject; });
    // Abort can arrive before the first asynchronous submission/read is raced.
    void aborted.catch(() => {});
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    const abort = () => {
      controller.abort(); void reader?.cancel().catch(() => {}); rejectAborted(new Error('RECOVERY_UNAVAILABLE'));
    };
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, 4000);
    try {
      const unsigned = { version, realm: this.config.realm, siteId: this.config.siteId, deviceId: this.config.identity.deviceId, credentialId: this.config.credentialId,
        identity: this.config.identity, issuedAtMs: now, expiresAtMs: now + 10000, action, payload };
      const signature = sign(null, Buffer.from(`arbi-device-proof/1.0:${configurationDigest(unsigned)}`), this.config.key).toString('base64url');
      const bytes = Buffer.from(JSON.stringify({ ...unsigned, signature })); if (bytes.length > 16384) throw new Error('REQUEST_CAPACITY');
      let response: Response | undefined;
      await this.meter.upload(this.spec('upload', action === 'attach' ? 'reconnect' : 'control'), chunk(bytes), async body => {
        if (controller.signal.aborted) throw new Error('RECOVERY_UNAVAILABLE');
        this.count(body.byteLength); this.#transportOutstanding = true;
        const submitted = Promise.resolve().then(() => this.transport(`${this.origin}/api/sites/${encodeURIComponent(this.config.siteId)}/${path}/device`, {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: Buffer.from(body), signal: controller.signal, redirect: 'error', cache: 'no-store',
        })).then(value => {
          if (controller.signal.aborted) { void value.body?.cancel().catch(() => {}); throw new Error('RECOVERY_UNAVAILABLE'); }
          return value;
        }).finally(() => { this.#transportOutstanding = false; });
        response = await Promise.race([submitted, aborted]);
      });
      if (controller.signal.aborted || !response?.body) throw new Error('HTTP_UNAVAILABLE');
      reader = response.body.getReader();
      const read = reader;
      async function* stream() {
        for (;;) {
          const part = await Promise.race([read.read(), aborted]);
          if (controller.signal.aborted) throw new Error('RECOVERY_UNAVAILABLE');
          if (part.done) return;
          yield part.value;
        }
      }
      const chunks: Uint8Array[] = []; let size = 0;
      for await (const part of this.meter.download(this.spec('download', action === 'attach' ? 'reconnect' : 'telemetry'), stream())) {
        this.count(part.byteLength); size += part.byteLength; if (size > 65536) throw new Error('RESPONSE_CAPACITY'); chunks.push(part);
      }
      if (controller.signal.aborted) throw new Error('RECOVERY_UNAVAILABLE');
      if (!response.ok) throw new Error('HTTP_DENIED');
      return JSON.parse(Buffer.concat(chunks).toString());
    } finally {
      clearTimeout(timer); signal?.removeEventListener('abort', abort); controller.abort();
      void reader?.cancel().catch(() => {}); reader?.releaseLock(); this.#busy = false;
    }
  }
  async attach(signal?: AbortSignal): Promise<Admission> { return await this.request(VERSION, 'attach', { grantId: null }, 'realtime', signal) as Admission; }
  async recover(grantId: string, epoch: string | null, cursor: string | null, signal?: AbortSignal): Promise<Recovery> {
    return await this.request(VERSION, 'recover', { grantId, epoch, cursor }, 'realtime', signal) as Recovery;
  }
  async pollJobs(signal?: AbortSignal): Promise<number> {
    const value = await this.request('arbi.jobs-device/1.0', 'poll', {}, 'jobs', signal) as { commands?: unknown[] };
    if (!Array.isArray(value.commands) || value.commands.length > 8) throw new Error('INVALID_JOBS');
    for (const command of value.commands) {
      const checked = validateMessage(command);
      if (!checked.ok || checked.value.kind !== 'command' || JSON.stringify(checked.value.realm) !== JSON.stringify(this.config.realm) ||
        checked.value.siteId !== this.config.siteId || checked.value.executionMode !== 'simulation' ||
        JSON.stringify(checked.value.command.target) !== JSON.stringify(this.config.identity)) throw new Error('INVALID_JOB_SCOPE');
    }
    // Deliberately discard envelopes. No acceptance/outcome or dispatch occurs.
    return value.commands.length;
  }
}
