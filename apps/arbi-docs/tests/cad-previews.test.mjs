import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { strToU8, unzipSync, zipSync } from 'fflate';
import { previewAssets, previewFigures } from '../scripts/cad-previews.mjs';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(app, '../..');
const model = JSON.parse(readFileSync(join(repo, 'hardware/models.json'))).models.find((m) => m.id === 'winch-drum');
const sources = {
  [model.entrypoint]: Buffer.from('include <../../lib/winch-drum.scad>\nassembly();\n'),
  'hardware/lib/winch-drum.scad': Buffer.from('module assembly() { cube(10); }\n'),
};
// An actual PNG fixture with the renderer's declared dimensions.
const figure = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAeAAAAFoAQAAAACnTBWNAAABMklEQVR4nO3bIY4CQBAFUaiQENze/5brQIH9iA2pxUGV66SfGTszx/vh//GGPYRlWLCFZViwhWVYsIVlWLCFZViwhWVYsIVlWLCFZViwhWVYsIVlWLCFZViwhWVYsIVlWLCFZViwhWVYsIVlWLCFZViwhWVYsIW/48BOO/z+vNw/X//C59e3A9cPODDCLuT+U2EZFmxhGRZsYRkWbGEZFmxhGRZsYRkWbGEZFmxhGRZsYRkWbGEZFmxhGRZsYRkWbGEZFmxhGRZsYRkWbGEZFmxhGRZsYRkWbGEZFmxhGRZsYRkWbGEZFmxhGRZsYRkWbGEZFmxhGRZsYRkWbGHZaYfbxb0PO/Zh3IXcfyosw4ItLMOCLSzDgi0sw4ItLMOCLSzDgi0sw4ItLMOCLSzDgi0sw4ItLMOCLSzDgi0sw4ItLMOCLSzDgi0sw4ItLMOCLSzDgg/AD/aPCtKS42BuAAAAAElFTkSuQmCC', 'base64');

function pack(overrides = {}, input = sources, image = figure, style = 'cad-line-art-v2') {
  const entry = {
    entrypoint: model.entrypoint, revision: model.revision, output: model.output,
    figure: `figures/${model.id}.png`, sha256: digest(image),
    sourceHashes: Object.fromEntries(Object.entries(input).map(([path, bytes]) => [path, digest(bytes)])),
    ...overrides,
  };
  return zipSync({
    'ARBI-CAD-previews/manifest.json': strToU8(JSON.stringify({ schemaVersion: 1, style, models: { [model.id]: entry } })),
    [`ARBI-CAD-previews/figures/${model.id}.png`]: image,
  });
}

// Two valid, disconnected triangles in millimetres for the compiler/browser asset boundary.
const referenceStl = Buffer.from('solid reference\n' + [0, 20].map((x) =>
  `facet normal 0 0 1\nouter loop\nvertex ${x} 0 0\nvertex ${x + 1} 0 0\nvertex ${x} 1 0\nendloop\nendfacet\n`).join('') + 'endsolid reference\n');
function referencePack(overrides = {}, input = sources) {
  const files = unzipSync(pack({ referenceMesh: `references/${model.id}.stl`, referenceMeshSha256: digest(referenceStl), ...overrides }, input));
  files[`ARBI-CAD-previews/references/${model.id}.stl`] = referenceStl;
  return zipSync(files);
}

test('CSG inspection meshes require intact checksums and complete current source evidence', () => {
  const read = (path) => sources[path];
  const assets = previewAssets(referencePack(), [model], read);
  assert.deepEqual(Buffer.from(assets.referenceMeshes[model.id]), referenceStl);
  assert.deepEqual(assets.meshes, {}, 'reference surfaces never enter the individual part mesh inventory');
  for (const overrides of [{ referenceMesh: '../unexpected.stl' }, { referenceMeshSha256: 'invalid' }, { revision: '0.0.0' }]) {
    assert.deepEqual(previewAssets(referencePack(overrides), [model], read).referenceMeshes, {});
  }
  const missing = unzipSync(referencePack());
  delete missing[`ARBI-CAD-previews/references/${model.id}.stl`];
  assert.deepEqual(previewAssets(zipSync(missing), [model], read).referenceMeshes, {});
  const corrupt = unzipSync(referencePack());
  corrupt[`ARBI-CAD-previews/references/${model.id}.stl`] = strToU8('corrupt');
  assert.deepEqual(previewAssets(zipSync(corrupt), [model], read).referenceMeshes, {});
  assert.deepEqual(previewAssets(referencePack(), [model], () => Buffer.from('changed')).referenceMeshes, {});
  assert.deepEqual(previewAssets(referencePack({}, { [model.entrypoint]: sources[model.entrypoint] }), [model], read).referenceMeshes, {});
  assert.deepEqual(previewAssets(referencePack(), [{ ...model, artifactRole: 'fabrication' }], read).referenceMeshes, {});
  assert.deepEqual(previewAssets(pack(), [model], read).referenceMeshes, {}, 'older packs still supply the static figure');
});

