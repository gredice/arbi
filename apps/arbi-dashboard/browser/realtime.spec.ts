import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import pg from 'pg';
import { postgresDatabase } from '../src/enrollment/store';
import { createRealtimeServer } from '../src/realtime/server';
import { fixture, realm } from '../src/realtime/test-support';

// Test-only static module host. Chromium executes the actual browser sources and
// installed Ably browser SDK; no fixture page/identity is shipped in the app.
const html = `<!doctype html><script src="/ably.js"></script>
<script type="importmap">{"imports":{"ably":"/ably-bridge.js"}}</script>
<script type="module">
import {BrowserRecoveryConsumer} from '/browser-consumer.js';
import {BrowserHttpsRecovery} from '/browser-http.js';
import {AblyBrowserSubscription} from '/browser-ably.js';
import {BrowserTraffic} from '/browser-contracts.js';
window.startRecovery = async ({scope, token, port}) => {
  const traffic = new BrowserTraffic();
  const api = new BrowserHttpsRecovery(location.origin, scope.siteId, async () => token, traffic, fetch, true);
  const broker = new AblyBrowserSubscription(traffic, {endpoint:'127.0.0.1', port, tls:false, fallbackHosts:[], transports:['web_socket']});
  window.consumer = new BrowserRecoveryConsumer(scope, api, broker);
  window.traffic = traffic; await window.consumer.step();
};
window.ready = true;
</script>`;

