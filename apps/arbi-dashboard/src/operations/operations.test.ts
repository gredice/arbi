import assert from 'node:assert/strict';
import test from 'node:test';
import { operationsConfig } from './contracts';
import { OperationsMonitor } from './monitor';
import { operationsRoute } from './runtime';
test('private operations config rejects realm/origin/TLS/key mismatches without echoing credentials',()=>{
  const valid={realm:{environment:'test' as const,namespaceId:'synthetic-ops'},databaseUrl:'postgresql://private-user:private-password@localhost/arbi_ops',databaseRole:'app-role',deployment:'isolated-test' as const,
    signingKey:new Uint8Array(32),browserOrigins:['http://localhost:3000']};assert.equal(operationsConfig(valid).realm.namespaceId,'synthetic-ops');
  for(const change of [{signingKey:new Uint8Array(1)},{realm:{environment:'production' as const,namespaceId:'synthetic-ops'}},{databaseUrl:'postgresql://private-user:private-password@remote.test/arbi_ops'},
    {browserOrigins:['https://valid.test/path']},{databaseUrl:'https://private-user:private-password@localhost/arbi_ops'}]){
    assert.throws(()=>operationsConfig({...valid,...change}),error=>error instanceof Error&&error.message==='INVALID_CONFIGURATION'&&!JSON.stringify(error).includes('private-password'));
  }
  const protectedConfig={...valid,realm:{...valid.realm,environment:'production' as const},deployment:'protected-main' as const,browserOrigins:['https://protected.test'],databaseUrl:'postgresql://user:private-password@db.test/arbi_ops?sslmode=verify-full'};
  assert.equal(operationsConfig(protectedConfig).deployment,'protected-main');
});
test('operational projections are closed, bounded, boot-local and distinct from durable audit',async()=>{
  const monitor=new OperationsMonitor({database:async()=>{throw Error('postgresql://secret:private-password@host/data');},broker:async()=> 'ready'});
  for(let n=0;n<100;n++)monitor.record('transport','unavailable',`correlation-${n}`,100000);
  assert.equal(monitor.record('arbitrary' as never,'ok','x',1),false);assert.equal(monitor.record('health','ok','Bearer credential',1),false);
  const result=await monitor.health(new AbortController().signal);assert.equal(result.state,'degraded');assert.ok(result.services);assert.ok(result.logs);
  assert.deepEqual(result.services.map(s=>s.status),['unavailable','ready','unconfigured']);assert.equal(result.logs.length,64);assert.equal(result.droppedLogs,37);
  assert.ok(result.logs.every(l=>l.durationMs<=30000));assert.doesNotMatch(JSON.stringify(result),/password|postgresql|Bearer/);
  const another=new OperationsMonitor();assert.notEqual(another.bootId,monitor.bootId);const restarted=await another.health(new AbortController().signal);assert.ok(restarted.counters);assert.equal(restarted.counters['transport.unavailable'],undefined);
});
test('timed-out probes retain their slot until settlement and overlapping health calls do not create new dependency work',async()=>{
  let finish!:(value:'ready')=>void,calls=0;const stalled=new Promise<'ready'>(resolve=>{finish=resolve;});
  const monitor=new OperationsMonitor({database:async()=>{calls++;return stalled;}});const first=monitor.health(new AbortController().signal);
  assert.equal((await monitor.health(new AbortController().signal)).state,'degraded');await first;
  await monitor.health(new AbortController().signal);assert.equal(calls,1);finish('ready');await new Promise(resolve=>setImmediate(resolve));
  await monitor.health(new AbortController().signal);assert.equal(calls,2);
});
test('unconfigured operations HTTP cannot expose process metrics or fixture identity',async()=>{
  const response=await operationsRoute(new Request('http://localhost/api/sites/synthetic-site/operations/health'),{siteId:'synthetic-site',action:'health'});
  assert.equal(response.status,503);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.doesNotMatch(await response.text(),/bootId|database|credential|synthetic-ops/);
});
