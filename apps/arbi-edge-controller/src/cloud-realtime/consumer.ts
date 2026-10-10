import { isDeepStrictEqual } from 'node:util';
import { VERSION, uint } from './contracts.js';
import type { ConsumerConfig, RecoveryApi, SubscriptionAdapter, Admission, Recovery } from './contracts.js';
class InvalidRecovery extends Error {}
/** Diagnostic/recovery only. This class has no runtime, jobs executor or actuator
 * callback. State/notification receipt cannot imply acceptance or completion. */
export class RecoveryConsumer {
  #busy = false; #closed = false; #dirty = true; #disconnect = false; #close?: () => void; #admission?: Admission;
  #operation?: AbortController; #subscription?: AbortController;
  #epoch: string | null = null; #cursor: string | null = null; #nextAt = 0; #window = 0; #attempts = 0; #calls = 0; #pages = 0; #failures = 0;
  snapshot: unknown = null;
  status: 'offline' | 'recovering' | 'current' | 'degraded' = 'offline';
  lastPolledJobs = 0;
  constructor(readonly config: ConsumerConfig, readonly api: RecoveryApi, readonly subscription: SubscriptionAdapter,
    readonly random: () => number = Math.random, readonly clock: () => number = Date.now) {}
  hint(value: unknown): void {
    // Old SDK callbacks cannot shorten failure/capacity backoff after disconnect.
    if (this.#closed || !this.#admission || this.#disconnect || !value || typeof value !== 'object' || Buffer.byteLength(JSON.stringify(value)) > 1024) return;
    const notice = value as Record<string, unknown>;
    if (Object.keys(notice).sort().join() !== 'cursor,epoch,realm,siteId,version' || notice.version !== VERSION || !isDeepStrictEqual(notice.realm, this.config.realm) || notice.siteId !== this.config.siteId || !uint(notice.cursor) || typeof notice.epoch !== 'string') return;
    if (notice.epoch !== this.#epoch || this.#cursor === null || BigInt(notice.cursor) > BigInt(this.#cursor)) {
      this.#dirty = true; this.#nextAt = Math.min(this.#nextAt, this.clock() + 500);
    }
  }
  close(): void {
    this.#closed = true; this.#operation?.abort(); this.disconnect(); this.snapshot = null; this.lastPolledJobs = 0; this.status = 'offline';
  }
  private disconnect(): void {
    this.#subscription?.abort(); this.#subscription = undefined; this.#close?.(); this.#close = undefined; this.#admission = undefined;
  }
  async step(now = this.clock()): Promise<void> {
    if (this.#closed || this.#busy || now < this.#nextAt) return;
    this.#busy = true;
    const operation = new AbortController(); this.#operation = operation;
    const live = () => !this.#closed && !operation.signal.aborted;
    try {
      if (now - this.#window >= 60000) { this.#window = now; this.#attempts = 0; this.#calls = 0; }
      if (this.#disconnect || (this.#admission && now >= Math.min(this.#admission.grant.expiresAtMs, this.#admission.token.expires))) { this.disconnect(); this.#disconnect = false; }
      // Reserve one recovery and one job poll; no queue accumulates behind a slow read.
      if (this.#calls >= 58 || (!this.#admission && this.#attempts >= 8)) { this.disconnect(); this.status = 'degraded'; this.#nextAt = this.#window + 60000; return; }
      if (!this.#admission) {
        this.status = 'recovering'; this.#attempts++; this.#calls++;
        const admission = await this.api.attach(operation.signal);
        if (!live()) return;
        if (!admission || !admission.grant || !admission.token || !Number.isSafeInteger(admission.grant.expiresAtMs) || !Number.isSafeInteger(admission.token.expires) ||
          !Number.isSafeInteger(admission.token.issued) || admission.token.issued > this.clock() + 250 || admission.token.issued >= admission.token.expires ||
          typeof admission.grant.id !== 'string' || !/^[A-Za-z0-9._:-]{1,64}$/.test(admission.grant.id) ||
          typeof admission.grant.clientId !== 'string' || !/^arbi-[a-f0-9]{64}$/.test(admission.grant.clientId) ||
          admission.grant.channel !== `arbi:${this.config.realm.environment}:${this.config.realm.namespaceId}:${this.config.siteId}:state:${admission.grant.clientId.slice(5)}` ||
          typeof admission.token.token !== 'string' || !admission.token.token || admission.token.token.length > 8192 ||
          !isDeepStrictEqual(admission.grant.realm, this.config.realm) || admission.grant.siteId !== this.config.siteId || admission.grant.expiresAtMs <= this.clock() ||
          admission.grant.expiresAtMs > this.clock() + 30000 || admission.token.clientId !== admission.grant.clientId || admission.token.expires <= this.clock() ||
          admission.token.expires > admission.grant.expiresAtMs || admission.token.capability !== JSON.stringify({ [admission.grant.channel]: ['subscribe'] })) throw new InvalidRecovery('INVALID_ADMISSION');
        this.#admission = admission; this.#pages = 0;
        const subscription = new AbortController(); this.#subscription = subscription;
        try {
          const close = await this.subscription.open(admission, value => { if (this.#admission === admission) this.hint(value); }, () => {
            if (this.#admission === admission) { this.#disconnect = true; this.status = 'degraded'; }
          }, subscription.signal);
          if (!live()) { close(); return; }
          this.#close = close;
        } catch {
          subscription.abort(); this.#subscription = undefined; this.#disconnect = false;
          if (!live()) return;
          // Broker outages still permit bounded, authenticated HTTPS recovery.
        }
      }
      if (!live()) return;
      this.#dirty = false; this.#calls++;
      const result = await this.api.recover(this.#admission.grant.id, this.#pages >= 4 ? null : this.#epoch, this.#pages >= 4 ? null : this.#cursor, operation.signal);
      if (!live()) return;
      this.validate(result);
      this.#epoch = result.epoch; this.#cursor = result.cursor;
      if (result.snapshot !== null) this.snapshot = result.snapshot;
      this.#pages = result.more ? this.#pages + 1 : 0;
      if (!result.more) {
        this.#calls++;
        const jobs = await this.api.pollJobs(operation.signal);
        if (!live()) return;
        this.lastPolledJobs = jobs;
      }
      this.#failures = 0;
      this.status = result.more ? 'recovering' : this.#close && !this.#disconnect ? 'current' : 'degraded';
      this.#nextAt = Math.max(now, this.clock()) + (result.more || this.#dirty ? 500 : result.heartbeatAfterMs);
    } catch (error) {
      if (!live()) return;
      this.disconnect(); this.#disconnect = false; this.status = 'degraded';
      if (error instanceof InvalidRecovery) { this.#epoch = null; this.#cursor = null; this.#pages = 0; }
      this.#failures++;
      this.#nextAt = Math.max(now, this.clock()) + Math.min(60000, 1000 * 2 ** Math.min(this.#failures - 1, 6) + Math.floor(Math.max(0, Math.min(1, this.random())) * 500));
    } finally { if (this.#operation === operation) this.#operation = undefined; this.#busy = false; }
  }
  validate(value: Recovery): void {
    if (!value || typeof value !== 'object' || Buffer.byteLength(JSON.stringify(value)) > 65536 || value.version !== VERSION || !isDeepStrictEqual(value.realm, this.config.realm) || value.siteId !== this.config.siteId ||
      !uint(value.cursor) || typeof value.epoch !== 'string' || !/^[A-Za-z0-9._:-]{1,64}$/.test(value.epoch) || !Array.isArray(value.notifications) || value.notifications.length > 32 ||
      typeof value.reset !== 'boolean' || typeof value.more !== 'boolean' || !Number.isSafeInteger(value.heartbeatAfterMs) || value.heartbeatAfterMs < 1000 || value.heartbeatAfterMs > 10000 ||
      value.expiresAtMs !== this.#admission?.grant.expiresAtMs || this.clock() >= value.expiresAtMs) throw new InvalidRecovery('INVALID_RECOVERY');
    if (value.reset) { if (value.notifications.length || value.snapshot === null || value.more) throw new InvalidRecovery('INVALID_RESET'); return; }
    if (value.epoch !== this.#epoch || this.#cursor === null || (value.more ? value.snapshot !== null : value.snapshot === null)) throw new InvalidRecovery('INVALID_CURSOR');
    let previous = BigInt(this.#cursor);
    for (const event of value.notifications) {
      if (!event || typeof event !== 'object' || !uint(event.cursor) || BigInt(event.cursor) !== previous + 1n || !['state', 'jobs', 'inventory', 'lease'].includes(event.kind)) throw new InvalidRecovery('REPLAY_GAP');
      previous = BigInt(event.cursor);
    }
    if (BigInt(value.cursor) !== previous) throw new InvalidRecovery('INVALID_CURSOR');
  }
}