test('a CSG reference receives a figure without needing a booklet drawing or fabrication mesh', () => {
  assert.ok(model.output.endsWith('.csg'));
  const result = previewFigures(pack(), [model], (path) => sources[path]);
  assert.deepEqual(Buffer.from(result[model.id]), figure);
});

test('visualization meshes require current source evidence and an intact mesh checksum', () => {
  const visualization = { ...model, artifactRole: 'visualization', output: 'winch-drum-r2.1.1.stl' };
  const stl = Buffer.from('solid sample\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid sample');
  const files = {
    'ARBI-CAD-previews/manifest.json': strToU8(JSON.stringify({ schemaVersion: 1, style: 'cad-line-art-v2', models: {
      [model.id]: { ...JSON.parse(new TextDecoder().decode((unzipSync(pack()))['ARBI-CAD-previews/manifest.json'])).models[model.id],
        output: visualization.output, mesh: `meshes/${visualization.output}`, meshSha256: digest(stl) },
    } })),
    [`ARBI-CAD-previews/figures/${model.id}.png`]: figure,
    [`ARBI-CAD-previews/meshes/${visualization.output}`]: stl,
  };
  assert.deepEqual(Buffer.from(previewAssets(zipSync(files), [visualization], (path) => sources[path]).meshes[model.id]), stl);
  assert.deepEqual(previewAssets(zipSync(files), [{ ...visualization, artifactRole: 'reference' }], (path) => sources[path]).meshes, {});
  assert.deepEqual(previewAssets(zipSync({ ...files, [`ARBI-CAD-previews/meshes/${visualization.output}`]: strToU8('corrupt') }), [visualization], (path) => sources[path]).meshes, {});
  assert.deepEqual(previewAssets(zipSync(files), [visualization], () => Buffer.from('changed')).meshes, {});
});

test('legacy packs with shaded reference figures cannot enter the line-art inventory', () => {
  assert.throws(() => previewFigures(pack({}, sources, figure, 'cad-preview-v1'), [model], (path) => sources[path]), /line-art figures required/);
});

