"""Check the 23HS40 supplier-drawing reference using independent mesh sections.

Usage: python scripts/check-nema23-motor-mesh.py MOTOR_STL [--stand STAND_STL]
Checks nominal CAD only. Does not establish received-hardware fit or safety.
"""
import argparse
import numpy as np
import trimesh

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('motor')
parser.add_argument('--stand')
args = parser.parse_args()
motor = trimesh.load_mesh(args.motor)
assert motor.is_watertight and motor.is_winding_consistent and motor.body_count == 1
assert motor.volume > 0
np.testing.assert_allclose(motor.bounds, [[-28.65, -41.65, -22], [28.65, 28.65, 122]], atol=1e-4)


def loops_at(z):
    section = motor.section(plane_origin=[0, 0, z], plane_normal=[0, 0, 1])
    assert section is not None, z
    return [entity.discrete(section.vertices)[:, :2] for entity in section.entities]


for z in [0.1, 4, 7.9, 7.99]:
    loops = loops_at(z)
    assert len(loops) == 5, ('four through-holes and outside flange contour', z)
    holes = [loop for loop in loops if np.max(np.ptp(loop, axis=0)) < 6]
    assert len(holes) == 4
    centers = []
    for loop in holes:
        bounds = np.array([loop.min(axis=0), loop.max(axis=0)])
        center = bounds.mean(axis=0)
        np.testing.assert_allclose(bounds[1]-bounds[0], [5.1, 5.1], atol=1e-4)
        np.testing.assert_allclose(np.abs(center), [23.57, 23.57], atol=1e-4)
        np.testing.assert_allclose(np.linalg.norm(loop-center, axis=1), 2.55, atol=0.002)
        centers.append(tuple(np.round(center, 4)))
    assert len(set(centers)) == 4

for z, expected in [(-0.8, [38.1, 38.1]), (-18, [8, 7.5]),
                    (-7.1, [8, 7.5]), (-6.9, [8, 8])]:
    loops = loops_at(z)
    assert len(loops) == 1, z
    np.testing.assert_allclose(np.ptp(loops[0], axis=0), expected, atol=1e-4)
assert motor.section(plane_origin=[0, 0, -22.1], plane_normal=[0, 0, 1]) is None

if args.stand:
    stand = trimesh.load_mesh(args.stand)
    for adjustment in [-2, 0, 2]:
        placed = motor.copy()
        placed.apply_transform(trimesh.transformations.rotation_matrix(np.pi/2, [0, 1, 0]))
        placed.apply_translation([0, 0, 80+adjustment])
        overlap = trimesh.boolean.intersection([stand, placed], engine='manifold')
        assert overlap.is_empty or abs(overlap.volume) < 0.001, ('motor/stand interference', adjustment)

print('PASS: 57.3 mm frame, 122 mm body, rear outlet, four Ø5.1/47.14 mm holes, Ø38.1 pilot, Ø8 × 22 mm shaft and 15 mm/7.5 mm D-flat.')
if args.stand:
    print('PASS: no nominal motor/stand interference at -2, 0 and +2 mm adjustment.')
