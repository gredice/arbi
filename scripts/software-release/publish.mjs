import { execFileSync } from 'node:child_process';
import { createPrivateKey, createPublicKey } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { produceRelease, verifyReleaseArtifact } from '../../packages/arbi-protocol/dist/index.js';
import { sha256 } from './package.mjs';
import { targets } from './targets.mjs';

export function signBuild(build, bytes, { commit, keyId, privateKey, publicKey, version }) {
    const target = targets.find(t => t.id === build.target);
    if (!target || build.commit !== commit || build.scope !== 'simulation-only' || build.installationRequested !== false ||
        build.toolchain.node !== target.node || build.toolchain.runner !== target.runner ||
        build.artifact.file !== `${target.id}.tar.gz` || build.artifact.sizeBytes !== bytes.length ||
        build.artifact.sha256 !== sha256(bytes) || !bytes.length) throw new Error('Unvalidated or mismatched build');
    const releaseId = `${target.id}-${commit}`;
    const unsigned = { schemaVersion: 'arbi.release/1.0', releaseId, target: target.target,
        build: { version, buildId: `ci-${build.runId}-${build.runAttempt}`, commit },
        artifact: { artifactId: releaseId, kind: 'application', sha256: sha256(bytes), sizeBytes: bytes.length,
            signature: { algorithm: 'ed25519', keyId, value: '0'.repeat(128) } },
        channel: 'candidate', protocolRange: { min: '1.0', max: '1.0' },
        configuration: { schemaRange: { min: '1.0', max: '1.0' }, dataRange: { min: '1.0.0', max: '1.0.0' }, migration: null },
        minimumUpdater: '1.0.0', minimumBootloader: null, dependencies: [] };
    const result = produceRelease(unsigned, bytes, { keyId, privateKey });
    if (!result.ok || !verifyReleaseArtifact(result.value, bytes, { keyId, publicKey }).ok) throw new Error('Release signature verification failed');
    return result.value;
}
export function assertReleaseContext(env) {
    if (env.GITHUB_REPOSITORY !== 'gredice/arbi' || env.GITHUB_REF !== 'refs/heads/main' ||
        !['push', 'workflow_dispatch'].includes(env.GITHUB_EVENT_NAME) || env.ARBI_REQUIRED_CHECK !== 'success' ||
        env.GITHUB_REF_PROTECTED !== 'true' || !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA ?? '')) throw new Error('Protected-ref CI gate required');
}
export async function publish(directory, env = process.env, run = execFileSync) {
    assertReleaseContext(env);
    const root = fileURLToPath(new URL('../../', import.meta.url));
    const gh = (...args) => run('gh', args, { cwd: root, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    const api = (...args) => JSON.parse(gh('api', ...args));
    // Requires an operator-provisioned protected release credential. Never fall
    // back to mutable releases, or upload/replace an asset in a published release.
    if (api('repos/gredice/arbi/immutable-releases').enabled !== true) throw new Error('Enable GitHub immutable releases before publication');
    const commit = run('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    if (commit !== env.GITHUB_SHA) throw new Error('Release checkout mismatch');
    const version = JSON.parse(readFileSync(resolve(root, targets[0].path, 'package.json'))).version;
    const keyId = env.ARBI_RELEASE_KEY_ID;
    const privateKey = createPrivateKey(env.ARBI_RELEASE_SIGNING_KEY);
    const publicKey = createPublicKey(env.ARBI_RELEASE_PUBLIC_KEY);
    let count = 0;
    for (const target of targets) {
        const buildFile = resolve(directory, `${target.id}.build.json`);
        let build;
        try { build = JSON.parse(readFileSync(buildFile)); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
        const bytes = readFileSync(resolve(directory, `${target.id}.tar.gz`));
        count++;
        if (build.runId !== env.GITHUB_RUN_ID || build.runAttempt !== env.GITHUB_RUN_ATTEMPT ||
            build.lockSha256 !== sha256(readFileSync(resolve(root, 'pnpm-lock.yaml'))) ||
            build.sourceTree !== run('git', ['rev-parse', 'HEAD^{tree}'], { cwd: root, encoding: 'utf8' }).trim() ||
            build.toolchain.pnpm !== JSON.parse(readFileSync(resolve(root, 'package.json'))).packageManager) throw new Error('Build provenance mismatch');
        const manifest = signBuild(build, bytes, { commit, keyId, privateKey, publicKey, version });
        const tag = `software-${target.id}-${commit}`;
        const manifestFile = `${target.id}.manifest.json`;
        writeFileSync(resolve(directory, manifestFile), JSON.stringify(manifest, null, 2) + '\n');
        const entry = { schemaVersion: 'arbi.catalog-entry/1.0', state: 'available', installationRequested: false,
            scope: 'simulation-only', commit, tag, manifestFile, artifactFile: build.artifact.file };
        writeFileSync(resolve(directory, 'catalog-entry.json'), JSON.stringify(entry, null, 2) + '\n');
        // A retry reads and verifies an existing sealed release. No --clobber.
        let existing;
        try { existing = api(`repos/gredice/arbi/releases/tags/${tag}`); }
        catch (error) { if (!String(error.stderr).includes('404')) throw error; }
        if (existing && (!existing.immutable || existing.draft || existing.target_commitish !== commit)) throw new Error('Existing release is unsealed or mismatched');
        if (!existing) {
            gh('release', 'create', tag, '--repo', 'gredice/arbi', '--target', commit, '--draft', '--prerelease', '--latest=false',
                '--title', `Edge application ${version} (${commit.slice(0, 12)})`, '--notes', 'Available simulation-only Linux application. Publishing requests no installation.',
                resolve(directory, build.artifact.file), resolve(directory, manifestFile), resolve(directory, 'catalog-entry.json'));
            gh('release', 'edit', tag, '--repo', 'gredice/arbi', '--draft=false');
        }
        const published = api(`repos/gredice/arbi/releases/tags/${tag}`);
        if (!published.immutable || published.draft || published.target_commitish !== commit) throw new Error('Release was not sealed');
        const verifyDir = resolve(directory, `readback-${target.id}`);
        mkdirSync(verifyDir, { recursive: true });
        gh('release', 'download', tag, '--repo', 'gredice/arbi', '--dir', verifyDir);
        const readManifest = JSON.parse(readFileSync(resolve(verifyDir, manifestFile)));
        const readBytes = readFileSync(resolve(verifyDir, build.artifact.file));
        if ((!existing && JSON.stringify(readManifest) !== JSON.stringify(manifest)) ||
            readManifest.build.commit !== commit || readManifest.build.version !== version ||
            JSON.stringify(readManifest.target) !== JSON.stringify(manifest.target) ||
            !verifyReleaseArtifact(readManifest, readBytes, { keyId, publicKey }).ok ||
            readFileSync(resolve(verifyDir, 'catalog-entry.json'), 'utf8') !== readFileSync(resolve(directory, 'catalog-entry.json'), 'utf8')) throw new Error('Immutable catalog readback mismatch');
        console.log(`Verified available release ${tag}; no device state or installation request changed.`);
    }
    if (!count) throw new Error('No implemented build artifacts were supplied');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    // Redact cryptographic/CLI failures; provider diagnostics can contain secrets.
    try { await publish(resolve(process.argv[2])); }
    catch { console.error('Protected software publication failed; verify gates, immutable-release setup and trusted signing configuration.'); process.exitCode = 1; }
}
