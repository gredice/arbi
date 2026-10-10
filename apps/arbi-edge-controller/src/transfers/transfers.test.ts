import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { test, type TestContext } from 'node:test';
import { validateAuditEvent } from '@arbi/protocol';
import { TransferBudget, type TransferClock, type TransferPolicy, type TransferRequest, type UsageCheckpoint } from './budget.js';
import { ArtifactCache } from './artifacts.js';
const now=Date.parse('2026-10-11T12:00:00.000Z');
const policy:TransferPolicy={revision:'test-policy',allowanceBytes:1000,essentialBytes:200,maxTransferBytes:1000,bytesPerSecond:400,essentialBytesPerSecond:100,
  concurrency:2,essentialConcurrency:1,unknownCoverage:'defer',maxAttempts:8,uploadWindows:[],stream:{maxBitrate:800,maxDurationMs:10000,idleMs:250}};
const usage:UsageCheckpoint={period:'2026-10',startUtcMs:Date.parse('2026-10-01T00:00:00.000Z'),endUtcMs:Date.parse('2026-11-01T00:00:00.000Z'),revision:1,usedBytes:0,
  coverage:'complete',observedUtcMs:now,maxAgeMs:60000,coveredCharges:[]};
const source={deviceId:'edge',bootId:'boot',sessionId:'session'},realm={environment:'test' as const,namespaceId:'transfer-test'};
const request=(id:string,expectedBytes=100,cls:TransferRequest['class']='diagnostic'):TransferRequest=>({id,class:cls,expectedBytes,direction:'upload',artifactDigest:null,stream:false,bitrate:null,overrideId:null});
function rig(t:TestContext,p:Partial<TransferPolicy>={}){
  const d=mkdtempSync(join(tmpdir(),'arbi-transfer-'));
  const clock:TransferClock={epoch:'boot',monotonicMs:1000,utcMs:now,reliable:true};let authorized=true;
  const options={path:join(d,'budget.sqlite'),realm,siteId:'site',source,policy:{...policy,...p},clock:()=>clock,authorize:()=>authorized};
  let b=new TransferBudget(options);t.after(()=>{b.close();rmSync(d,{recursive:true,force:true});});b.checkpoint(usage);
  return {d,clock,options,get b(){return b;},deny:()=>{authorized=false;},advance:(ms:number)=>{clock.utcMs+=ms;clock.monotonicMs+=ms;},
    reopen:()=>{b.close();clock.epoch=`boot-${clock.epoch}`;clock.monotonicMs=0;b=new TransferBudget(options);return b;}};
}
test('atomic reservations prevent concurrent consumers spending the same allowance; idempotency cannot change a reservation',t=>{
  const r=rig(t);r.b.start(request('first',600));assert.equal(r.b.status.remainingBytes,400);
  assert.throws(()=>r.b.start(request('second',500)),/QUOTA_EXHAUSTED/);assert.equal(r.b.start(request('first',600)).remaining,600);
  assert.throws(()=>r.b.start(request('first',100)),/ID_CONFLICT/);assert.throws(()=>new TransferBudget(r.options),/OWNERSHIP/);
  r.b.start(request('second',400));assert.equal(r.b.status.remainingBytes,0);assert.throws(()=>r.b.start(request('third',1)),/CONCURRENCY/);
});
test('actual attempted bytes replace the preflight estimate; authoritative coverage reconciles without double counting',t=>{
  const r=rig(t);r.b.start(request('x',300));const g=r.b.grant('x',100);r.b.settle('x',g.id,80,70);
  assert.equal(r.b.getTransfer('x')!.remaining,220);assert.equal(r.b.getTransfer('x')!.offset,70);
  assert.equal(r.b.status.remainingBytes,700);r.b.finish('x');assert.equal(r.b.status.remainingBytes,920);
  r.b.checkpoint({...usage,revision:2,usedBytes:80,coveredCharges:[g.id]});assert.equal(r.b.status.remainingBytes,920);assert.equal(r.b.status.unreconciledAttemptBytes,0);
  assert.throws(()=>r.b.checkpoint({...usage,revision:3,usedBytes:80,coveredCharges:['missing']}),/INVALID_COVERAGE/);
  assert.throws(()=>r.b.checkpoint({...usage,revision:1,usedBytes:80}),/USAGE_REPLAY/);
});
test('quota and unknown/stale coverage defer discretionary work while essential traffic remains separately bounded',t=>{
  const r=rig(t);r.b.checkpoint({...usage,revision:2,usedBytes:1000,coverage:'unknown'});
  assert.throws(()=>r.b.start(request('bulk')),/COVERAGE_UNKNOWN/);r.b.start(request('control',200,'essential'));
  const g=r.b.grant('control',100);r.b.settle('control',g.id,100,100);assert.throws(()=>r.b.grant('control',1),/RATE_LIMIT/);
  r.advance(1000);const h=r.b.grant('control',100);r.b.settle('control',h.id,100,100);r.b.finish('control');
  assert.throws(()=>r.b.start(request('audit',1,'essential')),/QUOTA_EXHAUSTED/);
  r.b.checkpoint({...usage,revision:3,usedBytes:1000});assert.throws(()=>r.b.start(request('bulk')),/QUOTA_EXHAUSTED/);
  // Local stop/watchdog does not call or await this WAN admission ledger.
});
test('bounded rate and concurrency persist across reboot; partial ambiguous attempts are not refunded',t=>{
  const r=rig(t);r.b.start(request('x',500));r.b.start(request('y',400));const g=r.b.grant('x',300);
  r.reopen();assert.equal(r.b.getTransfer('x')!.state,'paused');assert.equal(r.b.getTransfer('x')!.pending,null);
  assert.equal(r.b.status.unreconciledAttemptBytes,300);r.b.resume('x');assert.throws(()=>r.b.grant('x',101),/RATE_LIMIT/);
  const h=r.b.grant('x',100);r.b.settle('x',h.id,100,100);r.advance(1000);
  assert.throws(()=>r.b.settle('x',g.id,0,0),/INVALID_RECEIPT/);assert.equal(r.b.status.remainingBytes,100);
});
test('scoped overrides require current authorization, expire, and commit attributable audit before use',t=>{
  const r=rig(t);r.b.checkpoint({...usage,revision:2,usedBytes:1000});
  const actor={kind:'human' as const,id:'operator'};const o={id:'override',class:'diagnostic' as const,bytes:100,expiresUtcMs:now+500,actor};
  assert.throws(()=>r.b.override({...o,actor:{kind:'service',id:'viewer'}}),/NOT_AUTHORIZED/);
  const applied=r.b.override(o);assert.equal(applied.override.bytes,100);assert.equal(r.b.pendingAudit().length,2);
  for(const e of r.b.pendingAudit())assert.equal(validateAuditEvent(e).ok,true);
  assert.throws(()=>r.b.start({...request('wrong',1,'media'),overrideId:'override'}),/OVERRIDE_EXPIRED/);
  r.b.start({...request('x'),overrideId:'override'});r.advance(500);assert.throws(()=>r.b.grant('x',1),/OVERRIDE_EXPIRED/);
  r.reopen();assert.equal(r.b.pendingAudit().length,2);const copied:string[]=[];r.b.copyAudit(e=>copied.push(e.eventId));assert.equal(copied.length,2);assert.equal(r.b.pendingAudit().length,0);
  r.deny();assert.throws(()=>r.b.override({...o,id:'denied',expiresUtcMs:r.clock.utcMs+100}),/NOT_AUTHORIZED/);
});
test('upload windows, coverage age, unknown policy and clock regression are explicit admission results',t=>{
  const r=rig(t,{uploadWindows:[{startHourUtc:13,endHourUtc:14}]});assert.throws(()=>r.b.start(request('x')),/UPLOAD_WINDOW/);
  r.b.start({...request('download'),direction:'download'});r.clock.utcMs--;
  assert.throws(()=>r.b.grant('download',1),/CLOCK_REGRESSION/);r.clock.utcMs++;
  r.advance(60001);assert.throws(()=>r.b.grant('download',1),/COVERAGE_UNKNOWN/);r.clock.reliable=false;assert.throws(()=>r.b.start(request('y')),/CLOCK_UNKNOWN/);assert.equal(r.b.status.degraded,true);
});
test('stream duration, idle and bitrate have independent local caps; restart never renews viewer intent',t=>{
  const r=rig(t);const q={...request('stream',100,'media'),direction:'download' as const,stream:true,bitrate:800};
  r.b.start(q);const g=r.b.grant('stream',100);r.b.settle('stream',g.id,100,100);assert.throws(()=>r.b.grant('stream',1),/BITRATE_LIMIT/);
  r.advance(250);assert.throws(()=>r.b.intent('stream'),/STREAM_EXPIRED/);assert.throws(()=>r.b.grant('stream',1),/STREAM_EXPIRED/);
  r.reopen();assert.throws(()=>r.b.resume('stream'),/RESTART_REQUIRED/);
});
test('fresh viewer intent cannot extend total stream duration; explicitly configured unknown coverage remains labelled',t=>{
  const r=rig(t,{unknownCoverage:'allow',stream:{maxBitrate:800,maxDurationMs:1000,idleMs:30000}});
  r.b.checkpoint({...usage,revision:2,coverage:'unknown'});r.b.start({...request('stream',100,'media'),direction:'download',stream:true,bitrate:800});
  assert.equal(r.b.status.coverage,'unknown');r.advance(1000);r.b.intent('stream');assert.throws(()=>r.b.grant('stream',1),/STREAM_EXPIRED/);
});
test('range transfers resume their durable accepted offset, deduplicate cache and verify content before completing',async t=>{
  const r=rig(t);const data=Buffer.alloc(300,7),hash=createHash('sha256').update(data).digest('hex');
  const q={...request('artifact',300,'artifact'),direction:'download' as const,artifactDigest:hash};r.b.start(q);
  const cache=new ArtifactCache(r.b,join(r.d,'cache'),1000);const offsets:number[]=[];
  const first=await cache.step('artifact',async g=>{offsets.push(g.offset);return {data:data.subarray(0,100),attemptedBytes:100};});assert.equal(first.offset,100);
  r.reopen();r.advance(1000);const resumed=new ArtifactCache(r.b,join(r.d,'cache'),1000);
  const done=await resumed.step('artifact',async g=>{offsets.push(g.offset);return {data:data.subarray(g.offset),attemptedBytes:200};});
  assert.equal(done.complete,true);assert.deepEqual(offsets,[0,100]);assert.deepEqual(readFileSync(done.path!),data);
  assert.equal(r.b.start({...q,id:'same-artifact'}).id,'artifact');let calls=0;
  assert.equal((await resumed.step('artifact',async()=>{calls++;throw Error('no network');})).cacheHit,true);assert.equal(calls,0);
  assert.equal(readdirSync(join(r.d,'cache')).length,1);
});
test('failed/oversized downloads retain bounded attempt debit and retries exhaust a persisted cap',async t=>{
  const r=rig(t,{maxAttempts:2});const q={...request('artifact',100,'artifact'),direction:'download' as const,artifactDigest:'a'.repeat(64)};r.b.start(q);
  const cache=new ArtifactCache(r.b,join(r.d,'cache'));
  await assert.rejects(cache.step('artifact',async()=>{throw Error('offline');}),/offline/);r.advance(1000);
  await assert.rejects(cache.step('artifact',async()=>({data:Buffer.alloc(101),attemptedBytes:101})),/INVALID_SEGMENT/);
  r.reopen();r.advance(1000);await assert.rejects(new ArtifactCache(r.b,join(r.d,'cache')).step('artifact',async()=>{throw Error('not called');}),/ATTEMPT_LIMIT/);
  assert.equal(r.b.status.unreconciledAttemptBytes,200);
});
test('cache storage exhaustion and digest mismatch cannot release unverified firmware',async t=>{
  const r=rig(t);r.b.start({...request('artifact',100,'artifact'),direction:'download',artifactDigest:'a'.repeat(64)});
  await assert.rejects(new ArtifactCache(r.b,join(r.d,'small'),50).step('artifact',async()=>{throw Error('not called');}),/CACHE_CAPACITY/);
  assert.equal(r.b.status.unreconciledAttemptBytes,0);
  await assert.rejects(new ArtifactCache(r.b,join(r.d,'cache')).step('artifact',async()=>({data:Buffer.alloc(100),attemptedBytes:100})),/DIGEST_MISMATCH/);
  assert.equal(r.b.getTransfer('artifact')!.state,'cancelled');
});
test('SIGKILL after attempt admission preserves the debit and reboot requires explicit bounded resume',{timeout:15000},async t=>{
  const d=mkdtempSync(join(tmpdir(),'arbi-transfer-crash-'));const path=join(d,'budget.sqlite');let cleanup:TransferBudget|undefined;
  t.after(()=>{cleanup?.close();rmSync(d,{recursive:true,force:true});});
  const clock:TransferClock={epoch:'first',monotonicMs:1000,utcMs:now,reliable:true};
  const input={path,realm,siteId:'site',source,policy};
  const script=`import {TransferBudget} from ${JSON.stringify(new URL('./budget.js',import.meta.url).href)};
    const b=new TransferBudget({...${JSON.stringify(input)},clock:()=>(${JSON.stringify(clock)}),authorize:()=>true});
    b.checkpoint(${JSON.stringify(usage)});b.start(${JSON.stringify(request('x',100))});b.grant('x',50);process.kill(process.pid,'SIGKILL');`;
  const child=spawn(process.execPath,['--input-type=module','--eval',script],{stdio:'ignore'});assert.equal((await once(child,'exit'))[1],'SIGKILL');
  const b=new TransferBudget({...input,clock:()=>({...clock,epoch:'second',monotonicMs:0}),authorize:()=>true});cleanup=b;
  assert.equal(b.getTransfer('x')!.state,'paused');assert.equal(b.status.unreconciledAttemptBytes,50);assert.equal(b.getTransfer('x')!.offset,0);
  assert.throws(()=>b.grant('x',1),/INVALID_STATE/);b.resume('x');assert.equal(b.getTransfer('x')!.attempts,1);
});
test('file writes not committed to the ledger are truncated on resume before another bounded range',async t=>{
  const r=rig(t);const data=Buffer.alloc(100,3),hash=createHash('sha256').update(data).digest('hex');r.b.start({...request('artifact',100,'artifact'),direction:'download',artifactDigest:hash});
  const directory=join(r.d,'cache'),cache=new ArtifactCache(r.b,directory);writeFileSync(join(directory,`${hash}.partial`),Buffer.alloc(10,9));
  const result=await cache.step('artifact',async g=>{assert.equal(g.offset,0);return {data,attemptedBytes:100};});assert.equal(result.complete,true);assert.deepEqual(readFileSync(result.path!),data);
});
