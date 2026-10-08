import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { checkResults } from './check-results.mjs';
import { detectChanges, plan, readWorkspaces } from './plan.mjs';

const workspaces = readWorkspaces();
const select = (...paths) => plan(paths.map((path) => ({ path, status: 'M' })), { workspaces });
const names = (result) => result.workspace_matrix.include.map((workspace) => workspace.name);
const variants = (result) => result.booklet_matrix.include.map((booklet) => booklet.variant);

test('website source and repository content skip all dashboard/edge/package work', () => {
    for (const path of ['apps/arbi-docs/src/app/page.tsx', 'docs/project/goals-and-v1-scope.md', 'README.md', 'docs/assets/brand/arbi-logo.svg']) {
        const result = select(path);
        assert.deepEqual(names(result), ['@arbi/docs'], path);
        for (const job of ['bom', 'cad', 'previews', 'booklets', 'recovery', 'release']) assert.equal(result[job], false, `${path}: ${job}`);
    }
});

test('assembly models build their owning booklets and website without dashboard tests', () => {
    const winch = select('hardware/assemblies/winch/winch-cover.scad');
    assert.deepEqual(names(winch), ['@arbi/docs']);
    assert.equal(winch.cad, true);
    assert.deepEqual(variants(winch), ['winch']);
    assert.deepEqual(variants(select('hardware/assemblies/camera-pod/payload-tray.scad')), ['bench', 'enclosure']);
    const dock = select('hardware/assemblies/dock/dock.scad');
    assert.equal(dock.cad, true);
    assert.equal(dock.booklets, false);
});

test('shared geometry, registry, rendering helpers and licenses cover every booklet', () => {
    for (const path of ['hardware/lib/arbi.scad', 'hardware/models.json', 'hardware/models.schema.json', 'scripts/winch-booklet/render_figures.py', 'scripts/winch-booklet/fonts/DejaVuSans.ttf', 'LICENSE']) {
        assert.deepEqual(variants(select(path)), ['winch', 'bench', 'enclosure', 'corner'], path);
    }
    assert.deepEqual(variants(select('scripts/check-winch-pole-meshes.py')), ['winch']);
    assert.deepEqual(variants(select('scripts/payload-booklet/check_service.py')), ['bench', 'enclosure']);
});

test('BOM edits run canonical reports and BOM tests, with CAD only for part mappings', () => {
    const offers = select('bom/catalog/offers.json');
    assert.deepEqual(names(offers), ['@arbi/bom', '@arbi/docs']);
    assert.equal(offers.bom, true);
    assert.equal(offers.cad, false);
    assert.equal(select('bom/catalog/parts.json').cad, true);
    assert.equal(select('packages/arbi-bom/src/cli.ts').bom, true);
});

test('CAD preview tooling selects geometry and preview validation without unrelated workspaces', () => {
    for (const path of ['scripts/cad-previews/build.py', 'scripts/cad-previews/reference_meshes.py', 'scripts/check-cad.test.mjs']) {
        const result = select(path);
        assert.equal(result.cad, true, path);
        assert.equal(result.previews, true, path);
        assert.equal(result.workspace, false, path);
        assert.equal(result.bom, false, path);
        assert.equal(result.booklets, false, path);
    }
    const release = plan([{ path: 'scripts/cad-previews/requirements.txt', status: 'M' }], { eventName: 'push' });
    assert.equal(release.release, true);
    assert.equal(release.previews, true);
    assert.deepEqual(variants(release), ['winch', 'bench', 'enclosure', 'corner']);
});

test('versioned release tooling selects all required artifacts and website tests, without dashboard work', () => {
    for (const path of ['scripts/cad-release-data.mjs', 'scripts/publish-cad-release.mjs', 'scripts/check-site-release.mjs']) {
        const result = plan([{ path, status: 'M' }], { eventName: 'push' });
        assert.deepEqual(names(result), ['@arbi/docs']);
        for (const job of ['cad', 'previews', 'booklets', 'release']) assert.equal(result[job], true);
        assert.equal(result.bom, false);
        assert.equal(result.recovery, false);
    }
});

