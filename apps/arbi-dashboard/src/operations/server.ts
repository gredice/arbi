import { SiteRequestBoundary, bounded, isResourceScope, sameRealm, type BoundaryConfig } from '@arbi/gredice';
import { jobFailure } from '../jobs/http';
import { JobError } from '../jobs/contracts';
import { OperationsMonitor } from './monitor';
import type { Realm } from '@arbi/protocol';
export class OperationsHttp{
  readonly humans:SiteRequestBoundary;
  constructor(readonly config:BoundaryConfig&{realm:Realm},readonly monitor:OperationsMonitor){
    if(!sameRealm(config.realm,config.identity.realm))throw new JobError('DENIED');this.humans=new SiteRequestBoundary(config);
  }
  async handle(request:Request,{siteId,action}:{siteId:string;action:string}){
    if(request.method!=='GET'||action!=='health'||new URL(request.url).search)return jobFailure(new JobError('INVALID_REQUEST'));
    return this.humans.run(request,{siteId,surface:'http',capability:'diagnostics.read'},async context=>{
      const result=await this.monitor.health(request.signal);
      // A dependency probe can outlive a directory change. Do not disclose the
      // protected result until the original principal is authorized again.
      try{
        const principal=await this.config.identity.authenticate(request.headers.get('authorization')!.slice(7));
        const scope=await bounded(750,signal=>this.config.resolveResource({realm:this.config.realm,siteId,resource:{kind:'site',id:siteId},signal}));
        if(!isResourceScope(scope))throw Error();const current=await this.config.identity.authorizeIdentity(principal,'diagnostics.read',scope);
        if(request.signal.aborted||current.sessionId!==context.sessionId||current.actor.id!==context.actor.id)throw Error();
      }catch{return jobFailure(new JobError('DENIED'));}
      const {logs:_logs,counters:_counters,droppedLogs:_dropped,...currentProbe}=result;
      return Response.json({...currentProbe,scope:'current probe; historical operational logs and counters require private owner tooling',realm:this.config.realm,siteId},{status:result.state==='ready'?200:503,headers:{'cache-control':'private, no-store'}});
    });
  }
}
