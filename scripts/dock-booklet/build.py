"""Build DOCK-IF-01 nominal bench meshes, actual-mesh booklet and verified source pack."""
import argparse
import concurrent.futures
import hashlib
import importlib.util
import json
import math
from pathlib import Path
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
from reportlab.platypus import Paragraph

ROOT = Path(__file__).resolve().parents[2]
ARTIFACT = 'ARBI-dock'
PDF = ARTIFACT+'-assembly-STL.pdf'
KIT = json.loads((Path(__file__).parent/'kit.json').read_text())
IDS = [mid for items in KIT.values() for mid, _, _ in items]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


helpers = load_module('corner_mesh_helpers', ROOT/'scripts/corner-support/build.py')


def pose(x=0, y=0, z=0, angle=0):
    matrix = trimesh.transformations.rotation_matrix(math.radians(angle), [0,0,1])
    matrix[:3,3] = [x,y,z]
    return matrix


def instances(models):
    result = []
    def add(mid, matrix=None, label=None):
        result.append(dict(file='models/arbi/'+models[mid]['output'],
            matrix=(np.eye(4) if matrix is None else matrix).tolist(),
            color=[.94,.94,.92] if mid=='dock-roof-quarter' else [.12,.14,.15],
            label=label or mid))
    for mid in ['dock-locator-carrier','dock-latch-fork','dock-pod-bridge','dock-pod-stud']:
        add(mid)
    for mid in ['dock-arm-root','dock-arm-extension']:
        add(mid,pose(x=-450))
    for z in [45,155]:add('dock-post-rear-pad',pose(x=-450,z=z),f'rear-pad-{z}')
    for a in [0,90,180,270]:
        add('dock-guide-quarter',pose(angle=a),f'guide-{a}')
        add('dock-roof-quarter',pose(angle=a),f'roof-{a}')
    for x in [-40,40]:
        for y in [-40,40]:add('dock-roof-spacer',pose(x,y,156),f'roof-spacer-{x}-{y}')
    for a in [45,135,225,315]:
        add('dock-pod-bridge-shoe',pose(90*math.cos(math.radians(a)),90*math.sin(math.radians(a)),angle=a),f'shoe-{a}')
    return result


