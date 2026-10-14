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
  const referenceMeshes = {};
  const scenes = {};
  const appearances = {};
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
    // CSG surfaces are for inspection only, separate from downloadable part meshes.
    if (model.artifactRole === 'reference' && model.output.endsWith('.csg') &&
      entry.referenceMesh === `references/${model.id}.stl`) {
      const stl = files[root + entry.referenceMesh];
      if (stl?.length && digest(stl) === entry.referenceMeshSha256) referenceMeshes[model.id] = stl;
    }
    if (entry.appearance) {
      const { envelope, parts } = entry.appearance;
      const vector = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
      const unit = (v) => Number.isFinite(v) && v >= 0 && v <= 1;
      const nodes = new Set();
      const valid = vector(envelope) && envelope.every((v) => v > 0) && Array.isArray(parts) && parts.length > 0 && parts.every((part) => {
        if (!part || typeof part.node !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(part.node) || nodes.has(part.node)) return false;
        nodes.add(part.node);
        const m = part.material;
        if (part.mesh !== `appearances/${model.id}/${part.node}.stl` || !m || !vector(m.color) || !m.color.every(unit) ||
          ![m.roughness, m.metalness, m.transmission].every(unit) || !Number.isFinite(m.thickness) || m.thickness < 0 ||
          !Number.isFinite(m.ior) || m.ior < 1 || m.ior > 2.333) return false;
        const stl = files[root + part.mesh];
        return stl?.length > 0 && digest(stl) === part.sha256;
      });
      if (valid) appearances[model.id] = { envelope, parts: parts.map((part) => ({ ...part, bytes: files[root + part.mesh] })) };
    }
    // Visualization meshes share the figure's checked source dependency closure.
    // Assembly CSG previews must never become downloadable fabrication meshes.
    if (model.artifactRole === 'visualization' && entry.mesh === `meshes/${model.output}`) {
      const stl = files[root + entry.mesh];
      if (stl?.length && digest(stl) === entry.meshSha256) meshes[model.id] = stl;
    }
    // Explicit assembly inspection assets have separate identities and cannot
    // populate the fabrication/download mesh inventory. All components must be intact.
    if (model.artifactRole === 'reference' && entry.scene?.slug === model.assembly) {
      const scene = entry.scene;
      const nodes = new Set();
      const vector = (value) => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
      const valid = typeof scene.configuration === 'string' && typeof scene.pose === 'string' &&
        Array.isArray(scene.parts) && scene.parts.length > 0 && scene.parts.every((part) => {
          if (!part || typeof part.node !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(part.node) || nodes.has(part.node)) return false;
          nodes.add(part.node);
          if (part.mesh !== `assemblies/${model.id}/${part.node}.stl` || !['fixed', 'cover'].includes(part.group) ||
            typeof part.registered !== 'boolean' || (part.bomPartId != null && typeof part.bomPartId !== 'string') ||
            !vector(part.color) || part.color.some((v) => v < 0 || v > 1) || !vector(part.explode)) return false;
          const linked = models.find((item) => item.id === part.model);
          if (part.registered && (!linked || linked.assembly !== model.assembly || linked.artifactRole !== 'visualization' ||
            !linked.bomPartIds.includes(part.bomPartId))) return false;
          const stl = files[root + part.mesh];
          return stl?.length > 0 && digest(stl) === part.sha256;
        });
      if (valid) scenes[scene.slug] = { ...scene, parts: scene.parts.map((part) => ({ ...part, bytes: files[root + part.mesh] })) };
    }
  }
  return { figures, meshes, referenceMeshes, scenes, appearances };
}

export const previewFigures = (bytes, models, readSource) => previewAssets(bytes, models, readSource).figures;
