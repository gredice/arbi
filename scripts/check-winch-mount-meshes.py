"""Independent default winch mesh checks (requires trimesh, numpy, manifold3d).

Usage: python scripts/check-winch-mount-meshes.py MOUNT_STL_DIR DRUM_STL_DIR
Exports must match registered 0.1.0 fabrication models. No files are modified.
This checks solid geometry only, not print fits, strengths or operating safety.
"""
import argparse
from itertools import combinations
from pathlib import Path
import numpy as np
import trimesh

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('mount_dir', type=Path)
parser.add_argument('drum_dir', type=Path)
args = parser.parse_args()


def load(folder, name):
    mesh = trimesh.load_mesh(folder / f'{name}-r0.1.0.stl')
    assert mesh.is_watertight and mesh.body_count == 1 and mesh.volume > 0, name
    return mesh


def rotation(deg, axis):
    return trimesh.transformations.rotation_matrix(np.deg2rad(deg), axis)


def move(mesh, xyz=(0, 0, 0), matrix=None):
    mesh = mesh.copy()
    if matrix is not None:
        mesh.apply_transform(matrix)
    mesh.apply_translation(xyz)
    return mesh


def overlap(a, b):
    if np.any(np.minimum(a.bounds[1], b.bounds[1]) - np.maximum(a.bounds[0], b.bounds[0]) <= 1e-5):
        return 0.0
    result = trimesh.boolean.intersection([a, b], engine='manifold')
    if result.is_empty:
        return 0.0
    triangles = result.triangles
    return abs(np.einsum('ij,ij->i', triangles[:, 0], np.cross(triangles[:, 1], triangles[:, 2])).sum() / 6)


def ring(outer, inner, length):
    return trimesh.creation.annulus(r_min=inner/2, r_max=outer/2, height=length, sections=96)


mounts = {name: load(args.mount_dir, f'winch-{name}') for name in
          ['bearing-lower', 'bearing-cap', 'motor-stand', 'coupling-guard']}
for name, mesh in mounts.items():
    assert np.all(mesh.extents <= [240, 240, 240]), name
    assert abs(mesh.bounds[0, 2]) < 1e-5, name
    print(f'{name}: one watertight solid; bounds {mesh.extents.round(3).tolist()} mm')

rx = rotation(180, [1, 0, 0])
ry = rotation(90, [0, 1, 0])
rz = rotation(180, [0, 0, 1])
drum_rotation = ry @ rz
for variant, width, count in [('passive', 246.9, 2), ('powered', 570.3, 3)]:
    face = width + 93
    fixed = {
        'left lower': move(mounts['bearing-lower'], [-5.5, 0, 0]),
        'left cap': move(mounts['bearing-cap'], [-5.5, 0, 80.2]),
        'right lower': move(mounts['bearing-lower'], [width+37.5, 0, 0], rz),
        'right cap': move(mounts['bearing-cap'], [width+37.5, 0, 80.2]),
        'motor stand': move(mounts['motor-stand'], [face, 0, 0]),
        'guard': move(mounts['coupling-guard'], [face-8, 0, 80], rotation(-90, [0, 1, 0])),
        'motor envelope': move(trimesh.creation.box([122, 57, 57]), [face+61, 0, 80]),
    }
    for side, x in [('left', -5.5), ('right', width+37.5)]:
        for y in [-18, 18]:
            fixed[f'{side} cap screw head {y}'] = move(trimesh.creation.cylinder(radius=5, height=6, sections=32), [x, y, 99])
    drum = {}
    for i in range(count):
        drum[f'section {i+1}'] = move(load(args.drum_dir, f'winch-drum-{variant}-{i+1}'), [0, 0, 6+i*width/count])
    drum['left flange'] = load(args.drum_dir, 'winch-drum-flange')
    drum['right flange'] = move(load(args.drum_dir, 'winch-drum-flange-right'), [0, 0, width+12], rx)
    for i in range(2):
        drum[f'clamp {i}'] = move(load(args.drum_dir, 'winch-drum-clamp-half'), [0, 0, width+12], rotation(i*180, [0, 0, 1]))
    drum['tail clamp'] = move(load(args.drum_dir, 'winch-drum-tail-clamp'), [-14, 49, width+12])
    rod_length = 280 if variant == 'passive' else 610
    for i, angle in enumerate([0, 115, 240]):
        x, y = 39*np.cos(np.deg2rad(angle)), 39*np.sin(np.deg2rad(angle))
        drum[f'tie rod {i}'] = move(trimesh.creation.cylinder(radius=2.5, height=rod_length, sections=32), [x, y, -9+rod_length/2])
        # Conservative circular M5 washer/nut envelopes on both flange faces.
        for end, z in [('left', -3), ('right', width+15)]:
            drum[f'{end} nut/washer {i}'] = move(ring(10, 5.4, 6), [x, y, z])
    # Conservative 360-degree swept envelopes, not only one assembly angle.
    drum['tie-rod revolution envelope'] = move(ring(83, 73, rod_length), [0, 0, -9+rod_length/2])
    for end, z in [('left', -3), ('right', width+15)]:
        drum[f'{end} nut/washer revolution envelope'] = move(ring(88, 68, 6), [0, 0, z])
    moving = {name: move(mesh, [0, 0, 80], drum_rotation) for name, mesh in drum.items()}
    for name, center, od, bore, length in [
        ('left bearing', -5.5, 22, 8, 7), ('right bearing', width+37.5, 22, 8, 7),
        ('left spacer', -10, 11, 8.2, 2), ('right spacer', width+42, 11, 8.2, 2),
        ('left collar', -16, 20, 8, 10), ('right collar', width+48, 20, 8, 10),
        ('coupling', width+68.5, 20, 8, 25),
    ]:
        moving[name] = move(ring(od, bore, length), [center, 0, 80], ry)
    # Regression control: the original straight tower must fail the full-revolution check.
    straight_tower = move(trimesh.creation.box([10.2, 54, 80]), [-5.5, 0, 40])
    assert overlap(straight_tower, moving['tie-rod revolution envelope']) > 1
    tests = 0
    for (an, a), (bn, b) in combinations(fixed.items(), 2):
        v = overlap(a, b); tests += 1
        assert v < 0.001, (variant, an, bn, v)
    for an, a in fixed.items():
        for bn, b in moving.items():
            v = overlap(a, b); tests += 1
            assert v < 0.001, (variant, an, bn, v)
    print(f'{variant}: {tests} component-pair clearance checks passed (overlap <0.001 mm^3)')
