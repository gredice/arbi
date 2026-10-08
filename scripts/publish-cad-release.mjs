#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CAD_TAG, LEGACY_CAD_TAG, compareCadTags, nextVersion, releaseInputs, sha256 } from './cad-release-data.mjs';

const repo = process.env.GITHUB_REPOSITORY;
const commit = process.env.GITHUB_SHA;
const output = process.env.CAD_OUTPUT;
if (repo !== 'gredice/arbi' || !/^[0-9a-f]{40}$/.test(commit ?? '') || !output || process.env.GITHUB_REF !== 'refs/heads/main') {
  throw new Error('CAD publication requires gredice/arbi main, an exact commit and CAD_OUTPUT');
}
const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
// Asset metadata grows far beyond Node's command-output buffer. Keep only the
// version/commit fields, with one JSON object per line across every API page.
const releases = gh('api', `repos/${repo}/releases?per_page=100`, '--paginate', '--jq', '.[] | {tag_name,target_commitish,draft}')
  .split('\n').filter(Boolean).map((line) => JSON.parse(line));
const existing = releases.filter((r) => CAD_TAG.test(r.tag_name) && r.target_commitish === commit
  && (!process.env.CAD_VERSION || r.tag_name === `cad-v${process.env.CAD_VERSION}`))
  .sort((a, b) => compareCadTags(b.tag_name, a.tag_name))[0];
const version = existing?.tag_name.slice(5) ?? nextVersion(releases.map((r) => r.tag_name), process.env.CAD_VERSION);
const tag = `cad-v${version}`;

// Check the commit referenced by Latest, not version numbers or completion time.
// Re-running an old source must never move Latest backwards.
let latest = true;
// The releases list is not the authoritative Latest pointer (legacy SHA tags sort
// poorly); check that pointer too. Only an actual 404 permits an absent pointer.
let pointer;
try {
  pointer = JSON.parse(gh('api', `repos/${repo}/releases/latest`, '--jq', '{tag_name}'));
} catch (error) {
  if (!String(error.stderr).includes('HTTP 404')) throw error;
}
if (pointer) {
  if (!CAD_TAG.test(pointer.tag_name) && !LEGACY_CAD_TAG.test(pointer.tag_name)) throw new Error('Latest is not a CAD release');
  const pointerCommit = gh('api', `repos/${repo}/commits/${pointer.tag_name}`, '--jq', '.sha');
  const relation = gh('api', `repos/${repo}/compare/${pointerCommit}...${commit}`, '--jq', '.status');
  latest = relation === 'ahead' || relation === 'identical';
  if (relation === 'identical' && CAD_TAG.test(pointer.tag_name) && compareCadTags(tag, pointer.tag_name) < 0) latest = false;
}

if (!existing || existing.draft) {
  const registry = JSON.parse(readFileSync('hardware/models.json', 'utf8'));
  const required = [
    ...registry.models.map((m) => m.output), `cad-sources-${commit}.zip`, 'ARBI-CAD-previews.zip',
    ...['ARBI-winch', 'ARBI-payload', 'ARBI-payload-enclosure'].flatMap((name) => [`${name}-assembly-STL.pdf`, `${name}-STL-pack.zip`]),
  ];
  for (const name of required) {
    if (!readFileSync(join(output, name)).length) throw new Error(`Empty CAD release asset: ${name}`);
  }
  writeFileSync(join(output, 'cad-release.json'), JSON.stringify({
    schemaVersion: 1, version, commit, openScadVersion: registry.openScadVersion,
    inputs: releaseInputs(process.cwd()),
    models: registry.models.map(({ id, revision, output }) => ({ id, revision, output })),
  }, null, 2) + '\n');
  const assets = readdirSync(output).filter((n) => /\.(stl|csg|pdf|zip|json)$/.test(n)).sort();
  writeFileSync(join(output, 'SHA256SUMS.txt'), assets.map((n) => `${sha256(readFileSync(join(output, n)))}  ${n}\n`).join(''));
  const notes = join(output, 'release-notes.md');
  writeFileSync(notes, `CAD and assembly booklet snapshot ${version} for [commit ${commit.slice(0, 12)}](https://github.com/${repo}/commit/${commit}).\n\n`
    + `All ${registry.models.length} registered models were built with OpenSCAD ${registry.openScadVersion}. Includes individual STL fabrication parts, CSG assembly references, hardware sources, and the winch and current integrated enclosure PDFs and source packs. The dry payload booklet/pack is an explicit bench alternative containing archived bench models; do not combine it with the current enclosure kit.\n\n`
    + '`ARBI-CAD-previews.zip` includes a source-checked figure for every registered model. `cad-release.json` records the source commit, model revisions and exact CAD/booklet/preview input hashes. `SHA256SUMS.txt` verifies every distributed asset.\n\n'
    + 'Nominal CAD checks do not establish physical fit, mass, strength, weather resistance or installation safety.\n');
  const paths = [...assets, 'SHA256SUMS.txt'].map((name) => join(output, name));
  if (existing) gh('release', 'upload', tag, ...paths, '--clobber');
  else gh('release', 'create', tag, ...paths, '--target', commit, '--title', `CAD v${version}`, '--notes-file', notes, '--draft');
}
gh('release', 'edit', tag, '--draft=false', `--latest=${latest}`);
appendFileSync(process.env.GITHUB_OUTPUT, `tag=${tag}\ncommit=${commit}\nlatest=${latest}\n`);
console.log(`Published ${tag} from ${commit}; Latest=${latest}`);