test('reverse dependency graph includes consumers, never unrelated packages', () => {
    assert.deepEqual(names(select('apps/arbi-dashboard/src/jobs/worker.ts')), ['@arbi/dashboard']);
    assert.deepEqual(names(select('apps/arbi-edge-controller/src/cli.ts')), ['@arbi/dashboard', '@arbi/edge-controller']);
    assert.deepEqual(names(select('packages/arbi-gredice/src/index.ts')), ['@arbi/dashboard', '@arbi/gredice']);
    assert.deepEqual(names(select('packages/arbi-traffic/src/index.ts')), ['@arbi/dashboard', '@arbi/edge-controller', '@arbi/traffic']);
    assert.deepEqual(names(select('packages/arbi-audit/src/index.ts')), ['@arbi/audit', '@arbi/dashboard', '@arbi/edge-controller']);
    assert.deepEqual(names(select('packages/arbi-simulation-core/src/index.ts')), ['@arbi/dashboard', '@arbi/edge-controller', '@arbi/simulation-core']);
    assert.deepEqual(names(select('packages/arbi-protocol/schema/message.schema.json')), ['@arbi/audit', '@arbi/dashboard', '@arbi/edge-controller', '@arbi/gredice', '@arbi/protocol', '@arbi/simulation-core', '@arbi/traffic']);
});

test('dashboard native integration retains the independent edge consumer boundary', () => {
    const result = select('apps/arbi-edge-controller/scripts/realtime-fixture-consumer.mjs');
    assert.deepEqual(names(result), ['@arbi/dashboard', '@arbi/edge-controller']);
    assert.equal(result.cad, false);
    assert.equal(result.bom, false);
    assert.equal(result.booklets, false);
});

test('new workspace manifests join the reverse dependency graph automatically', () => {
    const future = [...workspaces, { name: '@arbi/future-app', path: 'apps/arbi-future-app', dependencies: ['@arbi/audit'] }];
    const result = plan([{ path: 'packages/arbi-protocol/src/index.ts', status: 'M' }], { workspaces: future });
    assert.ok(names(result).includes('@arbi/future-app'));
    assert.equal(names(result).includes('@arbi/docs'), false);
});

test('manual and shared tooling changes select all work; missing push baseline is conservative', () => {
    for (const path of ['.github/workflows/ci.yml', '.github/actions/setup-workspace/action.yml', 'scripts/ci/plan.mjs']) {
        const result = select(path);
        assert.deepEqual(names(result), workspaces.map((workspace) => workspace.name), path);
        for (const job of ['bom', 'cad', 'previews', 'booklets', 'recovery']) assert.equal(result[job], true, `${path}: ${job}`);
        assert.equal(result.release, false);
    }
    assert.deepEqual(names(plan(null)), workspaces.map((workspace) => workspace.name));
    assert.equal(detectChanges('workflow_dispatch', {}), null);
    assert.equal(detectChanges('push', { before: '0'.repeat(40), after: '1'.repeat(40) }), null);
});

test('shared software tooling validates software without rendering or publishing unchanged hardware', () => {
    for (const path of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', '.nvmrc', '.npmrc', 'tsconfig.base.json', 'turbo.json']) {
        const result = plan([{ path, status: 'M' }], { eventName: 'push' });
        assert.deepEqual(names(result), workspaces.map((workspace) => workspace.name));
        assert.equal(result.bom, true);
        assert.equal(result.cad, !['tsconfig.base.json', 'turbo.json'].includes(path));
        assert.equal(result.previews, false);
        assert.equal(result.booklets, false);
        assert.equal(result.release, false);
    }
});

test('model documentation deletion triggers CAD; removed workspaces cannot vanish silently', () => {
    assert.equal(plan([{ path: 'hardware/assemblies/winch/README.md', status: 'D' }]).cad, true);
    const result = plan([{ path: 'docs/model.md', status: 'D' }], { modelDocs: ['docs/model.md'] });
    assert.equal(result.cad, true);
    assert.equal(select('hardware/assemblies/winch/README.md').cad, false);
    assert.equal(names(select('packages/removed/package.json')).length, workspaces.length);
    assert.equal(names(select('scripts/new-validator.mjs')).length, workspaces.length);
});

test('main release expands to all commit-matched packs and CAD; ordinary content does not publish', () => {
    for (const path of ['hardware/assemblies/dock/dock.scad', 'scripts/payload-booklet/build.py', 'hardware/assemblies/winch/README.md']) {
        const result = plan([{ path, status: 'M' }], { eventName: 'push' });
        assert.equal(result.release, true);
        assert.equal(result.cad, true);
        assert.deepEqual(variants(result), ['winch', 'bench', 'enclosure', 'corner']);
    }
    assert.equal(plan([{ path: 'docs/project/goals-and-v1-scope.md', status: 'M' }], { eventName: 'push' }).release, false);
    assert.equal(plan(null, { eventName: 'workflow_dispatch', ref: 'refs/heads/feature' }).release, false);
    assert.equal(plan(null, { eventName: 'workflow_dispatch' }).release, true);
});

