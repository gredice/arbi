import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { compileModels, parseArguments, validateBosl2, validateRegistry } from './check-cad.mjs';

test('vendored BOSL2 rejects altered sources, missing license and unexpected files', t => {
    const root = mkdtempSync(join(tmpdir(), 'arbi-bosl2-test-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    cpSync('hardware/vendor/BOSL2', root, { recursive: true });
    validateBosl2(root);
    const source = join(root, 'shapes3d.scad');
    const original = readFileSync(source);
    writeFileSync(source, Buffer.concat([original, Buffer.from('// changed\n')]));
    assert.throws(() => validateBosl2(root), /upstream source changed: shapes3d.scad/);
    writeFileSync(source, original);
    const license = readFileSync(join(root, 'LICENSE'));
    rmSync(join(root, 'LICENSE'));
    assert.throws(() => validateBosl2(root), /file inventory/);
    writeFileSync(join(root, 'LICENSE'), license);
    writeFileSync(join(root, 'unexpected.scad'), 'cube(1);\n');
    assert.throws(() => validateBosl2(root), /file inventory/);
});

test('camera pod names have one public assembly and direct aliases for retired identifiers', () => {
    const current = validateRegistry();
    const models = [...current.models, ...current.archivedModels];
    const aliases = JSON.parse(readFileSync('hardware/model-aliases.json', 'utf8'));
    assert.equal(current.models.filter(m => m.id === 'camera-pod-assembly').length, 1);
    assert.ok(models.every(m => !m.id.startsWith('payload-') && !m.entrypoint.includes('/payload-') && !m.output.startsWith('payload-')));
    assert.equal(aliases['payload-assembly'], 'camera-pod-assembly');
    assert.equal(aliases['payload-rain-assembly'], 'camera-pod-assembly');
    assert.throws(() => validateRegistry(current, undefined, { old: 'missing' }), /alias target/);
    assert.throws(() => validateRegistry(current, undefined, { 'camera-pod-assembly': 'camera-pod-assembly' }), /must not shadow/);
});

test('archived sources remain traceable but cannot return to BOM mappings or current exports', () => {
    const current = validateRegistry();
    const archived = current.archivedModels.find(m => m.id === 'camera-pod-electronics-deck');
    assert.ok(current.models.some(m => m.id === 'camera-pod-integrated-deck'));
    assert.ok(!current.models.some(m => m.id === archived.id));
    const parts = JSON.parse(readFileSync('bom/catalog/parts.json', 'utf8'));
    parts.parts.find(p => p.id === 'camera-pod-chassis').fabrication.sources.push({
        modelId: archived.id, path: archived.entrypoint, revision: archived.revision, module: 'camera_pod_electronics_deck',
    });
    assert.throws(() => validateRegistry(current, parts), /references archived CAD model/);
    const broken = structuredClone(current);
    broken.archivedModels[0].supersededBy = ['missing-replacement'];
    assert.throws(() => validateRegistry(broken), /replacement must be an active model/);
    const remapped = structuredClone(current);
    remapped.archivedModels[0].bomPartIds = ['camera-pod-chassis'];
    assert.throws(() => validateRegistry(remapped), /does not match/);
});

test('booklet selection preserves the current enclosure and explicit bench alternative', () => {
    const result = spawnSync('python3', ['scripts/camera-pod-booklet/test_model_selection.py'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
});

function fixture(t, mode = 'ok', concurrentStarts = 0) {
    const root = mkdtempSync(join(tmpdir(), 'arbi-cad-test-'));
    const events = join(root, 'events.jsonl');
    const executable = join(root, 'openscad');
    writeFileSync(executable, `#!${process.execPath}
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
if (process.argv.includes('--version')) {
    console.error('OpenSCAD version 2021.01');
} else {
    const output = process.argv[process.argv.indexOf('-o') + 1];
    const id = basename(output);
    const record = (event) => appendFileSync(process.env.CAD_TEST_EVENTS, JSON.stringify({ event, id, output }) + '\\n');
    record('start');
    // Synchronize this concurrency probe instead of depending on process startup speed.
    const deadline = Date.now() + 5000;
    while (readFileSync(process.env.CAD_TEST_EVENTS, 'utf8').split('\\n').filter(line => line && JSON.parse(line).event === 'start').length < ${concurrentStarts}) {
        if (Date.now() > deadline) throw new Error('Workers did not start concurrently');
        await new Promise(resolve => setTimeout(resolve, 5));
    }
    await new Promise(resolve => setTimeout(resolve, id.startsWith('slow') ? 250 : 40));
    const bad = id.startsWith('bad');
    const mode = process.env.CAD_TEST_MODE;
    if (bad && mode === 'exit') {
        console.error('deliberate compiler failure');
        record('end');
        process.exit(2);
    }
    if (bad && mode === 'warning') console.error('WARNING: deliberate diagnostic');
    if (bad && mode === 'error') console.log('ERROR: deliberate diagnostic');
    if (!(bad && mode === 'missing')) writeFileSync(output, bad && mode === 'empty' ? '' : id);
    record('end');
}
`, { mode: 0o755 });
    const previous = { PATH: process.env.PATH, CAD_TEST_EVENTS: process.env.CAD_TEST_EVENTS, CAD_TEST_MODE: process.env.CAD_TEST_MODE };
    process.env.PATH = `${root}:${process.env.PATH}`;
    process.env.CAD_TEST_EVENTS = events;
    process.env.CAD_TEST_MODE = mode;
    t.after(() => {
        for (const [key, value] of Object.entries(previous)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
        rmSync(root, { recursive: true, force: true });
    });
    return { root, events: () => readFileSync(events, 'utf8').trim().split('\n').map(JSON.parse) };
}

const registry = (...ids) => ({ models: ids.map(id => ({ id, revision: '1.0.0', entrypoint: 'hardware/assemblies/winch/winch-drum.scad', output: `${id}.stl` })) });

test('jobs accepts positive integers and rejects malformed or duplicate flags', () => {
    assert.ok(parseArguments([]).jobs >= 1 && parseArguments([]).jobs <= 4);
    assert.equal(parseArguments(['--', '--jobs', '1']).jobs, 1);
    for (const value of [undefined, '0', '-1', '1.5', 'NaN', '1x', '9007199254740992']) {
        assert.throws(() => parseArguments(['--jobs', value]), /positive integer/);
    }
    assert.throws(() => parseArguments(['--jobs', '2', '--jobs', '3']), /only be set once/);
});

test('parallel compilation covers every output once and respects the worker limit', async t => {
    const f = fixture(t, 'ok', 3);
    const output = join(f.root, 'output');
    const models = registry('a', 'b', 'c', 'd', 'e', 'f', 'g');
    await compileModels(models, 'test compiler', output, 3);
    assert.deepEqual(readdirSync(output).sort(), models.models.map(m => m.output).sort());
    let active = 0;
    let peak = 0;
    for (const event of f.events()) {
        active += event.event === 'start' ? 1 : -1;
        peak = Math.max(peak, active);
        assert.ok(active >= 0 && active <= 3);
    }
    assert.equal(peak, 3);
    assert.equal(active, 0);
    assert.equal(f.events().filter(e => e.event === 'start').length, models.models.length);
});

test('serial and parallel workers produce the same artifacts', async t => {
    const f = fixture(t);
    const models = registry('a', 'b', 'c');
    await compileModels(models, 'test compiler', join(f.root, 'serial'), 1);
    await compileModels(models, 'test compiler', join(f.root, 'parallel'), 3);
    for (const model of models.models) {
        assert.deepEqual(readFileSync(join(f.root, 'serial', model.output)), readFileSync(join(f.root, 'parallel', model.output)));
    }
});

for (const mode of ['exit', 'warning', 'error', 'missing', 'empty']) {
    test(`${mode} fails, drains active children, stops queued work and cleans temporary artifacts`, async t => {
        const f = fixture(t, mode);
        await assert.rejects(compileModels(registry('bad', 'slow', 'queued'), 'test compiler', null, 2), /bad.*compilation failed/);
        const events = f.events();
        assert.deepEqual(events.filter(e => e.event === 'start').map(e => e.id).sort(), ['bad.stl', 'slow.stl']);
        assert.equal(events.filter(e => e.event === 'end').length, 2);
        for (const event of events) assert.equal(existsSync(event.output), false);
    });
}

test('CLI validates the full current registry before exporting every declared artifact', t => {
    const f = fixture(t);
    const output = join(f.root, 'output');
    const result = spawnSync(process.execPath, ['scripts/check-cad.mjs', '--require-openscad', '--jobs', '4', '--output-dir', output], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const models = JSON.parse(readFileSync('hardware/models.json', 'utf8')).models;
    assert.deepEqual(readdirSync(output).sort(), models.map(m => m.output).sort());
    const starts = f.events().filter(e => e.event === 'start');
    assert.equal(starts.length, models.length);
    assert.equal(new Set(starts.map(e => e.id)).size, models.length);
});


test('every BOM item has geometry and visualization assumptions cannot become fabrication evidence', () => {
    const current = validateRegistry();
    const parts = JSON.parse(readFileSync('bom/catalog/parts.json', 'utf8'));
    for (const part of parts.parts) {
        assert.ok(current.models.some(model => model.bomPartIds.includes(part.id)), part.id);
    }
    const card = current.models.find(model => model.id === 'microsd-card-32gb');
    assert.equal(card.artifactRole, 'visualization');
    assert.equal(card.geometry.status, 'approximate');
    assert.match(card.geometry.rework, /rework/);
    const uncovered = structuredClone(parts);
    uncovered.parts.push({ ...parts.parts[0], id: 'unmodeled-part' });
    assert.throws(() => validateRegistry(current, uncovered), /has no active CAD model/);
    for (const field of ['basis', 'rework']) {
        const broken = structuredClone(current);
        delete broken.models.find(model => model.id === card.id).geometry[field];
        assert.throws(() => validateRegistry(broken), /does not match/);
    }
    const manufactured = structuredClone(parts);
    manufactured.parts.find(part => part.id === card.id).fabrication = {
        process: 'openscad', modelStatus: card.status,
        sources: [{ modelId: card.id, path: card.entrypoint, revision: card.revision, module: 'arbi_catalog_visualization' }],
    };
    assert.throws(() => validateRegistry(current, manufactured), /not a fabrication model/);
});


test('superseded dock visualizations remain archived without current BOM claims', () => {
    const current = validateRegistry();
    const retired = current.archivedModels.filter(m => ['dock-latch-hardware', 'dock-weather-hood'].includes(m.id));
    assert.equal(retired.length, 2);
    assert.ok(retired.every(m => m.artifactRole === 'visualization' && m.bomPartIds.length === 0 && m.geometry.status === 'approximate'));
    const remapped = structuredClone(current);
    remapped.archivedModels.find(m => m.id === 'dock-weather-hood').bomPartIds = ['dock-weather-hood'];
    assert.throws(() => validateRegistry(remapped), /does not match/);
    const unowned = structuredClone(current);
    unowned.models.find(m => m.id === 'dock-bench-hardware').bomPartIds = [];
    assert.throws(() => validateRegistry(unowned), /does not match/);
});
