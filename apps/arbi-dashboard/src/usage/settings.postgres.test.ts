import assert from 'node:assert/strict';
import { realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import test from 'node:test';
import pg from 'pg';
import { digest } from '@arbi/audit';
import { postgresDatabase } from '../enrollment/store';
import { createUsageServer } from './server';
import { migrations, setup, realm } from './test-support';
import type { UsageSettings } from './settings-contracts';

const socket=process.env.ARBI_ENROLLMENT_TEST_SOCKET;
test('native PostgreSQL persisted usage settings, late threshold alerts, restart, delivery and authorization',{skip:!socket,timeout:45000},async t=>{
  const root=realpathSync(socket!);assert.ok(root.startsWith(`${realpathSync(process.platform==='darwin'?'/private/tmp':tmpdir())}/arbi-enrollment-pg-`));
  const config={host:root,user:'arbi_test',port:54321,database:'arbi_usage_settings_test',max:4};
  const admin=new pg.Pool({...config,database:'postgres',max:1});await admin.query('CREATE DATABASE arbi_usage_settings_test');await admin.end();
  const pool=new pg.Pool(config),other=new pg.Pool({...config,max:1});t.after(async()=>{await other.end();await pool.end();});
  const db=postgresDatabase(pool);await migrations(pool);
  for(let n=0;n<2;n++)await pool.query(await readFile(new URL('../../migrations/0009-usage-settings.sql',import.meta.url),'utf8'));
  const f=await setup(db,pool);f.identity.putResource('audit-export',f.siteId,f.siteId);
  const settings:UsageSettings={revision:'z-first',plan:{...f.plan,rollover:{policy:'none',cap:null}},rules:[
    {id:'quota-80',kind:'threshold',layer:'interface-wan',thresholdBasisPoints:8000,coverage:'allow-partial',destinationIds:['inbox']},
    {id:'quota-100',kind:'threshold',layer:'interface-wan',thresholdBasisPoints:10000,coverage:'allow-partial',destinationIds:['inbox']},
    {id:'unknown-meter',kind:'metering',layer:'interface-wan',condition:'unknown',destinationIds:['inbox']}],
    destinations:[{id:'inbox',kind:'operator-inbox'}],forecast:{method:'constant-average',layer:'interface-wan',lookbackHours:24},carryForward:null,transferMode:'low-data'};
  const read=await f.context(),write=await f.context('configuration.write'),q={linkId:'sim-1',atMs:Date.parse('2026-01-15T00:00:00.000Z')};
  const restarted=createUsageServer({db:postgresDatabase(other),realm,identity:f.identity.adapter,resolveSite:f.identity.resolveResource,currentAuthority:f.currentAuthority,browserOrigins:['https://synthetic.test']});
  await t.test('settings require configuration permission, persist immutable revision and audited edits',async()=>{
    await assert.rejects(f.server.settings.settings(read,settings,true),{code:'DENIED'});
    const saved=await f.server.settings.settings(write,settings,true);assert.ok(saved.auditId);assert.deepEqual(await restarted.settings.settings(write,settings,true),saved);
    await assert.rejects(f.server.settings.settings(write,{...settings,transferMode:'essential-only'},true),{code:'CONFLICT'});
    const found=await restarted.settings.settings(read,{linkId:'sim-1'});assert.equal(found.settings?.revision,'z-first');
    const root=(await pool.query('SELECT record FROM arbi_audit_events WHERE id=$1',[saved.auditId])).rows[0].record;assert.equal(root.actor.id,'engineer');assert.equal(root.metadata.permission,'configure');
  });
  await t.test('missing meters stay unknown; late arrivals cross each rule once across concurrent readers and restart',async()=>{
    const empty=await f.server.settings.report(read,q);assert.equal(empty.report.layers[1].bytes,null);assert.equal(empty.report.layers[1].remainingBytes,null);assert.deepEqual(empty.newAlerts.map(a=>a.ruleId),['unknown-meter']);
    await f.ingest(f.observation({bytes:'900'}));
    const results=await Promise.all([f.server.settings.report(read,q),restarted.settings.report(read,q)]);
    assert.equal(results.reduce((n,r)=>n+r.newAlerts.length,0),1);assert.equal(results.find(r=>r.newAlerts.length)!.newAlerts[0].ruleId,'quota-80');
    assert.equal((await restarted.settings.report(read,q)).newAlerts.length,0);
    await f.ingest(f.observation({bytes:'200',interval:{start:'2026-01-02T00:00:00.000Z',end:'2026-01-03T00:00:00.000Z'},evidence:{...f.observation().evidence,observedAt:'2026-01-03T00:00:00.000Z'}}),'2');
    const late=await restarted.settings.report(read,q);assert.equal(late.report.layers[1].bytes,'1100');assert.deepEqual(late.newAlerts.map(a=>a.ruleId),['quota-100']);assert.equal(late.report.forecast.projectedCycleBytes,null);assert.equal(late.report.carrierBillingTruth,false);
    const updated={...settings,revision:'a-later',transferMode:'essential-only' as const};await f.server.settings.settings(write,updated,true);
    assert.equal((await restarted.settings.report(read,q)).newAlerts.length,0);assert.equal((await restarted.settings.settings(read,{linkId:'sim-1'})).settings?.revision,'a-later');
  });
  await t.test('billing-cycle boundary resets alert keys while previous-cycle history remains',async()=>{
    await f.ingest(f.observation({bytes:'900',interval:{start:'2026-02-01T00:00:00.000Z',end:'2026-02-02T00:00:00.000Z'},evidence:{...f.observation().evidence,observedAt:'2026-02-02T00:00:00.000Z'}}),'3');
    const feb=await restarted.settings.report(read,{...q,atMs:Date.parse('2026-02-15T00:00:00.000Z')});assert.deepEqual(new Set(feb.newAlerts.map(a=>a.ruleId)),new Set(['quota-80','unknown-meter']));
    const alerts=await f.server.settings.alerts(read,{linkId:'sim-1',fromMs:Date.parse('2025-12-31T23:00:00.000Z'),toMs:Date.parse('2026-02-02T00:00:00.000Z')});assert.equal(alerts.alerts.length,5);
  });
  await t.test('lost external acknowledgement retries the same deduplication key; receipt survives another process',async()=>{
    const seen=new Set<string>();let lost=true;
    await assert.rejects(f.server.settings.deliver(f.siteId,async(_a,_d,key)=>{seen.add(key);if(lost){lost=false;throw Error('synthetic lost acknowledgement');}return true;}));
    await restarted.settings.deliver(f.siteId,async(_a,_d,key)=>{seen.add(key);return true;});assert.equal(seen.size,5);
    assert.deepEqual(await f.server.settings.deliver(f.siteId,async()=>{throw Error('unexpected replay');}),{attempted:0,delivered:0});
  });
  await t.test('SQL failures roll back edits and authorization intent atomically',async()=>{
    const count=(await pool.query('SELECT count(*) n FROM arbi_audit_events')).rows[0].n;
    await pool.query('ALTER TABLE arbi_usage_settings ADD CONSTRAINT injected_failure CHECK(false) NOT VALID');
    await assert.rejects(f.server.settings.settings(write,{...settings,revision:'will-rollback'},true),{code:'UNAVAILABLE'});
    assert.equal((await pool.query('SELECT count(*) n FROM arbi_audit_events')).rows[0].n,count);
    await pool.query('ALTER TABLE arbi_usage_settings DROP CONSTRAINT injected_failure');
    assert.equal((await restarted.settings.settings(read,{linkId:'sim-1'})).settings?.revision,'a-later');
  });
  await t.test('HTTP report/export are separately authorized, bounded, redacted and current-session checked',async()=>{
    const request=(action:string,token=f.human.token,body:unknown=q)=>new Request(`https://synthetic.test/api/sites/${f.siteId}/usage/${action}`,{method:'POST',headers:{authorization:`Bearer ${token}`,origin:'https://synthetic.test','x-arbi-request':'1','content-type':'application/json'},body:JSON.stringify(body)});
    assert.equal((await f.server.handle(request('report'),{siteId:f.siteId,action:'report'})).status,200);
    const response=await f.server.handle(request('export'),{siteId:f.siteId,action:'export'});assert.equal(response.status,200);assert.match(response.headers.get('content-disposition')!,/attachment/);
    const payload=await response.json(),{integrity,...data}=payload;assert.equal(integrity.digest,digest(data));assert.equal(payload.version,'arbi.usage-report/1.0');assert.equal(payload.alertEvaluation,'not-run-on-export');assert.ok(!JSON.stringify(payload).includes(f.human.token));
    f.identity.putPrincipal({actor:{kind:'human',id:'viewer'},accountId:f.registry.accountId,member:true,sites:{[f.siteId]:{roles:['viewer'],serviceScopes:[],active:true,revision:'membership-2'}}});
    const viewer=await f.identity.issue({kind:'human',id:'viewer'});
    assert.equal((await f.server.handle(request('export',viewer.token),{siteId:f.siteId,action:'export'})).status,403);
    assert.equal((await f.server.handle(request('report'),{siteId:'another-site',action:'report'})).status,403);
    assert.equal((await f.server.handle(request('report',f.human.token,{...q,siteId:'another-site'}),{siteId:f.siteId,action:'report'})).status,400);
    f.identity.revoke(f.human.sessionId);await assert.rejects(restarted.settings.report(read,q),{code:'DENIED'});
    for(const table of ['arbi_usage_settings','arbi_usage_alerts','arbi_usage_alert_deliveries'])await assert.rejects(pool.query(`DELETE FROM ${table}`),{code:'42501'});
  });
});
