import assert from 'node:assert/strict';
import test from 'node:test';
import { BrowserRecoveryConsumer } from './browser-consumer';
import { BrowserHttpsRecovery } from './browser-http';
import { BROWSER_REALTIME_VERSION, BrowserRealtimeError, BrowserTraffic, bytes } from './browser-contracts';
import type { BrowserAdmission, BrowserRecovery, BrowserRecoveryApi, BrowserSubscription } from './browser-contracts';

const scope = { realm: { environment: 'test' as const, namespaceId: 'browser-fixture' }, siteId: 'site-a' };
const snapshot = { coverage: 'bounded-current-view', configRevision: 'config-1', devices: [], states: [], jobs: [], authority: 'HTTPS reads' };
function setup() {
  let now = Date.now(), attaches = 0, reads = 0, closes = 0, cursor = '1', gap = false, more = false;
  let active: BrowserAdmission;
  let lost = () => {};
  const nowFn = () => now;
  const api: BrowserRecoveryApi = {
    async attach() {
      attaches++;
      const clientId = `arbi-${'a'.repeat(64)}`;
      const grant = { ...scope, id: `grant-${attaches}`, clientId, channel: `arbi:test:browser-fixture:site-a:state:${'a'.repeat(64)}`, expiresAtMs: now + 30000 };
      return active = { grant, token: { token: 'synthetic-no-provider-authority', clientId, issued: now, expires: now + 29750, capability: JSON.stringify({ [grant.channel]: ['subscribe'] }) } };
    },
    async recover(_id, epoch, previous) {
      reads++;
      const reset = epoch === null;
      return { ...scope, version: BROWSER_REALTIME_VERSION, epoch: 'epoch-a', cursor, reset, snapshot: more && !reset ? null : snapshot,
        notifications: reset || previous === cursor ? [] : [{ cursor: gap ? '9' : cursor, kind: 'inventory' }], more: more && !reset,
        expiresAtMs: active.grant.expiresAtMs, heartbeatAfterMs: 2500 } satisfies BrowserRecovery;
    },
  };
  const subscription: BrowserSubscription = { async open(_admission, _hint, disconnected) { lost = disconnected; return () => { closes++; }; } };
  const consumer = new BrowserRecoveryConsumer(scope, api, subscription, nowFn, () => 0);
  return { consumer, api, subscription, nowFn, advance: (ms: number) => { now += ms; }, setCursor: (value: string) => { cursor = value; },
    setGap: () => { gap = true; }, setMore: () => { more = true; }, lost: () => lost(), counts: () => ({ attaches, reads, closes }) };
}
const notice = (cursor: string, siteId = scope.siteId) => ({ ...scope, siteId, version: BROWSER_REALTIME_VERSION, epoch: 'epoch-a', cursor });

test('browser coalesces hints, recovers dropped hints and rejects a replay gap before publishing state', async () => {
  const f = setup(); await f.consumer.step(); assert.equal(f.consumer.status, 'current');
  for (let i = 0; i < 1000; i++) { f.consumer.hint(notice('2')); f.consumer.hint(notice('1')); f.consumer.hint(notice('99', 'other-site')); }
  await f.consumer.step(); assert.equal(f.counts().reads, 1);
  f.advance(500); f.setCursor('2'); await f.consumer.step(); assert.equal(f.counts().reads, 2);
  f.advance(2500); f.setCursor('3'); await f.consumer.step(); assert.equal(f.counts().reads, 3);
  f.setGap(); f.setCursor('4'); f.advance(2500); await f.consumer.step();
  assert.equal(f.consumer.status, 'degraded'); assert.equal(f.counts().closes, 1);
  // Invalid replay discards the cursor, so a later authorized attach requests a snapshot.
  f.advance(1000); await f.consumer.step(); assert.equal(f.consumer.status, 'current'); assert.equal(f.counts().attaches, 2);
  f.consumer.close(); assert.equal(f.consumer.snapshot, null);
});

