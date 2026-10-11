import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { toolchain, app, pins } from './toolchain.mjs';
import { prepare } from './prepare.mjs';

prepare();
const { sdk, root, cmake, environment } = await toolchain();
const host = join(app, 'dist/host');
mkdirSync(host, { recursive: true });
const common = ['-std=c11', '-Wall', '-Wextra', '-Werror', '-pedantic', '-O2', '-g', '-DMBEDTLS_CONFIG_FILE="arbi_mbedtls_config.h"', '-Iinclude', '-Idist/generated', `-I${sdk}/lib/mbedtls/include`, 'src/json.c', 'src/auth.c', 'src/runtime.c', `${sdk}/lib/mbedtls/library/sha256.c`, `${sdk}/lib/mbedtls/library/platform_util.c`];
const sanitize = process.argv.includes('--sanitize') ? ['-fsanitize=address,undefined', '-fno-omit-frame-pointer'] : [];
execFileSync('cc', [...common, ...sanitize, 'test/host.c', '-o', join(host, sanitize.length ? 'firmware-sanitized' : 'firmware')], { cwd: app, stdio: 'inherit', timeout: 60000 });
execFileSync('cc', ['-std=c11', '-Wall', '-Wextra', '-Werror', '-pedantic', '-O2', '-g', '-Iinclude', ...sanitize, 'src/pulse.c', 'test/pulse-host.c', '-lm', '-pthread', '-o', join(host, sanitize.length ? 'pulse-sanitized' : 'pulse')], { cwd: app, stdio: 'inherit', timeout: 60000 });
if (!process.argv.includes('--host-only')) {
  const bench = process.argv.includes('--bench-code-check');
  const build = join(app, bench ? 'dist/pico-bench-check' : 'dist/pico');
  execFileSync(cmake, ['--fresh', '-S', app, '-B', build, '-G', 'Ninja', '-DPICO_BOARD=pico2_w', `-DPICO_SDK_PATH=${sdk}`, `-DPICO_TOOLCHAIN_PATH=${root}`, `-DPICOTOOL_GIT_BRANCH=${pins.picotoolCommit}`, `-DARBI_ISOLATED_PULSE_BENCH=${bench ? 'ON' : 'OFF'}`], { env: environment, stdio: 'inherit', timeout: 300000 });
  execFileSync(cmake, ['--build', build, '--parallel', '4'], { env: environment, stdio: 'inherit', timeout: 300000 });
  execFileSync(join(root, 'bin/arm-none-eabi-size'), [join(build, 'arbi_control.elf')], { stdio: 'inherit' });
}
