import assert from 'node:assert/strict';
import { test } from 'node:test';
import { modelWarnings, uniqueWarnings, warningCounts } from '../src/lib/warnings.ts';

test('individual CAD pages inherit critical BOM issues without duplicate entries', () => {
  const warning = { severity: 'critical', code: 'temporary-cable-tie', message: 'Replace temporary ties.', partIds: ['kit'], assemblyIds: ['pod'] };
  const model = { id: 'deck', status: 'concept-unvalidated', bomPartIds: ['kit'], assembly: 'pod' };
  const warnings = modelWarnings(model, [warning, warning]);
  assert.equal(warnings.length, 2);
  assert.equal(warnings[0].severity, 'critical');
  assert.equal(warnings[1].severity, 'warning');
  assert.equal(uniqueWarnings([...warnings, ...warnings]).length, 2);
  assert.deepEqual(warningCounts(warnings), { critical: 1, warning: 1 });
  assert.equal(uniqueWarnings([warning, { ...warning, severity: 'warning' }])[0].severity, 'critical');
});

test('approximate geometry has a lighter rework warning; validated geometry has no inferred warning', () => {
  const model = { id: 'motor', status: 'concept-unvalidated', bomPartIds: ['motor'], assembly: 'winch', geometry: { rework: 'Measure the received motor.' } };
  assert.ok(modelWarnings(model, []).some((warning) => warning.code === 'approximate-geometry' && warning.severity === 'warning' && warning.message.includes('Measure')));
  assert.deepEqual(modelWarnings({ ...model, status: 'validated', geometry: undefined }, []), []);
});

test('measured envelopes retain detail and physical-acceptance warnings without claiming approximate sizing', () => {
    const model = { id: 'converter', status: 'concept-unvalidated', bomPartIds: ['converter'], assembly: 'pod', geometry: { status: 'measured-envelope', rework: 'Confirm PCB thickness and component detail.' } };
    const warnings = modelWarnings(model, []);
    assert.ok(warnings.some((warning) => warning.code === 'simplified-details' && warning.severity === 'warning' && warning.message.startsWith('Measured envelope; simplified details:')));
    assert.ok(warnings.some((warning) => warning.code === 'unconfirmed-concept'));
    assert.ok(!warnings.some((warning) => warning.code === 'approximate-geometry'));
});
