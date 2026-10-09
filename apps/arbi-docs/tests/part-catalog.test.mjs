import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { partCatalog } from '../src/lib/part-catalog.ts';

const read = (path) => JSON.parse(readFileSync(new URL(`../../../${path}`, import.meta.url)));
const parts = read('bom/catalog/parts.json').parts;
const registry = read('hardware/models.json');
const owners = read('bom/assemblies/assemblies.json').assemblies;

test('Parts covers the entire BOM and retains individual CAD pages with unique routes', () => {
  const entries = partCatalog(parts, registry.models, owners);
  assert.equal(new Set(entries.map((entry) => entry.id)).size, entries.length);
  for (const part of parts) {
    const entry = entries.find((item) => item.id === part.id);
    assert.equal(entry.bomPartId, part.id);
    assert.equal(entry.name, part.name);
    assert.ok(entry.modelIds.length > 0, part.id);
  }
  for (const model of registry.models) assert.ok(entries.some((entry) => entry.id === model.id));
  for (const archived of registry.archivedModels) assert.ok(!entries.some((entry) => entry.id === archived.id));
  const drum = entries.find((entry) => entry.id === 'winch-drum');
  assert.ok(drum.modelIds.includes('winch-drum-powered-3'), 'BOM slug collision must retain the kit components');
});

test('purchased, optional, planned and unallocated items retain geometry and ownership', () => {
  const entries = partCatalog(parts, registry.models, owners);
  assert.equal(entries.find((entry) => entry.id === 'microsd-card-32gb').assembly, 'camera-pod');
  assert.equal(entries.find((entry) => entry.id === 'cable-gland-assortment').assembly, 'shared-procurement-stock');
  for (const id of ['as5600-angle-sensor', 'wind-speed-sensor', 'pole-pulley-mount-concept']) {
    assert.ok(entries.find((entry) => entry.id === id)?.modelIds.length);
  }
  for (const part of parts.filter((part) => !part.fabrication?.sources.length)) {
    const model = registry.models.find((model) => model.bomPartIds.includes(part.id));
    assert.equal(model.artifactRole, 'visualization');
    assert.equal(model.geometry.status, 'approximate');
    assert.ok(model.geometry.basis && model.geometry.rework);
    assert.ok(model.output.endsWith('.stl'));
  }
});
