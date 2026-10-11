import { isId, type SiteRequestBoundary } from '@arbi/gredice';
import { readJsonBody } from '../enrollment/http';
import { exact, id, JobError } from '../jobs/contracts';
import { jobFailure } from '../jobs/http';
import type { AuditQueryStore } from './query-store';
export class AuditQueryHttp {
  constructor(readonly store:AuditQueryStore,readonly humans:SiteRequestBoundary){}
  async handle(request:Request,{siteId,action}:{siteId:string;action:string}):Promise<Response>{
    try{
      if(!isId(siteId) || !['search','export','policy','hold','release-hold','retire'].includes(action) || request.method!==(action==='search'?'GET':'POST'))throw new JobError('INVALID_REQUEST');
      return this.humans.run(request,{siteId,surface:['search','export'].includes(action)?'audit':'http',capability:action==='search'?'audit.read':action==='export'?'audit.export':'configuration.write',
        ...(action==='export'?{resource:{kind:'audit-export' as const,id:siteId}}:{})},async context=>{
        try{
          if(context.actor.kind!=='human')throw new JobError('DENIED');
          if(['search','export'].includes(action)){
            let input:unknown;
            if(action==='export'){
              if(new URL(request.url).search)throw new JobError('INVALID_REQUEST');input=await readJsonBody(request,4096);
            }else{
              const query:Record<string,unknown>={};for(const [key,value] of new URL(request.url).searchParams){if(Object.hasOwn(query,key))throw new JobError('INVALID_REQUEST');query[key]=['fromMs','toMs','limit'].includes(key)&&/^(0|[1-9][0-9]*)$/.test(value)?Number(value):value;}input=query;
            }
            // The separately resolved export resource is a per-site view. Current membership,
            // session and audit.export capability are rechecked against its owning site.
            const result=await this.store.search({...context,resource:{kind:'site',id:siteId}},input,action==='export');return Response.json(result,{headers:{'cache-control':'private, no-store',...(action==='export'?{'content-disposition':'attachment; filename="arbi-audit-export.json"'}:{})}});
          }
          const input=await readJsonBody(request,4096);let result:unknown;
          if(action==='policy')result=await this.store.policy(context,input);
          else if(action==='retire'){exact(input,['origin','eventId','reason']);result=await this.store.retire(context,input as unknown as Parameters<AuditQueryStore['retire']>[1]);}
          else{exact(input,['id','class','targetId','expiresAtMs','reason']);id(input.id);result=await this.store.hold(context,input as unknown as Parameters<AuditQueryStore['hold']>[1],action==='release-hold');}
          return Response.json(result,{headers:{'cache-control':'private, no-store'}});
        }catch(error){return jobFailure(error);}
      });
    }catch(error){return jobFailure(error);}
  }
}
