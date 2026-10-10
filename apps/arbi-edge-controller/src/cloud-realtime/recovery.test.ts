import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';
import { ApplicationMeter, TrafficSpool, stamp } from '@arbi/traffic';
import { AblySubscription } from './ably.js';
import { RecoveryConsumer } from './consumer.js';
import { HttpsRecoveryApi } from './http.js';
import { VERSION } from './contracts.js';
import type { Admission, Recovery, RecoveryApi } from './contracts.js';
import { RecoveryTraffic } from './traffic.js';
const clientId=`arbi-${'a'.repeat(64)}`;
const config={realm:{environment:'test' as const,namespaceId:'recovery-test'},siteId:'site-a',identity:{deviceId:'edge-1',bootId:'boot-1',sessionId:'session-1'}};
function admission(now=Date.now()): Admission {
  const grant={id:'grant-1',realm:config.realm,siteId:config.siteId,clientId,channel:`arbi:test:recovery-test:site-a:state:${clientId.slice(5)}`,expiresAtMs:now+30000};
  return {grant,token:{token:'isolated-no-provider-authority',issued:now,expires:grant.expiresAtMs-250,clientId:grant.clientId,capability:JSON.stringify({[grant.channel]:['subscribe']})}};
}
function recovered(a: Admission,cursor='1',reset=true): Recovery {
  return {version:VERSION,realm:config.realm,siteId:config.siteId,epoch:'epoch-a',cursor,reset,snapshot:{configRevision:'config-1'},
    notifications:[],more:false,expiresAtMs:a.grant.expiresAtMs,heartbeatAfterMs:2500};
}
test('real Ably realtime SDK authenticates, attaches exact channel, meters original hint bytes and closes on provider revocation/expiry',async (t) => {
  const server=new WebSocketServer({host:'127.0.0.1',port:0,maxPayload:4096});await once(server,'listening');const address=server.address();assert.ok(address && typeof address!=='string');
  let peer: WebSocket|undefined;const attached: string[]=[];const wire: any[]=[];
  server.on('connection',(socket,request) => {
    peer=socket;const url=new URL(request.url!,'http://127.0.0.1');assert.equal(url.searchParams.get('access_token'),'isolated-no-provider-authority');assert.equal(url.searchParams.get('clientId'),clientId);
    socket.send(JSON.stringify({action:4,connectionId:'fixture-connection',connectionDetails:{clientId:clientId,connectionKey:'fixture-key',maxMessageSize:4096,maxFrameSize:4096,connectionStateTtl:120000,maxIdleInterval:15000}}));
    socket.on('message',(buffer) => {
      const message=JSON.parse(buffer.toString());wire.push(message);
      if(message.action===10) {attached.push(message.channel);assert.equal(message.flags & (1<<18),1<<18);socket.send(JSON.stringify({action:11,channel:message.channel,flags:1<<18}));}
      if(message.action===7) {socket.send(JSON.stringify({action:8}));socket.close();}
    });
  });
  const root=await mkdtemp(join(tmpdir(),'arbi-ably-tap-'));const spool=new TrafficSpool({path:join(root,'traffic.sqlite'),binding:{realm:config.realm,siteId:config.siteId,deviceId:config.identity.deviceId,executionMode:'simulation'},maxRecords:16,maxBytes:131072,maxPages:128,maxCounters:1});
  t.after(async () => {spool.close();for(const socket of server.clients) socket.terminate();await new Promise<void>((r) => server.close(() => r()));await rm(root,{recursive:true,force:true});});
  const meter=new ApplicationMeter(spool,() => stamp('boot-1'));
  const spec={scope:{realm:config.realm,siteId:config.siteId,source:config.identity,executionMode:'simulation' as const,boundary:'lan' as const,linkId:'broker-fixture'},direction:'download' as const,category:'telemetry' as const,includes:['payload' as const],maxAgeMs:10000,retryOf:null,media:null};
  const adapter=new AblySubscription({endpoint:'127.0.0.1',port:address.port,tls:false,fallbackHosts:[],transports:['web_socket']},{meter,spec});
  const a=admission();let received: unknown;let resolveHint!:()=>void;const hinted=new Promise<void>((r) => {resolveHint=r;});let resolveDisconnect!:()=>void;const disconnected=new Promise<void>((r) => {resolveDisconnect=r;});
  const close=await adapter.open(a,(notice) => {received=notice;resolveHint();},resolveDisconnect);
  assert.deepEqual(attached,[a.grant.channel]);
  const notice={version:VERSION,realm:config.realm,siteId:config.siteId,epoch:'epoch-a',cursor:'2'};const data=JSON.stringify(notice);
  peer!.send(JSON.stringify({action:15,channel:a.grant.channel,messages:[{id:'fixture-message',name:'changed',data}]}));await hinted;
  assert.deepEqual(received,notice);assert.equal(spool.pending()[0].record.kind,'transfer');assert.equal((spool.pending()[0].record as any).bytes,String(Buffer.byteLength(data)));
  peer!.send(JSON.stringify({action:6,error:{code:40141,statusCode:401,message:'isolated revoked token'}}));await disconnected;close();
  assert.equal(wire.some((m) => m.action===15 || m.action===14 || m.action===17),false);
  // Provider token expiry can precede the original grant expiry.
  const expiring=admission();expiring.token.expires=Date.now()+150;
  let expire!:()=>void;const expired=new Promise<void>((r) => {expire=r;});const stop=await adapter.open(expiring,() => {},expire);await expired;stop();
});
test('duplicate, reordered and dropped hints converge over HTTPS; slow concurrent callers do not queue and gaps force reauthorization',async () => {
  const a=admission();let release!:()=>void;const delay=new Promise<void>((r) => {release=r;});let calls=0,recoveries=0,closeCount=0;let latest='1';let invalid=false;
  const api: RecoveryApi={attach:async () => {calls++;await delay;return a;},recover:async (_grant,_epoch,cursor) => {
    recoveries++;if(invalid) return {...recovered(a,'5',false),notifications:[{cursor:'5',kind:'jobs'}]};
    return cursor===null ? recovered(a,latest) : {...recovered(a,latest,false),notifications:latest===cursor ? [] : [{cursor:latest,kind:'state'}]};
  },pollJobs:async () => 0};
  const now=Date.now();const consumer=new RecoveryConsumer(config,api,{open:async () => () => {closeCount++;}},() => 0,() => now);
  const starting=consumer.step(now);await Promise.all(Array.from({length:100},() => consumer.step(now)));assert.equal(calls,1);release();await starting;assert.equal(consumer.status,'current');
  const hint=(cursor:string,siteId='site-a') => ({version:VERSION,realm:config.realm,siteId,epoch:'epoch-a',cursor});
  for(let i=0;i<1000;i++) {consumer.hint(hint('2'));consumer.hint(hint('1'));consumer.hint(hint('999','wrong-site'));}
  latest='2';await consumer.step(now+2500);assert.equal(consumer.status,'current');assert.equal(recoveries,2);
  // No notification for cursor 3: the heartbeat still recovers it.
  latest='3';await consumer.step(now+5000);assert.equal(consumer.status,'current');assert.equal(recoveries,3);
  invalid=true;await consumer.step(now+7500);assert.equal(consumer.status,'degraded');assert.equal(closeCount,1);
  // Delayed broker callbacks must not shorten failure backoff; the next attach
  // discards the invalid cursor and rebuilds state from a current snapshot.
  consumer.hint(hint('999'));await consumer.step(now+8000);assert.equal(calls,1);
  invalid=false;latest='6';await consumer.step(now+8500);assert.equal(calls,2);assert.equal(consumer.status,'current');
  assert.equal(recoveries,5);consumer.close();
});
test('repeated disconnects exhaust admission budget, catch-up is bounded and no broker work is dispatchable',async () => {
  const now=Date.now();let attaches=0,reads=0;let disconnect:()=>void=() => {};let active=admission(now);let resets=0;
  const api: RecoveryApi={attach:async () => {attaches++;active=admission(now);return active;},recover:async (_id,epoch,cursor) => {
    reads++;if(epoch===null) {resets++;return recovered(active);}
    const next=String(BigInt(cursor!)+1n);return {...recovered(active,next,false),snapshot:null,more:true,notifications:[{cursor:next,kind:'jobs'}]};
  },pollJobs:async () => 0};
  const consumer=new RecoveryConsumer(config,api,{open:async (_a,_changed,lost) => {disconnect=lost;return () => {};}},() => 0,() => now);
  for(let i=0;i<8;i++) {await consumer.step(now+i*2500);disconnect();}
  await consumer.step(now+20000);assert.equal(attaches,8);assert.equal(consumer.status,'degraded');consumer.close();
  const catchup=new RecoveryConsumer(config,api,{open:async () => () => {}},() => 0,() => now);
  await catchup.step(now);for(let i=1;i<=5;i++) await catchup.step(now+i*2500);assert.equal(resets,3);assert.equal(reads,14);assert.equal(catchup.status,'current');catchup.close();
});
test('HTTPS read cap and attempted application bytes include failed upload and rejected oversized response',async (t) => {
  const root=await mkdtemp(join(tmpdir(),'arbi-recovery-meter-'));const spool=new TrafficSpool({path:join(root,'traffic.sqlite'),binding:{realm:config.realm,siteId:config.siteId,deviceId:config.identity.deviceId,executionMode:'simulation'},maxRecords:16,maxBytes:131072,maxPages:128,maxCounters:1});
  t.after(async () => {spool.close();await rm(root,{recursive:true,force:true});});
  const meter=new ApplicationMeter(spool,() => stamp('boot-1')),key=generateKeyPairSync('ed25519').privateKey;
  const scope={realm:config.realm,siteId:config.siteId,source:config.identity,executionMode:'simulation' as const,boundary:'lan' as const,linkId:'https-fixture'};
  const failed=new HttpsRecoveryApi({...config,origin:'http://127.0.0.1',credentialId:'credential-1',key},meter,scope,async () => {throw new Error('ISOLATED_FAILURE');},true);
  await assert.rejects(failed.attach());const attempted=spool.pending()[0].record as any;assert.equal(attempted.outcome,'failed');assert.ok(BigInt(attempted.bytes)>0n);
  const huge=new HttpsRecoveryApi({...config,origin:'http://127.0.0.1',credentialId:'credential-1',key},meter,scope,async () => new Response('x'.repeat(65537)),true);
  await assert.rejects(huge.attach(),/RESPONSE_CAPACITY/);const received=spool.pending().map((p) => p.record as any).find((r) => r.spec.direction==='download');assert.equal(received.bytes,'65537');assert.equal(received.outcome,'aborted');
  assert.throws(() => new HttpsRecoveryApi({...config,origin:'http://127.0.0.1',credentialId:'credential-1',key},meter,{...scope,boundary:'garden-sim'},fetch,true),/INVALID_CONFIGURATION/);
});

