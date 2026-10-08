import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { inputsMatch, nextVersion, releaseInputs, sha256 } from '../../../scripts/cad-release-data.mjs';
import { packIsCurrent, parseChecksums, validateReleaseManifest } from '../scripts/cad-data.mjs';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(app, '../..');
const registry = JSON.parse(readFileSync(join(root, 'hardware/models.json')));

test('release versions increase numerically across legacy tags and minor/major bumps', () => {
  assert.equal(nextVersion(['cad-' + 'a'.repeat(40)]), '0.1.0');
  assert.equal(nextVersion(['cad-v0.1.9', 'cad-v0.1.10', 'cad-v0.1.2']), '0.1.11');
  assert.equal(nextVersion(['cad-v0.1.10'], '0.2.0'), '0.2.0');
  assert.equal(nextVersion(['cad-v0.9.100'], '1.0.0'), '1.0.0');
  for (const version of ['0.1.9', '0.1.10', '0.0.99', '01.2.3', '1.2.3-preview']) {
    assert.throws(() => nextVersion(['cad-v0.1.10'], version));
  }
});

test('release provenance rejects unchanged filenames with changed source, missing models and incomplete assets', () => {
  const inputs = releaseInputs(root);
  const manifest = { schemaVersion: 1, version: '0.1.0', commit: 'a'.repeat(40), inputs,
    models: registry.models.map(({ id, revision, output }) => ({ id, revision, output })) };
  const assets = Object.fromEntries(registry.models.map((m) => [m.output, 'b'.repeat(64)]));
  assert.equal(validateReleaseManifest(manifest, 'cad-v0.1.0', root, registry.models, assets), manifest.commit);
  const path = 'hardware/lib/payload-integrated-head.scad';
  assert.throws(() => validateReleaseManifest({ ...manifest, inputs: { ...inputs, [path]: 'c'.repeat(64) } }, 'cad-v0.1.0', root, registry.models, assets), /inputs differ/);
  assert.throws(() => validateReleaseManifest({ ...manifest, models: manifest.models.slice(1) }, 'cad-v0.1.0', root, registry.models, assets), /outputs/);
  const incomplete = { ...assets }; delete incomplete[registry.models[0].output];
  assert.throws(() => validateReleaseManifest(manifest, 'cad-v0.1.0', root, registry.models, incomplete), /outputs/);
  assert.throws(() => validateReleaseManifest(manifest, 'cad-v0.2.0', root, registry.models, assets), /provenance/);
  assert.equal(inputsMatch({ ...inputs, extra: 'digest' }, inputs), false);
  assert.equal(inputsMatch({}, inputs), false);
});

test('booklet freshness checks shared geometry and pose source, even when STL filenames still match', () => {
  const geometry = readFileSync(join(root, 'hardware/lib/payload-integrated-head.scad'));
  const pose = readFileSync(join(root, 'scripts/payload-booklet/render_figures.py'));
  const source = 'source/arbi-hardware/lib/payload-integrated-head.scad';
  const output = 'payload-integrated-gimbal-head-r0.1.3.stl';
  const files = {
    [`models/printable/${output}`]: new Uint8Array(), [source]: geometry,
    'source/render_figures.py': pose,
    'source-provenance.json': Buffer.from(JSON.stringify({ source_hashes: { [source]: sha256(geometry), 'source/render_figures.py': sha256(pose) } })),
  };
  const outputs = new Set([output]);
  assert.equal(packIsCurrent(files, outputs, root, 'pod'), true);
  assert.equal(packIsCurrent({ ...files, [source]: Buffer.from('old geometry') }, outputs, root, 'pod'), false);
  assert.equal(packIsCurrent({ ...files, 'source/render_figures.py': Buffer.from('old poses') }, outputs, root, 'pod'), false);
  assert.equal(packIsCurrent({}, outputs, root, 'pod'), false);
});

test('checksum manifests reject malformed, duplicate and path-bearing entries', () => {
  const digest = 'a'.repeat(64);
  assert.deepEqual(parseChecksums(`${digest}  mesh.stl\n${digest} *cad-release.json\n`), { 'mesh.stl': digest, 'cad-release.json': digest });
  for (const text of ['bad  mesh.stl', `${digest}  ../mesh.stl`, `${digest}  mesh.stl\n${digest}  mesh.stl`]) assert.throws(() => parseChecksums(text));
});

test('production rejects offline archival fallback; previews omit stale scenes and fabrication links', () => {
  const output = mkdtempSync(join(tmpdir(), 'arbi-cad-preview-'));
  try {
    assert.throws(() => execFileSync(process.execPath, ['scripts/compile-data.mjs'], {
      cwd: app, env: { ...process.env, ARBI_OFFLINE: '1', VERCEL_ENV: 'production', ARBI_DATA_DIR: output }, stdio: 'pipe',
    }), /Production requires/);
    const mock = join(output, 'network.mjs');
    writeFileSync(mock, 'globalThis.fetch = async () => new Response("", {status:404});');
    const dataDir = join(output, 'data');
    execFileSync(process.execPath, ['--import', mock, 'scripts/compile-data.mjs'], {
      cwd: app, env: { ...process.env, ARBI_OFFLINE: '0', ARBI_CAD_RELEASE: '', VERCEL_ENV: 'preview', ARBI_DATA_DIR: dataDir }, stdio: 'pipe',
    });
    const site = JSON.parse(readFileSync(join(dataDir, 'site.json')));
    assert.equal(site.release, null);
    assert.equal(site.scenes['camera-pod'], undefined);
    assert.equal(site.meshes['payload-integrated-gimbal-head'], undefined);
    assert.deepEqual(site.downloads['payload-integrated-gimbal-head'].packs, []);
  } finally { rmSync(output, { recursive: true, force: true }); }
});

