import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { CAD_TAG, inputsMatch, releaseInputs, sha256 } from '../../../scripts/cad-release-data.mjs';

const parse = (bytes) => JSON.parse(new TextDecoder().decode(bytes));

export function parseChecksums(text) {
  const assets = {};
  for (const line of text.trim().split('\n')) {
    const match = /^([0-9a-f]{64})\s+\*?([^/\\]+)$/.exec(line.trim());
    if (!match || assets[match[2]]) throw new Error('Invalid or duplicate release checksum');
    assets[match[2]] = match[1];
  }
  return assets;
}

export function validateReleaseManifest(manifest, tag, root, models, assets) {
  if (!CAD_TAG.test(tag) || manifest.schemaVersion !== 1 || manifest.version !== tag.slice(5)
    || !/^[0-9a-f]{40}$/.test(manifest.commit ?? '')) throw new Error('Invalid CAD release provenance');
  if (!inputsMatch(manifest.inputs, releaseInputs(root))) throw new Error('CAD release inputs differ from this checkout; wait for its CAD release');
  const expected = models.map(({ id, revision, output }) => ({ id, revision, output }));
  if (JSON.stringify(manifest.models) !== JSON.stringify(expected) || models.some((m) => !assets[m.output])) {
    throw new Error('CAD release is missing current registered outputs');
  }
  return manifest.commit;
}

// Filenames alone cannot establish freshness: shared geometry and assembly poses
// can change without renaming an STL. Check embedded source hashes as well.
export function packIsCurrent(files, outputs, root, kind) {
  try {
    const meshes = Object.keys(files).filter((n) => /^models\/(printable|arbi)\/.+\.stl$/.test(n));
    if (!meshes.length || meshes.some((n) => !outputs.has(basename(n)))) return false;
    const provenance = parse(files['source-provenance.json']);
    const sourcePaths = Object.keys(provenance.source_hashes);
    if (['source/render_figures.py', 'source/build_booklet.py'].some((path) => !sourcePaths.includes(path) || !files[path])) return false;
    const scad = sourcePaths.filter((p) => p.startsWith('source/arbi-hardware/') && p.endsWith('.scad'));
    if (!scad.length) return false;
    for (const path of scad) {
      const local = join(root, path.replace('source/arbi-hardware/', 'hardware/'));
      if (!files[path] || sha256(files[path]) !== provenance.source_hashes[path]
        || !existsSync(local) || sha256(readFileSync(local)) !== provenance.source_hashes[path]) return false;
    }
    for (const path of sourcePaths.filter((p) => /^source\/[^/]+\.(py|scad)$/.test(p))) {
      const local = join(root, `scripts/${kind === 'pod' ? 'payload' : 'winch'}-booklet`, basename(path));
      if (existsSync(local) && (!files[path] || sha256(files[path]) !== sha256(readFileSync(local)))) return false;
    }
    return true;
  } catch {
    return false;
  }
}
