import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer,connect,type Server,type Socket} from 'node:net';
import {once} from 'node:events';
import {payloadDigest} from '@arbi/protocol/capture-transfer';
import type {Realm,Identity} from '@arbi/protocol';
import type {LiveAdapter} from './contracts';
import type {LiveStore} from './store';
import {IsolatedLiveProducer,type LiveFrameReceipt} from '../../../arbi-edge-controller/dist/images/live-producer.js';
import {CapturePreview} from '../../../arbi-edge-controller/dist/images/preview.js';
import {TransferBudget} from '../../../arbi-edge-controller/dist/transfers/budget.js';
import {encodePng,decodePng} from '../../../arbi-edge-controller/dist/images/png.js';
type Frame=Parameters<ConstructorParameters<typeof IsolatedLiveProducer>[0]['send']>[0];
/** Test-only localhost payload transport. No listener is mounted in the app.
 * Counters describe encoded PNG payload and this private packet envelope only. */
export async function liveProducerReference(options:{realm:Realm;siteId:string;source:Identity;inspect:LiveStore['inspectFrameRecipients']}){
  const root=mkdtempSync(join(tmpdir(),'arbi-live-relay-')),servers:Server[]=[],sockets=new Set<Socket>(),viewers=new Map<string,{epoch:number;expiresAtMs:number;port:number;bytes:number;frames:number;wire:number}>();
  const bytes=encodePng({width:32,height:24,rgb:new Uint8Array(32*24*3).fill(120)});let camera=0,encoded=0,upstreamBytes=0,upstreamWire=0,currentFrame:Frame|null=null,currentSignal:AbortSignal|null=null;
  const tracked=(socket:Socket)=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));socket.on('error',()=>{});socket.setTimeout(1000,()=>socket.destroy());return socket;};
  async function listen(receive:(body:Buffer,header:{id:string;sha256:string;bytes:number},wire:number)=>Promise<void>){
    const server=createServer({allowHalfOpen:true},socket=>{
      tracked(socket);let raw=Buffer.alloc(0),done=false;
      socket.on('data',part=>{
        if(done)return;raw=Buffer.concat([raw,part]);if(raw.length>67000){socket.destroy();return;}if(raw.length<2)return;
        const length=raw.readUInt16BE(0);if(length>1024){socket.destroy();return;}if(raw.length<2+length)return;
        try{const header=JSON.parse(raw.subarray(2,2+length).toString());
          if(typeof header.id!=='string'||header.id.length>128||!Number.isInteger(header.bytes)||header.bytes<1||header.bytes>65536||typeof header.sha256!=='string')throw Error('bad-packet');
          if(raw.length<2+length+header.bytes)return;done=true;
          const body=raw.subarray(2+length);assert.equal(body.length,header.bytes);assert.equal(payloadDigest(body),header.sha256);assert.equal(decodePng(body).width,32);
          void receive(body,header,raw.length).then(()=>socket.end(JSON.stringify({frameId:header.id,sha256:header.sha256,acceptedPayloadBytes:body.length}))).catch(()=>socket.destroy());
        }catch{socket.destroy();}
      });
    });servers.push(server);server.listen(0,'127.0.0.1');await once(server,'listening');const address=server.address();assert.ok(address&&typeof address!=='string');return address.port;
  }
  function transmit(port:number,frame:Pick<Frame,'id'|'sha256'|'bytes'>,signal:AbortSignal):Promise<LiveFrameReceipt>{
    return new Promise((resolve,reject)=>{
      const socket=tracked(connect(port,'127.0.0.1')),abort=()=>socket.destroy(Error('aborted'));signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();let reply='';
      socket.on('connect',()=>{if(signal.aborted)return abort();const header=Buffer.from(JSON.stringify({id:frame.id,sha256:frame.sha256,bytes:frame.bytes.length})),prefix=Buffer.alloc(2);prefix.writeUInt16BE(header.length);socket.end(Buffer.concat([prefix,header,frame.bytes]));});
      socket.on('data',part=>{reply+=part.toString();if(reply.length>1024)socket.destroy(Error('oversized-response'));});
      socket.on('error',reject);socket.on('end',()=>{try{resolve(JSON.parse(reply));}catch(e){reject(e);}});
      socket.on('close',()=>{signal.removeEventListener('abort',abort);if(!reply)reject(Error('link-closed'));});
    });
  }
  const port=await listen(async(body,header,wire)=>{
    const frame=currentFrame,signal=currentSignal;if(!frame||!signal||signal.aborted||header.id!==frame.id)throw Error('no-current-frame');
    upstreamBytes+=body.length;upstreamWire+=wire;
    const grants=await options.inspect(frame.demand);if(!grants.authorized)throw Error('current-demand-required');
    for(const grant of grants.recipients){
      if(signal.aborted||currentFrame!==frame||frame.demand.expiresAtMs<=Date.now())throw Error('frame-expired');
      const viewer=viewers.get(grant.id);if(!viewer||viewer.epoch!==grant.epoch||viewer.expiresAtMs!==grant.expiresAtMs||grant.expiresAtMs<=Date.now())continue;
      await transmit(viewer.port,{id:header.id,sha256:header.sha256,bytes:body},AbortSignal.any([signal,AbortSignal.timeout(500)]));
    }
  });
  const policy={revision:'native-live-budget',allowanceBytes:1048576,essentialBytes:65536,maxTransferBytes:1048576,bytesPerSecond:1048576,essentialBytesPerSecond:65536,concurrency:2,essentialConcurrency:1,unknownCoverage:'defer' as const,maxAttempts:32,uploadWindows:[],stream:{maxBitrate:200000,maxDurationMs:15000,idleMs:1000}};
  const budget=new TransferBudget({path:join(root,'budget.sqlite'),realm:options.realm,siteId:options.siteId,source:options.source,policy,clock:()=>({epoch:options.source.bootId,utcMs:Date.now(),monotonicMs:Math.floor(performance.now()),reliable:true}),authorize:()=>true});
  const now=Date.now();budget.checkpoint({period:'native-live-period',startUtcMs:now-1000,endUtcMs:now+60000,revision:1,usedBytes:0,coverage:'complete',observedUtcMs:now,maxAgeMs:60000,coveredCharges:[]});
  const preview=new CapturePreview({budget,nowUtcMs:Date.now,authorized:()=>true,acquireCamera:()=>{assert.equal(camera,0);camera++;return()=>{camera--;};},frame:async()=>{encoded++;return bytes;},append:()=>{}});
  const producer=new IsolatedLiveProducer({path:join(root,'producer.sqlite'),realm:options.realm,siteId:options.siteId,source:options.source,preview,nowUtcMs:Date.now,health:()=>({ready:true,resourceAvailable:true,stillCapturePending:false,updateInhibited:false}),framesPerSecond:5,sendTimeoutMs:1000,append:()=>{},
    send:async(frame,signal)=>{currentFrame=frame;currentSignal=signal;try{return await transmit(port,frame,signal);}finally{currentFrame=null;currentSignal=null;}}});
  const adapter:LiveAdapter={apply:(d,s)=>producer.apply(d,s),signal:async(q,s)=>{
    if(s.aborted)throw Error('aborted');let viewer=viewers.get(q.viewerId);
    if(!viewer){if(viewers.size>=4)throw Error('viewer-capacity');const row={epoch:q.epoch,expiresAtMs:q.expiresAtMs,port:0,bytes:0,frames:0,wire:0};
      row.port=await listen(async(body,_header,wire)=>{if(row.expiresAtMs<=Date.now())throw Error('viewer-expired');row.bytes+=body.length;row.frames++;row.wire+=wire;});viewers.set(q.viewerId,row);viewer=row;
    }else{viewer.epoch=q.epoch;viewer.expiresAtMs=q.expiresAtMs;}
    return {type:'answer',data:'private-native-payload-reference'};
  }};
  return {producer,adapter,viewers,bytes,budget,get camera(){return camera;},get encoded(){return encoded;},get upstreamBytes(){return upstreamBytes;},get upstreamWire(){return upstreamWire;},
    async close(){producer.close();budget.close();for(const socket of sockets)socket.destroy();await Promise.all(servers.map(server=>new Promise<void>(resolve=>server.close(()=>resolve()))));rmSync(root,{recursive:true,force:true});}};
}
