import { readFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { configurationDigest, configurationHardwareDigest, type ConfigurationApplyBoundary, type Identity } from '@arbi/protocol';
import { createIsolatedIdentityProvider } from '@arbi/gredice/testing';
import { validateSet } from './contracts.js';
import { CommissioningCoordinator, type LocalCommissioningAuthorization, type CoordinatorOptions } from './coordinator.js';
import { CommissioningStore, type StoreOptions, type Enrollment } from './store.js';
import { CommissioningServer } from './server.js';
import { SimulationCommissioningDevice } from './simulator.js';

/** Explicit isolated recipe only. No environment switch or hardware fallback selects it. */
export async function createCommissioningReference(directory: string, options: { store?: Partial<StoreOptions>; timeoutMs?: number; identity?: Identity } = {}) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const set = validateSet(JSON.parse(readFileSync(new URL('../../fixtures/commissioning.json', import.meta.url), 'utf8')));
  const c = set.configuration, identity: Identity = options.identity ?? { deviceId: 'edge', bootId: randomUUID(), sessionId: randomUUID() };
  let time = 1_800_000_000_000;
  const now = () => time;
  const provider = createIsolatedIdentityProvider(c.realm, now);
  provider.putSite(c.siteId, 'fixture-account'); provider.putSite('other-site', 'fixture-account');
  const actor = { kind: 'human' as const, id: 'fixture-technician' };
  provider.putPrincipal({ actor, accountId: 'fixture-account', member: true, sites: {
    [c.siteId]: { roles: ['engineer'], serviceScopes: [], active: true, revision: 'membership-1' },
    'other-site': { roles: ['engineer'], serviceScopes: [], active: true, revision: 'membership-1' } } });
  const credential = await provider.issue(actor);
  let localGrant: LocalCommissioningAuthorization | null = { id: 'fixture-local-commissioning', actor, sessionId: credential.sessionId,
    realm: c.realm, siteId: c.siteId, receiver: identity, origin: 'simulated', mode: 'maintenance', stopped: true, idle: true, issuedAtMs: time, expiresAtMs: time + 60_000 };
  const devices = new Map<string, SimulationCommissioningDevice>();
  const observations = new Map<string, Enrollment>();
  for (const component of c.components) if (component.kind === 'module' && ['edge', 'pico', 'pod'].includes(component.role)) {
    const source = component.id === 'edge' ? identity : { deviceId: component.id, bootId: randomUUID(), sessionId: randomUUID() };
    const observation: Enrollment = { identity: source, component, realm: c.realm, siteId: c.siteId, executionMode: 'simulation', protocol: 'arbi/1.0',
      hardwareDigest: configurationHardwareDigest(c), readableSchemas: [c.schemaVersion], rollbackSchemas: [c.schemaVersion] };
    observations.set(component.id, observation);
    devices.set(component.id, new SimulationCommissioningDevice(join(directory, `${component.id}.sqlite`), observation));
  }
  const localLimits = structuredClone(c.limits); localLimits.panDeg = { min: -180, max: 180 }; localLimits.tiltDeg = { min: -180, max: 180 };
  const approved = [configurationDigest(set)];
  const calibrationApprovals = [configurationDigest(c.calibration)];
  let stops = 0;
  const store = new CommissioningStore({ path: join(directory, 'commissioning.sqlite'), realm: c.realm, siteId: c.siteId, source: identity, ...options.store });
  const composition: CoordinatorOptions = { store, realm: c.realm, siteId: c.siteId, identity, devices, now, localAuthorization: () => localGrant,
    interlock: () => ({ stopped: true, idle: true, inhibited: true }), localStop: () => { stops++; }, reviewedSetDigests: () => approved,
    boundary: e => ({ receiver: e.identity, realm: c.realm, siteId: c.siteId, executionMode: 'simulation', calibrationScope: 'simulation',
      installedHardwareDigest: e.hardwareDigest, localLimits, approvedCalibrationDigests: calibrationApprovals, readableSchemaVersions: e.readableSchemas,
      rollbackReadableSchemaVersions: e.rollbackSchemas, authorizedActor: actor, authorizationId: localGrant?.id ?? 'unavailable', inhibited: true }),
    deviceTimeoutMs: options.timeoutMs };
  const coordinator = new CommissioningCoordinator(composition);
  const server = new CommissioningServer({ identity: provider.adapter, resolveResource: provider.resolveResource, browserOrigins: ['http://localhost'] }, coordinator, store, now);
  const request = (action: string, input?: unknown, token = credential.token, siteId = c.siteId) => server.handle(new Request(`http://localhost/sites/${siteId}/commissioning/${action}`, {
    method: action === 'status' ? 'GET' : 'POST', headers: { authorization: `Bearer ${token}`, origin: 'http://localhost', 'x-arbi-request': '1', 'content-type': 'application/json' },
    ...(action === 'status' ? {} : { body: JSON.stringify(input ?? { reason: 'fixture-inspection' }) }),
  }), siteId, action);
  return { set, identity, provider, credential, devices, observations, composition, coordinator, server, store, approved, calibrationApprovals, now, request,
    get stops() { return stops; }, advance(ms: number) { time += ms; }, local(grant: LocalCommissioningAuthorization | null) { localGrant = grant; }, get grant() { return localGrant; },
    async enrollAll() { for (const deviceId of devices.keys()) { const response = await request('enroll', { deviceId, reason: 'fixture-enrollment' }); if (response.status !== 200) throw new Error(JSON.stringify(await response.json())); } },
    boundary(e: Enrollment): ConfigurationApplyBoundary { return composition.boundary(e); },
    close() { coordinator.stop(); store.close(); for (const device of devices.values()) device.close(); } };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4 || process.argv[2] !== '--directory') { console.error('ISOLATED_DIRECTORY_REQUIRED'); process.exitCode = 2; }
  else {
    const reference = await createCommissioningReference(resolve(process.argv[3]));
    try {
      await reference.enrollAll();
      const stage = await reference.request('stage', { reason: 'fixture-review', set: reference.set });
      if (stage.status !== 200) throw new Error('STAGE_FAILED');
      const activation = await reference.request('activate');
      console.log(JSON.stringify(await activation.json()));
      if (activation.status !== 200) process.exitCode = 1;
    } finally { reference.close(); }
  }
}
