"""Independent nominal regressions for concealed printed cover retention.

The dimensions below are derived from the documented interfaces, independently
of SCAD functions. Rigid released-latch and tool envelopes establish nominal
access only; they do not model printed flexibility, force or retention life.
"""
import math

import numpy as np
import trimesh


def _box(center, size):
    mesh = trimesh.creation.box(extents=size)
    mesh.apply_translation(center)
    return mesh


def _moved(mesh, xyz):
    result = mesh.copy()
    result.apply_translation(xyz)
    return result


def _pivot(mesh, angle, axis, center):
    result = mesh.copy()
    result.apply_transform(trimesh.transformations.rotation_matrix(angle, axis, center))
    return result


def verify(meshes, refs, size, overlap, clear, released):
    """Check actual normal/released meshes and return portable pack evidence."""
    checks = 0

    def require(condition, label):
        nonlocal checks
        checks += 1
        assert condition, label

    def clear_near(a, b, label):
        if np.any(a.bounds[1] <= b.bounds[0]+1e-7) or np.any(b.bounds[1] <= a.bounds[0]+1e-7):
            return
        clear(a, b, label)

    def material(mesh, center, label, dimensions=(1, 1, 1)):
        probe = _box(center, dimensions)
        fraction = overlap(mesh, probe)/probe.volume
        require(fraction >= .99, (label, 'missing material', fraction))
        return round(fraction, 6)

    require(set(refs) == {'post', 'hardware', 'cross_hardware', 'block', 'line'},
            'Cover metal or tie reference remains in the installed scene')
    require(set(released) == {'front', 'rear'}, 'Missing released-latch control mesh')
    front, rear = size/2+32, -size/2-16
    # The selected M12 length is post size + 70 for every supported size.
    back = front+3-(size+70)-3
    covers = {which: meshes[f'corner-head-printed-{which}-cover'] for which in ['front', 'rear']}
    fixed = {name: mesh for name, mesh in meshes.items()
             if not name.endswith(('template', 'rear-pad', 'front-cover', 'rear-cover'))}
    for row in [45, 155]:
        fixed[f'rear-pad-{row}'] = _moved(meshes['corner-head-printed-rear-pad'], [0, 0, row])
    fixed.update(refs)
    followers = []
    for which, x, rows, root_y, neck_y, head_y in [
        ('front', front+4, [20, 170], 45, 56, 59.1),
        ('rear', rear-8, [45, 155], 36, 40, 43.1)]:
        cover = covers[which]
        for row in rows:
            for side in [-1, 1]:
                label = f'{which}/Z{row}/Y{side:+d}'
                anchor = (meshes['corner-head-printed-left' if side < 0 else 'corner-head-printed-right']
                          if which == 'front' else fixed[f'rear-pad-{row}'])
                head_center = [x+5.5, side*head_y, row] if which == 'front' else [x, side*head_y, row+5.5]
                lands = dict(root=material(anchor, [x, side*root_y, row], label+'/root'),
                             neck=material(anchor, [x, side*neck_y, row], label+'/neck'),
                             head=material(anchor, head_center, label+'/T head'))
                clear_near(anchor, cover, label+'/installed follower')
                # Each head must be mechanically captured by the narrower
                # printed throat, independently of the latch's travel stop.
                capture = overlap(_box(head_center, [1, 1, 1]), _moved(cover, [0, side*2, 0]))
                require(capture >= .99, (label, 'T head escapes outward Y', capture))
                followers.append(dict(cover=which, side=side, X_mm=x, Z_mm=row,
                    material_fractions=lands, outward_pull_collision_mm3=round(capture, 6)))

        # Former tie slots and all former M3 cover bores are solid skin now.
        for side in [-1, 1]:
            for row in rows:
                point = [front+10 if which == 'front' else x, side*(63 if which == 'front' else 47), row]
                material(cover, point, which+'/closed former M3 bore')
                material(released[which], point, which+'/released shell remains fixed')
            for z in [21.5, 171.5]:
                point = [front+30, side*63, z] if which == 'front' else [rear-10.5, side*47, z]
                material(cover, point, which+'/closed former tie slot')
        require(np.allclose(cover.bounds[:, 1], [-65, 65] if which == 'front' else [-49, 49], atol=.002),
                which+'/external head or nut protrusion')

    # Continuous female channels must retain their walls between followers.
    guide_samples = []
    for side in [-1, 1]:
        for z in [20, 50, 100, 150, 178]:
            wall = material(covers['front'], [front+12, side*56, z], 'front/continuous guide wall')
            for point in [[front+4, side*56, z], [front+10, side*59, z]]:
                clear_near(_box(point, [1, 1, 1]), covers['front'], 'front/open guide cross-section')
            guide_samples.append(dict(cover='front', side=side, station_mm=z, wall_fraction=wall))
        for row in [45, 155]:
            for x in [rear-10, rear-3]:
                wall = material(covers['rear'], [x, side*40, row+8], 'rear/continuous guide wall')
                for point in [[x, side*40, row], [x, side*43, row+6]]:
                    clear_near(_box(point, [1, 1, 1]), covers['rear'], 'rear/open guide cross-section')
                guide_samples.append(dict(cover='rear', side=side, station_mm=x, Z_mm=row, wall_fraction=wall))
    require(len(followers) == 8, 'Expected four T followers per cover')

    front_angle, rear_angle = math.atan(1.5/36), -math.atan(1.5/26)
    front_hook = _box([front+28, 0, 76], [.25, .25, .25])
    rear_hook = _box([back+2.5, 9, 67], [.25, .25, .25])
    latch_results = {}
    for which, hook, angle, axis, pivot, first, hold in [
        ('front', front_hook, front_angle, [0, 1, 0], [front+30.25, 0, 40.5], [0, 0, -1], 8),
        ('rear', rear_hook, rear_angle, [1, 0, 0], [back+4, 10.75, 40.5], [-1, 0, 0], 6)]:
        normal = covers[which]
        catch_land = (material(fixed['corner-head-printed-left'], [front+28, -3, 73.5], 'front/fixed catch')
                      if which == 'front' else material(fixed['rear-pad-45'], [back+1.1, 8.5, 67],
                                                       'rear/fixed catch', [.5, .5, .5]))
        require(overlap(hook, normal)/hook.volume >= .99, which+'/missing positive latch hook')
        require(overlap(_pivot(hook, angle, axis, pivot), released[which])/hook.volume >= .99,
                which+'/released hook does not follow independent pivot')
        clear_near(hook, released[which], which+'/hook actually released')
        blocked = sum(overlap(_moved(normal, first), part) for part in fixed.values())
        require(blocked > .5, (which, 'engaged latch permits first removal motion', blocked))
        for travel in [.5, 1, 2, 4, hold]:
            vector = [0, 0, -travel] if which == 'front' else [-travel, 0, 0]
            for name, part in fixed.items():
                clear_near(_moved(released[which], vector), part, which+f'/released first travel {travel}/'+name)
            clear_near(_moved(released[which], vector), covers['rear' if which == 'front' else 'front'],
                       which+f'/released first travel {travel}/other cover')
        # Once the hook passes its catch, it may return to its ordinary shape.
        ordinary = [8, 10, 20, 40, 80, 100, 150, 180, 190] if which == 'front' else [6, 8, 10, 20, 40, 80]
        for travel in ordinary:
            vector = [0, 0, -travel] if which == 'front' else [-travel, 0, 0]
            for name, part in fixed.items():
                clear_near(_moved(normal, vector), part, which+f'/unlatched remaining travel {travel}/'+name)
        latch_results[which] = dict(engaged_first_motion_collision_mm3=round(blocked, 6),
            fixed_catch_material_fraction=catch_land,
            released_first_motion_clear=True, hold_released_travel_mm=hold,
            released_rotation_deg=round(math.degrees(angle), 6), release_pivot_mm=pivot)

    # Underside blades approach with both covers and structural joints fitted.
    # Exclude only the deliberate flexible beam/hook from the rigid-skin check;
    # fixed catches, roots and all other cover material remain collision targets.
    flexible = {
        'front': _box([front+29.5, 0, 60.5], [7, 10.2, 40]),
        'rear': _box([back+4, 9.75, 55.25], [4.4, 4.5, 29.5])}
    blades = {'front': _box([front+29, 0, 37], [.6, 2, 74]),
              'rear': _box([back+4, 9.5, 37], [2, .6, 54])}
    for which, angle, axis, pivot in [('front', math.radians(2.8), [0, 1, 0], [front+29, 0, 41]),
                                     ('rear', math.radians(-4), [1, 0, 0], [back+4, 10.75, 41])]:
        rigid_skin = trimesh.boolean.difference([covers[which], flexible[which]], engine='manifold')
        targets = {**fixed, 'rigid_skin': rigid_skin, 'other_cover': covers['rear' if which == 'front' else 'front']}
        for travel in [-80, -40, -10, 0]:
            tool = _moved(blades[which], [0, 0, travel])
            for name, part in targets.items():
                clear_near(tool, part, which+f'/blade insertion {travel}/'+name)
        for fraction in [0, .25, .5, .75, 1]:
            tool = _pivot(blades[which], angle*fraction, axis, pivot)
            for name, part in targets.items():
                clear_near(tool, part, which+f'/blade release {fraction}/'+name)
        actuation_contact = overlap(tool, covers[which])
        require(actuation_contact > .1, (which, 'underside blade never reaches latch beam', actuation_contact))
        released_contact = overlap(tool, released[which])
        require(released_contact > .01, (which, 'underside blade does not reach released beam', released_contact))
        latch_results[which]['underside_blade_envelope_mm'] = [.6, 2, 74] if which == 'front' else [2, .6, 54]
        latch_results[which]['underside_tool_path_clear'] = True
        latch_results[which]['blade_actuation_contact_mm3'] = round(actuation_contact, 6)
        latch_results[which]['blade_released_contact_mm3'] = round(released_contact, 6)
        latch_results[which]['blade_rotation_deg'] = round(math.degrees(angle), 6)

    return dict(checks=checks, design='concealed printed T guides and positive latches',
        follower_count=8, front_follower_count=4, rear_follower_count=4,
        cover_screw_count=0, cover_washer_count=0, cover_nut_count=0, cover_tie_count=0,
        exterior_skins_closed=True, former_M3_holes_closed=True, former_tie_slots_closed=True,
        followers=followers, continuous_guide_samples=guide_samples, latches=latch_results,
        hidden_underside_release=True,
        limitation='Rigid nominal envelopes only; printed flexure force, fit, fatigue, creep and retention remain unverified.')
