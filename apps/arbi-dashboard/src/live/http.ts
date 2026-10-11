import {isId,type SiteRequestBoundary} from '@arbi/gredice';
import {readJsonBody} from '../enrollment/http';
import {JobError} from '../jobs/contracts';
import {jobFailure} from '../jobs/http';
import type {LiveStore} from './store';
export class LiveHttp{
  #active=0;
  constructor(readonly store:LiveStore,readonly humans:SiteRequestBoundary){}
  async handle(request:Request,{siteId,action}:{siteId:string;action:string}):Promise<Response>{
    if(this.#active>=4)return jobFailure(new JobError('CAPACITY'));this.#active++;
    try{return await this.#handle(request,{siteId,action});}finally{this.#active--;}
  }
  async #handle(request:Request,{siteId,action}:{siteId:string;action:string}):Promise<Response>{
    try{
      if(action==='device'){
        if(!isId(siteId)||request.method!=='POST'||request.headers.has('origin')||request.headers.has('authorization')||new URL(request.url).search)throw new JobError('DENIED');
        return Response.json(await this.store.device(siteId,await readJsonBody(request,8192)),{headers:{'cache-control':'private, no-store'}});
      }
      if(!isId(siteId)||request.method!=='POST'||new URL(request.url).search||!['start','state','renew','end','revoke','signal','advisory'].includes(action))throw new JobError('INVALID_REQUEST');
      return this.humans.run(request,{siteId,surface:action==='revoke'?'http':'media',capability:action==='revoke'?'configuration.write':'live.view'},async context=>{
        try{const input=await readJsonBody(request,8192);
          if(action==='signal')return Response.json(await this.store.signal(context,input),{headers:{'cache-control':'private, no-store'}});
          if(action==='advisory')return Response.json(await this.store.advisory(context,input),{headers:{'cache-control':'private, no-store'}});
          const view=action==='start'?await this.store.start(context,input):await this.store.action(context,action as 'state'|'renew'|'end'|'revoke',input);
          let producer:unknown={state:'unconfirmed'};
          try{producer=await this.store.synchronize(context.siteId,view.deviceId);}catch{/* Durable admission/end is separate from delivery; local lease expiry remains mandatory. */}
          return Response.json({...view,producer},{status:view.endReason==='policy-denied'?403:action==='start'?202:200,headers:{'cache-control':'private, no-store'}});
        }catch(error){return jobFailure(error);}
      });
    }catch(error){return jobFailure(error);}
  }
}
