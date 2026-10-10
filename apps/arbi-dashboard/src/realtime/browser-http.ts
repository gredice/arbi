import { BrowserRealtimeError, BrowserTraffic, bytes, identifier } from './browser-contracts';
import type { BrowserRecoveryApi } from './browser-contracts';

/** The trusted caller supplies a current dedicated ARBI bearer. No API key,
 * persisted browser credential, redirect, cookie or automatic token refresh. */
export class BrowserHttpsRecovery implements BrowserRecoveryApi {
  readonly origin: string;
  constructor(origin: string, readonly siteId: string, readonly bearer: (signal: AbortSignal) => Promise<string>,
    readonly traffic: BrowserTraffic, readonly send: typeof fetch = fetch, allowLoopback = false) {
    const url = new URL(origin);
    if (!identifier(siteId) || url.origin !== origin || (url.protocol !== 'https:' && !(allowLoopback &&
      url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname)))) throw new Error('INVALID_CONFIGURATION');
    this.origin = origin;
  }
  attach(signal: AbortSignal): Promise<unknown> { return this.post('attach', { grantId: null }, signal); }
  recover(grantId: string, epoch: string | null, cursor: string | null, signal: AbortSignal): Promise<unknown> {
    return this.post('recover', { grantId, epoch, cursor }, signal);
  }
  private async post(action: string, body: unknown, signal: AbortSignal): Promise<unknown> {
    this.traffic.request();
    const controller = new AbortController();
    let rejectAborted!: (error: Error) => void;
    const aborted = new Promise<never>((_resolve, reject) => { rejectAborted = reject; });
    const abort = () => { controller.abort(); rejectAborted(new BrowserRealtimeError('UNAVAILABLE')); };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    const timer = setTimeout(abort, 4000);
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      const token = await Promise.race([this.bearer(controller.signal), aborted]);
      if (controller.signal.aborted) throw new BrowserRealtimeError('UNAVAILABLE');
      if (!token || token.length > 8192 || /[\r\n]/.test(token)) throw new BrowserRealtimeError('DENIED');
      const payload = JSON.stringify(body);
      this.traffic.account('upload', bytes(payload) + bytes(token));
      // Native browser fetch must not receive this adapter as its WebIDL receiver.
      const send = this.send;
      const response = await Promise.race([send(`${this.origin}/api/sites/${encodeURIComponent(this.siteId)}/realtime/${action}`, {
        method: 'POST', credentials: 'omit', redirect: 'error', cache: 'no-store', signal: controller.signal,
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'x-arbi-request': '1' }, body: payload,
      }), aborted]);
      if (controller.signal.aborted) throw new BrowserRealtimeError('UNAVAILABLE');
      // Stream even error responses within the same cap; discarded/failed bytes count.
      reader = response.body?.getReader();
      let size = 0, text = '';
      const decoder = new TextDecoder('utf-8', { fatal: true });
      if (reader) for (;;) {
        const part = await Promise.race([reader.read(), aborted]);
        if (part.done) break;
        size += part.value.byteLength;
        this.traffic.account('download', part.value.byteLength);
        if (size > 65536) throw new BrowserRealtimeError('CAPACITY');
        text += decoder.decode(part.value, { stream: true });
      }
      text += decoder.decode();
      if (controller.signal.aborted) throw new BrowserRealtimeError('UNAVAILABLE');
      if (response.status === 401 || response.status === 403) throw new BrowserRealtimeError('DENIED');
      if (!response.ok) throw new BrowserRealtimeError(response.status === 429 ? 'CAPACITY' : 'UNAVAILABLE');
      if (!response.headers.get('content-type')?.includes('application/json')) throw new BrowserRealtimeError('INVALID_RESPONSE');
      try { return JSON.parse(text); } catch { throw new BrowserRealtimeError('INVALID_RESPONSE'); }
    } finally {
      controller.abort();
      void reader?.cancel().catch(() => {});
      reader?.releaseLock();
      clearTimeout(timer); signal.removeEventListener('abort', abort);
    }
  }
}
