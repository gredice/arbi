import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { test } from "node:test";
import pg from "pg";
import { digest } from "@arbi/audit";
import type { UsageSettings } from "../usage/settings-contracts";
import { dashboardRequest, SESSION_COOKIE } from "./runtime";
import { postgresDatabase } from "../enrollment/store";
import { provisionDashboardTest } from "./provision-test";
import { createDashboardTestProvider } from "./test-provider";
const socket = process.env.ARBI_ENROLLMENT_TEST_SOCKET;
test("native PostgreSQL dashboard: independent instances share current directory, sessions, revocation and durable audit", { skip: !socket, timeout: 30000 }, async t => {
  const root = realpathSync(socket!); assert.ok(root.startsWith(`${realpathSync(process.platform === "darwin" ? "/private/tmp" : tmpdir())}/arbi-enrollment-pg-`));
  const admin = new pg.Pool({ host: root, user: "arbi_test", port: 54321, database: "postgres", max: 1 });
  await admin.query("CREATE DATABASE arbi_dashboard_test"); await admin.end();
  const pool = new pg.Pool({ host: root, user: "arbi_test", port: 54321, database: "arbi_dashboard_test", max: 4 });
  const other = new pg.Pool({ host: root, user: "arbi_test", port: 54321, database: "arbi_dashboard_test", max: 2 });
  t.after(async () => { await pool.end(); await other.end(); });
  const realm = { environment: "test" as const, namespaceId: "synthetic-dashboard" };
  await provisionDashboardTest(postgresDatabase(pool), realm, {history:true});
  const config = { realm, verificationKey: randomBytes(32), accessCode: "s".repeat(48), viewerCode: "v".repeat(48), browserOrigins: ["http://localhost:3000"] };
  const a = createDashboardTestProvider({ ...config, db: postgresDatabase(pool) });
  const b = createDashboardTestProvider({ ...config, db: postgresDatabase(other) });
  const token = (await a.login(config.accessCode))!;
  const request = new Request("http://localhost:3000/", { headers: { authorization: `Bearer ${token}` } });
  const response = await b.server.handle(request, "synthetic-site"); assert.equal(response.status, 200);
  const context = await response.json(); assert.equal(context.identity.actorId, "synthetic-engineer");
  const viewer = (await a.login(config.viewerCode))!;
  const tool = (provider: typeof a, feature: string, action: string, input?: unknown, credential = token, site = 'synthetic-site', origin = 'http://localhost:3000') => {
    const post = input !== undefined;
    const req = new Request(`http://localhost:3000/api/sites/${site}/dashboard-tools/${feature}/${action}`, {
      method: post ? 'POST' : 'GET', headers: { cookie: `${SESSION_COOKIE}=${credential}`, ...(post ? { origin, 'x-arbi-request':'1', 'content-type':'application/json' } : {}) },
      ...(post ? { body: JSON.stringify(input) } : {}),
    });
    return provider.historyTools.handle(dashboardRequest(req),site,feature,action.split('?')[0]);
  };
  const now=Date.now(),settings:UsageSettings={revision:'fixture-policy-1',plan:{version:'arbi-accounting/1.0',kind:'mobile-plan',planId:'fixture-plan',realm,siteId:'synthetic-site',linkId:'sim-1',
    allowance:{value:'12000',unit:'bytes'},cycle:{frequency:'monthly',timezone:'UTC',anchorDay:1,anchorHour:0,anchorMinute:0,shortMonth:'clamp-last-day',dstFold:'earlier',dstGap:'reject'},
    chargedDirections:'both',reset:'each-cycle',rollover:{policy:'none',cap:null},tariff:null},rules:[{id:'wan-unknown',kind:'metering',layer:'interface-wan',condition:'unknown',destinationIds:['inbox']}],
    destinations:[{id:'inbox',kind:'operator-inbox'}],forecast:{method:'disabled',layer:'interface-wan',lookbackHours:24},carryForward:null,transferMode:'low-data'};
  await t.test('cookie BFF preserves audited policy body, distinct accounting layers and shared-session attribution across instances',async()=>{
    assert.equal((await tool(a,'usage','settings?linkId=sim-1',undefined,viewer)).status,200);
    assert.equal((await tool(a,'usage','settings',settings,viewer)).status,403);
    assert.equal((await tool(a,'usage','settings',settings,token,'synthetic-site','https://untrusted.example')).status,403);
    assert.equal((await tool(a,'usage','settings',{...settings,actorId:'spoofed'})).status,400);
    const savedResponse=await tool(a,'usage','settings',settings);assert.equal(savedResponse.status,200);
    const saved=await savedResponse.json();assert.equal(saved.settings.revision,settings.revision);assert.ok(saved.auditId);
    assert.equal((await (await tool(b,'usage','settings?linkId=sim-1')).json()).settings.revision,settings.revision);
    const response=await tool(b,'usage','report',{linkId:'sim-1',atMs:now});assert.equal(response.status,200);
    const body=await response.json();assert.equal(body.report.configuredTransferMode,'low-data');assert.equal(body.report.edgePolicyApplication,'not-observed');
    const layers=Object.fromEntries(body.report.layers.map((r:{layer:string})=>[r.layer,r]));assert.equal(layers['application-payload'].bytes,'5000');
    assert.equal(layers['interface-wan'].bytes,null);assert.equal(layers['interface-wan'].remainingBytes,null);assert.equal(layers.provider.bytes,null);
    assert.equal(body.report.forecast.projectedCycleBytes,null);assert.equal(body.report.carrierBillingTruth,false);
    assert.equal(body.report.sessionAttribution.length,1);assert.equal(body.report.sessionAttribution[0].bytes,'1500');assert.equal(body.report.sessionAttribution[0].media.viewerCount,5);
    assert.deepEqual(new Set(body.report.sourceRefs.filter((r:{observationId:string})=>r.observationId.startsWith('fixture-wan-')).map((r:{counterEpoch:string})=>r.counterEpoch)),new Set(['counter-reset-1','counter-reset-2']));
    const history=await (await tool(b,'usage',`history?linkId=sim-1&fromMs=${now-31*86400000}&toMs=${now}`)).json();
    assert.equal(history.totals.find((r:{layer:string;direction:string})=>r.layer==='interface-wan'&&r.direction==='upload').bytes,'7500');
    assert.equal(history.totals.find((r:{category:string})=>r.category==='live-video').bytes,'1500');
    assert.equal((await tool(a,'usage','export',{linkId:'sim-1',atMs:now},viewer)).status,403);
    const exported=await (await tool(b,'usage','export',{linkId:'sim-1',atMs:now})).json(),{integrity,...data}=exported;
    assert.equal(integrity.digest,digest(data));assert.ok(!JSON.stringify(exported).includes(token));
    const intent=(await pool.query('SELECT record FROM arbi_audit_events WHERE id=$1',[saved.auditId])).rows[0].record;
    assert.equal(intent.actor.id,'synthetic-engineer');assert.equal(intent.metadata.permission,'configure');
    for(const [feature,action] of [['usage','device'],['usage','correct'],['audit','retire'],['audit','hold']])assert.equal((await tool(a,feature,action,{})).status,404);
  });
  await t.test('audit BFF freezes bounded pages and redacted exports, distinguishes observations from policy end, and rechecks current authority',async()=>{
    const q={fromMs:now-86400000,toMs:now+86400000,limit:2,sessionId:'fixture-shared-view',actorId:'synthetic-engineer'};
    const search=(provider:typeof a,query:Record<string,string|number>,credential=token,site='synthetic-site')=>tool(provider,'audit',`search?${new URLSearchParams(Object.entries(query).map(([k,v])=>[k,String(v)]))}`,undefined,credential,site);
    assert.equal((await search(a,q,viewer)).status,403);assert.equal((await search(a,q,token,'unknown-site')).status,403);
    assert.equal((await tool(a,'audit','export',q,viewer)).status,403);
    const firstResponse=await search(a,q);assert.equal(firstResponse.status,200);const first=await firstResponse.json();assert.equal(first.events.length,2);assert.ok(first.nextCursor);
    const next=await (await search(b,{...q,cursor:first.nextCursor})).json();assert.equal(next.snapshot.upper,first.snapshot.upper);assert.ok(!next.events.some((e:{id:string})=>first.events.some((f:{id:string})=>f.id===e.id)));
    assert.equal((await search(b,{...q,sessionId:'different',cursor:first.nextCursor})).status,400);
    const response=await tool(b,'audit','export',{...q,cursor:first.snapshot.cursor});assert.equal(response.status,200);
    const payload=await response.json(),{integrity,schema:_,redaction:__,...data}=payload;assert.equal(integrity.digest,digest(data));assert.equal(payload.events.length,7);
    assert.ok(payload.events.some((e:{metadata?:{observation?:string}})=>e.metadata?.observation==='connection-established'));
    assert.ok(payload.events.some((e:{metadata?:{observation?:string}})=>e.metadata?.observation==='bytes-delivered'));
    assert.ok(payload.events.some((e:{evidence:string;reason:string})=>e.evidence==='service-outcome'&&e.reason==='timeout'));
    assert.ok(payload.events.every((e:{sourceTime:{utc:null};actor:{id:string}})=>e.sourceTime.utc===null&&e.actor.id!=='synthetic-engineer'));
    assert.doesNotMatch(JSON.stringify(payload),/Bearer|privateKey|credentialId|arbi_dashboard_session/);
    await pool.query("UPDATE arbi_dashboard_memberships SET roles='[\"viewer\"]'::jsonb WHERE actor_id='synthetic-engineer'");
    assert.equal((await tool(b,'audit','export',{...q,cursor:first.snapshot.cursor})).status,403);
    assert.equal((await tool(b,'usage','settings',{...settings,revision:'revoked-policy'})).status,403);
    await pool.query("UPDATE arbi_dashboard_memberships SET roles='[\"engineer\"]'::jsonb WHERE actor_id='synthetic-engineer'");
  });
  const before = Number((await pool.query("SELECT COUNT(*) FROM arbi_audit_history")).rows[0].count);
  await pool.query("UPDATE arbi_dashboard_memberships SET active=false,revision='membership-2' WHERE actor_id='synthetic-engineer'");
  assert.equal((await b.server.handle(request, "synthetic-site")).status, 403);
  await pool.query("UPDATE arbi_dashboard_memberships SET active=true WHERE actor_id='synthetic-engineer'");
  await a.revoke(token); assert.equal((await b.server.handle(request, "synthetic-site")).status, 401);
  assert.ok(Number((await pool.query("SELECT COUNT(*) FROM arbi_audit_history")).rows[0].count) > before);
});
