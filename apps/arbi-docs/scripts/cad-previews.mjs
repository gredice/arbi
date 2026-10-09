import { createHash } from 'node:crypto';
import { unzipSync } from 'fflate';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** Read only current, intact CAD figures; older releases can still supply unchanged parts. */
export function previewAssets(bytes, models, readSource) {
  const files = unzipSync(bytes);
  const root = 'ARBI-CAD-previews/';
  const manifest = JSON.parse(new TextDecoder().decode(files[root + 'manifest.json']));
  if (manifest.schemaVersion !== 1 || manifest.style !== 'cad-line-art-v2') throw new Error('Unsupported CAD preview manifest; current line-art figures required');
  const figures = {};
  const meshes = {};
  const sources = new Map();
  for (const model of models) {
    const entry = manifest.models[model.id];
    if (!entry || entry.revision !== model.revision || entry.output !== model.output || entry.entrypoint !== model.entrypoint) continue;
    if (entry.figure !== `figures/${model.id}.png` || !entry.sourceHashes?.[model.entrypoint]) continue;
    // Reconstruct the dependency closure locally; the manifest cannot omit a changed include.
    const visited = new Set();
    const current = (path) => {
      if (visited.has(path)) return true;
      visited.add(path);
      if (!/^hardware\/[a-zA-Z0-9_./-]+\.scad$/.test(path) || path.split('/').includes('..')) return false;
      if (!sources.has(path)) sources.set(path, readSource(path));
      const source = sources.get(path);
      if (digest(source) !== entry.sourceHashes[path]) return false;
      for (const match of source.toString('utf8').matchAll(/^\s*(?:include|use)\s*<([^>]+)>/gm)) {
        const dependency = new URL(match[1], `file:///${path}`).pathname.slice(1);
        if (!current(dependency)) return false;
      }
      return true;
    };
    if (!current(model.entrypoint)) continue;
    const png = files[root + entry.figure];
    if (!png || digest(png) !== entry.sha256 || !Buffer.from(png.subarray(0, 8)).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) continue;
    const header = new DataView(png.buffer, png.byteOffset, png.byteLength);
    if (png.byteLength < 24 || header.getUint32(16) !== 480 || header.getUint32(20) !== 360) continue;
    figures[model.id] = png;
    // Visualization meshes share the figure's checked source dependency closure.
    // Assembly CSG previews must never become downloadable fabrication meshes.
    if (model.artifactRole === 'visualization' && entry.mesh === `meshes/${model.output}`) {
      const stl = files[root + entry.mesh];
      if (stl?.length && digest(stl) === entry.meshSha256) meshes[model.id] = stl;
    }
  }
  return { figures, meshes };
}

export const previewFigures = (bytes, models, readSource) => previewAssets(bytes, models, readSource).figures;
