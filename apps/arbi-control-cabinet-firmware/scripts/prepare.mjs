import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { configurationDigest, validateConfigurationRecord } from '@arbi/protocol';
import { app } from './toolchain.mjs';

const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]` : value !== null && typeof value === 'object' ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}` : JSON.stringify(value);
export function prepare() {
  const output = join(app, 'dist/generated');
  mkdirSync(output, { recursive: true });
  const configuration = JSON.parse(readFileSync(new URL('../../packages/arbi-protocol/fixtures/configuration.json', new URL('../', import.meta.url)), 'utf8')).valid.configuration;
  const result = validateConfigurationRecord(configuration, 'configuration');
  if (!result.ok || configuration.executionMode !== 'simulation' || configuration.realm.environment !== 'test') throw new Error('Invalid isolated configuration fixture');
  const text = canonical(configuration);
  if (Buffer.byteLength(text) > 16384) throw new Error('Configuration exceeds firmware bound');
  writeFileSync(join(output, 'configuration.json'), text);
  // This is an immutable, test-only admitted profile. The target has no profile.
  writeFileSync(join(output, 'fixture.h'), `static const char fixture_config[] = {${[...Buffer.from(text), 0].join(',')}};\n#define FIXTURE_CONFIG fixture_config\n#define FIXTURE_DIGEST "${configurationDigest(configuration)}"\n#define FIXTURE_REVISION "${configuration.revision}"\n`);
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: app, encoding: 'utf8' }).trim();
  const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], { cwd: app, encoding: 'utf8' }).trim().length > 0;
  writeFileSync(join(output, 'build_identity.h'), `#define ARBI_BUILD_SHA "${sha}"\n#define ARBI_BUILD_DIRTY ${dirty ? 1 : 0}\n#define ARBI_FIRMWARE_VERSION "0.1.0"\n`);
}
