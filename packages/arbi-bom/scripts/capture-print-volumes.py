"""Refresh canonical volume evidence from checksum-verified, source-matched CAD release STLs.

Download cad-release.json, SHA256SUMS.txt and the required STLs from the named
GitHub release to an external directory, then run this script with that directory.
No mesh or other bulk output is committed. Requires only Python's standard library.
"""
import argparse
import hashlib
import json
import math
import struct
import subprocess
import tempfile
import zipfile
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def verify_registry_metadata(previous, current, ids):
    """Archiving unrelated entries may preserve all costed fabrication identities."""
    old = {m['id']: m for m in previous['models']}
    active = {m['id']: m for m in current['models']}
    keys = ('id', 'revision', 'entrypoint', 'output', 'artifactRole')
    for id in ids:
        if id not in old or id not in active or any(old[id][k] != active[id][k] for k in keys):
            raise ValueError(f'Release fabrication identity changed or archived: {id}')


def volume_cm3(raw):
    if len(raw) >= 84 and len(raw) == 84 + 50 * struct.unpack_from('<I', raw, 80)[0]:
        triangles = [struct.unpack_from('<9f', raw, 84 + i * 50 + 12)
                     for i in range(struct.unpack_from('<I', raw, 80)[0])]
    else:
        vertices = [tuple(map(float, line.split()[1:])) for line in raw.decode('ascii').splitlines()
                    if line.strip().startswith('vertex ')]
        if not vertices or len(vertices) % 3:
            raise ValueError('Invalid ASCII STL')
        triangles = [sum(vertices[i:i + 3], ()) for i in range(0, len(vertices), 3)]
    edges = Counter()
    volumes = []
    for t in triangles:
        a, b, c = t[:3], t[3:6], t[6:9]
        for u, v in [(a, b), (b, c), (c, a)]:
            edges[(u, v)] += 1
        volumes.append(a[0] * (b[1]*c[2]-b[2]*c[1]) + a[1] * (b[2]*c[0]-b[0]*c[2]) + a[2] * (b[0]*c[1]-b[1]*c[0]))
    if any(count != 1 or edges[(v, u)] != 1 for (u, v), count in edges.items()):
        raise ValueError('Mesh is not closed with consistently oriented manifold edges')
    volume = math.fsum(volumes) / 6000  # signed tetrahedra / 6, mm³ / 1000
    if not math.isfinite(volume) or volume <= 0:
        raise ValueError('Mesh has no positive finite volume')
    return f'{volume:.6f}'


def capture(directory):
    catalog_path = ROOT / 'bom/catalog/fabrication.json'
    catalog = json.loads(catalog_path.read_text())
    registry = json.loads((ROOT / 'hardware/models.json').read_text())
    release = json.loads((directory / 'cad-release.json').read_text())
    checksums = dict((line.split()[1], line.split()[0])
                     for line in (directory / 'SHA256SUMS.txt').read_text().splitlines() if line.strip())
    if hashlib.sha256((directory / 'cad-release.json').read_bytes()).hexdigest() != checksums['cad-release.json']:
        raise ValueError('Release manifest checksum mismatch')
    sources = {p: h for p, h in release['inputs'].items()
               if p.startswith('hardware/') and (p.endswith('.scad') or p == 'hardware/models.json')}
    ids = {component['modelId'] for recipe in catalog['recipes'] for component in recipe['components']}
    for path, expected in sources.items():
        actual = hashlib.sha256((ROOT / path).read_bytes()).hexdigest()
        if path == 'hardware/models.json' and actual != expected:
            # Compare against the checksum-verified original registry. This permits
            # metadata/archival changes only; SCAD hashes and costed identities still
            # have to match the original meshes before volumes can be reused.
            name = f'cad-sources-{release["commit"]}.zip'
            archive = directory / name
            if hashlib.sha256(archive.read_bytes()).hexdigest() != checksums[name]:
                raise ValueError('Release source archive checksum mismatch')
            with zipfile.ZipFile(archive) as source:
                original = source.read(path)
            if hashlib.sha256(original).hexdigest() != expected:
                raise ValueError('Release registry source checksum mismatch')
            verify_registry_metadata(json.loads(original), registry, ids)
            sources[path] = actual
            print('Verified unchanged costed fabrication identities against the release registry; recording the current registry metadata hash.')
        elif actual != expected:
            raise ValueError(f'Release does not match current CAD: {path}')
    models = []
    for model in registry['models']:
        if model['id'] not in ids:
            continue
        if model['artifactRole'] != 'fabrication' or not model['output'].endswith('.stl'):
            raise ValueError(f'Not a fabrication mesh: {model["id"]}')
        raw = (directory / model['output']).read_bytes()
        digest = hashlib.sha256(raw).hexdigest()
        if digest != checksums[model['output']]:
            raise ValueError(f'STL checksum mismatch: {model["id"]}')
        models.append(dict(modelId=model['id'], revision=model['revision'],
                           volumeCm3=volume_cm3(raw), stlSha256=digest))
    if {m['modelId'] for m in models} != ids:
        raise ValueError('Recipe references missing registry models')
    catalog['geometry'] = dict(releaseTag='cad-v' + release['version'], sourceCommit=release['commit'],
                               sourceHashes=sources, models=sorted(models, key=lambda m: m['modelId']))
    catalog_path.write_text(json.dumps(catalog, indent=2) + '\n')
    print(f'Captured {len(models)} closed mesh volumes from {catalog["geometry"]["releaseTag"]}.')


