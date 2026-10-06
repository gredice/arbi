// Architecture experiment only: no provider SDK, production protocol or actuator.
// All identities and keys are synthetic and created here. Never reuse this auth fixture.
import assert from 'node:assert/strict';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

test('bounded recovery across disposable HTTP workers', async (t) => {
    const directory = await mkdtemp(join(tmpdir(), 'arbi-recovery-spike-'));
    const path = join(directory, 'fixture.sqlite');
    const writer = new DatabaseSync(path);
    const workers = [];
    t.after(async () => {
        for (const worker of workers) await worker.close();
        writer.close();
        await rm(directory, { recursive: true, force: true });
    });
    writer.exec(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE events (
            cursor INTEGER PRIMARY KEY AUTOINCREMENT,
            site TEXT NOT NULL, kind TEXT NOT NULL, expires INTEGER
        );
        CREATE TABLE retention (floor INTEGER NOT NULL);
        INSERT INTO retention VALUES (0);
    `);
    const insert = writer.prepare('INSERT INTO events (site, kind, expires) VALUES (?, ?, ?)');
    for (const row of [
        ['site-a', 'intent', 1000], ['site-a', 'status', null],
        ['site-a', 'intent', 10000], ['site-b', 'status', null],
        ['site-a', 'status', null], ['site-a', 'status', null],
    ]) insert.run(...row);

    const testKey = randomBytes(32);
    const productionKey = randomBytes(32);
    function token(claims, key = testKey) {
        const data = Buffer.from(JSON.stringify(claims)).toString('base64url');
        return `${data}.${createHmac('sha256', key).update(data).digest('hex')}`;
    }
    const identity = { environment: 'test', site: 'site-a', device: 'edge-a' };
    const credential = token(identity);
    let bodyBytes = 0;

    async function startWorker() {
        // Each worker has its own store connection and no retained session/cursor.
        const reader = new DatabaseSync(path, { readOnly: true });
        const server = createServer((request, response) => {
            const reply = (status, body) => {
                response.writeHead(status, { 'content-type': 'application/json' });
                response.end(JSON.stringify(body));
            };
            const url = new URL(request.url, 'http://127.0.0.1');
            if (request.method !== 'GET' || url.pathname !== '/recover') {
                reply(404, {});
                return;
            }
            let claims;
            try {
                const [data, signature] = (request.headers.authorization ?? '').split('.');
                const expected = createHmac('sha256', testKey).update(data).digest();
                const supplied = Buffer.from(signature, 'hex');
                if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
                    throw new Error('invalid fixture signature');
                }
                claims = JSON.parse(Buffer.from(data, 'base64url').toString());
                if (claims.environment !== 'test' ||
                    !['site-a:edge-a', 'site-b:edge-b'].includes(`${claims.site}:${claims.device}`)) {
                    throw new Error('invalid fixture scope');
                }
            } catch {
                reply(401, {});
                return;
            }
            // The authenticated scope, never a query parameter, selects the site.
            if (url.searchParams.has('site') && url.searchParams.get('site') !== claims.site) {
                reply(403, {});
                return;
            }
            const cursor = Number(url.searchParams.get('cursor') ?? 0);
            if (!Number.isSafeInteger(cursor) || cursor < 0) {
                reply(400, {});
                return;
            }
            const floor = reader.prepare('SELECT floor FROM retention').get().floor;
            const latest = reader.prepare('SELECT COALESCE(MAX(cursor), 0) AS cursor FROM events WHERE site = ?').get(claims.site).cursor;
            if (cursor < floor) {
                reply(409, { snapshotRequired: true, snapshotCursor: latest });
                return;
            }
            const events = reader.prepare('SELECT * FROM events WHERE site = ? AND cursor > ? ORDER BY cursor LIMIT 2').all(claims.site, cursor);
            reply(200, {
                cursor: events.at(-1)?.cursor ?? cursor,
                events,
                // Fixed synthetic time; this is retrieval, never execution authority.
                currentIntents: events.filter((event) => event.kind === 'intent' && event.expires > 2000).map((event) => event.cursor),
            });
        });
        server.listen(0, '127.0.0.1');
        await once(server, 'listening');
        let closed = false;
        const worker = {
            url: `http://127.0.0.1:${server.address().port}`,
            async close() {
                if (closed) return;
                closed = true;
                await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
                reader.close();
            },
        };
        workers.push(worker);
        return worker;
    }
    async function recover(worker, query = '?cursor=0', authorization = credential) {
        const response = await fetch(`${worker.url}/recover${query}`, {
            headers: { authorization }, signal: AbortSignal.timeout(3000),
        });
        const body = await response.text();
        bodyBytes += Buffer.byteLength(body);
        return { status: response.status, body: JSON.parse(body) };
    }
    const first = await startWorker();
    const second = await startWorker();
    await t.test('lost notifications recover bounded pages on another instance', async () => {
        const page = await recover(first);
        assert.equal(page.status, 200);
        assert.deepEqual(page.body.events.map((event) => event.cursor), [1, 2]);
        assert.deepEqual(page.body.currentIntents, []); // expired intent remains history
        const next = await recover(second, `?cursor=${page.body.cursor}`);
        assert.deepEqual(next.body.events.map((event) => event.cursor), [3, 5]);
        assert.deepEqual(next.body.currentIntents, [3]);
        assert.equal((await recover(second, '?cursor=5')).body.events.length, 1);
    });
    await t.test('duplicate recovery does not advance or duplicate the journal', async () => {
        const a = await recover(first, '?cursor=2');
        const b = await recover(second, '?cursor=2');
        assert.deepEqual(a.body, b.body);
        assert.equal(writer.prepare('SELECT COUNT(*) AS count FROM events').get().count, 6);
    });
    await t.test('discarding workers preserves state for a replacement', async () => {
        await first.close();
        await second.close();
        const replacement = await startWorker();
        assert.deepEqual((await recover(replacement, '?cursor=2')).body.events.map((event) => event.cursor), [3, 5]);
    });
    const replacement = workers.at(-1);
    await t.test('production and cross-site fixture credentials are rejected', async () => {
        assert.equal((await recover(replacement, '?cursor=0', token({ ...identity, environment: 'production' }, productionKey))).status, 401);
        assert.equal((await recover(replacement, '?cursor=0', token({ ...identity, environment: 'production' }))).status, 401);
        assert.equal((await recover(replacement, '?cursor=0&site=site-b')).status, 403);
        assert.equal((await recover(replacement, '?cursor=0', token({ ...identity, site: 'site-b' }))).status, 401);
        const otherSite = await recover(replacement, '?cursor=0', token({ environment: 'test', site: 'site-b', device: 'edge-b' }));
        assert.deepEqual(otherSite.body.events.map((event) => event.cursor), [4]);
    });
    await t.test('retention gaps require a snapshot instead of silent replay', async () => {
        writer.exec('DELETE FROM events WHERE cursor <= 2; UPDATE retention SET floor = 2;');
        const gap = await recover(replacement);
        assert.equal(gap.status, 409);
        assert.equal(gap.body.snapshotRequired, true);
        assert.equal(gap.body.snapshotCursor, 6);
        assert.equal((await recover(replacement, '?cursor=6')).body.events.length, 0);
        assert.equal((await recover(replacement, '?cursor=-1')).status, 400);
    });
    t.diagnostic(`Recovered JSON response body bytes: ${bodyBytes}; excludes HTTP/TLS/WSS/IP overhead and retries.`);
});
