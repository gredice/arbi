import { AsyncLocalStorage } from 'node:async_hooks';
import { AuthorizationError, isResourceScope, type AuthenticatedIdentity } from '@arbi/gredice';
import { createUsageServer } from '../usage/server';
import { createAuditQueryServer } from '../audit/query-server';
import type { CurrentAuthority } from '../jobs/contracts';
import type { createJobsServer } from '../jobs/server';

type Configuration=Omit<Parameters<typeof createJobsServer>[0],'currentAuthority'>&{queryKey:Uint8Array};
/** BFF-only human read/edit bridge. Each recheck uses the opaque identity authenticated for this request. */
export function createDashboardHistoryTools(config:Configuration){
  const requestIdentity=new AsyncLocalStorage<AuthenticatedIdentity>();
  const currentAuthority:CurrentAuthority=async(previous,signal)=>{
    const principal=requestIdentity.getStore();if(!principal||principal.sessionId!==previous.sessionId)return null;
    const scope=await config.resolveSite({realm:config.realm,siteId:previous.siteId,resource:{kind:'site',id:previous.siteId},signal});
    if(!isResourceScope(scope))return null;return config.identity.authorizeIdentity(principal,previous.capability,scope);
  };
  const usage=createUsageServer({...config,currentAuthority}),audit=createAuditQueryServer({...config,currentAuthority});
  let active=false; // Leave a database connection available for current-directory reads inside the site transaction.
  return {async handle(request:Request,siteId:string,feature:string,action:string):Promise<Response>{
    // Device ingestion, correction, retention/holds and destructive steward operations are separate routes.
    if(feature==='usage'?!['settings','report','history','alerts','export'].includes(action):feature!=='audit'||!['search','export'].includes(action))
      return Response.json({error:'INVALID_REQUEST'},{status:404,headers:{'cache-control':'private, no-store'}});
    if(active)return Response.json({error:'CAPACITY'},{status:429,headers:{'cache-control':'private, no-store','retry-after':'1'}});
    active=true;
    try {
      const credential=request.headers.get('authorization');if(!credential?.startsWith('Bearer '))throw new AuthorizationError('INVALID_CREDENTIAL');
      const principal=await config.identity.authenticate(credential.slice(7));if(principal.actor.kind!=='human')throw new AuthorizationError('CAPABILITY_DENIED');
      return await requestIdentity.run(principal,()=>feature==='usage'?usage.handle(request,{siteId,action}):audit.handle(request,{siteId,action}));
    }catch(error){return Response.json({error:'UNAVAILABLE'},{status:error instanceof AuthorizationError?error.code==='CAPABILITY_DENIED'?403:401:503,headers:{'cache-control':'private, no-store'}});}
    finally{active=false;}
  }};
}
