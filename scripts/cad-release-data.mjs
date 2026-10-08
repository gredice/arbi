import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const CAD_TAG = /^cad-v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
export const LEGACY_CAD_TAG = /^cad-([0-9a-f]{40})$/;

function files(root, dir) {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    if (entry.name === '__pycache__' || entry.name.startsWith('.')) return [];
    return entry.isDirectory() ? files(root, path) : [path];
  });
}

// One input set shared by publication and the website. Documentation/software-only
// merges can consume a preceding release; changed geometry or booklet inputs cannot.
export function releaseInputs(root) {
  const paths = [
    ...files(root, 'hardware').filter((p) => p.endsWith('.scad') && !p.startsWith('hardware/generated/')),
    'hardware/models.json', 'hardware/models.schema.json',
    ...files(root, 'scripts/payload-booklet'), ...files(root, 'scripts/winch-booklet'), ...files(root, 'scripts/cad-previews'),
    'scripts/cad-release-data.mjs', 'scripts/check-cad.mjs', 'scripts/check-booklet.py',
    'scripts/check-winch-cover-meshes.py', 'scripts/check-winch-pole-meshes.py',
    'docs/project/industrial-design.md',
  ].sort();
  return Object.fromEntries(paths.map((p) => [p, sha256(readFileSync(join(root, p)))]));
}

export function inputsMatch(actual, expected) {
  return actual && Object.keys(actual).length === Object.keys(expected).length
    && Object.entries(expected).every(([path, digest]) => actual[path] === digest);
}

export function compareCadTags(a, b) {
  const left = CAD_TAG.exec(a)?.slice(1).map(BigInt);
  const right = CAD_TAG.exec(b)?.slice(1).map(BigInt);
  if (!left || !right) throw new Error('Expected stable CAD version tags');
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
  return 0;
}

export function nextVersion(tags, requested) {
  const versions = tags.filter((tag) => CAD_TAG.test(tag)).sort((a, b) => compareCadTags(b, a));
  const newest = versions[0] && CAD_TAG.exec(versions[0]).slice(1).map(BigInt);
  const version = requested || (newest ? `${newest[0]}.${newest[1]}.${newest[2] + 1n}` : '0.1.0');
  const parsed = CAD_TAG.exec(`cad-v${version}`)?.slice(1).map(BigInt);
  if (!parsed) throw new Error('CAD version must be a stable MAJOR.MINOR.PATCH version');
  if (newest && !parsed.some((value, i) => value > newest[i] && parsed.slice(0, i).every((n, j) => n === newest[j]))) {
    throw new Error(`CAD version ${version} must exceed the newest release`);
  }
  return version;
}
