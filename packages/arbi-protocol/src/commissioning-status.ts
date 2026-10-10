import type { Realm } from './messages.js';

/** Read-only projection; it conveys no local authorization or physical validation. */
export interface CommissioningIdentity {
  revision: string;
  digest: string;
  configurationDigest: string;
  calibrationRevision: string;
}
export interface CommissioningStatus {
  version: 'arbi.commissioning-status/1.0';
  realm: Realm;
  siteId: string;
  executionMode: 'simulation';
  active: CommissioningIdentity | null;
  staged: CommissioningIdentity | null;
  rejected: { identity: CommissioningIdentity | null; reason: string } | null;
  phase: 'uncommissioned' | 'staged' | 'activating' | 'active' | 'blocked';
  ready: boolean;
  blockedReason: string | null;
  physicalActuationEnabled: false;
}

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const keys = (value: Record<string, unknown>, expected: string[]) => Object.keys(value).sort().join() === expected.sort().join();
const id = (value: unknown) => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(value);
const hash = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
function identity(value: unknown): boolean {
  return object(value) && keys(value, ['revision', 'digest', 'configurationDigest', 'calibrationRevision'])
    && id(value.revision) && id(value.calibrationRevision) && hash(value.digest) && hash(value.configurationDigest);
}
/** Closed read projection: reject hidden credentials, bad identifiers and contradictory readiness. */
export function validateCommissioningStatus(input: unknown): input is CommissioningStatus {
  if (!object(input) || !keys(input, ['version', 'realm', 'siteId', 'executionMode', 'active', 'staged', 'rejected', 'phase', 'ready', 'blockedReason', 'physicalActuationEnabled'])
    || input.version !== 'arbi.commissioning-status/1.0' || !object(input.realm) || !keys(input.realm, ['environment', 'namespaceId'])
    || input.realm.environment !== 'test' || !id(input.realm.namespaceId) || !id(input.siteId) || input.executionMode !== 'simulation' || input.physicalActuationEnabled !== false
    || !['uncommissioned', 'staged', 'activating', 'active', 'blocked'].includes(String(input.phase)) || typeof input.ready !== 'boolean') return false;
  if (input.active !== null && !identity(input.active) || input.staged !== null && !identity(input.staged)) return false;
  if (input.rejected !== null && (!object(input.rejected) || !keys(input.rejected, ['identity', 'reason'])
    || input.rejected.identity !== null && !identity(input.rejected.identity) || !id(input.rejected.reason))) return false;
  return input.ready ? input.phase === 'active' && input.active !== null && input.staged === null && input.blockedReason === null : id(input.blockedReason);
}