test('one slow operation has no caller queue; closing during attach or SDK open cannot resurrect a subscription', async () => {
  const f = setup(); let release!: () => void;
  const delayed = new Promise<void>(resolve => { release = resolve; });
  const original = f.api.attach; f.api.attach = async signal => { await delayed; return original(signal); };
  const running = f.consumer.step(); await Promise.all(Array.from({ length: 100 }, () => f.consumer.step()));
  f.consumer.close(); release(); await running;
  assert.deepEqual(f.counts(), { attaches: 1, reads: 0, closes: 0 }); assert.equal(f.consumer.status, 'offline');
  const g = setup(); let opened!: () => void;
  const opening = new Promise<void>(resolve => { opened = resolve; });
  let wasAborted = false, closed = 0;
  g.subscription.open = async (_a, _changed, _lost, signal) => {
    signal.addEventListener('abort', () => { wasAborted = true; });
    await opening; return () => { closed++; };
  };
  const step = g.consumer.step(); await Promise.resolve(); await Promise.resolve(); g.consumer.close(); opened(); await step;
  assert.equal(wasAborted, true); assert.equal(closed, 1); assert.equal(g.counts().reads, 0); assert.equal(g.consumer.status, 'offline');
});

test('broker downtime retains bounded HTTPS recovery; denied membership clears state and requires explicit new composition', async () => {
  const f = setup(); let opens = 0;
  f.subscription.open = async () => { opens++; throw new Error('BROKER_DOWN'); };
  await f.consumer.step(); assert.equal(f.consumer.status, 'degraded'); assert.deepEqual(f.consumer.snapshot, snapshot);
  f.advance(2500); await f.consumer.step(); assert.equal(opens, 1); assert.equal(f.counts().reads, 2);
  f.api.recover = async () => { throw new BrowserRealtimeError('DENIED'); };
  f.advance(2500); await f.consumer.step(); assert.equal(f.consumer.status, 'denied'); assert.equal(f.consumer.snapshot, null);
  f.advance(60000); await f.consumer.step(); assert.equal(f.counts().attaches, 1); f.consumer.close();
});

test('catch-up, reconnect, HTTP budgets and original expiry remain bounded across caller bursts', async () => {
  const f = setup(); await f.consumer.step(); f.setMore();
  for (let i = 2; i <= 6; i++) { f.setCursor(String(i)); f.advance(i === 2 ? 2500 : 500); await f.consumer.step(); }
  assert.equal(f.consumer.status, 'current'); assert.equal(f.counts().reads, 6); f.consumer.close();
  const g = setup();
  for (let i = 0; i < 8; i++) { await g.consumer.step(); g.lost(); g.advance(2500); }
  await g.consumer.step(); assert.equal(g.counts().attaches, 8); assert.equal(g.consumer.status, 'degraded');
  g.consumer.close();
  const h = setup(); await h.consumer.step(); h.advance(30000); await h.consumer.step();
  assert.equal(h.counts().attaches, 2); assert.equal(h.counts().closes, 1); h.consumer.close();
  const k = setup(); await k.consumer.step();
  for (let i = 0; i < 65; i++) { k.consumer.hint(notice('99')); k.advance(500); await k.consumer.step(); }
  assert.equal(k.counts().reads, 59); assert.equal(k.consumer.status, 'degraded'); k.consumer.close();
});

test('browser rejects cross-site admission, publish capabilities, expired token and dispatchable snapshot extras', async () => {
  for (const mutate of [
    (a: BrowserAdmission) => { a.grant.siteId = 'other-site'; },
    (a: BrowserAdmission) => { a.grant.channel = 'arbi:test:browser-fixture:site-a:state:*'; a.token.capability = JSON.stringify({ [a.grant.channel]: ['subscribe'] }); },
    (a: BrowserAdmission) => { a.token.capability = JSON.stringify({ [a.grant.channel]: ['subscribe', 'publish'] }); },
    (a: BrowserAdmission) => { a.token.expires = 0; },
  ]) {
    const f = setup(), attach = f.api.attach;
    f.api.attach = async signal => { const a = await attach(signal) as BrowserAdmission; mutate(a); return a; };
    await f.consumer.step(); assert.equal(f.consumer.status, 'degraded'); assert.equal(f.counts().reads, 0); f.consumer.close();
  }
  const f = setup(), recover = f.api.recover;
  f.api.recover = async (...args) => ({ ...await recover(...args) as BrowserRecovery, snapshot: { ...snapshot, commands: ['motion.move'] } });
  await f.consumer.step(); assert.equal(f.consumer.status, 'degraded'); assert.equal(f.consumer.snapshot, null); f.consumer.close();
  assert.throws(() => new BrowserRecoveryConsumer({ ...scope, realm: { ...scope.realm, environment: 'production' } }, f.api, f.subscription), /INVALID_CONFIGURATION/);
});