test('material components are source-checked, atomic, and survive the site compiler', () => {
  const servo = JSON.parse(readFileSync(join(repo, 'hardware/models.json'))).models.find((m) => m.id === 'micro-pan-tilt-servo');
  const input = {};
  const visit = (path) => {
    if (input[path]) return;
    input[path] = readFileSync(join(repo, path));
    for (const match of input[path].toString().matchAll(/^\s*(?:include|use)\s*<([^>]+)>/gm))
      visit(new URL(match[1], `file:///${path}`).pathname.slice(1));
  };
  visit(servo.entrypoint);
  const stl = strToU8('solid sample\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 1\nendloop\nendfacet\nendsolid sample');
  const makePack = (change = () => {}) => {
    const part = { node: 'blue-case', mesh: `appearances/${servo.id}/blue-case.stl`, sha256: digest(stl),
      material: { color: [0.08, 0.32, 0.86], roughness: 0.22, metalness: 0, transmission: 0.65, thickness: 0.75, ior: 1.46 } };
    const entry = { ...servo, figure: `figures/${servo.id}.png`, sha256: digest(figure),
      sourceHashes: Object.fromEntries(Object.entries(input).map(([p, b]) => [p, digest(b)])),
      appearance: { envelope: [31.8, 9, 24.5], parts: [part] } };
    const files = { [`ARBI-CAD-previews/${entry.figure}`]: figure, [`ARBI-CAD-previews/${part.mesh}`]: stl };
    change(entry, files);
    files['ARBI-CAD-previews/manifest.json'] = strToU8(JSON.stringify({ schemaVersion: 1, style: 'cad-line-art-v2', models: { [servo.id]: entry } }));
    return zipSync(files);
  };
  const appearance = previewAssets(makePack(), [servo], (p) => input[p]).appearances[servo.id];
  assert.deepEqual(appearance.envelope, [31.8, 9, 24.5]);
  assert.equal(appearance.parts[0].material.transmission, 0.65);
  for (const change of [
    (e, f) => { delete f[`ARBI-CAD-previews/${e.appearance.parts[0].mesh}`]; },
    (e) => { e.appearance.parts[0].sha256 = 'corrupt'; },
    (e) => { e.appearance.parts[0].mesh = '../outside.stl'; },
    (e) => { e.appearance.parts.push(e.appearance.parts[0]); },
    (e) => { e.appearance.parts[0].material.transmission = 2; },
    (e) => { e.appearance.envelope = [31.8, -9, 24.5]; },
  ]) assert.deepEqual(previewAssets(makePack(change), [servo], (p) => input[p]).appearances, {});
  assert.deepEqual(previewAssets(makePack(), [servo], () => Buffer.from('changed')).appearances, {});
  const output = mkdtempSync(join(tmpdir(), 'arbi-materials-test-'));
  try {
    const archive = join(output, 'previews.zip');
    writeFileSync(archive, makePack());
    const data = join(output, 'data');
    execFileSync(process.execPath, ['scripts/compile-data.mjs'], {
      cwd: app, env: { ...process.env, ARBI_OFFLINE: '1', ARBI_CAD_PREVIEW_PACK: archive, ARBI_DATA_DIR: data }, stdio: 'pipe',
    });
    const mesh = JSON.parse(readFileSync(join(data, 'site.json'))).meshes[servo.id];
    assert.equal(mesh.kind, 'components');
    assert.equal(mesh.parts[0].material.transmission, 0.65);
    assert.deepEqual(mesh.envelope, [31.8, 9, 24.5]);
    assert.deepEqual(readFileSync(join(data, mesh.parts[0].url)), Buffer.from(stl));
  } finally { rmSync(output, { recursive: true, force: true }); }
});

test('changed revision, entrypoint or shared geometry and omitted includes reject stale previews', () => {
  for (const overrides of [{ revision: '0.0.0' }, { output: 'old.csg' }, { entrypoint: 'hardware/old.scad' }]) {
    assert.deepEqual(previewFigures(pack(overrides), [model], (path) => sources[path]), {});
  }
  const changed = { ...sources, 'hardware/lib/winch-drum.scad': Buffer.from('module assembly() { cube(20); }') };
  assert.deepEqual(previewFigures(pack(), [model], (path) => changed[path]), {});
  assert.deepEqual(previewFigures(pack({}, { [model.entrypoint]: sources[model.entrypoint] }), [model], (path) => sources[path]), {});
});

test('corrupt images, incorrect sizes and unexpected figure paths cannot enter site data', () => {
  for (const overrides of [{ sha256: 'invalid' }, { figure: '../unexpected.png' }]) {
    assert.deepEqual(previewFigures(pack(overrides), [model], (path) => sources[path]), {});
  }
  const wrongSize = Buffer.from(figure);
  wrongSize.writeUInt32BE(1, 16);
  assert.deepEqual(previewFigures(pack({}, sources, wrongSize), [model], (path) => sources[path]), {});
  assert.deepEqual(previewFigures(pack({}, sources, Buffer.from('not a PNG')), [model], (path) => sources[path]), {});
});

