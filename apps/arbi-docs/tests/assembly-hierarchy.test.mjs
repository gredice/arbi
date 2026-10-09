import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { numberAssemblies } from '../src/lib/assembly-hierarchy.ts';

const owners = JSON.parse(readFileSync(new URL('../../../bom/assemblies/assemblies.json', import.meta.url))).assemblies;

test('only five root systems are numbered while the winch page shares the corner system number', () => {
  const all = numberAssemblies(owners);
  assert.deepEqual(all.filter((owner) => owner.parentAssemblyId === null).map((owner) => [owner.id, owner.number]), [
    ['corner-support-set', '01'], ['camera-pod', '02'], ['dock', '03'], ['control-cabinet', '04'], ['site-installation', '05'],
  ]);
  const winch = all.find((owner) => owner.id === 'winch-set');
  assert.equal(winch.rootId, 'corner-support-set');
  assert.equal(winch.number, '01');
  assert.ok(!all.some((owner) => owner.id === 'positioning-line-set' || owner.kind !== 'physical'));
});

test('nested physical children keep their root number regardless of input order', () => {
  const child = { id: 'line-termination', kind: 'physical', parentAssemblyId: 'winch-set' };
  const all = numberAssemblies([child, ...owners]);
  assert.equal(all[0].rootId, 'corner-support-set');
  assert.equal(all[0].number, '01');
  assert.throws(() => numberAssemblies([{ ...child, parentAssemblyId: 'unknown' }]), /Missing physical parent/);
  assert.throws(() => numberAssemblies([{ ...child, parentAssemblyId: child.id }]), /hierarchy cycle/);
});
