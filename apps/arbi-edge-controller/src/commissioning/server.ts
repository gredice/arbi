import { SiteRequestBoundary, isId, type BoundaryConfig } from '@arbi/gredice';
import { CommissioningCoordinator } from './coordinator.js';
import { CommissioningError } from './contracts.js';
import { CommissioningStore } from './store.js';

/** Fetch handler composed by an authenticated local/BFF transport. No listener or default provider grants authority. */
export class CommissioningServer {
  readonly boundary: SiteRequestBoundary;
  constructor(config: Omit<BoundaryConfig, 'auditAuthorization'>, readonly coordinator: CommissioningCoordinator,
    readonly store: CommissioningStore, readonly now: () => number) {
    this.boundary = new SiteRequestBoundary({ ...config, auditAuthorization: async observation => {
      store.auditAuthorization(observation.actor ?? { kind: 'service', id: 'unverified-request' }, observation.sessionId,
        observation.decision === 'authorized', observation.correlationId, now()); return true;
    } });
  }
  async handle(request: Request, siteId: string, action: string): Promise<Response> {
    const read = action === 'status';
    return this.boundary.run(request, { surface: 'http', siteId, capability: read ? 'configuration.read' : 'configuration.write' }, async context => {
      try {
        if (siteId !== this.coordinator.status.siteId || request.method !== (read ? 'GET' : 'POST')
          || !['status', 'enroll', 'stage', 'activate', 'invalidate', 'recover'].includes(action)) throw new CommissioningError('INVALID_REQUEST');
        if (read) return Response.json(this.coordinator.status);
        const input = await body(request);
        const fields = action === 'enroll' ? ['reason', 'deviceId'] : action === 'stage' ? ['reason', 'set'] : ['reason'];
        if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).sort().join() !== fields.sort().join()
          || !isId(input.reason)) throw new CommissioningError('INVALID_REQUEST');
        if (action === 'enroll') {
          if (!isId(input.deviceId)) throw new CommissioningError('INVALID_REQUEST');
          this.coordinator.enroll(context, input.deviceId, input.reason);
        } else if (action === 'stage') this.coordinator.stage(context, input.set, input.reason);
        else if (action === 'invalidate') this.coordinator.invalidate(context, input.reason);
        else await this.coordinator.activate(context, input.reason, action === 'recover', async () => {
          const refreshed = await this.boundary.run(request, { surface: 'http', siteId, capability: 'configuration.write' }, async current => {
            if (current.sessionId !== context.sessionId || current.actor.id !== context.actor.id || current.actor.kind !== context.actor.kind) throw new CommissioningError('NOT_AUTHORIZED');
            return new Response(null, { status: 204 });
          });
          if (refreshed.status !== 204) throw new CommissioningError('NOT_AUTHORIZED');
        });
        return Response.json(this.coordinator.status);
      } catch (e) {
        const code = e instanceof CommissioningError ? e.code : 'UNAVAILABLE';
        try { this.store.auditAuthorization(context.actor, context.sessionId, false, 'commissioning-rejected', this.now()); } catch { /* mutation remains denied */ }
        return Response.json({ error: code }, { status: code === 'LOCAL_AUTHORIZATION_REQUIRED' ? 403 : code === 'UNAVAILABLE' ? 503 : 409 });
      }
    });
  }
}
async function body(request: Request): Promise<Record<string, unknown>> {
  if (!request.body) throw new CommissioningError('INVALID_REQUEST');
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => { void reader.cancel(); reject(new CommissioningError('REQUEST_TIMEOUT')); }, 2000); });
    for (;;) {
      const next = await Promise.race([reader.read(), timeout]); if (next.done) break;
      size += next.value.byteLength;
      if (size > 1_048_576) throw new CommissioningError('REQUEST_TOO_LARGE');
      chunks.push(next.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
  } catch (e) { throw e instanceof CommissioningError ? e : new CommissioningError('INVALID_REQUEST'); }
  finally { clearTimeout(timer); await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
