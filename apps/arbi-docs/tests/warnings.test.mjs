import assert from 'node:assert/strict';
import { test } from 'node:test';
import { modelWarnings, uniqueWarnings, warningCounts } from '../src/lib/warnings.ts';

test('measured envelopes retain detail and physical-acceptance warnings without claiming approximate sizing', () => {
  const model = { id: 'converter', status: 'concept-unvalidated', bomPartIds: ['converter'], assembly: 'pod', geometry: { status: 'measured-envelope', rework: 'Confirm PCB thickness and component detail.' } };
  const warnings = modelWarnings(model, []);
  assert.ok(warnings.some((warning) => warning.code === 'simplified-details' && warning.severity === 'warning' && warning.message.startsWith('Measured envelope; simplified details:')));
  assert.ok(warnings.some((warning) => warning.code === 'unconfirmed-concept'));
  assert.ok(!warnings.some((warning) => warning.code === 'approximate-geometry'));
});

test('individual CAD pages inherit critical BOM issues without duplicate entries', () => {
  const warning = { severity: 'critical', code: 'temporary-cable-tie', message: 'Replace temporary ties.', partIds: ['kit'], assemblyIds: ['pod'] };
  const model = { id: 'deck', status: 'concept-unvalidated', bomPartIds: ['kit'], assembly: 'pod' };
  const warnings = modelWarnings(model, [warning, warning]);
  assert.equal(warnings.length, 2);
  assert.equal(warnings[0].severity, 'critical');
  assert.equal(warnings[1].severity, 'warning');
  assert.equal(uniqueWarnings([...warnings, ...warnings]).length, 2);
  assert.deepEqual(warningCounts(warnings), { critical: 1, warning: 1, issue: 0 });
  assert.equal(uniqueWarnings([warning, { ...warning, severity: 'warning' }])[0].severity, 'critical');
});

test('approximate geometry is critical before dependent design; validated geometry has no inferred warning', () => {
  const model = { id: 'motor', status: 'concept-unvalidated', bomPartIds: ['motor'], assembly: 'winch', geometry: { rework: 'Measure the received motor.' } };
  const warning = modelWarnings(model, []).find((warning) => warning.code === 'approximate-geometry');
  assert.equal(warning.severity, 'critical');
  assert.ok(warning.message.includes('Measure'));
  assert.ok(warning.message.includes('before dependent assembly design'));
  assert.deepEqual(modelWarnings({ ...model, status: 'validated', geometry: undefined }, []), []);
});

test('three levels sort by priority and deduplication keeps the highest severity in any input order', () => {
  const issue = { severity: 'issue', code: 'procurement-information', message: 'Tax/VAT is unknown.', partIds: ['motor'], assemblyIds: ['winch'] };
  const concept = { ...issue, severity: 'warning', code: 'unconfirmed-concept', message: 'Design awaits review.' };
  const geometry = { ...issue, severity: 'critical', code: 'approximate-geometry', message: 'Measure the motor.' };
  const ordered = uniqueWarnings([issue, concept, geometry]);
  assert.deepEqual(ordered.map((warning) => warning.severity), ['critical', 'warning', 'issue']);
  assert.deepEqual(warningCounts(ordered), { critical: 1, warning: 1, issue: 1 });
  for (const pair of [[issue, { ...issue, severity: 'warning' }], [{ ...issue, severity: 'warning' }, issue]]) {
    assert.equal(uniqueWarnings(pair)[0].severity, 'warning');
  }
  assert.equal(modelWarnings({ id: 'motor', status: 'concept-unvalidated', bomPartIds: ['motor'], assembly: 'winch' }, [issue])
    .find((warning) => warning.code === 'procurement-information').severity, 'issue');
});
