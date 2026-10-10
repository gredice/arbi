import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { TestContext } from 'node:test';
import type { SqlDatabase, SqlSession } from '../enrollment/store';
import type { UsageObservation, MobilePlan } from '@arbi/protocol';
import { cycleAllowance } from '@arbi/protocol';
import { fixture, realm } from '../realtime/test-support';
import { createUsageServer } from './server';
import { VERSION } from './contracts';
import { periodReport, rollup } from './rollup';
export { realm };
export async function migrations(sql:SqlSession) {
  for(const file of ['0001-enrollment','0002-media','0003-audit','0004-jobs','0007-usage','0007-usage'])
    await sql.query(await readFile(new URL(`../../migrations/${file}.sql`,import.meta.url),'utf8'));
}
export async function setup(db:SqlDatabase,sql:SqlSession) {
  const f=await fixture(),siteId=f.registry.siteId;
  await sql.query('INSERT INTO arbi_device_registry VALUES($1,$2,$3,$4::jsonb)',[realm.environment,realm.namespaceId,siteId,JSON.stringify(f.registry)]);
  const server=createUsageServer({db,realm,identity:f.identity.adapter,resolveSite:f.identity.resolveResource,currentAuthority:f.currentAuthority,browserOrigins:['https://synthetic.test']});
  const observation=(overrides:Partial<UsageObservation>={}):UsageObservation=>({version:'arbi-accounting/1.0',kind:'usage',observationId:randomUUID(),realm,siteId,
    executionMode:'simulation',source:f.registry.devices[0].current!,counterEpoch:'epoch-1',boundary:'garden-sim',layer:'interface-wan',direction:'upload',linkId:'sim-1',
    scope:'boundary-total',attributionRevision:null,deviceId:null,category:null,interval:{start:'2026-01-01T00:00:00.000Z',end:'2026-01-02T00:00:00.000Z'},bytes:'100',media:null,
    evidence:{quality:'measured',coverage:'complete',includes:['payload','retries','transport-overhead','non-arbi'],observedAt:'2026-01-02T00:00:00.000Z',maxAgeMs:1000,reason:null},...overrides});
  const ingest=(o:UsageObservation,sequence='1')=>server.store.ingest(siteId,f.signed('ingest',[{sequence,observation:o}],VERSION));
  const human=await f.human('engineer','history.read');
  const context=async(capability:'history.read'|'configuration.write'='history.read')=>f.identity.adapter.authorize(human.token,capability,{realm,siteId,accountId:f.registry.accountId,resource:{kind:'site',id:siteId},executionMode:'simulation'});
  const query={linkId:'sim-1',fromMs:Date.parse('2026-01-01T00:00:00.000Z'),toMs:Date.parse('2026-01-03T00:00:00.000Z')};
  const read=async(input=query)=>server.store.read(await context(),input);
  const plan:MobilePlan={version:'arbi-accounting/1.0',kind:'mobile-plan',planId:'plan-1',realm,siteId,linkId:'sim-1',allowance:{value:'1000',unit:'bytes'},
    cycle:{frequency:'monthly',timezone:'Europe/Zagreb',anchorDay:1,anchorHour:0,anchorMinute:0,shortMonth:'clamp-last-day',dstFold:'earlier',dstGap:'reject'},
    chargedDirections:'upload',reset:'each-cycle',rollover:{policy:'capped-one-cycle',cap:{value:'200',unit:'bytes'}},tariff:null};
  return {...f,server,siteId,observation,ingest,context,query,read,plan,human};
}
export async function commonTests(t:TestContext,db:SqlDatabase,sql:SqlSession,native=true) {
  await t.test('duplicate identity, overlapping windows and changed sequence conflict without inflating totals',async()=>{
    const f=await setup(db,sql),o=f.observation();
    assert.equal((await f.ingest(o)).results[0].decision,'recorded');assert.equal((await f.ingest(o)).results[0].decision,'duplicate');
    await assert.rejects(f.ingest({...o,bytes:'999'}),{code:'CONFLICT'});
    await assert.rejects(f.ingest({...o,observationId:randomUUID()},'2'),{code:'CONFLICT'});
    const reboot={...o,observationId:randomUUID(),counterEpoch:'reset-epoch'};
    await assert.rejects(f.ingest(reboot,'1'),{code:'CONFLICT'});
    const result=await f.read();assert.equal(result.totals[0].bytes,'100');assert.equal(result.source.length,1);assert.equal(result.carrierBillingTruth,false);
    assert.equal(result.totals[0].gaps.length,1);assert.equal(result.totals[0].coverage,'partial');
    const invalid=f.observation({observationId:'batch-new',direction:'download'});
    await assert.rejects(f.server.store.ingest(f.siteId,
      f.signed('ingest',[{sequence:'2',observation:invalid},{sequence:'1',observation:{...o,bytes:'101'}}],VERSION)),{code:'CONFLICT'});
    assert.equal((await f.read()).source.length,1);
  });
  await t.test('late windows go to their own day; resets and >53-bit bytes stay exact; unavailable is not zero',async()=>{
    const f=await setup(db,sql),later=f.observation({interval:{start:'2026-01-02T00:00:00.000Z',end:'2026-01-03T00:00:00.000Z'},bytes:'9007199254740993',
      evidence:{...f.observation().evidence,observedAt:'2026-01-03T00:00:00.000Z'}});
    await f.ingest(later,'5');await f.ingest(f.observation(),'1');
    const report=await f.read();assert.equal(report.totals[0].bytes,'9007199254741093');assert.equal(report.totals[0].coverage,'complete');
    assert.deepEqual(report.days.map(d=>d.totals[0].bytes),['100','9007199254740993']);assert.equal(report.sequenceGaps[0].from,'2');assert.equal(report.sequenceGaps[0].to,'4');
    const missing=f.observation({direction:'download',bytes:null,evidence:{quality:'unavailable',coverage:'unknown',includes:[],observedAt:null,maxAgeMs:1000,reason:'counter-reset'}});
    await f.ingest(missing);assert.equal((await f.read()).totals.find(r=>r.direction==='download')!.bytes,null);
    const zero=f.observation({direction:'download',counterEpoch:'epoch-2',bytes:'0',interval:later.interval,evidence:later.evidence});await f.ingest(zero);
    assert.equal((await f.read()).totals.find(r=>r.direction==='download')!.coverage,'partial');
  });
  await t.test('layers, category partitions and shared viewer topology remain separate; residuals expose disagreement',async()=>{
    const f=await setup(db,sql),total=f.observation();await f.ingest(total);
    await f.ingest(f.observation({layer:'provider',bytes:'130'}));await f.ingest(f.observation({layer:'application-payload',bytes:'60'}));
    const part=f.observation({scope:'attributed',attributionRevision:'classifier-1',deviceId:'edge-1',category:'telemetry',bytes:'70'});await f.ingest(part);
    await f.ingest(f.observation({scope:'attributed',attributionRevision:'classifier-1',deviceId:'edge-1',category:'unknown',bytes:'10'}));
    const result=await f.read();assert.equal(result.comparisons.find(r=>r.layer==='interface-wan')!.byRevision[0].unattributedBytes,'20');
    assert.equal(result.comparisons.find(r=>r.layer==='provider')!.bytes,'130');
    const media=f.observation({boundary:'cloud-viewer',layer:'application-payload',scope:'attributed',attributionRevision:'classifier-1',deviceId:'edge-1',category:'live-video',bytes:'50',
      media:{topology:'shared',sessionId:'view-1',viewerId:'viewer-1',viewerCount:5}});await f.ingest(media);
    assert.equal((await f.read()).totals.find(r=>r.boundary==='cloud-viewer')!.bytes,'50');
  });
  await t.test('DST/cycle boundaries conserve allocated bytes and disclose estimates; capped rollover has unknown and known states',async()=>{
    const f=await setup(db,sql),o=f.observation({interval:{start:'2026-03-31T21:00:00.000Z',end:'2026-03-31T23:00:00.000Z'},bytes:'101',
      evidence:{...f.observation().evidence,observedAt:'2026-03-31T23:00:00.000Z'}});await f.ingest(o);
    const march=periodReport(f.plan,Date.parse('2026-03-15T00:00:00.000Z'),[o],Date.parse('2026-04-03T00:00:00.000Z'),'900');
    const april=periodReport(f.plan,Date.parse('2026-04-01T00:00:00.000Z'),[o],Date.parse('2026-05-02T00:00:00.000Z'),'900');
    assert.equal(march.period.start,'2026-02-28T23:00:00.000Z');assert.equal(march.period.end,'2026-03-31T22:00:00.000Z');
    assert.equal(march.totals[0].bytes,'50');assert.equal(april.totals[0].bytes,'51');assert.equal(march.totals[0].quality,'estimated');
    assert.equal(march.allowanceBytes,'1200');assert.deepEqual(cycleAllowance(f.plan,null),{ok:true,value:null});
    assert.equal(rollup([o],Date.parse(o.interval.start),Date.parse(o.interval.end),Date.parse(o.interval.end))[0].quality,'measured');
    const result=await f.server.store.period(await f.context(),{plan:f.plan,atMs:Date.parse('2026-03-15T00:00:00.000Z'),previousUnusedBaseBytes:'900'});
    assert.equal(result.totals[0].bytes,'50');assert.equal(result.layers.find(r=>r.layer==='provider')!.bytes,null);
  });
  await t.test('signed ingestion and current authority deny wrong sites, stale credentials, forged proof and viewer corrections', {skip:!native},async()=>{
    const f=await setup(db,sql),o=f.observation();await assert.rejects(f.ingest({...o,siteId:'wrong-site'}),{code:'DENIED'});
    const request=f.signed('ingest',[{sequence:'1',observation:o}],VERSION);
    await assert.rejects(f.server.store.ingest(f.siteId,{...request,signature:'a'.repeat(86)}),{code:'DENIED'});
    await assert.rejects(f.server.store.ingest(f.siteId,{...request,version:'unsupported'}),{code:'INVALID_REQUEST'});
    const req=new Request(`https://synthetic.test/api/sites/${f.siteId}/usage/device`,{method:'POST',headers:{origin:'https://synthetic.test','content-type':'application/json'},body:JSON.stringify(request)});
    assert.equal((await f.server.handle(req,{siteId:f.siteId,action:'device'})).status,403);
    const read=new Request(`https://synthetic.test/api/sites/${f.siteId}/usage/history?linkId=sim-1&fromMs=${f.query.fromMs}&toMs=${f.query.toMs}`,{headers:{authorization:`Bearer ${f.human.token}`}});
    assert.equal((await f.server.handle(read,{siteId:f.siteId,action:'history'})).status,200);
    assert.equal((await f.server.handle(new Request(read.url+'&linkId=sim-1',{headers:read.headers}),{siteId:f.siteId,action:'history'})).status,400);
    await assert.rejects(f.server.store.correct(await f.context(),{key:'correction',observationId:o.observationId,reasonId:'bad-counter'}),{code:'DENIED'});
    const stale=await f.context();f.identity.revoke(f.human.sessionId);await assert.rejects(f.server.store.read(stale,f.query),{code:'DENIED'});
  });
  await t.test('corrections append audit and preserve raw evidence; retry is idempotent and replacement comes from authenticated collector', {skip:!native},async()=>{
    const f=await setup(db,sql),o=f.observation();await f.ingest(o);
    const c=await f.context('configuration.write'),input={key:'correct-1',observationId:o.observationId,reasonId:'wrong-counter'};
    const result=await f.server.store.correct(c,input);assert.deepEqual(await f.server.store.correct(c,input),result);
    const report=await f.read();assert.equal(report.source.length,0);assert.equal(report.corrections[0].observation.bytes,'100');assert.equal(report.corrections[0].auditId,result.auditId);
    assert.equal((await sql.query('SELECT record FROM arbi_usage_windows WHERE site_id=$1',[f.siteId])).rows.length,1);
    assert.ok((await sql.query('SELECT id FROM arbi_audit_events WHERE id=$1',[result.auditId])).rows.length);
    await assert.rejects(f.server.store.correct(c,{...input,reasonId:'different'}),{code:'CONFLICT'});
    const replacement=f.observation({bytes:'80'});await f.ingest(replacement,'2');assert.equal((await f.read()).totals[0].bytes,'80');
    await assert.rejects(sql.query('UPDATE arbi_usage_windows SET fingerprint=$1 WHERE site_id=$2',['forged',f.siteId]));
    await assert.rejects(sql.query('DELETE FROM arbi_usage_corrections WHERE site_id=$1',[f.siteId]));
  });
  await t.test('row/range/site-rate limits fail explicitly and credentials never enter reports',async()=>{
    const f=await setup(db,sql);await f.ingest(f.observation());
    await assert.rejects(f.read({...f.query,toMs:f.query.fromMs+36*86400000}),{code:'INVALID_REQUEST'});
    await assert.rejects(f.read({...f.query,sql:'injection'} as never),{code:'INVALID_REQUEST'});
    assert.equal(JSON.stringify(await f.read()).includes('publicKey'),false);
    await sql.query("UPDATE arbi_usage_budgets SET attempts=60 WHERE site_id=$1 AND kind='read'",[f.siteId]);await assert.rejects(f.read(),{code:'CAPACITY'});
  });
}
