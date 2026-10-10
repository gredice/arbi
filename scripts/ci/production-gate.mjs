import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repository = 'gredice/arbi';
export function productionIdentity(env) {
    if (env.VERCEL_ENV !== 'production') return null;
    if (env.VERCEL_GIT_REPO_OWNER !== 'gredice' || env.VERCEL_GIT_REPO_SLUG !== 'arbi' ||
        env.VERCEL_GIT_COMMIT_REF !== 'main' || !/^[a-f0-9]{40}$/.test(env.VERCEL_GIT_COMMIT_SHA ?? '')) {
        throw new Error('Production requires the main ref and full source identity of gredice/arbi');
    }
    return env.VERCEL_GIT_COMMIT_SHA;
}
export function inspectGate(runs, jobs, commit) {
    // The latest run is authoritative: a failed rerun cannot reuse older success.
    const run = runs.filter(r => r.head_sha === commit && r.head_branch === 'main' &&
        ['push', 'workflow_dispatch'].includes(r.event) && r.path === '.github/workflows/ci.yml')
        .sort((a, b) => b.id - a.id)[0];
    if (!run) return 'pending';
    const gate = jobs.filter(j => j.run_id === run.id && j.name === '[CI] OK');
    if (gate.length !== 1) return run.status === 'completed' ? 'failure' : 'pending';
    if (gate[0].status !== 'completed') return 'pending';
    return gate[0].conclusion === 'success' ? 'success' : 'failure';
}
export async function waitForProduction(commit, { request = fetch, pause = ms => new Promise(r => setTimeout(r, ms)), attempts = 35, token = process.env.ARBI_CI_READ_TOKEN } = {}) {
    const get = async path => {
        const response = await request(`https://api.github.com/repos/${repository}/${path}`, {
            headers: { accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', ...(token ? { authorization: `Bearer ${token}` } : {}) },
            signal: AbortSignal.timeout(10_000), redirect: 'error',
        });
        if (!response.ok) throw new Error(`Production CI lookup failed (${response.status})`);
        return response.json();
    };
    for (let attempt = 0; attempt < attempts; attempt++) {
        const { workflow_runs: runs } = await get(`actions/workflows/ci.yml/runs?head_sha=${commit}&per_page=20`);
        const run = runs.filter(r => r.head_sha === commit && r.head_branch === 'main' && ['push', 'workflow_dispatch'].includes(r.event))
            .sort((a, b) => b.id - a.id)[0];
        // Use this run's latest attempt, never a PR merge commit or old run.
        const jobs = run ? (await get(`actions/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=100`)).jobs : [];
        const state = inspectGate(runs, jobs, commit);
        if (state === 'success') return { commit, runId: run.id, attempt: run.run_attempt };
        if (state === 'failure') throw new Error('Required [CI] OK failed; production build denied');
        if (attempt + 1 < attempts) await pause(60_000);
    }
    throw new Error('Required [CI] OK did not complete; production build denied');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const commit = productionIdentity(process.env);
    if (commit) console.log(JSON.stringify(await waitForProduction(commit)));
    else console.log('Nonproduction build: no production promotion authority.');
}
