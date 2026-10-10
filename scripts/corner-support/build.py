"""Build the nominal corner head, mesh checks, actual-mesh PDF and source pack.

Requires the existing winch-booklet Python requirements and OpenSCAD 2021.01.
Outputs are ignored working artifacts; no structural or received-part approval.
"""
import argparse
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile

import numpy as np
import trimesh
from scipy.spatial import cKDTree
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph, Table, TableStyle
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[2]
LIB = ROOT / 'hardware/lib/corner-head-printed.scad'
IDS = ['corner-head-printed-left', 'corner-head-printed-right', 'corner-head-printed-rear-pad',
       'corner-head-printed-front-cover', 'corner-head-printed-rear-cover', 'corner-head-printed-template']
PRINT_MODULES = dict(zip(IDS, ['pch_print_left', 'pch_print_right', 'pch_print_rear_pad',
                             'pch_print_front_cover', 'pch_print_rear_cover', 'pch_print_template']))
VARIANTS = [('round',100,1.5), ('round',120,1.5), ('round',140,1.5),
            ('round',120,4.5), ('square',100,1.5)]
BED_MM = 256
BED_RESERVE_MM = 5
ARTIFACT = 'ARBI-corner-support'
PDF = ARTIFACT+'-assembly-STL.pdf'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def export(source, target, defines=()):
    target.parent.mkdir(parents=True, exist_ok=True)
    command = ['openscad', '-o', str(target)]
    for define in defines:
        command += ['-D', define]
    run = subprocess.run(command + [str(source)], capture_output=True, text=True, timeout=120)
    log = run.stdout + run.stderr
    if run.returncode or 'ERROR:' in log or 'WARNING:' in log or not target.exists() or not target.stat().st_size:
        raise ValueError(f'Export failed: {source}\n{log}')
    mesh = trimesh.load_mesh(target)
    if not (mesh.is_watertight and mesh.is_winding_consistent and mesh.volume > 0):
        raise ValueError(f'Invalid mesh: {target}')
    return mesh


def overlap(a, b):
    intersection = trimesh.boolean.intersection([a, b], engine='manifold')
    if intersection.is_empty:
        return 0
    triangles = intersection.triangles
    return abs(np.einsum('ij,ij->i',triangles[:,0],np.cross(triangles[:,1],triangles[:,2])).sum()/6)


def same_vertices(a, b):
    """Compare the written surfaces despite STL facet ordering and float rounding."""
    return (cKDTree(a.vertices).query(b.vertices)[0].max()<.002
            and cKDTree(b.vertices).query(a.vertices)[0].max()<.002)


def translated(mesh, xyz):
    result = mesh.copy()
    result.apply_translation(xyz)
    return result


def cylinder(diameter, length, center):
    mesh = trimesh.creation.cylinder(radius=diameter/2, height=length, sections=96)
    mesh.apply_transform(trimesh.transformations.rotation_matrix(math.pi/2, [0, 1, 0]))
    mesh.apply_translation(center)
    return mesh


def y_cylinder(diameter, length, center):
    mesh = trimesh.creation.cylinder(radius=diameter/2, height=length, sections=96)
    mesh.apply_transform(trimesh.transformations.rotation_matrix(math.pi/2, [1, 0, 0]))
    mesh.apply_translation(center)
    return mesh


def pose(x=0, y=0, z=0):
    matrix = np.eye(4)
    matrix[:3,3] = [x,y,z]
    return matrix


def print_pose(mid, size, line):
    """Independent rigid transforms matching the documented SCAD print poses."""
    radius = size/2
    front, rear = radius+32,-radius-16
    tip = front+3-math.ceil((size+70)/10)*10
    rotation = trimesh.transformations.rotation_matrix
    if mid.endswith('left'):
        return pose(y=205,z=40)@rotation(math.pi/2,[1,0,0])
    if mid.endswith('right'):
        return pose(z=40)@rotation(-math.pi/2,[1,0,0])
    if mid.endswith('rear-pad'):
        return pose(25,40,-rear)@rotation(-math.pi/2,[0,1,0])
    if mid.endswith('front-cover'):
        return pose(0,65,front+36)@rotation(math.pi/2,[0,1,0])
    if mid.endswith('rear-cover'):
        return pose(190,49,-tip+7)@rotation(-math.pi/2,[0,1,0])
    return np.eye(4)


def instances(meshes):
    result = {mid: mesh for mid,mesh in meshes.items() if not mid.endswith(('rear-pad','template'))}
    for z in [45,155]:
        result[f'corner-head-printed-rear-pad-{z}'] = translated(meshes['corner-head-printed-rear-pad'],[0,0,z])
    return result


