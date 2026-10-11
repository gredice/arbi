import { canonical } from '@arbi/audit';
import { SiteRequestBoundary,isId,type AuthorizedContext,type BoundaryConfig,type Capability } from '@arbi/gredice';
import { fields,reject } from './journal.js';
import { UpdateOrchestrator,updateError } from './orchestrator.js';
async function body(request:Request){if(!request.body)reject('INVALID_REQUEST');const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0,timer:ReturnType<typeof setTimeout>|undefined;
  try{const timeout=new Promise<never>((_,fail)=>{timer=setTimeout(()=>{void reader.cancel();fail(Error());},1500);});for(;;){const r=await Promise.race([reader.read(),timeout]);if(r.done)break;size+=r.value.byteLength;if(size>4096)reject('INVALID_REQUEST');chunks.push(r.value);}return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;}catch{reject('INVALID_REQUEST');}finally{clearTimeout(timer);await reader.cancel().catch(()=>{});reader.releaseLock();}}
/** The edge owns the SDK and private source/target composition. A browser cannot supply adapters or safety evidence. */
export class UpdateServer {
  constructor(readonly config:Omit<BoundaryConfig,'auditAuthorization'>,readonly orchestrator:UpdateOrchestrator){if(canonical(config.identity.realm)!==canonical(orchestrator.options.store.options.realm))reject('SCOPE_MISMATCH');}
  async handle(request:Request,siteId:string,action:string):Promise<Response>{
    const read=['available','status','audit'].includes(action),capability:Capability=action==='audit'?'audit.read':read?'configuration.read':'update.request';
    const scope=this.orchestrator.options.store.options;
    if(siteId!==scope.siteId){try{this.orchestrator.options.store.authorization({correlationId:crypto.randomUUID(),observedAtMs:this.config.identity.now(),realm:scope.realm,siteId:scope.siteId,actor:null,sessionId:null,capability,surface:capability==='audit.read'?'audit':'http',resource:null,decision:'denied',reason:'SCOPE_MISMATCH',membershipRevision:null});}catch{}return Response.json({error:'SCOPE_MISMATCH'},{status:403,headers:{'cache-control':'private, no-store'}});}
    let authorizationId='';
    const run=(cap:Capability,handler:(context:AuthorizedContext)=>Promise<Response>)=>new SiteRequestBoundary({...this.config,auditAuthorization:async observation=>{authorizationId=this.orchestrator.options.store.authorization(observation);return true;}}).run(request,{siteId,surface:cap==='audit.read'?'audit':'http',capability:cap},handler);
    return run(capability,async context=>{try{
      if(context.actor.kind!=='human'||request.method!==(read?'GET':'POST')||!['available','status','audit','request','advance','override','cancel'].includes(action))reject('INVALID_REQUEST');
      const url=new URL(request.url);if(read&&action==='status'){if([...url.searchParams.keys()].some(k=>k!=='operationId')||url.searchParams.getAll('operationId').length!==1||!isId(url.searchParams.get('operationId')))reject('INVALID_REQUEST');}else if(action==='audit'){if([...url.searchParams.keys()].some(k=>!['after','through','limit'].includes(k))||[...new Set(url.searchParams.keys())].some(k=>url.searchParams.getAll(k).length!==1)||[...url.searchParams.values()].some(v=>!/^\d{1,5}$/.test(v)))reject('INVALID_REQUEST');}else if(url.search)reject('INVALID_REQUEST');
      const same=(current:AuthorizedContext)=>{if(canonical(current.actor)!==canonical(context.actor)||current.sessionId!==context.sessionId)reject('NOT_AUTHORIZED');};
      const fresh=(cap:Capability,handler:(current:AuthorizedContext)=>Promise<Response>)=>run(cap,async current=>{same(current);return handler(current);});
      if(read){const data=action==='available'?this.orchestrator.available():action==='audit'?this.orchestrator.options.store.auditPage(Number(url.searchParams.get('after')??0),url.searchParams.has('through')?Number(url.searchParams.get('through')):null,Number(url.searchParams.get('limit')??32)):this.orchestrator.view(url.searchParams.get('operationId')!);
        return await fresh(capability,async()=>Response.json(data));}
      const input=await body(request);
      return await fresh('update.request',async current=>{
        if(action==='request')return Response.json(this.orchestrator.request(input,current,authorizationId),{status:202});
        fields(input,action==='override'?['operationId','bytes']:['operationId']);if(!isId(input.operationId))reject('INVALID_REQUEST');const id=input.operationId;if(action==='override'&&typeof input.bytes!=='number')reject('INVALID_REQUEST');
        const existing=this.orchestrator.owner(id,current);
        const recheck=async()=>{let id:string|null=null;const r=await fresh('update.request',async()=>{
          if(existing.overrideId)return fresh('configuration.write',async()=>{id=authorizationId;return new Response(null,{status:204});});
          id=authorizationId;return new Response(null,{status:204});});return r.status===204?id:null;};
        const execute=async()=>{const data=action==='override'?this.orchestrator.override(id,current,authorizationId,Number(input.bytes)):action==='cancel'?this.orchestrator.cancel(id,current,authorizationId):await this.orchestrator.advance(id,current,authorizationId,recheck);
          return fresh('update.request',async()=>Response.json(data));};
        if(action==='override'||existing.overrideId)return fresh('configuration.write',async()=>execute());
        return execute();
      });
    }catch(e){const code=updateError(e);
      return Response.json({error:code},{status:code==='UPDATE_UNAVAILABLE'||code==='RESOURCE_LIMIT'?503:['INVALID_REQUEST','INVALID_RECORD'].includes(code)?400:code==='NOT_AUTHORIZED'?403:409});}
    });
  }
}
