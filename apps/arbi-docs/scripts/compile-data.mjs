#!/usr/bin/env node
// Compile site data from committed repository sources into public/mockups/data (ignored).
//
// Nothing here is authored for the website. Every output is copied or derived from:
// - hardware/models.json (CAD registry)
// - bom/catalog/*.json, bom/assemblies/assemblies.json, bom/generated/*.json (BOM)
// - docs/**/*.md, hardware/**/*.md, bom/README.md and committed docs images
// - the committed booklet packs (GLB, STL meshes, assembly/figure manifests, line-art figures)
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = resolve(APP, '../..');
const OUT = join(APP, 'public/mockups/data');
const GITHUB = 'https://github.com/gredice/arbi';
const POD_PACK = 'docs/assemblies/camera-pod/booklet/ARBI-payload-enclosure-STL-pack.zip';
const WINCH_PACK = 'docs/assemblies/winch/booklet/ARBI-winch-STL-pack.zip';
const WINCH_SCENE = 'cover-passive-installed';

const posix = (p) => p.split(sep).join('/');
const rel = (p) => posix(relative(REPO, p));
const readJson = (p) => JSON.parse(readFileSync(join(REPO, p), 'utf8'));
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

function docs() {
  const entries = [];
  const texts = {};
  for (const path of walk(join(REPO, 'docs'), (n) => n.endsWith('.md'))) {
    const p = rel(path);
    const text = readFileSync(path, 'utf8');
    entries.push({ path: p, title: mdTitle(text, basename(path, '.md')), section: p.split('/').length > 2 ? p.split('/')[1] : 'overview',
      summary: mdSummary(text), bytes: statSync(path).size });
  }
  // Hardware and BOM Markdown is linked from part pages. Text is bundled as JSON so the
  // repository's Markdown link check never walks relocated copies.
  const linked = [...walk(join(REPO, 'docs'), (n) => n.endsWith('.md')), ...walk(join(REPO, 'hardware'), (n) => n.endsWith('.md'), ['generated']), join(REPO, 'bom/README.md')];
  for (const path of linked) texts[rel(path)] = readFileSync(path, 'utf8');
  write(join(OUT, 'docs.json'), texts);
  for (const img of walk(join(REPO, 'docs'), (n) => n.endsWith('.png'))) cpSync(img, join(OUT, rel(img)));
  return entries;
}

function downloads() {
  const files = [...walk(join(REPO, 'docs'), (n) => /\.(pdf|zip)$/.test(n)), ...walk(join(REPO, 'hardware'), (n) => /\.(pdf|zip)$/.test(n), ['generated'])];
  return files.map((path) => {
    const p = rel(path);
    return { path: p, name: basename(path), bytes: statSync(path).size, url: `${GITHUB}/raw/main/${p}`,
      kind: path.endsWith('.pdf') ? (p.includes('booklet') ? 'booklet' : 'drawing') : 'pack' };
  });
}

function unpack(pack) {
  const files = unzipSync(readFileSync(join(REPO, pack)));
  const byRel = {};
  for (const [name, data] of Object.entries(files)) if (!name.endsWith('/')) byRel[name.split('/').slice(1).join('/')] = data;
  return byRel;
}
const parse = (bytes) => JSON.parse(new TextDecoder().decode(bytes));
const figuresOf = (files, root) => {
  for (const [name, data] of Object.entries(files)) if (name.startsWith('figures/') && name.endsWith('.png')) write(join(OUT, root, name), data);
};

function pod(modelsByOutput) {
  const files = unpack(POD_PACK);
  const glb = Object.keys(files).find((n) => n.endsWith('-assembled.glb'));
  write(join(OUT, 'pod/assembled.glb'), files[glb]);
  figuresOf(files, 'pod');
  const assembly = parse(files['assembly-manifest.json']);
  const figures = parse(files['figure-manifest.json']);
  const meshes = Object.fromEntries(parse(files['mesh-manifest.json']).map((m) => [m.model_id, m]));
  const base = Object.fromEntries(assembly.parts.map((p) => [p.name, p]));
  // Authored exploded offsets from every booklet "*-exploded" figure (largest per part).
  const authored = {};
  const mag = (d) => d.reduce((s, x) => s + x * x, 0);
  for (const [fig, spec] of Object.entries(figures)) {
    if (!fig.endsWith('-exploded')) continue;
    for (const p of spec.parts) {
      const b = base[p.name];
      if (!b) continue;
      const d = [0, 1, 2].map((i) => Math.round((p.matrix[i][3] - b.matrix[i][3]) * 1000) / 1000);
      if (mag(d) > mag(authored[p.name] ?? [0, 0, 0])) authored[p.name] = d;
    }
  }
  const parts = assembly.parts.map((p) => ({
    node: p.name, model: p.model, registered: Boolean(modelsByOutput[basename(p.file)]), group: p.group, color: p.color, file: p.file,
    authoredExplode: authored[p.name] ?? null, kind: meshes[p.model]?.kind ?? null, volume_mm3: meshes[p.model]?.volume_mm3 ?? null,
  }));
  write(join(OUT, 'pod/parts.json'), { configuration: assembly.configuration, pose: assembly.pose, figures: Object.keys(figures).sort(), parts });
}

function winch(modelsByOutput) {
  const files = unpack(WINCH_PACK);
  const figures = parse(files['figure-manifest.json']);
  const meshManifest = parse(files['arbi-mesh-manifest.json']);
  const scene = figures[WINCH_SCENE].parts;
  const needed = new Set([...scene.map((p) => p.file), ...meshManifest.filter((m) => m.file).map((m) => m.file)]);
  for (const name of needed) if (files[name]) write(join(OUT, 'winch', name), files[name]);
  figuresOf(files, 'winch');
  const parts = scene.map((p, i) => {
    const name = basename(p.file);
    const model = modelsByOutput[name];
    return { node: `${String(i).padStart(3, '0')}-${name.replace(/\.stl$/, '')}`, model: model ? model.id : name.replace(/\.stl$/, ''),
      registered: Boolean(model), group: 'fixed', color: p.color, file: p.file, matrix: p.matrix };
  });
  write(join(OUT, 'winch/parts.json'), { scene: WINCH_SCENE, figures: Object.keys(figures).sort(), parts });
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

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const registry = readJson('hardware/models.json');
const modelsByOutput = Object.fromEntries(registry.models.map((m) => [m.output, m]));
for (const img of ['docs/assets/arbi-cover.png', 'docs/assets/payload-concept.png']) cpSync(join(REPO, img), join(OUT, img));
const readme = readFileSync(join(REPO, 'README.md'), 'utf8');
// Git metadata is absent from CLI uploads of a clean export; ARBI_SOURCE_* names the exported commit.
const commit = process.env.VERCEL_GIT_COMMIT_SHA || process.env.ARBI_SOURCE_COMMIT || git('rev-parse', 'HEAD') || 'unknown';
const site = {
  repository: GITHUB,
  commit,
  commitDate: process.env.ARBI_SOURCE_DATE || git('log', '-1', '--format=%cs') || 'unknown',
  readme: { title: mdTitle(readme, 'ARBI'), summary: mdSummary(readme) },
  registry,
  bom: bom(),
  docs: docs(),
  downloads: downloads(),
};
write(join(OUT, 'site.json'), site);
pod(modelsByOutput);
winch(modelsByOutput);
const size = walk(OUT, () => true).reduce((s, p) => s + statSync(p).size, 0);
console.log(`Compiled ${rel(OUT)} (${(size / 1e6).toFixed(1)} MB) from ${commit.slice(0, 12)}`);
