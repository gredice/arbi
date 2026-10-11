import {test,expect,type Page} from '@playwright/test';
import pg from 'pg';
const origin=process.env.ARBI_DASHBOARD_ORIGIN!,site='synthetic-controls',path=`/api/sites/${site}/dashboard-control`;
async function login(page:Page,operator=true){await page.goto('/');await page.getByLabel('Test access code').fill(process.env[operator?'ARBI_DASHBOARD_TEST_OPERATOR_CODE':'ARBI_DASHBOARD_TEST_ACCESS_CODE']!);
  await page.getByRole('button',{name:'Open test dashboard'}).click();await expect(page.getByRole('heading',{name:'Overview',exact:true})).toBeVisible();
  await page.goto(`/sites/${site}/user/controls`);await expect(page.getByRole('heading',{name:'Control playground',exact:true})).toBeVisible();}
test('role and browser mode do not grant control, and unobserved/stale state disables actions',async({page})=>{
  await login(page,false);await expect(page.getByRole('button',{name:'Enter simulated manual control'})).toBeDisabled();
  await page.getByRole('button',{name:'Read observed control state'}).click();
  await expect(page.getByText('Observed state refreshed. Reading does not enter manual control.')).toBeVisible();
  await expect(page.getByText('Current role / live acceptance gate')).toBeVisible();
  expect((await page.request.post(`${path}/acquire`,{headers:{origin,'x-arbi-request':'1'},data:{key:crypto.randomUUID(),deviceId:'edge',ttlMs:4500}})).status()).toBe(403);
  await page.route('**/dashboard-control/controls',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({padding:'x'.repeat(65537)})}));
  await page.getByRole('button',{name:'Read observed control state'}).click();await expect(page.getByText('CAPACITY',{exact:true})).toBeVisible();await expect(page.getByText('Unavailable / stale',{exact:true})).toBeVisible();
  await page.unroute('**/dashboard-control/controls');
  await page.goto(`/sites/${site}/engineering/controls`);await expect(page.getByRole('button',{name:'Enter simulated manual control'})).toBeDisabled();
  expect((await page.request.post(`${path}/renew`,{headers:{origin,'x-arbi-request':'1'},data:{}})).status()).toBe(404);
  expect((await page.request.post(`${path}/device`,{headers:{origin,'x-arbi-request':'1'},data:{}})).status()).toBe(403);
});
test('two sessions, real edge journal outcomes, duplicate/lost acknowledgements, focus loss and refresh have bounded control behavior',async({page,browser})=>{
  test.setTimeout(45000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await login(page);
  const other=await browser.newContext(),second=await other.newPage();await login(second);
  await page.bringToFront();await page.getByRole('button',{name:'Read observed control state'}).click();
  await expect(page.getByRole('button',{name:'Enter simulated manual control'})).toBeEnabled();
  await page.waitForTimeout(3100);await expect(page.getByRole('button',{name:'Enter simulated manual control'})).toBeDisabled();
  await page.getByRole('button',{name:'Read observed control state'}).click();await page.getByRole('button',{name:'Enter simulated manual control'}).click();
  await expect(page.getByText('Manual control entered. This lease is never renewed automatically.')).toBeVisible();
  const secondState=await second.request.get(`${path}/controls`);expect(secondState.status()).toBe(200);const observed=await secondState.json();expect(observed.lease.owned).toBe(false);
  const denied=await second.request.post(`${path}/acquire`,{headers:{origin,'x-arbi-request':'1'},data:{key:crypto.randomUUID(),deviceId:'edge',ttlMs:4500}});expect(denied.status()).toBe(409);expect((await denied.json()).error).toBe('CONFLICT');
  // The request reaches the real server and edge, while its response is lost to this browser.
  let submitted:any;await page.route(`**/dashboard-control/submit`,async route=>{submitted=route.request().postDataJSON();await route.fetch();await route.abort('failed');});
  await page.getByRole('button',{name:'Return to simulated home'}).click();await expect(page.getByRole('button',{name:'Retry exact submission'})).toBeVisible();await page.unroute('**/dashboard-control/submit');
  const retry=await page.request.post(`${path}/submit`,{headers:{origin,'x-arbi-request':'1'},data:submitted});expect(retry.status()).toBe(202);const original=await retry.json();
  const duplicate=await page.request.post(`${path}/submit`,{headers:{origin,'x-arbi-request':'1'},data:submitted});expect((await duplicate.json()).id).toBe(original.id);
  await page.getByRole('button',{name:'Read observed control state'}).click();
  await expect.poll(async()=>{const value=await(await page.request.get(`${path}/status?jobId=${original.id}`)).json();return value.deviceStatus;}).toBe('completed');
  const db=new pg.Pool({connectionString:process.env.ARBI_DASHBOARD_TEST_DATABASE_URL,max:1});
  try{expect((await db.query('SELECT count(*)::int AS n FROM arbi_command_jobs WHERE id=$1',[original.id])).rows[0].n).toBe(1);
    expect((await db.query("SELECT count(*)::int AS n FROM arbi_job_reports WHERE record->'body'->>'commandId'=$1",[original.id])).rows[0].n).toBeGreaterThan(1);
  }finally{await db.end();}
  let commands=0;page.on('request',r=>{if(r.url().endsWith('/dashboard-control/submit'))commands++;});await page.reload();
  await page.getByRole('button',{name:'Read observed control state'}).click();await expect(page.getByText(original.id,{exact:true})).toBeVisible();expect(commands).toBe(0);
  await expect(page.getByRole('button',{name:'Jog +Z once'})).toBeDisabled();
  const lease=await(await page.request.get(`${path}/controls`)).json();if(lease.lease)await page.request.post(`${path}/release`,{headers:{origin,'x-arbi-request':'1'},data:{key:crypto.randomUUID(),leaseId:lease.lease.id,fence:lease.lease.fence}});
  await page.getByRole('button',{name:'Read observed control state'}).click();await page.getByRole('button',{name:'Enter simulated manual control'}).click();
  const jog=page.getByRole('button',{name:'Jog +Z once'});await expect(jog).toBeEnabled();await jog.focus();await page.keyboard.down('Enter');
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
  await page.keyboard.up('Enter');await expect(page.getByText(/Page hidden.*Manual intent ended/)).toBeVisible();
  const afterHide=commands;await page.waitForTimeout(600);expect(commands).toBe(afterHide);
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'));});
  await page.getByRole('button',{name:'Read observed control state'}).click();await expect(page.getByRole('button',{name:'Gimbal neutral'})).toBeDisabled();
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/control-playground-mobile.png',fullPage:true});
  expect(errors).toEqual([]);await other.close();
});
