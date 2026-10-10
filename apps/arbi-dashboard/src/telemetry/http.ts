import { isId } from '@arbi/gredice';
import type { SiteRequestBoundary } from '@arbi/gredice';
import { readJsonBody } from '../enrollment/http';
import { JobError } from '../jobs/contracts';
import { jobFailure } from '../jobs/http';
import type { TelemetryStore } from './store';

export class TelemetryHttp {
  constructor(readonly store:TelemetryStore,readonly humans:SiteRequestBoundary) {}
  async handle(request:Request,{siteId,action}:{siteId:string;action:string}):Promise<Response> {
    try {
      if(!isId(siteId)) throw new JobError('INVALID_REQUEST');
      if(action==='device') {
        if(request.method!=='POST' || request.headers.has('origin') || request.headers.has('authorization')) throw new JobError('DENIED');
        return Response.json(await this.store.device(siteId,await readJsonBody(request,60_000)),{headers:{'cache-control':'private, no-store'}});
      }
      if(!['current','history','inventory'].includes(action) || request.method!=='GET') throw new JobError('INVALID_REQUEST');
      const params=new URL(request.url).searchParams,query:Record<string,unknown>={};
      for(const [key,value] of params) {
        if(Object.hasOwn(query,key)) throw new JobError('INVALID_REQUEST');
        query[key]=['fromMs','toMs','limit'].includes(key) && /^(0|[1-9][0-9]*)$/.test(value)?Number(value):value;
      }
      if(action==='inventory' && query.limit===undefined) query.limit=25;
      const capability=action==='current'?'state.read':action==='inventory' || query.tier==='trace'?'diagnostics.read':'history.read';
      return await this.humans.run(request,{siteId,surface:'http',capability},async context=>{
        try {return Response.json(await this.store.read(context,action as 'current'|'history'|'inventory',query),{headers:{'cache-control':'private, no-store'}});}
        catch(error){return jobFailure(error);}
      });
    } catch(error) {return jobFailure(error);}
  }
}
