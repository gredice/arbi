import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { validateAccounting, reconcileUsage } from '@arbi/protocol';
import { TrafficSpool, ApplicationMeter, RouterCollector, LinuxInterfaceCollector, parseRouterSnapshot, MAX_U64,
  type Scope, type Stamp, type CounterSample, type CounterConfig, type TransferSpec, type TransferRecord, type SpoolOptions } from './index.js';
const scope: Scope = { realm: { environment: 'test', namespaceId: 'meter-test' }, executionMode: 'simulation', siteId: 'synthetic-site',
  source: { deviceId: 'pod', bootId: 'app-boot', sessionId: 'app-session' }, boundary: 'lan', linkId: 'pod-edge-lan' };
const time = (n: number, change: Partial<Stamp> = {}): Stamp => ({ utc: new Date(Date.UTC(2026,0,1) + n).toISOString(),
  monotonicNs: (BigInt(n) * 1_000_000n).toString(), clockId: 'clock', uncertaintyMs: 1, ...change });
const sample = (n: number, upload: string, download = '0', change: Partial<CounterSample> = {}): CounterSample => ({
  bootId: 'kernel-boot', interfaceId: 'interface-1', counterId: 'register-1', time: time(n), upload, download, wraps: null, ...change });
const config = (change: Partial<CounterConfig> = {}): CounterConfig => ({ key: 'lan-interface', scope, layer: 'interface-wan', collectionPoint: 'host-lan-point',
  coverage: 'partial', includes: ['payload', 'retries', 'non-arbi'], width: 64, maxDeltaBytes: '1048576', maxIntervalMs: 10_000, maxAgeMs: 60_000, ...change });
const spec = (change: Partial<TransferSpec> = {}): TransferSpec => ({ scope, direction: 'upload', category: 'still', includes: ['payload','retries'], maxAgeMs: 60000, retryOf: null, media: null, ...change });
function rig(t: TestContext, change: Partial<SpoolOptions> = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'arbi-meter-test-'));
  const options: SpoolOptions = { path: join(dir,'usage.sqlite'), binding: { realm: scope.realm, siteId: scope.siteId, executionMode: scope.executionMode, deviceId: 'pod' },
    maxRecords: 64, maxBytes: 524288, maxPages: 256, maxCounters: 4, ...change };
  const spool = new TrafficSpool(options); t.after(() => { spool.close(); rmSync(dir,{recursive:true,force:true}); });
  return { spool, options, dir };
}
async function* chunks() { yield Buffer.alloc(4096); yield Buffer.alloc(2048); yield Buffer.alloc(1024); }
const transfers = (s: TrafficSpool) => s.pending(64).map((e)=>e.record).filter((r): r is TransferRecord => r.kind === 'transfer');

