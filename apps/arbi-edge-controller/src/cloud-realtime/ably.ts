import { Realtime } from 'ably';
import type { ClientOptions } from 'ably';
import type { ApplicationMeter, TransferSpec } from '@arbi/traffic';
import type { Admission, SubscriptionAdapter } from './contracts.js';
import { RecoveryTraffic } from './traffic.js';
/** No key, publication, presence authority, automatic token renewal or offline
 * publication queue. A new application admission is required after disconnect. */
export class AblySubscription implements SubscriptionAdapter {
  constructor(readonly fixtureTransport?: Pick<ClientOptions, 'endpoint' | 'port' | 'tls' | 'fallbackHosts' | 'transports'>,
    readonly tap?: { meter: ApplicationMeter; spec: TransferSpec }, readonly traffic = new RecoveryTraffic()) {}
  async open(admission: Admission, changed: (value: unknown) => void, disconnected: () => void, signal?: AbortSignal): Promise<() => void> {
    const realtime = new Realtime({ token: admission.token, clientId: admission.grant.clientId, autoConnect: false, queueMessages: false, strictMode: true,
      realtimeRequestTimeout: 2000, disconnectedRetryTimeout: 60000, suspendedRetryTimeout: 60000, httpMaxRetryCount: 0, useBinaryProtocol: false,
      ...this.fixtureTransport });
    let timer: NodeJS.Timeout | undefined, closed = false;
    let rejectOpening!: (error: Error) => void;
    const failed = new Promise<never>((_resolve, reject) => { rejectOpening = reject; });
    const close = () => {
      if (closed) return;
      closed = true; clearTimeout(timer); signal?.removeEventListener('abort', close); realtime.close(); rejectOpening(new Error('BROKER_UNAVAILABLE'));
    };
    const lost = () => { if (!closed) { close(); disconnected(); } };
    signal?.addEventListener('abort', close, { once: true });
    realtime.connection.on(['disconnected', 'suspended', 'failed'], lost);
    try {
      await Promise.race([new Promise<void>(resolve => {
        if (signal?.aborted) { close(); return; }
        timer = setTimeout(lost, 2500);
        realtime.connection.once('connected', () => resolve());
        realtime.connect();
      }), failed]);
      const channel = realtime.channels.get(admission.grant.channel, { modes: ['subscribe'] });
      channel.on(['failed', 'suspended', 'detached'], lost);
      channel.on('update', change => { if (change.resumed === false) lost(); });
      // The opening deadline covers both connection and channel attachment.
      await Promise.race([channel.subscribe('changed', message => {
        if (closed || typeof message.data !== 'string') return;
        const count = Buffer.byteLength(message.data);
        this.tap?.meter.observe(this.tap.spec, Buffer.from(message.data));
        try { this.traffic.account(count); } catch { lost(); return; }
        if (count > 1024) return;
        try { changed(JSON.parse(message.data)); } catch { /* malformed hint has no authority */ }
      }), failed]);
      if (closed || signal?.aborted) throw new Error('BROKER_UNAVAILABLE');
      clearTimeout(timer);
      timer = setTimeout(lost, Math.max(1, Math.min(admission.grant.expiresAtMs, admission.token.expires) - Date.now()));
      return close;
    } catch { close(); throw new Error('BROKER_UNAVAILABLE'); }
  }
}
