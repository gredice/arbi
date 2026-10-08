#!/usr/bin/env node
// Compile site data from committed repository sources and CI-built CAD releases into
// public/data (ignored). Nothing here is authored for the website:
// - hardware/models.json (CAD registry)
// - bom/catalog/*.json, bom/assemblies/assemblies.json, bom/generated/*.json (BOM)
// - docs/**/*.md, hardware/**/*.md, bom/README.md and committed docs images
// - booklet packs (GLB, STL meshes, assembly/figure manifests, line-art figures): the latest
//   cad-<commit> release when its meshes match the registry, else the committed snapshot
// - exploded poses from the booklet renderer's figure manifests
// - release STLs, verified against the release SHA256SUMS.txt
//
// ARBI_OFFLINE=1 skips the network and uses committed snapshots only.
// ARBI_CAD_RELEASE=cad-<sha> pins a release instead of the latest one.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = resolve(APP, '../..');
const OUT = process.env.ARBI_DATA_DIR ? resolve(process.env.ARBI_DATA_DIR) : join(APP, 'public/data');
const GITHUB = 'https://github.com/gredice/arbi';
const CORE = [0.12, 0.14, 0.15];
// Booklet packs: committed snapshot path, release asset name, installed/exploded figures.
const PACKS = {
  pod: { snapshot: 'docs/assemblies/camera-pod/booklet/ARBI-payload-enclosure-STL-pack.zip', asset: 'ARBI-payload-enclosure-STL-pack.zip',
    exploded: ['overview-exploded', 'enclosure-exploded'] },
  winch: { snapshot: 'docs/assemblies/winch/booklet/ARBI-winch-STL-pack.zip', asset: 'ARBI-winch-STL-pack.zip' },
};

