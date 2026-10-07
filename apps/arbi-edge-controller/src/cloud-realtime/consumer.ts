import { isDeepStrictEqual } from 'node:util';
import { VERSION, uint } from './contracts.js';
import type { ConsumerConfig, RecoveryApi, SubscriptionAdapter, Admission, Recovery } from './contracts.js';
/** Diagnostic/recovery only. This class has no runtime, jobs executor or actuator
 * callback. State/notification receipt cannot imply acceptance or completion. */
export class RecoveryConsumer {
  #busy=false;#dirty=true;#disconnect=false;#close?: () => void;#admission?: Admission;
  #epoch: string | null=null;#cursor: string | null=null;#nextAt=0;#window=0;#attempts=0;#calls=0;#pages=0;
  snapshot: unknown=null;
  status: 'offline' | 'recovering' | 'current' | 'degraded'='offline';
  lastPolledJobs=0;
  constructor(readonly config: ConsumerConfig, readonly api: RecoveryApi, readonly subscription: SubscriptionAdapter,
    readonly random: () => number=Math.random) {}
  hint(value: unknown): void {
    if (!value || typeof value !== 'object' || Buffer.byteLength(JSON.stringify(value))>1024) return;
    const notice=value as Record<string,unknown>;
    if (Object.keys(notice).sort().join()!=='cursor,epoch,realm,siteId,version' || notice.version!==VERSION || !isDeepStrictEqual(notice.realm,this.config.realm) || notice.siteId!==this.config.siteId || !uint(notice.cursor) || typeof notice.epoch!=='string') return;
    if (!this.#dirty && (notice.epoch!==this.#epoch || this.#cursor===null || BigInt(notice.cursor)>BigInt(this.#cursor))) {
      this.#dirty=true;this.#nextAt=Math.min(this.#nextAt,Date.now()+500);
    }
  }
  close(): void { this.#close?.();this.#close=undefined;this.#admission=undefined;this.status='offline'; }
  async step(now=Date.now()): Promise<void> {
    if (this.#busy || now<this.#nextAt) return;
    this.#busy=true;
    try {
      if (now-this.#window>=60000) { this.#window=now;this.#attempts=0;this.#calls=0; }
      if (this.#disconnect || (this.#admission && now>=this.#admission.grant.expiresAtMs)) { this.close();this.#disconnect=false; }
      // Maximum 8 broker admissions and 60 HTTPS calls per minute, across
      // repeated disconnects. A full budget leaves visible degraded state.
      if (this.#calls>=58 || (!this.#admission && this.#attempts>=8)) { this.status='degraded';this.#nextAt=this.#window+60000;return; }
      if (!this.#admission) {
        this.status='recovering';this.#attempts++;this.#calls++;
        const admission=await this.api.attach();
        if (!isDeepStrictEqual(admission.grant.realm,this.config.realm) || admission.grant.siteId!==this.config.siteId || admission.grant.expiresAtMs<=Date.now() ||
          admission.grant.expiresAtMs>Date.now()+30000 || admission.token.clientId!==admission.grant.clientId || admission.token.expires>admission.grant.expiresAtMs ||
          admission.token.capability!==JSON.stringify({ [admission.grant.channel]: ['subscribe'] })) throw new Error('INVALID_ADMISSION');
        this.#admission=admission;this.#pages=0;
        this.#close=await this.subscription.open(admission,(value) => this.hint(value),() => { this.#disconnect=true; });
        this.#dirty=true;
      }
      // Heartbeat recovers dropped notifications too; each step has one bounded
      // page. At most four catch-up pages before requesting a fresh snapshot.
      this.#calls++;
      const result=await this.api.recover(this.#admission.grant.id,this.#pages>=4 ? null : this.#epoch,this.#pages>=4 ? null : this.#cursor);
      this.validate(result);
      this.#epoch=result.epoch;this.#cursor=result.cursor;
      if (result.snapshot!==null) this.snapshot=result.snapshot;
      if (result.reset) this.#pages=0;
      this.#pages=result.more ? this.#pages+1 : 0;this.#dirty=result.more;
      this.status=result.more ? 'recovering' : 'current';
      if (!result.more) { this.#calls++;this.lastPolledJobs=await this.api.pollJobs(); }
      this.#nextAt=now+Math.max(1000,Math.min(10000,result.heartbeatAfterMs));
    } catch {
      this.close();this.status='degraded';
      this.#nextAt=now+Math.min(60000,1000*2**Math.min(this.#attempts,6))+Math.floor(Math.max(0,Math.min(1,this.random()))*500);
    } finally { this.#busy=false; }
  }
  validate(value: Recovery): void {
    if (Buffer.byteLength(JSON.stringify(value))>65536 || value.version!==VERSION || !isDeepStrictEqual(value.realm,this.config.realm) || value.siteId!==this.config.siteId ||
      !uint(value.cursor) || typeof value.epoch!=='string' || !/^[A-Za-z0-9._:-]{1,64}$/.test(value.epoch) || !Array.isArray(value.notifications) || value.notifications.length>32 ||
      typeof value.reset!=='boolean' || typeof value.more!=='boolean' || !Number.isSafeInteger(value.heartbeatAfterMs) || value.expiresAtMs!==this.#admission?.grant.expiresAtMs ||
      Date.now()>=value.expiresAtMs) throw new Error('INVALID_RECOVERY');
    if (value.reset) { if (value.notifications.length || value.snapshot===null) throw new Error('INVALID_RESET');return; }
    if (value.epoch!==this.#epoch || this.#cursor===null || (value.more ? value.snapshot!==null : value.snapshot===null)) throw new Error('INVALID_CURSOR');
    let previous=BigInt(this.#cursor);
    for (const event of value.notifications) {
      if (!uint(event.cursor) || BigInt(event.cursor)!==previous+1n || !['state','jobs','inventory','lease'].includes(event.kind)) throw new Error('REPLAY_GAP');
      previous=BigInt(event.cursor);
    }
    if (BigInt(value.cursor)!==previous) throw new Error('INVALID_CURSOR');
  }
}
