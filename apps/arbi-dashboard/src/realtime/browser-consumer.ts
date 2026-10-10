import { BROWSER_REALTIME_VERSION, BrowserRealtimeError, bytes, identifier, object, sameScope, uint64 } from './browser-contracts';
import type { BrowserAdmission, BrowserRecovery, BrowserRecoveryApi, BrowserScope, BrowserSubscription } from './browser-contracts';

export type BrowserRecoveryStatus = 'offline' | 'recovering' | 'current' | 'degraded' | 'denied';
/** A single bounded reader. Broker hints never become command envelopes. Caller
 * owns page lifecycle and presentation; close on site/session/page changes. */
export class BrowserRecoveryConsumer {
  #busy = false; #closed = false; #generation = 0; #operation?: AbortController; #subscription?: AbortController; #close?: () => void;
  #admission?: BrowserAdmission; #brokerLost = false; #epoch: string | null = null; #cursor: string | null = null;
  #nextAt = 0; #window: number; #attaches = 0; #calls = 0; #pages = 0; #failures = 0; #hints = 0;
  snapshot: unknown = null;
  status: BrowserRecoveryStatus = 'offline';
  constructor(readonly scope: BrowserScope, readonly api: BrowserRecoveryApi, readonly subscription: BrowserSubscription,
    readonly now: () => number = Date.now, readonly random: () => number = Math.random) {
    if (!identifier(scope.siteId) || !identifier(scope.realm.namespaceId) || !['test', 'preview'].includes(scope.realm.environment)) throw new Error('INVALID_CONFIGURATION');
    this.scope = Object.freeze({ realm: Object.freeze({ ...scope.realm }), siteId: scope.siteId });
    this.#window = now();
  }
  get nextAt(): number { return this.#nextAt; }
  hint(value: unknown): void {
    if (this.#closed || !object(value) || bytes(JSON.stringify(value)) > 1024 || Object.keys(value).sort().join() !== 'cursor,epoch,realm,siteId,version' ||
      value.version !== BROWSER_REALTIME_VERSION || !sameScope(value, this.scope) || !identifier(value.epoch) || !uint64(value.cursor)) return;
    if (value.epoch !== this.#epoch || this.#cursor === null || BigInt(value.cursor) > BigInt(this.#cursor)) {
      this.#hints++; this.#nextAt = Math.min(this.#nextAt, this.now() + 500);
    }
  }
  close(): void {
    this.#closed = true; this.#generation++; this.disconnect(); this.#operation?.abort(); this.snapshot = null; this.status = 'offline';
  }
  private disconnect(): void {
    this.#subscription?.abort(); this.#subscription = undefined; this.#close?.(); this.#close = undefined; this.#admission = undefined;
  }
  async step(): Promise<void> {
    const now = this.now();
    if (this.#closed || this.status === 'denied' || this.#busy || now < this.#nextAt) return;
    this.#busy = true;
    const generation = this.#generation, operation = new AbortController(); this.#operation = operation;
    const live = () => !this.#closed && generation === this.#generation && !operation.signal.aborted;
    try {
      if (now - this.#window >= 60000) { this.#window = now; this.#attaches = 0; this.#calls = 0; }
      if (this.#admission && (this.#brokerLost || now >= this.#admission.grant.expiresAtMs)) { this.disconnect(); this.#brokerLost = false; }
      if (this.#calls >= 60 || (!this.#admission && this.#attaches >= 8)) throw new BrowserRealtimeError('CAPACITY');
      if (!this.#admission) {
        this.status = 'recovering'; this.#attaches++; this.#calls++;
        const admission = this.validateAdmission(await this.api.attach(operation.signal));
        if (!live()) return;
        this.#admission = admission; this.#pages = 0;
        const subscription = new AbortController(); this.#subscription = subscription;
        try {
          const close = await this.subscription.open(admission, value => this.hint(value), () => {
            if (this.#admission === admission) { this.#brokerLost = true; this.status = 'degraded'; }
          }, subscription.signal);
          if (!live()) { close(); return; }
          this.#close = close;
        } catch {
          subscription.abort(); this.#subscription = undefined; this.#brokerLost = false;
          if (!live()) return;
          // Broker downtime still permits metered authoritative HTTPS heartbeats.
        }
      }
      if (!live()) return;
      if (this.#calls >= 60) throw new BrowserRealtimeError('CAPACITY');
      const hints = this.#hints;
      this.#calls++;
      const result = this.validateRecovery(await this.api.recover(this.#admission.grant.id,
        this.#pages >= 4 ? null : this.#epoch, this.#pages >= 4 ? null : this.#cursor, operation.signal));
      if (!live()) return;
      this.#epoch = result.epoch; this.#cursor = result.cursor;
      if (result.snapshot !== null) this.snapshot = result.snapshot;
      this.#pages = result.more ? this.#pages + 1 : 0; this.#failures = 0;
      this.status = result.more ? 'recovering' : this.#close && !this.#brokerLost ? 'current' : 'degraded';
      this.#nextAt = this.now() + (result.more || hints !== this.#hints ? 500 : result.heartbeatAfterMs);
    } catch (error) {
      if (!live()) return;
      this.disconnect(); this.#brokerLost = false;
      if (error instanceof BrowserRealtimeError && error.code === 'DENIED') { this.snapshot = null; this.status = 'denied'; return; }
      if (error instanceof BrowserRealtimeError && error.code === 'INVALID_RESPONSE') { this.#epoch = null; this.#cursor = null; this.#pages = 0; }
      this.status = 'degraded'; this.#failures++;
      this.#nextAt = error instanceof BrowserRealtimeError && error.code === 'CAPACITY' ? this.#window + 60000 :
        this.now() + Math.min(60000, 1000 * 2 ** Math.min(this.#failures - 1, 6) + Math.floor(Math.max(0, Math.min(1, this.random())) * 500));
    } finally { if (this.#operation === operation) this.#operation = undefined; this.#busy = false; }
  }
  private validateAdmission(value: unknown): BrowserAdmission {
    if (!object(value) || !object(value.grant) || !object(value.token)) throw new BrowserRealtimeError('INVALID_RESPONSE');
    const { grant, token } = value;
    if (!sameScope(grant, this.scope) || !identifier(grant.id) || typeof grant.channel !== 'string' ||
      typeof grant.clientId !== 'string' || !/^arbi-[a-f0-9]{64}$/.test(grant.clientId) || !Number.isSafeInteger(grant.expiresAtMs) ||
      grant.channel !== `arbi:${this.scope.realm.environment}:${this.scope.realm.namespaceId}:${this.scope.siteId}:state:${grant.clientId.slice(5)}` ||
      Number(grant.expiresAtMs) <= this.now() || Number(grant.expiresAtMs) > this.now() + 30000 || token.clientId !== grant.clientId ||
      typeof token.token !== 'string' || !token.token || token.token.length > 8192 || !Number.isSafeInteger(token.expires) ||
      !Number.isSafeInteger(token.issued) || Number(token.issued) > this.now() + 250 || Number(token.issued) >= Number(token.expires) ||
      Number(token.expires) <= this.now() || Number(token.expires) > Number(grant.expiresAtMs) ||
      token.capability !== JSON.stringify({ [grant.channel]: ['subscribe'] })) throw new BrowserRealtimeError('INVALID_RESPONSE');
    // Project only the subscription contract: server-side authorization metadata
    // is not retained as browser state or handed to the SDK.
    return { grant: { id: grant.id, realm: this.scope.realm, siteId: this.scope.siteId, channel: grant.channel,
      clientId: grant.clientId, expiresAtMs: Number(grant.expiresAtMs) }, token: { token: token.token, clientId: grant.clientId,
      capability: String(token.capability), issued: Number(token.issued), expires: Number(token.expires) } };
  }
  private validateRecovery(value: unknown): BrowserRecovery {
    const invalid = () => { throw new BrowserRealtimeError('INVALID_RESPONSE'); };
    if (!object(value) || bytes(JSON.stringify(value)) > 65536 || !sameScope(value, this.scope) || value.version !== BROWSER_REALTIME_VERSION ||
      !identifier(value.epoch) || !uint64(value.cursor) || typeof value.reset !== 'boolean' || typeof value.more !== 'boolean' ||
      !Array.isArray(value.notifications) || value.notifications.length > 32 || !Number.isSafeInteger(value.heartbeatAfterMs) ||
      Number(value.heartbeatAfterMs) < 1000 || Number(value.heartbeatAfterMs) > 10000 || value.expiresAtMs !== this.#admission?.grant.expiresAtMs ||
      this.now() >= Number(value.expiresAtMs)) return invalid();
    if (value.snapshot !== null && (!object(value.snapshot) || value.snapshot.coverage !== 'bounded-current-view' ||
      !identifier(value.snapshot.configRevision) || !Array.isArray(value.snapshot.devices) || value.snapshot.devices.length > 32 ||
      !Array.isArray(value.snapshot.states) || value.snapshot.states.length > 32 || !Array.isArray(value.snapshot.jobs) || value.snapshot.jobs.length > 64 ||
      Object.keys(value.snapshot).sort().join() !== 'authority,configRevision,coverage,devices,jobs,states')) return invalid();
    if (value.reset) {
      if (value.notifications.length || value.snapshot === null || value.more) return invalid();
    } else {
      if (value.epoch !== this.#epoch || this.#cursor === null || (value.more ? value.snapshot !== null : value.snapshot === null)) return invalid();
      let cursor = BigInt(this.#cursor);
      for (const event of value.notifications) {
        if (!object(event) || !uint64(event.cursor) || BigInt(event.cursor) !== cursor + 1n || !['state', 'jobs', 'inventory', 'lease'].includes(String(event.kind))) return invalid();
        cursor = BigInt(event.cursor);
      }
      if (BigInt(value.cursor) !== cursor) return invalid();
    }
    return value as unknown as BrowserRecovery;
  }
}
