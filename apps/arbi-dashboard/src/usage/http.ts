import { isId, type SiteRequestBoundary } from '@arbi/gredice';
import { readJsonBody } from '../enrollment/http';
import { JobError } from '../jobs/contracts';
import { jobFailure } from '../jobs/http';
import type { UsageStore } from './store';
export class UsageHttp {
  constructor(readonly store:UsageStore,readonly humans:SiteRequestBoundary){}
  async handle(request:Request,{siteId,action}:{siteId:string;action:string}):Promise<Response>{
    try {
      if(!isId(siteId))throw new JobError('INVALID_REQUEST');
      if(action==='device'){
        if(request.method!=='POST' || request.headers.has('origin') || request.headers.has('authorization'))throw new JobError('DENIED');
        return Response.json(await this.store.ingest(siteId,await readJsonBody(request,60_000)),{headers:{'cache-control':'private, no-store'}});
      }
      if(!['history','period','correct'].includes(action) || request.method!==(action==='history'?'GET':'POST'))throw new JobError('INVALID_REQUEST');
      const input:Record<string,unknown>={};
      if(action==='history')for(const [key,value] of new URL(request.url).searchParams){
        if(Object.hasOwn(input,key))throw new JobError('INVALID_REQUEST');input[key]=['fromMs','toMs'].includes(key) && /^(0|[1-9][0-9]*)$/.test(value)?Number(value):value;
      }
      return this.humans.run(request,{siteId,surface:'http',capability:action==='correct'?'configuration.write':'history.read'},async context=>{
        try{
          const result=action==='history'?await this.store.read(context,input):action==='period'?await this.store.period(context,await readJsonBody(request,32_768)):
            await this.store.correct(context,await readJsonBody(request,4096));
          return Response.json(result,{headers:{'cache-control':'private, no-store'}});
        }catch(error){return jobFailure(error);}
      });
    }catch(error){return jobFailure(error);}
  }
}