test('known-size attempted uploads retain failed prefixes and retries, never unique object size', async (t) => {
  const { spool } = rig(t); let n=0; const meter = new ApplicationMeter(spool,()=>time(++n)); let submitted=0;
  await assert.rejects(meter.upload(spec(),chunks(), async (chunk)=> { submitted+=chunk.length; if(submitted>=6144) throw new Error('link failed'); }));
  const first=transfers(spool)[0]; assert.equal(first.bytes,'6144'); assert.equal(first.outcome,'failed');
  await meter.upload(spec({retryOf:first.id}),chunks(),async ()=>{});
  const second=transfers(spool)[1]; assert.equal(second.bytes,'7168'); assert.equal(second.spec.retryOf,first.id);
  assert.equal(BigInt(first.bytes)+BigInt(second.bytes),13312n);
  for(const r of transfers(spool)) { assert.equal(r.observations[0].boundary,'lan'); assert.equal(r.observations[0].evidence.coverage,'partial'); assert.equal(validateAccounting(r.observations[0]).ok,true); }
});
test('partial and aborted receive streams count yielded bytes; a failing receive prefix remains measured', async(t)=>{
  const {spool}=rig(t); let n=0; const meter=new ApplicationMeter(spool,()=>time(++n));
  for await(const _ of meter.download(spec({direction:'download',category:'ota'}),chunks())) break;
  assert.equal(transfers(spool)[0].bytes,'4096'); assert.equal(transfers(spool)[0].outcome,'aborted');
  async function* broken(){yield Buffer.alloc(123);throw new Error('interrupted');}
  await assert.rejects(async()=>{for await(const _ of meter.download(spec({direction:'download',category:'ota'}),broken())){}});
  assert.equal(transfers(spool)[1].bytes,'123'); assert.equal(transfers(spool)[1].outcome,'failed');
});
test('counter uint64 precision, no payload/interface addition and unclassified residual remain explicit', (t)=>{
  const {spool}=rig(t); const c=config(); const initial=spool.collect(c,sample(0,'9007199254740993'));
  assert.equal(initial.deltas,null); assert.equal(initial.gap,'baseline');
  const r=spool.collect(c,sample(1000,'9007199254741994','120'));
  assert.deepEqual(r.deltas,{upload:'1001',download:'120'});
  const result=reconcileUsage(r.observations[0],[],r.observations[0].interval.end);
  assert.equal(result.ok,true); if(result.ok){assert.equal(result.value.unattributedBytes,'1001');assert.equal(result.value.status,'partial');}
  assert.equal(r.observations[0].category,null); assert.equal(r.observations[0].layer,'interface-wan');
});
test('reset, replacement, reboot, ambiguous wrap and huge jumps rebaseline without false usage', (t)=>{
  const {spool}=rig(t); const c=config(); spool.collect(c,sample(0,'100'));
  for(const [n,s,gap] of [
    [1000,sample(1000,'0'),'counter-reset'],
    [2000,sample(2000,'12','0',{interfaceId:'replacement'}),'replacement'],
    [3000,sample(3000,'5','0',{interfaceId:'replacement',bootId:'new-boot'}),'reboot'],
    [4000,sample(4000,MAX_U64.toString(),'0',{interfaceId:'replacement',bootId:'new-boot'}),'counter-reset'],
    [5000,sample(5000,'4','0',{interfaceId:'replacement',bootId:'new-boot'}),'counter-reset']
  ] as const){const r=spool.collect(c,s);assert.equal(r.gap,gap, String(n));assert.equal(r.deltas,null); for(const o of r.observations){assert.equal(o.bytes,null);assert.equal(o.evidence.quality,'unavailable');}}
  const last=spool.collect(c,sample(6000,'11','0',{interfaceId:'replacement',bootId:'new-boot'}));assert.equal(last.deltas!.upload,'7');
});
test('verified 32-bit rollover is bounded; unverified decrease and excessive wrap count reset', (t)=>{
  const {spool}=rig(t); const c=config({width:32});
  spool.collect(c,sample(0,'4294967290','0',{wraps:{upload:'7',download:'0'}}));
  const r=spool.collect(c,sample(1000,'10','2',{wraps:{upload:'8',download:'0'}}));assert.equal(r.deltas!.upload,'16');assert.equal(r.rollover,true);
  const excessive=spool.collect(c,sample(2000,'20','2',{wraps:{upload:'10',download:'0'}}));assert.equal(excessive.gap,'counter-reset');assert.equal(excessive.deltas,null);
  const removed=spool.collect(c,sample(3000,'30','2'));assert.equal(removed.deltas,null);
});
test('offline gaps, collection failures and changed coverage cannot reuse a stale baseline', (t)=>{
  const {spool}=rig(t); const c=config();spool.collect(c,sample(0,'0'));
  spool.unavailable(c,'not-reported',time(1000));const unavailable=spool.pending()[1].record;assert.equal(unavailable.kind,'counter');
  if(unavailable.kind==='counter'){assert.equal(unavailable.gap,'not-reported');assert.equal(unavailable.observations[0].bytes,null);}
  const r=spool.collect(c,sample(2000,'1000'));assert.equal(r.gap,'collection-gap');assert.equal(r.deltas,null);
  assert.equal(spool.collect(c,sample(20_000,'2000')).gap,'collection-gap');
  assert.equal(spool.collect({...c,includes:['payload'],coverage:'unknown'},sample(21_000,'3000')).gap,'replacement');
});
test('uncertain/reversed/jumped clocks preserve raw deltas without fabricated UTC intervals', (t)=>{
  const {spool}=rig(t); const c=config();
  spool.collect(c,sample(0,'0','0',{time:time(0,{uncertaintyMs:null})}));
  const r=spool.collect(c,sample(1000,'20','0',{time:time(1000,{uncertaintyMs:null})}));assert.equal(r.gap,'clock-uncertain');assert.equal(r.deltas!.upload,'20');assert.equal(r.observations.length,0);
  const jumped=spool.collect(c,sample(2000,'30','0',{time:time(2000,{utc:'2026-01-01T01:00:00.000Z'})}));assert.equal(jumped.observations.length,0);
  const reversed=spool.collect(c,sample(3000,'40','0',{time:time(3000,{utc:'2025-12-31T23:59:59.000Z'})}));assert.equal(reversed.observations.length,0);
});
test('restart recovers raw transfer prefixes once and preserves counter baselines and replay IDs', (t)=>{
  const {spool,options}=rig(t);const c=config();spool.collect(c,sample(0,'0'));
  const key=spool.begin(spec(),time(1));spool.progress(key,'321',time(2));spool.close();
  const reopened=new TrafficSpool(options);t.after(()=>reopened.close());const recovered=transfers(reopened)[0];
  assert.equal(recovered.outcome,'crashed');assert.equal(recovered.bytes,'321');assert.equal(recovered.gap,'collection-gap');
  assert.equal(reopened.collect(c,sample(1000,'11')).deltas!.upload,'11');
  const before=reopened.pending(64);reopened.close();const again=new TrafficSpool(options);t.after(()=>again.close());assert.deepEqual(again.pending(64),before);
  assert.throws(()=>again.acknowledge({id:before[0].record.id,contentHash:'invalid',durable:true}),/CONFLICT/);
  again.acknowledge({id:before[0].record.id,contentHash:before[0].contentHash,durable:true});assert.equal(again.pending(64).length,before.length-1);
});
test('SIGKILL after committed chunks leaves a recoverable durable prefix', (t)=>{
  const {spool,options}=rig(t);spool.close();
  const script=`import {TrafficSpool} from ${JSON.stringify(new URL('./index.js',import.meta.url).href)};const s=new TrafficSpool(${JSON.stringify(options)});const key=s.begin(${JSON.stringify(spec())},${JSON.stringify(time(0))});s.progress(key,'777',${JSON.stringify(time(1))});process.kill(process.pid,'SIGKILL');`;
  assert.throws(()=>execFileSync(process.execPath,['--input-type=module','-e',script],{stdio:'pipe'}),(e:unknown)=>(e as {signal:string}).signal==='SIGKILL');
  const reopened=new TrafficSpool(options);t.after(()=>reopened.close());assert.equal(transfers(reopened)[0].bytes,'777');assert.equal(transfers(reopened)[0].outcome,'crashed');
});
test('bounded capacity preserves pending rows, marks losses durably and never gates a local stop', (t)=>{
  const {spool,options}=rig(t,{maxRecords:2,maxBytes:16384});const c=config();spool.collect(c,sample(0,'0'));spool.collect(c,sample(1000,'1'));
  const before=spool.pending();assert.throws(()=>spool.collect(c,sample(2000,'100')),/CAPACITY/);assert.deepEqual(spool.pending(),before);
  let stopped=false;const stop=()=>{stopped=true;};stop();new ApplicationMeter(spool,()=>time(3000)).observe(spec(),Buffer.alloc(4));assert.equal(stopped,true);assert.equal(spool.status().degraded,true);
  spool.acknowledge({id:before[0].record.id,contentHash:before[0].contentHash,durable:true});
  const r=spool.collect(c,sample(4000,'500'));assert.equal(r.gap,'collection-gap');assert.equal(r.deltas,null);
  spool.close();const again=new TrafficSpool(options);t.after(()=>again.close());assert.equal(again.status().degraded,true);
});
test('SQLite physical page limit produces explicit failure; logical rows stay bounded', (t)=>{
  const {spool}=rig(t,{maxRecords:500,maxBytes:4096000,maxPages:32});let failed=false;
  for(let n=0;n<500;n++)try{spool.collect(config(),sample(n*1000,String(n)));}catch(e){assert.match(String(e),/METER_(UNAVAILABLE|CAPACITY)/);failed=true;break;}
  assert.equal(failed,true);assert.equal(spool.status().degraded,true);assert.ok(spool.status().pending!<500);
});
test('router adapter enforces source/coverage, snapshot size, timeouts and unavailable support',async(t)=>{
  const {spool}=rig(t);let n=0;const router=new RouterCollector(config({key:'router',scope:{...scope,boundary:'garden-sim',linkId:'configured-sim'}}),20,
    async()=>JSON.stringify(sample((n++)*1000,(n*100).toString())));
  await router.poll(spool,()=>time(n*1000));await router.poll(spool,()=>time(n*1000));
  const r=spool.pending()[1].record;assert.equal(r.kind,'counter');if(r.kind==='counter'){assert.equal(r.deltas!.upload,'100');assert.equal(r.config.scope.boundary,'garden-sim');assert.equal(r.observations[0].evidence.coverage,'partial');}
  const unsupported=new RouterCollector(config({key:'unsupported'}),20,null);await unsupported.poll(spool,()=>time(2000));
  let started=0;const timeout=new RouterCollector(config({key:'timeout'}),5,async()=>{started++;return new Promise(()=>{});});await timeout.poll(spool,()=>time(2000));await timeout.poll(spool,()=>time(2000));assert.equal(started,1);
  assert.throws(()=>parseRouterSnapshot('x'.repeat(4097),64));assert.throws(()=>parseRouterSnapshot(JSON.stringify({...sample(0,'0'),secret:'unaccepted'}),64));
  const last=spool.pending().at(-1)!.record;assert.equal(last.kind,'counter');if(last.kind==='counter'){assert.equal(last.deltas,null);assert.equal(last.gap,'not-reported');}
});
test('Linux sysfs fixture maps RX/TX exactly, hashes identity and refuses loopback as garden WAN', (t)=>{
  const {spool,dir}=rig(t);const net=join(dir,'net');const base=join(net,'lo');mkdirSync(join(base,'statistics'),{recursive:true});
  for(const [file,value]of Object.entries({ifindex:'1',iflink:'1',address:'00:00:00:00:00:00',type:'772','statistics/tx_bytes':'9007199254740993','statistics/rx_bytes':'45'}))writeFileSync(join(base,file),value);
  const boot=join(dir,'boot'),uptime=join(dir,'uptime'),ns=join(dir,'ns');writeFileSync(boot,'kernel-test');writeFileSync(uptime,'100.00 1.00');writeFileSync(ns,'namespace');
  const paths={sysClassNet:net,bootId:boot,uptime,netNamespace:ns};const c=config();const collector=new LinuxInterfaceCollector(c,'lo','host-epoch',paths,10);
  const a=collector.read();assert.equal(a.upload,'9007199254740993');assert.equal(a.download,'45');assert.match(a.interfaceId,/^[a-f0-9]{64}$/);spool.collect(c,a);
  writeFileSync(uptime,'101.00 1.00');writeFileSync(join(base,'statistics/tx_bytes'),'9007199254741003');assert.equal(spool.collect(c,collector.read()).deltas!.upload,'10');
  const wrong=new LinuxInterfaceCollector(config({scope:{...scope,boundary:'garden-sim'}}),'lo','host-epoch',paths);assert.throws(()=>wrong.read());
  writeFileSync(join(base,'ifindex'),'2');assert.notEqual(collector.read().interfaceId,a.interfaceId);
});
test('binding, disabled recording, overflowing and invalid raw values fail explicitly',(t)=>{
  const {spool,options}=rig(t);assert.throws(()=>spool.begin(spec({category:'recording'}),time(0)));
  assert.throws(()=>spool.collect(config(),sample(0,'18446744073709551616')));
  assert.throws(()=>spool.collect(config(),sample(0,'01')));
  const key=spool.begin(spec(),time(0));spool.progress(key,MAX_U64.toString(),time(1));assert.throws(()=>spool.progress(key,'1',time(2)));
  spool.close();assert.throws(()=>new TrafficSpool({...options,binding:{...options.binding,deviceId:'edge'}}),/CONFLICT/);
});

