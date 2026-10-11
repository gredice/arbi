import assert from 'node:assert/strict';
import test from 'node:test';
import {randomBytes,generateKeyPairSync,sign,randomUUID} from 'node:crypto';
import {realpathSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import pg from 'pg';
import {postgresDatabase} from '../enrollment/store';
import {fixture,realm} from '../jobs/test-support';
import {createLiveServer} from './server';
import {SimulatedLiveAdapter} from './simulated-adapter';
import {liveProducerReference} from './producer-reference.test-support';
import type {LivePolicy,LiveAdapter} from './contracts';
import {proofBytes} from '../enrollment/crypto';
import {UsageStore} from '../usage/store';
import type {UsageObservation} from '@arbi/protocol';
const socket=process.env.ARBI_ENROLLMENT_TEST_SOCKET;
test('native PostgreSQL live authority: shared producer, scoped leases, policy, reconnect and atomic audit',{skip:!socket,timeout:15000},async t=>{
  const root=realpathSync(socket!);assert.ok(root.startsWith(`${realpathSync(tmpdir())}/arbi-enrollment-pg-`));
  const base={host:root,user:'arbi_test',port:54321,max:4},admin=new pg.Pool({...base,database:'postgres',max:1});await admin.query('CREATE DATABASE arbi_live_test');await admin.end();
  const pool=new pg.Pool({...base,database:'arbi_live_test'}),other=new pg.Pool({...base,database:'arbi_live_test'});t.after(async()=>{await other.end();await pool.end();});
  for(const file of ['0001-enrollment','0002-media','0003-audit','0004-jobs','0007-usage','0011-live','0011-live'])await pool.query(await readFile(new URL(`../../migrations/${file}.sql`,import.meta.url),'utf8'));
  async function setup(adapter:LiveAdapter=new SimulatedLiveAdapter()){
    const f=await fixture(),keys=generateKeyPairSync('ed25519');f.registry.devices[0].credentials[0].publicKey=keys.publicKey.export({format:'der',type:'spki'}).toString('base64url');
    await pool.query('INSERT INTO arbi_device_registry VALUES($1,$2,$3,$4::jsonb)',[realm.environment,realm.namespaceId,f.registry.siteId,JSON.stringify(f.registry)]);
    let decision:LivePolicy={allow:true,reason:'within-budget',revision:'policy-1',layer:'application-payload',remainingBytes:'10000000',maxUpstreamBps:200000};
    const tokenKey=randomBytes(32),options={realm,identity:f.identity.adapter,resolveSite:f.identity.resolveResource,currentAuthority:f.currentAuthority,browserOrigins:['https://synthetic.test'],adapter,tokenKey,
      profiles:[{id:'low-test',transport:'isolated-signaling' as const,maxUpstreamBps:200000,maxDownstreamBps:400000,maxViewers:2}],approveDevice:()=>true,evaluatePolicy:async()=>decision};
    const a=createLiveServer({db:postgresDatabase(pool),...options}),b=createLiveServer({db:postgresDatabase(other),...options}),one=await f.human('viewer-1','live.view'),two=await f.human('viewer-2','live.view');
    const start={key:'start-1',deviceId:'edge-1',profileId:'low-test'};
    t.after(()=>{if(adapter instanceof SimulatedLiveAdapter)adapter.close();});
    const sync=()=>pool.query('UPDATE arbi_device_registry SET state=$1::jsonb WHERE site_id=$2',[JSON.stringify(f.registry),f.registry.siteId]);
    const report=(payload:unknown)=>{const issuedAtMs=Date.now(),unsigned={version:'arbi.live-device/1.0',realm,siteId:f.registry.siteId,deviceId:'edge-1',credentialId:'credential-1',identity:f.registry.devices[0].current,configRevision:f.registry.configRevision,issuedAtMs,expiresAtMs:issuedAtMs+2000,payload};return {...unsigned,signature:sign(null,proofBytes(unsigned),keys.privateKey).toString('base64url')};};
    const usage=(payload:unknown)=>{const issuedAtMs=Date.now(),unsigned={version:'arbi.usage-device/1.0',realm,siteId:f.registry.siteId,deviceId:'edge-1',credentialId:'credential-1',identity:f.registry.devices[0].current,issuedAtMs,expiresAtMs:issuedAtMs+2000,action:'ingest',payload};return {...unsigned,signature:sign(null,proofBytes(unsigned),keys.privateKey).toString('base64url')};};
    return {f,a,b,one,two,start,adapter,options,sync,report,usage,deny:()=>{decision={...decision,allow:false,reason:'budget-exhausted',remainingBytes:'0'};}};
  }
  await t.test('independent concurrent admissions share one producer while retaining individual actor/session grants and hard viewer limit',async()=>{
    const {a,b,f,one,two,start,adapter}=await setup();const [first,second]=await Promise.all([a.store.start(one.context,start),b.store.start(two.context,start)]);
    assert.equal(first.producerId,second.producerId);assert.notEqual(first.id,second.id);
    assert.equal((await b.store.start(one.context,start)).id,first.id);await assert.rejects(b.store.start(one.context,{...start,profileId:'different'}),{code:'DENIED'});
    const third=await f.human('viewer-3','live.view');await assert.rejects(a.store.start(third.context,start),{code:'CAPACITY'});
    await a.store.synchronize(f.registry.siteId,'edge-1');assert.equal((adapter as SimulatedLiveAdapter).status.producers[0].viewers,2);
    assert.equal((await pool.query('SELECT count(*)::int n FROM arbi_live_producers WHERE site_id=$1',[f.registry.siteId])).rows[0].n,1);
    const grants=(await pool.query("SELECT record FROM arbi_audit_events WHERE site_id=$1 AND record->>'evidence'='access-grant'",[f.registry.siteId])).rows;
    assert.deepEqual(new Set(grants.map(r=>r.record.actor.id)),new Set(['viewer-1','viewer-2']));
    await assert.rejects(a.store.action(two.context,'state',{sessionId:first.id}),{code:'DENIED'});await a.store.jobs.audit.verify(realm,f.registry.siteId);
  });
  await t.test('renew rotates the scoped token; stale/reordered and contradictory signaling is rejected while exact replies replay once',async()=>{
    const {a,b,one,start}=await setup();const first=await a.store.start(one.context,start),signal={sessionId:first.id,token:first.token,sequence:1,message:{type:'offer',data:'private-synthetic-offer'}};
    const reply=await a.store.signal(one.context,signal);assert.deepEqual(await b.store.signal(one.context,signal),reply);
    await assert.rejects(a.store.signal(one.context,{...signal,message:{type:'offer',data:'contradictory'}}),{code:'CONFLICT'});
    await a.store.signal(one.context,{...signal,sequence:2});await assert.rejects(b.store.signal(one.context,signal),{code:'STALE_FENCE'});
    const renewed=await b.store.action(one.context,'renew',{sessionId:first.id,token:first.token});assert.equal(renewed.epoch,2);assert.ok(renewed.expiresAtMs<=renewed.absoluteExpiresAtMs);
    const history=(await pool.query('SELECT record FROM arbi_live_viewers WHERE id=$1',[first.id])).rows[0].record.policyHistory;assert.equal(history.length,2);assert.equal(history[0].epoch,1);assert.equal(history[1].epoch,2);
    await assert.rejects(a.store.signal(one.context,signal),{code:'DENIED'});
    await a.store.signal(one.context,{...signal,token:renewed.token,sequence:1});
    const raw=JSON.stringify((await pool.query('SELECT record FROM arbi_audit_events WHERE site_id=$1',[one.context.siteId])).rows);
    assert.doesNotMatch(raw,/private-synthetic-offer|contradictory|arbi-live\+jwt/);
  });
  await t.test('expired viewers on other devices cannot exhaust active capacity; empty legacy policy history stays appendable',async()=>{
    const {a,one,start,f,sync}=await setup(),original=f.registry.devices[0];
    for(let n=2;n<=8;n++)f.registry.devices.push({...structuredClone(original),id:`edge-${n}`,current:{...original.current!,deviceId:`edge-${n}`}});await sync();
    for(let n=1;n<=8;n++)for(let viewer=1;viewer<=2;viewer++)await a.store.start(one.context,{...start,key:`capacity-${n}-${viewer}`,deviceId:`edge-${n}`});
    await assert.rejects(a.store.start(one.context,{...start,key:'full'}),{code:'CAPACITY'});
    await pool.query("UPDATE arbi_live_viewers SET record=jsonb_set(record,'{expiresAtMs}',to_jsonb($2::bigint)) WHERE site_id=$1",[f.registry.siteId,Date.now()-1]);
    const admitted=await a.store.start(one.context,{...start,key:'after-expiry'});assert.equal(admitted.admission,'granted');
    const client=await pool.connect();try{
      await client.query('CREATE TEMP TABLE live_legacy_fixture (LIKE arbi_live_viewers)');
      await client.query('CREATE TRIGGER live_legacy_fixture_guard BEFORE UPDATE ON live_legacy_fixture FOR EACH ROW EXECUTE FUNCTION arbi_live_guard()');
      await client.query("INSERT INTO live_legacy_fixture SELECT id,environment,namespace_id,site_id,device_id,actor_id,request_key,fingerprint,intent_id,producer_id,ended_at_ms,jsonb_set(record,'{policyHistory}','[]') FROM arbi_live_viewers WHERE id=$1",[admitted.id]);
      await client.query("UPDATE live_legacy_fixture SET record=jsonb_set(record,'{epoch}','2')");
      assert.deepEqual((await client.query('SELECT record FROM live_legacy_fixture')).rows[0].record.policyHistory,[]);
    }finally{await client.query('DROP TABLE IF EXISTS live_legacy_fixture');client.release();}
  });
  await t.test('explicit end and expired/crashed viewers stop demand; closed tokens cannot resurrect the producer',async()=>{
    const {a,b,one,start,f,adapter}=await setup();const first=await a.store.start(one.context,start);await a.store.synchronize(f.registry.siteId,'edge-1');
    await pool.query("UPDATE arbi_live_viewers SET record=jsonb_set(record,'{expiresAtMs}',to_jsonb($2::bigint)) WHERE id=$1",[first.id,Date.now()-1]);
    const state=await b.store.action(one.context,'state',{sessionId:first.id});assert.equal(state.endReason,'timeout');assert.equal(state.token,null);
    await b.store.synchronize(f.registry.siteId,'edge-1');assert.equal((adapter as SimulatedLiveAdapter).status.producers.length,0);
    await assert.rejects(a.store.signal(one.context,{sessionId:first.id,token:first.token,sequence:1,message:{type:'offer',data:'late'}}),{code:'EXPIRED'});
    const next=await a.store.start(one.context,{...start,key:'next'});await a.store.action(one.context,'end',{sessionId:next.id});
    await b.store.synchronize(f.registry.siteId,'edge-1');assert.equal((adapter as SimulatedLiveAdapter).status.producers.length,0);
    await assert.rejects(pool.query("UPDATE arbi_live_viewers SET ended_at_ms=NULL,record=jsonb_set(record,'{endedAtMs}','null') WHERE id=$1",[next.id]),{code:'42501'});
  });
  await t.test('budget denial has a durable reason and cannot create a token or demand; renewal revokes optional media',async()=>{
    const {a,one,start,deny,f,adapter}=await setup();const first=await a.store.start(one.context,start);deny();
    const renewed=await a.store.action(one.context,'renew',{sessionId:first.id,token:first.token});assert.equal(renewed.endReason,'revoked');assert.equal(renewed.policy.reason,'budget-exhausted');assert.equal(renewed.token,null);
    const denied=await a.store.start(one.context,{...start,key:'denied'});assert.equal(denied.endReason,'policy-denied');assert.equal(denied.token,null);
    await a.store.synchronize(f.registry.siteId,'edge-1');assert.equal((adapter as SimulatedLiveAdapter).status.producers.length,0);
    assert.ok((await pool.query("SELECT id FROM arbi_audit_events WHERE site_id=$1 AND record->>'action'='live.grant' AND record->>'outcome'='deny'",[f.registry.siteId])).rows.length);
  });
  await t.test('SQL audit failure rolls back admission and has no external producer effect',async()=>{
    const {a,one,start,f,adapter}=await setup();await pool.query('ALTER TABLE arbi_audit_outbox ADD CONSTRAINT live_injected_failure CHECK(false) NOT VALID');
    try{await assert.rejects(a.store.start(one.context,start),{code:'UNAVAILABLE'});assert.equal((await pool.query('SELECT count(*)::int n FROM arbi_live_viewers WHERE site_id=$1',[f.registry.siteId])).rows[0].n,0);
      assert.equal((await pool.query('SELECT count(*)::int n FROM arbi_live_producers WHERE site_id=$1',[f.registry.siteId])).rows[0].n,0);assert.equal((adapter as SimulatedLiveAdapter).status.producers.length,0);
    }finally{await pool.query('ALTER TABLE arbi_audit_outbox DROP CONSTRAINT live_injected_failure');}
  });
  await t.test('human revocation during policy evaluation cannot admit a grant or renew existing authority',async()=>{
    for(const renewal of [false,true]){
      const {a,one,start,f,options}=await setup(),first=renewal?await a.store.start(one.context,start):null;
      const racing=createLiveServer({db:postgresDatabase(other),...options,evaluatePolicy:async()=>{
        f.identity.revoke(one.sessionId);return options.evaluatePolicy();
      }});
      await assert.rejects(first?racing.store.action(one.context,'renew',{sessionId:first.id,token:first.token}):racing.store.start(one.context,start),{code:'DENIED'});
      const rows=(await pool.query('SELECT record FROM arbi_live_viewers WHERE site_id=$1',[f.registry.siteId])).rows;
      assert.equal(rows.length,renewal?1:0);if(renewal)assert.equal(rows[0].record.epoch,1);
    }
  });
  await t.test('lost adapter acknowledgement retries one durable generation after another process restarts',async()=>{
    const simulated=new SimulatedLiveAdapter();t.after(()=>simulated.close());let fail=true;
    const adapter:LiveAdapter={apply:async(d,s)=>{const result=await simulated.apply(d,s);if(fail){fail=false;throw Error('ACK_LOST');}return result;},signal:(q,s)=>simulated.signal(q,s)};
    const {a,b,one,start,f}=await setup(adapter),first=await a.store.start(one.context,start);
    await assert.rejects(a.store.synchronize(f.registry.siteId,'edge-1'));assert.equal(simulated.status.producers.length,1);
    await b.store.synchronize(f.registry.siteId,'edge-1');assert.equal(simulated.status.producers.length,1);assert.equal((await b.store.start(one.context,start)).id,first.id);
    await b.store.signal(one.context,{sessionId:first.id,token:first.token,sequence:1,message:{type:'offer',data:'reconnect'}});
  });
  await t.test('authenticated HTTP denies cross-site, forged/session tokens, origin spoofing and current revocation',async()=>{
    const {a,b,one,two,start,f}=await setup(),siteId=f.registry.siteId;
    const request=(action:string,body:unknown,token=one.token,origin='https://synthetic.test')=>new Request(`https://synthetic.test/api/sites/${siteId}/live/${action}`,{method:'POST',headers:{authorization:`Bearer ${token}`,origin,'x-arbi-request':'1','content-type':'application/json'},body:JSON.stringify(body)});
    const started=await a.handle(request('start',start),{siteId,action:'start'});assert.equal(started.status,202);const view=await started.json();assert.equal(view.observedConnection,'unobserved');assert.equal(view.producer.state,'leased');
    assert.equal((await b.handle(request('state',{sessionId:view.id},two.token),{siteId,action:'state'})).status,403);
    assert.equal((await b.handle(request('start',start),{siteId:'foreign-site',action:'start'})).status,403);
    assert.equal((await b.handle(request('start',start,one.token,'https://untrusted.test'),{siteId,action:'start'})).status,403);
    assert.equal((await b.handle(request('signal',{sessionId:view.id,token:'forged',sequence:1,message:{type:'offer',data:'offer'}}),{siteId,action:'signal'})).status,403);
    f.identity.revoke(one.sessionId);assert.equal((await b.handle(request('state',{sessionId:view.id}),{siteId,action:'state'})).status,401);
  });
  await t.test('device boot/configuration change closes prior viewers and fences earlier producer demand',async()=>{
    const {a,one,start,f,sync,adapter}=await setup(),first=await a.store.start(one.context,start);await a.store.synchronize(f.registry.siteId,'edge-1');
    const previous=(await pool.query('SELECT record FROM arbi_live_producers WHERE id=$1',[first.producerId])).rows[0].record.demand;
    f.registry.devices[0].current!.bootId='new-boot';await sync();await a.store.synchronize(f.registry.siteId,'edge-1');
    assert.equal((await a.store.action(one.context,'state',{sessionId:first.id})).endReason,'source-restarted');
    await assert.rejects(adapter.apply(previous,new AbortController().signal),{code:'STALE_FENCE'});
    const next=await a.store.start(one.context,{...start,key:'new-boot'});assert.equal(next.producerId,first.producerId);assert.notEqual(next.id,first.id);
  });
  await t.test('signed connection observations retain grant actor and source clocks; lost end acknowledgements deduplicate after closure',async()=>{
    const {a,b,one,start,f,report}=await setup(),view=await a.store.start(one.context,start);await a.store.synchronize(f.registry.siteId,'edge-1');
    const generation=(await pool.query('SELECT record FROM arbi_live_producers WHERE id=$1',[view.producerId])).rows[0].record.demand.generation;
    const payload={sessionId:view.id,epoch:view.epoch,generation,eventId:randomUUID(),sequence:'1',kind:'connected',sourceTime:{utc:new Date().toISOString(),uncertaintyMs:10,monotonicMs:1000}};
    const posted=report(payload);assert.equal((await a.store.device(f.registry.siteId,posted)).decision,'recorded');assert.equal((await b.store.device(f.registry.siteId,report(payload))).decision,'duplicate');
    const state=await b.store.action(one.context,'state',{sessionId:view.id});assert.equal(state.observedConnection,'device-reported-connected');
    const event=(await pool.query('SELECT record FROM arbi_audit_events WHERE id=$1',[payload.eventId])).rows[0].record;assert.deepEqual(event.actor,one.context.actor);assert.deepEqual(event.sourceTime,payload.sourceTime);assert.equal(event.evidence,'media-observation');assert.equal(event.effect,'none');
    await assert.rejects(a.store.device(f.registry.siteId,{...posted,signature:'forged'}),{code:'DENIED'});
    await assert.rejects(a.store.device(f.registry.siteId,report({...payload,kind:'ended'})),{code:'CONFLICT'});
    const ended={...payload,eventId:randomUUID(),sequence:'2',kind:'ended'};await a.store.device(f.registry.siteId,report(ended));assert.equal((await b.store.device(f.registry.siteId,report(ended))).decision,'duplicate');
    assert.equal((await b.store.action(one.context,'state',{sessionId:view.id})).endReason,'ended');
    const browser=new Request(`https://synthetic.test/api/sites/${f.registry.siteId}/live/device`,{method:'POST',headers:{origin:'https://synthetic.test',authorization:`Bearer ${one.token}`},body:JSON.stringify(posted)});
    assert.equal((await a.handle(browser,{siteId:f.registry.siteId,action:'device'})).status,403);
  });
  await t.test('browser playing/ended claims remain advisory and never renew authority or establish device playback',async()=>{
    const {a,one,start}=await setup(),view=await a.store.start(one.context,start);
    const input={sessionId:view.id,token:view.token,sequence:1,state:'playing',sourceTime:{utc:null,uncertaintyMs:null,monotonicMs:1000}};
    const result=await a.store.advisory(one.context,input);assert.equal(result.affectsAdmission,false);
    const state=await a.store.action(one.context,'state',{sessionId:view.id});assert.equal(state.expiresAtMs,view.expiresAtMs);assert.equal(state.observedConnection,'unobserved');assert.equal(state.browserAdvisory?.state,'playing');
    await assert.rejects(a.store.advisory(one.context,{...input,sequence:2,state:'ended'}),{code:'CAPACITY'});
    const event=(await pool.query('SELECT record FROM arbi_audit_events WHERE id=$1',[result.eventId])).rows[0].record;assert.equal(event.evidence,'browser-observation');assert.equal(event.effect,'none');
  });
  await t.test('two viewers reference separate delivered intervals and one shared upstream without duplicating garden usage',async()=>{
    const {a,b,one,two,start,f,report,usage}=await setup(),first=await a.store.start(one.context,start),second=await b.store.start(two.context,start);
    await new Promise(resolve=>setTimeout(resolve,1200));const end=Date.now(),interval={start:new Date(end-1000).toISOString(),end:new Date(end).toISOString()},meter=new UsageStore(a.store.jobs);
    const observation=(boundary:UsageObservation['boundary'],viewerId:string|null,bytes:string):UsageObservation=>({version:'arbi-accounting/1.0',kind:'usage',observationId:randomUUID(),realm,siteId:f.registry.siteId,executionMode:'simulation',
      source:f.registry.devices[0].current!,counterEpoch:'media-counter',boundary,layer:'application-payload',direction:boundary==='garden-sim'?'upload':'download',linkId:viewerId?`viewer-${viewerId}`:'sim-shared',
      scope:'attributed',attributionRevision:'media-attribution',deviceId:'edge-1',category:boundary==='cloud-relay'?'turn':'live-video',interval,bytes,
      evidence:{quality:'measured',coverage:'complete',includes:['payload'],observedAt:interval.end,maxAgeMs:15000,reason:null},media:{topology:'shared',sessionId:first.producerId,viewerId,viewerCount:2}});
    const upstream=observation('garden-sim',null,'100'),down1=observation('cloud-viewer',first.id,'120'),down2=observation('cloud-viewer',second.id,'130'),relay=observation('cloud-relay',null,'20');
    const unknown={...observation('cloud-viewer',first.id,'0'),linkId:'unknown-viewer-counter',bytes:null,evidence:{quality:'unavailable' as const,coverage:'unknown' as const,includes:[],observedAt:null,maxAgeMs:15000,reason:'not-reported' as const}};
    await meter.ingest(f.registry.siteId,usage([upstream,down1,down2,relay,unknown].map((observation,n)=>({sequence:String(n+1),observation}))));
    const generation=(await pool.query('SELECT record FROM arbi_live_producers WHERE id=$1',[first.producerId])).rows[0].record.demand.generation;
    const payload=(view:typeof first,viewerUsageId:string,sequence:string,relayUsageId:string|null=null)=>({sessionId:view.id,epoch:view.epoch,generation,eventId:randomUUID(),sequence,kind:'delivery',
      sourceTime:{utc:interval.end,uncertaintyMs:10,monotonicMs:2000},summary:{viewerUsageId,upstreamUsageId:upstream.observationId,relayUsageId,startMonotonicMs:1000,endMonotonicMs:2000}});
    await assert.rejects(a.store.device(f.registry.siteId,report(payload(second,down1.observationId,'1'))),{code:'DENIED'});
    await assert.rejects(a.store.device(f.registry.siteId,report(payload(first,unknown.observationId,'1'))),{code:'DENIED'});
    const reported=payload(first,down1.observationId,'1',relay.observationId);await a.store.device(f.registry.siteId,report(reported));
    assert.equal((await b.store.device(f.registry.siteId,report(reported))).decision,'duplicate');await b.store.device(f.registry.siteId,report(payload(second,down2.observationId,'2')));
    assert.equal((await pool.query('SELECT count(*)::int n FROM arbi_usage_windows WHERE site_id=$1',[f.registry.siteId])).rows[0].n,5);
    const events=(await pool.query("SELECT record FROM arbi_audit_events WHERE site_id=$1 AND record->'metadata'->>'observation'='bytes-delivered'",[f.registry.siteId])).rows;
    assert.deepEqual(new Set(events.map(r=>r.record.actor.id)),new Set([one.context.actor.id,two.context.actor.id]));assert.equal(events.reduce((n,r)=>n+r.record.metadata.byteCount,0),250);
    const state=await a.store.action(one.context,'state',{sessionId:first.id});assert.equal(state.observedConnection,'unobserved');assert.equal(state.delivery?.upstreamUsageId,upstream.observationId);
    const engineer=await f.human('usage-reader','history.read'),totals=await meter.read(engineer.context,{linkId:'sim-shared',fromMs:end-1000,toMs:end});assert.equal(totals.totals[0].bytes,'100');
    await a.store.action(one.context,'end',{sessionId:first.id});await pool.query("UPDATE arbi_live_viewers SET record=jsonb_set(record,'{expiresAtMs}',to_jsonb($2::bigint)) WHERE id=$1",[second.id,Date.now()-1]);
    const closed=await b.store.action(two.context,'state',{sessionId:second.id});assert.equal(closed.endReason,'timeout');assert.equal(closed.closure?.deliveryCoverage,'partial');assert.equal(closed.closure?.playbackDurationMs,null);assert.equal(closed.closure?.remoteStopObserved,false);
    await a.store.jobs.audit.verify(realm,f.registry.siteId);
  });
  await t.test('private frame hook rechecks permission after policy waits and independently closes an expired viewer',async()=>{
    const {a,one,two,start,f,options}=await setup(),first=await a.store.start(one.context,start),second=await a.store.start(two.context,start);
    const demand=(await pool.query('SELECT record FROM arbi_live_producers WHERE id=$1',[first.producerId])).rows[0].record.demand;
    const racing=createLiveServer({db:postgresDatabase(other),...options,evaluatePolicy:async()=>{f.identity.revoke(one.sessionId);return options.evaluatePolicy();}});
    const denied=await racing.store.inspectFrameRecipients(demand);assert.equal(denied.authorized,false);assert.equal(denied.recipients.length,0);assert.equal(denied.demand.viewers,1);
    const current=await a.store.inspectFrameRecipients(denied.demand);assert.equal(current.authorized,true);assert.deepEqual(current.recipients.map(v=>v.id),[second.id]);
    assert.equal(current.recipients[0].sessionId,two.sessionId);
    await pool.query("UPDATE arbi_live_viewers SET record=jsonb_set(record,'{expiresAtMs}',to_jsonb($2::bigint)) WHERE id=$1",[second.id,Date.now()-1]);
    const expired=await a.store.inspectFrameRecipients(denied.demand);assert.equal(expired.authorized,false);assert.equal(expired.recipients.length,0);assert.equal(expired.demand.viewers,0);
    assert.equal((await a.store.action(two.context,'state',{sessionId:second.id})).endReason,'timeout');await a.store.jobs.audit.verify(realm,f.registry.siteId);
  });
  await t.test('actual native producer and TCP viewer payloads retain independent grants and one measured shared uplink',async()=>{
    let native:Awaited<ReturnType<typeof liveProducerReference>>;
    const adapter:LiveAdapter={apply:(...args)=>native.adapter.apply(...args),signal:(...args)=>native.adapter.signal(...args)};
    const {a,b,one,two,start,f,report,usage}=await setup(adapter);
    native=await liveProducerReference({realm,siteId:f.registry.siteId,source:f.registry.devices[0].current!,inspect:d=>a.store.inspectFrameRecipients(d),observeLoopback:true});t.after(()=>native.close());
    assert.equal(native.camera,0);assert.equal(native.encoded,0);const first=await a.store.start(one.context,start),second=await b.store.start(two.context,start);
    for(const [context,view] of [[one.context,first],[two.context,second]] as const)await a.store.signal(context,{sessionId:view.id,token:view.token,sequence:1,message:{type:'offer',data:'native-reference'}});
    const begin=Date.now(),mono=Math.floor(performance.now());
    for(let n=0;n<6;n++){if(n)await new Promise(resolve=>setTimeout(resolve,230));assert.equal((await native.producer.step(new AbortController().signal)).state,'sent');}
    const stopMono=Math.floor(performance.now()),end=begin+stopMono-mono,interval={start:new Date(begin).toISOString(),end:new Date(end).toISOString()};assert.ok(Math.abs(Date.now()-end)<=10,'UTC/monotonic capture uncertainty');
    assert.equal(native.encoded,6);assert.equal(native.upstreamBytes,native.bytes.length*6);
    for(const view of [first,second]){assert.equal(native.viewers.get(view.id)!.bytes,native.upstreamBytes);assert.equal(native.viewers.get(view.id)!.frames,6);}
    assert.ok(native.upstreamWire>native.upstreamBytes);
    const link=native.measureLoopback();assert.equal(link.observations.length,2);assert.equal(link.comparison.knownPayloadBytes,String(native.upstreamBytes*3));assert.equal(link.comparison.carrierBytes,null);t.diagnostic(JSON.stringify({scenario:'native-shared-two-viewer',...link.comparison}));
    const meter=new UsageStore(a.store.jobs),observation=(viewerId:string|null,bytes:number):UsageObservation=>({version:'arbi-accounting/1.0',kind:'usage',observationId:randomUUID(),realm,siteId:f.registry.siteId,executionMode:'simulation',
      source:f.registry.devices[0].current!,counterEpoch:'native-payload-reference',boundary:viewerId?'cloud-viewer':'garden-sim',layer:'application-payload',direction:viewerId?'download':'upload',linkId:viewerId?'native-viewer-'+viewerId:'native-shared',
      scope:'attributed',attributionRevision:'native-media-attribution',deviceId:'edge-1',category:'live-video',interval,bytes:String(bytes),
      evidence:{quality:'measured',coverage:'complete',includes:['payload'],observedAt:interval.end,maxAgeMs:15000,reason:null},media:{topology:'shared',sessionId:first.producerId,viewerId,viewerCount:2}});
    const up=observation(null,native.upstreamBytes),down1=observation(first.id,native.viewers.get(first.id)!.bytes),down2=observation(second.id,native.viewers.get(second.id)!.bytes);
    await meter.ingest(f.registry.siteId,usage([up,down1,down2,...link.observations].map((observation,n)=>({sequence:String(n+1),observation}))));
    const demand=(await pool.query('SELECT record FROM arbi_live_producers WHERE id=$1',[first.producerId])).rows[0].record.demand;
    const grants=await a.store.inspectFrameRecipients(demand);assert.deepEqual(new Set(grants.recipients.map(v=>v.actor.id)),new Set([one.context.actor.id,two.context.actor.id]));
    for(const [view,down,seq] of [[first,down1,'1'],[second,down2,'2']] as const)await a.store.device(f.registry.siteId,report({sessionId:view.id,epoch:view.epoch,generation:demand.generation,eventId:randomUUID(),sequence:seq,kind:'delivery',
      sourceTime:{utc:interval.end,uncertaintyMs:10,monotonicMs:stopMono},summary:{viewerUsageId:down.observationId,upstreamUsageId:up.observationId,relayUsageId:null,startMonotonicMs:mono,endMonotonicMs:stopMono}}));
    const reader=await f.human('native-usage-reader','history.read'),totals=await meter.read(reader.context,{linkId:'native-shared',fromMs:begin,toMs:end});assert.equal(totals.totals[0].bytes,String(native.upstreamBytes));
    const observedLink=await meter.read(reader.context,{linkId:'native-live-loopback',fromMs:Date.parse(link.observations[0].interval.start),toMs:Date.parse(link.observations[0].interval.end)});assert.ok(observedLink.totals.some(v=>v.layer==='interface-wan'&&v.boundary==='lan'));
    // Revoke one original session. The stale generation delivers no further
    // viewer payload, then explicit current-demand delivery serves the other.
    const previous=native.viewers.get(first.id)!.bytes;f.identity.revoke(one.sessionId);
    await new Promise(resolve=>setTimeout(resolve,230));assert.equal((await native.producer.step(new AbortController().signal)).state,'stopped');assert.equal(native.viewers.get(first.id)!.bytes,previous);
    await b.store.synchronize(f.registry.siteId,'edge-1');await new Promise(resolve=>setTimeout(resolve,230));assert.equal((await native.producer.step(new AbortController().signal)).state,'sent');
    assert.equal(native.viewers.get(first.id)!.bytes,previous);assert.ok(native.viewers.get(second.id)!.bytes>previous);
    assert.equal((await pool.query('SELECT record FROM arbi_live_viewers WHERE id=$1',[first.id])).rows[0].record.endReason,'revoked');
    await b.store.action(two.context,'end',{sessionId:second.id});await b.store.synchronize(f.registry.siteId,'edge-1');assert.equal(native.camera,0);
    const last=native.encoded;assert.equal((await native.producer.step(new AbortController().signal)).state,'stopped');assert.equal(native.encoded,last);
    await a.store.jobs.audit.verify(realm,f.registry.siteId);
  });
  await t.test('replacement media service uses its own audit clock epoch without changing the initiating actor',async()=>{
    const {a,b,one,start,f}=await setup(),viewer=await a.store.start(one.context,start);
    await b.store.action(one.context,'end',{sessionId:viewer.id});
    const ended=(await pool.query("SELECT record FROM arbi_audit_events WHERE site_id=$1 AND record->>'action'='live.end'",[f.registry.siteId])).rows[0].record;
    const original=(await pool.query('SELECT record FROM arbi_live_viewers WHERE id=$1',[viewer.id])).rows[0].record.intent;
    assert.deepEqual(ended.source,b.store.jobs.source);assert.notDeepEqual(ended.source,original.source);
    assert.deepEqual(ended.actor,original.actor);assert.equal(ended.links.intentEventId,original.eventId);
    const bad=(await pool.query(`WITH numbered AS (
      SELECT sequence,row_number() OVER(PARTITION BY stream ORDER BY sequence)::numeric AS expected
      FROM arbi_audit_events WHERE record->'source'->'identity'->>'deviceId'='job-service'
    ) SELECT * FROM numbered WHERE sequence<>expected`)).rows;assert.deepEqual(bad,[]);
    const gaps=(await pool.query(`SELECT d.detail FROM arbi_audit_events e JOIN arbi_audit_evidence d ON d.event_id=e.id
      WHERE e.record->'source'->'identity'->>'deviceId'='job-service' AND (d.detail->'gaps'<>'[]'::jsonb OR d.detail->>'clockRegression'='true')`)).rows;
    assert.deepEqual(gaps,[]);
  });

});
