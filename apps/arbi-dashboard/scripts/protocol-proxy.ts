import {createServer,type IncomingMessage,type ServerResponse} from 'node:http';
import {once} from 'node:events';
import {readFileSync,writeFileSync,renameSync} from 'node:fs';
import {randomUUID} from 'node:crypto';

export type FaultMode='normal'|'drop-outcome-ack'|'delay-poll'|'reorder-telemetry'|'disconnect';
export interface ProtocolFault {version:'arbi.playground-fault/1.0';revision:string;mode:FaultMode;untilMs:number|null}
export interface ProtocolFact {atMs:number;feature:string;action:string;messageId?:string;kind?:string;sequence?:string;
  source?:unknown;sourceTime?:unknown;commandId?:string;correlationId?:string;outcome?:string;status?:number;effect:string;jobIds?:string[];phase?:string;operationId?:string;error?:string;atMonotonicMs?:number}
/** Private process composition only: no web endpoint can configure faults or select targets. */
export async function createProtocolProxy(target:string,siteId:string,faultPath:string,tracePath:string){
  const origin=new URL(target);if(origin.protocol!=='http:'||origin.hostname!=='127.0.0.1'||origin.pathname!=='/'||origin.search||origin.hash||origin.username||origin.password||siteId!=='synthetic-controls')throw Error('ISOLATED_LOOPBACK_REQUIRED');
  let active=0,closed=false,revision='',consumed=false,held:{path:string;body:string;expires:number}|null=null;
  const facts:ProtocolFact[]=[],sockets=new Set<import('node:net').Socket>();
  const controllers=new Set<AbortController>();
  const record=(fact:ProtocolFact)=>{facts.push(fact);while(facts.length>128||Buffer.byteLength(JSON.stringify(facts))>60000)facts.shift();
    // Readers in the browser process must see one complete bounded snapshot.
    const temporary=`${tracePath}.next`;writeFileSync(temporary,JSON.stringify({version:'arbi.playground-protocol-trace/1.0',facts}),{mode:0o600});renameSync(temporary,tracePath);};
  const scenario=():ProtocolFault=>{
    const raw=readFileSync(faultPath,'utf8');if(Buffer.byteLength(raw)>1024)throw Error('INVALID_FAULT');
    const v=JSON.parse(raw);if(!v||Object.keys(v).sort().join(',')!=='mode,revision,untilMs,version'||v.version!=='arbi.playground-fault/1.0'||
      typeof v.revision!=='string'||!/^[a-zA-Z0-9-]{1,64}$/.test(v.revision)||!['normal','drop-outcome-ack','delay-poll','reorder-telemetry','disconnect'].includes(v.mode)||
      (v.untilMs!==null&&(!Number.isSafeInteger(v.untilMs)||v.untilMs>Date.now()+15000)))throw Error('INVALID_FAULT');
    if(revision!==v.revision){revision=v.revision;consumed=false;held=null;}return v;
  };
  const forward=async(path:string,body:string)=>{
    const controller=new AbortController();controllers.add(controller);const timer=setTimeout(()=>controller.abort(),2500);
    try{const response=await fetch(`${origin.origin}${path}`,{method:'POST',headers:{'content-type':'application/json'},body,redirect:'manual',signal:controller.signal});
      const reader=response.body?.getReader();let chunks='',bytes=0;if(reader)try{while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.length;
        if(bytes>65536)throw Error('CAPACITY');chunks+=Buffer.from(part.value).toString('utf8');}}finally{await reader.cancel();}
      return {status:response.status,body:chunks};
    }finally{clearTimeout(timer);controllers.delete(controller);}
  };
  const fact=(input:any,feature:string,effect:string,status?:number):ProtocolFact=>{
    const p=input.payload,body=p?.body,text=(v:unknown)=>typeof v==='string'?v.slice(0,128):'';
    return {atMs:Date.now(),feature,action:text(input.action),effect,...(status===undefined?{}:{status}),
      ...(p?.protocol==='arbi/1.0'?{messageId:text(p.messageId),kind:text(p.kind),sequence:text(p.sequence),source:{deviceId:text(p.source?.deviceId),bootId:text(p.source?.bootId),sessionId:text(p.source?.sessionId)},
        sourceTime:{utc:text(p.sourceTime?.utc),monotonicMs:Number.isSafeInteger(p.sourceTime?.monotonicMs)?p.sourceTime.monotonicMs:null,uncertaintyMs:Number.isSafeInteger(p.sourceTime?.uncertaintyMs)?p.sourceTime.uncertaintyMs:null}}:{}),
      ...(body?.type==='command.outcome'?{commandId:text(body.commandId),correlationId:text(body.correlationId),outcome:text(body.outcome)}:{})};
  };
  const reply=(response:ServerResponse,status:number,body:string)=>{if(!response.destroyed){response.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});response.end(body);}};
  async function handle(request:IncomingMessage,response:ServerResponse){
    if(closed||active>=8){reply(response,503,'{}');return;}active++;
    try{
      const match=request.url?.match(/^\/api\/sites\/synthetic-controls\/dashboard-(control|telemetry)\/device$/);
      if(request.method!=='POST'||!match){reply(response,404,'{}');return;}
      let body='';for await(const chunk of request){body+=String(chunk);if(Buffer.byteLength(body)>65536)throw Error('CAPACITY');}
      const input=JSON.parse(body),mode=scenario(),feature=match[1];
      if(!['snapshot','poll','outcome','ingest'].includes(input.action))throw Error('INVALID_REQUEST');
      if(mode.mode==='disconnect'&&mode.untilMs!==null&&mode.untilMs>Date.now()){
        record(fact(input,feature,'disconnected',503));reply(response,503,'{}');return;
      }
      if(mode.mode==='reorder-telemetry'&&!consumed&&feature==='telemetry'&&input.payload?.kind==='telemetry'&&!held){
        held={path:request.url!,body,expires:input.expiresAtMs};record(fact(input,feature,'held-for-reorder',503));reply(response,503,'{}');return;
      }
      const result=await forward(request.url!,body),entry=fact(input,feature,'forwarded',result.status);
      if(feature==='control'&&input.action==='poll'&&result.status===200){
        const commands=JSON.parse(result.body).commands;if(Array.isArray(commands))entry.jobIds=commands.slice(0,16).map(c=>String(c.command.commandId));
      }
      record(entry);
      if(mode.mode==='reorder-telemetry'&&!consumed&&held&&feature==='telemetry'&&input.payload?.kind==='telemetry'){
        const previous=held;held=null;consumed=true;
        if(previous.expires>Date.now()){const admitted=await forward(previous.path,previous.body);record(fact(JSON.parse(previous.body),'telemetry','reordered-after-newer',admitted.status));}
      }
      if(!consumed&&mode.mode==='drop-outcome-ack'&&feature==='control'&&input.action==='outcome'&&input.payload?.body?.outcome==='completed'&&result.status===200){
        consumed=true;record(fact(input,feature,'ack-lost',result.status));response.destroy();return;
      }
      if(!consumed&&mode.mode==='delay-poll'&&feature==='control'&&input.action==='poll'&&entry.jobIds?.length){
        consumed=true;record({...entry,atMs:Date.now(),effect:'poll-delayed-1750ms'});await new Promise(resolve=>setTimeout(resolve,1750));
      }
      reply(response,result.status,result.body);
    }catch{reply(response,503,'{}');}finally{active--;}
  }
  const server=createServer((request,response)=>{void handle(request,response);});server.maxConnections=16;server.requestTimeout=3000;server.headersTimeout=3000;
  server.on('connection',socket=>{sockets.add(socket);socket.once('close',()=>sockets.delete(socket));});
  record({atMs:Date.now(),feature:'harness',action:'start',effect:'loopback-only'});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  return {origin:`http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`,local(input:unknown){
    const v=input as Record<string,unknown>;if(!v||!['dispatch','admission-rejected'].includes(String(v.effect))||typeof v.commandId!=='string'||v.commandId.length>128||!Number.isSafeInteger(v.atMonotonicMs))return;
    const text=(value:unknown)=>typeof value==='string'?value.slice(0,128):'';
    record({atMs:Date.now(),feature:'edge-local',action:'observe',effect:text(v.effect),commandId:v.commandId,atMonotonicMs:Number(v.atMonotonicMs),phase:text(v.phase),operationId:text(v.operationId),error:text(v.error)});
  },async close(){
    closed=true;held=null;for(const controller of controllers)controller.abort();for(const socket of sockets)socket.destroy();await new Promise<void>(resolve=>server.close(()=>resolve()));
  }};
}
export function normalProtocolFault():ProtocolFault{return {version:'arbi.playground-fault/1.0',revision:randomUUID(),mode:'normal',untilMs:null};}