test('closing during admission, attachment, recovery or job poll aborts and cannot restore state',async () => {
  for(const stage of ['attach','open','recover','poll'] as const) {
    const a=admission();let enter!:()=>void,release!:()=>void,signal:AbortSignal|undefined,closes=0,calls=0;
    const entered=new Promise<void>(resolve => {enter=resolve;});const delayed=new Promise<void>(resolve => {release=resolve;});
    const pause=async (current:AbortSignal|undefined) => {signal=current;enter();await delayed;};
    const api:RecoveryApi={attach:async current => {calls++;if(stage==='attach') await pause(current);return a;},
      recover:async (_id,_epoch,_cursor,current) => {if(stage==='recover') await pause(current);return recovered(a);},
      pollJobs:async current => {if(stage==='poll') await pause(current);return 1;}};
    const consumer=new RecoveryConsumer(config,api,{open:async (_a,_hint,_lost,current) => {
      if(stage==='open') await pause(current);return () => {closes++;};
    }});
    const running=consumer.step();await entered;consumer.close();assert.equal(signal?.aborted,true,stage);release();await running;
    await consumer.step(Date.now()+60000);
    assert.equal(consumer.status,'offline',stage);assert.equal(consumer.snapshot,null,stage);assert.equal(consumer.lastPolledJobs,0,stage);
    assert.equal(calls,1,stage);assert.equal(closes,stage==='attach' ? 0 : 1,stage);
  }
});