def loads(span_tension, down_tension, elevation_deg, azimuth_deg, height_m, guy_radius_m, guy_height_m, offset_m):
    """Statics only: x toward span, y across span, z up; guy points toward -x.

    Resolve a unilateral guy's x component. Retain transverse force, compression,
    bracket eccentricity and residual ground moment instead of declaring balance.
    """
    if min(height_m, guy_radius_m, guy_height_m) <= 0 or min(span_tension, down_tension, offset_m) < 0:
        raise ValueError('Positive geometry and nonnegative tension/offset required.')
    if not -90 <= elevation_deg <= 90 or not -180 <= azimuth_deg <= 180:
        raise ValueError('Invalid line direction.')
    e, a = math.radians(elevation_deg), math.radians(azimuth_deg)
    force = np.array([span_tension*math.cos(e)*math.cos(a), span_tension*math.cos(e)*math.sin(a),
                      span_tension*math.sin(e)-down_tension])
    length = math.hypot(guy_height_m, guy_radius_m)
    guy_tension = max(0, force[0])*length/guy_radius_m
    guy_force = guy_tension*np.array([-guy_radius_m/length, 0, -guy_height_m/length])
    moment = np.cross([offset_m, 0, height_m], force) + np.cross([0, 0, guy_height_m], guy_force)
    return dict(pulley_force_N=force.tolist(), pulley_resultant_N=float(np.linalg.norm(force)),
                guy_tension_N=float(guy_tension), post_force_N=(force+guy_force).tolist(),
                residual_ground_moment_Nm=moment.tolist())


def verify_load_reference():
    straight = loads(10, 10, 0, 0, 3, 3, 3, .2)
    assert abs(straight['pulley_resultant_N']-math.sqrt(2)*10) < 1e-10
    assert abs(straight['guy_tension_N']-math.sqrt(2)*10) < 1e-10
    assert np.allclose(straight['post_force_N'], [0, 0, -20])
    assert np.allclose(straight['residual_ground_moment_Nm'], [0, 2, 0])
    skew = loads(10, 10, 0, 45, 3, 3, 3, .2)
    assert skew['post_force_N'][1] > 7 and abs(skew['residual_ground_moment_Nm'][0]) > 21
    outward = loads(10, 10, 0, 180, 3, 3, 3, .2)
    assert outward['guy_tension_N'] == 0 and outward['post_force_N'][0] < 0
    return dict(equal_tension_10N=straight, skew_45deg_10N=skew,
                meaning='Synthetic statics references, not configured limits, proof loads or capacity.')


def verify_block_equilibrium():
    # Equal horizontal and descending tensions give [T,0,-T]. A freely
    # pivoting Y pin aligns the pin-to-sheave vector with that resultant.
    r = np.array([40/math.sqrt(2),0,-40/math.sqrt(2)])
    force = np.array([10,0,-10])
    assert np.allclose(np.cross(r,force),[0,0,0],atol=1e-10)
    wrong = np.cross([0,0,-40],force)
    assert np.allclose(wrong,[0,-400,0])
    return dict(pin_to_sheave_length_mm=40, rotation_about_Y_deg=-45,
                pin_to_sheave_mm=r.tolist(), equal_tension_10N_moment_Nmm=np.cross(r,force).tolist(),
                rejected_vertical_10N_moment_Nmm=wrong.tolist(),
                meaning='Provisional frictionless 90-degree equal-leg-tension equilibrium; articulation and supplier geometry unqualified.')


