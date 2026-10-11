import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, renameSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const app = fileURLToPath(new URL('../', import.meta.url));
export const pins = JSON.parse(readFileSync(join(app, 'toolchain.json'), 'utf8'));
const run = (name, args, options = {}) => execFileSync(name, args, { stdio: 'inherit', timeout: 300000, ...options });
const output = (name, args) => execFileSync(name, args, { encoding: 'utf8', timeout: 30000 }).trim();

export async function toolchain() {
  const directory = resolve(process.env.ARBI_PICO_TOOLS ?? join(app, 'dist/toolchain'));
  const sdk = resolve(process.env.PICO_SDK_PATH ?? join(directory, 'pico-sdk'));
  mkdirSync(directory, { recursive: true });
  if (!existsSync(sdk)) run('git', ['clone', '--depth', '1', '--branch', pins.sdk.tag, pins.sdk.repository, sdk]);
  if (output('git', ['-C', sdk, 'rev-parse', 'HEAD']) !== pins.sdk.commit) throw new Error('Pico SDK pin mismatch');
  for (const [path, commit] of Object.entries(pins.submodules)) {
    if (!existsSync(join(sdk, path, '.git'))) run('git', ['-C', sdk, 'submodule', 'update', '--init', '--depth', '1', path]);
    if (output('git', ['-C', join(sdk, path), 'rev-parse', 'HEAD']) !== commit) throw new Error(`Submodule pin mismatch: ${path}`);
  }
  const root = resolve(process.env.PICO_TOOLCHAIN_PATH ?? join(directory, 'sysroot/usr'));
  const compiler = join(root, 'bin/arm-none-eabi-gcc');
  const external = process.env.PICO_TOOLCHAIN_PATH !== undefined;
  const marker = join(dirname(root), '.arbi-toolchain');
  const identity = createHash('sha256').update(JSON.stringify(pins.packages)).digest('hex');
  if (external && !existsSync(compiler)) throw new Error('External toolchain is missing the pinned compiler');
  if (!external && (!existsSync(compiler) || !existsSync(marker) || readFileSync(marker, 'utf8') !== identity)) {
    if (process.platform !== 'linux' || process.arch !== 'x64') throw new Error('Automatic bootstrap requires Linux x64; supply the pinned external toolchain');
    for (const packagePin of pins.packages) {
      const path = join(directory, new URL(packagePin.url).pathname.split('/').at(-1));
      if (!existsSync(path)) {
        run('curl', ['--fail', '--silent', '--show-error', '--location', '--proto', '=https', '--retry', '3', '--max-time', '120', '--output', `${path}.download`, packagePin.url]);
        renameSync(`${path}.download`, path);
      }
      if (createHash('sha256').update(readFileSync(path)).digest('hex') !== packagePin.sha256) throw new Error('Toolchain package digest mismatch');
      run('dpkg-deb', ['-x', path, dirname(root)]);
    }
    writeFileSync(marker, identity);
  }
  if (!external) {
    // Repair interrupted post-extraction setup without changing external tools.
    for (const [target, path] of [['newlib', 'lib/arm-none-eabi/lib'], ['../../include/newlib', 'lib/arm-none-eabi/include']]) {
      const link = join(root, path);
      let existing;
      try { existing = lstatSync(link); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (!existing) symlinkSync(target, link);
      else if (!existing.isSymbolicLink() || readlinkSync(link) !== target) throw new Error('Unexpected internal sysroot link');
    }
  }
  if (output(compiler, ['-dumpfullversion']) !== pins.compiler) throw new Error('ARM compiler pin mismatch');
  const python = resolve(process.env.ARBI_PICO_PYTHON_TOOLS ?? join(directory, 'python'));
  const cmake = join(python, 'cmake/data/bin/cmake');
  if (!existsSync(cmake)) run('python3', ['-m', 'pip', 'install', '--disable-pip-version-check', '--target', python, `cmake==${pins.cmake}`, `ninja==${pins.ninja}`]);
  if (!output(cmake, ['--version']).startsWith(`cmake version ${pins.cmake}\n`)) throw new Error('CMake pin mismatch');
  const environment = { ...process.env, PATH: `${root}/bin:${python}/bin:${process.env.PATH}`, PYTHONPATH: python };
  if (execFileSync(join(python, 'bin/ninja'), ['--version'], { env: environment, encoding: 'utf8' }).trim() !== '1.11.1.git.kitware.jobserver-1') throw new Error('Ninja pin mismatch');
  return { sdk, root, cmake, environment };
}
