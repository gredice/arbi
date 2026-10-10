import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { targets } from '../software-release/targets.mjs';

export const repository = fileURLToPath(new URL('../../', import.meta.url));
const variants = [
    { variant: 'winch', script: 'scripts/winch-booklet/build.py', artifact: 'ARBI-winch' },
    { variant: 'bench', script: 'scripts/camera-pod-booklet/build.py', artifact: 'ARBI-camera-pod-bench' },
    { variant: 'enclosure', script: 'scripts/camera-pod-booklet/build.py', artifact: 'ARBI-camera-pod-enclosure' },
    { variant: 'corner', script: 'scripts/corner-support/build.py', artifact: 'ARBI-corner-support' },
    { variant: 'dock', script: 'scripts/dock-booklet/build.py', artifact: 'ARBI-dock' },
];
// The native dashboard realtime test starts a separately built edge consumer.
// This test-only dependency is deliberately absent from the deployed app graph.
const integrationDependencies = { '@arbi/dashboard': ['@arbi/edge-controller'] };

export function readWorkspaces(root = repository) {
    return ['apps', 'packages'].flatMap((parent) =>
        readdirSync(resolve(root, parent), { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => {
                const path = `${parent}/${entry.name}`;
                const manifest = JSON.parse(readFileSync(resolve(root, path, 'package.json'), 'utf8'));
                const dependencies = Object.assign({}, manifest.dependencies, manifest.devDependencies, manifest.optionalDependencies, manifest.peerDependencies);
                return { name: manifest.name, path, dependencies: Object.keys(dependencies).filter((name) => dependencies[name].startsWith('workspace:')) };
            }),
    ).sort((a, b) => a.name.localeCompare(b.name));
}

// null means all work is required (manual dispatch, initial push or unavailable
// push baseline). Deleted paths remain visible; renames are a deletion + addition.
export function detectChanges(eventName, event, root = repository) {
    if (eventName === 'workflow_dispatch') return null;
    const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const head = eventName === 'pull_request' ? event.pull_request.head.sha : event.after;
    const base = eventName === 'pull_request' ? event.pull_request.base.sha : event.before;
    if (!['push', 'pull_request'].includes(eventName)) throw new Error(`Unsupported CI event: ${eventName}`);
    if (![base, head].every((sha) => /^[a-f0-9]{40}$/u.test(sha))) throw new Error('Expected full commit SHAs');
    if (eventName === 'push') {
        if (/^0{40}$/u.test(base)) return null;
        try {
            git('cat-file', '-e', `${base}^{commit}`);
        } catch {
            try {
                git('fetch', '--no-tags', '--depth=1', 'origin', base);
            } catch {
                console.warn('Push baseline unavailable; validating all inputs.');
                return null;
            }
        }
    }
    const range = eventName === 'pull_request' ? [`${base}...${head}`] : [base, head];
    const fields = git('diff', '--no-renames', '--name-status', '-z', ...range, '--').split('\0');
    fields.pop();
    const changes = [];
    for (let i = 0; i < fields.length; i += 2) changes.push({ status: fields[i], path: fields[i + 1] });
    return changes;
}

export function plan(changes, { workspaces = readWorkspaces(), eventName = 'pull_request', ref = 'refs/heads/main', modelDocs = [] } = {}) {
    const paths = changes?.map((change) => change.path) ?? [];
    const deleted = changes?.filter((change) => change.status === 'D').map((change) => change.path) ?? [];
    const under = (prefix) => paths.some((path) => path.startsWith(prefix));
    const has = (...names) => paths.some((path) => names.includes(path));
    const releaseTooling = has('scripts/cad-release-data.mjs', 'scripts/publish-cad-release.mjs', 'scripts/check-site-release.mjs');
    const ownedScripts = ['scripts/check-docs.mjs', 'scripts/check-cad.mjs', 'scripts/check-cad.test.mjs', 'scripts/check-booklet.py', 'scripts/check-winch-cover-meshes.py', 'scripts/check-winch-pole-meshes.py', 'scripts/cad-release-data.mjs', 'scripts/publish-cad-release.mjs', 'scripts/check-site-release.mjs'];
    const unknownWorkspace = paths.some((path) => /^(apps|packages)\//u.test(path) && !workspaces.some((workspace) => path.startsWith(`${workspace.path}/`)));
    const unknownScript = paths.some((path) => path.startsWith('scripts/') && !ownedScripts.includes(path) && !/^scripts\/(ci|spikes|cad-previews|winch-booklet|camera-pod-booklet|corner-support|dock-booklet)\//u.test(path));
    const full = changes === null || unknownWorkspace || unknownScript || under('.github/workflows/') || under('.github/actions/') || under('scripts/ci/') || under('scripts/software-release/');
    const softwareFull = full || has('package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'turbo.json', 'tsconfig.base.json', '.npmrc', '.nvmrc');
    const cadToolchain = full || has('package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', '.npmrc', '.nvmrc');
    const selected = new Set();
    const select = (name) => {
        if (!workspaces.some((workspace) => workspace.name === name)) throw new Error(`Missing CI workspace: ${name}`);
        selected.add(name);
    };
    for (const workspace of workspaces) if (softwareFull || under(`${workspace.path}/`)) selected.add(workspace.name);
    if (releaseTooling || under('docs/') || under('hardware/') || under('bom/') || has('README.md')) select('@arbi/docs');
    if (under('bom/')) select('@arbi/bom');
    // Walk reverse dependencies to a fixed point, including transitive consumers.
    let previous;
    do {
        previous = selected.size;
        for (const workspace of workspaces) {
            const dependencies = [...workspace.dependencies, ...(integrationDependencies[workspace.name] ?? [])];
            if (dependencies.some((name) => selected.has(name))) selected.add(workspace.name);
        }
    } while (selected.size !== previous);

    let previews = full || releaseTooling || under('hardware/vendor/') || paths.some((path) => /^hardware\/.*\.scad$/u.test(path)) || has('hardware/models.json', 'hardware/models.schema.json', 'hardware/model-aliases.json', 'scripts/check-cad.mjs', 'scripts/check-cad.test.mjs') || under('scripts/cad-previews/');
    let cad = cadToolchain || previews || has('bom/catalog/parts.json') || deleted.some((path) => path.startsWith('hardware/') || modelDocs.includes(path));
    const sharedBooklets = full || releaseTooling || under('hardware/lib/') || under('hardware/vendor/') || has('hardware/models.json', 'hardware/models.schema.json', 'hardware/model-aliases.json', 'scripts/check-booklet.py', 'docs/project/industrial-design.md', 'LICENSE') || under('scripts/winch-booklet/');
    const winch = sharedBooklets || under('hardware/assemblies/winch/') || has('hardware/assemblies/camera-pod/camera-pod-spider.scad', 'scripts/check-winch-cover-meshes.py', 'scripts/check-winch-pole-meshes.py');
    const pod = sharedBooklets || under('hardware/assemblies/camera-pod/') || under('scripts/camera-pod-booklet/');
    const corner = sharedBooklets || under('hardware/assemblies/corner-station/') || under('docs/assemblies/corner-station/') || under('scripts/corner-support/');
    const dock = sharedBooklets || has('scripts/cad-previews/csg.py', 'bom/catalog/parts.json', 'bom/catalog/fabrication.json', 'bom/assemblies/assemblies.json') || under('scripts/corner-support/') || under('hardware/assemblies/dock/') || under('hardware/assemblies/camera-pod/') || under('docs/assemblies/dock/') || under('scripts/dock-booklet/');
    // Every main release contains all five packs from this commit. PRs can build
    // only the affected assembly; release runs need the entire snapshot.
    const releaseInputs = previews || winch || pod || corner || dock;
    const release = ref === 'refs/heads/main' && eventName !== 'pull_request' && releaseInputs;
    if (release) { cad = true; previews = true; }
    const booklets = variants.filter(({ variant }) => release || (variant === 'winch' ? winch : variant === 'corner' ? corner : variant === 'dock' ? dock : pod));
    const matrix = workspaces.filter((workspace) => selected.has(workspace.name)).map(({ name, path }) => ({ name, path }));
    const artifacts = targets.filter(target => selected.has(target.workspace));
    return {
        workspace: matrix.length > 0,
        workspace_matrix: { include: matrix },
        bom: softwareFull || under('bom/') || selected.has('@arbi/bom'),
        cad,
        previews,
        booklets: booklets.length > 0,
        booklet_matrix: { include: booklets },
        recovery: softwareFull || under('scripts/spikes/'),
        release,
        software: artifacts.length > 0,
        software_matrix: { include: artifacts.map(({ id, workspace, runner }) => ({ id, workspace, runner })) },
    };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const eventName = process.env.GITHUB_EVENT_NAME;
    const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
    const modelDocs = JSON.parse(readFileSync(resolve(repository, 'hardware/models.json'), 'utf8')).models.map((model) => model.documentation);
    const result = plan(detectChanges(eventName, event), { eventName, ref: process.env.GITHUB_REF, modelDocs });
    console.log(JSON.stringify(result, null, 2));
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(result).map(([name, value]) => `${name}=${JSON.stringify(value)}\n`).join(''));
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Selected CI work\n\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\`\n`);
}
