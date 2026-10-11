import {test,expect,chromium,type Page} from '@playwright/test';
async function login(page:Page,code:string){await page.goto('/');await page.getByLabel('Test access code').fill(code);await page.getByRole('button',{name:'Open test dashboard'}).click();await expect(page.getByRole('heading',{name:'Overview',exact:true})).toBeVisible();}
async function panel(page:Page){await page.getByRole('link',{name:'Images',exact:true}).click();await expect(page.getByRole('heading',{name:'On-demand viewing'})).toBeVisible();await page.getByRole('button',{name:'Read viewing profiles'}).click();await expect(page.getByRole('button',{name:'Start viewing'})).toBeEnabled();}
test('real media-session service: explicit grants, independent viewers, heartbeat, revoke, hidden panel and no reconnect restart',async({page})=>{
  test.setTimeout(40000);await login(page,process.env.ARBI_DASHBOARD_TEST_ACCESS_CODE!);let starts=0,ends=0,signals=0;
  page.on('request',r=>{if(r.url().endsWith('/dashboard-live/start'))starts++;if(r.url().endsWith('/dashboard-live/end'))ends++;if(r.url().endsWith('/dashboard-live/signal'))signals++;});
  await page.getByRole('link',{name:'Images',exact:true}).click();await expect(page.getByRole('heading',{name:'On-demand viewing'})).toBeVisible();expect(starts).toBe(0);expect(signals).toBe(0);await expect(page.locator('main video, main img')).toHaveCount(0);
  await page.getByRole('button',{name:'Read viewing profiles'}).click();await expect(page.getByText(/Expected maximum payload 240000 B\/min/)).toBeVisible();await page.getByRole('button',{name:'Start viewing'}).click();
  await expect(page.getByText(/Permission granted · connection unobserved/)).toBeVisible();await expect(page.getByText(/Measured viewer payload Unavailable/)).toBeVisible();expect(starts).toBe(1);
  const id=await page.locator('section').filter({has:page.getByRole('heading',{name:'On-demand viewing'})}).locator('code').first().innerText();
  await expect(page.getByText(/epoch 2 · shared producer/)).toBeVisible({timeout:7000});
  const secondBrowser=await chromium.launch(),other=await secondBrowser.newContext({baseURL:process.env.ARBI_DASHBOARD_ORIGIN}),two=await other.newPage();try{
    await login(two,process.env.ARBI_DASHBOARD_TEST_VIEWER_CODE!);await panel(two);await two.getByRole('button',{name:'Start viewing'}).click();await expect(two.getByText(/Permission granted · connection unobserved/)).toBeVisible();
    const otherId=await two.locator('section').filter({has:two.getByRole('heading',{name:'On-demand viewing'})}).locator('code').first().innerText();expect(otherId).not.toBe(id);
    await expect(page.getByText(/epoch (?:[5-9]|[12][0-9]|3[0-2]) · shared producer/)).toBeVisible({timeout:10000});expect(starts).toBe(1);
    const revoked=await page.request.post('/api/sites/synthetic-site/dashboard-live/revoke',{headers:{origin:process.env.ARBI_DASHBOARD_ORIGIN!,'x-arbi-request':'1'},data:{sessionId:otherId}});expect(revoked.ok()).toBe(true);
    await expect(two.getByText('Viewing ended: revoked',{exact:true})).toBeVisible({timeout:7000});
    await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
    await expect(page.getByText('Viewing stopped when the panel became inactive.')).toBeVisible();await expect.poll(()=>ends).toBeGreaterThan(0);
    await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'));dispatchEvent(new Event('online'));});
    expect(starts).toBe(1);await expect(page.locator('main video,main img')).toHaveCount(0);await page.reload();expect(starts).toBe(1);await expect(page.getByText('Viewing is stopped. Read available profiles to begin.')).toBeVisible();
  }finally{await other.close();await secondBrowser.close();}
});
test('real stored low-data policy rejects a higher profile and offline closes without an automatic retry',async({page})=>{
  await login(page,process.env.ARBI_DASHBOARD_TEST_ACCESS_CODE!);
  await page.getByRole('link',{name:'Bandwidth',exact:true}).click();await page.getByRole('button',{name:'Read usage',exact:true}).click();await expect(page.getByRole('button',{name:'Save policy'})).toBeEnabled();await page.getByLabel('Allowance in bytes').fill('12000');await page.getByLabel('Transfer mode',{exact:true}).selectOption('low-data');await page.getByRole('button',{name:'Save policy'}).click();await expect(page.getByText(/Policy saved · audit/)).toBeVisible();await panel(page);
  await page.getByLabel('Viewing quality').selectOption('standard-reference');await page.getByRole('button',{name:'Start viewing'}).click();await expect(page.getByText('policy-denied',{exact:true})).toBeVisible();
  await page.getByLabel('Viewing quality').selectOption('low-reference');await page.getByRole('button',{name:'Start viewing'}).click();await expect(page.getByText(/Permission granted · connection unobserved/)).toBeVisible();
  await page.evaluate(()=>dispatchEvent(new Event('offline')));await expect(page.getByRole('heading',{name:'You are offline',exact:true})).toBeVisible();
  await page.evaluate(()=>dispatchEvent(new Event('online')));await page.reload();await expect(page.getByText('Viewing is stopped. Read available profiles to begin.')).toBeVisible();
});
