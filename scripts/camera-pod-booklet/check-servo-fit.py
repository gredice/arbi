"""Inspect measured servo envelope, coupon fit and 25 mm screw-axis regression.

Uses pinned OpenSCAD and the camera-pod mesh-check dependencies. CAD-only.
"""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path
import manifold3d as mf
import numpy as np
import trimesh

ROOT = Path(__file__).resolve().parents[2]


def solid(mesh):
    return mf.Manifold(mf.Mesh(np.asarray(mesh.vertices, dtype=np.float32), np.asarray(mesh.faces, dtype=np.uint32)))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'hardware/generated/servo-fit-check')
    args = parser.parse_args()
    out = args.output.resolve()
    out.mkdir(parents=True, exist_ok=True)
    version = subprocess.run(['openscad', '--version'], capture_output=True, text=True, check=True)
    assert (version.stdout + version.stderr).strip() == 'OpenSCAD version 2021.01'
    exported = {}

    def export(name, source):
        scad, stl = out / (name + '.scad'), out / (name + '.stl')
        scad.write_text(source)
        result = subprocess.run(['openscad', '-o', str(stl), str(scad)], capture_output=True, text=True, timeout=120)
        assert result.returncode == 0 and not any(x in result.stderr for x in ['WARNING:', 'ERROR:']), result.stderr
        mesh = trimesh.load_mesh(stl)
        assert mesh.is_watertight and mesh.is_winding_consistent and mesh.volume > 0
        exported[name] = {'sha256': hashlib.sha256(stl.read_bytes()).hexdigest(), 'bounds_mm': mesh.bounds.tolist()}
        return mesh

    library = ROOT / 'hardware/lib/micro-pan-tilt-servo.scad'
    mounts = ROOT / 'hardware/lib/camera-pod-mounts.scad'
    mesh = export('rigid-servo', f'include <{library}>\ntranslate([0,0,-ms_bottom])micro_pan_tilt_servo(leads=false,solid=true);\n')
    assert np.allclose(mesh.extents, [31.8, 9, 24.5], atol=.001), mesh.extents
    servo = solid(mesh)
    for x in [-12.5, 12.5]:
        screw = mf.Manifold.cylinder(3, .8, .8, 64).translate([x, 0, 15.5])
        assert (screw ^ servo).volume() < .005, 'Measured servo end bores blocked'
    coupon = export('coupon', f'include <{mounts}>\ncamera_pod_servo_fit_coupon();\n')
    assert np.allclose(coupon.extents, [35.8, 15, 2.5], atol=.001)
    host = solid(coupon)
    case = mf.Manifold.cube([20, 9, 5], True)
    assert (case.translate([0, 0, 1.25]) ^ host).volume() < .005, 'Accepted body opening changed'
    tests = []
    for pitch in [25, 24]:
        volumes = []
        for x in [-pitch / 2, pitch / 2]:
            probe = mf.Manifold.cylinder(4, .8, .8, 64).translate([x, 0, -.5])
            volumes.append(float((probe ^ host).volume()))
        tests.append({'pitch_mm': pitch, 'screw_intersections_mm3': volumes})
        if pitch == 25:
            assert max(volumes) < .005, 'M1.6 shafts blocked at corrected axes'
        else:
            assert min(volumes) > .005, 'Old 24 mm pattern must detect misalignment'
    # Wire centreline lengths are evaluated from the canonical source itself.
    source = out / 'lead-length.csg'
    probe = out / 'lead-length.scad'
    probe.write_text(f'include <{library}>\nfunction path_length(lane,i=1) = i>72 ? 0 : norm(ms_lead_point(i/72,lane)-ms_lead_point((i-1)/72,lane))+path_length(lane,i+1);\necho([for(lane=[-1:1]) path_length(lane)]);cube(1);\n')
    result = subprocess.run(['openscad', '-o', str(source), str(probe)], capture_output=True, text=True, check=True)
    lengths = json.loads(next(line[6:] for line in result.stderr.splitlines() if line.startswith('ECHO: ')))
    assert lengths == [145, 145, 145], lengths
    report = {'status': 'CAD-only; physical fit evidence recorded separately', 'rigid_envelope_mm': mesh.extents.tolist(),
              'preserved_body_window_mm': [20.8, 9.3], 'screw_checks': tests, 'lead_lengths_mm': lengths,
              'meshes': exported, 'source_hashes': {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
                  for p in [library, mounts, ROOT / 'scripts/camera-pod-booklet/check-servo-fit.py']}}
    (out / 'check.json').write_text(json.dumps(report, indent=2) + '\n')
    print('Measured envelope, preserved opening, 25 mm screw axes and 24 mm regression pass.')


if __name__ == '__main__':
    main()