test('broker downtime preserves HTTPS heartbeats; earlier token expiry requires new admission',async () => {
  let now=Date.now(),attaches=0,reads=0,opens=0,active:Admission;
  const api:RecoveryApi={attach:async () => {attaches++;active=admission(now);active.token.expires=now+5000;return active;},
    recover:async () => {reads++;return recovered(active);},pollJobs:async () => 0};
  const consumer=new RecoveryConsumer(config,api,{open:async () => {opens++;throw new Error('BROKER_DOWN');}},() => 0,() => now);
  await consumer.step();assert.equal(consumer.status,'degraded');assert.deepEqual(consumer.snapshot,{configRevision:'config-1'});
  now+=2500;await consumer.step();assert.equal(reads,2);assert.equal(opens,1);
  now+=2500;await consumer.step();assert.equal(attaches,2);assert.equal(opens,2);consumer.close();
});

test('SDK opening is bounded through attachment and cancellation; oversized hints share HTTPS budget',async (t) => {
  const server=new WebSocketServer({host:'127.0.0.1',port:0,maxPayload:8192});await once(server,'listening');
  const address=server.address();assert.ok(address && typeof address!=='string');
  t.after(async () => {for(const socket of server.clients) socket.terminate();await new Promise<void>(resolve => server.close(() => resolve()));});
  let acknowledge=false,peer:WebSocket|undefined,attached!:()=>void;
  server.on('connection',socket => {
    peer=socket;
    socket.send(JSON.stringify({action:4,connectionId:'fixture-connection',connectionDetails:{clientId:clientId,connectionKey:'fixture-key',maxMessageSize:8192,maxFrameSize:8192,connectionStateTtl:120000,maxIdleInterval:15000}}));
    socket.on('message',buffer => {
      const message=JSON.parse(buffer.toString());
      if(message.action===10) {attached?.();if(acknowledge) socket.send(JSON.stringify({action:11,channel:message.channel,flags:1<<18}));}
      if(message.action===7) {socket.send(JSON.stringify({action:8}));socket.close();}
    });
  });
  const traffic=new RecoveryTraffic();let observed=0,changed=0;
  // This adapter-level tap records all original bytes before filtering/parsing.
  const meter={observe:(_spec:unknown,value:Uint8Array) => {observed+=value.byteLength;}} as unknown as ApplicationMeter;
  const spec={} as Parameters<ApplicationMeter['observe']>[0];
  const adapter=new AblySubscription({endpoint:'127.0.0.1',port:address.port,tls:false,fallbackHosts:[],transports:['web_socket']},{meter,spec},traffic);
  const aborted=new AbortController();const attaching=new Promise<void>(resolve => {attached=resolve;});
  const opening=adapter.open(admission(),() => {},() => {},aborted.signal);await attaching;aborted.abort();await assert.rejects(opening,/BROKER_UNAVAILABLE/);
  // No ATTACHED frame: the complete opening deadline still expires.
  await assert.rejects(adapter.open(admission(),() => {},() => {}),/BROKER_UNAVAILABLE/);
  acknowledge=true;let lost!:()=>void;const disconnected=new Promise<void>(resolve => {lost=resolve;});
  const a=admission(),stop=await adapter.open(a,() => {changed++;},lost);
  traffic.account(2*1024*1024-1024);
  const data='x'.repeat(2048);
  peer!.send(JSON.stringify({action:15,channel:a.grant.channel,messages:[{id:'oversized',name:'changed',data}]}));
  await disconnected;stop();assert.equal(observed,2048);assert.equal(changed,0);
  assert.throws(() => traffic.request(),/RECOVERY_BUDGET/);
});