test('relay topology and separately observed overhead retain exclusive categories without fanout multipliers',async(t)=>{
  const {spool}=rig(t);let n=0;const meter=new ApplicationMeter(spool,()=>time(++n));
  await meter.upload(spec({scope:{...scope,boundary:'garden-sim',linkId:'configured-sim'},category:'live-video',media:{topology:'shared',sessionId:'media-session',viewerId:null,viewerCount:5}}),chunks(),async()=>{});
  const video=transfers(spool)[0];assert.equal(video.bytes,'7168');assert.equal(video.observations[0].bytes,'7168');
  meter.observe(spec({category:'transport-overhead',includes:['transport-overhead']}),Buffer.alloc(32));
  const overhead=transfers(spool)[1];assert.equal(overhead.bytes,'32');assert.deepEqual(overhead.observations[0].evidence.includes,['transport-overhead']);
  assert.throws(()=>spool.begin(spec({category:'still',media:{topology:'relayed',sessionId:'media-session',viewerId:null,viewerCount:1}}),time(++n)));
});
test('verified 64-bit rollover retains exact small deltas above Number precision',(t)=>{
  const {spool}=rig(t);const c=config();spool.collect(c,sample(0,(MAX_U64-3n).toString(),'0',{wraps:{upload:'0',download:'0'}}));
  const r=spool.collect(c,sample(1000,'5','0',{wraps:{upload:'1',download:'0'}}));assert.equal(r.deltas!.upload,'9');assert.equal(r.rollover,true);
});