test('Chromium authenticated recovery survives lost hints, instance changes, replay gaps, broker loss and membership revocation', async ({ page }) => {
  const connectionString = process.env.ARBI_DASHBOARD_TEST_DATABASE_URL;
  if (!connectionString) throw new Error('ISOLATED_BROWSER_DATABASE_REQUIRED');
  const url = new URL(connectionString);
  const root = realpathSync(url.searchParams.get('host')!);
  expect(root.startsWith('/private/tmp/arbi-shell-pg-') || root.startsWith('/tmp/arbi-shell-pg-')).toBe(true);
  const admin = new pg.Pool({ connectionString, max: 1 });
  await admin.query('CREATE DATABASE arbi_browser_realtime_test'); await admin.end();
  url.pathname = '/arbi_browser_realtime_test';
  const a = new pg.Pool({ connectionString: url.href, max: 2 }), b = new pg.Pool({ connectionString: url.href, max: 2 });
  const f = await fixture(), human = await f.human('synthetic-browser', 'state.read');
  const modules = new Map<string, string>();
  for (const name of ['browser-contracts', 'browser-consumer', 'browser-http', 'browser-ably']) {
    const source = await readFile(new URL(`../src/realtime/${name}.ts`, import.meta.url), 'utf8');
    modules.set(`/${name}.js`, stripTypeScriptTypes(source, { mode: 'transform' }).replace(/from '(\.\/browser-[a-z]+)'/g, "from '$1.js'"));
  }
  const sdk = await readFile(new URL('../node_modules/ably/build/ably.js', import.meta.url));
  let runtime: ReturnType<typeof createRealtimeServer>, origin = '', slow = false;
  let finishSlow: (() => void) | undefined;
  const wire: number[] = [], channels: string[] = [], responses: string[] = [], hints: ((channel: string, data: string) => void)[] = [];
  let rejectBroker = false;
  await page.routeWebSocket(/127\.0\.0\.1/, socket => {
    const clientId = new URL(socket.url()).searchParams.get('clientId');
    if (rejectBroker) { socket.close(); return; }
    socket.send(JSON.stringify({ action: 4, connectionId: 'synthetic-connection', connectionDetails: { clientId,
      connectionKey: 'synthetic-key', maxMessageSize: 4096, maxFrameSize: 4096, connectionStateTtl: 120000, maxIdleInterval: 15000 } }));
    let attached = '';
    hints.push((channel, data) => { if (channel === attached) socket.send(JSON.stringify({ action: 15, channel, messages: [{ name: 'changed', data }] })); });
    socket.onMessage(data => {
      const message = JSON.parse(String(data)); wire.push(message.action);
      if (message.action === 10) {
        attached = message.channel; channels.push(attached);
        expect(message.flags & (1 << 18)).toBe(1 << 18);
        socket.send(JSON.stringify({ action: 11, channel: attached, flags: 1 << 18 }));
      }
      if (message.action === 7) { socket.send(JSON.stringify({ action: 8 })); socket.close(); }
    });
  });
  const server = createServer(async (request, response) => {
    try {
      const path = new URL(request.url!, origin || 'http://127.0.0.1').pathname;
      if (request.method === 'GET') {
        const body = path === '/' ? html : path === '/ably.js' ? sdk : path === '/ably-bridge.js' ? 'export const Realtime = globalThis.Ably.Realtime;' : modules.get(path);
        response.writeHead(body === undefined ? 404 : 200, { 'content-type': path === '/' ? 'text/html' : 'text/javascript', 'cache-control': 'no-store' }).end(body); return;
      }
      const match = path.match(/^\/api\/sites\/([^/]+)\/realtime\/(attach|recover)$/);
      if (!match) { response.writeHead(404).end(); return; }
      const chunks: Buffer[] = []; let size = 0;
      for await (const chunk of request) { size += chunk.length; if (size > 16384) throw new Error('CAPACITY'); chunks.push(chunk); }
      const headers = new Headers();
      for (const [key, value] of Object.entries(request.headers)) if (typeof value === 'string') headers.set(key, value);
      const result = await runtime.handle(new Request(`${origin}${path}`, { method: 'POST', headers, body: Buffer.concat(chunks).toString() }), { siteId: match[1], action: match[2] });
      responses.push(`${match[2]}:${result.status}`);
      if (slow && match[2] === 'recover') await new Promise<void>(resolve => { finishSlow = resolve; });
      response.writeHead(result.status, Object.fromEntries(result.headers)).end(Buffer.from(await result.arrayBuffer()));
    } catch { response.writeHead(503).end('{}'); }
  });
  try {
    for (const name of ['0001-enrollment', '0002-media', '0003-audit', '0004-jobs', '0005-realtime']) await a.query(await readFile(new URL(`../migrations/${name}.sql`, import.meta.url), 'utf8'));
    await a.query('INSERT INTO arbi_device_registry VALUES($1,$2,$3,$4::jsonb)', [realm.environment, realm.namespaceId, f.registry.siteId, JSON.stringify(f.registry)]);
    server.listen(0, '127.0.0.1'); await once(server, 'listening'); const address = server.address();
    if (!address || typeof address === 'string') throw new Error('FIXTURE_ADDRESS'); origin = `http://127.0.0.1:${address.port}`;
    const buildRuntime = (pool: pg.Pool) => createRealtimeServer({ db: postgresDatabase(pool), realm, identity: f.identity.adapter,
      resolveSite: f.identity.resolveResource, currentAuthority: f.currentAuthority, browserOrigins: [origin], broker: f.broker });
    const first = buildRuntime(a), second = buildRuntime(b); runtime = first;
    await page.goto(origin); await page.waitForFunction(() => (window as any).ready);
    await page.evaluate(config => (window as any).startRecovery(config), { scope: { realm, siteId: f.registry.siteId }, token: human.token, port: address.port });
    const state = () => page.evaluate(() => ({ status: (window as any).consumer.status, snapshot: (window as any).consumer.snapshot, traffic: (window as any).traffic.totals }));
    const initial = await state();
    expect(initial.status, JSON.stringify({ traffic: initial.traffic, snapshot: !!initial.snapshot, wire, channels, responses })).toBe('current'); expect(initial.snapshot.configRevision).toBe('config-1');
    expect(channels).toHaveLength(1);
    const routes = (await b.query('SELECT channel,record FROM arbi_realtime_grants WHERE site_id=$1', [f.registry.siteId])).rows;
    expect(routes[0].channel).toBe(channels[0]); expect(routes[0].record.principal.authority.actor.id).toBe('synthetic-browser');
    // A wrong-site attach goes through the real fresh membership/resource boundary.
    const denied = await page.evaluate(async ({ site, token }) => (await fetch(`/api/sites/${site}/realtime/attach`, { method: 'POST', headers: {
      authorization: `Bearer ${token}`, 'content-type': 'application/json', 'x-arbi-request': '1' }, body: '{"grantId":null}' })).status, { site: 'other-site', token: human.token });
    expect(denied).toBe(403);
    runtime = second;
    await b.query('UPDATE arbi_device_registry SET state=jsonb_set(state,\'{configRevision}\',\'"config-2"\') WHERE site_id=$1', [f.registry.siteId]);
    await second.store.maintain(f.registry.siteId);
    const hint = f.published.at(-1)!;
    for (let i = 0; i < 100; i++) for (const send of hints) send(hint.channel, JSON.stringify(hint.notification));
    await page.waitForTimeout(550); await page.evaluate(() => (window as any).consumer.step());
    expect((await state()).snapshot.configRevision).toBe('config-2');
    // Drop every hint: heartbeat still recovers committed state after instance change.
    await b.query('UPDATE arbi_device_registry SET state=jsonb_set(state,\'{hardwareDigest}\',\'"dropped-hint"\') WHERE site_id=$1', [f.registry.siteId]);
    await page.waitForTimeout(2600); await page.evaluate(() => (window as any).consumer.step());
    expect((await state()).status).toBe('current');
    // Retention/epoch discontinuity requires a fresh current snapshot.
    await b.query("UPDATE arbi_realtime_sites SET epoch='new-epoch' WHERE site_id=$1", [f.registry.siteId]);
    await page.waitForTimeout(2600); await page.evaluate(() => (window as any).consumer.step());
    expect((await state()).status).toBe('current');
    // Closing the consumer during a slow response cannot publish stale page state.
    slow = true;
    await page.waitForTimeout(2600);
    const pending = page.evaluate(() => (window as any).consumer.step());
    await expect.poll(() => !!finishSlow).toBe(true);
    await page.evaluate(() => (window as any).consumer.close()); finishSlow!(); await pending;
    expect((await state()).status).toBe('offline'); expect((await state()).snapshot).toBe(null);
    slow = false; rejectBroker = true;
    await page.evaluate(config => (window as any).startRecovery(config), { scope: { realm, siteId: f.registry.siteId }, token: human.token, port: address.port });
    expect((await state()).status).toBe('degraded'); expect((await state()).snapshot.configRevision).toBe('config-2');
    f.identity.revoke(human.sessionId); await second.store.maintain(f.registry.siteId);
    await page.waitForTimeout(2600); await page.evaluate(() => (window as any).consumer.step());
    expect((await state()).status).toBe('denied'); expect((await state()).snapshot).toBe(null);
    expect((await state()).traffic.upload).toBeGreaterThan(0); expect((await state()).traffic.download).toBeGreaterThan(0);
    expect(wire.some(action => [14, 15, 17].includes(action))).toBe(false);
    expect((await a.query('SELECT count(*) FROM arbi_command_jobs')).rows[0].count).toBe('0');
  } finally {
    finishSlow?.(); await page.evaluate(() => (window as any).consumer?.close()).catch(() => {});
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await a.end(); await b.end();
  }
});
