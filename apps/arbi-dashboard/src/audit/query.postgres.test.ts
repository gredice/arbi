import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import test from 'node:test';
import pg from 'pg';
import { digest } from '@arbi/audit';
import type { AuditEvent } from '@arbi/protocol';
import { postgresDatabase } from '../enrollment/store';
import { fixture, realm } from '../jobs/test-support';
import { PostgresAuditStore } from './store';
import { binding } from './test-support';
import { createAuditQueryServer } from './query-server';

const socket=process.env.ARBI_ENROLLMENT_TEST_SOCKET;
test('native PostgreSQL audit queries, bounded exports and privileged lifecycle receipts',{skip:!socket,timeout:45000},async t=>{
  const root=realpathSync(socket!);assert.ok(root.startsWith(`${realpathSync(process.platform==='darwin'?'/private/tmp':tmpdir())}/arbi-enrollment-pg-`));
  const config={host:root,user:'arbi_test',port:54321,database:'arbi_audit_query_test',max:4};
  const admin=new pg.Pool({...config,database:'postgres',max:1});await admin.query('CREATE DATABASE arbi_audit_query_test');await admin.end();
  const pool=new pg.Pool(config);t.after(()=>pool.end());
  for(const file of ['0001-enrollment','0002-media','0003-audit','0004-jobs','0008-audit-lifecycle','0008-audit-lifecycle'])
    await pool.query(await readFile(new URL(`../../migrations/${file}.sql`,import.meta.url),'utf8'));
  const db=postgresDatabase(pool),f=await fixture();
  f.identity.putResource('audit-export',f.registry.siteId,f.registry.siteId);
  await pool.query('INSERT INTO arbi_device_registry VALUES($1,$2,$3,$4)',[realm.environment,realm.namespaceId,f.registry.siteId,f.registry]);
  const key=randomBytes(32),base={db,realm,identity:f.identity.adapter,resolveSite:f.identity.resolveResource,currentAuthority:f.currentAuthority,browserOrigins:['https://synthetic.test'],queryKey:key};
  const server=createAuditQueryServer({...base,lifecycleDb:db,steward:async c=>c.actor.id==='steward'});
  const read=await f.human('reader','audit.read'),download=await f.human('reader','audit.export'),steward=await f.human('steward','configuration.write');
  const q={fromMs:Date.now()-31*86400000,toMs:Date.now()+600000,limit:2};q.fromMs=q.toMs-31*86400000;
  const stored:AuditEvent[]=[];
  async function seed(ageDays=0){
    const e=await server.store.jobs.transaction(f.registry.siteId,async tx=>server.store.jobs.event(tx,steward.context,'configuration.change',{kind:'configuration',id:randomUUID(),deviceId:'edge-1'}));
    e.metadata={permission:'configure',configRevision:'synthetic-config'};
    const a=new PostgresAuditStore(db,'synthetic-receiver',()=>Date.now()-ageDays*86400000);
    await db.transaction(async sql=>{await a.stage(sql,e,binding(e));});stored.push(e);return e;
  }
  await seed(2);await seed();await seed();
  const request=(action:string,token:string,body?:unknown,params=q)=>{
    const data=action==='export'?params:body;
    return new Request(`https://synthetic.test/api/sites/${f.registry.siteId}/audit/${action}${data?'':`?${new URLSearchParams(Object.entries(params).map(([k,v])=>[k,String(v)]))}`}`,
      {method:data?'POST':'GET',headers:{authorization:`Bearer ${token}`,...(data?{origin:'https://synthetic.test','x-arbi-request':'1','content-type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{})});
  };
  const call=(action:string,token:string,body?:unknown,params=q)=>server.handle(request(action,token,body,params),{siteId:f.registry.siteId,action});

  await t.test('stable site/session-bound pagination excludes later inserts and preserves legacy missing clocks',async()=>{
    const first=await server.store.search(read.context,q);assert.equal(first.events.length,2);assert.ok(first.nextCursor);
    const late=await seed();const second=await server.store.search(read.context,{...q,cursor:first.nextCursor});
    assert.equal(second.events.length,1);assert.equal(second.events[0].id,stored[2].eventId);assert.ok(!second.events.some(e=>e.id===late.eventId));
    await assert.rejects(server.store.search(read.context,{...q,deviceId:'other',cursor:first.nextCursor}),{code:'INVALID_REQUEST'});
    await assert.rejects(server.store.search(read.context,{...q,cursor:first.nextCursor!.slice(0,-1)+'x'}),{code:'INVALID_REQUEST'});
    const other=await f.human('other','audit.read');await assert.rejects(server.store.search(other.context,{...q,cursor:first.nextCursor}),{code:'INVALID_REQUEST'});
    const legacy={...stored[0],eventId:randomUUID(),ingestTime:null};
    legacy.links={...legacy.links,intentEventId:legacy.eventId};
    await pool.query('INSERT INTO arbi_device_audit VALUES($1,$2,$3,$4,$5)',[legacy.eventId,realm.environment,realm.namespaceId,f.registry.siteId,legacy]);
    const found=await server.store.search(read.context,{...q,limit:100});const event=found.events.find(e=>e.id===legacy.eventId)!;
    assert.equal('ingestTime' in event && event.ingestTime,null);assert.equal('chain' in event && event.chain,null);
  });
  await t.test('HTTP authorization, export digest and minimization, self-audit and current revocation',async()=>{
    const before=Number((await pool.query('SELECT count(*) n FROM arbi_audit_events')).rows[0].n);
    assert.equal((await call('search',read.token)).status,200);
    const exported=await call('export',download.token);assert.equal(exported.status,200);assert.match(exported.headers.get('content-disposition')!,/attachment/);
    const payload=await exported.json();const {schema:_,integrity,redaction:__,...content}=payload;assert.equal(integrity.digest,digest(content));
    assert.equal(payload.events[0].actor.id===steward.context.actor.id,false);assert.equal(payload.events[0].sourceTime.utc,null);
    assert.ok(!JSON.stringify(payload).includes(download.token));assert.match(payload.coverage.durableChain,/legacy/);
    assert.equal(Number((await pool.query('SELECT count(*) n FROM arbi_audit_events')).rows[0].n),before+2);
    assert.equal((await pool.query("SELECT count(*) n FROM arbi_audit_events WHERE record->'metadata'->>'permission'='export'")).rows[0].n,'1');
    const invalid=await server.handle(new Request(request('search',read.token).url+'&siteId=other',{headers:{authorization:`Bearer ${read.token}`}}),{siteId:f.registry.siteId,action:'search'});assert.equal(invalid.status,400);
    assert.equal((await server.handle(request('search',read.token),{siteId:'another-site',action:'search'})).status,403);
    assert.equal((await server.store.search(read.context,{...q,actorId:'nobody'})).events.length,0);
    const unauthorized=await f.human('ordinary','configuration.write');assert.equal((await call('policy',unauthorized.token,{class:'audit',revision:'denied',retainDays:1,identityMode:'pseudonymized',maxHoldDays:1})).status,403);
    f.identity.putPrincipal({actor:{kind:'human',id:'reader'},accountId:f.registry.accountId,member:false,sites:{}});
    await assert.rejects(server.store.search(read.context,q),{code:'DENIED'});
  });
  await t.test('finite policies, retention age, holds, release and explicit irreversible receipt',async()=>{
    const policy={class:'audit',revision:'audit-1',retainDays:1,identityMode:'pseudonymized',maxHoldDays:1};
    assert.equal((await call('policy',steward.token,policy)).status,200);await server.store.policy(steward.context,policy);
    await assert.rejects(server.store.policy(steward.context,{...policy,retainDays:2}),{code:'CONFLICT'});
    await assert.rejects(server.store.retire(steward.context,{origin:'durable',eventId:stored[1].eventId,reason:'retention-expired'}),{code:'DENIED'});
    const hold={id:'incident-1',class:'audit' as const,targetId:stored[0].eventId,expiresAtMs:Date.now()+3600000,reason:'incident' as const};
    await server.store.hold(steward.context,hold);
    await assert.rejects(server.store.retire(steward.context,{origin:'durable',eventId:stored[0].eventId,reason:'retention-expired'}),{code:'DENIED'});
    await server.store.hold(steward.context,hold,true);
    const retired=await server.store.retire(steward.context,{origin:'durable',eventId:stored[0].eventId,reason:'retention-expired'});
    assert.deepEqual(await server.store.retire(steward.context,{origin:'durable',eventId:stored[0].eventId,reason:'retention-expired'}),retired);
    assert.equal((await pool.query('SELECT record FROM arbi_audit_events WHERE id=$1',[stored[0].eventId])).rows[0].record,null);
    const fresh=await f.human('investigator','audit.read'),found=await server.store.search(fresh.context,{...q,limit:100});
    assert.equal(found.coverage.retiredPayloadsInWindow,1);assert.equal(found.events.find(e=>e.id===stored[0].eventId)!.retired,true);
    assert.equal((await server.store.jobs.audit.verify(realm,f.registry.siteId)).retiredPayloads,1);
    const receipt=await db.transaction(sql=>server.store.jobs.audit.stage(sql,stored[0],binding(stored[0])));assert.equal(receipt.eventId,stored[0].eventId);
    const history=(await pool.query('SELECT * FROM arbi_audit_retirements WHERE id=$1',[retired.receiptId])).rows[0];assert.ok(history.intent_id);assert.equal(history.policy_revision,'audit-1');assert.equal(history.reason,'retention-expired');
    const closed=createAuditQueryServer({...base,steward:async()=>true});await assert.rejects(closed.store.retire(steward.context,{origin:'durable',eventId:stored[1].eventId,reason:'operator-delete'}),{code:'UNAVAILABLE'});
  });
  await t.test('lifecycle and audit roll back together on an SQL failure or steward revocation',async()=>{
    const before=(await pool.query('SELECT count(*) n FROM arbi_audit_events')).rows[0].n;
    await pool.query('ALTER TABLE arbi_audit_retirements ADD CONSTRAINT injected_failure CHECK(false) NOT VALID');
    await assert.rejects(server.store.retire(steward.context,{origin:'durable',eventId:stored[1].eventId,reason:'operator-delete'}),{code:'UNAVAILABLE'});
    assert.equal((await pool.query('SELECT count(*) n FROM arbi_audit_events')).rows[0].n,before);
    assert.ok((await pool.query('SELECT record FROM arbi_audit_events WHERE id=$1',[stored[1].eventId])).rows[0].record);
    await pool.query('ALTER TABLE arbi_audit_retirements DROP CONSTRAINT injected_failure');
    let checks=0;const revoked=createAuditQueryServer({...base,lifecycleDb:db,steward:async()=>++checks===1});
    await assert.rejects(revoked.store.retire(steward.context,{origin:'durable',eventId:stored[1].eventId,reason:'operator-delete'}),{code:'DENIED'});
    assert.equal((await pool.query('SELECT count(*) n FROM arbi_audit_events')).rows[0].n,before);
  });
  await t.test('pending notification, active job and control lease block destructive retirement',async()=>{
    const operator=await f.human('operator');
    await server.store.jobs.device(f.registry.siteId,f.upload('snapshot',f.snapshot()));
    const job=await server.store.jobs.submit(operator.context,{key:'stop-test',deviceId:'edge-1',leaseId:null,fence:null,timeoutMs:2000,body:{type:'control.stop',reason:'operator'}});
    const input={origin:'durable' as const,eventId:job.intent.eventId,reason:'operator-delete' as const};
    await assert.rejects(server.store.retire(steward.context,input),{code:'DENIED'});
    await server.store.jobs.audit.deliver(realm,f.registry.siteId,async()=>{});
    await assert.rejects(server.store.retire(steward.context,input),{code:'DENIED'});
    await server.store.jobs.device(f.registry.siteId,f.upload('outcome',f.outcome(job.command)));
    assert.equal((await server.store.retire(steward.context,input)).retired,true);
    const lease=await server.store.jobs.lease(operator.context,'acquire',{key:'lease-test',deviceId:'edge-1',ttlMs:3000});
    await server.store.jobs.audit.deliver(realm,f.registry.siteId,async()=>{});
    await assert.rejects(server.store.retire(steward.context,{...input,eventId:lease.intent.eventId}),{code:'DENIED'});
    await server.store.jobs.lease(operator.context,'release',{key:'release-test',leaseId:lease.id,fence:lease.fence});
    assert.equal((await server.store.retire(steward.context,{...input,eventId:lease.intent.eventId})).retired,true);
  });
  await t.test('database owner guards, ordinary role cannot forge receipts or call retirement',async()=>{
    await pool.query('CREATE ROLE audit_query_app NOLOGIN; GRANT USAGE ON SCHEMA public TO audit_query_app; GRANT SELECT,INSERT,UPDATE ON arbi_audit_events TO audit_query_app; GRANT SELECT ON arbi_audit_retirements TO audit_query_app');
    const client=await pool.connect();try{
      await client.query('SET ROLE audit_query_app');
      for(const sql of ["UPDATE arbi_audit_events SET record=NULL WHERE record IS NOT NULL","DELETE FROM arbi_audit_events","TRUNCATE arbi_audit_events","SELECT arbi_retire_audit_payload('forged')","INSERT INTO arbi_audit_retirements SELECT * FROM arbi_audit_retirements"])
        await assert.rejects(client.query(sql),{code:'42501'});
    }finally{await client.query('RESET ROLE');client.release();}
    for(const table of ['arbi_audit_events','arbi_device_audit','arbi_media_audit','arbi_audit_query_index','arbi_audit_retirements'])
      await assert.rejects(pool.query(`DELETE FROM ${table}`),{code:'42501'});
  });
  await t.test('export capacity rejects an oversized result instead of silently truncating',async()=>{
    const template=stored[1];
    await pool.query(`WITH ids AS (SELECT gen_random_uuid() id FROM generate_series(1,1001))
      INSERT INTO arbi_device_audit SELECT id,$1,$2,$3,
        jsonb_set(jsonb_set($4::jsonb,'{eventId}',to_jsonb(id::text)),'{links,intentEventId}',to_jsonb(id::text)) FROM ids`,
      [realm.environment,realm.namespaceId,f.registry.siteId,JSON.stringify(template)]);
    const exporter=await f.human('capacity-reader','audit.export');
    await assert.rejects(server.store.search(exporter.context,q,true),{code:'CAPACITY'});
    const page=await server.store.search((await f.human('capacity-reader','audit.read')).context,{...q,limit:100});
    assert.equal(page.events.length,100);assert.ok(page.nextCursor);
  });
});
