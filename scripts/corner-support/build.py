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
import tempfile
import zipfile

import numpy as np
import trimesh
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph, Table, TableStyle
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[2]
LIB = ROOT / 'hardware/lib/corner-head.scad'
IDS = ['corner-head-hood', 'corner-head-roof', 'corner-head-rear-cover', 'corner-head-front-saddle',
       'corner-head-rear-saddle', 'corner-head-marking-template']
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


def translated(mesh, xyz):
    result = mesh.copy()
    result.apply_translation(xyz)
    return result


def cylinder(diameter, length, center):
    mesh = trimesh.creation.cylinder(radius=diameter/2, height=length, sections=96)
    mesh.apply_transform(trimesh.transformations.rotation_matrix(math.pi/2, [0, 1, 0]))
    mesh.apply_translation(center)
    return mesh


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


def build(out):
    version = subprocess.run(['openscad', '--version'], capture_output=True, text=True, timeout=10, check=True)
    if (version.stdout+version.stderr).strip() != 'OpenSCAD version 2021.01':
        raise ValueError('OpenSCAD 2021.01 required.')
    out.mkdir(parents=True, exist_ok=True)
    # Build in an empty directory, then copy a complete fresh snapshot. Stale
    # meshes in an existing output directory cannot enter the archive.
    registry = json.loads((ROOT/'hardware/models.json').read_text())
    models = {m['id']: m for m in registry['models']}
    report = dict(revision='0.1.0', status='concept-unvalidated', openscad='2021.01',
                  checks=0, tangent_tolerance_mm=.001, variants={}, statics=verify_load_reference())
    def clear(a, b, label):
        report['checks'] += 1
        if overlap(a, b) > .01:
            raise ValueError('Nominal interference: '+label)

    with tempfile.TemporaryDirectory(prefix='arbi-corner-build-', dir='/tmp') as temporary:
        work = Path(temporary)
        references = work/'models/reference'
        sources = [ROOT/'hardware/models.json', ROOT/'bom/catalog/parts.json', ROOT/'bom/assemblies/assemblies.json',
                   ROOT/'hardware/lib/arbi.scad', LIB, Path(__file__).resolve(), ROOT/'scripts/corner-support/check.py',
                   ROOT/'hardware/lib/winch-pole.scad', ROOT/'hardware/lib/winch-mount.scad', ROOT/'hardware/lib/winch-drum.scad',
                   ROOT/'hardware/assemblies/winch/round-pole.md', ROOT/'hardware/assemblies/winch/full-cover.md',
                   ROOT/'scripts/winch-booklet/render_figures.py', ROOT/'scripts/winch-booklet/requirements.txt',
                   ROOT/'LICENSE', *sorted((ROOT/'hardware/assemblies/corner-station').glob('corner-head-*.scad')),
                   *sorted((ROOT/'docs/assemblies/corner-station').glob('*.md')),
                   ROOT/'hardware/assemblies/corner-station/README.md',
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

        for shape, size, leg, line in [('round',100,200,1.5), ('round',120,200,1.5),
                                      ('round',140,200,1.5), ('round',120,200,4.5), ('square',100,150,1.5)]:
            key = f'{shape}-{size}-angle-{leg}-line-{line}'
            default = (shape,size,leg,line) == ('round',120,200,1.5)
            directory = work/'models/arbi' if default else work/'variants'/key
            defines = [f'post_shape="{shape}"', f'post_size_mm={size}', f'bracket_leg_mm={leg}', f'line_diameter_mm={line}']
            meshes = {}
            for mid in IDS:
                if shape == 'square' and 'saddle' in mid:
                    continue
                model = models[mid]
                path = directory/model['output']
                mesh = export(ROOT/model['entrypoint'], path, defines)
                assert mesh.body_count == 1, (key,mid,mesh.body_count)
                meshes[mid] = mesh
            refs = {}
            for name, call in dict(post='ch_post();', bracket='ch_bracket();', backing='ch_backing();',
                                   hardware='ch_hardware();', block='ch_block();', connector='ch_connector();', line='ch_line();', straps='ch_straps();').items():
                source = work/f'{name}.scad'
                source.write_text(f'include <{LIB.as_posix()}>\n{call}\n')
                path = (references if default else directory/'references')/(name+'.stl')
                refs[name] = export(source, path, defines)
            for mid, mesh in meshes.items():
                if mid.endswith('marking-template'):
                    assert np.allclose(mesh.extents, [leg,50,4]), (key,mesh.extents)
                    continue
                for name, reference in refs.items():
                    # Hardware/saddle/contact interfaces have designed shared
                    # boundary surfaces; all checks allow only zero-volume contact.
                    if 'saddle' in mid and name not in ['post','hardware','bracket','backing']:
                        continue
                    clear(mesh, reference, key+'/'+mid+'/'+name)
            hood, rear, roof = meshes['corner-head-hood'], meshes['corner-head-rear-cover'], meshes['corner-head-roof']
            clear(hood, rear, key+'/shield pair')
            clear(hood,roof,key+'/stem and roof')
            # Real removal paths, including slow partial movements. Cross-plane
            # movement is checked against the represented fixed head and pole.
            fixed = {**{k:m for k,m in refs.items() if k!='straps'}, **{k:m for k,m in meshes.items() if 'saddle' in k}}
            for lift in [1,5,10,15,20]:
                for name, reference in fixed.items():
                    clear(translated(roof,[0,0,lift]),reference,key+'/roof/lift/'+name)
            # Reject a straight roof pull into the projecting connector.
            assert overlap(translated(roof,[20,0,0]),refs['connector']) > .01
            for travel in [1,5,10,20,40,80]:
                for mesh, sign, label in [(hood,1,'hood'),(rear,-1,'rear')]:
                    if sign==1 and travel>40:
                        continue
                    for name, reference in fixed.items():
                        clear(translated(mesh,[sign*travel,0,0]), reference, key+'/'+label+f'/removal-{travel}/'+name)
                for name, reference in fixed.items():
                    clear(translated(hood,[40,travel,0]),reference,key+f'/hood/side-{travel}/'+name)
                    clear(translated(roof,[0,travel,20]),reference,key+f'/roof/side-{travel}/'+name)
            front = size/2+(10 if shape=='round' else 0)
            rear_face = -front
            for z in ([45,155] if leg==200 else [35,115]):
                tool_front = cylinder(28,40,[front+35,0,z])
                tool_rear = cylinder(30,40,[rear_face-45,0,z])
                for mid, mesh in meshes.items():
                    if 'saddle' in mid:
                        clear(mesh,tool_front,key+'/front socket')
                        clear(mesh,tool_rear,key+'/rear socket')
            length = math.ceil((size+51)/10)*10 if shape=='round' else 160
            stack = size+(20 if shape=='round' else 0)+5+4+6+12
            projection = length-stack
            assert projection >= 3.5, (key,projection)
            offset = (33+(130.3 if line==1.5 else 130.9)+15-line/2-(10 if shape=='round' else 0)) if leg==200 else 125
            # The polygonal sphere's X/Y radius is slightly below nominal. Use
            # its written transverse radius; ASCII STL coordinates round at 6
            # significant digits, so compare at 0.001 mm rather than exact zero.
            tangent = refs['line'].bounds[0,0]+refs['line'].extents[1]/2
            winch = size/2+report['winch_tangents_from_post_mm'][0 if line==1.5 else 1]
            error = tangent-winch
            if leg==200:
                assert abs(error) < report['tangent_tolerance_mm'], (key,error)
            report['variants'][key] = dict(bolt_length_mm=length, tip_projection_mm=round(projection,3),
                terminal_hole_from_seat_mm=round(offset,3), tangent_error_mm=round(error,6),
                meshes={k:dict(bounds_mm=v.bounds.round(3).tolist(), volume_mm3=round(v.volume,3), bodies=v.body_count,
                              watertight=v.is_watertight, winding=v.is_winding_consistent) for k,v in meshes.items()})
            print('Checked '+key,flush=True)
        # Independent controls reject the two errors that motivated this proposal.
        old_tangent = 60+10+125-14.25
        assert abs(old_tangent-(60+33+130.3)) > 40
        assert 160-(120+20+5+4+6+12) < 3.5
        report['negative_controls'] = dict(legacy_round_120_tangent_error_mm=-42.55,
                                           m12x160_round_120_missing_engagement_mm=7)

        spec = importlib.util.spec_from_file_location('corner_renderer',work/'source/render_figures.py')
        renderer = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(renderer)
        def item(file,color,matrix=None):
            owners={'bracket':'corner-head-angle-200','backing':'pulley-bracket-backing-plate',
                    'hardware':'corner-head-through-bolts','post':'corner-post-treated-timber',
                    'block':'top-positioning-line-pulley','line':'dyneema-positioning-line','straps':'corner-head-retention-straps'}
            return dict(file=file,color=color,matrix=(np.eye(4) if matrix is None else matrix).tolist(),
                        **({'bomPartId':owners[Path(file).stem]} if Path(file).stem in owners else {}))
        parts = [item('models/reference/'+name+'.stl',[.66,.70,.73]) for name in ['bracket','backing','hardware','connector']]
        parts += [item('models/reference/post.stl',[.63,.53,.39]),item('models/reference/block.stl',[.12,.14,.15]),
                  item('models/reference/line.stl',[.12,.14,.15])]
        parts += [item('models/arbi/'+models[mid]['output'],[.66,.70,.73]) for mid in IDS if 'saddle' in mid]
        shields = [item('models/arbi/'+models[mid]['output'],[.94,.94,.92]) for mid in ['corner-head-hood','corner-head-roof','corner-head-rear-cover']]
        straps = [item('models/reference/straps.stl',[.12,.14,.15])]
        renderer.render('covered',parts+shields+straps,direction=(.6,-1,.7),size=(1600,1100))
        renderer.render('open',parts,direction=(.6,-1,.7),size=(1600,1100))
        exploded = []
        for part, shift in zip(shields,[[40,80,0],[0,80,20],[-80,0,0]]):
            matrix=np.eye(4);matrix[:3,3]=shift
            exploded.append({**part,'matrix':matrix.tolist()})
        renderer.render('exploded',parts+exploded,direction=(.6,-1,.7),size=(1600,1100))
        renderer.render('drill', [item('models/reference/bracket.stl',[.66,.70,.73])],direction=(1,-.08,.1),size=(1100,1000))
        renderer.render('template',[item('models/arbi/'+models['corner-head-marking-template']['output'],[.12,.14,.15])],direction=(0,0,1),up=(0,1,0),size=(1300,650))
        (work/'figure-manifest.json').write_text(json.dumps(renderer.manifest,indent=2)+'\n')
        scene = trimesh.Scene()
        for i,part in enumerate(parts+shields+straps):
            mesh = trimesh.load_mesh(work/part['file'])
            mesh.visual.face_colors = [*[round(c*255) for c in part['color']],255]
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
            'Default: proposed 200 mm angle, 120 mm round pole, passive 1.5 mm line.\n'
            'STLs use mm; GLB uses metres. Reference meshes are not supplied parts.\n'
            'Front/rear saddles MUST be metal; no load-bearing printed substitutes.\n'
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
    page(1,'Corner support set',[
        'Dimensioned nominal design and assembly guide. Default shown: 120 mm round timber, proposed 200 x 40 x 200 x 5 mm steel angle, passive 1.5 mm line and metal saddles.',
        'The received BA01090 pulley has a double tang. Its connector and block meshes are provisional envelopes. Weather shields are non-structural; the pulley stays exposed for inspection.'], 'covered')
    page(2,'Inventory and replacement scope',[
        '<b>One head:</b> one 200 mm angle; two 100 x 200 x 2 mm backing plates; one metal front saddle and one metal rear saddle; two M12 through-bolts; four 13 x 37 x 3 mm washers; two M12 locking nuts; one received BA01090 block; a reviewed compatible connector.',
        '<b>Four heads:</b> 4 angles, 8 backing plates, 8 metal saddles, 8 bolts, 16 washers, 8 nuts and 4 pulleys. Optional: 4 stem hoods, 4 roofs, 4 rear covers and 12 straps. One shared marking template.',
        'Replace the four 150 mm angles and their bolt selection for the round-head proposal; do not add both sets. Existing keeper r0.1.0 is a 58 mm concept and does not fit the received 30 mm block.',
        'Site allowances: four posts, four reviewed guy connections, four anchors, four turnbuckles, eight thimbles, 16 clamps and 16 m guy wire. These are quantities, not a rated complete rig. Clamp count and tails depend on the chosen termination specification.',
        'No new supplier price asserted. Structural saddles are machining envelopes, not print instructions. ASA shields need slicing, fit, UV/creep and retention tests.'], 'open')
    page(3,'Inspect and mark the steel angle',[
        'Measure the bought angle, bend and every factory hole/dimple. The model omits these details. Reject a proposed hole pattern that intersects a factory feature or violates the structural review; do not drill from the image.',
        '<b>200 mm angle:</b> vertical M12 centres are Y=0, Z=45 and 155 mm from the bottom. Mark 3 mm pilot centres; remove the template. Final clearance holes are 13 mm.',
        '<b>Terminal hole:</b> 9 mm at Y=0, 167.55 mm from the flat front seat for the passive line, or 166.65 mm for the nominal 4.5 mm powered line. Use a measured jig for the horizontal leg. Inspect connector before drilling.',
        'Deburr all holes and preserve edge protection. No tightening torque or structural load rating is assigned. Final drilling and timber edge/end distances require review.'], 'drill')
    page(4,'Prepare timber and assemble the stack',[
        'Measure each post at both bolt rows: diameter/section, taper, ovality, cracks, knots, moisture and treatment. Match the saddle exports to those measurements. Do not install flat plates directly on a round post.',
        'Mark the timber and plates from the inspected metal assembly; drill straight, coaxial 13 mm holes with a controlled fixture. The printed template is a centre marking aid, not a powered drill bush.',
        '<b>Stack:</b> head - washer - angle - metal front saddle - timber - metal rear saddle - two backing plates - washer - locking nut. Square baseline omits both saddles.',
        '<b>Round study bolts:</b> 100 / 120 / 140 mm poles use nominal M12 x 160 / 180 / 200. A 120 mm round stack needs 167 mm before tip projection; M12 x 160 fails the represented engagement. Check the actual nut locking zone and at least two protruding threads.'], 'template')
    page(5,'Fit the pulley and align the winch',[
        'Inspect the BA01090 tang gap, supplied pin diameter/length, locking, sheave/groove and side clearances. A maximum 8 mm rope specification does not qualify 1.5 mm line retention. Do not enlarge the factory tang holes or force an M8 shackle.',
        'Place the loaded line drop directly above the drum tangent. The proposed 200 mm hole follows the committed round-winch nominal tangent: 163.3 mm from the post surface for passive, 163.9 mm for powered.',
        'The old 150 mm angle on a 120 mm round post puts the drop 42.55 mm behind the passive tangent. CAD alignment does not establish received block articulation or acceptable fleet angle.',
        'Sweep the full winding width, both directions, span angles and slack conditions. The powered 4.5 mm line assumption needs its own bend, fatigue, insulation and retention checks.'], 'open')
    page(6,'Install shields and service the head',[
        'Inspect and tighten the metal stack first. Fit the white stem hood from +X and rear cover from -X. Thread two independent outdoor straps through both at Z=20/170 mm. Seat the separate roof from above; retain it with a third strap around the roof and steel arm. Starting strap length 800 mm, width <=2.5 mm, thickness <=1 mm.',
        'The shield is open below and stops short of the terminal connection. Verify drainage and inspect the exposed block and line. It does not close thin-line side gaps, retain a derailed line or establish an IP rating.',
        'For service, isolate/secure and retain loose covers before releasing straps. Roof: lift 20 mm +Z, then slide 80 mm +Y. Stem hood: pull 40 mm +X, then slide 80 mm +Y. Rear cover: pull 80 mm -X. A straight roof pull hits the connector. Inspect nuts; replace cut straps and test retention physically.',
        'Nominal lift and translation segments are sampled separately. Reserve these movements in the dock/guy layout. Cosmetic shields provide no structural secondary retention.'], 'exploded')
    page(7,'Station layout and load review',[
        'Survey the four pulley centres, pole axes, bed frame, public/access zones and outward anchors. Starting pulley height is 3 m, winch height 0.5-1.0 m; actual post length and embedment follow site review.',
        'At a frictionless 90-degree turn with equal tension T, pulley reaction is sqrt(2) T. The executable statics reference retains span elevation, azimuth, unequal leg tension and eccentric moment. Its 10 N examples are synthetic, not operating limits.',
        'A single outward guy opposes only one horizontal direction. It does not remove transverse force or the eccentric vertical-line moment. Timber, angle/bend, bolt group, saddle contact, soil and anchor all need calculations using maximum configured and fault loads.',
        'The guy-to-post attachment remains unresolved. Define its rated metal connection and height before installation. Select termination/clamp count from the actual wire supplier, preserve turnbuckle adjustment and lock it.',
        'Dock corner: combine parking/retention/wind loads and service access. Powered corner: retain separate protected wiring, short motor/encoder leads, drip loops, box drainage and electrical review. Neither variant is accepted by this head mesh check.'])
    page(8,'Acceptance and maintenance record',[
        '<b>Record before prototype use:</b> station ID; CAD configuration and hashes; received block/tang/pin dimensions; actual metal/hole dimensions; timber/treatment; saddle grade/process; bolt length/engagement; connector locking; strap process/retention; surveyed tangent and height.',
        '<b>Before loaded installation:</b> approved tension and fault cases; structural/soil/anchor review; rated guy connection and terminations; controlled proof-load procedure with calibrated load, directions, duration, movement limits, reviewer and pre/post inspections.',
        'Confirm no permanent bending, cracks, timber crush/splitting, bolt movement, pulley binding, normal line contact or side-gap entry. Sweep the full span and drum travel, low-tension setup, powered-line route and dock load cases.',
        'Inspect after settlement and initial cycles, after storms/impact and at a reviewer-defined interval. Record movement witness marks, corrosion, treatment, wire/line wear, fastener loosening, print cracks, strap creep and drainage. Reject damaged parts; do not conceal defects under covers.',
        'No numerical proof factor, bolt torque, inspection interval or load capacity is invented here. Close the measurements and review actions in design-package.md and acceptance-record.md.'])
    c.save()


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=ROOT/'hardware/generated/corner-support')
    args=parser.parse_args()
    build(args.output.resolve())
