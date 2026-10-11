"""Measured Barton envelope and nominal mating regression, OpenSCAD 2021.01.

Reads actual exported meshes; owner measurements are independent expectations.
No print, structural, groove seating or installed articulation qualification.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile

import numpy as np
import trimesh

ROOT = Path(__file__).resolve().parents[2]
LIB = ROOT / 'hardware/lib'


def overlap(a, b):
    if np.any(np.minimum(a.bounds[1], b.bounds[1])-np.maximum(a.bounds[0], b.bounds[0]) <= 1e-6):
        return 0.0
    result = trimesh.boolean.intersection([a, b], engine='manifold')
    return abs(result.volume) if not result.is_empty else 0.0


def pin(diameter):
    result = trimesh.creation.cylinder(radius=diameter/2, height=24, sections=96)
    result.apply_transform(trimesh.transformations.rotation_matrix(np.pi/2, [1, 0, 0]))
    result.apply_translation([0, 0, 42])
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--record', type=Path)
    args = parser.parse_args()
    version = subprocess.run(['openscad', '--version'], capture_output=True, text=True, check=True)
    assert (version.stdout+version.stderr).strip() == 'OpenSCAD version 2021.01'
    calls = {
        'connector': ('corner-head.scad', 'ch_connector();'),
        'steel-block': ('corner-head.scad', 'ch_block();'),
        'block': ('barton-size-1-block.scad', 'barton_size_1_block();'),
        'tangs': ('barton-size-1-block.scad', 'barton_tangs();'),
        'pin-section': ('barton-size-1-block.scad', 'intersection(){ barton_clevis_pin(); translate([-10,-0.05,32]) cube([20,0.1,20]); }'),
        'lug': ('barton-size-1-block.scad', 'translate([0,0,42]) barton_mount_lug();'),
        'collar': ('pole-pulley-mount.scad', 'pole_pulley_mount_front();'),
    }
    meshes = {}
    with tempfile.TemporaryDirectory(prefix='arbi-barton-check-') as directory:
        work = Path(directory)

        def export(item):
            name, (library, call) = item
            source, target = work/(name+'.scad'), work/(name+'.stl')
            source.write_text(f'include <{LIB/library}>\n{call}\n')
            result = subprocess.run(['openscad', '-o', str(target), str(source)], capture_output=True, text=True, timeout=120)
            log = result.stdout+result.stderr
            if result.returncode or 'ERROR:' in log or 'WARNING:' in log:
                raise ValueError(name+': '+log)
            mesh = trimesh.load_mesh(target)
            assert mesh.is_watertight and mesh.is_winding_consistent and mesh.volume > 0, name
            return name, mesh

        with ThreadPoolExecutor(max_workers=3) as executor:
            meshes.update(executor.map(export, calls.items()))
        keeper_path = work/'keeper.stl'
        result = subprocess.run(['openscad', '-o', str(keeper_path), str(ROOT/'hardware/assemblies/corner-station/top-pulley-keeper.scad')], capture_output=True, text=True, timeout=120)
        assert result.returncode == 0 and 'WARNING:' not in result.stderr and 'ERROR:' not in result.stderr, result.stderr
        keeper = trimesh.load_mesh(keeper_path)
        assert keeper.is_watertight and keeper.is_winding_consistent and keeper.body_count == 1
        # Independent owner dimensions: X width, Y thickness, Z overall length.
        assert np.allclose(meshes['block'].extents, [36, 24, 65], atol=.002), meshes['block'].bounds
        assert np.allclose(meshes['block'].bounds[:, 2], [-18, 47], atol=.002)
        assert np.allclose(meshes['pin-section'].extents[[0, 2]], [4.7, 4.7], atol=.002)
        assert abs(meshes['pin-section'].bounds[:, 2].mean()-42) < .002
        tangs = sorted(meshes['tangs'].split(), key=lambda m: m.bounds[0, 1])
        assert len(tangs) == 2
        assert all(abs(m.extents[1]-1.5) < .002 for m in tangs)
        assert abs(tangs[1].bounds[0, 1]-tangs[0].bounds[1, 1]-15.8) < .002
        assert abs(meshes['lug'].extents[1]-14.8) < .002
        measured_pin = pin(4.7)
        assert overlap(meshes['lug'], measured_pin) < .002
        assert overlap(meshes['tangs'], measured_pin) < .002
        old_pin_collision = overlap(meshes['tangs'], pin(8))
        assert old_pin_collision > 1, 'Old M8 pin must fail the factory tang interface'
        oversized = meshes['lug'].copy()
        oversized.apply_scale([1, 16/14.8, 1])
        thick_lug_collision = overlap(oversized, meshes['tangs'])
        assert thick_lug_collision > 1, '16 mm lug must fail the 15.8 mm gap'
        steel_collision = overlap(meshes['connector'], meshes['steel-block'])
        assert steel_collision < .002, ('steel-link envelope', steel_collision)
        keeper_collision = overlap(keeper, meshes['block'])
        assert keeper_collision < .002, keeper_collision
        articulation = {}
        for angle in [0, 15, 30, 45, 60, 75, 90]:
            block = meshes['block'].copy()
            block.apply_translation([0, 0, -42])
            block.apply_transform(trimesh.transformations.rotation_matrix(-np.radians(angle), [0, 1, 0]))
            block.apply_translation([0, 0, 42])
            value = overlap(block, meshes['lug'])
            assert value < .002, ('lug articulation', angle, value)
            block.apply_translation([170, 0, 18])
            value_collar = overlap(block, meshes['collar'])
            assert value_collar < .002, ('collar articulation', angle, value_collar)
            articulation[str(angle)] = dict(lug_mm3=value, collar_mm3=value_collar)
        sources = [LIB/'corner-head.scad', LIB/'barton-size-1-block.scad', LIB/'arbi.scad', LIB/'pole-pulley-mount.scad',
                   ROOT/'hardware/assemblies/corner-station/top-pulley-keeper.scad', Path(__file__).resolve()]
        report = dict(revision='1.0.0', status='concept-unvalidated', openscad='2021.01',
                      measured_envelope_mm=[65, 36, 24], pin_mm=4.7, tang_gap_mm=15.8,
                      tang_thickness_mm=1.5, pin_to_sheave_mm=42, lug_mm=14.8, bore_mm=5.2,
                      rejected_M8_pin_collision_mm3=old_pin_collision,
                      rejected_16mm_lug_collision_mm3=thick_lug_collision,
                      keeper_block_overlap_mm3=keeper_collision, steel_link_overlap_mm3=steel_collision, sampled_articulation=articulation,
                      sources_sha256={str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in sources})
        if args.record:
            args.record.parent.mkdir(parents=True, exist_ok=True)
            args.record.write_text(json.dumps(report, indent=2)+'\n')
        print('Barton measured envelope, pin/gap, keeper and sampled nominal lug/collar clearances passed.', flush=True)
        print(f'Negative controls: M8 pin {old_pin_collision:.3f} mm3; 16 mm lug {thick_lug_collision:.3f} mm3 interference.', flush=True)


if __name__ == '__main__':
    main()
