import type { Identity, Realm } from '@arbi/protocol';
import type { TokenDetails } from 'ably';
export const VERSION = 'arbi.realtime/1.0';
export interface ConsumerConfig { realm: Realm; siteId: string; identity: Identity }
export interface Subscription { id: string; realm: Realm; siteId: string; channel: string; clientId: string; expiresAtMs: number }
export interface Admission { grant: Subscription; token: TokenDetails }
export interface Recovery { version: string; realm: Realm; siteId: string; epoch: string; cursor: string; reset: boolean;
  snapshot: unknown; notifications: { cursor: string; kind: string }[]; more: boolean; expiresAtMs: number; heartbeatAfterMs: number }
export interface RecoveryApi {
  attach(signal?: AbortSignal): Promise<Admission>;
  recover(grantId: string, epoch: string | null, cursor: string | null, signal?: AbortSignal): Promise<Recovery>;
  /** Consumes the merged signed job poll; caller never receives dispatchable work. */
  pollJobs(signal?: AbortSignal): Promise<number>;
}
export interface SubscriptionAdapter { open(admission: Admission, changed: (value: unknown) => void, disconnected: () => void, signal?: AbortSignal): Promise<() => void> }
export function uint(value: unknown): value is string {
  return typeof value === 'string' && /^(0|[1-9][0-9]{0,19})$/.test(value) && BigInt(value)<=18446744073709551615n;
}