test('publication reruns refresh existing releases and old source commits cannot replace Latest', () => {
  const temp = mkdtempSync(join(tmpdir(), 'arbi-release-publish-'));
  try {
    const bin = join(temp, 'bin'); mkdirSync(bin);
    const gh = join(bin, 'gh');
    writeFileSync(gh, `#!${process.execPath}\n`
      + `import {appendFileSync} from 'node:fs';\nconst args=process.argv.slice(2);appendFileSync(process.env.CALLS, JSON.stringify(args)+'\\n');\n`
      + `if(args[0]==='api') { const path=args[1];\n`
      + `if(path.includes('releases?')) console.log(JSON.stringify([process.env.MODE === 'new' ? [] : [{tag_name:'cad-v0.1.0',target_commitish:process.env.GITHUB_SHA,draft:process.env.MODE === 'draft'}]]));\n`
      + `else if(path.endsWith('releases/latest')) console.log(JSON.stringify({tag_name:'cad-v0.1.0'}));\n`
      + `else if(path.includes('/commits/')) console.log('b'.repeat(40));\n`
      + `else if(path.includes('/compare/')) console.log(process.env.RELATION); else process.exit(2); }\n`, { mode: 0o755 });
    for (const [relation, latest] of [['ahead', true], ['behind', false]]) {
      const outputs = join(temp, `output-${relation}`), calls = join(temp, `calls-${relation}`);
      execFileSync(process.execPath, ['scripts/publish-cad-release.mjs'], {
        cwd: root, env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, GITHUB_SHA: 'a'.repeat(40), GITHUB_REPOSITORY: 'gredice/arbi',
          GITHUB_REF: 'refs/heads/main', CAD_OUTPUT: temp, GITHUB_OUTPUT: outputs, CALLS: calls, RELATION: relation }, stdio: 'pipe',
      });
      assert.match(readFileSync(outputs, 'utf8'), new RegExp(`latest=${latest}`));
      const commands = readFileSync(calls, 'utf8').trim().split('\n').map(JSON.parse);
      assert.ok(commands.some((a) => a.join(' ') === `release edit cad-v0.1.0 --draft=false --latest=${latest}`));
      assert.ok(!commands.some((a) => a[1] === 'create' || a[1] === 'upload'));
    }
    for (const mode of ['new', 'draft', 'bump']) {
      const assets = join(temp, `assets-${mode}`); mkdirSync(assets);
      const names = [...registry.models.map((m) => m.output), `cad-sources-${'a'.repeat(40)}.zip`,
        ...['ARBI-winch', 'ARBI-payload', 'ARBI-payload-enclosure'].flatMap((n) => [`${n}-assembly-STL.pdf`, `${n}-STL-pack.zip`])];
      for (const name of names) writeFileSync(join(assets, name), 'publication fixture');
      const calls = join(temp, `calls-${mode}`);
      execFileSync(process.execPath, ['scripts/publish-cad-release.mjs'], {
        cwd: root, env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, GITHUB_SHA: 'a'.repeat(40), GITHUB_REPOSITORY: 'gredice/arbi',
          GITHUB_REF: 'refs/heads/main', CAD_OUTPUT: assets, GITHUB_OUTPUT: join(temp, `output-${mode}`), CALLS: calls, RELATION: 'ahead', MODE: mode,
          CAD_VERSION: mode === 'bump' ? '0.2.0' : '' }, stdio: 'pipe',
      });
      const manifest = JSON.parse(readFileSync(join(assets, 'cad-release.json')));
      assert.equal(manifest.commit, 'a'.repeat(40));
      assert.equal(manifest.version, mode === 'bump' ? '0.2.0' : '0.1.0');
      assert.deepEqual(manifest.inputs, releaseInputs(root));
      const sums = parseChecksums(readFileSync(join(assets, 'SHA256SUMS.txt'), 'utf8'));
      assert.equal(sums['cad-release.json'], sha256(readFileSync(join(assets, 'cad-release.json'))));
      const commands = readFileSync(calls, 'utf8').trim().split('\n').map(JSON.parse);
      const upload = commands.findIndex((a) => a[0] === 'release' && a[1] === (mode === 'draft' ? 'upload' : 'create'));
      const publish = commands.findIndex((a) => a[0] === 'release' && a[1] === 'edit');
      assert.ok(upload >= 0 && publish > upload);
      assert.ok(commands[upload].includes(mode === 'draft' ? '--clobber' : '--draft'));
    }
    const incomplete = join(temp, 'incomplete'); mkdirSync(incomplete);
    const calls = join(temp, 'calls-incomplete');
    assert.throws(() => execFileSync(process.execPath, ['scripts/publish-cad-release.mjs'], {
      cwd: root, env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, GITHUB_SHA: 'a'.repeat(40), GITHUB_REPOSITORY: 'gredice/arbi',
        GITHUB_REF: 'refs/heads/main', CAD_OUTPUT: incomplete, GITHUB_OUTPUT: join(temp, 'output-incomplete'), CALLS: calls, RELATION: 'ahead', MODE: 'new', CAD_VERSION: '' }, stdio: 'pipe',
    }), /ENOENT/);
    assert.ok(!readFileSync(calls, 'utf8').trim().split('\n').map(JSON.parse).some((a) => a[0] === 'release'));
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
