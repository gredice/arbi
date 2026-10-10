import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { verifyReleaseArtifact, checkReleaseCompatibility } from '../../packages/arbi-protocol/dist/index.js';
import { assertReleaseContext, signBuild } from './publish.mjs';
import { sha256 } from './package.mjs';
const commit = 'a'.repeat(40), bytes = Buffer.from('real executable payload fixture');
const keys = generateKeyPairSync('ed25519');
const signer = { ...keys, commit, keyId: 'isolated-key', version: '0.1.0' };
const build = { target: 'edge', commit, runId: '123', runAttempt: '1', scope: 'simulation-only', installationRequested: false,
    toolchain: { node: '24.15.0', runner: 'ubuntu-24.04' }, artifact: { file: 'edge.tar.gz', sha256: sha256(bytes), sizeBytes: bytes.length } };
test('release artifact and validated manifest bind the checked commit and compatible synthetic target', () => {
    const manifest = signBuild(build, bytes, signer);
    assert.equal(manifest.build.commit, commit);
    assert.equal(verifyReleaseArtifact(manifest, bytes, { keyId: signer.keyId, publicKey: keys.publicKey }).ok, true);
    const inventory = JSON.parse(readFileSync(new URL('../../packages/arbi-protocol/fixtures/releases.json', import.meta.url))).inventory;
    assert.equal(checkReleaseCompatibility(manifest, inventory, '1.0.0').ok, true);
    assert.equal(verifyReleaseArtifact(manifest, Buffer.from('tampered'), { keyId: signer.keyId, publicKey: keys.publicKey }).ok, false);
    assert.equal(verifyReleaseArtifact({ ...manifest, build: { ...manifest.build, commit: 'b'.repeat(40) } }, bytes, { keyId: signer.keyId, publicKey: keys.publicKey }).ok, false);
    assert.throws(() => signBuild(build, bytes, { ...signer, publicKey: generateKeyPairSync('ed25519').publicKey }));
});
test('wrong source, empty/placeholder targets, digests and toolchains never become available', () => {
    for (const change of [{ target: 'pico' }, { commit: 'b'.repeat(40) }, { scope: 'hardware' }, { installationRequested: true },
        { toolchain: { node: '24.19.0', runner: 'ubuntu-24.04' } }, { artifact: { ...build.artifact, sha256: '0'.repeat(64) } }]) assert.throws(() => signBuild({ ...build, ...change }, bytes, signer));
    assert.throws(() => signBuild(build, Buffer.alloc(0), signer));
});
test('fork events, unprotected refs and failing checks never reach signing/publication', () => {
    const env = { GITHUB_REPOSITORY: 'gredice/arbi', GITHUB_REF: 'refs/heads/main', GITHUB_EVENT_NAME: 'push', GITHUB_REF_PROTECTED: 'true', GITHUB_SHA: commit, ARBI_REQUIRED_CHECK: 'success' };
    assert.doesNotThrow(() => assertReleaseContext(env));
    for (const change of [{ GITHUB_EVENT_NAME: 'pull_request' }, { GITHUB_REPOSITORY: 'fork/arbi' }, { GITHUB_REF: 'refs/heads/branch' }, { GITHUB_REF_PROTECTED: 'false' }, { ARBI_REQUIRED_CHECK: 'failure' }, { GITHUB_SHA: 'bad' }]) assert.throws(() => assertReleaseContext({ ...env, ...change }));
});
