import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer,connect,type Socket} from 'node:net';
import {once} from 'node:events';
import {ApplicationMeter,LinuxInterfaceCollector,TrafficSpool,stamp,type CounterConfig,type TransferSpec} from '@arbi/traffic';
import {TransferBudget} from '../transfers/budget.js';
import {createJobReference} from '../jobs/reference.js';
import {syntheticAppliedConfiguration} from '../simulation.js';
const ids=['idle-short-sample','bounded-reconnect','still-interrupted-retry','diagnostic-export','artifact-download','optional-exhaustion-essential-stop'] as const;
export type UsageProbeCase=typeof ids[number];
async function probe(id:UsageProbeCase){
  const began=performance.now(),root=mkdtempSync(join(tmpdir(),'arbi-usage-probe-')),source={deviceId:syntheticAppliedConfiguration().appliedBy.deviceId,bootId:'native-linux-probe',sessionId:id},realm={environment:'test' as const,namespaceId:'native-controlled-usage'};
  const scope={realm,executionMode:'simulation' as const,siteId:'synthetic-site',source,boundary:'lan' as const,linkId:'controlled-loopback'},spool=new TrafficSpool({path:join(root,'usage.sqlite'),binding:{realm,siteId:scope.siteId,executionMode:'simulation',deviceId:source.deviceId},maxRecords:64,maxBytes:524288,maxPages:512,maxCounters:1}),meter=new ApplicationMeter(spool,()=>stamp('native-controlled-clock',20));
  const config:CounterConfig={key:'native-lo',scope,layer:'interface-wan',collectionPoint:'linux-lo-sysfs',coverage:'partial',includes:['payload','retries','transport-overhead','non-arbi'],width:64,maxDeltaBytes:'1073741824',maxIntervalMs:15000,maxAgeMs:15000};
  const collector=new LinuxInterfaceCollector(config,'lo','native-controlled-reference',undefined,20);spool.collect(config,collector.read());
  const peers:number[]=[],replies:number[]=[],sockets=new Set<Socket>();let expectedReply=0,budget:TransferBudget|undefined,jobs:ReturnType<typeof createJobReference>|undefined,localStop=false;
  const server=createServer({allowHalfOpen:true},socket=>{sockets.add(socket);let received=0;socket.on('error',()=>{});socket.setTimeout(1000,()=>socket.destroy());socket.on('data',part=>{received+=part.length;if(received>1048576)socket.destroy();});
    socket.on('end',()=>{peers.push(received);replies.push(expectedReply);if(expectedReply)socket.end(Buffer.alloc(expectedReply,7));else socket.end();});socket.on('close',()=>sockets.delete(socket));});
  server.listen(0,'127.0.0.1');await once(server,'listening');const address=server.address();assert.ok(address&&typeof address!=='string');const port=address.port;
  const category:TransferSpec['category']=id==='bounded-reconnect'||id==='optional-exhaustion-essential-stop'?'telemetry':id==='diagnostic-export'?'logs-audit':id==='artifact-download'?'ota':'still';
  const spec=(direction:TransferSpec['direction'],retryOf:string|null=null):TransferSpec=>({scope,direction,category,includes:['payload','retries'],maxAgeMs:15000,retryOf,media:null});
  async function exchange(upload:number,reply:number,interrupt=false,retryOf:string|null=null){
    expectedReply=reply;const socket=connect(port,'127.0.0.1');socket.on('error',()=>{});socket.setTimeout(1000,()=>socket.destroy(Error('bounded-link-timeout')));await once(socket,'connect');
    const receive=(async()=>{let bytes=0;for await(const part of meter.download(spec('download'),socket))bytes+=part.length;return bytes;})();
    async function* chunks(){for(let offset=0;offset<upload;offset+=65536)yield Buffer.alloc(Math.min(65536,upload-offset),3);}
    const send=meter.upload(spec('upload',retryOf),chunks(),async part=>{await new Promise<void>((resolve,reject)=>socket.write(part,error=>error?reject(error):resolve()));if(interrupt){socket.end();throw Error('controlled-prefix-interruption');}});
    if(interrupt)await assert.rejects(send,/controlled-prefix/);else{await send;socket.end();}
    assert.equal(await receive,reply);
  }
  try{
    if(id==='bounded-reconnect')for(let n=0;n<8;n++)await exchange(64,16);
    if(id==='still-interrupted-retry'){await exchange(262144,0,true);const retry=spool.pending(64).find(r=>r.record.kind==='transfer'&&r.record.spec.direction==='upload')!.record.id;await exchange(262144,32,false,retry);}
    if(id==='diagnostic-export')await exchange(64,65536);
    if(id==='artifact-download')await exchange(64,524288);
    if(id==='optional-exhaustion-essential-stop'){
      const policy={revision:'probe-budget',allowanceBytes:64,essentialBytes:1024,maxTransferBytes:1048576,bytesPerSecond:1048576,essentialBytesPerSecond:1024,concurrency:1,essentialConcurrency:1,unknownCoverage:'defer' as const,maxAttempts:8,uploadWindows:[],stream:{maxBitrate:32000,maxDurationMs:15000,idleMs:1000}};
      budget=new TransferBudget({path:join(root,'budget.sqlite'),realm,siteId:scope.siteId,source,policy,clock:()=>({epoch:source.bootId,utcMs:Date.now(),monotonicMs:Math.floor(performance.now()),reliable:true}),authorize:()=>true});const now=Date.now();budget.checkpoint({period:'probe-period',startUtcMs:now-1000,endUtcMs:now+60000,revision:1,usedBytes:64,coverage:'complete',observedUtcMs:now,maxAgeMs:60000,coveredCharges:[]});
      assert.throws(()=>{budget!.start({id:'optional',class:'media',direction:'upload',expectedBytes:64,artifactDigest:null,stream:false,bitrate:null,overrideId:null});budget!.grant('optional',64);},/QUOTA/);
      assert.throws(()=>budget!.start({id:'optional-update',class:'artifact',direction:'download',expectedBytes:64,artifactDigest:'a'.repeat(64),stream:false,bitrate:null,overrideId:null}),/QUOTA/);
      jobs=createJobReference(join(root,'jobs'),{scope:{realm,siteId:scope.siteId,receiver:source}});const priorStops=jobs.adapter.stops;jobs.consumer.localSafetyStop();assert.equal(jobs.consumer.status.recoveryRequired,true);assert.equal(jobs.consumer.status.degraded,true);assert.equal(jobs.consumer.status.active,0);assert.equal(jobs.adapter.stops,priorStops+1);localStop=true;
      budget.start({id:'essential-health',class:'essential',direction:'upload',expectedBytes:64,artifactDigest:null,stream:false,bitrate:null,overrideId:null});const grant=budget.grant('essential-health',64);await exchange(64,16);budget.settle('essential-health',grant.id,64,64);budget.finish('essential-health');assert.equal(budget.charges('essential-health')[0]!.bytes,64);
    }
    await new Promise<void>(resolve=>setTimeout(resolve,40));const link=spool.collect(config,collector.read());assert.equal(link.gap,null);assert.ok(link.deltas);
    const attempts=spool.pending(64).map(r=>r.record).filter(r=>r.kind==='transfer'),upload=attempts.filter(r=>r.spec.direction==='upload').reduce((sum,r)=>sum+BigInt(r.bytes),0n),download=attempts.filter(r=>r.spec.direction==='download').reduce((sum,r)=>sum+BigInt(r.bytes),0n);
    assert.equal(upload,BigInt(peers.reduce((sum,n)=>sum+n,0)));assert.equal(download,BigInt(replies.reduce((sum,n)=>sum+n,0)));const known=upload+download,tx=BigInt(link.deltas.upload),rx=BigInt(link.deltas.download);assert.ok(tx>=known&&rx>=known);
    if(id==='still-interrupted-retry'){assert.equal(upload,327680n);assert.deepEqual(peers,[65536,262144]);}
    return {id,durationMs:performance.now()-began,connections:peers.length,application:{uploadBytes:upload.toString(),downloadBytes:download.toString(),peerReceivedBytes:peers,attempts:attempts.length,retryAttempts:attempts.filter(r=>r.spec.retryOf!==null).length,category,coverage:'fixture-transport-submission-and-peer-receipt'},link:{boundary:'linux-loopback',coverage:'partial',uncertaintyMs:20,uploadBytes:tx.toString(),downloadBytes:rx.toString(),unexplainedUploadBytes:(tx-known).toString(),unexplainedDownloadBytes:(rx-known).toString(),includes:config.includes,carrierBytes:null,turnBytes:null},localStop,optionalMediaDenied:id==='optional-exhaustion-essential-stop',optionalUpdateDenied:id==='optional-exhaustion-essential-stop',physicalAcceptance:false};
  }finally{for(const socket of sockets)socket.destroy();await new Promise<void>(resolve=>server.close(()=>resolve()));jobs?.close();budget?.close();spool.close();rmSync(root,{recursive:true,force:true});}
}
export async function runControlledUsageProbe(){assert.equal(process.platform,'linux','Native Linux sysfs is required');const cases=[];for(const id of ids)cases.push(await probe(id));return {version:'arbi.controlled-usage-evidence/1.0',node:process.version,cases,physicalAcceptance:false,invoiceSavings:null,blocked:[{id:'idle-day',reason:'24-hour-mobile-link-measurement-required'},{id:'production-direct-turn',reason:'transport-not-selected'},{id:'carrier-router-wan',reason:'no-mobile-link-or-provider'},{id:'recording',reason:'deferred-disabled'}]};}
