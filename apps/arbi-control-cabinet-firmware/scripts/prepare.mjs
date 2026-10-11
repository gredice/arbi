import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { configurationDigest, validateConfigurationRecord } from '@arbi/protocol';
import { motionProfile } from '@arbi/simulation-core';
import { app } from './toolchain.mjs';

const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]` : value !== null && typeof value === 'object' ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}` : JSON.stringify(value);
export function sourceIdentity(directory = app) {
  try {
    const options = { cwd: directory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] };
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], options).trim();
    if (!/^[a-f0-9]{40}$/u.test(sha)) throw new Error('Unknown source revision');
    return { sha, dirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], options).trim().length > 0 };
  } catch { return { sha: 'unknown', dirty: true }; }
}
export function prepare() {
  const output = join(app, 'dist/generated');
  mkdirSync(output, { recursive: true });
  const layout=JSON.parse(readFileSync(join(app,'update-layout.json'),'utf8'));
  if(layout.version!=='arbi.pico-flash-model/1.0'||layout.origin!=='simulated'||layout.physicalInstallerEnabled!==false||layout.romPartitionTableInstalled!==false||layout.deviceSignatureVerifierAvailable!==false)throw new Error('Physical updater remains unavailable');
  let end=0;
  for(const p of layout.partitions){if(!Number.isSafeInteger(p.offset)||!Number.isSafeInteger(p.bytes)||p.offset!==end||p.offset%4096||p.bytes<4096||p.bytes%4096)throw new Error('Invalid model partition');end=p.offset+p.bytes;}
  if(end!==4194304||layout.flashBytes!==end||layout.localTrialBudgetMs!==8000)throw new Error('Invalid model bounds');
  writeFileSync(join(output,'update_layout.h'),`#define ARBI_FLASH_MODEL_BYTES ${layout.flashBytes}u\n#define ARBI_FLASH_MODEL_IMAGE_BYTES ${layout.partitions.find(p=>p.name==='A').bytes}u\n#define ARBI_FLASH_MODEL_HEADER_BYTES ${layout.imageHeaderBytes}u\n#define ARBI_FLASH_MODEL_TRIAL_MS ${layout.localTrialBudgetMs}u\n`);
  const configuration = JSON.parse(readFileSync(new URL('../../packages/arbi-protocol/fixtures/configuration.json', new URL('../', import.meta.url)), 'utf8')).valid.configuration;
  const result = validateConfigurationRecord(configuration, 'configuration');
  if (!result.ok || configuration.executionMode !== 'simulation' || configuration.realm.environment !== 'test') throw new Error('Invalid isolated configuration fixture');
  const text = canonical(configuration);
  if (Buffer.byteLength(text) > 16384) throw new Error('Configuration exceeds firmware bound');
  writeFileSync(join(output, 'configuration.json'), text);
  // This is an immutable, test-only admitted profile. The target has no profile.
  writeFileSync(join(output, 'fixture.h'), `static const char fixture_config[] = {${[...Buffer.from(text), 0].join(',')}};\n#define FIXTURE_CONFIG fixture_config\n#define FIXTURE_DIGEST "${configurationDigest(configuration)}"\n#define FIXTURE_REVISION "${configuration.revision}"\n`);
  const mechanics = JSON.parse(readFileSync(new URL('../../../packages/arbi-simulation-core/fixtures/motion/synthetic.json', import.meta.url), 'utf8'));
  const profile = motionProfile(configuration, mechanics.axes);
  writeFileSync(join(output, 'motion-profile.json'), JSON.stringify(profile));
  const point = v => `{${v.x},${v.y},${v.z}}`;
  const axes = profile.axes.map(a => `{${[a.radiusMm,a.fullStepsPerTurn,a.microsteps,a.direction,a.homeCableMm,a.homeSteps,a.minimumCableMm,a.maximumCableMm,a.minimumSteps,a.maximumSteps,a.maximumRateHz,a.maximumAccelerationHzPerS].join(',')}}`).join(',');
  // Test-only. Ordinary diagnostic firmware never links an admitted motion profile.
  writeFileSync(join(output, 'motion_fixture.h'), `static const MotionProfile motion_fixture = {\n.identity={${Object.values(profile.identity).map(JSON.stringify).join(',')}},\n.anchors={${profile.anchors.map(point).join(',')}},.minimum_mm=${point(profile.minimumMm)},.maximum_mm=${point(profile.maximumMm)},\n.offsets_mm={${profile.offsetsMm.join(',')}},.maximum_speed_mm_per_s=${profile.maximumSpeedMmPerS},.maximum_acceleration_mm_per_s2=${profile.maximumAccelerationMmPerS2},\n.axes={${axes}}};\n`);
  const { sha, dirty } = sourceIdentity();
  writeFileSync(join(output, 'build_identity.h'), `#define ARBI_BUILD_SHA "${sha}"\n#define ARBI_BUILD_DIRTY ${dirty ? 1 : 0}\n#define ARBI_FIRMWARE_VERSION "0.1.0"\n`);
}