test('HTTP meters failed/discarded bytes, rechecks bearer per read and cancels overflow, aborts and stalled credential callbacks', async () => {
  const traffic = new BrowserTraffic(); let tokens = 0;
  const failed = new BrowserHttpsRecovery('https://fixture.invalid', scope.siteId, async () => { tokens++; return 'synthetic-bearer'; }, traffic,
    async (_url, init) => { assert.equal(init!.credentials, 'omit'); assert.equal(init!.redirect, 'error'); throw new Error('FAILED_SUBMISSION'); });
  await assert.rejects(failed.attach(new AbortController().signal));
  assert.equal(traffic.totals.requests, 1); assert.equal(traffic.totals.upload, bytes('{"grantId":null}synthetic-bearer'));
  let cancelled = false;
  const huge = new BrowserHttpsRecovery('https://fixture.invalid', scope.siteId, async () => 'synthetic-bearer', traffic,
    async () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(65537)); }, cancel() { cancelled = true; } }), { headers: { 'content-type': 'application/json' } }));
  await assert.rejects(huge.attach(new AbortController().signal), { code: 'CAPACITY' });
  assert.equal(cancelled, true); assert.equal(traffic.totals.download, 65537);
  const denied = new BrowserHttpsRecovery('https://fixture.invalid', scope.siteId, async () => { tokens++; return 'synthetic-bearer'; }, traffic,
    async () => Response.json({ error: 'DENIED' }, { status: 403 }));
  await assert.rejects(denied.attach(new AbortController().signal), { code: 'DENIED' }); assert.equal(tokens, 2);
  const pending = new AbortController(); let attempted = false;
  const stalled = new BrowserHttpsRecovery('https://fixture.invalid', scope.siteId, async () => new Promise(() => {}), traffic,
    async () => { attempted = true; return Response.json({}); });
  const task = stalled.attach(pending.signal); pending.abort(); await assert.rejects(task, { code: 'UNAVAILABLE' }); assert.equal(attempted, false);
  assert.throws(() => new BrowserHttpsRecovery('http://fixture.invalid', scope.siteId, async () => '', traffic), /INVALID_CONFIGURATION/);
  const limit = new BrowserTraffic(); for (let i = 0; i < 60; i++) limit.request(); assert.throws(() => limit.request(), { code: 'CAPACITY' });
  assert.throws(() => limit.account('broker', 2 * 1024 * 1024 + 1), { code: 'CAPACITY' });
});

test('callbacks from a disconnected subscription cannot shorten backoff or schedule reads in a new grant', async () => {
  const f = setup(); const callbacks: ((value: unknown) => void)[] = [];
  f.subscription.open = async (_admission, hint) => { callbacks.push(hint); return () => {}; };
  await f.consumer.step(); f.setGap(); f.setCursor('2'); f.advance(2500); await f.consumer.step();
  assert.equal(f.consumer.status, 'degraded'); const retryAt = f.consumer.nextAt;
  f.advance(500); callbacks[0](notice('999')); f.consumer.hint(notice('999'));
  assert.equal(f.consumer.nextAt, retryAt); await f.consumer.step(); assert.equal(f.counts().attaches, 1);
  f.advance(500); await f.consumer.step(); assert.equal(f.consumer.status, 'current');
  const heartbeatAt = f.consumer.nextAt;
  callbacks[0](notice('999')); assert.equal(f.consumer.nextAt, heartbeatAt);
  callbacks[1](notice('999')); assert.equal(f.consumer.nextAt, f.nowFn() + 500); f.consumer.close();
});
