"""Inspect the compact cradle's load paths and retained interfaces from its STL.

These are nominal geometry checks, not print-strength or material qualification.
Run in an enclosure export, optionally supplying an earlier STL as --baseline.
"""
from pathlib import Path
import argparse
import hashlib
import json

import manifold3d as mf
import numpy as np
import trimesh

ROOT = Path(__file__).resolve().parents[1]
MIN_JOINT_AREA = 30.0  # mm^2; more than twice the former 14.453 mm^2 section
JOINT_X = [-15.5, -15.1, -14.7]


def solid(mesh):
    return mf.Manifold(mf.Mesh(np.asarray(mesh.vertices, dtype=np.float32),
                              np.asarray(mesh.faces, dtype=np.uint32)))


def box(size, center):
    return mf.Manifold.cube(size, True).translate(center)


def joint_sections(part):
    # A thin slab integrates the real section, including bores and recesses.
    return [{'x_mm': x, 'area_mm2': round(float((part ^ box(
        [.01, 50, 50], [x, 0, -44])).volume()) / .01, 3)} for x in JOINT_X]


def passes_joint(part):
    return all(section['area_mm2'] >= MIN_JOINT_AREA
               for section in joint_sections(part))


def cylinder(diameter, length, origin, along_x=False):
    part = mf.Manifold.cylinder(length, diameter / 2, diameter / 2, 64)
    if along_x:
        part = part.rotate([0, 90, 0])
    return part.translate(origin)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baseline', type=Path)
    args = parser.parse_args()
    manifest = json.loads((ROOT / 'mesh-manifest.json').read_text())
    entry = next(e for e in manifest if e['model_id'] == 'payload-integrated-camera-cradle')
    mesh_path = ROOT / entry['file']
    mesh = trimesh.load_mesh(mesh_path)
    # The exporter translates every fabrication mesh to its bed; inspect it
    # here in canonical assembly coordinates, as the other checkers do.
    mesh.apply_translation(-np.array(entry['export_translation_mm']))
    assert mesh.is_watertight and mesh.is_winding_consistent
    assert mesh.body_count == 1 and mesh.volume > 0
    expected = np.array([[-19.8, -16, -56.5], [21.8, 16, -31.5]])
    assert np.allclose(mesh.bounds, expected, atol=.002, rtol=0), mesh.bounds
    part = solid(mesh)
    assert passes_joint(part), joint_sections(part)

    probes = [('open frame service passage', box([14, 12, 4], [0, -2, -44.75]))]
    for x in [-10.5, 10.5]:
        for y in [7.931, -4.569]:
            probes.append((f'camera M2 axis {x},{y}', cylinder(2.1, 10, [x, y, -51])))
    probes.append(('OEM horn centre access', cylinder(4.3, 7, [-19.8, 3, -45], True)))
    probes.append(('stock horn hub pocket', cylinder(8.4, 2, [-19.8, 3, -45], True)))
    for y in [-7, 13]:
        probes.append((f'horn retainer M2 axis {y}', cylinder(2.1, 7, [-19.8, y, -45], True)))
    interfaces = [{'name': name, 'intersection_mm3': round(float((part ^ probe).volume()), 6)}
                  for name, probe in probes]
    assert all(p['intersection_mm3'] <= .005 for p in interfaces), interfaces

    # Deliberately restore the narrow neck at the inspected junctions. This
    # must fail even though the overall mesh still fits the bounding box.
    slab = box([1.2, 50, 50], [-15.1, 0, -44])
    old_neck = box([1.4, 10, 2.5], [-15.1, 3, -44.75])
    weak = part - (slab - old_neck)
    assert not passes_joint(weak), 'Thin-joint regression control was not detected'
    report = {
        'model_id': entry['model_id'], 'file': entry['file'],
        'stl_sha256': hashlib.sha256(mesh_path.read_bytes()).hexdigest(),
        'status': 'concept-unvalidated', 'units': 'mm',
        'bounds_mm': mesh.bounds.tolist(), 'volume_mm3': float(mesh.volume),
        'watertight': True, 'connected_solids': int(mesh.body_count),
        'joint_sections': joint_sections(part), 'minimum_joint_area_mm2': MIN_JOINT_AREA,
        'interface_probes': interfaces,
        'weak_joint_control': {'detected': True, 'joint_sections': joint_sections(weak)},
        'limits': 'Nominal mesh inspection only; printed strength, support removal, fit and fatigue need a reprint.'
    }
    if args.baseline:
        baseline = trimesh.load_mesh(args.baseline)
        assert not passes_joint(solid(baseline)), 'Earlier weak cradle unexpectedly passed'
        report['baseline'] = {
            'stl_sha256': hashlib.sha256(args.baseline.read_bytes()).hexdigest(),
            'volume_mm3': float(baseline.volume),
            'joint_sections': joint_sections(solid(baseline)),
            'added_volume_mm3': float(mesh.volume - baseline.volume),
            'same_bounds': bool(np.allclose(baseline.bounds, mesh.bounds, atol=.002, rtol=0)),
            'weak_joint_detected': True
        }
        assert report['baseline']['same_bounds']
    (ROOT / 'cradle-check.json').write_text(json.dumps(report, indent=2) + '\n')
    print('Compact cradle: unchanged envelope, broader joints and clear interfaces; weak-joint control detected.')


if __name__ == '__main__':
    main()