test('socket attempts record real submission callbacks; missing callback survives as a crash gap', (t)=>{
  const {spool,options}=rig(t);let n=0;const meter=new ApplicationMeter(spool,()=>time(++n));
  meter.submit(spec(),Buffer.alloc(19),(done)=>done(new Error('submit failed')));
  assert.equal(transfers(spool)[0].bytes,'19');assert.equal(transfers(spool)[0].outcome,'failed');
  meter.submit(spec(),Buffer.alloc(23),()=>{});assert.equal(spool.status().active,1);spool.close();
  const reopened=new TrafficSpool(options);t.after(()=>reopened.close());const r=transfers(reopened)[1];
  assert.equal(r.bytes,'0');assert.equal(r.outcome,'crashed');assert.equal(r.gap,'collection-gap');
});

test('application freshness is explicit caller policy and rejects invalid ranges',(t)=>{
  const {spool}=rig(t);let n=0;new ApplicationMeter(spool,()=>time(++n)).observe(spec({maxAgeMs:1234}),Buffer.alloc(8));
  assert.equal(transfers(spool)[0].observations[0].evidence.maxAgeMs,1234);
  assert.throws(()=>spool.begin(spec({maxAgeMs:-1}),time(++n)));
});

test('download cleanup preserves receive errors and consumer breaks, but surfaces failure after success',async(t)=>{
  for(const mode of ['receive-error','consumer-break','completed'] as const){
    const {spool}=rig(t);let n=0;const meter=new ApplicationMeter(spool,()=>time(++n));const original=new Error('original receive failure');
    async function* input(){yield Buffer.alloc(12);spool.close();if(mode==='receive-error')throw original;}
    const consume=async()=>{for await(const _ of meter.download(spec({direction:'download'}),input())){if(mode==='consumer-break'){spool.close();break;}}};
    if(mode==='receive-error')await assert.rejects(consume,(error:unknown)=>error===original);
    else if(mode==='completed')await assert.rejects(consume,/METER_UNAVAILABLE/);
    else await consume();
    assert.equal(spool.status().degraded,true);
  }
});