def booklet(work, report):
    for name, file in [('ARBI','DejaVuSans.ttf'),('ARBI-Bold','DejaVuSans-Bold.ttf')]:
        pdfmetrics.registerFont(TTFont(name,str(ROOT/'scripts/winch-booklet/fonts'/file)))
    c = canvas.Canvas(str(work/PDF),pagesize=A4)
    width,height = A4
    style = ParagraphStyle('body',fontName='ARBI',fontSize=10,leading=14,textColor=colors.HexColor('#1f2426'))
    def page(number,title,paragraphs,figure):
        c.setFillColor(colors.HexColor('#1f2426'));c.setFont('ARBI-Bold',18);c.drawString(44,height-55,title)
        c.setFont('ARBI',9);c.drawString(44,height-77,'ARBI / DOCK-IF-01 / r0.1.0 / 9 OCTOBER 2026')
        y=height-101
        for value in paragraphs:
            p=Paragraph(value,style);_,h=p.wrap(width-88,height);p.drawOn(c,44,y-h);y-=h+10
        assert y>225,(number,'text leaves no figure space',y)
        meta=json.loads((work/'figure-manifest.json').read_text())[figure]
        iw,ih=meta['size'];scale=min((width-88)/iw,(y-102)/ih);dw,dh=iw*scale,ih*scale
        dx,dy=44+(width-88-dw)/2,87+(y-102-dh)/2
        c.drawImage(str(work/'figures'/f'{figure}.png'),dx,dy,width=dw,height=dh,mask='auto')
        if figure=='inventory':
            for label,(px,py) in meta['anchors'].items():
                x0,y0=dx+px*dw,dy+py*dh;c.setFillColor(colors.white);c.setStrokeColor(colors.HexColor('#1f2426'));c.circle(x0,y0,6,fill=1,stroke=1)
                c.setFillColor(colors.HexColor('#1f2426'));c.setFont('ARBI-Bold',7);c.drawCentredString(x0,y0-2.5,label)
        c.setFont('ARBI',8);c.setFillColor(colors.HexColor('#5a6062'))
        c.drawString(44,47,'CONCEPT - UNVALIDATED / Supported dummy bench use only')
        c.drawRightString(width-44,47,f'{number} / 9');c.showPage()
    page(1,'Dock bench kit',[
        'One non-powered corner, shared round-120 post study (60 mm radius). The actual corner ID, post survey and printer remain unmeasured. This nominal package does not authorize a suspended pod, automated capture or site installation.',
        'The arm projects the capture axis 390 mm from the nominal post face. Four guide quadrants form a 275 mm approach mouth and 60 mm throat; a 26 mm final bore receives the 24 mm mushroom head. The fork is manually opened 40 mm toward the post.',
        'Actual current compact-pod meshes are shown as context. The stud bridge clamps the fixed spider; it does not load the rain hood. Keep the dummy supported throughout assembly, insertion, release and testing.'], 'covered')
    printed='; '.join(f'[{i+1}] {q} {mid.removeprefix("dock-").replace("-"," ")}' for i,(mid,_,q) in enumerate([item for items in KIT.values() for item in items]))
    page(2,'Printed inventory and files',[
        printed+'. One example per model is numbered below.',
        'Use <b>models/print</b> for one-part printing, <b>models/arbi</b> for installed coordinates, and <b>models/reference</b> only for context. Never print the camera-pod context STL as a dock component. Quantities describe one bench dock; the kit does not duplicate the pod BOM.',
        'Each print bounds fits the nominal 256 mm cube with 5 mm XY edge reserve. This excludes supports, brim, purge and printer exclusions. Record filament/lot, drying, orientation, walls/infill, supports, printer and slice settings; inspect the slice before fabrication.',
        'Root lies on its wide web face; roof lies on its sloping exterior face. Inspect support for guide overhangs, bridge top links, locator flange/channel and all bolt bores. Mesh fit is not a print-process or structural acceptance.'], 'inventory')
    hw=json.loads((Path(__file__).parent/'hardware.json').read_text())
    page(3,'Bought hardware and inspection',[
        '; '.join(f'{q} {name}' for name,q in hw)+'.',
        'M12 x 190 is only the round-120 stack study: post 120 + front 28 + rear 14 + washers 6 + nut 12 = 180 mm, leaving 10 mm. Recalculate for measured post and received hardware. Do not reuse the corner-head mounting rows or its complete hardware set.',
        'Spring assortment and two seating/fork microswitches are BOM allowances. Product, spring force, switch targets/mounts, stationary release actuator and circuit remain unselected. There is no automated capture authority in this package.',
        'Inspect received shank, thread, head, washer and locking dimensions. Verify full locking-zone engagement and at least two threads; derive torque from reviewed material/contact procedure, not diameter.'], 'arm')
    page(4,'Arm and locator assembly',[
        'Use a restrained bench post and a supported dummy. Establish dedicated dock rows at local Z=45/155 mm, 110 mm pitch. Survey the existing corner head, guys, lines and its cover removal space before selecting actual site rows or drilling.',
        'Fit the root on +X and two rear pads at Z=45/155 mm. M12 stack: head - large washer - root - timber - rear pad - large washer - locking nut. Fit extension over the root lap; use two M8 x 50 bolts at X=260/280 mm with washers and locking nuts.',
        'Place locator flange above the arm platform. Its lower body passes through the 70 mm platform opening. The four roof/arm bolt axes are (+/-40,+/-40) in dock coordinates; the final M4 x 100 stack also retains the locator.',
        'Sampled nominal geometry clears the represented post; dedicated rows, timber edge distances, load, creep and joint procedure require acceptance.'], 'arm')
    page(5,'Guide, fork and manual sequence',[
        'Install four guide quadrants rotated 0/90/180/270 degrees. At each (+/-30,+/-30), stack guide tab 5 + arm platform 30 + locator flange 6 mm; use M4 x 50 with two washers and locking nut. Inspect the throat join and quadrant seams.',
        'Insert the fork from -X into the 5.2 mm guide channel. Closed 17 mm slot clears the 14 mm stem; the 24 mm head overlaps the slot by 3.5 mm per side nominally. At 1 mm center offset the smaller nominal overlap is 2.5 mm. Those values do not qualify bearing area, tolerance, wear or strength.',
        'For supported manual insertion: retract fork 40 mm, raise the stud into the final bore until its head reaches the upper stop, then close the fork while retaining external support. Release only after supporting/unloading the dummy; retract 40 mm and lower it.',
        'The illustration sections the actual locator at Y=0 to expose the head stop, fork and axial bolt; print the whole carrier STL. Do not expect automatic push-in capture. Spring return, anti-backdrive, release force under preload, sensors and recovery remain physical development tasks.'], 'latch')
    page(6,'Pod bridge and through-bolt',[
        'Use the current 230 mm spider with 22 mm arms and 7 mm plate. Place four upper feet at radius 90 mm on diagonals 45/135/225/315 degrees. Fit one lower shoe per arm, with cheeks around the width; eight M3 x 30 clamps use two washers and locking nuts each.',
        'Verify the nominal 0.5 mm shoe-cheek gap to the upper foot so preload reaches the spider. Shoes constrain across the arm; radial retention depends on clamping friction. Mark and test for slip, plate crushing, layer separation and creep. Do not represent this as a positive radial structural lock.',
        'Attach the stud flange to the bridge at Z=75 mm with one M4 x 100 axial bolt, two washers and locking nut. Verify the underside bolt tip clears the actual hood and electronics; never carry capture load through the hood.',
        f'Added solid CAD print volume is {report["pod_attachment_volume_cm3"]:.2f} cm3 before metal hardware. Complete-pod mass must include every attachment and remain under 170 g. Weigh actual sliced parts and complete pod; the kit is restricted to supported dummy testing while that budget and joint strength remain unresolved.'], 'pod')
    page(7,'Roof and line corridors',[
        'Place four 49 mm roof spacers on locator flange at (+/-40,+/-40). Fit four roof quadrants rotated 0/90/180/270 degrees over them. Four M4 x 100 bolts pass through roof boss, spacer, locator flange and arm; put lower washers in the platform recesses at Z124-125 and locking nuts at Z120-124.',
        'Join four roof seams using four M3 x 16 bolts, eight washers and four nuts. The 300 x 300 mm sloping cover has nominal vertical 18 mm line corridors at the four radius 104 mm spider attachment axes. The guide has matching corridors.',
        'These corridors check one synthetic vertical line pose, not surveyed sloping spans, moving approach, powered-line wiring, bend radius, swing or installation clearance. Regenerate/review the actual swept line envelopes before any suspended use.',
        'Seams, exposed corridors and lack of seals do not establish rain protection or an IP rating. Bench-check runoff, accumulation, splash and optical access without live electronics.'], 'roof')
    page(8,'Bench checks and acceptance',[
        'Use bench-test-plan.md DT01-DT12 and acceptance-record.md. Record source hashes, configured post, printer/process, received hardware, dummy mass, clearances and measured geometry. Keep real site details out of public records.',
        'Check repeated supported insertion/release, offset/tilt, fork travel and false seating, force/displacement, spring removal, contamination, wear and manual recovery. Review force limits and fixture restraint before applying loads; this package invents no proof factor or operating tension.',
        'Separate physical seating from fork engagement and released-clear observations. Select and test switch targets/circuit diagnostics before feeding a controller. A command receipt, HOME or software Parked state does not establish retention.',
        'Accept all-line restraint through driver disable and total/partial power loss separately (LS16-LS18). A captured pod does not prove the four lines remain above the accessible zone.'], 'open')
    page(9,'Evidence and next development',[
        f'{report["checks"]} nominal mesh checks: watertight connected print parts, rigid bed poses, sampled fork travel and supported release, current pod context, post/part interference and a synthetic vertical-line pose. Independent collision controls demonstrate rejection of the old closed-fork descent and missing line corridor.',
        'Exploded figures separate print parts; remove fasteners before disassembly. They are not checked removal trajectories. geometry-report.json records bounds, volumes, transforms and source/STL hashes. manifest.json verifies the complete PDF/STL/source pack. Canonical hardware/**/*.scad remains authoritative; context and fabricated sources are separated.',
        'Remaining gates: measured corner/printer, complete pod mass and center of gravity, current harness/line sweep, structural clamp and arm load/creep, passive latch return and release actuator/circuit, observations, outdoor weather/wear, and power-loss all-line restraint.',
        'Update acceptance-record.md with actual results and reviewer. No CAD, PDF, CI or simulation check changes concept-unvalidated into physical acceptance.'], 'exploded')
    c.save()


