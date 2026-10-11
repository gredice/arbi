import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer,connect } from 'node:net';
import { once } from 'node:events';
import { payloadDigest } from '@arbi/protocol/capture-transfer';
import type { LiveProducerDemand } from '@arbi/protocol/live-demand';
import { TransferBudget,type TransferPolicy } from '../transfers/budget.js';
import { encodePng,decodePng } from './png.js';
import { CapturePreview } from './preview.js';
import { IsolatedLiveProducer,type LiveFrameReceipt,type LiveProducerHook } from './live-producer.js';
const policy:TransferPolicy={revision:'live-reference-budget',allowanceBytes:1048576,essentialBytes:65536,maxTransferBytes:1048576,bytesPerSecond:1048576,essentialBytesPerSecond:65536,concurrency:2,essentialConcurrency:1,unknownCoverage:'defer',maxAttempts:32,uploadWindows:[],stream:{maxBitrate:200000,maxDurationMs:15000,idleMs:1000}};
async function fixture(t:test.TestContext){
  const root=mkdtempSync(join(tmpdir(),'arbi-live-native-')),realm={environment:'test' as const,namespaceId:'live-native-reference'},source={deviceId:'edge-live-reference',bootId:'native-live-boot',sessionId:'native-live-session'};let now=Date.now(),camera=0,encoded=0,sent=0,wire=0;
  const hooks:LiveProducerHook[]=[],budget=new TransferBudget({path:join(root,'budget.sqlite'),realm,siteId:'synthetic-site',source,policy,clock:()=>({epoch:source.bootId,utcMs:now,monotonicMs:1000,reliable:true}),authorize:()=>true});
  budget.checkpoint({period:'live-reference-period',startUtcMs:now-1000,endUtcMs:now+3600000,revision:1,usedBytes:0,coverage:'complete',observedUtcMs:now,maxAgeMs:60000,coveredCharges:[]});
  const rgb=new Uint8Array(32*24*3).fill(120),bytes=encodePng({width:32,height:24,rgb}),server=createServer(socket=>{
    let raw=Buffer.alloc(0);socket.setTimeout(1000,()=>socket.destroy());socket.on('error',()=>{});
    socket.on('data',part=>{raw=Buffer.concat([raw,part]);if(raw.length>67000){socket.destroy();return;}if(raw.length<2)return;const length=raw.readUInt16BE(0);if(length>1024){socket.destroy();return;}if(raw.length<2+length)return;
      const header=JSON.parse(raw.subarray(2,2+length).toString());if(raw.length<2+length+header.bytes)return;const body=raw.subarray(2+length);assert.equal(body.length,header.bytes);assert.equal(payloadDigest(body),header.sha256);assert.equal(decodePng(body).width,32);sent+=body.length;wire+=raw.length;socket.end(JSON.stringify({frameId:header.id,sha256:header.sha256,acceptedPayloadBytes:body.length}));
    });
  });server.listen(0,'127.0.0.1');await once(server,'listening');const address=server.address();assert.ok(address&&typeof address!=='string');
  const nativeSend:ConstructorParameters<typeof IsolatedLiveProducer>[0]['send']=(frame,signal)=>new Promise((resolve,reject)=>{
    const socket=connect(address.port,'127.0.0.1'),abort=()=>socket.destroy(Error('aborted'));signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();let reply='';
    socket.setTimeout(1000,()=>socket.destroy(Error('timeout')));socket.on('connect',()=>{const header=Buffer.from(JSON.stringify({id:frame.id,sha256:frame.sha256,bytes:frame.bytes.length})),prefix=Buffer.alloc(2);prefix.writeUInt16BE(header.length);socket.end(Buffer.concat([prefix,header,frame.bytes]));});
    socket.on('data',part=>{reply+=part.toString();if(reply.length>1024)socket.destroy(Error('oversized-response'));});socket.on('error',reject);socket.on('end',()=>{try{resolve(JSON.parse(reply) as LiveFrameReceipt);}catch(e){reject(e);}});socket.on('close',()=>signal.removeEventListener('abort',abort));
  });
  let send=nativeSend,health={ready:true,resourceAvailable:true,stillCapturePending:false,updateInhibited:false};
  const preview=new CapturePreview({budget,nowUtcMs:()=>now,authorized:()=>true,acquireCamera:()=>{assert.equal(camera,0);camera++;return ()=>{camera--;};},frame:async()=>{encoded++;return bytes;},append:()=>{}});
  const options={path:join(root,'producer.sqlite'),realm,siteId:'synthetic-site',source,preview,nowUtcMs:()=>now,health:()=>health,send:(...args:Parameters<typeof nativeSend>)=>send(...args),append:(e:LiveProducerHook)=>hooks.push(e),framesPerSecond:5,sendTimeoutMs:100};let producer=new IsolatedLiveProducer(options);
  const demand=(generation='1',viewers=1):LiveProducerDemand=>({version:'arbi.live/1.0',realm,siteId:'synthetic-site',id:'native-producer-1',generation,target:source,configRevision:'native-config-1',profile:{id:'native-low',transport:'isolated-signaling',maxUpstreamBps:200000,maxDownstreamBps:400000,maxViewers:2},viewers,issuedAtMs:now,expiresAtMs:now+5000,sharedUpstream:true});
  t.after(async()=>{producer.close();budget.close();server.close();await once(server,'close');rmSync(root,{recursive:true,force:true});});
  return {root,bytes,budget,options,hooks,demand,get producer(){return producer;},get camera(){return camera;},get encoded(){return encoded;},get sent(){return sent;},get wire(){return wire;},advance(ms:number){now+=ms;},health(value:Partial<typeof health>){health={...health,...value};},send(value:typeof nativeSend){send=value;},reopen(){producer.close();producer=new IsolatedLiveProducer(options);}};
}
const signal=()=>new AbortController().signal;
test('boot sends no frame; current backend demand produces one real TCP payload and distinct conservative budget/receipt counters',async t=>{
  const f=await fixture(t);assert.equal(f.producer.status.state,'stopped');assert.equal(f.camera,0);assert.equal(f.encoded,0);assert.equal((await f.producer.step(signal())).state,'stopped');const d=f.demand('1',2);
  assert.equal((await f.producer.apply(d,signal())).state,'leased');assert.equal(f.camera,1);assert.equal(f.encoded,0);assert.equal((await f.producer.step(signal())).state,'sent');assert.equal(f.encoded,1);assert.equal(f.sent,f.bytes.length);assert.ok(f.wire>f.sent);assert.equal(f.hooks.at(-1)!.acceptedPayloadBytes,f.bytes.length);assert.equal(f.hooks.at(-1)!.coverage,'partial');assert.equal(f.producer.status.physicalMediaEnabled,false);assert.equal((await f.producer.step(signal())).reason,'frame-rate-limit');
  await f.producer.apply(d,signal());assert.equal(f.camera,1);await f.producer.apply(f.demand('2',0),signal());assert.equal(f.camera,0);assert.equal(f.sent,f.bytes.length);assert.equal(f.producer.status.reason,'no-authorized-demand');
});
test('scope, target epoch, generation replay and expiry cannot reopen a stopped or restarted source',async t=>{
  const f=await fixture(t),d=f.demand();await assert.rejects(f.producer.apply({...d,siteId:'another-site'},signal()));await assert.rejects(f.producer.apply({...d,target:{...d.target,bootId:'old-boot'}},signal()));await f.producer.apply(d,signal());f.advance(5001);f.producer.tick();assert.equal(f.camera,0);assert.equal((await f.producer.apply(d,signal())).state,'stopped');f.reopen();assert.equal(f.encoded,0);assert.equal((await f.producer.apply(d,signal())).state,'stopped');assert.equal((await f.producer.apply(f.demand('2'),signal())).state,'leased');await assert.rejects(f.producer.apply(d,signal()),/LIVE_STALE_FENCE/);
});
test('current local health, resource load, still-capture contention and update inhibition release the camera and require new demand',async t=>{
  for(const field of ['ready','resourceAvailable','stillCapturePending','updateInhibited'] as const)await t.test(field,async sub=>{const f=await fixture(sub),d=f.demand();await f.producer.apply(d,signal());f.health({[field]:!['ready','resourceAvailable'].includes(field)});f.producer.tick();assert.equal(f.camera,0);assert.equal(f.producer.status.state,'stopped');f.health({ready:true,resourceAvailable:true,stillCapturePending:false,updateInhibited:false});assert.equal((await f.producer.apply(d,signal())).state,'stopped');assert.equal(f.encoded,0);});
});
test('budget pressure, wrong acknowledgements and a bounded noncooperative sink retain explicit stopped states',async t=>{
  for(const kind of ['quota','receipt','timeout'] as const)await t.test(kind,async sub=>{const f=await fixture(sub);if(kind==='quota')f.budget.checkpoint({period:'live-reference-period',startUtcMs:f.options.nowUtcMs()-1000,endUtcMs:f.options.nowUtcMs()+3600000,revision:2,usedBytes:policy.allowanceBytes,coverage:'complete',observedUtcMs:f.options.nowUtcMs(),maxAgeMs:60000,coveredCharges:[]});
    if(kind==='receipt')f.send(async frame=>({frameId:frame.id,sha256:'0'.repeat(64),acceptedPayloadBytes:frame.bytes.length}));if(kind==='timeout')f.send(async()=>new Promise<never>(()=>{}));await f.producer.apply(f.demand(),signal());const start=performance.now();assert.equal((await f.producer.step(signal())).state,'stopped');assert.ok(performance.now()-start<1000);assert.equal(f.camera,0);if(kind==='timeout'){assert.equal(f.producer.status.quarantined,true);assert.equal((await f.producer.apply(f.demand('2'),signal())).state,'stopped');assert.equal(f.producer.status.reason,'sink-quarantined');}
  });
});
test('native exclusive ownership, clock rollback and closed persistence prevent another stream',async t=>{
  const f=await fixture(t);assert.throws(()=>new IsolatedLiveProducer(f.options),/LIVE_PRODUCER_BUSY/);await f.producer.apply(f.demand(),signal());f.advance(-1);assert.throws(()=>f.producer.tick());assert.equal(f.camera,0);f.producer.close();assert.equal(f.camera,0);
});

test('independent monotonic idle expiry stops camera even with a frozen UTC source',async t=>{
  const f=await fixture(t);await f.producer.apply(f.demand(),signal());assert.equal(f.camera,1);await new Promise<void>(resolve=>setTimeout(resolve,1200));assert.equal(f.producer.status.reason,'idle-timeout');assert.equal(f.camera,0);assert.equal(f.encoded,0);
});
