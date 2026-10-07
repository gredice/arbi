import { SiteRequestBoundary, bounded, isResourceScope, sameRealm, isId } from '@arbi/gredice';
import type { GrediceIdentityAdapter, ResourceResolver } from '@arbi/gredice';
import type { Realm } from '@arbi/protocol';
import type { SqlDatabase } from '../enrollment/store';
import { readJsonBody } from '../enrollment/http';
import { jobFailure } from '../jobs/http';
import type { CurrentAuthority } from '../jobs/contracts';
import { RealtimeStore } from './store';
import { RealtimeError } from './contracts';
import type { Broker } from './contracts';

export class RealtimeHttp {
  constructor(readonly store: RealtimeStore, readonly humans: SiteRequestBoundary, readonly resolveSite: ResourceResolver) {}
  async handle(request: Request, params: { siteId: string; action: string }): Promise<Response> {
    try {
      if (!isId(params.siteId) || !['attach','recover','device'].includes(params.action) || request.method !== 'POST' || new URL(request.url).search) throw new RealtimeError('INVALID_REQUEST');
      if (params.action === 'device') {
        if (request.headers.has('origin') || request.headers.has('authorization')) throw new RealtimeError('DENIED');
        const resource = await bounded(1000,(signal) => this.resolveSite({ realm: this.store.realm,siteId: params.siteId,resource: { kind: 'site',id: params.siteId },signal }));
        if (!isResourceScope(resource) || !sameRealm(resource.realm,this.store.realm) || resource.siteId !== params.siteId || resource.resource.kind !== 'site' || resource.resource.id !== params.siteId || resource.executionMode !== 'simulation') throw new RealtimeError('DENIED');
        // Account binding comes from the same locked registry as the credential.
        return Response.json(await this.store.device(params.siteId,await readJsonBody(request),resource.accountId),{ headers: { 'cache-control': 'private, no-store' } });
      }
      return await this.humans.run(request,{ siteId: params.siteId,surface: 'realtime',capability: 'state.read' },async (context) => {
        try { return Response.json(await this.store.human(context,params.action as 'attach' | 'recover',await readJsonBody(request))); }
        catch (error) { return jobFailure(error); }
      });
    } catch (error) { return jobFailure(error); }
  }
}
/** Trusted server-only composition. Missing identity/provider configuration has no fixture fallback. */
export function createRealtimeServer(config: { db: SqlDatabase; realm: Realm; identity: GrediceIdentityAdapter; resolveSite: ResourceResolver;
  currentAuthority: CurrentAuthority; browserOrigins: readonly string[]; broker: Broker }): RealtimeHttp {
  if (!sameRealm(config.realm,config.identity.realm)) throw new RealtimeError('DENIED');
  const resolveSite: ResourceResolver = async (query) => {
    const result = await config.resolveSite(query);
    return isResourceScope(result) && result.executionMode === 'simulation' ? result : null;
  };
  const store = new RealtimeStore(config.db,config.realm,async (previous,signal) => {
    const result = await resolveSite({ realm: config.realm,siteId: previous.siteId,resource: previous.resource,signal });
    if (!isResourceScope(result) || !sameRealm(result.realm,config.realm) || result.accountId !== previous.accountId ||
      result.siteId !== previous.siteId || result.resource.kind !== 'site' || result.resource.id !== previous.siteId) return null;
    return config.currentAuthority(previous,signal);
  },config.broker,resolveSite);
  return new RealtimeHttp(store,new SiteRequestBoundary({ identity: config.identity,resolveResource: resolveSite,browserOrigins: config.browserOrigins,
    auditAuthorization: (record,signal) => store.authorization(record,signal) }),resolveSite);
}