test('empty changes skip expensive jobs and architecture experiments have their own job', () => {
    const result = plan([]);
    for (const job of ['workspace', 'bom', 'cad', 'previews', 'booklets', 'recovery', 'release']) assert.equal(result[job], false);
    assert.equal(select('scripts/spikes/software-recovery.test.mjs').recovery, true);
    assert.equal(select('scripts/spikes/software-recovery.test.mjs').workspace, false);
});

test('Git detection covers full pushes, PR merge bases, deletions, renames and force pushes', () => {
    const root = mkdtempSync(join(tmpdir(), 'arbi-ci-git-'));
    const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim();
    const commit = (path, content) => {
        writeFileSync(join(root, path), content);
        git('add', '.');
        git('commit', '-m', path);
        return git('rev-parse', 'HEAD');
    };
    try {
        git('init', '-b', 'main');
        git('config', 'user.name', 'CI fixture');
        git('config', 'user.email', 'ci@example.invalid');
        const base = commit('original.md', 'baseline');
        git('switch', '-c', 'feature');
        commit('first.md', 'first');
        git('mv', 'original.md', 'renamed file.md');
        git('commit', '-m', 'rename');
        const head = commit('last.md', 'last');
        const push = detectChanges('push', { before: base, after: head }, root);
        assert.deepEqual(push, [{ status: 'A', path: 'first.md' }, { status: 'A', path: 'last.md' }, { status: 'D', path: 'original.md' }, { status: 'A', path: 'renamed file.md' }]);
        git('switch', 'main');
        const updatedBase = commit('main-only.md', 'unrelated main commit');
        assert.deepEqual(detectChanges('pull_request', { pull_request: { base: { sha: updatedBase }, head: { sha: head } } }, root), push);
        assert.ok(detectChanges('push', { before: head, after: updatedBase }, root).some((change) => change.path === 'first.md' && change.status === 'D'));
        assert.equal(detectChanges('push', { before: 'f'.repeat(40), after: updatedBase }, root), null);
        assert.throws(() => detectChanges('pull_request', { pull_request: { base: { sha: 'invalid' }, head: { sha: head } } }, root), /full commit SHAs/u);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test('required gate rejects failed, cancelled, unknown and unexpected skipped work', () => {
    const needs = {
        changes: { result: 'success', outputs: { workspace: 'true', bom: 'false', cad: 'false', previews: 'false', booklets: 'false', recovery: 'false' } },
        repository: { result: 'success' },
        workspace: { result: 'success' },
        bom: { result: 'skipped' }, cad: { result: 'skipped' }, previews: { result: 'skipped' }, booklets: { result: 'skipped' }, recovery: { result: 'skipped' },
    };
    assert.doesNotThrow(() => checkResults(needs));
    for (const job of ['changes', 'repository', 'workspace', 'bom', 'cad', 'previews', 'booklets', 'recovery']) {
        for (const result of ['failure', 'cancelled', 'unknown']) assert.throws(() => checkResults({ ...needs, [job]: { ...needs[job], result } }));
    }
    assert.throws(() => checkResults({ ...needs, workspace: { result: 'skipped' } }));
    for (const selection of [undefined, '', 'unknown']) {
        assert.throws(() => checkResults({ ...needs, changes: { ...needs.changes, outputs: { ...needs.changes.outputs, cad: selection } } }));
    }
    assert.throws(() => checkResults({ ...needs, changes: { ...needs.changes, outputs: { ...needs.changes.outputs, cad: 'true' } } }));
});


test('corner assembly and instructions regenerate the owning package; main publishes all variants', () => {
    for (const path of ['hardware/assemblies/corner-station/corner-head-hood.scad', 'docs/assemblies/corner-station/design-package.md', 'scripts/corner-support/build.py', 'scripts/corner-support/check.py']) {
        const result = select(path);
        assert.deepEqual(variants(result), ['corner']);
        assert.equal(result.recovery, false);
        assert.equal(names(result).includes('@arbi/dashboard'), false);
        assert.equal(plan([{ path, status: 'M' }], { eventName: 'push' }).release, true);
    }
});