def canonical_inputs(root):
    hardware = root / 'hardware'
    return [hardware / 'models.json', *sorted(p for p in hardware.rglob('*.scad')
            if not p.is_relative_to(hardware / 'generated'))]


def capture_current():
    """Export fresh current geometry when no matching release exists yet."""
    catalog_path = ROOT / 'bom/catalog/fabrication.json'
    catalog = json.loads(catalog_path.read_text())
    registry = json.loads((ROOT / 'hardware/models.json').read_text())
    version = subprocess.run(['openscad', '--version'], capture_output=True, text=True, check=True)
    if (version.stdout + version.stderr).strip() != 'OpenSCAD version ' + registry['openScadVersion']:
        raise ValueError('OpenSCAD version must match hardware/models.json')
    inputs = canonical_inputs(ROOT)
    def hashes():
        return {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in inputs}
    source_hashes = hashes()
    ids = {c['modelId'] for r in catalog['recipes'] for c in r['components']}
    selected = [m for m in registry['models'] if m['id'] in ids]
    if {m['id'] for m in selected} != ids:
        raise ValueError('Recipe references missing registry models')
    with tempfile.TemporaryDirectory(prefix='arbi-print-volumes-') as temp:
        def export(model):
            if model['artifactRole'] != 'fabrication' or not model['output'].endswith('.stl'):
                raise ValueError(f'Not a fabrication mesh: {model["id"]}')
            target = Path(temp) / model['output']
            result = subprocess.run(['openscad', '-o', str(target), str(ROOT / model['entrypoint'])],
                                    capture_output=True, text=True, timeout=120)
            if result.returncode or 'ERROR:' in result.stderr or 'WARNING:' in result.stderr:
                raise ValueError(f'OpenSCAD export failed: {model["id"]}\n{result.stderr}')
            raw = target.read_bytes()
            return dict(modelId=model['id'], revision=model['revision'], volumeCm3=volume_cm3(raw),
                        stlSha256=hashlib.sha256(raw).hexdigest())
        with ThreadPoolExecutor(max_workers=4) as pool:
            models = list(pool.map(export, selected))
    if hashes() != source_hashes:
        raise ValueError('CAD changed during volume capture')
    commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    catalog['geometry'] = dict(releaseTag=None, sourceCommit=commit, sourceHashes=source_hashes,
                               models=sorted(models, key=lambda m: m['modelId']))
    catalog_path.write_text(json.dumps(catalog, indent=2) + '\n')
    print(f'Captured {len(models)} closed mesh volumes from current OpenSCAD sources. Source hashes identify uncommitted edits; sourceCommit is the base commit.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('release_directory', type=Path, nargs='?', help='Verified release assets; omit to export current CAD with pinned OpenSCAD')
    args = parser.parse_args()
    if args.release_directory is None:
        capture_current()
    else:
        capture(args.release_directory)
