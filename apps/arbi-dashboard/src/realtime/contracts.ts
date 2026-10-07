import { isId } from '@arbi/gredice';
import type { AuthorizedContext } from '@arbi/gredice';
import type { Identity, Realm } from '@arbi/protocol';
import type { TokenDetails } from 'ably';
import { JobError } from '../jobs/contracts';
export const VERSION = 'arbi.realtime/1.0';
export class RealtimeError extends JobError {
  constructor(readonly code: 'INVALID_REQUEST' | 'DENIED' | 'EXPIRED' | 'CAPACITY' | 'UNAVAILABLE') { super(code); }
}
export interface Grant {
  id: string; realm: Realm; siteId: string; channel: string; clientId: string; expiresAtMs: number;
  principal: { kind: 'human'; authority: AuthorizedContext } |
    { kind: 'device'; deviceId: string; credentialId: string; identity: Identity; configRevision: string };
}
export interface Notification { version: typeof VERSION; realm: Realm; siteId: string; epoch: string; cursor: string }
export interface Broker {
  issue(grant: Grant, ttlMs: number): Promise<TokenDetails>;
  publish(channel: string, notification: Notification): Promise<void>;
  revoke(clientId: string): Promise<void>;
}
export function cursor(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,19})$/.test(value) || BigInt(value) > 18446744073709551615n) throw new RealtimeError('INVALID_REQUEST');
}
export function identifier(value: unknown): asserts value is string { if (!isId(value)) throw new RealtimeError('INVALID_REQUEST'); }
