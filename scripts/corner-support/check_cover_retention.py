"""Independent nominal checks for the printed head's dedicated cover screws.

Coordinates and standard-hardware envelopes here are deliberately derived from
the documented assembly interfaces rather than queried from the SCAD helpers.
These checks establish source geometry, not printed fit or retention strength.
"""
import math

import numpy as np
import trimesh


def _box(center, size):
    mesh = trimesh.creation.box(extents=size)
    mesh.apply_translation(center)
    return mesh


def _y_cylinder(diameter, length, center, sections=96):
    mesh = trimesh.creation.cylinder(radius=diameter/2, height=length, sections=sections)
    mesh.apply_transform(trimesh.transformations.rotation_matrix(math.pi/2, [1, 0, 0]))
    mesh.apply_translation(center)
    return mesh


def _nut(center, across_flats=5.5, thickness=2.4):
    # A 30-degree planar rotation gives the hexagon flat X faces. Its axis is Y.
    mesh = trimesh.creation.cylinder(radius=across_flats/math.sqrt(3), height=thickness, sections=6)
    mesh.apply_transform(trimesh.transformations.rotation_matrix(math.pi/6, [0, 0, 1]))
    mesh.apply_transform(trimesh.transformations.rotation_matrix(math.pi/2, [1, 0, 0]))
    mesh.apply_translation(center)
    return mesh


