import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inspectGate, productionIdentity, waitForProduction } from './production-gate.mjs';
const commit = 'a'.repeat(40);
const run = { id: 42, run_attempt: 1, head_sha: commit, head_branch: 'main', event: 'push', path: '.github/workflows/ci.yml', status: 'in_progress' };
const job = { run_id: 42, name: '[CI] OK', status: 'completed', conclusion: 'success' };
test('secret-free previews skip production lookup; only exact protected production identity is accepted', () => {
    assert.equal(productionIdentity({ VERCEL_ENV: 'preview' }), null);
    const env = { VERCEL_ENV: 'production', VERCEL_GIT_REPO_OWNER: 'gredice', VERCEL_GIT_REPO_SLUG: 'arbi', VERCEL_GIT_COMMIT_REF: 'main', VERCEL_GIT_COMMIT_SHA: commit };
    assert.equal(productionIdentity(env), commit);
    for (const [name, value] of Object.entries(env).filter(([key]) => key !== 'VERCEL_ENV')) assert.throws(() => productionIdentity({ ...env, [name]: `${value}-wrong` }));
});
test('gate cannot reuse old success, a PR run, another commit or an ambiguous/missing result', () => {
    assert.equal(inspectGate([run], [job], commit), 'success');
    for (const conclusion of ['failure', 'cancelled', 'skipped', 'neutral', null]) assert.equal(inspectGate([run], [{ ...job, conclusion }], commit), 'failure');
    assert.equal(inspectGate([run, { ...run, id: 43 }], [job], commit), 'pending');
    assert.equal(inspectGate([{ ...run, event: 'pull_request' }], [job], commit), 'pending');
    assert.equal(inspectGate([run], [job], 'b'.repeat(40)), 'pending');
    assert.equal(inspectGate([run], [job, job], commit), 'pending');
    assert.equal(inspectGate([{ ...run, status: 'completed' }], [], commit), 'failure');
});
test('isolated success promotes only matching evidence; failed/missing/network checks stop the build', async () => {
    const request = async url => Response.json(url.includes('/jobs?') ? { jobs: [job] } : { workflow_runs: [run] });
    assert.deepEqual(await waitForProduction(commit, { request, attempts: 1 }), { commit, runId: 42, attempt: 1 });
    await assert.rejects(waitForProduction(commit, { attempts: 1, request: async url => Response.json(url.includes('/jobs?') ? { jobs: [{ ...job, conclusion: 'failure' }] } : { workflow_runs: [run] }) }), /failed/);
    await assert.rejects(waitForProduction(commit, { attempts: 1, request: async () => Response.json({ workflow_runs: [] }) }), /did not complete/);
    await assert.rejects(waitForProduction(commit, { attempts: 1, request: async () => new Response('', { status: 403 }) }), /lookup failed/);
});
