import { Rest } from 'ably';
import type { ClientOptions, TokenDetails } from 'ably';
import type { Broker, Grant, Notification } from './contracts';
import { RealtimeError } from './contracts';
/** Server-only. The key must have revocableTokens enabled before any issuance.
 * Previous issuing keys must remain available for revocation during rotation. */
export class AblyBroker implements Broker {
  readonly rest: Rest;
  readonly previous: Rest[];
  constructor(key: string, revocableTokens: true, previousKeys: readonly string[] = [], fixtureTransport?: Pick<ClientOptions,'endpoint' | 'port' | 'tls' | 'fallbackHosts'>) {
    if (!key || revocableTokens !== true || previousKeys.length > 2) throw new RealtimeError('DENIED');
    const options = { httpRequestTimeout: 2000, httpMaxRetryCount: 0, idempotentRestPublishing: true, useBinaryProtocol: false, ...fixtureTransport };
    this.rest = new Rest({ ...options,key });
    this.previous = previousKeys.map((old) => new Rest({ ...options,key: old }));
  }
  async issue(grant: Grant, ttlMs: number): Promise<TokenDetails> {
    if (!Number.isSafeInteger(ttlMs) || ttlMs < 1 || ttlMs > 30000) throw new RealtimeError('EXPIRED');
    const token = await this.rest.auth.requestToken({ clientId: grant.clientId, ttl: ttlMs,
      capability: JSON.stringify({ [grant.channel]: ['subscribe'] }) });
    if (token.clientId !== grant.clientId || token.expires > grant.expiresAtMs || token.expires <= Date.now() ||
      token.capability !== JSON.stringify({ [grant.channel]: ['subscribe'] })) throw new RealtimeError('DENIED');
    return token;
  }
  async publish(channel: string, notification: Notification): Promise<void> {
    if (Buffer.byteLength(JSON.stringify(notification)) > 1024) throw new RealtimeError('CAPACITY');
    await this.rest.channels.get(channel).publish('changed', JSON.stringify(notification));
  }
  async revoke(clientId: string): Promise<void> {
    for (const rest of [this.rest,...this.previous]) {
      const response = await rest.auth.revokeTokens([{ type: 'clientId', value: clientId }], { allowReauthMargin: false });
      if (response.failureCount !== 0 || response.successCount !== 1 || response.results.length !== 1 || 'error' in response.results[0]) throw new RealtimeError('UNAVAILABLE');
    }
  }
}
