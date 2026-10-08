import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { sceneHref } from '../scripts/scene-links.mjs';

const catalogIds = new Set(JSON.parse(readFileSync(new URL('../../../bom/catalog/parts.json', import.meta.url))).parts.map((p) => p.id));

test('reused fastener meshes open their owning BOM page rather than a nonexistent CAD page', () => {
  for (const owner of ['winch-mount-hardware', 'winch-drum-joining-hardware', 'winch-full-cover-hardware']) {
    for (const mesh of ['bolt-M4x25', 'nyloc-M4', 'washer-M4']) {
      assert.equal(sceneHref(mesh, false, owner, catalogIds), `/bom/${owner}`);
    }
  }
  assert.equal(sceneHref('winch-bearing-cap', true, undefined, catalogIds), '/parts/winch-bearing-cap');
});

test('archived references remain navigable and unmapped context does not invent a page', () => {
  assert.equal(sceneHref('motor-23HS40-reference', false, undefined, catalogIds), '/bom/nema23-closed-loop-motor');
  assert.equal(sceneHref('bolt-M6x30', false, undefined, catalogIds), '/bom/winch-mount-hardware');
  assert.equal(sceneHref('nut-M5', false, undefined, catalogIds), '/bom/winch-mount-hardware');
  assert.equal(sceneHref('line-passive-reference', false, undefined, catalogIds), undefined);
  assert.throws(() => sceneHref('bolt-M4x25', false, 'missing-part', catalogIds), /missing BOM part/);
});
