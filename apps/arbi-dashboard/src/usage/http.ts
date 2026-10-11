import { isId, type SiteRequestBoundary } from '@arbi/gredice';
import { readJsonBody } from '../enrollment/http';
import { JobError } from '../jobs/contracts';
import { jobFailure } from '../jobs/http';
import type { UsageStore } from './store';
import { UsageSettingsStore } from './settings-store';
export class UsageHttp {
  readonly settings:UsageSettingsStore;
  constructor(readonly store:UsageStore,readonly humans:SiteRequestBoundary){this.settings=new UsageSettingsStore(store);}
  async handle(request:Request,{siteId,action}:{siteId:string;action:string}):Promise<Response>{
    try {
      if(!isId(siteId))throw new JobError('INVALID_REQUEST');
      if(action==='device'){
        if(request.method!=='POST' || request.headers.has('origin') || request.headers.has('authorization'))throw new JobError('DENIED');
        return Response.json(await this.store.ingest(siteId,await readJsonBody(request,60_000)),{headers:{'cache-control':'private, no-store'}});
      }
      if(!['history','period','correct','settings','report','export','alerts'].includes(action) ||
        (action==='settings'?!['GET','POST'].includes(request.method):request.method!==(['history','alerts'].includes(action)?'GET':'POST')))throw new JobError('INVALID_REQUEST');
      const input:Record<string,unknown>={};
      if(request.method==='GET')for(const [key,value] of new URL(request.url).searchParams){
        if(Object.hasOwn(input,key))throw new JobError('INVALID_REQUEST');input[key]=['fromMs','toMs'].includes(key) && /^(0|[1-9][0-9]*)$/.test(value)?Number(value):value;
      }
      return this.humans.run(request,{siteId,surface:action==='export'?'audit':'http',capability:action==='export'?'audit.export':action==='correct'||action==='settings'&&request.method==='POST'?'configuration.write':'history.read',
        ...(action==='export'?{resource:{kind:'audit-export' as const,id:siteId}}:{})},async context=>{
        try{
          if(action==='settings')return Response.json(await this.settings.settings(context,request.method==='GET'?input:await readJsonBody(request,16384),request.method==='POST'));
          if(action==='alerts')return Response.json(await this.settings.alerts(context,input));
          if(action==='report'||action==='export'){
            if(new URL(request.url).search)throw new JobError('INVALID_REQUEST');
            return Response.json(await this.settings.report({...context,resource:{kind:'site',id:siteId}},await readJsonBody(request,4096),action==='export'),
              {headers:{'cache-control':'private, no-store',...(action==='export'?{'content-disposition':'attachment; filename="arbi-usage-export.json"'}:{})}});
          }
          const result=action==='history'?await this.store.read(context,input):action==='period'?await this.store.period(context,await readJsonBody(request,32_768)):
            await this.store.correct(context,await readJsonBody(request,4096));
          return Response.json(result,{headers:{'cache-control':'private, no-store'}});
        }catch(error){return jobFailure(error);}
      });
    }catch(error){return jobFailure(error);}
  }
}