test('HTTPS cancellation bounds stalled submission/body reading and quarantines a transport ignoring abort',async (t) => {
  const root=await mkdtemp(join(tmpdir(),'arbi-recovery-cancel-'));
  const spool=new TrafficSpool({path:join(root,'traffic.sqlite'),binding:{realm:config.realm,siteId:config.siteId,deviceId:config.identity.deviceId,executionMode:'simulation'},maxRecords:16,maxBytes:131072,maxPages:128,maxCounters:1});
  t.after(async () => {spool.close();await rm(root,{recursive:true,force:true});});
  const meter=new ApplicationMeter(spool,() => stamp('boot-1')),key=generateKeyPairSync('ed25519').privateKey;
  const scope={realm:config.realm,siteId:config.siteId,source:config.identity,executionMode:'simulation' as const,boundary:'lan' as const,linkId:'https-fixture'};
  let submitted!:()=>void,finish!:(response:Response)=>void,sends=0,cancelled=false;
  const started=new Promise<void>(resolve => {submitted=resolve;});
  const api=new HttpsRecoveryApi({...config,origin:'http://127.0.0.1',credentialId:'credential-1',key},meter,scope,async () => {
    sends++;submitted();return new Promise<Response>(resolve => {finish=resolve;});
  },true);
  const abort=new AbortController(),pending=api.attach(abort.signal);await started;abort.abort();await assert.rejects(pending,/RECOVERY_UNAVAILABLE/);
  for(let i=0;i<100;i++) await assert.rejects(api.attach(),/RECOVERY_UNAVAILABLE/);
  assert.equal(sends,1);const attempted=spool.pending()[0].record as any;assert.equal(attempted.outcome,'failed');assert.ok(BigInt(attempted.bytes)>0n);
  finish(new Response(new ReadableStream({cancel() {cancelled=true;}})));await new Promise(resolve => setImmediate(resolve));assert.equal(cancelled,true);
  let reading!:()=>void,bodyCancelled=false;const read=new Promise<void>(resolve => {reading=resolve;});
  const stalled=new HttpsRecoveryApi({...config,origin:'http://127.0.0.1',credentialId:'credential-1',key},meter,scope,async () =>
    new Response(new ReadableStream({pull() {reading();},cancel() {bodyCancelled=true;}})),true);
  const bodyAbort=new AbortController(),body=stalled.attach(bodyAbort.signal);await read;bodyAbort.abort();await assert.rejects(body,/RECOVERY_UNAVAILABLE/);assert.equal(bodyCancelled,true);
  let now=0;const shared=new RecoveryTraffic(() => now);shared.account(2*1024*1024);
  const blocked=new HttpsRecoveryApi({...config,origin:'http://127.0.0.1',credentialId:'credential-1',key},meter,scope,async () => Response.json({commands:[]}),true,shared);
  await assert.rejects(blocked.attach(),/RECOVERY_BUDGET/);now=60000;await blocked.pollJobs();
});

