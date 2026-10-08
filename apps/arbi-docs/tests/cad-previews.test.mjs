import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { strToU8, zipSync } from 'fflate';
import { previewFigures } from '../scripts/cad-previews.mjs';

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

test('a CSG reference receives a figure without needing a booklet drawing or fabrication mesh', () => {
  assert.ok(model.output.endsWith('.csg'));
  const result = previewFigures(pack(), [model], (path) => sources[path]);
  assert.deepEqual(Buffer.from(result[model.id]), figure);
});

test('legacy packs with shaded reference figures cannot enter the line-art inventory', () => {
  assert.throws(() => previewFigures(pack({}, sources, figure, 'cad-preview-v1'), [model], (path) => sources[path]), /line-art figures required/);
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
    writeFileSync(archive, pack({}, input));
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
    assert.equal(site.figures[model.id], `figures/${model.id}.png`);
    assert.ok(existsSync(join(data, site.figures[model.id])));
    assert.deepEqual(readFileSync(join(data, site.figures[model.id])), figure);
    assert.equal(site.meshes[model.id], undefined, 'a reference preview must not become a fabrication mesh');
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
});
