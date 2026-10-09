import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { strToU8, zipSync } from 'fflate';
import { previewAssets } from '../scripts/cad-previews.mjs';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(app, '../..');
const models = JSON.parse(readFileSync(join(repo, 'hardware/models.json'))).models;
const reference = models.find((model) => model.id === 'control-cabinet-assembly');
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const root = 'ARBI-CAD-previews/';
const sources = {};
function visit(path) {
  if (sources[path]) return;
  const bytes = sources[path] = readFileSync(join(repo, path));
  for (const match of bytes.toString().matchAll(/^\s*(?:include|use)\s*<([^>]+)>/gm)) {
    visit(new URL(match[1], `file:///${path}`).pathname.slice(1));
  }
}
visit(reference.entrypoint);
// Only the PNG header is relevant to these pack boundary tests.
const figure = Buffer.alloc(24);
Buffer.from('89504e470d0a1a0a', 'hex').copy(figure);
figure.writeUInt32BE(480, 16);
figure.writeUInt32BE(360, 20);
const stl = strToU8('solid sample\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 1\nendloop\nendfacet\nendsolid sample');

function pack(change = () => {}) {
  const parts = ['power-supply-a', 'power-supply-b'].map((node) => ({
    node, model: 'power-supply-48v-350w', registered: true, bomPartId: 'power-supply-48v-350w',
    group: 'fixed', color: [0.66, 0.7, 0.73], explode: [0, -135, 0],
    mesh: `assemblies/${reference.id}/${node}.stl`, sha256: digest(stl),
  }));
  parts.push({ node: 'proposed-shell', model: 'proposed-shell', registered: false,
    bomPartId: 'control-panel-enclosure', group: 'cover', color: [0.94, 0.94, 0.92],
    explode: [0, -80, 0], mesh: `assemblies/${reference.id}/proposed-shell.stl`, sha256: digest(stl) });
  const entry = { ...reference, figure: `figures/${reference.id}.png`, sha256: digest(figure),
    sourceHashes: Object.fromEntries(Object.entries(sources).map(([path, bytes]) => [path, digest(bytes)])),
    scene: { slug: 'control-cabinet', configuration: 'Proposed cabinet', pose: 'service-exploded', parts } };
  const files = { [root + entry.figure]: figure, ...Object.fromEntries(parts.map((part) => [root + part.mesh, stl])) };
  change(entry, files);
  files[root + 'manifest.json'] = strToU8(JSON.stringify({ schemaVersion: 1, style: 'cad-line-art-v2', models: { [reference.id]: entry } }));
  return zipSync(files);
}

test('inspection scene preserves repeated catalog components without adding fabrication meshes', () => {
  const result = previewAssets(pack(), models, (path) => sources[path]);
  assert.deepEqual(result.meshes, {});
  assert.deepEqual(result.scenes['control-cabinet'].parts.map((part) => part.node),
    ['power-supply-a', 'power-supply-b', 'proposed-shell']);
  assert.ok(result.scenes['control-cabinet'].parts.every((part) => part.bytes.length > 0));
});

test('one corrupt, missing or unsafe inspection component rejects the entire scene', () => {
  for (const change of [
    (entry, files) => { delete files[root + entry.scene.parts[0].mesh]; },
    (entry, files) => { files[root + entry.scene.parts[0].mesh] = strToU8('corrupt'); },
    (entry) => { entry.scene.parts[0].mesh = '../outside.stl'; },
    (entry) => { entry.scene.parts[1].node = entry.scene.parts[0].node; },
    (entry) => { entry.scene.parts[0].node = ['power-supply-a']; },
    (entry) => { entry.scene.parts[2].bomPartId = ['control-panel-enclosure']; },
    (entry) => { entry.scene.parts[2] = null; },
    (entry) => { entry.scene.parts[0].model = 'camera-pod-spider'; },
    (entry) => { entry.scene.parts[0].bomPartId = 'emergency-stop-switch'; },
    (entry) => { entry.scene.parts[0].explode = [0, null, 0]; },
    (entry) => { entry.scene.parts[0].color = [2, 0, 0]; },
  ]) {
    assert.deepEqual(previewAssets(pack(change), models, (path) => sources[path]).scenes, {});
  }
  const changed = { ...sources, 'hardware/assemblies/control-cabinet/power-supply-48v-350w.scad': Buffer.from('changed supply') };
  assert.deepEqual(previewAssets(pack(), models, (path) => changed[path]).scenes, {});
});

test('site compiler exposes the assembled cabinet, counts supplies and links real BOM owners', () => {
  const output = mkdtempSync(join(tmpdir(), 'arbi-cabinet-site-'));
  try {
    const archive = join(output, 'previews.zip');
    writeFileSync(archive, pack());
    const data = join(output, 'data');
    execFileSync(process.execPath, ['scripts/compile-data.mjs'], {
      cwd: app, env: { ...process.env, ARBI_OFFLINE: '1', ARBI_CAD_PREVIEW_PACK: archive, ARBI_DATA_DIR: data }, stdio: 'pipe',
    });
    const scene = JSON.parse(readFileSync(join(data, 'scenes/control-cabinet.json')));
    const site = JSON.parse(readFileSync(join(data, 'site.json')));
    assert.equal(scene.layout, 'assembly');
    assert.equal(scene.configuration, 'Proposed cabinet');
    assert.equal(scene.parts.filter((part) => part.model === 'power-supply-48v-350w').length, 2);
    assert.equal(scene.parts[0].href, '/parts/power-supply-48v-350w');
    assert.equal(scene.parts[2].href, '/bom/control-panel-enclosure');
    assert.equal(site.scenes['control-cabinet'].hero, 'figures/control-cabinet-assembly.png');
    assert.equal(site.scenes['control-cabinet'].exploded, null);
    assert.equal(site.meshes['control-cabinet-assembly'], undefined);
    assert.ok(scene.bounds.min.every(Number.isFinite));
    for (const part of scene.parts) assert.deepEqual(readFileSync(join(data, part.url)), Buffer.from(stl));
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
});