test('slow failed operations start backoff after settlement; retired callbacks cannot wake a replacement grant',async () => {
  let now=Date.now(),active:Admission,attaches=0,reads=0,fail=true;
  const callbacks:((value:unknown)=>void)[]=[];
  const api:RecoveryApi={attach:async () => {attaches++;active=admission(now);return active;},recover:async () => {
    reads++;if(fail) {now+=4000;throw new Error('SLOW_FAILURE');}return recovered(active);
  },pollJobs:async () => 0};
  const consumer=new RecoveryConsumer(config,api,{open:async (_a,hint) => {callbacks.push(hint);return () => {};}},() => 0,() => now);
  await consumer.step();assert.equal(consumer.status,'degraded');
  const hint={version:VERSION,realm:config.realm,siteId:config.siteId,epoch:'epoch-a',cursor:'999'};
  now+=500;callbacks[0](hint);await consumer.step();assert.equal(attaches,1);
  now+=500;fail=false;await consumer.step();assert.equal(attaches,2);assert.equal(reads,2);assert.equal(consumer.status,'current');
  callbacks[0](hint);now+=500;await consumer.step();assert.equal(reads,2);
  callbacks[1](hint);now+=500;await consumer.step();assert.equal(reads,3);consumer.close();
});

test('invalid cross-site, wildcard, publish and expired admissions never open a broker or poll jobs',async () => {
  for(const mutate of [
    (a:Admission) => {a.grant.siteId='other-site';},
    (a:Admission) => {a.grant.channel='arbi:test:recovery-test:*';a.token.capability=JSON.stringify({[a.grant.channel]:['subscribe']});},
    (a:Admission) => {a.token.capability=JSON.stringify({[a.grant.channel]:['subscribe','publish']});},
    (a:Admission) => {a.token.expires=0;},
    (a:Admission) => {a.grant.expiresAtMs=NaN;},
    (a:Admission) => {a.token.issued=Date.now()+1000;},
  ]) {
    const a=admission();mutate(a);let opens=0,reads=0;
    const consumer=new RecoveryConsumer(config,{attach:async () => a,recover:async () => {reads++;return recovered(a);},pollJobs:async () => {throw new Error('UNEXPECTED_POLL');}},
      {open:async () => {opens++;return () => {};}});
    await consumer.step();assert.equal(consumer.status,'degraded');assert.equal(opens,0);assert.equal(reads,0);consumer.close();
  }
});
