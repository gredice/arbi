#!/usr/bin/env node
// Compile site data from committed repository sources and CI-built CAD releases into
// public/data (ignored). Nothing here is authored for the website:
// - hardware/models.json (CAD registry)
// - bom/catalog/*.json, bom/assemblies/assemblies.json, bom/generated/*.json (BOM)
// - docs/**/*.md, hardware/**/*.md, bom/README.md and committed docs images
// - booklet packs (GLB, STL meshes, assembly/figure manifests, line-art figures): the latest
//   source-matched versioned CAD release, else a source-checked committed snapshot
// - exploded poses from the booklet renderer's figure manifests
// - release STLs, verified against the release SHA256SUMS.txt
//
// ARBI_OFFLINE=1 skips the network and uses committed snapshots only.
// ARBI_CAD_RELEASE=cad-v<version> pins a release instead of the latest one.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';
import { CAD_TAG } from '../../../scripts/cad-release-data.mjs';
import { packIsCurrent, parseChecksums, validateReleaseManifest } from './cad-data.mjs';
import { previewAssets } from './cad-previews.mjs';
import { sceneHref } from './scene-links.mjs';

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = resolve(APP, '../..');
const OUT = process.env.ARBI_DATA_DIR ? resolve(process.env.ARBI_DATA_DIR) : join(APP, 'public/data');
const GITHUB = 'https://github.com/gredice/arbi';
const CORE = [0.12, 0.14, 0.15];
const PRODUCTION = process.env.VERCEL_ENV === 'production';
const OFFLINE = process.env.ARBI_OFFLINE === '1';
// Booklet packs: committed snapshot path, release asset name, installed/exploded figures.
const PACKS = {
  pod: { snapshot: 'docs/assemblies/camera-pod/booklet/ARBI-payload-enclosure-STL-pack.zip', asset: 'ARBI-camera-pod-enclosure-STL-pack.zip',
    exploded: ['overview-exploded', 'enclosure-exploded'] },
  winch: { snapshot: 'docs/assemblies/winch/booklet/ARBI-winch-STL-pack.zip', asset: 'ARBI-winch-STL-pack.zip' },
  corner: { snapshot: null, asset: 'ARBI-corner-support-STL-pack.zip' },
  dock: { snapshot: null, asset: 'ARBI-dock-STL-pack.zip' },
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

async function resolveRelease(models) {
  if (OFFLINE) {
    if (PRODUCTION) throw new Error('Production requires a source-matched CAD release; ARBI_OFFLINE is for local archival previews');
    return null;
  }
  try {
    let tag = process.env.ARBI_CAD_RELEASE;
    if (!tag) {
      const res = await fetch(`${GITHUB}/releases/latest`, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(60000) });
      tag = res.headers.get('location')?.split('/releases/tag/')[1];
      if (!tag) throw new Error(`no latest CAD release (HTTP ${res.status})`);
    }
    if (!CAD_TAG.test(tag)) throw new Error('Latest CAD release needs versioned source provenance');
    const base = `${GITHUB}/releases/download/${tag}/`;
    const sums = await (await fetchOk(base + 'SHA256SUMS.txt')).text();
    const assets = parseChecksums(sums);
    const release = { tag, url: `${GITHUB}/releases/tag/${tag}`, base, assets };
    const bytes = await releaseAsset(release, 'cad-release.json');
    if (!bytes) throw new Error('CAD release has no verified cad-release.json');
    release.commit = validateReleaseManifest(parse(bytes), tag, REPO, models, assets);
    return release;
  } catch (error) {
    if (PRODUCTION) throw error;
    console.warn(`CAD release unavailable: ${error.message}`);
    return null;
  }
}
async function fetchOk(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
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
    if (PRODUCTION) throw error;
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
async function choosePack(key, release, outputs) {
  const spec = PACKS[key];
  const localVariable = { corner: 'ARBI_CORNER_SUPPORT_PACK', dock: 'ARBI_DOCK_PACK' }[key];
  const localPack = localVariable && process.env[localVariable];
  if (localPack) {
    if (PRODUCTION) throw new Error('Production requires the verified release assembly pack');
    const files = unpack(readFileSync(resolve(localPack)));
    if (!packIsCurrent(files, outputs, REPO, key)) throw new Error('Local assembly pack is stale or incomplete');
    return { files, source: { kind: 'local', current: true } };
  }
  const fromRelease = await releaseAsset(release, spec.asset);
  if (fromRelease) {
    const files = unpack(fromRelease);
    if (packIsCurrent(files, outputs, REPO, key)) return { files, source: { kind: 'release', tag: release.tag, asset: spec.asset, current: true } };
    console.warn(`${spec.asset} in ${release.tag} differs from current CAD/booklet sources.`);
  }
  if (PRODUCTION) throw new Error(`Production requires the current verified ${spec.asset}`);
  if (!spec.snapshot) return null;
  const files = unpack(readFileSync(join(REPO, spec.snapshot)));
  const current = packIsCurrent(files, outputs, REPO, key);
  if (!current && !OFFLINE) {
    console.warn(`Omitting outdated ${key} scene; its CAD release is not ready.`);
    return null;
  }
  return { files, source: { kind: 'snapshot', path: spec.snapshot, current } };
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
  for (const [name, bytes] of Object.entries(files))
    if (name.startsWith('models/') && name.endsWith('.stl')) write(join(OUT, 'pod', name), bytes);
  const figures = parse(files['figure-manifest.json']);
  for (const [name, data] of Object.entries(files)) if (name.startsWith('figures/') && name.endsWith('.png')) write(join(OUT, 'pod', name), data);
  const assembly = parse(files['assembly-manifest.json']);
  const meshes = Object.fromEntries(parse(files['mesh-manifest.json']).map((m) => [m.model_id, m]));
  const pose = poseFigure(figures, PACKS.pod.exploded);
  const exploded = pose ? pairExploded(assembly.parts, pose.parts) : [];
  const parts = assembly.parts.map((p, i) => ({
    node: p.name, model: modelsByOutput[basename(p.file)]?.id ?? p.model, registered: Boolean(modelsByOutput[basename(p.file)]),
    href: sceneHref(modelsByOutput[basename(p.file)]?.id ?? p.model, Boolean(modelsByOutput[basename(p.file)]), p.bomPartId, catalogIds), group: p.group, color: p.color,
    url: `pod/${p.file}`, matrix: p.matrix,
    explode: offsetOf(p.matrix, exploded[i]), kind: meshes[p.model]?.kind ?? null,
  }));
  return { kind: 'stl', layout: 'assembly', figureDir: 'pod', hero: 'assembled-covered', source, pose: pose?.name ?? null,
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
    const id = model ? model.id : name.replace(/\.stl$/, '');
    return { node: `${String(i).padStart(3, '0')}-${name.replace(/\.stl$/, '')}`, model: id,
      href: sceneHref(id, Boolean(model), p.bomPartId, catalogIds),
      registered: Boolean(model), group: 'fixed', color: p.color, url: `winch/${p.file}`, matrix: p.matrix, explode: offsetOf(p.matrix, exploded[i]) };
  });
  return { kind: 'stl', layout: 'assembly', figureDir: 'winch', hero: installedFigure, source, pose: pose?.name ?? null, installedFigure, figures: Object.keys(figures).sort(), parts };
}