def verify(meshes, refs, size, overlap, clear):
    """Return a report, raising when any independently defined interface fails.

    ``meshes`` uses the registered fabrication IDs. ``refs`` includes separate
    front_cover_hardware and rear_cover_hardware meshes. ``clear`` is the owning
    builder's counted pairwise-interference assertion; ``overlap`` returns mm3.
    """
    assert 'straps' not in refs, 'Tie reference remains in the installed scene'
    checks = 1
    front, rear = size/2+32, -size/2-16
    fixed = {name: mesh for name, mesh in meshes.items() if not name.endswith(('template', 'rear-pad'))}
    rear_pad = meshes['corner-head-printed-rear-pad']
    for row in [45, 155]:
        pad = rear_pad.copy()
        pad.apply_translation([0, 0, row])
        fixed[f'rear-pad-{row}'] = pad
    fixed.update({name: mesh for name, mesh in refs.items()
                  if name not in ['front_cover_hardware', 'rear_cover_hardware']})

    def clear_near(a, b, label):
        # Disjoint bounds prove zero intersection without a costly mesh boolean.
        if np.any(a.bounds[1] <= b.bounds[0]+1e-7) or np.any(b.bounds[1] <= a.bounds[0]+1e-7):
            return
        clear(a, b, label)

    fixed_nuts = {}
    for which, x, rows, nut_y in [('front', front+10, [20, 170], 56),
                                 ('rear', rear-8, [45, 155], 40)]:
        for row in rows:
            for side in [-1, 1]:
                center = [x, side*nut_y, row]
                fixed_nuts[f'{which}/{row}/{side}'] = trimesh.boolean.difference(
                    [_nut(center), _y_cylinder(3.2, 2.42, center)], engine='manifold')

    axes = []
    results = []
    filled_bore_rejected = False
    for which, x, rows, outer, nut_y in [('front', front+10, [20, 170], 65, 56),
                                        ('rear', rear-8, [45, 155], 49, 40)]:
        cover = meshes[f'corner-head-printed-{which}-cover']
        hardware = refs[f'{which}_cover_hardware']
        for row in rows:
            for side in [-1, 1]:
                name = f'{which}/Z{row}/Y{side:+d}'
                anchor = (meshes['corner-head-printed-left' if side < 0 else 'corner-head-printed-right']
                          if which == 'front' else fixed[f'rear-pad-{row}'])
                underhead, tip = outer+.5, outer+.5-12
                nut_inner = nut_y-1.2
                projection = nut_inner-tip
                assert math.isclose(projection, 1.3, abs_tol=1e-10)
                assert projection >= 2*.5, (name, 'less than two M3 threads beyond plain nut')
                assert tip < nut_inner < nut_y+1.2 < underhead
                checks += 3

                # A 3.2 mm gauge must pass the actual 3.4 mm bore through both
                # independent parts, not merely miss a disconnected boss.
                bore = _y_cylinder(3.2, outer+1-(nut_y-3), [x, side*((outer+1+nut_y-3)/2), row])
                clear(bore, anchor, name+'/open anchor bore')
                clear(bore, cover, name+'/open shell bore')
                land = _box([x+3.5, side*(outer-6), row], [1, 1, 1])
                retained = overlap(land, anchor)
                assert retained >= .99, (name, 'missing screw land', retained)
                checks += 1

                # The fixed nut fits its pocket and loads vertically with the
                # shell removed. Sampling includes both hex-to-slot transition
                # and a completely withdrawn nut above the 16 mm-high boss.
                for travel in [0, .5, 1, 2, 4, 8, 12]:
                    clear_near(_nut([x, side*nut_y, row+travel]), anchor,
                          name+f'/nut top insertion {travel}')

                # Inspect the written bought reference as well as the empty
                # bores. These small probes distinguish screws, washers and
                # nuts even when their STL bodies share nominal contact faces.
                material = {}
                for label, center, dims in [
                    ('shank', [x, side*(underhead-6), row], [.5, .5, .5]),
                    ('tip', [x, side*(tip+.35), row], [.5, .5, .5]),
                    ('head', [x, side*(underhead+1.5), row], [.5, .5, .5]),
                    ('washer', [x+3, side*(outer+.25), row], [.25, .25, .25]),
                    ('nut', [x+2.2, side*nut_y, row], [.25, .25, .25])]:
                    probe = _box(center, dims)
                    fraction = overlap(probe, hardware)/probe.volume
                    assert fraction >= .98, (name, label, 'missing bought hardware', fraction)
                    checks += 1
                    material[label] = round(fraction, 6)
                clear(_box([x, side*(tip-.35), row], [.5, .5, .5]), hardware,
                      name+'/no overlong screw tip')

                # A conservative 6 mm driver envelope approaches along the
                # actual Y screw axis. M12 and M8 structural joints stay fitted.
                driver = _y_cylinder(6, 30, [x, side*(underhead+3+15), row])
                for other, mesh in fixed.items():
                    clear_near(driver, mesh, name+'/driver/'+other)

                # Remove the screw and washer outwards while retaining every
                # structural part, both covers and all plain nuts in place.
                # A solid washer envelope is conservative after outward travel.
                for travel in [.5, 1, 3, 6, 12, 16]:
                    components = [
                        _y_cylinder(3, 12, [x, side*(underhead-6+travel), row]),
                        _y_cylinder(5.5, 3, [x, side*(underhead+1.5+travel), row]),
                        _y_cylinder(7, .5, [x, side*(outer+.25+travel), row])]
                    for other, mesh in {**fixed, **fixed_nuts}.items():
                        for part in components:
                            clear_near(part, mesh, name+f'/screw extraction {travel}/'+other)

                # Reinstating a solid wall across a shell hole must fail the
                # same bore gauge, preventing an empty-space-only regression.
                old_shell = _box([x, side*(outer-2), row], [8, 4, 8])
                filled_bore_volume = overlap(bore, old_shell)
                assert filled_bore_volume > 20, (name, 'filled-bore negative control did not fail')
                checks += 1
                filled_bore_rejected = True
                axes.append([x, side*outer, row])
                results.append(dict(cover=which, side=side, Z_mm=row, X_mm=x,
                    screw_axis='Y', screw_length_mm=12, washer_thickness_mm=.5,
                    nut_across_flats_mm=5.5, nut_thickness_mm=2.4,
                    nut_center_Y_mm=side*nut_y, underhead_Y_mm=side*underhead,
                    screw_tip_Y_mm=side*tip, nut_projection_mm=round(projection, 3),
                    anchor_land_probe_mm3=round(retained, 6), hardware_probes=material))

        # Former tie slots through both cover sidewalls are now closed material;
        # the dedicated screw holes are at different X/Z coordinates.
        for side in [-1, 1]:
            for z in [21.5, 171.5]:
                center = [front+30, side*63, z] if which == 'front' else [rear-10.5, side*47, z]
                retained = overlap(_box(center, [1, 1, 1]), cover)
                assert retained >= .99, (which, side, z, 'old tie slot remains', retained)
                checks += 1

    assert len(axes) == 8 and len({tuple(axis) for axis in axes}) == 8
    checks += 1
    return dict(checks=checks, screw_count=8, washer_count=8, plain_nut_count=8,
                screw_axes_mm=axes, interfaces=results,
                nut_insertion_direction='+Z with cover removed',
                screw_extraction_direction='outward Y; remove all four before each cover service',
                driver_envelope_diameter_mm=6, driver_envelope_length_mm=30,
                old_tie_slots_closed=True, filled_bore_negative_control_rejected=filled_bore_rejected,
                limitation='Nominal source geometry only; physical fit, clamp retention and outdoor life remain unverified.')
