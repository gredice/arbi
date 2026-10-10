import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import type { Event, Sample, Telemetry } from '@arbi/protocol';
import type { SqlDatabase, SqlSession } from '../enrollment/store';
import { fixture as base, realm } from '../realtime/test-support';
import { createTelemetryServer } from './server';
import { TelemetryStore } from './store';
import { PostgresJobStore } from '../jobs/store';
import { TIERS, VERSION } from './contracts';
export { realm };
export async function migrations(sql:SqlSession) {
  for(const file of ['0001-enrollment','0002-media','0003-audit','0004-jobs','0005-realtime','0006-telemetry','0006-telemetry'])
    await sql.query(await readFile(new URL(`../../migrations/${file}.sql`,import.meta.url),'utf8'));
}
export async function setup(db:SqlDatabase,sql:SqlSession) {
  const f=await base();
  f.registry.devices[0].capabilities=[{metric:'power.voltage',qualities:['measured','commanded','estimated']}];
  f.registry.components=[{id:'edge-component',hardwareId:'synthetic-edge',hardwareRevision:'r1',assemblyId:'assembly-a',assemblyRevision:'r1',kind:'module',role:'edge',firmwareVersion:null,update:{kind:'unsupported',reason:'synthetic'}},
    {id:'passive-component',hardwareId:'synthetic-plate',hardwareRevision:'r1',assemblyId:'assembly-b',assemblyRevision:'r1',kind:'passive'}];
  f.registry.signals=[{id:'missing-tension',physicalComponentId:null,ownerComponentId:'edge-component',interfaceId:'synthetic-interface',metric:'line.tension.a',frame:{name:'none',revision:null},reading:{kind:'unavailable',reason:'sensor-not-installed'}}];
  const siteId=f.registry.siteId;
  await sql.query('INSERT INTO arbi_device_registry VALUES($1,$2,$3,$4::jsonb)',[realm.environment,realm.namespaceId,siteId,JSON.stringify(f.registry)]);
  const sync=()=>sql.query('UPDATE arbi_device_registry SET state=$1::jsonb WHERE environment=$2 AND namespace_id=$3 AND site_id=$4',[JSON.stringify(f.registry),realm.environment,realm.namespaceId,siteId]);
  const server=createTelemetryServer({db,realm,identity:f.identity.adapter,resolveSite:f.identity.resolveResource,currentAuthority:f.currentAuthority,browserOrigins:['https://synthetic.test']});
  const signed=(payload:unknown,action='ingest')=>{
    const unsigned=f.signed(action,payload,VERSION);
    const {signature:_,...value}=unsigned;
    // The telemetry config binding is part of the signed envelope.
    const request={...value,configRevision:f.registry.configRevision};
    return {...request,signature:requireSign(request,f.keys.privateKey)};
  };
  const ingest=(m:Event|Telemetry)=>server.store.device(siteId,signed(m));
  const sample=(sequence:number,quality:Sample['quality']='measured',value:number|null=24,metric:Sample['metric']='power.voltage'):Telemetry=>{
    const mono=1000+sequence;
    return {protocol:'arbi/1.0',messageId:randomUUID(),realm,siteId,source:structuredClone(f.registry.devices[0].current!),sequence:String(sequence),
      sourceTime:{utc:new Date().toISOString(),uncertaintyMs:10,monotonicMs:mono},ingestTime:null,kind:'telemetry',executionMode:'simulation',
      body:{type:'telemetry.samples',capabilitiesRevision:'capabilities-1',samples:[{metric,quality,value,unit:metric==='power.voltage'?'V':'N',frame:{name:'none',revision:null},
        sampleMonotonicMs:quality==='unavailable'?null:mono,ageMs:quality==='unavailable'?null:0,uncertainty:quality==='unavailable'?null:0.1,
        reason:quality==='unavailable'?'sensor-not-installed':null,originQuality:null}]}};
  };
  const snapshot=(sequence=1):Event=>{
    const e=f.snapshot();e.sequence=String(sequence);e.sourceTime.monotonicMs=1000+sequence;
    if(e.body.type==='state.snapshot'){e.body.capabilities=f.registry.devices[0].capabilities;e.body.eventCursor.sequence=e.sequence;}
    return e;
  };
  const fault=(sequence=2,state:'raised'|'cleared'='raised',faultId='fault-1'):Event=>({...snapshot(sequence),body:{type:'fault.changed',faultId,state,severity:'stop',error:{code:'FAULT_INHIBITED',retryable:false}}});
  const human=await f.human('engineer','history.read');
  const context=async(capability:'state.read'|'diagnostics.read'|'history.read')=>f.identity.adapter.authorize(human.token,capability,{realm,siteId,accountId:f.registry.accountId,resource:{kind:'site',id:siteId},executionMode:'simulation'});
  const history=async(tier:string,extra:Record<string,unknown>={})=>server.store.read(await context(tier==='trace'?'diagnostics.read':'history.read'),'history',
    {tier,fromMs:Date.now()-TIERS[tier as keyof typeof TIERS].ageMs,toMs:Date.now()+1000,limit:100,...extra}) as Promise<any>;
  const current=async()=>server.store.read(await context('state.read'),'current',{}) as Promise<any>;
  return {...f,createHuman:f.human,siteId,server,sync,signed,ingest,sample,snapshot,fault,human,context,history,current};
}
import { sign } from 'node:crypto';
import type { KeyObject } from 'node:crypto';
import { proofBytes } from '../enrollment/crypto';
function requireSign(value:unknown,key:KeyObject){return sign(null,proofBytes(value),key).toString('base64url');}

