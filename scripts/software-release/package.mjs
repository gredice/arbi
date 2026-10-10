import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { targets } from './targets.mjs';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export function packageTarget(id, output, { root = fileURLToPath(new URL('../../', import.meta.url)), run = execFileSync } = {}) {
    const target = targets.find(t => t.id === id);
    if (!target) throw new Error('Unimplemented release target');
    const git = (...args) => run('git', args, { cwd: root, encoding: 'utf8' }).trim();
    const commit = git('rev-parse', 'HEAD');
    if (!/^[a-f0-9]{40}$/.test(commit) || (process.env.GITHUB_SHA && process.env.GITHUB_SHA !== commit)) throw new Error('Source commit mismatch');
    if (git('status', '--porcelain', '--untracked-files=no')) throw new Error('Release source must be clean');
    // This is a Linux application, not an OS image or portable firmware.
    if (process.platform !== 'linux' || process.arch !== 'x64' || process.versions.node !== target.node) throw new Error('Release toolchain mismatch');
    const stage = resolve(output, 'application');
    mkdirSync(output, { recursive: true });
    // pnpm's legacy deploy rewrites the workspace-state cache with production
    // settings. Restore it so the next source check does not prune dev tools.
    const stateFile = resolve(root, 'node_modules/.pnpm-workspace-state-v1.json');
    const workspaceState = existsSync(stateFile) ? readFileSync(stateFile) : null;
    try {
        run('corepack', ['pnpm', '--filter', target.workspace, 'deploy', '--prod', '--legacy', stage], { cwd: root, stdio: 'inherit' });
    } finally { if (workspaceState) writeFileSync(stateFile, workspaceState); }
    // deploy follows npm pack rules; ignored dist must be copied explicitly.
    run('cp', ['-a', resolve(root, target.path, 'dist'), stage]);
    for (const name of ['arbi-protocol', 'arbi-traffic', 'arbi-audit', 'arbi-simulation-core']) {
        const module = name.replace('arbi-', '');
        const destination = resolve(stage, 'node_modules/@arbi', module);
        run('cp', ['-a', resolve(root, 'packages', name, 'dist'), destination]);
    }
    if (!existsSync(resolve(stage, target.entrypoint))) throw new Error('Missing executable');
    const provenance = { schemaVersion: 'arbi.build/1.0', target: id, commit,
        sourceTree: git('rev-parse', 'HEAD^{tree}'),
        lockSha256: sha256(readFileSync(resolve(root, 'pnpm-lock.yaml'))),
        toolchain: { runner: target.runner, node: process.versions.node, pnpm: JSON.parse(readFileSync(resolve(root, 'package.json'))).packageManager },
        runId: process.env.GITHUB_RUN_ID ?? 'local', runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? '1',
        dependencies: JSON.parse(readFileSync(resolve(root, target.path, 'package.json'))).dependencies,
        scope: 'simulation-only', installationRequested: false };
    writeFileSync(resolve(stage, 'provenance.json'), JSON.stringify(provenance, null, 2) + '\n');
    const artifact = resolve(output, `${id}.tar.gz`);
    run('tar', ['--sort=name', '--mtime=@0', '--owner=0', '--group=0', '--numeric-owner', '-czf', artifact, '-C', stage, '.']);
    writeFileSync(resolve(output, `${id}.build.json`), JSON.stringify({ ...provenance,
        artifact: { file: `${id}.tar.gz`, sha256: sha256(readFileSync(artifact)), sizeBytes: readFileSync(artifact).length } }, null, 2) + '\n');
    return artifact;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) packageTarget(process.argv[2], resolve(process.argv[3]));
