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


def blocked(mesh, origin, target):
    """Finite ray/triangle test without an optional spatial-index dependency."""
    direction = np.asarray(target) - np.asarray(origin)
    triangles = mesh.triangles
    edge1, edge2 = triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0]
    h = np.cross(direction, edge2)
    determinant = np.einsum('ij,ij->i', edge1, h)
    mask = abs(determinant) > 1e-9
    inv = np.zeros(len(determinant))
    inv[mask] = 1 / determinant[mask]
    s = np.asarray(origin) - triangles[:, 0]
    u = inv * np.einsum('ij,ij->i', s, h)
    q = np.cross(s, edge1)
    v = inv * (q @ direction)
    t = inv * np.einsum('ij,ij->i', edge2, q)
    return bool(np.any(mask & (u >= 0) & (v >= 0) & (u + v <= 1) & (t > 1e-7) & (t < 1 - 1e-7)))


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
        matrix = np.array([[0, 0, 1, x-(8 if i == 0 else 0)], [1, 0, 0, -100], [0, 1, 0, -32], [0, 0, 0, 1]])
        panels.append(move(meshes[f'winch-cover-{variant}-{name}'], matrix=matrix))
        if i < count - 1:
            matrix = np.array([[1, 0, 0, x], [0, 0, -1, 84], [0, 1, 0, 14], [0, 0, 0, 1]])
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
    bought_hardware, witnesses = [], []
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
                    bought_hardware.append(fastener)
                    for other in panels + shutters + clips + core:
                        clear(fastener, other, (variant, 'shell screw/nut/washer'))
                # Clip/base bolt head/washer clear the stem and the shell skirt.
                for fastener in [cylinder(4.5, 0.8, [cx, sy * 82, 6.4]),
                                 cylinder(3.5, 4, [cx, sy * 82, 8.8])]:
                    bought_hardware.append(fastener)
                    for other in panels + shutters + clips + core:
                        clear(fastener, other, (variant, 'base screw head/washer'))
                # Rear nut/tip envelope for M4x25; include both exposed faces.
                bought_hardware += [cylinder(4.5, 0.8, [cx, sy * 82, -8.4]),
                             cylinder(4.1, 5, [cx, sy * 82, -11.3]),
                             cylinder(2, 6.6, [cx, sy * 82, -17.1])]
                for z, y in [(24, sy * 84.8), (10.8, sy * 82), (-20.4, sy * 82)]:
                    witnesses.append(np.array([cx, y, z]))
    # Original M6 mounting nuts/tips and anchor bought_hardware behind the base.
    for bx, bys in [(-21.5, [-40, 40]), (width + 53.5, [-40, 40]),
                   (face + 20, [-44, 44]), (face + 62, [-44, 44]),
                   (end - 32, [-48]), (end - 12, [-48])]:
        for by in bys:
            bought_hardware.append(cylinder(7, 12, [bx, by, -14.4]))
            witnesses.append(np.array([bx, by, -20.4]))
    fascias, rear = [], []
    for i in range(count):
        x = -46 + i * pitch
        matrix = np.array([[1, 0, 0, x], [0, 0, -1, 98], [0, 1, 0, -32], [0, 0, 0, 1]])
        fascia = move(meshes[f'winch-cover-{variant}-fascia'], matrix=matrix)
        fascias += [fascia, move(fascia, matrix=np.diag([1, -1, 1, 1]))]
    for left, number in [(True, 2 if variant == 'powered' else 1),
                         (False, 3 if variant == 'powered' else 2)]:
        start = -50 if left else width / 2 + 51
        stop = width / 2 - 51 if left else base_length - 50
        length = (stop - start) / number
        for i in range(number):
            rear.append(move(meshes[f'winch-cover-{variant}-rear-{"left" if left else "right"}'],
                             [start + i * length, -93.2, -27.6]))
    blank = move(meshes['winch-cover-rear-blank'], [width / 2 - 50.5, -93.2, -27.6])
    concealment = fascias + rear + [blank]
    for pi, part in enumerate(concealment):
        for oi, other in enumerate(fixed + core + bought_hardware + panels + shutters + [line]):
            clear(part, other, (variant, 'concealment / installed geometry', pi, oi))
    for i, part in enumerate(concealment):
        for other in concealment[i + 1:]:
            clear(part, other, (variant, 'concealment seams'))
    # Moving the original vents upward preserves all five 10x5 mm passages.
    for cx in range(20, 101, 20):
        # 0.01 mm inset avoids treating STL coordinate rounding at a coincident
        # hole wall as a clearance failure; it is not a fit allowance.
        vent = box([9.98, 27.98, 4.98], [face + cx + 5, -90, 60.5])
        for part in panels + fascias:
            clear(vent, part, (variant, 'unobstructed motor vent'))
    # Post replaces the bench blank, never receives load through a printed cover.
    post = box([100, 300, 100], [width / 2, 0, -83])  # Front Z=-33: 25 mm metal standoffs.
    standoffs = [cylinder(8, 25, [bx, by, -20.5])
                for bx in [width / 2 - 25, width / 2 + 25] for by in [-60, 60]]
    for part in fascias + rear + panels + shutters:
        for other in [post] + standoffs:
            clear(part, other, (variant, '100 mm post / 25 mm steel standoffs'))
    skin = trimesh.util.concatenate(panels + shutters + concealment)
    legacy_skin = trimesh.util.concatenate(panels + shutters)
    post_skin = trimesh.util.concatenate(panels + shutters + fascias + rear + [post])
    visibility_checks, old_exposed = 0, 0
    # Four off-centre points supplement each axial centre witness. These are
    # conservative nominal metal envelopes, not an exhaustive optical proof.
    witnesses = [point + np.asarray(delta) for point in witnesses
                 for delta in ([[0, 0, 0], [-4, -4, 0], [-4, 4, 0], [4, -4, 0], [4, 4, 0]]
                               if point[2] < 0 else
                               [[0, 0, 0], [-2, 0, -2], [-2, 0, 2], [2, 0, -2], [2, 0, 2]])]
    for target in witnesses:
        # Direct side, rear and end views, with +/-15 degree oblique approaches.
        for direction in [[0, 1, 0], [0, -1, 0], [0, 0, -1], [-1, 0, 0], [1, 0, 0],
                          [0.25, 1, 0], [-0.25, 1, 0], [0.25, -1, 0], [-0.25, -1, 0],
                          [0, 0.25, -1], [0, -0.25, -1], [0, 0, 1],
                          [0.25, 0, 1], [-0.25, 0, 1]]:
            origin = target + np.asarray(direction) * 2000
            visibility_checks += 1
            assert blocked(skin, origin, target), (variant, 'exposed metal witness', target, direction)
            assert blocked(post_skin, origin, target), (variant, 'exposed metal on post', target, direction)
            old_exposed += not blocked(legacy_skin, origin, target)
    assert old_exposed > 0, 'Control without fascia/rear shields must expose bought_hardware'
    checks += 2 * visibility_checks
    # Positive key capture: pulling straight sideways MUST collide with lugs.
    # Lift fascia and shields together 2 mm, then pull fascia sideways to release.
    for i, fascia in enumerate(fascias):
        sy = 1 if i % 2 == 0 else -1
        captured = sum(overlap(move(fascia, [0, sy * 2, 0]), clip) for clip in clips)
        assert captured > 0.001, (variant, 'missing key capture', i, captured)
        checks += 1
        for dz in [0, 0.5, 1, 1.5, 2]:
            for other in fixed + core + bought_hardware + panels + shutters:
                clear(move(fascia, [0, 0, dz]), other, (variant, 'fascia unlock lift', i, dz))
        for dy in range(0, 41, 2):
            for other in fixed + core + bought_hardware + panels + shutters + [move(p, [0, 0, 2]) for p in rear + [blank]]:
                clear(move(fascia, [0, sy * dy, 2]), other, (variant, 'unlocked fascia withdrawal', i, dy))
    for part in rear + [blank]:
        for dz in [0, 0.5, 1, 1.5, 2]:
            for other in fixed + core + bought_hardware + panels + shutters:
                clear(move(part, [0, 0, dz]), other, (variant, 'rear shield unlock lift', dz))
    # Rear shields lift away after fascia removal; no original bought_hardware changes.
    for part in rear + [blank]:
        for dz in range(0, 41, 2):
            for other in fixed + core + panels + shutters:
                clear(move(part, [0, 0, -dz]), other, (variant, 'rear shield removal', dz))
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
                           [0, 1, 0, -32], [0, 0, 0, 1]])
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
                        'line_corridor_mm': [[6, 50, 124], [6 + width, 115, 140]],
                        'fascia_strips': len(fascias), 'rear_shields': len(rear),
                        'bench_blanks': 1, 'concealment_rays': visibility_checks,
                        'post_concealment_rays': visibility_checks, 'post_standoff_mm': 25,
                        'control_exposed_rays_without_concealment': int(old_exposed),
                        'key_unlock_lift_mm': 2, 'straight_pull_control': 'Captured by key lugs',
                        'physical_retention': 'Unverified fit, vibration, creep and service life; rigid CAD paths are nominal only.'}
    if variant == 'powered':
        results[variant]['transition_wall'] = transition_wall
    print(variant, results[variant], flush=True)

record = {'cover_revision': '0.2.0', 'status': 'concept-unvalidated',
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