function assemblyPackScene({ files, source }, modelsByOutput, folder) {
  for (const [name, bytes] of Object.entries(files)) {
    if ((name.startsWith('models/') && name.endsWith('.stl')) || (name.startsWith('figures/') && name.endsWith('.png')))
      write(join(OUT, folder, name), bytes);
  }
  const figures = parse(files['figure-manifest.json']);
  const installed = figures.covered.parts;
  const exploded = pairExploded(installed, figures.exploded.parts);
  const parts = installed.map((p, i) => {
    const model = modelsByOutput[basename(p.file)];
    const id = model?.id ?? basename(p.file, '.stl');
    return { node: `${i}-${id}`, model: id, registered: Boolean(model),
      href: sceneHref(id, Boolean(model), p.bomPartId, catalogIds), group: 'fixed', color: p.color,
      url: `${folder}/${p.file}`, matrix: p.matrix, explode: offsetOf(p.matrix, exploded[i]) };
  });
  return { kind: 'stl', layout: 'assembly', figureDir: folder, hero: 'covered', source, pose: 'exploded',
    configuration: parse(files['geometry-report.json']).configuration, figures: Object.keys(figures).sort(), parts };
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
function lineupScene(slug, models, meshes, release) {
  let x = 0;
  const parts = [];
  for (const m of models) {
    const mesh = meshes[m.id];
    if (!mesh?.bounds) continue;
    const { min, max } = mesh.bounds;
    const matrix = [[1, 0, 0, x - min[0]], [0, 1, 0, -(min[1] + max[1]) / 2], [0, 0, 1, -min[2]], [0, 0, 0, 1]];
    parts.push({ node: m.id, model: m.id, registered: true, href: `/parts/${m.id}`, group: 'fixed', color: CORE, url: mesh.url, matrix, explode: [0, 0, 0] });
    x += max[0] - min[0] + 40;
  }
  return parts.length ? { kind: 'stl', layout: 'lineup', source: { kind: 'release', tag: release?.tag, current: true }, pose: null, figures: [], parts } : null;
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
  const fabrication = readJson('bom/catalog/fabrication.json');
  for (const [path, expected] of Object.entries(fabrication.geometry.sourceHashes)) {
    if (createHash('sha256').update(readFileSync(join(REPO, path))).digest('hex') !== expected) {
      throw new Error(`Stale print cost evidence: ${path}; recapture volumes and run pnpm bom:generate`);
    }
  }
  const report = readJson('bom/generated/arbi-v1-hr-zagreb.json');
  const catalog = readJson('bom/catalog/parts.json').parts;
  const quote = readJson(`bom/quotes/${report.quoteSnapshotId}.json`);
  const policies = readJson('bom/catalog/customs.json').policies;
  const assemblies = readJson('bom/assemblies/assemblies.json').assemblies;
  const offers = Object.fromEntries(readJson('bom/catalog/offers.json').offers.map((o) => [o.id, o]));
  const selections = Object.fromEntries(report.selections.map((s) => [s.offerId, s]));
  const reqs = Object.fromEntries(report.requirements.map((r) => [r.partId, r]));
  const prints = Object.fromEntries(report.fabrication.map((r) => [r.partId, r]));
  const printReferences = Object.fromEntries(report.printReferences.map((r) => [r.partId, r]));
  const parts = catalog.map((part) => {
    const r = reqs[part.id] ?? {};
    const sel = selections[r.selectedOfferId];
    const bundle = (offers[r.selectedOfferId]?.purchaseUnit.contents.length ?? 0) > 1;
    const price = quote.offerPrices.find((item) => item.offerId === r.selectedOfferId);
    const group = quote.checkoutGroups.find((item) => item.checkoutGroupId === sel?.checkoutGroupId);
    const customsPolicy = policies.find((item) => item.id === group?.customsPolicyId) ?? null;
    return { ...part, required: r.required ?? null, unit: r.unit ?? part.baseUnit, usedIn: r.assemblies ?? [], offerId: r.selectedOfferId ?? null,
      supplierId: sel?.supplierId ?? null, qualification: sel?.qualification ?? null, purchaseUnits: sel?.purchaseUnits ?? null, bundle,
      actualDelivered: price?.actualDelivered ?? null,
      quotedPrice: price?.price ?? null, delivery: price?.delivery ?? null, observedAt: price?.observedAt ?? null, customsPolicy,
      knownGoods: sel?.coverage.find((c) => c.partId === part.id)?.knownGoodsAmount ?? null,
      goodsAllocationBasis: sel?.goodsAllocationBasis ?? null, offerUrl: offers[r.selectedOfferId]?.listing?.url ?? null,
      printEstimate: prints[part.id] ?? null,
      printReference: printReferences[part.id] ?? null,
      warnings: sel?.warnings ?? [], page: `bom/generated/parts/${part.id}.md` };
  });
  const keys = ['scenarioId', 'scenarioName', 'buildId', 'destinationName', 'quoteSnapshotId', 'inputDigest', 'reportCurrency', 'complete',
    'completeLandedTotal', 'knownGoodsSubtotal', 'knownShippingSubtotal', 'knownSubtotal', 'assemblyKnownGoods',
    'sharedProcurementStockKnownGoods', 'sharedBundleGoods', 'sharedShipping', 'shipping', 'knownCustomsSubtotal', 'customs',
    'estimatedMaterialSubtotal', 'estimatedPartialSubtotal', 'assemblyEstimatedMaterials', 'assemblyPartialGoods'];
  const summary = Object.fromEntries(keys.map((k) => [k, report[k]]));
  summary.warningCount = report.warnings.length;
  return { summary, parts, assemblies };
}

// ------------------------------------------------------------------ main

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const registry = readJson('hardware/models.json');
const catalogIds = new Set(readJson('bom/catalog/parts.json').parts.map((p) => p.id));
const modelsByOutput = Object.fromEntries(registry.models.map((m) => [m.output, m]));
const outputs = new Set(Object.keys(modelsByOutput));
// Immutable archival packs keep their original filenames. Translate identities
// only for explicit offline previews; source-matched releases use canonical names.
if (OFFLINE) {
  const aliases = readJson('hardware/model-aliases.json');
  for (const [previous, current] of Object.entries(aliases)) {
    const model = registry.models.find((m) => m.id === current);
    if (model?.output.endsWith('.stl')) modelsByOutput[model.output.replace(current, previous)] = model;
  }
}
const commit = process.env.VERCEL_GIT_COMMIT_SHA || process.env.ARBI_SOURCE_COMMIT || git('rev-parse', 'HEAD') || 'unknown';
const ref = /^[0-9a-f]{40}$/.test(commit) ? commit : 'main';
const release = await resolveRelease(registry.models);

const snapshotFiles = walk(join(REPO, 'docs'), (n) => /\.(pdf|zip)$/.test(n)).concat(walk(join(REPO, 'hardware'), (n) => /\.(pdf|zip)$/.test(n), ['generated']));
const packListings = Object.fromEntries(snapshotFiles.filter((p) => p.endsWith('.zip')).flatMap((p) => {
  const files = unpack(readFileSync(p));
  const kind = basename(p).startsWith('ARBI-winch') ? 'winch' : 'pod';
  return packIsCurrent(files, outputs, REPO, kind) ? [[rel(p), Object.keys(files).map((n) => basename(n))]] : [];
}));

const podPack = await choosePack('pod', release, outputs);
const pod = podPack && podScene(podPack, modelsByOutput);
const winchPack = await choosePack('winch', release, outputs);
const winch = winchPack && winchScene(winchPack, modelsByOutput);
const poweredWinch = winchPack && winchScene(winchPack, modelsByOutput, 'powered');
const cornerPack = await choosePack('corner', release, outputs);
const dockPack = await choosePack('dock', release, outputs);
const dock = dockPack && assemblyPackScene(dockPack, modelsByOutput, 'dock');
const corner = cornerPack && assemblyPackScene(cornerPack, modelsByOutput, 'corner');

// Complete CAD inventory figures are published independently of booklet coverage.
// A local pack is useful for offline rendering checks before its release is published.
const figures = {};
const visualizationMeshes = {};
try {
  if (PRODUCTION && process.env.ARBI_CAD_PREVIEW_PACK) throw new Error('Production requires the verified release preview pack');
  const bytes = process.env.ARBI_CAD_PREVIEW_PACK
    ? readFileSync(resolve(process.env.ARBI_CAD_PREVIEW_PACK))
    : await releaseAsset(release, 'ARBI-CAD-previews.zip');
  if (bytes) {
    const assets = previewAssets(bytes, registry.models, (path) => readFileSync(join(REPO, path)));
    Object.assign(visualizationMeshes, assets.meshes);
    for (const [id, png] of Object.entries(assets.figures)) {
      const path = `figures/${id}.png`;
      write(join(OUT, path), png);
      figures[id] = path;
    }
  }
} catch (error) {
  if (PRODUCTION) throw error;
  console.warn(`CAD previews unavailable, using booklet figures: ${error.message}`);
}
if (PRODUCTION && Object.keys(figures).length !== registry.models.length) throw new Error('Production requires current figures for every registered model');

// Per-model mesh for 3D: individual booklet-pack STL, else verified release STL.
const meshes = {};
for (const model of registry.models.filter((item) => visualizationMeshes[item.id])) {
  const bytes = visualizationMeshes[model.id];
  write(join(OUT, 'visualizations', model.output), bytes);
  meshes[model.id] = { kind: 'stl', url: `visualizations/${model.output}`, bounds: stlBounds(bytes) };
}
for (const p of pod?.parts ?? []) if (p.registered && pod.source.current) meshes[p.model] ??= { kind: 'stl', url: p.url, bounds: stlBounds(readFileSync(join(OUT, p.url))) };
for (const scene of [corner, dock]) for (const p of scene?.parts ?? []) if (p.registered && scene.source.current) meshes[p.model] ??= { kind: 'stl', url: p.url, bounds: stlBounds(readFileSync(join(OUT, p.url))) };
for (const m of registry.models) {
  if (meshes[m.id] || !m.output.endsWith('.stl')) continue;
  const packed = join(OUT, 'winch/models/arbi', m.output);
  if (winch?.source.current && existsSync(packed)) {
    meshes[m.id] = { kind: 'stl', url: `winch/models/arbi/${m.output}`, bounds: stlBounds(readFileSync(packed)) };
    continue;
  }
  const bytes = await releaseAsset(release, m.output);
  if (bytes) {
    write(join(OUT, 'release', m.output), bytes);
    meshes[m.id] = { kind: 'stl', url: `release/${m.output}`, bounds: stlBounds(bytes) };
  }
}
if (PRODUCTION && registry.models.some((model) => model.artifactRole === 'visualization' && !meshes[model.id])) {
  throw new Error('Production requires current meshes for every BOM visualization');
}

const scenes = Object.fromEntries(Object.entries({ 'camera-pod': pod, winch, 'winch-powered': poweredWinch, 'corner-station': corner, dock }).filter(([, scene]) => scene));
for (const slug of [...new Set(registry.models.map((m) => m.assembly))]) {
  if (scenes[slug]) continue;
  const lineup = lineupScene(slug, registry.models.filter((m) => m.assembly === slug && m.artifactRole === 'fabrication'), meshes, release);
  if (lineup) scenes[slug] = lineup;
}
// Full placed envelope is available before downloads, keeping the camera stable as parts arrive.
for (const [slug, scene] of Object.entries(scenes)) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const part of scene.parts) {
    const bounds = stlBounds(readFileSync(join(OUT, part.url)));
    for (const x of [bounds.min[0], bounds.max[0]])
      for (const y of [bounds.min[1], bounds.max[1]])
        for (const z of [bounds.min[2], bounds.max[2]])
          for (let a = 0; a < 3; a++) {
            const row = part.matrix[a];
            const value = row[0] * x + row[1] * y + row[2] * z + row[3];
            min[a] = Math.min(min[a], value);
            max[a] = Math.max(max[a], value);
          }
  }
  scene.bounds = { min, max };
  write(join(OUT, `scenes/${slug}.json`), scene);
}

