import { bounded,isId,sameRealm,SiteRequestBoundary } from '@arbi/gredice';
import type { BoundaryConfig } from '@arbi/gredice';
import type { Realm } from '@arbi/protocol';
import { exportIncident,parseIncident,INCIDENT_MAX_BYTES } from '@arbi/simulation-core';
import { jobFailure } from '../jobs/http';
import { JobError } from '../jobs/contracts';

export interface IncidentReaderConfig extends BoundaryConfig {
  realm:Realm;privateRedactionSalt:string;
  /** Trusted read-only storage adapter. No request-selected endpoint, file path or actuator adapter. */
  load: (scope:{realm:Realm;siteId:string;bundleId:string},signal:AbortSignal)=>Promise<unknown>;
  now?:()=>number;
}
export class IncidentHttp {
  readonly #config:IncidentReaderConfig;readonly #humans:SiteRequestBoundary;
  constructor(config:IncidentReaderConfig){
    if(!sameRealm(config.realm,config.identity.realm) || !/^[a-f0-9]{64}$/.test(config.privateRedactionSalt) || typeof config.load!=='function')throw new JobError('DENIED');
    this.#config={...config,realm:structuredClone(config.realm)};this.#humans=new SiteRequestBoundary(config);
  }
  async handle(request:Request,params:{siteId:string;action:string}) {
    const {siteId,action}=params;
    try{
      if(request.method!==(action==='export'?'POST':'GET') || request.body!==null || !isId(siteId) || !['read','export'].includes(action))throw new JobError('INVALID_REQUEST');
      const url=new URL(request.url);
      if([...url.searchParams.keys()].some(k=>k!=='bundleId') || url.searchParams.getAll('bundleId').length!==1)throw new JobError('INVALID_REQUEST');
      const bundleId=url.searchParams.get('bundleId');if(!isId(bundleId))throw new JobError('INVALID_REQUEST');
      const policy={siteId,surface:'audit' as const,capability:action==='export'?'audit.export' as const:'audit.read' as const,
        resource:action==='export'?{kind:'audit-export' as const,id:bundleId}:{kind:'site' as const,id:siteId}};
      return await this.#humans.run(request,policy,async context=>{
        if(context.actor.kind!=='human')throw new JobError('DENIED');
        const bundle=parseIncident(await bounded(1000,signal=>this.#config.load({realm:this.#config.realm,siteId,bundleId},signal)));
        if(bundle.id!==bundleId || bundle.siteId!==siteId || !sameRealm(bundle.realm,this.#config.realm))throw new JobError('DENIED');
        const retention=()=>{
          const now=this.#config.now?this.#config.now():this.#config.identity.now();
          if(!Number.isSafeInteger(now) || Date.parse(bundle.data.retentionUntilUtc)<=now || bundle.data.origin==='bench-recording' &&
            (Date.parse(bundle.data.createdAtUtc)>now || Date.parse(bundle.data.retentionUntilUtc)-Date.parse(bundle.data.createdAtUtc)>14*86_400_000))throw new JobError('EXPIRED');
        };retention();
        const value=action==='export'?exportIncident(bundle,this.#config.privateRedactionSalt):bundle;
        const json=JSON.stringify(value);if(Buffer.byteLength(json)>INCIDENT_MAX_BYTES)throw new JobError('CAPACITY');
        return this.#humans.run(request,policy,async fresh=>{
          if(fresh.sessionId!==context.sessionId || fresh.actor.kind!==context.actor.kind || fresh.actor.id!==context.actor.id || fresh.accountId!==context.accountId)throw new JobError('DENIED');
          retention();return new Response(json,{headers:{'content-type':'application/json'}});
        });
      });
    }catch(error){return jobFailure(error);}
  }
}
