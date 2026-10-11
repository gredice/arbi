import { AuthorizationError,bounded,isId,sameRealm,SiteRequestBoundary } from '@arbi/gredice';
import type { AuthorizedContext,BoundaryConfig } from '@arbi/gredice';
import { configurationDigest,validateCommissioningStatus } from '@arbi/protocol';
import { validateCaptureHistoryRow } from '@arbi/protocol/capture-history';
import type { CaptureHistoryRow } from '@arbi/protocol/capture-history';
import type { MediaImage } from '../media/contracts';
import { exact,MediaError,validMetadata } from '../media/contracts';
import { readJsonBody } from '../enrollment/http';
import type { MediaService } from '../media/service';
import type { PostgresMediaStore } from '../media/store';
import type { CaptureEntry,CapturePage } from './capture-contracts';
export interface CaptureSourcePort {rows:(context:AuthorizedContext,signal:AbortSignal)=>Promise<CaptureHistoryRow[]>;configuration:(request:Request,siteId:string,action:'review'|'stage'|'activate')=>Promise<Response>;accessBudget:(context:AuthorizedContext,imageId:string,variant:'full'|'thumbnail',signal:AbortSignal)=>Promise<{allow:boolean;reason:string}>;}
/** Protected human BFF. The trusted source composes native edge stores, and the
 * cloud independently verifies delivery. Reads never sign or download bytes. */
