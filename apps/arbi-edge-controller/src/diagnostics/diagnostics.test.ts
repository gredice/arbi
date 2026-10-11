import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, chmodSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setImmediate as yieldTurn, setTimeout as delay } from 'node:timers/promises';
import { DatabaseSync } from 'node:sqlite';
import { test, type TestContext } from 'node:test';
import { contentHash, type DurableReceipt } from '@arbi/audit';
import type { AuditEvent, Event, Telemetry, TelemetryContext } from '@arbi/protocol';
import { createSimulation } from '../simulation.js';
import { EdgeRuntime } from '../runtime.js';
import { JobAuditRelay } from '../jobs/audit-relay.js';
import { TransferBudget, type TransferPolicy } from '../transfers/budget.js';
import { DiagnosticStore, type DiagnosticRecord, type DiagnosticStoreOptions } from './store.js';
import { DiagnosticPipeline } from './pipeline.js';
import { DiagnosticUplink } from './uplink.js';

const fixtures=JSON.parse(readFileSync(new URL('../../../../packages/arbi-protocol/fixtures/contracts.json',import.meta.url),'utf8')).valid;
const auditFixtures=JSON.parse(readFileSync(new URL('../../../../packages/arbi-protocol/fixtures/audit-events.json',import.meta.url),'utf8')).valid;
const utc=Date.parse('2026-10-11T12:00:00.000Z');
const policy:TransferPolicy={revision:'test-policy',allowanceBytes:1000000,essentialBytes:200000,maxTransferBytes:16384,bytesPerSecond:100000,
  essentialBytesPerSecond:65536,concurrency:1,essentialConcurrency:1,unknownCoverage:'defer',maxAttempts:2,uploadWindows:[],stream:{maxBitrate:800,maxDurationMs:1000,idleMs:250}};
