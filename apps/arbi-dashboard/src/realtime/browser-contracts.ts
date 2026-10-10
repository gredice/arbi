import type { Realm } from '@arbi/protocol';
import type { TokenDetails } from 'ably';

export const BROWSER_REALTIME_VERSION = 'arbi.realtime/1.0';
export interface BrowserScope { realm: Realm; siteId: string }
export interface BrowserAdmission {
  grant: BrowserScope & { id: string; channel: string; clientId: string; expiresAtMs: number };
  token: TokenDetails;
}
export interface BrowserRecovery extends BrowserScope {
  version: string; epoch: string; cursor: string; reset: boolean; more: boolean;
  snapshot: unknown; notifications: { cursor: string; kind: string }[];
  expiresAtMs: number; heartbeatAfterMs: number;
}
export interface BrowserRecoveryApi {
  attach(signal: AbortSignal): Promise<unknown>;
  recover(grantId: string, epoch: string | null, cursor: string | null, signal: AbortSignal): Promise<unknown>;
}
export interface BrowserSubscription {
  open(admission: BrowserAdmission, changed: (value: unknown) => void, disconnected: () => void, signal: AbortSignal): Promise<() => void>;
}
export class BrowserRealtimeError extends Error {
  constructor(readonly code: 'DENIED' | 'CAPACITY' | 'UNAVAILABLE' | 'INVALID_RESPONSE') { super(code); }
}
export function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
export function identifier(value: unknown): value is string { return typeof value === 'string' && /^[A-Za-z0-9._:-]{1,64}$/.test(value); }
export function uint64(value: unknown): value is string {
  return typeof value === 'string' && /^(0|[1-9][0-9]{0,19})$/.test(value) && BigInt(value) <= 18446744073709551615n;
}
export function sameScope(value: Record<string, unknown>, scope: BrowserScope): boolean {
  return value.siteId === scope.siteId && object(value.realm) && Object.keys(value.realm).length === 2 &&
    value.realm.environment === scope.realm.environment && value.realm.namespaceId === scope.realm.namespaceId;
}
export function bytes(value: string): number { return new TextEncoder().encode(value).byteLength; }

/** Application bytes only: never SDK framing, TLS, WAN or provider billing. Share
 * one budget between HTTP and broker adapters for the lifetime of the page. */
export class BrowserTraffic {
  #window: number; #bytes = 0; #requests = 0;
  readonly totals = { upload: 0, download: 0, broker: 0, requests: 0 };
  constructor(readonly now: () => number = Date.now) { this.#window = now(); }
  get retryAt(): number { this.refresh(); return this.#window + 60000; }
  private refresh(): void { if (this.now() - this.#window >= 60000) { this.#window = this.now(); this.#bytes = 0; this.#requests = 0; } }
  request(): void {
    this.refresh();
    if (this.#requests >= 60) throw new BrowserRealtimeError('CAPACITY');
    this.#requests++; this.totals.requests++;
  }
  account(direction: 'upload' | 'download' | 'broker', count: number): void {
    this.refresh();
    this.#bytes += count; this.totals[direction] += count;
    if (this.#bytes > 2 * 1024 * 1024) throw new BrowserRealtimeError('CAPACITY');
  }
}
