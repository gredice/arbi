"""Check the released camera geometry, material decomposition and nominal datums.

Requires the booklet/preview dependencies and pinned OpenSCAD on PATH. These
checks establish source consistency, not received-part or printed-fit acceptance.
"""
import argparse
import hashlib
import json
import subprocess
import sys
from datetime import date
from pathlib import Path

import manifold3d as mf
import numpy as np
import trimesh

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / 'scripts/cad-previews'))
from appearances import model_appearance
from build import source_hashes


def solid(mesh):
    result = mf.Manifold(mf.Mesh(np.asarray(mesh.vertices, dtype=np.float32),
                               np.asarray(mesh.faces, dtype=np.uint32)))
    assert result.status() == mf.Error.NoError, result.status()
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--record', type=Path)
    args = parser.parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    registry = json.loads((REPO / 'hardware/models.json').read_text())
    model = next(m for m in registry['models'] if m['id'] == 'raspberry-pi-camera-module-3')
    sources = source_hashes(model['entrypoint'])
    version = subprocess.run(['openscad', '--version'], capture_output=True, text=True, check=True)
    assert (version.stdout + version.stderr).strip() == 'OpenSCAD version ' + registry['openScadVersion']
    path = output / model['output']
    result = subprocess.run(['openscad', '-o', str(path), str(REPO / model['entrypoint'])],
                            capture_output=True, text=True, timeout=120, check=True)
    assert 'WARNING:' not in result.stderr and 'ERROR:' not in result.stderr, result.stderr
    mesh = trimesh.load_mesh(path)
    assert mesh.is_watertight and mesh.is_winding_consistent and mesh.volume > 0
    assert mesh.body_count == 1, mesh.body_count
    expected = [[-12.5, -11.931, -2.75], [12.5, 11.931, 9.65]]
    assert np.allclose(mesh.bounds, expected, atol=.002), mesh.bounds
    camera = solid(mesh)
    probes = []

    def empty(name, probe):
        volume = float((camera ^ solid(probe)).volume())
        assert volume < .005, (name, volume)
        probes.append(dict(name=name, intersectionMm3=volume))

    for x in [-10.5, 10.5]:
        for y in [-9.931, 2.569]:
            probe = trimesh.creation.cylinder(radius=1.05, height=13, sections=64)
            probe.apply_translation([x, y, 3.5])
            empty(f'Mounting bore {x},{y}', probe)
    # Controls distinguish the detailed geometry from the previous filled blocks.
    for name, size, center in [
        ('Air above flex tail', [3, 2, .4], [0, -8, 2.5]),
        ('Round upper barrel corner', [.3, .3, .3], [3.8, 6.269, 8.7]),
        ('Recess in front of glass', [1, 1, .15], [0, 2.469, 9.5]),
        ('Rear CSI cable entry', [14, 1, .4], [0, 10.8, -1.57]),
    ]:
        probe = trimesh.creation.box(size)
        probe.apply_translation(center)
        empty(name, probe)

    appearance = model_appearance(model, REPO, output, 4)
    assert len(appearance['parts']) == 8
    assert appearance['envelope'] == [25, 23.862, 12.4]
    combined = mf.Manifold()
    surfaces = {}
    for part in appearance['parts']:
        component = trimesh.load_mesh(output / part['mesh'])
        assert component.is_watertight and component.is_winding_consistent
        assert component.volume > 0, part['node']
        surfaces[part['node']] = solid(component)
        combined += surfaces[part['node']]
    differences = [float((camera - combined).volume()), float((combined - camera).volume())]
    assert max(differences) < .02, differences
    # The booklet sets $fn=64. Its caller resolution must not multiply the tiny
    # font outlines or produce different public/booklet silkscreen geometry.
    caller = output / 'caller-resolution.scad'
    library = (REPO / 'hardware/lib/raspberry-pi-camera-module-3.scad').as_posix()
    caller.write_text(f'use <{library}>\n$fn=64; $fa=1; $fs=.05;\ncm3_silkscreen(wide=true);\n')
    target = output / 'caller-silkscreen.stl'
    result = subprocess.run(['openscad', '-o', str(target), str(caller)],
                            capture_output=True, text=True, timeout=120, check=True)
    assert 'WARNING:' not in result.stderr and 'ERROR:' not in result.stderr, result.stderr
    called = solid(trimesh.load_mesh(target))
    letters = surfaces['white-silkscreen']
    caller_difference = [float((letters - called).volume()), float((called - letters).volume())]
    assert max(caller_difference) < .0001, caller_difference
    assert source_hashes(model['entrypoint']) == sources, 'Camera sources changed during export'
    report = dict(model=model['id'], revision=model['revision'], date=date.today().isoformat(),
                  status='Nominal CAD/material consistency only; physical acceptance unverified',
                  openScadVersion=registry['openScadVersion'], boundsMm=mesh.bounds.tolist(),
                  watertight=True, connectedBodies=mesh.body_count, volumeMm3=float(mesh.volume),
                  probes=probes, appearanceDifferenceMm3=differences,
                  callerSilkscreenDifferenceMm3=caller_difference,
                  materials=appearance['parts'], sourceHashes=sources,
                  checkerSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                  limits='Conservative focus envelope; illustrative fine detail and materials. '
                         'No physical fit, flexible cable, focus or optical validation.')
    text = json.dumps(report, indent=2) + '\n'
    (output / 'cad-check.json').write_text(text)
    if args.record:
        args.record.write_text(text)
    print('PASS camera reference: closed connected mesh, datums/bores, flex/barrel/glass/socket '
          'probes and eight material components equivalent to the release STL.')


if __name__ == '__main__':
    main()