export class CaptureTools {
  readonly boundary:SiteRequestBoundary;
  constructor(readonly options:{boundary:BoundaryConfig;store:PostgresMediaStore;media:MediaService;source?:CaptureSourcePort}){this.boundary=new SiteRequestBoundary(options.boundary);}
  async handle(request:Request,siteId:string,action:string):Promise<Response>{
    const configuration=['review','stage','activate'].includes(action),access=action==='access';
    const headers={'cache-control':'private, no-store'};
    if(!isId(siteId)||!['history','latest','access','review','stage','activate'].includes(action)||request.method!==(['history','latest','review'].includes(action)?'GET':'POST'))return Response.json({error:'INVALID_REQUEST'},{status:400,headers});
    try{let accessInput:Record<string,unknown>|undefined;if(access){const input=await readJsonBody(request);exact(input,['imageId','variant','operation']);if(!isId(input.imageId)||!['full','thumbnail'].includes(String(input.variant))||!['view','download'].includes(String(input.operation)))throw new MediaError('INVALID_REQUEST');accessInput=input;}
      return await this.boundary.run(request,{siteId,surface:access?'media':'http',capability:access?'still.read':configuration?action==='review'?'configuration.read':'configuration.write':'history.read',...(accessInput?{resource:{kind:'still' as const,id:accessInput.imageId as string}}:{})},async context=>{
      try{
        const token=request.headers.get('authorization')?.slice(7);if(!token|| (await this.options.boundary.identity.authenticate(token)).actor.kind!=='human')throw new AuthorizationError('CAPABILITY_DENIED');
        if(configuration){if(!this.options.source)throw Error('UNAVAILABLE');
          const response=await bounded(6000,async signal=>this.options.source!.configuration(new Request(request,{signal:AbortSignal.any([request.signal,signal])}),siteId,action as 'review'|'stage'|'activate'));
          const value=await bounded(1000,async signal=>{if(signal.aborted||!response.body)throw Error();const reader=response.body.getReader(),chunks:Uint8Array[]=[];let bytes=0;const cancel=()=>{void reader.cancel().catch(()=>{});};signal.addEventListener('abort',cancel,{once:true});try{for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.length;if(bytes>262144)throw new MediaError('CAPACITY');chunks.push(part.value);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}finally{signal.removeEventListener('abort',cancel);await reader.cancel().catch(()=>{});reader.releaseLock();}});
          if(response.ok){const status=action==='review'?value.status:value;if(!validateCommissioningStatus(status)||status.siteId!==siteId||!sameRealm(status.realm,context.realm))throw Error('INVALID_CONFIGURATION_SCOPE');}
          return this.boundary.run(request,{siteId,surface:'http',capability:action==='review'?'configuration.read':'configuration.write'},async()=>Response.json(value,{status:response.status,headers}));}
        if(access){const input=accessInput!;
          const policy={siteId,surface:'media' as const,capability:'still.read' as const,resource:{kind:'still' as const,id:input.imageId as string}};
          return this.boundary.run(request,policy,async current=>{const budget=this.options.source&&await bounded(1000,signal=>this.options.source!.accessBudget(current,input.imageId as string,input.variant as 'full'|'thumbnail',signal));
            if(!budget?.allow)return Response.json({state:'deferred',reason:budget?.reason??'access-policy-unavailable'}, {headers});
            const grant=await this.options.media.access(current,{variant:input.variant,operation:input.operation});return this.boundary.run(request,policy,async()=>Response.json({state:'granted',...grant},{headers}));});}
        const query=new URL(request.url).searchParams;if([...query.keys()].some(k=>!['afterId','bedId','plantId'].includes(k))||[...new Set(query.keys())].some(k=>query.getAll(k).length!==1))throw new MediaError('INVALID_REQUEST');
        const after=query.get('afterId'),bed=query.get('bedId'),plant=query.get('plantId');if([after,bed,plant].some(v=>v!==null&&!isId(v)))throw new MediaError('INVALID_REQUEST');
        let source:CapturePage['source']='edge-and-cloud',rows:CaptureHistoryRow[]=[];
        try{if(action==='latest'||!this.options.source)throw Error();rows=await bounded(1500,signal=>this.options.source!.rows(context,signal));if(!Array.isArray(rows)||rows.length>128)throw Error();for(const row of rows){validateCaptureHistoryRow(row);if(row.manifest&&(row.manifest.siteId!==siteId||!sameRealm(row.manifest.realm,context.realm)))throw Error();}}
        catch{source='cloud-only';rows=[];}
        const images=await this.options.store.transact(context.realm,siteId,async tx=>{
          const sql=action==='latest'?`SELECT record FROM arbi_media_images WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND record#>>'{metadata,trace,version}'='arbi.capture-upload/1.0' AND record#>>'{variants,full,state}'='ready' AND ($4::text IS NULL OR record#>>'{metadata,bed,id}'=$4) AND ($5::text IS NULL OR record#>>'{metadata,plant,id}'=$5) ORDER BY (record#>>'{variants,full,verifiedAtMs}')::bigint DESC,id DESC LIMIT 2`:
            `SELECT record FROM arbi_media_images WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND record#>>'{metadata,trace,version}'='arbi.capture-upload/1.0' AND ($4::text IS NULL OR record#>>'{metadata,trace,manifest,image,id}'<$4) AND ($5::text IS NULL OR record#>>'{metadata,bed,id}'=$5) AND ($6::text IS NULL OR record#>>'{metadata,plant,id}'=$6) ORDER BY record#>>'{metadata,trace,manifest,image,id}' DESC,id DESC LIMIT 18`;
          const found=await tx.sql.query<{record:MediaImage}>(sql,[...tx.key(),...(action==='latest'?[bed,plant]:[after,bed,plant])]);return found.rows.map(r=>r.record);});
        for(const image of images){if(!validMetadata(image.metadata)||!sameRealm(image.site.realm,context.realm)||image.site.siteId!==siteId)throw Error('INVALID_CLOUD_HISTORY');const trace=image.metadata.trace;if(!trace)throw Error();
          const a=trace.artifact,v=image.variants.full;if(v.request.sha256!==a.sha256||v.request.size!==a.bytes||v.request.width!==a.widthPx||v.request.height!==a.heightPx)throw Error('INVALID_CLOUD_HISTORY');
          let row=rows.find(r=>r.id===trace.manifest.image.id);if(!row){const m=trace.manifest;row={id:m.image.id,commandId:m.commandId,correlationId:m.correlationId,targetId:m.targetId,association:image.metadata.bed.status==='available'?{bedId:image.metadata.bed.id,plantId:image.metadata.plant.status==='available'?image.metadata.plant.id:null,configurationRevision:(m.metadata.configuration as {revision:string}).revision}:null,job:null,camera:{state:'captured',phase:'captured',reason:null,focus:(m.metadata.focus as {status?:string})?.status==='focused'?'focused':'unavailable'},manifest:m,artifacts:[],retention:'not-staged',warnings:['EDGE_HISTORY_UNAVAILABLE']};rows.push(row);}
          if(!row.association&&image.metadata.bed.status==='available'&&configurationDigest(row.manifest)===configurationDigest(trace.manifest))row.association={bedId:image.metadata.bed.id,plantId:image.metadata.plant.status==='available'?image.metadata.plant.id:null,configurationRevision:(trace.manifest.metadata.configuration as {revision:string}).revision};
          if(!row.artifacts.some(item=>item.trace.artifact.id===a.id))row.artifacts.push({trace,upload:{state:v.state==='ready'?'uploaded':'pending',attempts:null,reason:null,receipt:v.state==='ready'?{artifactId:a.id,imageId:image.id,sha256:a.sha256,bytes:a.bytes,traceDigest:configurationDigest(trace),verified:true}:null}});validateCaptureHistoryRow(row);}
        if(rows.length>256||new Set(rows.map(r=>r.id)).size!==rows.length)throw new MediaError('CAPACITY');
        const eligible=rows.filter(r=>(!bed||r.association?.bedId===bed)&&(!plant||r.association?.plantId===plant)&&(!after||r.id<after)).sort((a,b)=>action==='latest'?0:a.id<b.id?1:a.id>b.id?-1:0);
        const entries:CaptureEntry[]=eligible.slice(0,action==='latest'?1:4).map(row=>({...row,delivery:images.filter(image=>image.metadata.trace?.manifest.image.id===row.id&&configurationDigest(image.metadata.trace.manifest)===configurationDigest(row.manifest)).map(image=>({artifactId:image.metadata.trace!.artifact.id,imageId:image.variants.full.state==='ready'?image.id:null,state:image.variants.full.state==='ready'?'verified' as const:image.variants.full.state==='pending'?'pending' as const:'unavailable' as const,thumbnail:image.variants.thumbnail?.state==='ready'}))}));
        while(entries.length>1&&Buffer.byteLength(JSON.stringify(entries))>245760)entries.pop();
        const value:CapturePage={version:'arbi.capture-history/1.0',siteId,realm:context.realm,entries,next:action!=='latest'&&eligible.length>entries.length?entries.at(-1)!.id:null,source,order:action==='latest'?'cloud-received':'identity'};if(Buffer.byteLength(JSON.stringify(value))>262144)throw new MediaError('CAPACITY');
        return this.boundary.run(request,{siteId,surface:'http',capability:'history.read'},async()=>Response.json(value,{headers}));
      }catch(error){const code=error instanceof MediaError?error.code:error instanceof AuthorizationError?'DENIED':'UNAVAILABLE';return Response.json({error:code},{status:code==='INVALID_REQUEST'?400:code==='CAPACITY'?429:code==='DENIED'?403:503,headers});}
    });}catch{return Response.json({error:'UNAVAILABLE'},{status:503,headers});}
  }
}