export async function commonTests(t:TestContext,db:SqlDatabase,sql:SqlSession) {
  await t.test('boot/sequence identity, late messages, gaps and unavailable versus zero survive a new reader',async()=>{
    const f=await setup(db,sql);await f.ingest(f.snapshot());
    const zero=f.sample(10,'measured',0);await f.ingest(zero);
    const newest=f.sample(13);assert.deepEqual(await f.ingest(newest),{decision:'recorded',durable:true,gap:'2',reset:false});
    const late=f.sample(12,'measured',99);
    assert.deepEqual(await f.ingest(late),{decision:'late',durable:true});
    assert.deepEqual(await f.ingest(late),{decision:'late',durable:true});
    await assert.rejects(f.ingest({...late,messageId:'contradictory-late'}),{code:'CONFLICT'});
    const reordered={...late,source:{sessionId:late.source.sessionId,bootId:late.source.bootId,deviceId:late.source.deviceId}};
    assert.deepEqual(await f.ingest(reordered),{decision:'late',durable:true});
    assert.deepEqual(await f.ingest(newest),{decision:'duplicate',durable:true});
    await assert.rejects(f.ingest({...newest,messageId:randomUUID()}),{code:'CONFLICT'});
    await f.ingest(f.sample(14,'unavailable',null,'line.tension.a'));
    const head=(await f.current()).states.find((s:any)=>s.message.kind==='telemetry');
    assert.equal(head.message.sequence,'14');assert.equal(head.coverage.missingSequences,'2');
    assert.equal(head.readings.find((s:any)=>s.sample.metric==='line.tension.a').sample.value,null);
    assert.equal(head.readings.find((s:any)=>s.sample.metric==='line.tension.a').sample.quality,'unavailable');
    assert.equal(head.readings.find((s:any)=>s.sample.metric==='power.voltage').sample.value,24);
    const raw=await f.history('raw',{fromMs:Date.now()-60_000,toMs:Date.now()+1000});
    assert.equal(raw.items.length,4);assert.equal(raw.items.find((s:any)=>s.sample.value===0).sample.value,0);
    assert.equal(raw.items.find((s:any)=>s.sample.value===99).late,true);
    const buckets=await f.history('minute',{fromMs:Date.now()-60_000,toMs:Date.now()+1000});
    const volts=buckets.items.filter((s:any)=>s.metric==='power.voltage');assert.equal(volts.reduce((n:number,s:any)=>n+s.count,0),2);
    assert.equal(volts.reduce((n:number,s:any)=>n+s.sum,0),24);
    const unavailable=buckets.items.find((s:any)=>s.quality==='unavailable');assert.equal(unavailable.numericCount,0);assert.equal(unavailable.mean,null);
    const page:any=await f.server.store.read(await f.context('state.read'),'current',{limit:1});assert.ok(page.next);
    const tail:any=await f.server.store.read(await f.context('state.read'),'current',{limit:1,after:page.next});assert.equal(tail.next,null);
    const old=f.sample(15);f.registry.devices[0].retiredIdentities.push(f.registry.devices[0].current!);
    f.registry.devices[0].current={deviceId:'edge-1',bootId:'boot-2',sessionId:'link-2'};await f.sync();
    await assert.rejects(f.ingest(old),{code:'INVALID_REQUEST'});
    await f.ingest(f.snapshot(1));await f.ingest(f.sample(0));
    const reset=(await f.current()).states.find((s:any)=>s.message.kind==='telemetry');
    assert.equal(reset.reset,true);assert.equal(reset.coverage.resets,1);assert.equal(reset.message.sequence,'0');
    assert.equal(reset.readings.length,1);assert.equal(reset.coverage.startKnown,false);
    await f.ingest(f.sample(1));assert.equal((await f.current()).states.find((s:any)=>s.message.kind==='telemetry').coverage.resets,1);
  });
  await t.test('freshness ages partial updates independently, configuration and clock uncertainty remain explicit',async()=>{
    const f=await setup(db,sql);await f.ingest(f.snapshot());await f.ingest(f.sample(1));
    await sql.query(`UPDATE arbi_telemetry_heads SET record=jsonb_set(record,'{readings,0,receivedAtMs}',to_jsonb($1::bigint)) WHERE site_id=$2 AND stream='telemetry'`,[Date.now()-10000,f.siteId]);
    await f.ingest(f.sample(2,'unavailable',null,'line.tension.a'));
    const partial=(await f.current()).states.find((s:any)=>s.message.kind==='telemetry');
    assert.equal(partial.readings.find((r:any)=>r.sample.metric==='power.voltage').sample.quality,'stale');
    assert.equal(partial.readings.find((r:any)=>r.sample.metric==='line.tension.a').sample.quality,'unavailable');
    const stale=f.sample(3,'estimated',8);stale.sourceTime.utc=new Date(Date.now()-10_000).toISOString();await f.ingest(stale);
    let current=(await f.current()).states.find((s:any)=>s.message.kind==='telemetry');
    assert.equal(current.fresh,false);assert.equal(current.readings.find((r:any)=>r.sample.metric==='power.voltage').sample.quality,'stale');assert.equal(current.readings.find((r:any)=>r.sample.metric==='power.voltage').sample.originQuality,'estimated');
    const unknown=f.sample(4);unknown.sourceTime.utc=null;unknown.sourceTime.uncertaintyMs=null;await f.ingest(unknown);
    current=(await f.current()).states.find((s:any)=>s.message.kind==='telemetry');assert.equal(current.readings.find((r:any)=>r.sample.metric==='power.voltage').ageUpperBoundMs,null);assert.equal(current.readings.find((r:any)=>r.sample.metric==='power.voltage').fresh,false);
    const forged=f.sample(5);forged.body.capabilitiesRevision='different';await assert.rejects(f.ingest(forged),{code:'INVALID_REQUEST'});
    const regression=f.sample(5);regression.body.samples[0].sampleMonotonicMs=1001;regression.body.samples[0].ageMs=4;await assert.rejects(f.ingest(regression),{code:'INVALID_REQUEST'});
    f.registry.configRevision='config-2';f.registry.devices[0].appliedConfigRevision='config-2';await f.sync();
    current=(await f.current()).states.find((s:any)=>s.message.kind==='telemetry');assert.equal(current.currentIdentity,false);assert.equal(current.readings[0].fresh,false);
    await assert.rejects(f.ingest(f.sample(5)),{code:'DENIED'});await f.ingest(f.snapshot(2));await f.ingest(f.sample(5));
    assert.equal((await f.current()).states.find((s:any)=>s.message.kind==='telemetry').configRevision,'config-2');
    const capabilities=f.snapshot(3);if(capabilities.body.type==='state.snapshot') capabilities.body.capabilitiesRevision='capabilities-2';await f.ingest(capabilities);
    const incompatible=(await f.current()).states.find((s:any)=>s.message.kind==='telemetry');
    assert.equal(incompatible.capabilitiesCurrent,false);assert.equal(incompatible.readings[0].sample.quality,'stale');
    const upgraded=f.sample(6);upgraded.body.capabilitiesRevision='capabilities-2';await f.ingest(upgraded);
    assert.equal((await f.current()).states.find((s:any)=>s.message.kind==='telemetry').capabilitiesCurrent,true);
    const inventory:any=await f.server.store.read(await f.context('diagnostics.read'),'inventory',{limit:1});
    assert.equal(inventory.items.length,1);assert.equal(inventory.next,'edge-component');assert.equal(inventory.items[0].assemblyId,'assembly-a');
    assert.equal(inventory.items[0].signals[0].reading.reason,'sensor-not-installed');assert.equal(inventory.items[0].signals[0].unit,'N');
    assert.equal(JSON.stringify(inventory).includes('publicKey'),false);
    const next:any=await f.server.store.read(await f.context('diagnostics.read'),'inventory',{limit:1,after:inventory.next});assert.equal(next.items[0].id,'passive-component');
    f.registry.devices[0].status='revoked';await f.sync();await assert.rejects(f.ingest(f.sample(6)),{code:'DENIED'});
  });
  await t.test('event detail, searchable faults and trace attachments are bounded and cannot mutate current samples',async()=>{
    const f=await setup(db,sql);await f.ingest(f.snapshot());const raised=f.fault(3);await f.ingest(raised);await f.ingest(f.fault(4,'cleared'));
    const events=await f.history('event',{fromMs:Date.now()-60_000,toMs:Date.now()+1000,faultId:'fault-1',severity:'stop'});
    assert.equal(events.items.length,2);assert.equal(events.items[1].gap,'1');assert.equal(events.items[0].message.body.state,'cleared');
    assert.equal((await f.current()).states.find((s:any)=>s.message.kind==='event').faults[0].body.state,'cleared');
    const delayed=f.fault(2,'raised','late-fault');await f.ingest(delayed);await f.ingest(delayed);
    assert.equal((await f.current()).states.find((s:any)=>s.message.kind==='event').message.sequence,'4');
    assert.equal((await f.history('event',{fromMs:Date.now()-60000,toMs:Date.now()+1000,faultId:'late-fault'})).items[0].late,true);
    await assert.rejects(f.ingest({...raised,sequence:'5'}),{code:'CONFLICT'});
    const trace={traceId:'trace-1',eventId:raised.messageId,messages:[f.sample(100),f.sample(101)]};
    await f.server.store.device(f.siteId,f.signed(trace,'trace'));
    assert.deepEqual(await f.server.store.device(f.siteId,f.signed(trace,'trace')),{decision:'duplicate',durable:true});
    const traces=await f.history('trace',{fromMs:Date.now()-60_000,toMs:Date.now()+1000,traceId:'trace-1'});
    assert.equal(traces.items[0].messages.length,2);assert.equal(traces.items[0].eventId,raised.messageId);
    assert.equal((await f.current()).states.some((s:any)=>s.message.kind==='telemetry'),false);
    await assert.rejects(f.server.store.device(f.siteId,f.signed({...trace,messages:[f.sample(1),f.sample(20000)]},'trace')),{code:'CAPACITY'});
    await assert.rejects(f.server.store.device(f.siteId,f.signed({...trace,traceId:'trace-2',eventId:'missing'},'trace')),{code:'DENIED'});
  });
  await t.test('keyset pages bind the exact filter/realm and exclude later admissions; query and site rate budgets are enforced',async()=>{
    const f=await setup(db,sql);await f.ingest(f.snapshot());for(let n=1;n<=3;n++)await f.ingest(f.sample(n));
    const q={fromMs:Date.now()-60_000,toMs:Date.now()+1000,limit:1};
    const first=await f.history('raw',q);assert.equal(first.items.length,1);assert.ok(first.next);
    await f.ingest(f.sample(4));const second=await f.history('raw',{...q,cursor:first.next});assert.notEqual(second.items[0].id,first.items[0].id);
    const third=await f.history('raw',{...q,cursor:second.next});assert.equal(third.next,null);
    await assert.rejects(f.history('raw',{...q,cursor:first.next,metric:'power.voltage'}),{code:'INVALID_REQUEST'});
    for(const extra of [{limit:101},{fromMs:0},{offset:1},{cursor:'invalid'},{toMs:q.fromMs},{metric:'secret-sql'}])
      await assert.rejects(f.history('raw',{...q,...extra}),{code:'INVALID_REQUEST'});
    const c=await f.context('state.read');f.identity.revoke(f.human.sessionId);await assert.rejects(f.server.store.read(c,'current',{}),{code:'DENIED'});
    const limited=await setup(db,sql);await limited.ingest(limited.snapshot());
    await sql.query("INSERT INTO arbi_telemetry_budgets VALUES($1,$2,$3,'read',$4,120)",[realm.environment,realm.namespaceId,limited.siteId,Math.floor(Date.now()/60_000)*60_000]);
    await assert.rejects(limited.current(),{code:'CAPACITY'});
    await sql.query("UPDATE arbi_telemetry_budgets SET attempts=600 WHERE site_id=$1 AND kind='ingest'",[limited.siteId]);
    await assert.rejects(limited.ingest(limited.sample(1)),{code:'CAPACITY'});
  });
  await t.test('retention boundaries and all five row caps are enforced while aggregate buckets outlive raw samples',async()=>{
    const f=await setup(db,sql);await f.ingest(f.snapshot());await f.ingest(f.sample(1));
    const now=Date.now()+1000;
    for(const [tier,policy] of Object.entries(TIERS)) {
      await sql.query(`INSERT INTO arbi_telemetry_history(environment,namespace_id,site_id,tier,key,device_id,config_revision,at_ms,received_at_ms,fingerprint,record,stream_key)
        SELECT $1,$2,$3,$4,'cap-'||n,'edge-1','config-1',$5,$5,'synthetic','{}'::jsonb,'synthetic-'||n FROM generate_series(1,$6) n`,
      [realm.environment,realm.namespaceId,f.siteId,tier,now,policy.rows+2]);
      await sql.query(`INSERT INTO arbi_telemetry_history(environment,namespace_id,site_id,tier,key,device_id,config_revision,at_ms,received_at_ms,fingerprint,record,stream_key)
        VALUES($1,$2,$3,$4,'expired','edge-1','config-1',$5,$6,'synthetic','{}','expired'),($1,$2,$3,$4,'inside','edge-1','config-1',$7,$6,'synthetic','{}','inside')`,
      [realm.environment,realm.namespaceId,f.siteId,tier,now-policy.ageMs-1,now,now-policy.ageMs]);
    }
    // Freeze only the trusted clock read; storage, cutoff predicates and pruning still execute in PostgreSQL.
    const frozen:SqlDatabase={transaction:work=>db.transaction(sql=>work({
      async query<T extends Record<string,unknown>>(query:string,params?:unknown[]) {
        if(query.includes('floor(extract(epoch FROM clock_timestamp())')) return {rows:[{now:String(now)}] as unknown as T[]};
        return sql.query<T>(query,params);
      },
    }))};
    await new TelemetryStore(new PostgresJobStore(frozen,realm,f.currentAuthority)).maintain(f.siteId);
    for(const [tier,policy] of Object.entries(TIERS)) {
      const rows=(await sql.query<{count:string}>("SELECT count(*)::text AS count FROM arbi_telemetry_history WHERE site_id=$1 AND tier=$2",[f.siteId,tier])).rows;
      assert.equal(Number(rows[0].count),policy.rows);
      assert.equal((await sql.query("SELECT id FROM arbi_telemetry_history WHERE site_id=$1 AND tier=$2 AND key='expired'",[f.siteId,tier])).rows.length,0);
      assert.equal((await sql.query("SELECT id FROM arbi_telemetry_history WHERE site_id=$1 AND tier=$2 AND key='inside'",[f.siteId,tier])).rows.length,1);
    }
    const idle=await setup(db,sql);await idle.ingest(idle.snapshot());await idle.ingest(idle.sample(1));
    await sql.query("UPDATE arbi_telemetry_history SET at_ms=$1 WHERE site_id=$2 AND tier='raw'",[Date.now()-TIERS.raw.ageMs-1,idle.siteId]);
    assert.equal((await idle.history('raw',{fromMs:Date.now()-60_000,toMs:Date.now()+1000})).items.length,0);
    assert.equal((await idle.history('minute',{fromMs:Date.now()-60_000,toMs:Date.now()+1000})).items.length,1);
    await idle.ingest(idle.sample(2));assert.equal((await sql.query("SELECT id FROM arbi_telemetry_history WHERE site_id=$1 AND tier='raw'",[idle.siteId])).rows.length,1);
  });
}
