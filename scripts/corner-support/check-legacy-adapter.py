"""Nominal old-carrier/Barton adapter regression; no physical qualification.

OpenSCAD 2021.01 and scripts/winch-booklet/requirements.txt are required.
The committed old interface is compared with the original Git tree, then
actual exported meshes are checked against independent received dimensions.
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
from scipy.spatial import cKDTree

ROOT = Path(__file__).resolve().parents[2]
LIB = ROOT / 'hardware/lib'
LEGACY_COMMIT = '84f3b52829cafc73c5765cd619a582c97f770439'
LEGACY_FIXTURE = Path(__file__).resolve().parent/'fixtures/corner-head-printed-r0.1.0.scad.txt'
LEGACY_SHA256 = '414defcdde68792a9b994532f13a3684e8a735dc89273652185e520b0ae2923b'
VARIANTS = [('round', 100, 1.5), ('round', 120, 1.5),
            ('round', 140, 1.5), ('round', 120, 4.5), ('square', 100, 1.5)]


def overlap(a, b):
    if np.any(np.minimum(a.bounds[1], b.bounds[1])-np.maximum(a.bounds[0], b.bounds[0]) <= 1e-6):
        return 0.0
    result = trimesh.boolean.intersection([a, b], engine='manifold')
    return 0.0 if result.is_empty else abs(result.volume)


def ypin(diameter, length, centre):
    result = trimesh.creation.cylinder(radius=diameter/2, height=length, sections=96)
    result.apply_transform(trimesh.transformations.rotation_matrix(np.pi/2, [1, 0, 0]))
    result.apply_translation(centre)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT/'hardware/generated/legacy-pulley-adapter')
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    version = subprocess.run(['openscad', '--version'], capture_output=True, text=True, check=True)
    assert (version.stdout+version.stderr).strip() == 'OpenSCAD version 2021.01'
    report = dict(revision='0.1.0', status='concept-unvalidated', legacy_commit=LEGACY_COMMIT,
                  openscad='2021.01', variants={}, articulation={})
    with tempfile.TemporaryDirectory(prefix='arbi-legacy-adapter-') as directory:
        work = Path(directory)
        legacy = work/'original.scad'
        # Byte-for-byte original from the named Git tree, retained as text test
        # data so shallow CI/source archives do not need historical Git objects.
        assert hashlib.sha256(LEGACY_FIXTURE.read_bytes()).hexdigest() == LEGACY_SHA256
        original = LEGACY_FIXTURE.read_text()
        legacy.write_text(original.replace('include <corner-head.scad>', f'include <{LIB/"corner-head.scad"}>'))

        def export(item):
            name, source = item
            script, target = work/(name+'.scad'), work/(name+'.stl')
            script.write_text(source)
            run = subprocess.run(['openscad', '-o', str(target), str(script)], capture_output=True, text=True, timeout=120)
            log = run.stdout+run.stderr
            if run.returncode or 'ERROR:' in log or 'WARNING:' in log:
                raise ValueError(name+': '+log)
            mesh = trimesh.load_mesh(target)
            assert mesh.is_watertight and mesh.is_winding_consistent and mesh.volume > 0, name
            return name, mesh

        include = f'include <{LIB/"corner-head-legacy-adapter.scad"}>\n'
        calls = {
            'left': include+'corner_head_legacy_adapter_left();',
            'right': include+'corner_head_legacy_adapter_right();',
            'adapter': include+'lpa_body();',
            'fastener': include+'lpa_fastener();',
            'block-raw': include+'barton_size_1_block();',
            'direct-raw': include+'barton_size_1_block(show_pin=false);',
        }
        for shape, size, line in VARIANTS:
            name = f'{shape}-{size}-{line}'
            defines = f'post_shape="{shape}"; post_size_mm={size}; line_diameter_mm={line};\n'
            calls[name] = include+defines+'translate([-lch_pin_x(),0,-165]) lch_carrier();'
            calls[name+'-original'] = f'include <{legacy}>\n'+defines+'translate([-pch_pin_x(),0,-165]) pch_carrier_body();'
        with ThreadPoolExecutor(max_workers=4) as executor:
            meshes = dict(executor.map(export, calls.items()))
        for angle in [0, 15, 30, 45, 60, 75, 90]:
            for prefix, raw in [('block', 'block-raw'), ('direct', 'direct-raw')]:
                # Apply the same rigid pose as lpa_block to the exported bought
                # reference; no repeated meshing of identical block surfaces.
                mesh = meshes[raw].copy()
                mesh.apply_translation([0, 0, -42])
                mesh.apply_transform(trimesh.transformations.rotation_matrix(-np.radians(angle), [0, 1, 0]))
                if prefix == 'block':
                    mesh.apply_translation([-2/np.sqrt(2), 0, -35])
                meshes[f'{prefix}-{angle}'] = mesh
        for side in ['left', 'right']:
            mesh = meshes[side].copy()
            assert mesh.body_count == 1, side
            assert np.allclose(mesh.extents, [40.6, 7.4, 57], atol=.002), (side, mesh.extents)
            # Print transform must yield a flat Z=0 bed and 7.4 mm print height.
            angle = np.pi/2 if side == 'left' else -np.pi/2
            mesh.apply_transform(trimesh.transformations.rotation_matrix(angle, [1, 0, 0]))
            mesh.apply_translation([20.3, 14 if side == 'left' else 43, 7.4])
            assert np.allclose(mesh.bounds, [[0, 0, 0], [40.6, 57, 7.4]], atol=.002), (side, mesh.bounds)
            # Read back the public entrypoint, not just the helper transform.
            name, public = export(('print-'+side, f'include <{ROOT/"hardware/assemblies/corner-station"/("corner-head-legacy-adapter-"+side+".scad")}>'))
            assert abs(public.volume-mesh.volume) < .1 and np.allclose(public.bounds, mesh.bounds, atol=.002), (side, public.volume, mesh.volume, public.bounds)
            public.export(args.output/f'corner-head-legacy-adapter-{side}-r0.1.0.stl')
        adapter = meshes['adapter']
        assert adapter.body_count == 1
        native_pin_centre = [-2/np.sqrt(2), 0, -35]
        assert overlap(adapter, ypin(4.7, 24, native_pin_centre)) < .002
        assert overlap(adapter, ypin(8, 30, [0, -6, 0])) < .002
        assert overlap(adapter, ypin(8, 24, native_pin_centre)) > 1, 'M8 must fail the native bore'
        assert overlap(adapter, meshes['fastener']) < .002
        for shape, size, line in VARIANTS:
            name = f'{shape}-{size}-{line}'
            carrier, original_mesh = meshes[name], meshes[name+'-original']
            # Mesh identity independent of triangle order and OpenSCAD triangulation.
            common = overlap(carrier, original_mesh)
            mismatch = abs(carrier.volume+original_mesh.volume-2*common)
            # ASCII OpenSCAD coordinates are rounded after rigid transforms.
            # Check vertices independently as well as the boolean volume;
            # sub-micron rounding must not masquerade as interface drift.
            deviation = max(cKDTree(carrier.vertices).query(original_mesh.vertices)[0].max(),
                            cKDTree(original_mesh.vertices).query(carrier.vertices)[0].max())
            assert deviation < .002 and mismatch < max(.5, original_mesh.volume*1e-6), ('legacy geometry drift', name, mismatch, deviation)
            value = overlap(carrier, adapter)
            assert value < .002, ('socket fit', name, value)
            assert overlap(carrier, meshes['fastener']) < .002, ('M8 hardware clearance', name)
            passive = line == 1.5
            old_pin_x = size/2+(177.55 if passive else 176.65)-40/np.sqrt(2)
            sheave_x = old_pin_x+native_pin_centre[0]+42/np.sqrt(2)
            expected = size/2+(177.55 if passive else 176.65)
            assert abs(sheave_x-expected) < 1e-9
            report['variants'][name] = dict(socket_collision_mm3=value, legacy_difference_mm3=mismatch,
                                          legacy_vertex_deviation_mm=deviation,
                                          nominal_sheave_x_mm=sheave_x, nominal_sheave_z_mm=130-42/np.sqrt(2))
            for angle in [0, 15, 30, 45, 60, 75, 90]:
                block = meshes[f'block-{angle}']
                assert overlap(carrier, block) < .002, ('carrier articulation', name, angle)
        for angle in [0, 15, 30, 45, 60, 75, 90]:
            block = meshes[f'block-{angle}']
            value = overlap(adapter, block)
            assert value < .002, ('adapter articulation', angle, value)
            assert overlap(meshes['fastener'], block) < .002, ('fastener articulation', angle)
            report['articulation'][str(angle)] = dict(adapter_collision_mm3=value)
        direct = overlap(meshes['round-120-1.5'], meshes['direct-45'])
        assert direct > 1, 'A bushing alone must retain old square-lug interference'
        report['rejected_bushing_only_collision_mm3'] = direct
        # Keep an inspection scene in installed millimetres for reviewers.
        # These are reference surfaces, not another fabrication artifact.
        scene = trimesh.Scene()
        for name, colour in [('round-120-1.5', [63, 68, 70, 255]),
                             ('left', [219, 142, 57, 255]), ('right', [219, 142, 57, 255]),
                             ('fastener', [175, 182, 190, 255]), ('block-45', [83, 89, 96, 255])]:
            mesh = meshes[name].copy()
            mesh.visual.face_colors = colour
            mesh.export(args.output/(name+'-reference.stl'))
            scene.add_geometry(mesh, node_name=name, geom_name=name)
        scene.apply_scale(.001)
        (args.output/'legacy-adapter-inspection.glb').write_bytes(scene.export(file_type='glb'))
        sources = [LIB/'corner-head-legacy-adapter.scad', LIB/'corner-head-legacy-interface.scad',
                   LIB/'corner-head-printed.scad', LIB/'corner-head.scad', LIB/'barton-size-1-block.scad',
                   LIB/'arbi.scad', Path(__file__).resolve(), LEGACY_FIXTURE]
        report['source_sha256'] = {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in sources}
        (args.output/'geometry-check.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps({k: v for k, v in report.items() if k != 'source_sha256'}, indent=2))


if __name__ == '__main__':
    main()
