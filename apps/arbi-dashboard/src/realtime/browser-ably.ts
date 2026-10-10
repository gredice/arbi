import { Realtime } from 'ably';
import type { ClientOptions } from 'ably';
import { BrowserRealtimeError, BrowserTraffic, bytes } from './browser-contracts';
import type { BrowserAdmission, BrowserSubscription } from './browser-contracts';

export class AblyBrowserSubscription implements BrowserSubscription {
  constructor(readonly traffic: BrowserTraffic,
    readonly fixtureTransport?: Pick<ClientOptions, 'endpoint' | 'port' | 'tls' | 'fallbackHosts' | 'transports'>) {}
  async open(admission: BrowserAdmission, changed: (value: unknown) => void, disconnected: () => void, signal: AbortSignal): Promise<() => void> {
    const realtime = new Realtime({ token: admission.token, clientId: admission.grant.clientId, autoConnect: false,
      queueMessages: false, strictMode: true, realtimeRequestTimeout: 2000, disconnectedRetryTimeout: 60000,
      suspendedRetryTimeout: 60000, httpMaxRetryCount: 0, useBinaryProtocol: false, ...this.fixtureTransport });
    let timer: ReturnType<typeof setTimeout> | undefined, closed = false;
    let rejectOpening!: (error: Error) => void;
    const failed = new Promise<never>((_resolve, reject) => { rejectOpening = reject; });
    const close = () => {
      if (closed) return;
      closed = true; clearTimeout(timer); signal.removeEventListener('abort', aborted); realtime.close();
      rejectOpening(new BrowserRealtimeError('UNAVAILABLE'));
    };
    const aborted = () => close();
    const lost = () => { if (!closed) { close(); disconnected(); } };
    signal.addEventListener('abort', aborted, { once: true });
    realtime.connection.on(['disconnected', 'suspended', 'failed'], lost);
    try {
      await Promise.race([new Promise<void>(resolve => {
        if (signal.aborted) { close(); return; }
        timer = setTimeout(lost, 2500);
        realtime.connection.once('connected', () => resolve());
        realtime.connect();
      }), failed]);
      const channel = realtime.channels.get(admission.grant.channel, { modes: ['subscribe'] });
      channel.on(['failed', 'suspended', 'detached'], lost);
      channel.on('update', change => { if (change.resumed === false) lost(); });
      // Keep the overall opening deadline through attachment, not just connection.
      await Promise.race([channel.subscribe('changed', message => {
        if (closed || typeof message.data !== 'string') return;
        try {
          const count = bytes(message.data);
          this.traffic.account('broker', count);
          if (count > 1024) return;
          changed(JSON.parse(message.data));
        } catch (error) { if (error instanceof BrowserRealtimeError) lost(); }
      }), failed]);
      if (closed || signal.aborted) throw new BrowserRealtimeError('UNAVAILABLE');
      clearTimeout(timer);
      timer = setTimeout(lost, Math.max(1, Math.min(admission.grant.expiresAtMs, admission.token.expires) - Date.now()));
      return close;
    } catch { close(); throw new BrowserRealtimeError('UNAVAILABLE'); }
  }
}
