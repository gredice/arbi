import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { publish } from './publish.mjs';
import { sha256 } from './package.mjs';

test('isolated protected publication seals once, verifies readback, retains previous releases and rejects failed gates', async () => {
    const directory = mkdtempSync(resolve(tmpdir(), 'arbi-release-fixture-'));
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const root = new URL('../../', import.meta.url);
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const tree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim();
    const bytes = Buffer.from('isolated executable artifact');
    const env = { GITHUB_REPOSITORY: 'gredice/arbi', GITHUB_REF: 'refs/heads/main', GITHUB_EVENT_NAME: 'push', GITHUB_REF_PROTECTED: 'true',
        GITHUB_SHA: commit, GITHUB_RUN_ID: 'isolated-123', GITHUB_RUN_ATTEMPT: '1', ARBI_REQUIRED_CHECK: 'success',
        ARBI_RELEASE_KEY_ID: 'isolated-key', ARBI_RELEASE_SIGNING_KEY: privateKey.export({ type: 'pkcs8', format: 'pem' }),
        ARBI_RELEASE_PUBLIC_KEY: publicKey.export({ type: 'spki', format: 'pem' }) };
    const build = { target: 'edge', commit, sourceTree: tree, lockSha256: sha256(readFileSync(new URL('pnpm-lock.yaml', root))),
        runId: env.GITHUB_RUN_ID, runAttempt: env.GITHUB_RUN_ATTEMPT, scope: 'simulation-only', installationRequested: false,
        toolchain: { node: '24.15.0', runner: 'ubuntu-24.04', pnpm: JSON.parse(readFileSync(new URL('package.json', root))).packageManager },
        artifact: { file: 'edge.tar.gz', sha256: sha256(bytes), sizeBytes: bytes.length } };
    let release, creates = 0, seal = true, immutableEnabled = true;
    const retained = [{ tag: 'previous-immutable-release', installed: 'prior-version' }];
    const run = (command, args) => {
        if (command === 'git') return `${args[1].includes('tree') ? tree : commit}\n`;
        assert.equal(command, 'gh');
        if (args[0] === 'api') {
            if (args[1].endsWith('immutable-releases')) return JSON.stringify({ enabled: immutableEnabled });
            if (!release) { const error = new Error('Not found'); error.stderr = 'HTTP 404'; throw error; }
            return JSON.stringify(release);
        }
        if (args[1] === 'create') { creates++; release = { draft: true, immutable: false, target_commitish: commit }; }
        if (args[1] === 'edit') release = { ...release, draft: false, immutable: seal };
        if (args[1] === 'download') {
            const destination = args[args.indexOf('--dir') + 1];
            for (const file of ['edge.tar.gz', 'edge.manifest.json', 'catalog-entry.json']) copyFileSync(resolve(directory, file), resolve(destination, file));
        }
        return '';
    };
    try {
        writeFileSync(resolve(directory, 'edge.build.json'), JSON.stringify(build)); writeFileSync(resolve(directory, 'edge.tar.gz'), bytes);
        await assert.rejects(publish(directory, { ...env, ARBI_REQUIRED_CHECK: 'failure' }, run)); assert.equal(creates, 0);
        immutableEnabled = false; await assert.rejects(publish(directory, env, run)); assert.equal(creates, 0);
        immutableEnabled = true; await publish(directory, env, run); assert.equal(creates, 1);
        await publish(directory, env, run); assert.equal(creates, 1);
        assert.deepEqual(retained, [{ tag: 'previous-immutable-release', installed: 'prior-version' }]);
        const entry = JSON.parse(readFileSync(resolve(directory, 'catalog-entry.json'))); assert.equal(entry.installationRequested, false);
        release = undefined; seal = false; await assert.rejects(publish(directory, env, run), /not sealed/);
        writeFileSync(resolve(directory, 'edge.tar.gz'), 'tampered'); await assert.rejects(publish(directory, env, run), /mismatched build/);
    } finally { rmSync(directory, { recursive: true, force: true }); }
});
