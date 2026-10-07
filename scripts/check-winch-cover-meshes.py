"""Full-cover nominal mesh/interference and service checks; no physical claims.

Usage: python scripts/check-winch-cover-meshes.py EXPORT_DIR [--record JSON]
EXPORT_DIR contains registry-named winch STLs (cad:check --output-dir works).
Requires numpy, trimesh and manifold3d, as pinned by the booklet workflow.
"""
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
import trimesh

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('exports', type=Path)
parser.add_argument('--record', type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
hardware = root / 'hardware'
if not hardware.exists():
    hardware = root / 'source/arbi-hardware'  # Portable booklet pack.
registry = json.loads((hardware / 'models.json').read_text())
models = {m['id']: m for m in registry['models']}
meshes = {}
hashes = {}
for ident, model in models.items():
    if ident.startswith('winch-') and model['artifactRole'] == 'fabrication':
        path = args.exports / model['output']
        mesh = trimesh.load_mesh(path)
        assert mesh.is_watertight and mesh.is_winding_consistent and mesh.body_count == 1 and mesh.volume > 0, ident
        if ident.startswith('winch-cover-'):
            assert np.all(mesh.extents < 240) and abs(mesh.bounds[0, 2]) < 0.001, (ident, mesh.bounds)
            print(ident, 'one closed solid', mesh.extents.round(3).tolist(), 'mm', flush=True)
        meshes[ident] = mesh
        hashes[ident] = hashlib.sha256(path.read_bytes()).hexdigest()


def move(mesh, xyz=(0, 0, 0), matrix=None):
    mesh = mesh.copy()
    if matrix is not None:
        mesh.apply_transform(matrix)
    mesh.apply_translation(xyz)
    return mesh


def box(size, center):
    return move(trimesh.creation.box(size), center)


def cylinder(radius, length, center, axis='z'):
    mesh = trimesh.creation.cylinder(radius=radius, height=length, sections=64)
    if axis == 'x':
        mesh = move(mesh, matrix=trimesh.transformations.rotation_matrix(np.pi / 2, [0, 1, 0]))
    if axis == 'y':
        mesh = move(mesh, matrix=trimesh.transformations.rotation_matrix(np.pi / 2, [1, 0, 0]))
    return move(mesh, center)


def overlap(a, b):
    if np.any(np.minimum(a.bounds[1], b.bounds[1]) - np.maximum(a.bounds[0], b.bounds[0]) <= 1e-5):
        return 0.0
    result = trimesh.boolean.intersection([a, b], engine='manifold')
    if result.is_empty:
        return 0.0
    triangles = result.triangles
    return abs(np.einsum('ij,ij->i', triangles[:, 0], np.cross(triangles[:, 1], triangles[:, 2])).sum() / 6)


checks = 0


def clear(a, b, label):
    global checks
    checks += 1
    volume = overlap(a, b)
    assert volume < 0.001, (label, volume)


results = {}
rz = trimesh.transformations.rotation_matrix(np.pi, [0, 0, 1])
guard_rotation = trimesh.transformations.rotation_matrix(-np.pi / 2, [0, 1, 0])
for variant, width, count, base_length in [('passive', 246.9, 3, 550), ('powered', 570.3, 5, 880)]:
    initial_checks = checks
    pitch = (base_length - 8) / count
    end = base_length - 54
    face = width + 93
    panels, shutters, clips = [], [], []
    for i in range(count):
        x = -46 + i * pitch
        name = ('left' if i == 0 else 'right' if i == count - 1 else
                'transition' if variant == 'powered' and i == 3 else 'middle')
        matrix = np.array([[0, 0, 1, x], [1, 0, 0, -100], [0, 1, 0, 0], [0, 0, 0, 1]])
        panels.append(move(meshes[f'winch-cover-{variant}-{name}'], matrix=matrix))
        if i < count - 1:
            matrix = np.array([[1, 0, 0, x], [0, 0, -1, 80], [0, 1, 0, 14], [0, 0, 0, 1]])
            shutters.append(move(meshes[f'winch-cover-{variant}-shutter'], matrix=matrix))
        for cx in [x + 16, x + pitch - 16]:
            for sy in [-1, 1]:
                clip = move(meshes['winch-cover-clip'], [-10, 68, 0])
                clips.append(move(clip, [cx, 0, 0], np.diag([1, sy, 1, 1])))
    anchor = move(meshes['winch-cover-cable-anchor'], [end - 40, -60, 0])
    base = box([base_length, 180, 8], [-50 + base_length / 2, 0, -4])
    fixed = [base, anchor] + clips
    core = [
        # Conservative 360-degree swept drum/fastener/termination envelope.
        cylinder(70, width + 43, [(width + 25) / 2, 0, 80], 'x'),
        move(meshes['winch-bearing-lower'], [-5.5, 0, 0]),
        move(meshes['winch-bearing-lower'], [width + 37.5, 0, 0], rz),
        move(meshes['winch-motor-stand'], [face, 0, 0]),
        move(meshes['winch-coupling-guard'], [face - 8, 0, 80], guard_rotation),
        # Hull of motor body at +/-2 mm vertical adjustment.
        box([122, 57, 61], [face + 61, 0, 80]),
        cylinder(12, 25, [width + 68.5, 0, 80], 'x'),
    ]
    for bx in [-5.5, width + 37.5]:
        core.append(move(meshes['winch-bearing-cap'], [bx, 0, 80.2]))
        for by in [-18, 18]:
            core.append(cylinder(5, 6, [bx, by, 99]))
    for bx, bys in [(-21.5, [-40, 40]), (width + 53.5, [-40, 40]), (face + 20, [-44, 44]), (face + 62, [-44, 44])]:
        for by in bys:
            core.append(cylinder(6, 7, [bx, by, 11.5]))
    for bx in [width / 2 - 25, width / 2 + 25]:
        for by in [-60, 60]:
            # Large M8 washers assumed <=24 mm OD, <=1.6 mm thick.
            core.append(cylinder(12, 1.6, [bx, by, 0.8]))
    for by in [-23.57, 23.57]:
        for bz in [-23.57, 23.57]:
            ends = [cylinder(6, 14, [face - 15, by, 80 + bz + dz], 'x') for dz in [-2, 2]]
            core.append(trimesh.convex.convex_hull(np.vstack([m.vertices for m in ends])))
    # Full payout corridor intersects a deliberately closed skirt: regression control.
    line = box([width, 65, 16], [6 + width / 2, 82.5, 132])
    closed_side = box([width, 4, 106], [6 + width / 2, 78, 67])
    lifted_closed_side = move(closed_side, [0, 0, 20])
    assert overlap(lifted_closed_side, line) > 1, 'closed-slot removal regression must fail'
    for part in panels + shutters:
        for other in fixed + core:
            clear(part, other, (variant, 'installed shell/core'))
        clear(part, line, (variant, 'payout corridor'))
    for i, a in enumerate(panels + shutters):
        for j, b in enumerate((panels + shutters)[i + 1:], start=i + 1):
            clear(a, b, (variant, 'panel/shutter seams', i, j))
    for ci, clip in enumerate(clips + [anchor]):
        # No collision with existing core, bolts or represented post washers.
        for oi, other in enumerate(core):
            clear(clip, other, (variant, 'clip/anchor core', ci, oi))
    # Remove shutters first along +Y. Their attachment screws are removed.
    for shutter in shutters:
        for dy in range(0, 41, 2):
            shifted = move(shutter, [0, dy, 0])
            for other in panels + fixed + core + [line]:
                clear(shifted, other, (variant, 'shutter removal', dy))
    # Main hoods then lift +Z in left-to-right shingle order; line can remain.
    for i, panel in enumerate(panels):
        for dz in range(0, 131, 2):
            shifted = move(panel, [0, 0, dz])
            for other in fixed + core + panels[i + 1:] + [line]:
                clear(shifted, other, (variant, 'hood removal', i, dz))
    # Screwdriver along each shell screw axis, from exterior to head at Y=80.8.
    for i in range(count):
        for cx in [-46 + i * pitch + 16, -46 + (i + 1) * pitch - 16]:
            for sy in [-1, 1]:
                driver = cylinder(3, 45, [cx, sy * 107.3, 24], 'y')
                for other in panels + shutters + clips + core:
                    clear(driver, other, (variant, 'M4 side driver'))
                # Entire M4x16 shaft, OD9 washer and OD7 head against solids.
                fasteners = [cylinder(2, 16, [cx, sy * 72.8, 24], 'y'),
                             cylinder(4.5, 0.8, [cx, sy * 80.4, 24], 'y'),
                             cylinder(3.5, 4, [cx, sy * 82.8, 24], 'y')]
                nut = trimesh.creation.cylinder(radius=7 / np.sqrt(3), height=3.2, sections=6)
                nut = move(nut, [cx, sy * 70.6, 24], trimesh.transformations.rotation_matrix(np.pi / 2, [1, 0, 0]))
                for fastener in fasteners + [nut]:
                    for other in panels + shutters + clips + core:
                        clear(fastener, other, (variant, 'shell screw/nut/washer'))
                # Clip/base bolt head/washer clear the stem and the shell skirt.
                for fastener in [cylinder(4.5, 0.8, [cx, sy * 82, 6.4]),
                                 cylinder(3.5, 4, [cx, sy * 82, 8.8])]:
                    for other in panels + shutters + clips + core:
                        clear(fastener, other, (variant, 'base screw head/washer'))
    # Fixed loom ports: two <=10 mm OD cables; 2 mm radial nominal hole margin.
    for z in [50, 75]:
        loom = cylinder(5, 20, [end - 2, -48, z], 'x')
        for other in panels:
            clear(loom, other, (variant, 'loom exit'))
    # Once shells are off, clips/anchor do not obstruct existing cap drivers
    # or the 70 mm-radius rigid drum/shaft assembly lifting out of the seats.
    for bx in [-5.5, width + 37.5]:
        for by in [-18, 18]:
            tool = cylinder(3, 70, [bx, by, 139])
            for other in fixed:
                clear(tool, other, (variant, 'cap service tool'))
    for bx, bys in [(-21.5, [-40, 40]), (width + 53.5, [-40, 40]),
                    (face + 20, [-44, 44]), (face + 62, [-44, 44]),
                    (width / 2 - 25, [-60, 60]), (width / 2 + 25, [-60, 60])]:
        for by in bys:
            tool = cylinder(4, 70, [bx, by, 50])
            for other in clips + [anchor]:
                clear(tool, other, (variant, 'original M6/M8 driver access with shell off'))
    for dz in range(0, 141, 5):
        lifted = move(core[0], [0, 0, dz])
        for other in clips + [anchor]:
            clear(lifted, other, (variant, 'drum lift with original caps/coupling released'))
    if variant == 'powered':
        # Index 3 crosses the payout end: its +Y wall must resume over the
        # bearing/coupling. Clearance-only checks cannot detect a missing wall.
        witness = box([20, 3, 16], [610, 78, 132])
        retained_volume = overlap(panels[3], witness)
        matrix = np.array([[0, 0, 1, -46 + 3 * pitch], [1, 0, 0, -100],
                           [0, 1, 0, 0], [0, 0, 0, 1]])
        reused_middle = move(meshes['winch-cover-powered-middle'], matrix=matrix)
        incorrect_volume = overlap(reused_middle, witness)
        checks += 2
        assert abs(retained_volume - witness.volume) < 0.001, ('powered transition wall missing', retained_volume)
        assert incorrect_volume < 0.001, ('old middle-reuse control must lack wall', incorrect_volume)
        transition_wall = {
            'witness_bounds_mm': witness.bounds.tolist(),
            'required_volume_mm3': witness.volume,
            'retained_volume_mm3': retained_volume,
            'incorrect_middle_reuse_volume_mm3': incorrect_volume}
        print('powered transition wall retained / old reuse control:', retained_volume, incorrect_volume, flush=True)
        bay = box([30, 18, 18], [width + 69, -62, 80])
        for other in panels + shutters + fixed + core:
            clear(bay, other, 'nominal slip-ring reserved space ONLY')
    results[variant] = {'checks': checks - initial_checks, 'main_panels': count,
                        'shutters': count - 1, 'clips': 4 * count,
                        'panel_pitch_mm': pitch, 'removal_step_mm': 2,
                        'line_corridor_mm': [[6, 50, 124], [6 + width, 115, 140]]}
    if variant == 'powered':
        results[variant]['transition_wall'] = transition_wall
    print(variant, results[variant], flush=True)

record = {'cover_revision': '0.1.0', 'status': 'concept-unvalidated',
          'openScadVersion': registry['openScadVersion'], 'checks': checks,
          'variants': results, 'stl_sha256': hashes,
          'source_sha256': {'hardware/' + str(p.relative_to(hardware)): hashlib.sha256(p.read_bytes()).hexdigest()
                           for p in sorted(list((hardware / 'lib').glob('winch-*.scad'))
                                           + list((hardware / 'assemblies/winch').glob('winch-*.scad'))
                                           + [hardware / 'lib/arbi.scad', hardware / 'models.json'])},
          'checker_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
          'limitations': 'Nominal rigid geometry; no physical fit, flexible-cable bend, thermal, weather, load or contact-protection acceptance.'}
if args.record:
    args.record.write_text(json.dumps(record, indent=2) + '\n')
print(f'{checks} nominal checks passed; overlap <0.001 mm^3.', flush=True)
