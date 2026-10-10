import { Ajv2020 } from 'ajv/dist/2020.js';
import { configurationDigest, validateConfigurationRecord, type Configuration, type SiteFrame, type VectorMm } from '@arbi/protocol';
import { isId } from '@arbi/gredice';

export const COMMISSIONING_VERSION = 'arbi.commissioning/1.0';
export class CommissioningError extends Error {
  constructor(readonly code: string) { super(code); }
}
export interface CommissioningSet {
  version: typeof COMMISSIONING_VERSION;
  configuration: Configuration;
  axes: { line: 'a' | 'b' | 'c' | 'd'; drumId: string; lineId: string; positiveDirection: 1 | -1; homePayoutMm: number; radiusMm: number }[];
  camera: { componentId: string; frame: SiteFrame; translationMm: VectorMm; rotationDeg: VectorMm };
  dock: { componentId: string; frame: SiteFrame; positionMm: VectorMm; preDockMm: VectorMm; approachSpeedMmPerS: number; latchDebounceMs: number };
  targets: { id: string; bedId: string; plantId: string | null; frame: SiteFrame; positionMm: VectorMm; panDeg: number; tiltDeg: number }[];
}
const closed = (properties: Record<string, unknown>) => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });
const id = { type: 'string', minLength: 1, maxLength: 128, pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]*$' };
const number = { type: 'number', minimum: -1_000_000, maximum: 1_000_000 };
const positive = { type: 'number', exclusiveMinimum: 0, maximum: 1_000_000 };
const vector = closed({ x: number, y: number, z: number });
const frame = closed({ name: { const: 'site' }, revision: id });
const schema = closed({ version: { const: COMMISSIONING_VERSION }, configuration: { type: 'object' },
  axes: { type: 'array', minItems: 4, maxItems: 4, items: closed({ line: { enum: ['a', 'b', 'c', 'd'] }, drumId: id, lineId: id,
    positiveDirection: { enum: [-1, 1] }, homePayoutMm: positive, radiusMm: positive }) },
  camera: closed({ componentId: id, frame, translationMm: vector, rotationDeg: vector }),
  dock: closed({ componentId: id, frame, positionMm: vector, preDockMm: vector, approachSpeedMmPerS: positive,
    latchDebounceMs: { type: 'integer', minimum: 1, maximum: 5000 } }),
  targets: { type: 'array', minItems: 1, maxItems: 256, items: closed({ id, bedId: id, plantId: { anyOf: [id, { type: 'null' }] }, frame,
    positionMm: vector, panDeg: number, tiltDeg: number }) },
});
const check = new Ajv2020({ strict: true }).compile(schema);
const same = (a: unknown, b: unknown) => configurationDigest(a) === configurationDigest(b);
const unique = (items: string[]) => new Set(items).size === items.length;
const xyz = ['x', 'y', 'z'] as const;
export function inside(position: VectorMm, config: Configuration): boolean {
  return xyz.every(axis => Number.isFinite(position[axis]) && position[axis] >= config.limits.workspace.minMm[axis] + config.calibration!.uncertaintyMm
    && position[axis] <= config.limits.workspace.maxMm[axis] - config.calibration!.uncertaintyMm);
}
/** Closed supplemental record. Protocol configuration 1.0 stays unchanged. */
export function validateSet(input: unknown): CommissioningSet {
  try {
    if (Buffer.byteLength(JSON.stringify(input) ?? '') > 1_048_576 || !check(input)) throw new Error();
  } catch { throw new CommissioningError('INVALID_SET'); }
  const set = structuredClone(input) as unknown as CommissioningSet;
  const result = validateConfigurationRecord(set.configuration, 'configuration');
  if (!result.ok) throw new CommissioningError(result.error.code);
  const c = set.configuration = result.value;
  if (c.executionMode !== 'simulation' || c.realm.environment !== 'test' || c.calibration?.scope !== 'simulation') throw new CommissioningError('SIMULATION_ONLY');
  const passive = (value: string) => c.components.find(component => component.id === value)?.kind === 'passive';
  if (!unique(set.axes.map(a => a.line)) || !unique(set.axes.map(a => a.drumId)) || !unique(set.axes.map(a => a.lineId))
    || set.axes.some(a => !passive(a.drumId) || !passive(a.lineId) || a.drumId === a.lineId)
    || !passive(set.camera.componentId) || !passive(set.dock.componentId)) throw new CommissioningError('INVALID_COMPONENT');
  if (![set.camera.frame, set.dock.frame, ...set.targets.map(t => t.frame)].every(f => same(f, c.geometry.siteFrame))) throw new CommissioningError('FRAME_MISMATCH');
  if (xyz.some(axis => Math.abs(set.camera.rotationDeg[axis]) > 180 || Math.abs(set.camera.translationMm[axis]) > 1000)) throw new CommissioningError('INVALID_TRANSFORM');
  if (!inside(set.dock.positionMm, c) || !inside(set.dock.preDockMm, c) || set.dock.approachSpeedMmPerS > c.limits.maxSpeedMmPerS) throw new CommissioningError('OUTSIDE_LIMITS');
  for (const axis of set.axes) if (Math.abs(resolveLineReference(set, axis.line, set.dock.positionMm).lineLengthMm - axis.homePayoutMm) > c.calibration.uncertaintyMm) throw new CommissioningError('HOME_REFERENCE_MISMATCH');
  if (!unique(set.targets.map(t => t.id)) || set.targets.some(t => !isId(t.id) || !c.geometry.beds.some(b => b.bedId === t.bedId)
    || t.plantId !== null && !c.geometry.plants.some(p => p.plantId === t.plantId && p.bedId === t.bedId))) throw new CommissioningError('INVALID_MAPPING');
  for (const target of set.targets) resolveTarget(set, target.id);
  return set;
}
/** Analytical reference only. STEP counts and a home setting cannot establish measured pose/tension. */
export function resolveLineReference(set: CommissioningSet, line: 'a' | 'b' | 'c' | 'd', positionMm: VectorMm) {
  if (!inside(positionMm, set.configuration)) throw new CommissioningError('OUTSIDE_LIMITS');
  const anchor = set.configuration.geometry.anchors.find(a => a.line === line)!;
  const axis = set.axes.find(a => a.line === line)!;
  const lineLengthMm = Math.hypot(...xyz.map(key => anchor.positionMm[key] - positionMm[key])) + set.configuration.calibration!.lineLengthOffsetsMm[line];
  const turns = axis.positiveDirection * (lineLengthMm - axis.homePayoutMm) / (2 * Math.PI * axis.radiusMm);
  return { lineLengthMm, turnsFromHome: turns === 0 ? 0 : turns };
}
/** Camera optical origin = pod site position + surveyed translation. Framing is explicit, never inferred from encoders. */
export function resolveTarget(set: CommissioningSet, id: string) {
  const t = set.targets.find(target => target.id === id);
  if (!t) throw new CommissioningError('INVALID_MAPPING');
  const c = set.configuration;
  const positionMm = Object.fromEntries(xyz.map(axis => [axis, t.positionMm[axis] - set.camera.translationMm[axis]])) as unknown as VectorMm;
  const panDeg = t.panDeg - set.camera.rotationDeg.z - c.calibration!.gimbalZeroDeg.pan;
  const tiltDeg = t.tiltDeg - set.camera.rotationDeg.y - c.calibration!.gimbalZeroDeg.tilt;
  // V1 fixture convention supports yaw/pitch offsets only; roll requires a future framing model.
  if (set.camera.rotationDeg.x !== 0) throw new CommissioningError('INVALID_TRANSFORM');
  if (!inside(positionMm, c) || !inside(t.positionMm, c) || !Number.isFinite(panDeg) || !Number.isFinite(tiltDeg)
    || panDeg < c.limits.panDeg.min || panDeg > c.limits.panDeg.max || tiltDeg < c.limits.tiltDeg.min || tiltDeg > c.limits.tiltDeg.max) throw new CommissioningError('OUTSIDE_LIMITS');
  return { positionMm, panDeg, tiltDeg, siteFrame: structuredClone(c.geometry.siteFrame), gimbalFrame: structuredClone(c.geometry.gimbalFrame) };
}