const posix = (p) => p.split(sep).join('/');
const rel = (p) => posix(relative(REPO, p));
const readJson = (p) => JSON.parse(readFileSync(join(REPO, p), 'utf8'));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const parse = (bytes) => JSON.parse(new TextDecoder().decode(bytes));
function write(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, typeof data === 'string' || data instanceof Uint8Array ? data : JSON.stringify(data));
}
function walk(dir, keep, skip = []) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return skip.includes(e.name) ? [] : walk(p, keep, skip);
    return keep(e.name) ? [p] : [];
  }).sort();
}
function git(...args) {
  try {
    return execFileSync('git', args, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}
const mdTitle = (text, fallback) => text.match(/^#\s+(.+)$/m)?.[1].trim() ?? fallback;
function mdSummary(text) {
  for (const block of text.split(/\n\s*\n/)) {
    const b = block.trim();
    if (b && !/^[#!|\->`<]/.test(b)) return b.split(/\s+/).join(' ').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').slice(0, 320);
  }
  return '';
}

// ------------------------------------------------------------------ CAD release

async function resolveRelease() {
  if (process.env.ARBI_OFFLINE === '1') return null;
  try {
    let tag = process.env.ARBI_CAD_RELEASE;
    if (!tag) {
      const res = await fetch(`${GITHUB}/releases/latest`, { method: 'HEAD', redirect: 'manual' });
      tag = res.headers.get('location')?.match(/\/releases\/tag\/(cad-[0-9a-f]{40})$/)?.[1];
      if (!tag) throw new Error(`no cad-* latest release (HTTP ${res.status})`);
    }
    const base = `${GITHUB}/releases/download/${tag}/`;
    const sums = await (await fetchOk(base + 'SHA256SUMS.txt')).text();
    const assets = Object.fromEntries(sums.trim().split('\n').map((l) => l.trim().split(/\s+\*?/)).map(([digest, name]) => [name, digest]));
    return { tag, commit: tag.slice(4), url: `${GITHUB}/releases/tag/${tag}`, base, assets };
  } catch (error) {
    console.warn(`CAD release unavailable, using committed snapshots only: ${error.message}`);
    return null;
  }
}
async function fetchOk(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res;
}
async function releaseAsset(release, name) {
  if (!release?.assets[name]) return null;
  try {
    const bytes = new Uint8Array(await (await fetchOk(release.base + name)).arrayBuffer());
    if (sha256(bytes) !== release.assets[name]) throw new Error(`${name}: SHA-256 mismatch`);
    return bytes;
  } catch (error) {
    console.warn(`Skipping release asset: ${error.message}`);
    return null;
  }
}

// ------------------------------------------------------------------ packs and scenes

function unpack(bytes) {
  const byRel = {};
  for (const [name, data] of Object.entries(unzipSync(bytes))) if (!name.endsWith('/')) byRel[name.split('/').slice(1).join('/')] = data;
  return byRel;
}
// A pack is current when every fabrication mesh it ships is a registered output name.
const packIsCurrent = (files, outputs) => Object.keys(files).filter((n) => /^models\/(printable|arbi)\/.+\.stl$/.test(n)).every((n) => outputs.has(basename(n)));

async function choosePack(key, release, outputs) {
  const spec = PACKS[key];
  const fromRelease = await releaseAsset(release, spec.asset);
  if (fromRelease) {
    const files = unpack(fromRelease);
    if (packIsCurrent(files, outputs)) return { files, source: { kind: 'release', tag: release.tag, asset: spec.asset } };
    console.warn(`${spec.asset} in ${release.tag} has superseded mesh revisions; using the committed snapshot.`);
  }
  return { files: unpack(readFileSync(join(REPO, spec.snapshot))), source: { kind: 'snapshot', path: spec.snapshot } };
}

const translation = (m) => [m[0][3], m[1][3], m[2][3]];
const sameRotation = (a, b) => [0, 1, 2].every((i) => [0, 1, 2].every((j) => Math.abs(a[i][j] - b[i][j]) < 1e-6));
const round = (v) => v.map((x) => Math.round(x * 1000) / 1000);
function offsetOf(installed, exploded) {
  if (!exploded || !sameRotation(installed, exploded)) return [0, 0, 0];
  const a = translation(installed), b = translation(exploded);
  return round([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
}
// Pair renderer figure parts: by name when present, otherwise in order by mesh file.
// Exploded figures may omit concealed fasteners; those installed parts stay in place.
function pairExploded(installed, exploded) {
  if (installed.every((p) => p.name)) {
    const byName = Object.fromEntries(exploded.map((p) => [p.name, p]));
    return installed.map((p) => byName[p.name]?.matrix ?? null);
  }
  const out = [];
  let j = 0;
  for (const p of installed) {
    if (j < exploded.length && exploded[j].file === p.file) out.push(exploded[j++].matrix);
    else out.push(null);
  }
  if (j !== exploded.length) throw new Error(`exploded figure has ${exploded.length - j} unpaired parts`);
  return out;
}
function poseFigure(figures, names) {
  const name = names.find((n) => figures[n]);
  return name ? { name, parts: figures[name].parts } : null;
}

function podScene({ files, source }, modelsByOutput) {
  write(join(OUT, 'pod/assembled.glb'), files[Object.keys(files).find((n) => n.endsWith('-assembled.glb'))]);
  const figures = parse(files['figure-manifest.json']);
  for (const [name, data] of Object.entries(files)) if (name.startsWith('figures/') && name.endsWith('.png')) write(join(OUT, 'pod', name), data);
  const assembly = parse(files['assembly-manifest.json']);
  const meshes = Object.fromEntries(parse(files['mesh-manifest.json']).map((m) => [m.model_id, m]));
  const pose = poseFigure(figures, PACKS.pod.exploded);
  const exploded = pose ? pairExploded(assembly.parts, pose.parts) : [];
  const parts = assembly.parts.map((p, i) => ({
    node: p.name, model: p.model, registered: Boolean(modelsByOutput[basename(p.file)]), group: p.group, color: p.color,
    explode: offsetOf(p.matrix, exploded[i]), kind: meshes[p.model]?.kind ?? null,
  }));
  return { kind: 'glb', glb: 'pod/assembled.glb', layout: 'assembly', figureDir: 'pod', hero: 'assembled-covered', source, pose: pose?.name ?? null,
    configuration: assembly.configuration, figures: Object.keys(figures).sort(), parts };
}

function winchScene({ files, source }, modelsByOutput, variant = 'passive') {
  const figures = parse(files['figure-manifest.json']);
  for (const [name, data] of Object.entries(files)) {
    if (name.startsWith('figures/') && name.endsWith('.png')) write(join(OUT, 'winch', name), data);
    else if (name.startsWith('models/') && name.endsWith('.stl')) write(join(OUT, 'winch', name), data);
  }
  const installedFigure = `cover-${variant}-installed`;
  const installed = figures[installedFigure].parts;
  const pose = poseFigure(figures, [`cover-${variant}-exploded`]);
  const exploded = pose ? pairExploded(installed, pose.parts) : [];
  const parts = installed.map((p, i) => {
    const name = basename(p.file);
    const model = modelsByOutput[name];
    return { node: `${String(i).padStart(3, '0')}-${name.replace(/\.stl$/, '')}`, model: model ? model.id : name.replace(/\.stl$/, ''),
      registered: Boolean(model), group: 'fixed', color: p.color, url: `winch/${p.file}`, matrix: p.matrix, explode: offsetOf(p.matrix, exploded[i]) };
  });
  return { kind: 'stl', layout: 'assembly', figureDir: 'winch', hero: installedFigure, source, pose: pose?.name ?? null, installedFigure, figures: Object.keys(figures).sort(), parts };
}

// Bounds of a binary or ASCII STL (OpenSCAD 2021.01 exports ASCII), for laying parts side by side.
function stlBounds(bytes) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  const add = (a, x) => { if (x < min[a]) min[a] = x; if (x > max[a]) max[a] = x; };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = bytes.byteLength >= 84 ? view.getUint32(80, true) : -1;
  if (84 + count * 50 === bytes.byteLength) {
    for (let t = 0; t < count; t++) for (let v = 0; v < 3; v++) for (let a = 0; a < 3; a++) add(a, view.getFloat32(84 + t * 50 + 12 + v * 12 + a * 4, true));
  } else {
    for (const m of new TextDecoder().decode(bytes).matchAll(/vertex\s+(\S+)\s+(\S+)\s+(\S+)/g)) [1, 2, 3].forEach((i) => add(i - 1, Number(m[i])));
  }
  if (!Number.isFinite(min[0])) throw new Error('STL has no vertices');
  return { min, max };
}

// Assemblies with registered fabrication meshes but no assembly transforms: show the
// release meshes side by side. This is a parts layout, not an assembly claim.
function lineupScene(slug, models, meshes) {
  let x = 0;
  const parts = [];
  for (const m of models) {
    const mesh = meshes[m.id];
    if (!mesh?.bounds) continue;
    const { min, max } = mesh.bounds;
    const matrix = [[1, 0, 0, x - min[0]], [0, 1, 0, -(min[1] + max[1]) / 2], [0, 0, 1, -min[2]], [0, 0, 0, 1]];
    parts.push({ node: m.id, model: m.id, registered: true, group: 'fixed', color: CORE, url: mesh.url, matrix, explode: [0, 0, 0] });
    x += max[0] - min[0] + 40;
  }
  return parts.length ? { kind: 'stl', layout: 'lineup', source: { kind: 'release' }, pose: null, figures: [], parts } : null;
}

// ------------------------------------------------------------------ repository content

function docs() {
  const entries = [];
  const texts = {};
  for (const path of walk(join(REPO, 'docs'), (n) => n.endsWith('.md'))) {
    const p = rel(path);
    const text = readFileSync(path, 'utf8');
    entries.push({ path: p, title: mdTitle(text, basename(path, '.md')), section: p.split('/').length > 2 ? p.split('/')[1] : 'overview',
      summary: mdSummary(text), bytes: statSync(path).size });
  }
  // Text is bundled as JSON so the repository's Markdown link check never walks relocated copies.
  const linked = [...walk(join(REPO, 'docs'), (n) => n.endsWith('.md')), ...walk(join(REPO, 'hardware'), (n) => n.endsWith('.md'), ['generated']), join(REPO, 'bom/README.md')];
  for (const path of linked) texts[rel(path)] = readFileSync(path, 'utf8');
  write(join(OUT, 'docs.json'), texts);
  for (const img of walk(join(REPO, 'docs'), (n) => /\.(png|svg)$/.test(n))) {
    mkdirSync(dirname(join(OUT, rel(img))), { recursive: true });
    cpSync(img, join(OUT, rel(img)));
  }
  return entries;
}

function bom() {
  const report = readJson('bom/generated/arbi-v1-hr-zagreb.json');
  const catalog = readJson('bom/catalog/parts.json').parts;
  const assemblies = readJson('bom/assemblies/assemblies.json').assemblies;
  const offers = Object.fromEntries(readJson('bom/catalog/offers.json').offers.map((o) => [o.id, o]));
  const selections = Object.fromEntries(report.selections.map((s) => [s.offerId, s]));
  const reqs = Object.fromEntries(report.requirements.map((r) => [r.partId, r]));
  const parts = catalog.map((part) => {
    const r = reqs[part.id] ?? {};
    const sel = selections[r.selectedOfferId];
    const bundle = Boolean(sel && sel.coverage.length > 1);
    return { ...part, required: r.required ?? null, unit: r.unit ?? part.baseUnit, usedIn: r.assemblies ?? [], offerId: r.selectedOfferId ?? null,
      supplierId: sel?.supplierId ?? null, qualification: sel?.qualification ?? null, purchaseUnits: sel?.purchaseUnits ?? null, bundle,
      knownGoods: bundle ? null : sel?.knownGoodsAmount ?? null, offerUrl: offers[r.selectedOfferId]?.listing?.url ?? null,
      warnings: sel?.warnings ?? [], page: `bom/generated/parts/${part.id}.md` };
  });
  const keys = ['scenarioId', 'scenarioName', 'buildId', 'destinationName', 'quoteSnapshotId', 'inputDigest', 'reportCurrency', 'complete',
    'completeLandedTotal', 'knownGoodsSubtotal', 'knownShippingSubtotal', 'knownSubtotal', 'assemblyKnownGoods',
    'sharedProcurementStockKnownGoods', 'sharedBundleGoods', 'sharedShipping', 'shipping'];
  const summary = Object.fromEntries(keys.map((k) => [k, report[k]]));
  summary.warningCount = report.warnings.length;
  return { summary, parts, assemblies };
}

// ------------------------------------------------------------------ main

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const registry = readJson('hardware/models.json');
const modelsByOutput = Object.fromEntries(registry.models.map((m) => [m.output, m]));
const outputs = new Set(Object.keys(modelsByOutput));
const commit = process.env.VERCEL_GIT_COMMIT_SHA || process.env.ARBI_SOURCE_COMMIT || git('rev-parse', 'HEAD') || 'unknown';
const ref = /^[0-9a-f]{40}$/.test(commit) ? commit : 'main';
const release = await resolveRelease();

const snapshotFiles = walk(join(REPO, 'docs'), (n) => /\.(pdf|zip)$/.test(n)).concat(walk(join(REPO, 'hardware'), (n) => /\.(pdf|zip)$/.test(n), ['generated']));
const packListings = Object.fromEntries(snapshotFiles.filter((p) => p.endsWith('.zip')).map((p) => [rel(p), Object.keys(unzipSync(readFileSync(p))).map((n) => basename(n))]));

const pod = podScene(await choosePack('pod', release, outputs), modelsByOutput);
const winchPack = await choosePack('winch', release, outputs);
const winch = winchScene(winchPack, modelsByOutput);
const poweredWinch = winchScene(winchPack, modelsByOutput, 'powered');

// Per-model mesh for 3D: pod GLB node, booklet-pack STL, else verified release STL.
const meshes = {};
for (const p of pod.parts) meshes[p.model] ??= { kind: 'glb', node: p.node };
for (const m of registry.models) {
  if (meshes[m.id] || !m.output.endsWith('.stl')) continue;
  const packed = join(OUT, 'winch/models/arbi', m.output);
  if (existsSync(packed)) {
    meshes[m.id] = { kind: 'stl', url: `winch/models/arbi/${m.output}`, bounds: stlBounds(readFileSync(packed)) };
    continue;
  }
  const bytes = await releaseAsset(release, m.output);
  if (bytes) {
    write(join(OUT, 'release', m.output), bytes);
    meshes[m.id] = { kind: 'stl', url: `release/${m.output}`, bounds: stlBounds(bytes) };
  }
}

const scenes = { 'camera-pod': pod, winch, 'winch-powered': poweredWinch };
for (const slug of [...new Set(registry.models.map((m) => m.assembly))]) {
  if (scenes[slug]) continue;
  const lineup = lineupScene(slug, registry.models.filter((m) => m.assembly === slug && m.artifactRole === 'fabrication'), meshes);
  if (lineup) scenes[slug] = lineup;
}
for (const [slug, scene] of Object.entries(scenes)) write(join(OUT, `scenes/${slug}.json`), scene);

// Verified downloads: release asset with SHA-256, plus committed packs containing the file.
const downloads = Object.fromEntries(registry.models.map((m) => [m.id, {
  release: release?.assets[m.output] ? { url: release.base + m.output, sha256: release.assets[m.output], tag: release.tag } : null,
  packs: Object.entries(packListings).filter(([, names]) => names.includes(m.output)).map(([path]) => ({ path, name: basename(path), url: `${GITHUB}/raw/${ref}/${path}` })),
}]));
const missing = registry.models.filter((m) => !downloads[m.id].release).map((m) => m.output);

for (const img of ['docs/assets/arbi-cover.png', 'docs/assets/payload-concept.png']) cpSync(join(REPO, img), join(OUT, img));
const readme = readFileSync(join(REPO, 'README.md'), 'utf8');
const site = {
  repository: GITHUB,
  commit,
  commitDate: process.env.ARBI_SOURCE_DATE || git('log', '-1', '--format=%cs') || 'unknown',
  readme: { title: mdTitle(readme, 'ARBI'), summary: mdSummary(readme) },
  registry,
  bom: bom(),
  docs: docs(),
  release: release && { tag: release.tag, commit: release.commit, url: release.url, assetCount: Object.keys(release.assets).length, missingOutputs: missing,
    booklets: Object.keys(release.assets).filter((n) => /\.(pdf|zip)$/.test(n)).map((n) => ({ name: n, url: release.base + n, sha256: release.assets[n] })) },
  scenes: Object.fromEntries(Object.entries(scenes).map(([slug, s]) => [slug, { file: `scenes/${slug}.json`, kind: s.kind, layout: s.layout, pose: s.pose, source: s.source,
    hero: s.hero ? `${s.figureDir}/figures/${s.hero}.png` : null, exploded: s.pose ? `${s.figureDir}/figures/${s.pose}.png` : null, parts: s.parts.length }])),
  meshes: Object.fromEntries(Object.entries(meshes).map(([id, m]) => [id, { kind: m.kind, node: m.node, url: m.url }])),
  downloads,
  snapshots: snapshotFiles.map((path) => ({ path: rel(path), name: basename(path), bytes: statSync(path).size, url: `${GITHUB}/raw/${ref}/${rel(path)}`,
    kind: path.endsWith('.pdf') ? (rel(path).includes('booklet') ? 'booklet' : 'drawing') : 'pack' })),
};
write(join(OUT, 'site.json'), site);
const size = walk(OUT, () => true).reduce((s, p) => s + statSync(p).size, 0);
console.log(`Compiled ${rel(OUT)} (${(size / 1e6).toFixed(1)} MB) from ${commit.slice(0, 12)}; CAD release ${release?.tag.slice(0, 16) ?? 'unavailable'}; ` +
  Object.entries(scenes).map(([s, d]) => `${s}: ${d.source.kind}${d.pose ? ` + ${d.pose}` : ''}`).join(', ') + `; ${missing.length} outputs not in release`);