def build(out):
    version = subprocess.run(['openscad', '--version'], capture_output=True, text=True, timeout=10, check=True)
    if (version.stdout+version.stderr).strip() != 'OpenSCAD version 2021.01':
        raise ValueError('OpenSCAD 2021.01 required.')
    out.mkdir(parents=True, exist_ok=True)
    # The optional indoor fixture shares this head's mounting interfaces.
    # Keep its independent nominal checks in the owning corner CI build.
    subprocess.run([sys.executable, str(ROOT/'scripts/corner-support/check-stand-adapter.py'),
                    '--record', str(out/'stand-adapter-check.json')], check=True)
    # Build in an empty directory, then copy a complete fresh snapshot. Stale
    # meshes in an existing output directory cannot enter the archive.
    registry = json.loads((ROOT/'hardware/models.json').read_text())
    models = {m['id']: m for m in registry['models']}
    report = dict(revision='0.1.0', status='concept-unvalidated', configuration='Printed round 120 / passive line; concept-unvalidated',
                  fabrication_ids=IDS, printed_model_ids=IDS, openscad='2021.01', checks=0, tangent_tolerance_mm=.001,
                  printer_envelope_mm=[BED_MM]*3, bed_edge_reserve_mm=BED_RESERVE_MM,
                  variants={}, statics=verify_load_reference(), block_equilibrium=verify_block_equilibrium())
    def clear(a, b, label):
        report['checks'] += 1
        if overlap(a, b) > .01:
            raise ValueError('Nominal interference: '+label)

    with tempfile.TemporaryDirectory(prefix='arbi-corner-build-', dir='/tmp') as temporary:
        work = Path(temporary)
        references = work/'models/reference'
        sources = [ROOT/'hardware/models.json', ROOT/'bom/catalog/parts.json', ROOT/'bom/assemblies/assemblies.json',
                   ROOT/'hardware/lib/arbi.scad', LIB, ROOT/'hardware/lib/corner-head.scad',
                   Path(__file__).resolve(), ROOT/'scripts/corner-support/check.py', ROOT/'scripts/corner-support/README.md',
                   ROOT/'hardware/lib/winch-pole.scad', ROOT/'hardware/lib/winch-mount.scad', ROOT/'hardware/lib/winch-drum.scad',
                   ROOT/'hardware/assemblies/winch/round-pole.md', ROOT/'hardware/assemblies/winch/full-cover.md',
                   ROOT/'scripts/winch-booklet/render_figures.py', ROOT/'scripts/winch-booklet/requirements.txt',
                   ROOT/'LICENSE', *sorted((ROOT/'hardware/assemblies/corner-station').glob('corner-head-*.scad')),
                   *sorted((ROOT/'docs/assemblies/corner-station').glob('*.md')),
                   ROOT/'hardware/assemblies/corner-station/README.md',
                   *sorted(p for p in (ROOT/'hardware/vendor').rglob('*') if p.is_file()),
                   *sorted((ROOT/'scripts/winch-booklet/fonts').glob('*'))]
        report['sources_sha256'] = {p.relative_to(ROOT).as_posix(): digest(p) for p in sources}
        for source in sources:
            target = work/'source/repository'/source.relative_to(ROOT)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)
        # Use the existing furniture-style actual-STL renderer without altering it.
        shutil.copy2(ROOT/'scripts/winch-booklet/render_figures.py', work/'source/render_figures.py')
        (work/'source/arbi-hardware').mkdir()
        shutil.copy2(ROOT/'hardware/models.json', work/'source/arbi-hardware/models.json')

        # Read the winch tangent from its canonical SCAD, independently of the
        # corner head's design constants. Compare against the exported line mesh.
        probe = work/'winch-tangent.scad'
        probe.write_text(f'include <{(ROOT/"hardware/lib/winch-pole.scad").as_posix()}>\n'
                         'echo(tangents=[mount_axis_height+wd_effective_diameter(false)/2-pole_front, '
                         'mount_axis_height+wd_effective_diameter(true)/2-pole_front]);\ncube(1);\n')
        probe_output = work/'winch-tangent.csg'
        run = subprocess.run(['openscad','-o',str(probe_output),str(probe)],capture_output=True,text=True,timeout=30,check=True)
        log = run.stdout+run.stderr
        if 'ERROR:' in log or 'WARNING:' in log:
            raise ValueError('Winch tangent probe failed: '+log)
        report['winch_tangents_from_post_mm'] = json.loads(re.search(r'ECHO: tangents = (\[[^\n]+\])',log).group(1))
        probe.unlink()
        probe_output.unlink()

        for shape, size, line in VARIANTS:
            key = f'{shape}-{size}-printed-line-{line}'
            default = (shape,size,line) == ('round',120,1.5)
            directory = work/'models/arbi' if default else work/'variants'/key
            print_directory = work/'models/print' if default else directory/'print'
            defines = [f'post_shape="{shape}"', f'post_size_mm={size}', f'line_diameter_mm={line}']
            meshes = {}
            print_report = {}
            for mid in IDS:
                model = models[mid]
                path = directory/model['output']
                mesh = export(ROOT/model['entrypoint'], path, defines)
                assert mesh.body_count == 1, (key,mid,mesh.body_count)
                meshes[mid] = mesh
                source = work/f'{mid}-print.scad'
                source.write_text(f'include <{LIB.as_posix()}>\n{PRINT_MODULES[mid]}();\n')
                print_path = print_directory/model['output']
                print_mesh = export(source, print_path, defines)
                assert print_mesh.body_count == 1, (key,mid,'print body count')
                matrix = print_pose(mid, size, line)
                transformed = mesh.copy()
                transformed.apply_transform(matrix)
                assert np.allclose(transformed.bounds,print_mesh.bounds,atol=.002), (key,mid,'print pose',transformed.bounds,print_mesh.bounds)
                assert same_vertices(transformed,print_mesh), (key,mid,'print surface vertices')
                assert math.isclose(mesh.volume,print_mesh.volume,rel_tol=.00005), (key,mid,'print volume')
                # SCAD establishes orientation. Normalize XY placement for one
                # part per bed while preserving its geometry and Z=0 contact.
                placement = pose(x=-print_mesh.bounds[0,0],y=-print_mesh.bounds[0,1])
                matrix = placement@matrix
                print_mesh.apply_transform(placement)
                print_mesh.export(print_path)
                print_mesh = trimesh.load_mesh(print_path)
                assert print_mesh.is_watertight and print_mesh.is_winding_consistent and print_mesh.volume>0
                assert np.allclose(matrix[:3,:3].T@matrix[:3,:3],np.eye(3)) and np.linalg.det(matrix[:3,:3])>0
                assert abs(print_mesh.bounds[0,2])<.002, (key,mid,'not on bed')
                assert np.all(print_mesh.bounds[0]>=-.002), (key,mid,'negative print coordinates')
                assert np.all(print_mesh.extents[:2]<=BED_MM-2*BED_RESERVE_MM), (key,mid,'bed reserve')
                assert print_mesh.extents[2]<=BED_MM, (key,mid,'printer height')
                report['checks'] += 6
                print_report[mid] = dict(file=print_path.relative_to(work).as_posix(),
                    installed_to_print=matrix.round(6).tolist(), bounds_mm=print_mesh.bounds.round(3).tolist(),
                    scad_xy_normalization_mm=placement[:3,3].round(6).tolist(),
                    extents_mm=print_mesh.extents.round(3).tolist(), bed_fits=True,
                    usable_footprint_mm=[BED_MM-2*BED_RESERVE_MM]*2,
                    limitation='One-part bounding box only; brim, supports and slicing are not qualified.')
            refs = {}
            for name, call in dict(post='pch_post();', hardware='pch_hardware();', cross_hardware='pch_cross_hardware();',
                                   block='pch_block();', line='pch_line();', straps='pch_straps();').items():
                source = work/f'{name}.scad'
                source.write_text(f'include <{LIB.as_posix()}>\n{call}\n')
                path = (references if default else directory/'references')/(name+'.stl')
                refs[name] = export(source, path, defines)
            installed = instances(meshes)
            assert np.allclose(meshes['corner-head-printed-template'].extents,[205,50,4]), (key,'template')
            pin = size/2+33+(130.3 if line==1.5 else 130.9)+15-line/2-40/math.sqrt(2)
            sheave_z = 165-40/math.sqrt(2)
            old_axis = pin+40/math.sqrt(2)
            vertical_source = work/'block-vertical-control.scad'
            vertical_source.write_text(f'include <{LIB.as_posix()}>\nch_block();\n')
            control_path = (work/'models/controls' if default else directory/'controls')/'block-vertical.stl'
            vertical_mesh = export(vertical_source,control_path,defines)
            expected_block = vertical_mesh.copy()
            expected_block.apply_transform(pose(x=pin,z=165)
                @trimesh.transformations.rotation_matrix(-math.pi/4,[0,1,0])@pose(x=-old_axis,z=-165))
            assert same_vertices(expected_block,refs['block']), (key,'loaded block pose')
            written_line_radius = refs['line'].extents[1]/2
            assert abs(written_line_radius-line/2*math.cos(math.pi/12))<.001, (key,'faceted line radius')
            line_center_Z = refs['line'].bounds[1,2]-written_line_radius-(15-line/2)
            assert abs(line_center_Z-sheave_z)<.001, (key,'line sheave elevation')
            wall_probes = {}
            bore_probes = {}
            for mid,sign in [('corner-head-printed-left',-1),('corner-head-printed-right',1)]:
                for label,center in [('lug',[pin+10,sign*2,159]),('web',[pin+1,sign*30,167])]:
                    probe_mesh = trimesh.creation.box(extents=[1,1,1])
                    probe_mesh.apply_translation(center)
                    retained = overlap(meshes[mid],probe_mesh)
                    assert retained>=.99, (key,mid,label,'lost wall',retained)
                    report['checks'] += 1
                    wall_probes[f'{mid}/{label}'] = round(retained,6)
                    if default and sign==-1:
                        wrong_cut = cylinder(13,2*pin+80,[0,0,155]) if label=='lug' else y_cylinder(8.6,100,[pin,0,165])
                        assert overlap(probe_mesh,wrong_cut)>=.99, (label,'negative cutter control')
                bore_probe = trimesh.creation.box(extents=[1,1,1])
                bore_probe.apply_translation([pin,sign*2,165])
                occupied = overlap(meshes[mid],bore_probe)
                assert occupied<=.01, (key,mid,'closed pulley pin bore',occupied)
                bore_probes[mid] = round(occupied,6)
                report['checks'] += 1
            report['checks'] += 2
            if default:
                unrelieved = trimesh.creation.box(extents=[4,122,180])
                unrelieved.apply_translation([size/2+66,0,90])
                fascia_collision = overlap(meshes['corner-head-printed-left'],unrelieved)
                assert fascia_collision>1, 'Unrelieved fascia regression did not reproduce the collision'
                old_service_collision = overlap(translated(meshes['corner-head-printed-front-cover'],[40,5,0]),
                                                meshes['corner-head-printed-left'])
                assert old_service_collision>.01, 'Rejected front X/Y service control did not collide'
            for mid, mesh in installed.items():
                for name, reference in refs.items():
                    clear(mesh, reference, key+'/'+mid+'/'+name)
            for i,(mid,mesh) in enumerate(installed.items()):
                for other,other_mesh in list(installed.items())[i+1:]:
                    clear(mesh,other_mesh,key+'/'+mid+'/'+other)
            front_cover, rear_cover = meshes['corner-head-printed-front-cover'], meshes['corner-head-printed-rear-cover']
            fixed = {**{k:m for k,m in refs.items() if k!='straps'},
                     **{k:m for k,m in installed.items() if not k.endswith(('front-cover','rear-cover'))}}
            for travel in [1,5,10,20,40,80,100,150,180,190]:
                for name, reference in fixed.items():
                    clear(translated(front_cover,[0,0,-travel]),reference,key+f'/front-cover/down-{travel}/'+name)
                clear(translated(front_cover,[0,0,-travel]),rear_cover,key+f'/front-cover/down-{travel}/rear-cover')
                if travel<=100:
                    for name, reference in fixed.items():
                        clear(translated(front_cover,[0,travel,-190]),reference,key+f'/front-cover/side-{travel}/'+name)
                    clear(translated(front_cover,[0,travel,-190]),rear_cover,key+f'/front-cover/side-{travel}/rear-cover')
                if travel<=80:
                    for name, reference in fixed.items():
                        clear(translated(rear_cover,[-travel,0,0]),reference,key+f'/rear-cover/removal-{travel}/'+name)
                    clear(translated(rear_cover,[-travel,0,0]),front_cover,key+f'/rear-cover/removal-{travel}/front-cover')
            radius = size/2
            for z in [45,155]:
                tool_front = cylinder(28,40,[radius+65,0,z])
                tool_rear = cylinder(30,40,[-radius-57,0,z])
                for mid, mesh in fixed.items():
                    if mid.startswith('corner-head-printed-'):
                        clear(mesh,tool_front,key+'/front socket/'+mid)
                        clear(mesh,tool_rear,key+'/rear socket/'+mid)
            for z in [100,190]:
                for side in [-1,1]:
                    tool = y_cylinder(19,30,[radius+50,side*62,z])
                    for mid,mesh in fixed.items():
                        if mid.startswith('corner-head-printed-'):
                            clear(mesh,tool,key+'/crossbar socket/'+mid)
            length = math.ceil((size+70)/10)*10
            stack = size+66
            projection = length-stack
            assert projection >= 3.5, (key,projection)
            assert abs(100-(80+2*1.6+6.5)-10.3)<1e-8
            offset = pin-size/2
            # The polygonal sphere's X/Y radius is slightly below nominal. Use
            # its written transverse radius; ASCII STL coordinates round at 6
            # significant digits, so compare at 0.001 mm rather than exact zero.
            tangent = refs['line'].bounds[0,0]+refs['line'].extents[1]/2
            winch = size/2+report['winch_tangents_from_post_mm'][0 if line==1.5 else 1]
            error = tangent-winch
            assert abs(error) < report['tangent_tolerance_mm'], (key,error)
            report['variants'][key] = dict(bolt_length_mm=length, tip_projection_mm=round(projection,3),
                terminal_axis_from_post_mm=round(offset,3), tangent_error_mm=round(error,6),
                sheave_center_from_post_mm=round(old_axis-size/2,3), sheave_center_Z_mm=round(sheave_z,6),
                line_center_Z_from_mesh_mm=round(line_center_Z,6), written_line_radius_mm=round(written_line_radius,6),
                crossbar_length_mm=100, crossbar_tip_projection_mm=10.3, print_parts=print_report,
                wall_probes_mm3=wall_probes, pin_bore_probes_mm3=bore_probes,
                meshes={k:dict(bounds_mm=v.bounds.round(3).tolist(), volume_mm3=round(v.volume,3), bodies=v.body_count,
                              watertight=v.is_watertight, winding=v.is_winding_consistent) for k,v in meshes.items()})
            print('Checked '+key,flush=True)
        # Independent controls reject the two errors that motivated this proposal.
        old_tangent = 60+10+125-14.25
        assert abs(old_tangent-(60+33+130.3)) > 40
        assert 160-(120+20+5+4+6+12) < 3.5
        assert 180-(120+66)<3.5
        report['negative_controls'] = dict(legacy_round_120_tangent_error_mm=-42.55,
                                           m12x180_printed_round_120_missing_engagement_mm=9.5,
                                           unrelieved_front_fascia_collision_mm3=round(fascia_collision,3),
                                           rejected_front_X40_Y5_collision_mm3=round(old_service_collision,3),
                                           overlong_M12_cut_removes_lug_probe=True,
                                           overlong_pin_cut_removes_web_probe=True)
        report['service_paths_mm'] = dict(front_cover=[[0,0,-190],[0,100,-190]],rear_cover=[[-80,0,0]])

        spec = importlib.util.spec_from_file_location('corner_renderer',work/'source/render_figures.py')
        renderer = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(renderer)
        def item(file,color,matrix=None):
            owners={'hardware':'corner-head-printed-hardware','cross_hardware':'corner-head-printed-hardware','post':'corner-post-treated-timber',
                    'block':'top-positioning-line-pulley','line':'dyneema-positioning-line','straps':'corner-head-printed-hardware'}
            return dict(file=file,color=color,matrix=(np.eye(4) if matrix is None else matrix).tolist(),
                        **({'bomPartId':owners[Path(file).stem]} if Path(file).stem in owners else {}))
        parts = [item('models/reference/'+name+'.stl',[.66,.70,.73]) for name in ['hardware','cross_hardware']]
        parts += [item('models/reference/post.stl',[.63,.53,.39]),item('models/reference/block.stl',[.12,.14,.15]),
                  item('models/reference/line.stl',[.12,.14,.15])]
        parts += [item('models/arbi/'+models[mid]['output'],[.12,.14,.15]) for mid in IDS if mid.endswith(('left','right'))]
        parts += [item('models/arbi/'+models['corner-head-printed-rear-pad']['output'],[.12,.14,.15],pose(z=z)) for z in [45,155]]
        shields = [item('models/arbi/'+models[mid]['output'],[.94,.94,.92]) for mid in ['corner-head-printed-front-cover','corner-head-printed-rear-cover']]
        straps = [item('models/reference/straps.stl',[.12,.14,.15])]
        renderer.render('covered',parts+shields+straps,direction=(.6,-1,.7),size=(1600,1100))
        renderer.render('open',parts,direction=(.6,-1,.7),size=(1600,1100))
        exploded = []
        for part, shift in zip(shields,[[0,100,-190],[-80,0,0]]):
            matrix=np.eye(4);matrix[:3,3]=shift
            exploded.append({**part,'matrix':matrix.tolist()})
        renderer.render('exploded',parts+exploded,direction=(.6,-1,.7),size=(1600,1100))
        renderer.render('print-left',[item('models/print/'+models['corner-head-printed-left']['output'],[.12,.14,.15])],direction=(.5,-1,.75),size=(1500,1050))
        renderer.render('template',[item('models/arbi/'+models['corner-head-printed-template']['output'],[.12,.14,.15])],direction=(0,0,1),up=(0,1,0),size=(1300,650))
        (work/'figure-manifest.json').write_text(json.dumps(renderer.manifest,indent=2)+'\n')
        scene = trimesh.Scene()
        for i,part in enumerate(parts+shields+straps):
            mesh = trimesh.load_mesh(work/part['file'])
            mesh.visual.face_colors = [*[round(c*255) for c in part['color']],255]
            mesh.apply_transform(part['matrix'])
            scene.add_geometry(mesh,node_name=f'part-{i}',geom_name=Path(part['file']).stem)
        scene.apply_scale(.001)
        (work/'corner-head-assembly-r0.1.0.glb').write_bytes(scene.export(file_type='glb'))
        booklet(work, report)
        for path in work.rglob('*.stl'):
            report.setdefault('mesh_sha256',{})[path.relative_to(work).as_posix()] = digest(path)
        (work/'geometry-report.json').write_text(json.dumps(report,indent=2)+'\n')
        # Temporary reference-source files use absolute include paths and are not
        # portable; the repository snapshot supplies the complete editable source.
        for path in work.glob('*.scad'):
            path.unlink()
        for path in (work/'source').rglob('__pycache__'):
            shutil.rmtree(path)
        (work/'README.txt').write_text(
            'ARBI Corner support set r0.1.0 - concept-unvalidated\n'
            'Default: printed carrier, 120 mm round pole, passive 1.5 mm line.\n'
            'models/arbi STLs use the installed frame; models/print use the documented print pose in mm.\n'
            'Two rear-pad instances use the one registered STL at Z=45 and Z=155 in the installed frame.\n'
            'GLB uses metres. Reference meshes are not supplied parts.\n'
            'Retain standard metal bolts, washers, locking nuts and the purchased pulley.\n'
            'Printed carrier is a prototype: material, slicing, supports, strength and creep are unqualified.\n'
            'Read '+PDF+' and source/repository/docs/assemblies/corner-station/design-package.md.\n'
            'The purchased block connection, keeper, guy attachment, site and loads need acceptance.\n'
            'Rebuild from a repository checkout: python3 scripts/corner-support/build.py.\n')
        pdf = PdfReader(work/PDF)
        assert len(pdf.pages)==8 and all('CONCEPT - UNVALIDATED' in page.extract_text() for page in pdf.pages)
        hashes = {p.relative_to(work).as_posix():digest(p) for p in sorted(work.rglob('*')) if p.is_file()}
        (work/'manifest.json').write_text(json.dumps(dict(files_sha256=hashes),indent=2)+'\n')
        archive = out/(ARTIFACT+'-STL-pack.zip')
        with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as pack:
            for path in sorted(work.rglob('*')):
                if path.is_file():pack.write(path,ARTIFACT+'-STL-pack/'+path.relative_to(work).as_posix())
        for name in [PDF,'geometry-report.json','manifest.json','figure-manifest.json','corner-head-assembly-r0.1.0.glb']:
            shutil.copy2(work/name,out/name)
        shutil.copytree(work/'figures',out/'figures',dirs_exist_ok=True)
        with zipfile.ZipFile(archive) as pack:
            for name, sha in hashes.items():
                assert hashlib.sha256(pack.read(ARTIFACT+'-STL-pack/'+name)).hexdigest()==sha
        print(f'{report["checks"]} nominal mesh checks; PDF, GLB and verified source/STL pack: {out}',flush=True)


