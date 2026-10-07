import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer, connect } from 'node:net';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { ApplicationMeter, LinuxInterfaceCollector, TrafficSpool, stamp } from '../dist/index.js';

test('native Linux loopback counters include known TCP attempts, interruption/retry and received reply', {timeout:15000}, async(t)=>{
  // This owning check must fail on the wrong platform rather than silently skip.
  assert.equal(process.platform,'linux','test:linux requires a native Linux kernel and procfs/sysfs');
  const dir=mkdtempSync(join(tmpdir(),'arbi-linux-traffic-'));
  const scope={realm:{environment:'test',namespaceId:'native-linux-meter'},executionMode:'simulation',siteId:'synthetic-site',
    source:{deviceId:'edge',bootId:'native-test',sessionId:'session'},boundary:'lan',linkId:'linux-lo'};
  const spool=new TrafficSpool({path:join(dir,'usage.sqlite'),binding:{realm:scope.realm,siteId:scope.siteId,executionMode:scope.executionMode,deviceId:'edge'},
    maxRecords:32,maxBytes:262144,maxPages:256,maxCounters:1});
  t.after(()=>{spool.close();rmSync(dir,{recursive:true,force:true});});
  const counter={key:'lo',scope,layer:'interface-wan',collectionPoint:'linux-lo-sysfs',coverage:'partial',includes:['payload','retries','transport-overhead','non-arbi'],
    width:64,maxDeltaBytes:'1073741824',maxIntervalMs:10000,maxAgeMs:10000};
  // Linux uptime has 10 ms granularity; UTC is an unsynchronized host reference with an explicit 20 ms test tolerance.
  const collector=new LinuxInterfaceCollector(counter,'lo','native-test-v1',undefined,20);
  const before=collector.read();spool.collect(counter,before);
  const seen=[];const reply=Buffer.alloc(32768,7);const sockets=new Set();
  const server=createServer((socket)=>{sockets.add(socket);let bytes=0;socket.on('error',()=>{});socket.on('data',(chunk)=>{bytes+=chunk.length;});
    socket.on('end',()=>{seen.push(bytes);socket.end(bytes===262144?reply:undefined);});socket.on('close',()=>sockets.delete(socket));});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(async()=>{for(const s of sockets)s.destroy();await new Promise((resolve)=>server.close(resolve));});
  const meter=new ApplicationMeter(spool,()=>stamp('test-clock',20));
  const makeSpec=(direction,retryOf=null)=>({scope,direction,category:direction==='upload'?'still':'ota',includes:['payload','retries'],maxAgeMs:10000,retryOf,media:null});
  async function* chunks(n){for(let used=0;used<n;used+=65536)yield Buffer.alloc(Math.min(65536,n-used),3);}
  const first=connect(server.address().port,'127.0.0.1');await once(first,'connect');first.on('error',()=>{});
  // Submit and receive one real prefix; interrupt the application before its next chunk. No extra bytes are invented.
  await assert.rejects(meter.upload(makeSpec('upload'),chunks(262144),async(chunk)=>{
    await new Promise((resolve,reject)=>first.write(chunk,(e)=>e?reject(e):resolve()));first.end();throw new Error('deliberate interruption');
  }));
  first.resume();await once(first,'close');
  const retryOf=spool.pending().find((e)=>e.record.kind==='transfer').record.id;
  const second=connect(server.address().port,'127.0.0.1');await once(second,'connect');second.on('error',()=>{});
  const received=(async()=>{let n=0;for await(const chunk of meter.download(makeSpec('download'),second))n+=chunk.length;return n;})();
  await meter.upload(makeSpec('upload',retryOf),chunks(262144),async(chunk)=>new Promise((resolve,reject)=>second.write(chunk,(e)=>e?reject(e):resolve())));
  second.end();assert.equal(await received,reply.length);
  await delay(30);const after=collector.read();const observed=spool.collect(counter,after);
  assert.deepEqual(seen,[65536,262144]);
  const app=spool.pending(32).map((e)=>e.record).filter((r)=>r.kind==='transfer');
  assert.equal(app.filter((r)=>r.spec.direction==='upload').reduce((sum,r)=>sum+BigInt(r.bytes),0n),327680n);
  assert.equal(app.find((r)=>r.spec.direction==='download').bytes,'32768');
  assert.equal(observed.gap,null);assert.ok(BigInt(observed.deltas.upload)>=360448n);assert.ok(BigInt(observed.deltas.download)>=360448n);
  assert.equal(observed.observations[0].boundary,'lan');assert.equal(observed.observations[0].evidence.coverage,'partial');
  console.log(JSON.stringify({collectionPoint:'/sys/class/net/lo/statistics/{tx_bytes,rx_bytes}',boundary:'lan',
    attemptedUploadBytes:'327680',receivedDownloadBytes:'32768',peerReceivedUploadBytes:seen.map(String),
    interfaceUploadDelta:observed.deltas.upload,interfaceDownloadDelta:observed.deltas.download,
    coverage:'partial: host loopback includes both TCP directions and concurrent non-ARBI traffic; observations overlap and are not additive'}));
});
