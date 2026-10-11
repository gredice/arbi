import type { Realm } from '@arbi/protocol';
import type { UpdateGateway } from './runtime';
/** Private loopback harness transport. Its gateway credential authenticates this hop, never the requesting user. */
export class IsolatedUpdateProxy implements UpdateGateway {
  readonly #origin:string;readonly #credential:string;
  constructor(options:{realm:Realm;origin:string;credential:string}){const url=new URL(options.origin);if(options.realm.environment!=='test'||url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.pathname!=='/'||url.search||url.hash||url.username||url.password||!/^Bearer [A-Za-z0-9_-]{43}$/.test(options.credential))throw Error('INVALID_UPDATE_GATEWAY');this.#origin=url.origin;this.#credential=options.credential;}
  async handle(request:Request,siteId:string,action:string){try{
    const url=new URL(request.url),headers=new Headers(request.headers);headers.delete('cookie');headers.set('x-arbi-update-gateway',this.#credential);
    const init:RequestInit&{duplex?:'half'}={method:request.method,headers,signal:AbortSignal.any([request.signal,AbortSignal.timeout(8000)]),redirect:'manual',cache:'no-store'};if(request.method==='POST'&&request.body){init.body=request.body;init.duplex='half';}
    const response=await fetch(`${this.#origin}/sites/${encodeURIComponent(siteId)}/updates/${encodeURIComponent(action)}${url.search}`,init);
    if(![200,202,400,401,403,409,503].includes(response.status)||!response.body)throw Error('UNAVAILABLE');
    const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;try{for(;;){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>262144)throw Error('CAPACITY');chunks.push(r.value);}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
    const out=new Headers({'cache-control':'private, no-store','content-type':'application/json'});const correlation=response.headers.get('x-arbi-correlation-id');if(correlation&&/^[A-Za-z0-9._:-]{1,128}$/.test(correlation))out.set('x-arbi-correlation-id',correlation);
    return new Response(Buffer.concat(chunks),{status:response.status,headers:out});
  }catch{return Response.json({error:'UNAVAILABLE'},{status:503,headers:{'cache-control':'private, no-store'}});}}
}
