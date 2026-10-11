import {test,expect,type Page} from '@playwright/test';
import {readFileSync,writeFileSync,renameSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import type {FaultMode,ProtocolFact} from '../scripts/protocol-proxy';
const origin=process.env.ARBI_DASHBOARD_ORIGIN!,site='synthetic-controls',control=`/api/sites/${site}/dashboard-control`,telemetry=`/api/sites/${site}/dashboard-telemetry`;
function fault(mode:FaultMode,untilMs:number|null=null){const path=process.env.ARBI_PLAYGROUND_FAULT_PATH!,temporary=`${path}.next`;
  writeFileSync(temporary,JSON.stringify({version:'arbi.playground-fault/1.0',revision:randomUUID(),mode,untilMs}),{mode:0o600});renameSync(temporary,path);}
function facts():ProtocolFact[]{return JSON.parse(readFileSync(process.env.ARBI_PLAYGROUND_TRACE_PATH!,'utf8')).facts;}
async function login(page:Page,operator=true){await page.goto('/');await page.getByLabel('Test access code').fill(process.env[operator?'ARBI_DASHBOARD_TEST_OPERATOR_CODE':'ARBI_DASHBOARD_TEST_ACCESS_CODE']!);
  await page.getByRole('button',{name:'Open test dashboard'}).click();await expect(page.getByRole('heading',{name:'Overview',exact:true})).toBeVisible();}
async function read(page:Page,path:string){let response;for(let attempt=0;attempt<8;attempt++){response=await page.request.get(path);if(response.status()!==429)break;await page.waitForTimeout(150);}
  expect(response!.status()).toBe(200);return response!.json();}
async function current(page:Page){return read(page,`${telemetry}/current?deviceId=edge&limit=2`);}
async function job(page:Page,id:string){return read(page,`${control}/status?jobId=${id}`);}
async function submitHome(page:Page){const code=page.locator('.control-playground code'),previous=await code.count()?await code.innerText():null;
  await page.getByRole('button',{name:'Return to simulated home'}).click();await expect(code).toBeVisible();if(previous)await expect(code).not.toHaveText(previous);
  return {id:await code.innerText()};}
async function enter(page:Page){await expect.poll(async()=>{const value=await(await page.request.get(`${control}/controls`)).json();return !value.lease||value.lease.owned||value.lease.expiresAtMs<=Date.now();},{timeout:6000}).toBe(true);
  await page.goto(`/sites/${site}/user/controls`);await page.getByRole('button',{name:'Read observed control state'}).click();
  await expect(page.getByRole('button',{name:'Enter simulated manual control'})).toBeEnabled();await page.getByRole('button',{name:'Enter simulated manual control'}).click();
  await expect(page.getByText('Manual control entered. This lease is never renewed automatically.')).toBeVisible();}
test.afterEach(()=>fault('normal'));
test.afterAll(()=>{writeFileSync('test-results/protocol-integration-trace.json',readFileSync(process.env.ARBI_PLAYGROUND_TRACE_PATH!),{mode:0o600});});
test('actual signed controller telemetry feeds user and engineer views, preserves clocks and rejects cross-scope browser requests',async({page,request})=>{
  await login(page);await page.goto(`/sites/${site}/user/overview`);
  await expect(page.getByRole('status')).toContainText('User mode · connected · fresh');
  const context=await(await page.request.get(`/api/sites/${site}/dashboard/context`)).json(),wire=await current(page);
  const head=wire.states.find((s:any)=>s.message.kind==='telemetry');expect(context.state.telemetry.source).toEqual(head.message.source);
  expect(context.state.telemetry.source.deviceId).toBe('edge');expect(context.state.telemetry.sourceTime.utc).not.toBeNull();expect(context.state.telemetry.sourceTime.uncertaintyMs).toBe(10);
  expect(context.state.telemetry.sourceTime.monotonicMs).toBeLessThanOrEqual(head.message.sourceTime.monotonicMs);
  expect(context.state.observedAtMs).toBeLessThanOrEqual(head.receivedAtMs);expect(context.state.snapshot.ingestTime).not.toBeNull();
  expect(context.state.telemetry.body.samples.find((s:any)=>s.metric==='position.z').quality).toBe('estimated');
  await login(page,false);await page.goto(`/sites/${site}/engineering/diagnostics`);await expect(page.getByRole('status')).toContainText('Engineering mode');
  await expect(page.getByRole('row',{name:/position.z/})).toContainText('estimated');await expect(page.getByRole('row',{name:/line.tension.a/})).toContainText('Unavailable');
  expect((await request.get(`${origin}${telemetry}/current`)).status()).toBe(401);
  expect((await page.request.post(`${telemetry}/device`,{headers:{origin,'x-arbi-request':'1'},data:{}})).status()).toBe(403);
  expect((await page.request.get('/api/sites/production-installation/dashboard-telemetry/current')).status()).toBe(403);
  await login(page);
  expect((await page.request.post('/api/sites/production-installation/dashboard-control/submit',{headers:{origin,'x-arbi-request':'1'},data:{key:randomUUID(),deviceId:'edge',leaseId:null,fence:null,timeoutMs:1500,body:{type:'control.stop',reason:'operator'}}})).status()).toBe(403);
  expect((await page.request.post(`${control}/submit`,{headers:{origin,'x-arbi-request':'1'},data:{key:randomUUID(),deviceId:'edge',realm:{environment:'production',namespaceId:'installed'},body:{type:'control.stop',reason:'operator'}}})).status()).toBe(400);
  const trace=readFileSync(process.env.ARBI_PLAYGROUND_TRACE_PATH!,'utf8');expect(Buffer.byteLength(trace)).toBeLessThanOrEqual(65536);
  expect(trace).not.toMatch(/signature|privateKey|credentialId|Bearer|arbi_dashboard_session/);
});
test('protocol reordering records an older signed sample as late without replacing the current telemetry head',async({page})=>{
  await login(page);const started=Date.now();fault('reorder-telemetry');
  await expect.poll(()=>facts().filter(f=>f.atMs>=started&&f.effect==='reordered-after-newer').length,{timeout:6000}).toBe(1);
  const held=facts().find(f=>f.atMs>=started&&f.effect==='held-for-reorder')!;
  const reordered=facts().find(f=>f.atMs>=started&&f.effect==='reordered-after-newer')!;expect(reordered.status).toBe(200);expect(reordered.messageId).toBe(held.messageId);
  const head=(await current(page)).states.find((s:any)=>s.message.kind==='telemetry');expect(BigInt(head.message.sequence)).toBeGreaterThan(BigInt(held.sequence!));
  const db=new pg.Pool({connectionString:process.env.ARBI_DASHBOARD_TEST_DATABASE_URL,max:1});
  try{const late=await db.query("SELECT record FROM arbi_telemetry_history WHERE site_id=$1 AND tier='raw' AND record->'message'->>'messageId'=$2",[site,held.messageId]);
    expect(late.rows.length).toBeGreaterThan(0);expect(late.rows.every(r=>r.record.late===true)).toBe(true);
  }finally{await db.end();}
});
test('a lost device completion acknowledgement retries the identical report and reconnect cannot repeat completed work',async({page})=>{
  await login(page);await enter(page);const started=Date.now();fault('drop-outcome-ack');
  const original=await submitHome(page);await expect.poll(async()=>(await job(page,original.id)).deviceStatus).toBe('completed');
  await expect.poll(()=>facts().filter(f=>f.atMs>=started&&f.effect==='ack-lost'&&f.commandId===original.id).length).toBe(1);
  const lost=facts().find(f=>f.atMs>=started&&f.effect==='ack-lost'&&f.commandId===original.id)!;
  const dispatches=facts().filter(f=>f.effect==='dispatch'&&f.commandId===original.id);expect(dispatches.length).toBeGreaterThan(0);
  expect(new Set(dispatches.map(f=>f.operationId)).size).toBe(dispatches.length);
  await expect.poll(()=>facts().filter(f=>f.effect==='forwarded'&&f.feature==='control'&&f.messageId===lost.messageId).length).toBe(2);
  const db=new pg.Pool({connectionString:process.env.ARBI_DASHBOARD_TEST_DATABASE_URL,max:1});
  try{expect((await db.query('SELECT count(*)::int AS n FROM arbi_job_reports WHERE id=$1',[lost.messageId])).rows[0].n).toBe(1);
    expect((await db.query('SELECT count(*)::int AS n FROM arbi_command_jobs WHERE id=$1',[original.id])).rows[0].n).toBe(1);
  }finally{await db.end();}
  fault('disconnect',Date.now()+8000);await page.goto(`/sites/${site}/user/overview`);
  await page.waitForTimeout(5300);await page.getByRole('button',{name:'Refresh status'}).click();
  await expect(page.locator('.environment')).toContainText('offline · stale');await expect(page.getByText('stale (was estimated)').first()).toBeVisible();
  fault('normal');await expect.poll(async()=>{const v=await current(page);return v.states.every((s:any)=>s.fresh&&s.snapshotFresh);}).toBe(true);
  await page.getByRole('button',{name:'Refresh status'}).click();await expect(page.locator('.environment')).toContainText('connected · fresh');
  await page.goto(`/sites/${site}/user/controls`);await expect(page.getByRole('button',{name:'Jog +Z once'})).toBeDisabled();
  expect((await job(page,original.id)).deviceStatus).toBe('completed');
  expect(facts().filter(f=>f.feature==='control'&&f.action==='outcome'&&f.outcome==='completed'&&f.commandId===original.id&&f.messageId!==lost.messageId)).toEqual([]);
});
test('delaying a real command past its deadline cannot actuate or restart it after refresh',async({page})=>{
  await login(page);await enter(page);const started=Date.now();fault('delay-poll');
  const original=await submitHome(page);
  await expect.poll(()=>facts().filter(f=>f.atMs>=started&&f.effect==='poll-delayed-1750ms'&&f.jobIds?.includes(original.id)).length).toBe(1);
  await expect.poll(async()=>(await job(page,original.id)).cloudDisposition,{timeout:5000}).toBe('expired');
  const value=await job(page,original.id);expect(value.deviceStatus).not.toBe('completed');expect(value.terminal).toBeNull();
  await page.reload();await page.getByRole('button',{name:'Read observed control state'}).click();await expect(page.getByText(original.id,{exact:true})).toBeVisible();
  expect(facts().filter(f=>f.action==='outcome'&&f.commandId===original.id&&f.outcome==='completed')).toEqual([]);
  expect(facts().filter(f=>f.effect==='dispatch'&&f.commandId===original.id)).toEqual([]);
  await expect.poll(()=>facts().find(f=>f.effect==='admission-rejected'&&f.commandId===original.id)?.error).toBe('NOT_AUTHORIZED');
  const observed=await current(page);expect(observed.states.find((s:any)=>s.message.kind==='telemetry').readings.find((r:any)=>r.sample.metric==='position.z').sample.value).toBe(2490);
});
