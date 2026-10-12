"""Check the Pi 3A+ drawing trace, shared reference, mounting holes and sockets.

Requires pinned OpenSCAD and the booklet Python dependencies. Generated meshes
stay under hardware/generated; --record writes the committed nominal CAD record.
"""
import argparse
import hashlib
import json
import os
import subprocess
from pathlib import Path

import manifold3d as mf
import numpy as np
import trimesh

ROOT = Path(__file__).resolve().parents[2]
DOC = ROOT / 'hardware/assemblies/camera-pod/raspberry-pi-3a-plus'
ENTRY = 'hardware/assemblies/camera-pod/raspberry-pi-3a-plus.scad'


def manifold(mesh):
    return mf.Manifold(mf.Mesh(np.asarray(mesh.vertices, dtype=np.float32), np.asarray(mesh.faces, dtype=np.uint32)))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'hardware/generated/pi-3a-check')
    parser.add_argument('--record', type=Path)
    args = parser.parse_args()
    out = args.output.resolve()
    out.mkdir(parents=True, exist_ok=True)
    link = out / 'arbi-hardware'
    if not link.exists():
        link.symlink_to(ROOT / 'hardware', target_is_directory=True)
    env = dict(os.environ, OPENSCADPATH=str(out))
    registry = json.loads((ROOT / 'hardware/models.json').read_text())
    version = subprocess.run(['openscad', '--version'], capture_output=True, text=True, check=True)
    assert (version.stdout + version.stderr).strip() == 'OpenSCAD version ' + registry['openScadVersion']
    model = next(m for m in registry['models'] if m['id'] == 'raspberry-pi-3a-plus')
    trace = json.loads((DOC / 'drawing-trace.json').read_text())
    meshes, exports = {}, {}

    def export(name, source=ENTRY, defines=()):
        target = out / (name + '.stl')
        command = ['openscad', '-o', str(target)]
        for value in defines:
            command += ['-D', value]
        result = subprocess.run(command + [str(ROOT / source)], env=env, capture_output=True, text=True, timeout=120)
        assert result.returncode == 0 and not any(s in result.stderr for s in ['ERROR:', 'WARNING:']), result.stderr
        mesh = trimesh.load_mesh(target)
        assert mesh.is_watertight and mesh.is_winding_consistent and mesh.volume > 0, name
        meshes[name] = mesh
        exports[name] = {'bounds_mm': mesh.bounds.tolist(), 'volume_mm3': float(mesh.volume),
                         'triangles': len(mesh.faces), 'stl_sha256': hashlib.sha256(target.read_bytes()).hexdigest()}
        return mesh

    complete = export('pi')
    assert complete.body_count == 1, 'Disconnected reference parts'
    assert np.allclose(complete.bounds, [[-32.5, -30.5, -1.1], [35, 28, 10.1]], atol=.001)
    pcb = export('pcb', defines=['pi_feature="pcb"'])
    assert np.allclose(pcb.extents, [65, 56, 1.6], atol=.001)
    pcb_body = manifold(pcb)
    holes = []
    for x in [-29, 29]:
        for y in [-24.5, 24.5]:
            probe = trimesh.creation.cylinder(radius=1.3, height=2, sections=48)
            probe.apply_translation([x, y, .8])
            assert float((pcb_body ^ manifold(probe)).volume()) < .001
            probe.apply_translation([1, 0, 0])
            wrong = float((pcb_body ^ manifold(probe)).volume())
            assert wrong > .1, 'Shifted-hole regression control was missed'
            holes.append({'centre_xy_mm': [x, y], 'shifted_control_intersection_mm3': wrong})
    corner = trimesh.creation.box([.2, .2, 1])
    corner.apply_translation([-32.3, -27.8, .8])
    assert float((pcb_body ^ manifold(corner)).volume()) < .001, 'R3 corner is filled'
    square = trimesh.creation.box([65, 56, 1.6])
    square.apply_translation([0, 0, .8])
    assert float((manifold(square) ^ manifold(corner)).volume()) > .01, 'Square-corner control was missed'

    x0, y0, x1, y1 = trace['pcb_pdf_bounds_points']
    comparisons = {}
    for feature, (a, b, c, d) in trace['features_pdf_bounds_points'].items():
        mesh = export(feature, defines=[f'pi_feature="{feature}"'])
        expected = np.array([[(a-x0)*65/(x1-x0), (y1-d)*56/(y1-y0)],
                             [(c-x0)*65/(x1-x0), (y1-b)*56/(y1-y0)]]) - [32.5, 28]
        error = float(np.max(np.abs(mesh.bounds[:, :2] - expected)))
        assert error < .08, (feature, error, mesh.bounds, expected)
        if feature in trace['published_above_pcb_height_mm']:
            assert abs(mesh.bounds[1, 2] - 1.6 - trace['published_above_pcb_height_mm'][feature]) < .001
        comparisons[feature] = {'traced_plan_bounds_mm': expected.tolist(), 'max_plan_error_mm': error}

    pins = manifold(meshes['gpio']) ^ mf.Manifold.cube([100, 100, 1]).translate([-50, -50, 7])
    pin_mesh = pins.to_mesh()
    assert trimesh.Trimesh(vertices=pin_mesh.vert_properties[:, :3], faces=pin_mesh.tri_verts).body_count == 40
    body = manifold(complete)
    mouths = {}
    for name, centre, size in [('usb', [34, 3, 6.5], [1, 6, .5]),
                               ('hdmi', [0, -28.8, 6.4], [2, 1, .4]),
                               ('power', [-21.9, -28.8, 3], [3, .5, .5]),
                               ('audio', [21, -29.5, 4.6], [1, 1, 1]),
                               ('csi', [12.4, -20, 6], [.1, 2, .5]),
                               ('dsi', [-28.4, 0, 6], [.1, 2, .5])]:
        probe = trimesh.creation.box(size)
        probe.apply_translation(centre)
        volume = float((body ^ manifold(probe)).volume())
        assert volume < .001, (name, 'Blocked socket', volume)
        mouths[name] = volume

    booklet = export('booklet', 'scripts/camera-pod-booklet/reference-parts.scad', ['part="raspberry-pi-3a-plus-reference"'])
    assert np.allclose(booklet.bounds, complete.bounds, atol=.001)
    assert abs(booklet.volume - complete.volume) < .001
    assert float((manifold(booklet) - body).volume()) < .001
    assert float((body - manifold(booklet)).volume()) < .001
    paths = [ENTRY, 'hardware/lib/raspberry-pi-3a-plus.scad',
             'scripts/camera-pod-booklet/reference-parts.scad',
             str((DOC / 'drawing-trace.json').relative_to(ROOT)), str(Path(__file__).relative_to(ROOT))]
    record = {'model_revision': model['revision'], 'openScadVersion': registry['openScadVersion'],
              'evidence': 'drawing-derived nominal CAD; physical fit unverified',
              'drawing_sha256': trace['source_sha256'],
              'source_hashes': {p: hashlib.sha256((ROOT / p).read_bytes()).hexdigest() for p in paths},
              'checks': {'booklet_matches_public_reference': True, 'closed_connected_mesh': True,
                         'pcb_size_mm': [65, 56, 1.6], 'corner_radius_mm': 3, 'gpio_pin_count': 40,
                         'mounting_holes': holes, 'plan_comparisons': comparisons, 'socket_probe_intersections_mm3': mouths},
              'meshes': exports,
              'limits': 'Plan trace agreement within 0.08 mm is a source reproduction check, not a manufacturing tolerance. PCB thickness, hole diameter, Z datum, underside and mating details are nominal. No received-board, electrical or physical assembly acceptance.'}
    (out / 'cad-check.json').write_text(json.dumps(record, indent=2) + '\n')
    if args.record:
        args.record.write_text(json.dumps(record, indent=2) + '\n')
    print('PASS: official plan trace, R3 PCB, four holes/negative controls, 40 GPIO pins, six open sockets and identical public/booklet geometry.')


if __name__ == '__main__':
    main()