function rig(t:TestContext,patch:Partial<DiagnosticStoreOptions>={}){
  const directory=mkdtempSync(join(tmpdir(),'arbi-diagnostics-')),source={deviceId:'edge-1',bootId:'edge-boot',sessionId:'edge-link'};
  const options:DiagnosticStoreOptions={path:join(directory,'diagnostics.sqlite'),realm:fixtures.telemetry.realm,siteId:'synthetic-site',source,
    maxRecords:64,maxBytes:65536,maxPages:64,retainMs:60000,...patch};
  const state={utc,mode:'normal' as 'normal'|'low-data'|'essential-only'};
  const store=new DiagnosticStore(options),pipeline=new DiagnosticPipeline(store,()=>state.utc),budgets:TransferBudget[]=[];
  t.after(()=>{pipeline.close();for(const b of budgets)b.close();rmSync(directory,{recursive:true,force:true});});
  const context:TelemetryContext={realm:options.realm,siteId:options.siteId,executionMode:'simulation',authenticatedSource:fixtures.telemetry.source,
    activeSource:fixtures.telemetry.source,capabilitiesRevision:'cap-1',capabilities:[{metric:'position.x',qualities:['commanded']}]};
  const telemetry=(n:number):Telemetry=>{const message:Telemetry={...structuredClone(fixtures.telemetry),messageId:`telemetry-${n}`,sequence:String(n),sourceTime:{...fixtures.telemetry.sourceTime,monotonicMs:n+1000}};
    message.body.samples[0]!.ageMs=n+50;return message;};
  const observe=(n:number)=>pipeline.observe(JSON.stringify(telemetry(n)),context);
  const fault=(n:number):Event=>({...structuredClone(fixtures.fault),messageId:`fault-${n}`,sequence:String(n),sourceTime:{...fixtures.fault.sourceTime,monotonicMs:n+1000}});
  const rows=()=>{const result:DiagnosticRecord[]=[];let after=0;const upper=store.snapshot();for(;;){const page=store.page(after,upper,state.utc);if(!page.length)return result;result.push(...page.map(r=>r.record));after=page.at(-1)!.ordinal;}};
  const budget=(patch:Partial<TransferPolicy>={})=>{const b=new TransferBudget({path:join(directory,'budget.sqlite'),realm:options.realm,siteId:options.siteId,source:options.source,
    policy:{...policy,...patch},clock:()=>({epoch:'test-clock',monotonicMs:state.utc-utc,utcMs:state.utc,reliable:true}),authorize:()=>false});
    b.checkpoint({period:'test-period',startUtcMs:utc,endUtcMs:utc+86400000,revision:1,usedBytes:0,coverage:'complete',observedUtcMs:utc,maxAgeMs:3600000,coveredCharges:[]});budgets.push(b);return b;};
  return {directory,options,store,pipeline,context,state,telemetry,observe,fault,rows,budget};
}
test('synchronous floods aggregate loss writes and reserve fault history; TTL and receipt epochs survive restart',async t=>{
  const r=rig(t);for(let n=1;n<=1000;n++)r.observe(n);
  for(let n=1001;n<=1008;n++)assert.equal(r.pipeline.observe(JSON.stringify(r.fault(n)),r.context),true);
  assert.ok(r.pipeline.status.queued<=32);assert.equal(r.store.status.accepted,0);await r.pipeline.idle();
  assert.equal(r.store.status.dropped,984);assert.equal(r.rows().filter(v=>v.kind==='fault').length,8);
  assert.ok(r.store.status.bytes!<=r.options.maxBytes);assert.ok(statSync(r.options.path).size<=r.options.maxPages*4096);
  assert.equal(r.rows()[0].message.sourceTime.uncertaintyMs,500);const before=r.rows();r.pipeline.close();
  const reopened=new DiagnosticStore({...r.options,source:{...r.options.source,bootId:'new-boot'}});assert.equal(reopened.status.accepted,24);
  assert.deepEqual(reopened.page(0,reopened.snapshot(),r.state.utc).map(v=>v.record),before.slice(0,8));
  r.state.utc+=60000;assert.deepEqual(reopened.page(0,reopened.snapshot(),r.state.utc),[]);reopened.close();
});
test('capabilities never convert commanded motion to measured sensing; wrong scope, clock, extras, commands and text are rejected',async t=>{
  const r=rig(t);const forged=r.telemetry(1);forged.body.samples[0]!.quality='measured';assert.equal(r.pipeline.observe(JSON.stringify(forged),r.context),false);
  assert.equal(r.pipeline.observe(JSON.stringify({...r.telemetry(1),credential:'synthetic-private-value'}),r.context),false);
  assert.equal(r.pipeline.observe(JSON.stringify(fixtures.move),r.context),false);
  assert.equal(r.pipeline.observe('x'.repeat(8193),r.context),false);assert.equal(r.pipeline.code('synthetic-private-value' as never),false);
  assert.equal(r.pipeline.observe(JSON.stringify(r.telemetry(1)),{...r.context,siteId:'another-site'}),false);
  assert.equal(r.observe(1),true);assert.equal(r.observe(3),true);assert.equal(r.observe(3),false);
  const backwards=r.telemetry(4);backwards.sourceTime.monotonicMs=1;assert.equal(r.pipeline.observe(JSON.stringify(backwards),r.context),false);
  await r.pipeline.idle();const rows=r.rows();assert.equal(rows.length,2);assert.equal(rows[1]!.gap,true);
  const message=rows[0]!.message as Telemetry;assert.equal(message.body.samples[0]!.quality,'commanded');assert.equal(message.body.samples[1]!.value,null);
  assert.equal(r.store.status.rejected,8);assert.throws(()=>r.store.append({...rows[0]!,credentials:'private'} as never),/INVALID_RECORD/);
  const next={...r.context,authenticatedSource:{...r.context.activeSource,bootId:'new-boot'},activeSource:{...r.context.activeSource,bootId:'new-boot'}};
  const reboot=r.telemetry(1);reboot.messageId='new-message';reboot.source=next.activeSource;assert.equal(r.pipeline.observe(JSON.stringify(reboot),next),true);await r.pipeline.idle();
  assert.equal(r.rows().at(-1)!.message.source.bootId,'new-boot');
});
test('exports enforce current authority, cancellation, frozen high-water mark, byte/job limits and a closed credential-free schema',async t=>{
  const r=rig(t);for(let n=1;n<=12;n++)r.observe(n);await r.pipeline.idle();let authorized=true;
  const controller=new AbortController(),first=r.pipeline.export(controller.signal,()=>authorized),second=r.pipeline.export(controller.signal,()=>authorized);
  const row=await first.next();assert.equal(row.done,false);assert.equal((await second.next()).done,false);
  await assert.rejects(r.pipeline.export(controller.signal,()=>true).next(),/EXPORT_BUSY/);
  r.observe(13);await r.pipeline.idle();const lines=[String(row.value)];for await(const line of first)lines.push(line);
  assert.equal(lines.length,12);assert.ok(!lines.join('').includes('telemetry-13'));assert.doesNotMatch(lines.join(''),/Bearer|privateKey|signedUrl|credentials|positionMm/);
  authorized=false;await assert.rejects(second.next(),/DENIED/);assert.equal(r.pipeline.status.exports,0);
  const cancelled=r.pipeline.export(controller.signal,()=>true);await cancelled.next();controller.abort();await assert.rejects(cancelled.next(),/CANCELLED/);
  const limited=r.pipeline.export(new AbortController().signal,()=>true,1024);await assert.rejects(limited.next(),/EXPORT_LIMIT/);
});
test('unknown coverage, low-data and exhausted quota defer bulk; application attempt accounting precedes upload',async t=>{
  const r=rig(t);for(let n=1;n<=3;n++)r.observe(n);await r.pipeline.idle();const b=r.budget();let calls=0;
  const pump=new DiagnosticUplink({pipeline:r.pipeline,budget:b,auditSpools:()=>[],mode:()=>r.state.mode,auditFrame:async()=>assert.fail('no audit'),
    send:async(_kind,frame)=>{calls++;assert.ok(b.status.unreconciledAttemptBytes!>=Buffer.byteLength(frame));return {attemptedBytes:Buffer.byteLength(frame),acceptedBytes:Buffer.byteLength(frame)};}});
  r.state.mode='essential-only';assert.equal((await pump.flush()).reason,'ESSENTIAL_ONLY');assert.equal(calls,0);
  r.state.mode='low-data';assert.equal((await pump.flush()).uploaded,1);assert.equal(calls,1);assert.equal(r.store.status.retained,2);
  b.checkpoint({period:'test-period',startUtcMs:utc,endUtcMs:utc+86400000,revision:2,usedBytes:0,coverage:'unknown',observedUtcMs:utc,maxAgeMs:3600000,coveredCharges:[]});
  assert.equal((await pump.flush()).reason,'COVERAGE_UNKNOWN');assert.equal(calls,1);
  b.checkpoint({period:'test-period',startUtcMs:utc,endUtcMs:utc+86400000,revision:3,usedBytes:1000000,coverage:'complete',observedUtcMs:utc,maxAgeMs:3600000,coveredCharges:[]});
  assert.equal((await pump.flush()).reason,'QUOTA_EXHAUSTED');assert.equal(calls,1);assert.equal(pump.status.accounting.carrierBillingTruth,false);
});
test('historical audit backlog flushes before telemetry; lost acknowledgements preserve exact actor/session/source and conservative debit',async t=>{
  const r=rig(t),relay=new JobAuditRelay(join(r.directory,'audit'));const event:AuditEvent=structuredClone(auditFixtures.edge);
  event.realm=r.options.realm;event.source.identity=r.options.source;event.links.target=r.options.source;relay.spool(event).append(event);relay.close();
  const restarted=new JobAuditRelay(join(r.directory,'audit'));t.after(()=>restarted.close());assert.equal(restarted.pendingSpools()[0]!.status().pending,1);
  r.observe(1);await r.pipeline.idle();const b=r.budget();let lose=true;const order:string[]=[];
  const receipt:DurableReceipt={durable:true,eventId:event.eventId,contentHash:contentHash(event),ingestTime:{utc:new Date(utc).toISOString(),uncertaintyMs:1,deviceId:'cloud-ingest'}};
  const pump=new DiagnosticUplink({pipeline:r.pipeline,budget:b,auditSpools:()=>restarted.pendingSpools(),mode:()=>r.state.mode,auditFrame:async e=>JSON.stringify(e),
    send:async(kind,frame)=>{order.push(kind);const bytes=Buffer.byteLength(frame);if(lose){lose=false;throw Error('synthetic acknowledgement loss');}
      if(kind==='audit')assert.deepEqual(JSON.parse(frame),event);return {attemptedBytes:bytes,acceptedBytes:bytes,...(kind==='audit'?{receipt}:{})};}});
  await pump.flush();assert.deepEqual(order,['audit']);assert.equal(restarted.pendingSpools()[0]!.status().pending,1);assert.ok(pump.status.accounting.ambiguousUpperBoundBytes>0);
  r.state.utc+=1000;await pump.flush();assert.deepEqual(order,['audit','audit','diagnostic']);assert.equal(pump.status.auditUploaded,1);assert.equal(r.store.status.retained,0);
});
test('stalled and dishonest transports cannot release retained records, refund ambiguous sends or spawn overlapping retries',async t=>{
  const r=rig(t);r.observe(1);await r.pipeline.idle();const b=r.budget();let resolve:(r:{attemptedBytes:number;acceptedBytes:number})=>void=()=>{};
  const pump=new DiagnosticUplink({pipeline:r.pipeline,budget:b,auditSpools:()=>[],mode:()=>r.state.mode,auditFrame:async()=>'',
    send:async()=>new Promise(r=>{resolve=r;})});
  const flush=pump.flush();await delay(20);assert.equal((await pump.flush()).reason,'IN_FLIGHT');await flush;
  assert.equal(r.store.status.retained,1);assert.ok(pump.status.accounting.ambiguousUpperBoundBytes>0);assert.equal((await pump.flush()).reason,'IN_FLIGHT');
  resolve({attemptedBytes:1,acceptedBytes:1});await yieldTurn();pump.stop();assert.equal((await pump.flush()).reason,'STOPPED');
});
test('private files, single ownership and corrupt closed records fail without exposing arbitrary payloads',async t=>{
  const r=rig(t);assert.throws(()=>new DiagnosticStore(r.options),/OWNERSHIP/);const linked=join(r.directory,'linked.sqlite');symlinkSync(r.options.path,linked);
  assert.throws(()=>new DiagnosticStore({...r.options,path:linked}),/PRIVATE_FILE_REQUIRED/);chmodSync(r.directory,0o755);assert.throws(()=>new DiagnosticStore(r.options),/PRIVATE_DIRECTORY_REQUIRED/);chmodSync(r.directory,0o700);
  r.observe(1);await r.pipeline.idle();r.pipeline.close();const db=new DatabaseSync(r.options.path);
  db.exec('DROP TRIGGER immutable_record');db.prepare('UPDATE records SET hash=?').run('a'.repeat(64));db.close();assert.throws(()=>new DiagnosticStore(r.options),/CORRUPT/);
});
test('runtime opt-in observes authenticated TLS only; stopping inhibits modules before diagnostic storage cleanup',async t=>{
  const sim=await createSimulation(),runtime=new EdgeRuntime(sim.settings),config=sim.settings.applied.request.configuration;
  const store=new DiagnosticStore({path:join(sim.credentials.directory,'diagnostics.sqlite'),realm:config.realm,siteId:config.siteId,source:runtime.identity,
    maxRecords:64,maxBytes:65536,maxPages:64,retainMs:60000});const pipeline=new DiagnosticPipeline(store,()=>Date.now());runtime.composeDiagnostics(pipeline);
  t.after(async()=>{await runtime.stop();await sim.close();});await runtime.start();const deadline=Date.now()+5000;
  while(!runtime.status.ready||pipeline.store.status.accepted===0){assert.ok(Date.now()<deadline);await delay(20);}assert.ok(pipeline.store.status.accepted!>0);
  await runtime.stop();assert.equal(runtime.status.ready,false);assert.equal(runtime.adapters.every(a=>!a.status.ready),true);assert.equal(runtime.status.actuationEnabled,false);
});
test('selected Linux prototype host: sixty-second disconnected flood, bounded disk/RAM and simulated stop timer soak',{timeout:75000},async t=>{
  const r=rig(t,{maxRecords:64,maxBytes:65536,maxPages:64});let sequence=0,peakRss=process.memoryUsage().rss,peakDisk=0,maxLatency=0,ticks=0;
  const start=performance.now();let expected=start+10;const timer=setInterval(()=>{const now=performance.now();maxLatency=Math.max(maxLatency,now-expected);expected=now+10;ticks++;},10);
  try{
    while(performance.now()-start<60000){for(let n=0;n<100;n++)r.observe(++sequence);await yieldTurn();
      if(sequence%1000===0){peakRss=Math.max(peakRss,process.memoryUsage().rss);peakDisk=Math.max(peakDisk,readdirSync(r.directory).reduce((bytes,file)=>bytes+statSync(join(r.directory,file)).size,0));}
    }
    await r.pipeline.idle();assert.ok(ticks>100);assert.ok(r.pipeline.status.queued<=32);assert.ok(peakDisk<=2*r.options.maxPages*4096+8192);
    assert.ok(peakRss<512*1048576);assert.ok(maxLatency<1000);assert.ok(r.store.status.dropped!>0);
    t.diagnostic(JSON.stringify({host:process.platform,arch:process.arch,durationMs:Math.round(performance.now()-start),received:sequence,peakRssBytes:peakRss,
      peakDiskBytes:peakDisk,simulatedStopTimerMaxLatencyMs:Number(maxLatency.toFixed(3)),timerTicks:ticks,...r.store.status,physicalTimingEvidence:false}));
  }finally{clearInterval(timer);}
});