def build(out):
    version=subprocess.run(['openscad','--version'],capture_output=True,text=True,check=True)
    assert (version.stdout+version.stderr).strip()=='OpenSCAD version 2021.01'
    models={m['id']:m for m in json.loads((ROOT/'hardware/models.json').read_text())['models']}
    out.mkdir(parents=True,exist_ok=True)
    fabrication=json.loads((ROOT/'bom/catalog/fabrication.json').read_text())
    catalog=json.loads((ROOT/'bom/catalog/parts.json').read_text())
    for pid,items in KIT.items():
        recipe=next(r for r in fabrication['recipes'] if r['partId']==pid and r['buildId']=='arbi-v1')
        assert [(r['modelId'],int(r['quantity'])) for r in recipe['components']]==[(mid,q) for mid,_,q in items],pid
        part=next(p for p in catalog['parts'] if p['id']==pid)
        assert {s['modelId'] for s in part['fabrication']['sources']}=={mid for mid,_,_ in items},pid
    hardware=json.loads((Path(__file__).parent/'hardware.json').read_text())
    assert next(p for p in catalog['parts'] if p['id']=='dock-bench-hardware')['requirements']==[f'{q} {name}' for name,q in hardware]
    report=dict(revision='0.1.0',status='concept-unvalidated',configuration='DOCK-IF-01 / non-powered round 120 / supported dummy bench',
        fabrication_ids=IDS,printed_model_ids=IDS,openscad='2021.01',checks=0,printer_envelope_mm=[256]*3,bed_edge_reserve_mm=5,print_parts={},meshes={})
    with tempfile.TemporaryDirectory(prefix='arbi-dock-build-',dir='/tmp') as temporary:
        work=Path(temporary)
        sources=sorted(set([ROOT/'hardware/models.json',ROOT/'bom/catalog/parts.json',ROOT/'bom/assemblies/assemblies.json',ROOT/'bom/catalog/fabrication.json',
            *ROOT.glob('hardware/lib/*.scad'),*ROOT.glob('hardware/assemblies/camera-pod/*.scad'),*ROOT.glob('hardware/assemblies/dock/*.scad'),
            *ROOT.glob('docs/assemblies/dock/**/*.md'),*ROOT.glob('scripts/dock-booklet/*.*'),ROOT/'scripts/corner-support/build.py',
            ROOT/'scripts/cad-previews/csg.py',ROOT/'scripts/winch-booklet/render_figures.py',ROOT/'scripts/winch-booklet/requirements.txt',*ROOT.glob('scripts/winch-booklet/fonts/*'),ROOT/'LICENSE']))
        report['sources_sha256']={p.relative_to(ROOT).as_posix():digest(p) for p in sources}
        for p in sources:
            target=work/'source/repository'/p.relative_to(ROOT);target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,target)
        shutil.copy2(ROOT/'scripts/winch-booklet/render_figures.py',work/'source/render_figures.py')
        (work/'source/arbi-hardware').mkdir();shutil.copy2(ROOT/'hardware/models.json',work/'source/arbi-hardware/models.json')
        def export_id(mid):
            path=work/'models/arbi'/models[mid]['output'];return mid,helpers.export(ROOT/models[mid]['entrypoint'],path)
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
            meshes=dict(executor.map(export_id,IDS))
        for mid,mesh in meshes.items():
            assert mesh.body_count==1,(mid,'disconnected')
            matrix=np.eye(4)
            if mid=='dock-arm-root':matrix=trimesh.transformations.rotation_matrix(math.pi/2,[1,0,0])
            if mid=='dock-roof-quarter':matrix=trimesh.geometry.align_vectors([1/12,1/12,1],[0,0,-1])
            printed=mesh.copy();printed.apply_transform(matrix);shift=-printed.bounds[0];matrix[:3,3]=shift;printed.apply_translation(shift)
            assert np.all(printed.extents[:2]<=246.002) and printed.extents[2]<=256.002,(mid,printed.extents)
            path=work/'models/print'/models[mid]['output'];path.parent.mkdir(exist_ok=True);printed.export(path)
            report['print_parts'][mid]=dict(file=path.relative_to(work).as_posix(),installed_to_print=matrix.tolist(),extents_mm=printed.extents.round(3).tolist(),bed_fits=True)
            report['meshes'][mid]=dict(volume_cm3=round(mesh.volume/1000,6),bounds_mm=mesh.bounds.round(3).tolist(),bodies=1)
            report['checks']+=4
        report['pod_attachment_volume_cm3']=sum(meshes[mid].volume/1000*q for mid,q in [('dock-pod-bridge',1),('dock-pod-bridge-shoe',4),('dock-pod-stud',1)])
        references=work/'models/reference';references.mkdir()
        print('Meshing the current pod CSG components...',flush=True)
        pod_csg=references/'current-pod.csg'
        run=subprocess.run(['openscad','-o',str(pod_csg),str(ROOT/'hardware/assemblies/camera-pod/camera-pod-assembly.scad')],capture_output=True,text=True,timeout=30)
        assert run.returncode==0 and 'WARNING:' not in run.stderr and 'ERROR:' not in run.stderr,run.stderr
        splitter=load_module('dock_csg_splitter',ROOT/'scripts/cad-previews/csg.py')
        cache=out/'.context-cache';cache.mkdir(exist_ok=True)
        def context_component(task):
            family,i,geometry=task;key=hashlib.sha256(('OpenSCAD 2021.01\n'+geometry).encode()).hexdigest()
            cached=cache/(key+'.stl');receipt=cache/(key+'.sha256')
            target=references/(family+'-components')/f'{i}.stl';target.parent.mkdir(exist_ok=True)
            if cached.exists() and receipt.exists() and digest(cached)==receipt.read_text().strip():
                shutil.copy2(cached,target)
            else:
                source=work/f'{family}-component-{i}.scad';source.write_text(geometry+'\n')
                run=subprocess.run(['openscad','-o',str(target),str(source)],capture_output=True,text=True,timeout=300)
                assert run.returncode==0 and 'WARNING:' not in run.stderr and 'ERROR:' not in run.stderr,run.stderr
                source.unlink()
            mesh=trimesh.load_mesh(target)
            assert mesh.is_watertight and mesh.is_winding_consistent and mesh.volume>0,(i,'invalid context')
            staged=cache/(key+f'.{family}-{i}.tmp');shutil.copy2(target,staged);staged.replace(cached)
            receipt.write_text(digest(cached)+'\n');return mesh
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
            pod_components=list(executor.map(context_component,[('pod',i,g) for i,g in enumerate(splitter.components(pod_csg.read_text()))]))
        pod=trimesh.util.concatenate(pod_components);pod.export(references/'current-pod.stl')
        print('Checking installed interfaces and release...',flush=True)
        hardware_csg=references/'bought-hardware.csg'
        run=subprocess.run(['openscad','-o',str(hardware_csg),str(ROOT/'hardware/assemblies/dock/dock-bench-hardware.scad')],capture_output=True,text=True,timeout=30)
        assert run.returncode==0 and 'WARNING:' not in run.stderr and 'ERROR:' not in run.stderr,run.stderr
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
            bought_components=list(executor.map(context_component,[('bought',i,g) for i,g in enumerate(splitter.components(hardware_csg.read_text()))]))
        report['bought_solid_components']=len(bought_components)
        assert len(bought_components)==sum(q for _,q in hardware)+sum(q for name,q in hardware if 'bolt' in name)
        hardware=trimesh.util.concatenate(bought_components);hardware.export(references/'bought-hardware.stl')
        post=trimesh.creation.cylinder(radius=60,height=280,sections=96);post.apply_translation([-450,0,100]);post.export(references/'post.stl')
        line_meshes=[]
        for a in [45,135,225,315]:
            line=trimesh.creation.cylinder(radius=.75,height=280,sections=24);line.apply_translation([104*math.cos(math.radians(a)),104*math.sin(math.radians(a)),143]);line_meshes.append(line)
        lines=trimesh.util.concatenate(line_meshes);lines.export(references/'nominal-lines.stl')
        parts=instances(models)
        placed=[]
        for p in parts:
            mid=next(mid for mid in IDS if models[mid]['output']==Path(p['file']).name)
            m=meshes[mid].copy();m.apply_transform(p['matrix']);placed.append((p['label'],m))
        collisions=[]
        def clear(a,b,label):
            volume=0 if np.any(a.bounds[1]<b.bounds[0]-.001) or np.any(b.bounds[1]<a.bounds[0]-.001) else helpers.overlap(a,b);report['checks']+=1
            if volume>=.015:collisions.append((label,round(volume,4)))
        for i,(label,mesh) in enumerate(placed):
            for other,other_mesh in placed[i+1:]:clear(mesh,other_mesh,label+'/'+other)
            for j,component in enumerate(bought_components):clear(mesh,component,label+f'/bought-{j}')
            clear(mesh,post,label+'/post');clear(mesh,lines,label+'/nominal-lines')
            for j,component in enumerate(pod_components):clear(mesh,component,label+f'/pod-{j}')
        fork=meshes['dock-latch-fork'];stud=meshes['dock-pod-stud']
        for travel in [0,5,10,20,30,40]:
            moving=helpers.translated(fork,[-travel,0,0])
            for label,m in placed:
                if label!='dock-latch-fork':clear(moving,m,f'fork-{travel}/'+label)
        opened=helpers.translated(fork,[-40,0,0])
        fixed=[m for label,m in placed if label not in ['dock-pod-bridge','dock-pod-stud'] and not label.startswith('shoe-') and label!='dock-latch-fork']
        for down in [1,5,10,20,40,80,120,170]:
            moved=helpers.translated(stud,[0,0,-down]);clear(moved,opened,f'released-stud-down-{down}')
            for j,m in enumerate(fixed):clear(moved,m,f'released-stud-down-{down}/fixed-{j}')
        assert not collisions,('Nominal interference',collisions)
        closed_collision=helpers.overlap(fork,helpers.translated(stud,[0,0,-10]));assert closed_collision>1
        # Independent uncut conical wall control crosses the synthetic vertical line.
        probe=work/'uncut-guide.scad';probe.write_text('difference(){cylinder(h=55,d1=283,d2=68,$fn=128);translate([0,0,-.02])cylinder(h=55.04,d1=275,d2=60,$fn=128);}')
        uncut=helpers.export(probe,work/'models/controls/uncut-guide.stl');uncut.apply_translation([0,0,65])
        line_collision=helpers.overlap(uncut,lines);assert line_collision>1
        probe.unlink()
        report['negative_controls']=dict(closed_fork_descent_mm3=round(closed_collision,3),uncut_guide_line_collision_mm3=round(line_collision,3))
        context=[dict(file='models/reference/bought-hardware.stl',matrix=np.eye(4).tolist(),color=[.66,.70,.73],bomPartId='dock-bench-hardware'),
                 dict(file='models/reference/current-pod.stl',matrix=np.eye(4).tolist(),color=[.65]*3,fit=True),
                 dict(file='models/reference/post.stl',matrix=np.eye(4).tolist(),color=[.63,.53,.39],bomPartId='corner-post-treated-timber'),
                 dict(file='models/reference/nominal-lines.stl',matrix=np.eye(4).tolist(),color=[.12,.14,.15],bomPartId='dyneema-positioning-line')]
        print('Rendering actual-mesh figures...',flush=True)
        renderer=load_module('dock_renderer',work/'source/render_figures.py')
        renderer.render('covered',parts+context,direction=(.65,-1,.7),size=(1600,1100))
        renderer.render('open',[p for p in parts if not p['label'].startswith('roof-')]+context,direction=(.65,-1,.7),size=(1600,1100))
        exploded=[]
        for p in parts+context:
            matrix=np.asarray(p['matrix']).copy();label=p.get('label','context')
            if label.startswith('roof'):matrix[2,3]+=95
            if label.startswith('guide'):matrix[2,3]-=65
            if label.startswith('shoe'):matrix[2,3]-=25
            if label=='dock-latch-fork':matrix[0,3]-=50
            exploded.append({**p,'matrix':matrix.tolist()})
        renderer.render('exploded',exploded,direction=(.65,-1,.7),size=(1600,1100))
        def bought_items(indices):
            return [dict(file=f'models/reference/bought-components/{i}.stl',matrix=np.eye(4).tolist(),color=[.66,.70,.73],bomPartId='dock-bench-hardware') for i in indices]
        arm=[p for p in parts if 'arm-' in p['label'] or p['label'].startswith('rear-pad') or p['label']=='dock-locator-carrier']
        renderer.render('arm',arm+bought_items(range(20))+[context[2]],direction=(.6,-1,.7),size=(1500,950))
        cut=trimesh.creation.box(extents=[240,200,300]);cut.apply_translation([0,100,150])
        section=trimesh.boolean.intersection([meshes['dock-locator-carrier'],cut],engine='manifold')
        assert section.is_watertight and section.is_winding_consistent and section.volume>0
        section.export(references/'locator-section.stl')
        latch=[p for p in parts if p['label'] in ['dock-latch-fork','dock-pod-stud']]
        latch += [dict(file='models/reference/locator-section.stl',matrix=np.eye(4).tolist(),color=[.12,.14,.15],bomPartId='dock-nest')]
        renderer.render('latch',latch+bought_items(range(60,65)),direction=(.6,-1,.55),size=(1500,950))
        renderer.render('pod',[p for p in parts if p['label'].startswith(('dock-pod','shoe-'))]+[context[1]]+bought_items(range(60,105)),direction=(.6,-1,.7),size=(1500,950))
        roof=[p for p in parts if p['label'].startswith('roof') or p['label'] in ['dock-locator-carrier','dock-arm-extension']]
        renderer.render('roof',roof+bought_items([*range(20,40),*range(105,125)]),direction=(.6,-1,.7),size=(1500,950))
        inventory=[];anchors={}
        for i,mid in enumerate(IDS):
            mesh=trimesh.load_mesh(work/report['print_parts'][mid]['file']);matrix=pose((i%4)*260,(i//4)*260)
            anchors[str(i+1)]=(mesh.bounds.mean(axis=0)+matrix[:3,3]).tolist()
            inventory.append(dict(file=report['print_parts'][mid]['file'],matrix=matrix.tolist(),color=[.12,.14,.15]))
        renderer.render('inventory',inventory,direction=(.3,-.8,1),size=(1500,1100),anchors=anchors)
        (work/'figure-manifest.json').write_text(json.dumps(renderer.manifest,indent=2)+'\n')
        report['mesh_sha256']={p.relative_to(work).as_posix():digest(p) for p in sorted(work.rglob('*.stl'))}
        (work/'geometry-report.json').write_text(json.dumps(report,indent=2)+'\n');booklet(work,report)
        (work/'README.txt').write_text('DOCK-IF-01 r0.1.0: supported dummy bench only. See PDF, source docs, geometry-report.json. Print models/print, not context. No physical acceptance.\n')
        (work/'manifest.json').write_text(json.dumps(dict(files_sha256={p.relative_to(work).as_posix():digest(p) for p in sorted(work.rglob('*')) if p.is_file()}),indent=2)+'\n')
        with zipfile.ZipFile(out/(ARTIFACT+'-STL-pack.zip'),'w',zipfile.ZIP_DEFLATED) as pack:
            for path in sorted(work.rglob('*')):
                if path.is_file():pack.write(path,ARTIFACT+'-STL-pack/'+path.relative_to(work).as_posix())
        for name in [PDF,'geometry-report.json','figure-manifest.json','manifest.json']:shutil.copy2(work/name,out/name)
        shutil.copytree(work/'figures',out/'figures',dirs_exist_ok=True)
        print(f'Dock: {report["checks"]} nominal checks; PDF/STL/source pack: {out}',flush=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',type=Path,default=ROOT/'hardware/generated/dock-booklet')
    build(parser.parse_args().output.resolve())