def booklet(work, report):
    for name,file in [('ARBI','DejaVuSans.ttf'),('ARBI-Bold','DejaVuSans-Bold.ttf')]:
        pdfmetrics.registerFont(TTFont(name,str(ROOT/'scripts/winch-booklet/fonts'/file)))
    c=canvas.Canvas(str(work/PDF),pagesize=A4)
    width,height=A4
    style=ParagraphStyle('body',fontName='ARBI',fontSize=10,leading=15,textColor=colors.HexColor('#1f2426'))
    def text(value,y):
        p=Paragraph(value,style);_,h=p.wrap(width-88,height);p.drawOn(c,44,y-h);return y-h-12
    def page(number,title,paragraphs,figure=None):
        c.setFillColor(colors.HexColor('#1f2426'));c.setFont('ARBI-Bold',18);c.drawString(44,height-55,title)
        c.setFont('ARBI',9);c.drawString(44,height-78,'ARBI / CORNER SUPPORT SET / r0.1.0 / 8 OCTOBER 2026')
        y=height-105
        for paragraph in paragraphs:y=text(paragraph,y)
        if figure:
            c.drawImage(str(work/'figures'/f'{figure}.png'),44,95,width=width-88,height=max(150,y-110),preserveAspectRatio=True,anchor='c',mask='auto')
        c.setFont('ARBI',8);c.setFillColor(colors.HexColor('#5a6062'))
        c.drawString(44,47,'CONCEPT - UNVALIDATED / No structural, installed or physical acceptance')
        c.drawRightString(width-44,47,f'{number} / 8');c.showPage()
    page(1,'Printed corner support set',[
        'Dimensioned nominal prototype and assembly guide. Default: 120 mm round timber, two printed carrier halves, two printed rear pads, passive 1.5 mm line and the received BA01090 block.',
        'The steel angle, machined saddles and stacked backing plates are replaced by a print-oriented carrier. Standard metal through-bolts, washers, locking nuts, crossbars and pulley pin remain. No custom metal fabrication is required by this proposed head.',
        'The block tang, pin and groove meshes remain provisional envelopes. Printed load parts need process, load and creep acceptance before loaded installation. The cosmetic covers conceal the M12 mounting stack; the upper M8 cross-bolt and pulley remain exposed for inspection.'], 'covered')
    page(2,'Inventory and print selection',[
        '<b>One head:</b> 1 printed left carrier, 1 right carrier, 2 identical rear pads, 1 front cover, 1 rear cover and 2 bought outdoor retention straps. One shared centre-marking template serves all four heads.',
        '<b>Metal hardware per head:</b> 2 M12 through-bolts, 4 large washers and 2 locking nuts; 2 M8 x 100 carrier cross-bolts, 4 M8 washers and 2 locking nuts; the received pulley with a compatible retained attachment pin. Verify every actual dimension and locking zone.',
        '<b>Four heads:</b> 4 left and 4 right carriers, 8 rear pads, 4 front and 4 rear covers, 8 straps, 8 M12 bolts, 16 large washers, 8 M12 nuts, 8 cross-bolts, 16 M8 washers, 8 M8 nuts and 4 pulleys.',
        'Replace the angle/saddle/backing stack and select the new bolt lengths. Keep the historical metal alternative separate; do not combine its source STLs with the printed head. Received pin compatibility and thin-line retention remain open.',
        'The site still requires four posts, reviewed guy connections, anchors, turnbuckles and wire-rope terminations. Their quantities and structural qualification remain separately owned.'], 'open')
    page(3,'Print pose and process record',[
        'Use <b>models/print</b> meshes, not the installed-coordinate <b>models/arbi</b> files. The source pack records the installed-to-print rigid matrices and actual mesh bounds for every configuration. The left/right carriers lie on their wide web faces.',
        'Each part separately fits the nominal 256 x 256 x 256 mm printer envelope with 5 mm XY edge reserve. This bounding-box check excludes brim, supports, purge lines, shrinkage and printer exclusions; inspect the final sliced preview before printing.',
        'The central pulley lug has a local overhang that needs a reviewed support arrangement. The rounded strap tunnels create stress risers in the side webs and require process/load qualification. Inspect the M12 row channels, vertical M8 bores and local lug supports in the slicer. The mesh check does not establish support-free printing or layer adhesion.',
        'ASA is an outdoor prototype candidate. Record filament grade/lot, drying, printer, nozzle, plate, enclosure, walls/infill, supports, layer height and temperatures. Derive the process in design-package.md; no generic infill percentage establishes load capacity.',
        'Inspect pores, delamination, dimensions, flatness and hole clearance. Record a representative loaded/creep test of the chosen print direction, process, temperature and exposure. Reject a failed part and its unqualified process.'], 'print-left')
    page(4,'Mark timber and assemble the carriers',[
        'Measure each post at both rows: diameter/section, taper, ovality, knots, cracks, moisture and treatment. Regenerate the matching 100/120/140 mm round or square-100 study; these are distinct configurations.',
        'The printed template marks Y=0, Z=45 and 155 mm, a 110 mm pitch. Inspect its printed dimensions; mark with the 3 mm centres and remove it before controlled coaxial 13 mm drilling. Timber end/edge distances and treatment follow review.',
        '<b>Through-bolt stack:</b> head - large washer - printed front seat - timber - printed rear pad - large washer - locking nut. Join left/right carriers with two M8 x 100 cross-bolts at Z=100/190 and the matching washers/nuts.',
        '<b>M12 study lengths:</b> 100 / 120 / 140 mm posts use 170 / 190 / 210 mm. The represented stack is post size +66 mm, leaving 4 mm projection. M12 x180 fails the 120 mm printed stack; verify full locking-zone engagement and at least two threads.',
        'Do not infer torque from bolt diameter or compress the printed/timber seats to an invented preload. Record the reviewed assembly procedure and post-settlement recheck. Printed parts retain the selected load path; ordinary fasteners do not bypass their creep limits.'], 'template')
    page(5,'Fit the block and align the line',[
        'The integrated central lug has a nominal 8 mm thickness and 8.6 mm hole. The provisional tang gap is 9 mm. Measure the received BA01090 tang gap, pin diameter, usable length and locking parts before treating this interface as fitted.',
        'Retain the supplied pin if compatible, or select reviewed ordinary hardware. Do not enlarge the factory tang holes, force an M8 bolt, omit a locking feature or count on plastic threads to retain the suspended block.',
        'Equal horizontal and descending tension rotates the freely pivoting block -45 degrees about Y. With the provisional 40 mm pin-to-sheave distance, the sheave is at Z=136.716; the attachment axis is 149.266 mm from the post surface for passive line or 148.366 mm for the powered study. The sheave centre remains 177.55 / 176.65 mm from the post. The loaded drop follows the canonical round-winch tangent: 163.3 / 163.9 mm from the post.',
        'A maximum rope-size listing does not qualify 1.5 mm retention. Inspect groove, side gaps and the complete line sweep under span angles, reversing, full drum width and slack setup. The structural top chord and cosmetic covers do not qualify a fitted keeper; this package does not freeze one.',
        'The nominal Y-axis pivot does not establish yaw freedom or acceptable side lead at arbitrary span azimuth. Received articulation, fleet angle, powered-line bend/fatigue and electrical insulation require their own acceptance. A static mesh alignment result is not an installed operation test.'], 'open')
    page(6,'Fit covers and preserve service access',[
        'Inspect the entire carrier and hardware before fitting white covers. Slide the front cover upward from below and fit the rear cover from -X. Thread two independent outdoor straps through their nominal slots at Z=20/170. Verify their routing and closure on the actual post.',
        'The covers leave the pulley visible and drain below. They do not carry line loads, retain the block, close hazardous thin-line side gaps or establish an IP rating. The roof is integrated into the load carrier; there is no separate roof part or third strap.',
        'For service, isolate and secure the line, support any suspended equipment and retain loose covers before releasing straps. Front cover: lower 190 mm -Z, then slide 100 mm +Y. Rear cover: pull 80 mm -X. Reserve these movements in the guy/dock layout.',
        'The builder samples the stated removal segments against the fixed post, carriers, pads and represented hardware. The previous +X40/+Y5 front-cover path hits a rib and is rejected. It checks front/rear and crossbar socket envelopes with covers removed. It does not qualify hands, actual tools or every continuous path point.',
        'Replace cut straps; inspect print cracks, witness marks, nut locking, timber settlement and drainage before refitting. Remove any part showing permanent distortion, delamination or movement and record the cause.'], 'exploded')
    page(7,'Station layout and load review',[
        'Survey all four pulley centres, pole axes, bed frame, access/public zones and outward anchors. Starting pulley height is 3 m and winch height 0.5-1.0 m; actual posts, embedment and service access follow site review.',
        'At a frictionless 90-degree turn with equal tension T, pulley reaction is sqrt(2) T. The executable statics reference retains span elevation, azimuth, unequal tensions and eccentric moment. Its 10 N examples are synthetic, not operating limits.',
        'One outward guy opposes only one horizontal direction. It leaves transverse force and eccentric vertical-line moment. Review the print lug/chord/web, layer direction, bolt bearing, contact, creep, timber, guy, soil and anchor using maximum operating and fault loads.',
        'The guy-to-post attachment remains unresolved. Define the rated connection and height, wire terminations, adjustment and locking before installation. Neither printed covers nor unspecified straps form that connection.',
        'Dock corner: combine parked camera pod, restraint, shelter and wind loads with service space. Powered corner: protect wiring, bend radius, insulation, short motor/encoder leads, drip loops and driver box drainage. Neither variant is accepted by a head mesh check.'])
    page(8,'Acceptance and maintenance record',[
        '<b>Record before prototype use:</b> station ID; CAD configuration and hashes; received tang/pin/groove dimensions; measured post; print orientation and full process; dimensional inspection; actual bolt lengths and locking-zone engagement; surveyed tangent and height.',
        '<b>Before loaded installation:</b> approved tension and fault cases; print structural/process/creep and environmental review; post/soil/anchor review; rated guy connection and terminations; controlled load procedure with calibrated load, directions, duration, movement limits and reviewer.',
        'Record initial and post-test dimensions. Confirm no permanent deformation, cracks, delamination, timber crush/splitting, bolt movement, block binding, normal line rubbing or side-gap entry. Sweep span/drum travel and record powered/dock-specific conditions separately.',
        'Recheck after settlement and initial cycles, storms/impact and a reviewer-defined interval. Inspect witness marks, print and strap creep, UV/weather damage, wire/line wear, corrosion, fastener loosening and drainage. Covers must not conceal damage.',
        'No numerical proof factor, bolt torque, operating tension or inspection interval is invented here. Close the measurement, printing and review actions in design-package.md and acceptance-record.md. Nominal CAD, print fit and installed load acceptance are separate facts.'])
    c.save()


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=ROOT/'hardware/generated/corner-support')
    args=parser.parse_args()
    build(args.output.resolve())