// Verified downloads: release asset with SHA-256, plus committed packs containing the file.
const downloads = Object.fromEntries(registry.models.map((m) => [m.id, {
  release: release?.assets[m.output] ? { url: release.base + m.output, sha256: release.assets[m.output], tag: release.tag } : null,
  packs: Object.entries(packListings).filter(([, names]) => names.includes(m.output)).map(([path]) => ({ path, name: basename(path), url: `${GITHUB}/raw/${ref}/${path}` })),
}]));
const missing = registry.models.filter((m) => !downloads[m.id].release).map((m) => m.output);

for (const img of ['docs/assets/arbi-cover.png', 'docs/assets/camera-pod-concept.png']) cpSync(join(REPO, img), join(OUT, img));
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
  figures,
  snapshots: snapshotFiles.map((path) => ({ path: rel(path), name: basename(path), bytes: statSync(path).size, url: `${GITHUB}/raw/${ref}/${rel(path)}`,
    kind: path.endsWith('.pdf') ? (rel(path).includes('booklet') ? 'booklet' : 'drawing') : 'pack' })),
};
write(join(OUT, 'site.json'), site);
const size = walk(OUT, () => true).reduce((s, p) => s + statSync(p).size, 0);
console.log(`Compiled ${rel(OUT)} (${(size / 1e6).toFixed(1)} MB) from ${commit.slice(0, 12)}; CAD release ${release?.tag.slice(0, 16) ?? 'unavailable'}; ` +
  Object.entries(scenes).map(([s, d]) => `${s}: ${d.source.kind}${d.pose ? ` + ${d.pose}` : ''}`).join(', ') + `; ${Object.keys(figures).length} CAD figures; ${missing.length} outputs not in release`);
