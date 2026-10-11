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
import type {LivePolicy,LiveAdapter} from './contracts';
import {proofBytes} from '../enrollment/crypto';
const socket=process.env.ARBI_ENROLLMENT_TEST_SOCKET;
test('native PostgreSQL live authority: shared producer, scoped leases, policy, reconnect and atomic audit',{skip:!socket,timeout:15000},async t=>{
  const root=realpathSync(socket!);assert.ok(root.startsWith(`${realpathSync(tmpdir())}/arbi-enrollment-pg-`));
  const base={host:root,user:'arbi_test',port:54321,max:4},admin=new pg.Pool({...base,database:'postgres',max:1});await admin.query('CREATE DATABASE arbi_live_test');await admin.end();
  const pool=new pg.Pool({...base,database:'arbi_live_test'}),other=new pg.Pool({...base,database:'arbi_live_test'});t.after(async()=>{await other.end();await pool.end();});
  for(const file of ['0001-enrollment','0002-media','0003-audit','0004-jobs','0011-live','0011-live'])await pool.query(await readFile(new URL(`../../migrations/${file}.sql`,import.meta.url),'utf8'));
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
    return {f,a,b,one,two,start,adapter,options,sync,report,deny:()=>{decision={...decision,allow:false,reason:'budget-exhausted',remainingBytes:'0'};}};
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
});
