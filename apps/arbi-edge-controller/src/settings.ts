import { openSync, fstatSync, readSync, closeSync } from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { validateConfigurationRecord, type AppliedConfiguration } from '@arbi/protocol';

export const TRANSPORT_VERSION = 'arbi.local/1.0';
export const LINK_TIMEOUT_MS = 1500;
export const RECONNECT_MIN_MS = 250;
export const RECONNECT_MAX_MS = 5000;
export const MAX_FRAMES_PER_SECOND = 32;
export interface ModuleEnrollment {
  deviceId: 'pico' | 'pod'; role: 'pico' | 'pod'; host: '127.0.0.1'; port: number;
  serverName: string; certificateSha256: string;
}
export interface Settings {
  schemaVersion: 'arbi.edge/1.0'; serviceId: 'edge'; executionMode: 'simulation';
  healthPort: number; acceptedConfigurationDigest: string; applied: AppliedConfiguration;
  tls: { caFile: string; certFile: string; keyFile: string };
  modules: ModuleEnrollment[];
}
const digest = { type: 'string', pattern: '^[a-f0-9]{64}$' };
const path = { type: 'string', minLength: 1, maxLength: 1024 };
const schema = {
  type: 'object', additionalProperties: false,
  required: ['schemaVersion', 'serviceId', 'executionMode', 'healthPort', 'acceptedConfigurationDigest', 'applied', 'tls', 'modules'],
  properties: {
    schemaVersion: { const: 'arbi.edge/1.0' }, serviceId: { const: 'edge' }, executionMode: { const: 'simulation' },
    healthPort: { type: 'integer', minimum: 0, maximum: 65535 }, acceptedConfigurationDigest: digest,
    applied: { type: 'object' }, tls: { type: 'object', additionalProperties: false, required: ['caFile', 'certFile', 'keyFile'], properties: { caFile: path, certFile: path, keyFile: path } },
    modules: { type: 'array', minItems: 2, maxItems: 2, items: {
      type: 'object', additionalProperties: false, required: ['deviceId', 'role', 'host', 'port', 'serverName', 'certificateSha256'],
      properties: { deviceId: { enum: ['pico', 'pod'] }, role: { enum: ['pico', 'pod'] }, host: { const: '127.0.0.1' }, port: { type: 'integer', minimum: 1024, maximum: 65535 }, serverName: { type: 'string', pattern: '^(pico|pod)\\.sim\\.arbi\\.test$' }, certificateSha256: digest }
    } }
  }
};
const validate = new Ajv2020({ strict: true }).compile(schema);
export function readBoundedFile(file: string, maxBytes: number): Buffer {
  const fd = openSync(file, 'r');
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size > maxBytes) throw new Error('FILE_SIZE');
    const data = Buffer.alloc(maxBytes + 1);
    let used = 0;
    while (used < data.length) {
      const count = readSync(fd, data, used, data.length - used, null);
      if (count === 0) break;
      used += count;
    }
    if (used > maxBytes) throw new Error('FILE_SIZE');
    return data.subarray(0, used);
  } finally { closeSync(fd); }
}
export function validateSettings(input: unknown): Settings {
  if (!validate(input)) throw new Error('INVALID_SETTINGS');
  const settings = structuredClone(input) as unknown as Settings;
  const applied = validateConfigurationRecord(settings.applied, 'applied');
  if (!applied.ok) throw new Error(applied.error.code);
  const config = applied.value.request.configuration;
  if (config.executionMode !== 'simulation' || config.realm.environment !== 'test' || config.calibration?.scope !== 'simulation'
    || settings.applied.appliedBy.deviceId !== settings.serviceId || settings.applied.configurationDigest !== settings.acceptedConfigurationDigest) throw new Error('CONFIGURATION_NOT_ACCEPTED');
  if (new Set(settings.modules.map((m) => m.deviceId)).size !== 2) throw new Error('INVALID_ENROLLMENT');
  for (const m of settings.modules) {
    const component = config.components.find((c) => c.id === m.deviceId);
    if (m.role !== m.deviceId || m.serverName !== `${m.deviceId}.sim.arbi.test` || component?.kind !== 'module' || component.role !== m.role) throw new Error('INVALID_ENROLLMENT');
  }
  const edge = config.components.find((c) => c.id === settings.serviceId);
  if (edge?.kind !== 'module' || edge.role !== 'edge') throw new Error('INVALID_ENROLLMENT');
  return settings;
}
export function loadSettings(file: string): Settings {
  return validateSettings(JSON.parse(readBoundedFile(file, 262144).toString('utf8')));
}
