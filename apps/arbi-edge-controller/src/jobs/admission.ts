import { admitCommand, checkConfiguredCommand, createCommandLedger, parseMessage, scenarioPositionInside, validateConfigurationRecord, type Command, type ErrorCode } from '@arbi/protocol';
import { canonical } from '@arbi/audit';
import { JobError, REQUIRED_INPUTS, type LocalAuthority, type Step } from './types.js';

export const same = (a: unknown, b: unknown): boolean => canonical(a) === canonical(b);
// Match protocol logical identity: delivery message ID/sequence/time are transport metadata.
export const fingerprint = (c: Command): string => canonical({ protocol: c.protocol, realm: c.realm, executionMode: c.executionMode, siteId: c.siteId, source: c.source, command: c.command, body: c.body });
export function commandInput(input: unknown): Command {
  const parsed = parseMessage(JSON.stringify(input));
  if (!parsed.ok || parsed.value.kind !== 'command') throw new JobError(parsed.ok ? 'UNKNOWN_KIND' : parsed.error.code);
  return structuredClone(parsed.value);
}
export function policy(command: Command, a: LocalAuthority, active = false): ErrorCode | null {
  const { gate, applied } = a, config = applied.request.configuration, now = gate.nowMonotonicMs;
  if (!a.clockReliable || !Number.isSafeInteger(now) || now < 0) return 'CLOCK_INVALID';
  if (config.executionMode !== 'simulation' || config.realm.environment !== 'test' || config.calibration?.scope !== 'simulation') return 'NOT_AUTHORIZED';
  if (!same(gate.receiver, a.boundary.receiver) || !same(gate.realm, config.realm) || gate.siteId !== config.siteId || gate.executionMode !== 'simulation') return 'CONFIG_MISMATCH';
  if (command.body.type === 'control.stop') return null;
  if (a.commissioning) {
    const commissioning = a.commissioning();
    if (!commissioning.ready || commissioning.configurationDigest !== applied.configurationDigest) return 'CONFIG_MISMATCH';
  }
  const parsed = validateConfigurationRecord(applied, 'applied');
  if (!parsed.ok || command.command.configRevision !== config.revision || gate.configRevision !== config.revision) return 'CONFIG_MISMATCH';
  if (a.mode === 'inhibited' || gate.faultInhibited || (!active && a.state !== 'Ready')) return 'FAULT_INHIBITED';
  if (!a.cloudConnected && (a.mode !== 'autonomous' || !a.continueOffline || command.command.actor.kind !== 'service')) return 'LEASE_EXPIRED';
  for (const name of REQUIRED_INPUTS) {
    const v = a.conditions[name];
    if (!v || !v.supported || v.origin !== 'simulated') return 'UNSUPPORTED_CAPABILITY';
    if (v.value !== 'allow' || !Number.isSafeInteger(v.sampledAtMs) || v.sampledAtMs < 0 || !Number.isSafeInteger(v.validUntilMs) || v.sampledAtMs > now || v.validUntilMs <= now
      || now - v.sampledAtMs > 1500 || v.configurationDigest !== applied.configurationDigest || v.calibrationRevision !== config.calibration.revision) return 'FAULT_INHIBITED';
  }
  for (const [role, epoch] of Object.entries(a.modules)) {
    const registered = config.components.find(c => c.id === epoch.source.deviceId);
    if (registered?.kind !== 'module' || registered.role !== (role === 'motion' ? 'pico' : 'pod')) return 'UNSUPPORTED_CAPABILITY';
    if (!Number.isSafeInteger(epoch.generation) || epoch.generation < 1 || epoch.configurationDigest !== applied.configurationDigest || epoch.calibrationRevision !== config.calibration.revision) return 'CONFIG_MISMATCH';
  }
  const configured = checkConfiguredCommand(command, applied, a.boundary);
  if (!configured.ok) return configured.error.code === 'OUTSIDE_LIMITS' || configured.error.code === 'FRAME_MISMATCH' ? 'INVALID_RANGE' : 'CONFIG_MISMATCH';
  if ((!active || command.body.type === 'camera.gimbal') && !a.stationary) return 'INVALID_TRANSITION';
  if (!active && !a.safeMotionPose && (command.body.type === 'motion.move' || command.body.type === 'camera.capture')) return 'FAULT_INHIBITED';
  return null;
}
export function admit(command: Command, a: LocalAuthority): ErrorCode | null {
  const p = policy(command, a); if (p) return p;
  const result = admitCommand(command, a.gate, createCommandLedger(1));
  return result.ok ? null : result.error.code;
}
/** Reviewed host transition plan; each movement ends with a distinct stop proof. */
export function plan(command: Command, a: LocalAuthority): Step[] {
  const timeout = 'maxDurationMs' in command.body ? Math.min(command.body.maxDurationMs, 10000) : 500;
  const stop = (phase: 'stop' | 'dock-stop', state: Step['state']): Step => ({ phase, state, timeoutMs: 500, proof: 'stopped', body: null });
  let steps: Step[];
  if (command.body.type === 'control.stop') steps = [stop('stop', 'Fault')];
  else if (command.body.type === 'motion.move') steps = [{ phase: 'move', state: 'Moving', timeoutMs: timeout, proof: 'arrived', body: command.body }, stop('stop', 'Moving')];
  else if (command.body.type === 'camera.gimbal') steps = [{ phase: 'gimbal', state: 'Settling', timeoutMs: timeout, proof: 'settled', body: command.body }];
  else if (command.body.type === 'camera.capture') {
    const p = a.capturePlan, c = a.applied.request.configuration;
    if (!p || p.resourceId !== command.body.resourceId || p.configurationDigest !== a.applied.configurationDigest || p.calibrationRevision !== c.calibration?.revision) throw new JobError('CONFIG_MISMATCH');
    if (![p.positionMm, p.preDockMm, p.dockMm].every(v => scenarioPositionInside(v, c))
      || ![p.speedMmPerS, p.approachSpeedMmPerS].every(v => Number.isFinite(v) && v > 0 && v <= c.limits.maxSpeedMmPerS)
      || p.approachSpeedMmPerS > p.speedMmPerS || !Number.isFinite(p.panDeg) || !Number.isFinite(p.tiltDeg)
      || p.panDeg < c.limits.panDeg.min || p.panDeg > c.limits.panDeg.max || p.tiltDeg < c.limits.tiltDeg.min || p.tiltDeg > c.limits.tiltDeg.max) throw new JobError('INVALID_RANGE');
    const move = (phase: 'move' | 'return' | 'approach', state: Step['state'], positionMm: typeof p.positionMm, speed: number): Step => ({ phase, state, timeoutMs: timeout, proof: 'arrived', body: { type: 'motion.move', positionMm, frame: c.geometry.siteFrame, maxSpeedMmPerS: speed, maxDurationMs: timeout } });
    steps = [move('move', 'Moving', p.positionMm, p.speedMmPerS), stop('stop', 'Moving'),
      { phase: 'gimbal', state: 'Settling', timeoutMs: 1000, proof: 'settled', body: { type: 'camera.gimbal', panDeg: p.panDeg, tiltDeg: p.tiltDeg, frame: c.geometry.gimbalFrame, maxDurationMs: 1000 } },
      { phase: 'settle', state: 'Settling', timeoutMs: 500, proof: 'settled', body: null },
      { phase: 'capture', state: 'Capturing', timeoutMs: timeout, proof: 'captured', body: command.body },
      // Restore the accepted safe motion pose before returning.
      { phase: 'gimbal', state: 'Settling', timeoutMs: 1000, proof: 'settled', body: { type: 'camera.gimbal', panDeg: 0, tiltDeg: 0, frame: c.geometry.gimbalFrame, maxDurationMs: 1000 } },
      move('return', 'Returning', p.preDockMm, p.speedMmPerS), stop('stop', 'Returning'), move('approach', 'Docking', p.dockMm, p.approachSpeedMmPerS), stop('dock-stop', 'Docking'),
      { phase: 'latch', state: 'Docking', timeoutMs: 500, proof: 'latched', body: null }];
  } else throw new JobError('UNSUPPORTED_CAPABILITY');
  if (steps.some(s => !a.supportedPhases.includes(s.phase))) throw new JobError('UNSUPPORTED_CAPABILITY');
  // Reuse accepted configured command validation for every derived actuator input.
  for (const s of steps) if (s.body) {
    const checked = checkConfiguredCommand({ ...command, body: s.body }, a.applied, a.boundary);
    if (!checked.ok) throw new JobError('INVALID_RANGE');
  }
  return structuredClone(steps);
}