test('the offline compiler consumes a current preview pack and writes its reference figure', () => {
  const output = mkdtempSync(join(tmpdir(), 'arbi-previews-test-'));
  try {
    const input = {};
    const visit = (path) => {
      if (input[path]) return;
      const bytes = input[path] = readFileSync(join(repo, path));
      for (const match of bytes.toString('utf8').matchAll(/^\s*(?:include|use)\s*<([^>]+)>/gm)) {
        visit(new URL(match[1], `file:///${path}`).pathname.slice(1));
      }
    };
    visit(model.entrypoint);
    const archive = join(output, 'previews.zip');
    writeFileSync(archive, referencePack({}, input));
    const data = join(output, 'data');
    execFileSync(process.execPath, ['scripts/compile-data.mjs'], {
      cwd: app,
      env: { ...process.env, ARBI_OFFLINE: '1', ARBI_CAD_PREVIEW_PACK: archive, ARBI_DATA_DIR: data },
      stdio: 'pipe',
    });
    const site = JSON.parse(readFileSync(join(data, 'site.json')));
    assert.ok(site.registry.models.some((m) => m.id === 'camera-pod-assembly'));
    assert.ok(!site.registry.models.some((m) => m.id.startsWith('payload-')));
    assert.equal(site.registry.models.filter((m) => m.id === 'camera-pod-assembly').length, 1);
    assert.ok(site.registry.models.some((m) => m.id === 'camera-pod-integrated-deck'));
    assert.ok(!site.registry.models.some((m) => m.id === 'camera-pod-electronics-deck'));
    assert.ok(site.registry.archivedModels.some((m) => m.id === 'camera-pod-electronics-deck'));
    const archivedIds = new Set(site.registry.archivedModels.map((m) => m.id));
    for (const m of site.registry.models) assert.ok(!archivedIds.has(m.id));
    for (const id of archivedIds) {
      assert.equal(site.downloads[id], undefined);
      assert.equal(site.meshes[id], undefined);
      assert.equal(site.figures[id], undefined);
      assert.equal(site.referenceMeshes[id], undefined);
    }
    for (const p of site.bom.parts) {
      for (const source of p.fabrication?.sources ?? []) assert.ok(!archivedIds.has(source.modelId));
    }
    const coupling = site.bom.parts.find((part) => part.id === 'flexible-jaw-coupling-8mm');
    assert.equal(coupling.actualDelivered.amount, '16.12');
    assert.equal(coupling.actualDelivered.importCharges, '3.76');
    assert.equal(coupling.actualDelivered.quantity, '4');
    assert.equal(coupling.quotedPrice.amount, '3.09');
    assert.equal(coupling.delivery.amount, '0');
    assert.equal(coupling.customsPolicy.startsOn, '2026-07-01');
    assert.equal(coupling.customsPolicy.endsOn, null);
    assert.ok(!coupling.warnings.some((warning) => warning.includes('Tax/VAT')));
    assert.ok(site.bom.summary.warningCounts.critical > 0);
    assert.ok(site.bom.summary.warningCounts.warning > 0);
    assert.ok(site.bom.summary.warningCounts.issue > 0);
    assert.equal(Object.values(site.bom.summary.warningCounts).reduce((sum, count) => sum + count, 0), site.bom.summary.warningCount);
    const pulley = site.bom.parts.find((part) => part.id === 'top-positioning-line-pulley');
    assert.ok(pulley.warningDetails.some((warning) => warning.code === 'approximate-geometry' && warning.severity === 'critical'));
    assert.ok(pulley.warningDetails.some((warning) => warning.message.includes('Tax/VAT') && warning.severity === 'issue'));
    assert.ok(site.bom.summary.warningDetails.some((warning) => warning.code === 'approximate-geometry' && warning.severity === 'critical' && warning.partIds.includes(pulley.id)));
    for (const id of ['camera-pod-chassis', 'winch-round-pole-covers']) {
      const part = site.bom.parts.find((part) => part.id === id);
      assert.ok(part.warningDetails.some((warning) => warning.severity === 'critical' && warning.code === 'temporary-cable-tie'));
      assert.ok(site.bom.summary.warningDetails.some((warning) => warning.severity === 'critical' && warning.code === 'temporary-cable-tie' && warning.partIds.includes(id)));
      assert.equal(site.bom.summary.warningDetails.filter((warning) => warning.code === 'temporary-cable-tie' && warning.partIds.includes(id)).length, 1);
    }
    assert.equal(site.figures[model.id], `figures/${model.id}.png`);
    assert.ok(existsSync(join(data, site.figures[model.id])));
    assert.deepEqual(readFileSync(join(data, site.figures[model.id])), figure);
    assert.equal(site.meshes[model.id], undefined, 'a reference preview must not become a fabrication mesh');
    assert.deepEqual(site.referenceMeshes[model.id], { kind: 'stl', url: `inspection/references/${model.id}.stl` });
    assert.deepEqual(readFileSync(join(data, site.referenceMeshes[model.id].url)), referenceStl);
    assert.deepEqual(site.downloads[model.id], { release: null, packs: [] }, 'inspection STL never replaces the declared CSG download');
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
});
