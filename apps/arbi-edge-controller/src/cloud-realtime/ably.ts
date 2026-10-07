import { Realtime } from 'ably';
import type { ClientOptions } from 'ably';
import type { ApplicationMeter, TransferSpec } from '@arbi/traffic';
import type { Admission, SubscriptionAdapter } from './contracts.js';
/** No key, publication, presence authority, automatic token renewal or offline
 * publication queue. A new application admission is required after disconnect. */
export class AblySubscription implements SubscriptionAdapter {
  constructor(readonly fixtureTransport?: Pick<ClientOptions,'endpoint' | 'port' | 'tls' | 'fallbackHosts' | 'transports'>,
    readonly tap?: { meter: ApplicationMeter; spec: TransferSpec }) {}
  async open(admission: Admission, changed: (value: unknown) => void, disconnected: () => void): Promise<() => void> {
    const realtime = new Realtime({ token: admission.token,clientId: admission.grant.clientId,autoConnect: false,queueMessages: false,strictMode: true,
      realtimeRequestTimeout: 2000,disconnectedRetryTimeout: 60000,suspendedRetryTimeout: 60000,httpMaxRetryCount: 0,useBinaryProtocol: false,
      ...this.fixtureTransport });
    let timer: NodeJS.Timeout | undefined;
    const close = () => { clearTimeout(timer);realtime.close(); };
    realtime.connection.on(['disconnected','suspended','failed'],() => { close();disconnected(); });
    try {
      await new Promise<void>((resolve,reject) => {
        timer=setTimeout(() => reject(new Error('BROKER_TIMEOUT')),2500);
        realtime.connection.once('connected',() => resolve());
        realtime.connection.once('failed',() => reject(new Error('BROKER_UNAVAILABLE')));
        realtime.connect();
      });
      clearTimeout(timer);
      const channel=realtime.channels.get(admission.grant.channel,{modes:['subscribe']});
      channel.on(['failed','suspended','detached'],() => {close();disconnected();});
      channel.on('update',(change) => {if(change.resumed===false) {close();disconnected();}});
      await channel.subscribe('changed',(message) => {
        if(typeof message.data!=='string' || Buffer.byteLength(message.data)>1024) return;
        this.tap?.meter.observe(this.tap.spec,Buffer.from(message.data));
        try {changed(JSON.parse(message.data));} catch { /* malformed hint has no authority */ }
      });
      timer=setTimeout(() => { close();disconnected(); },Math.max(1,admission.grant.expiresAtMs-Date.now()));
      return close;
    } catch { close();throw new Error('BROKER_UNAVAILABLE'); }
  }
}
