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
REVISION = '0.3.0'
PAGES = 10
ROOF_LIFT_MM = 60
ROOF_INWARD_MM = 100
LOWER_OUTWARD_MM = 110
LOWER_DOWN_MM = 100
SKIN_PROBES = [(2,[20,20]),(2,[80,20]),(2,[120,20]),(2,[20,120]),(2,[100,130]),(0,[50,180]),(1,[50,180])]


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


def section_crossings(mesh, axis, at):
    """Intersect an axis line with written mesh triangles without optional ray libraries."""
    other=[i for i in range(3) if i!=axis]
    triangles=mesh.triangles
    a=triangles[:,0,other];b=triangles[:,1,other]-a;c=triangles[:,2,other]-a
    point=np.asarray(at)-a
    denominator=b[:,0]*c[:,1]-b[:,1]*c[:,0]
    valid=np.abs(denominator)>1e-9
    v=(point[valid,0]*c[valid,1]-point[valid,1]*c[valid,0])/denominator[valid]
    w=(b[valid,0]*point[valid,1]-b[valid,1]*point[valid,0])/denominator[valid]
    hit=(v>=-1e-6)&(w>=-1e-6)&(v+w<=1+1e-6)
    coordinates=triangles[valid,:,axis]
    intersections=coordinates[:,0]+v*(coordinates[:,1]-coordinates[:,0])+w*(coordinates[:,2]-coordinates[:,0])
    return np.unique(np.round(intersections[hit],4))


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
        add('dock-lower-rear-panel' if a==180 else 'dock-lower-panel',pose(angle=a),f'lower-{a}')
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
        c.setFont('ARBI',9);c.drawString(44,height-77,f'ARBI / DOCK-IF-01 / r{REVISION} / 15 OCTOBER 2026')
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
        c.drawRightString(width-44,47,f'{number} / {PAGES}');c.showPage()
    page(1,'Dock bench kit',[
        'One non-powered corner, shared round-120 post study (60 mm radius). The actual corner ID, post survey and printer remain unmeasured. This nominal package does not authorize a suspended pod, automated capture or site installation.',
        'The arm projects the capture axis 390 mm from the nominal post face. Four guide quadrants form a 275 mm approach mouth and 60 mm throat; a 26 mm final bore receives the 24 mm mushroom head. The fork is manually opened 40 mm toward the post.',
        'Actual current compact-pod meshes are shown as context. The stud bridge clamps the fixed spider; it does not load the rain hood. Keep the dummy supported throughout assembly, insertion, release and testing.'], 'covered')
    printed='; '.join(f'[{i+1}] {q} {mid.removeprefix("dock-").replace("-"," ")}' for i,(mid,_,q) in enumerate([item for items in KIT.values() for item in items]))
    page(2,'Printed inventory and files',[
        printed+'. One example per model is numbered below.',
        'Use <b>models/print</b> for one-part printing, <b>models/arbi</b> for installed coordinates, and <b>models/reference</b> only for context. Never print the camera-pod context STL as a dock component. Quantities describe one bench dock; the kit does not duplicate the pod BOM.',
        'Each print bounds fits the nominal 256 mm cube with 5 mm XY edge reserve. This excludes supports, brim, purge and printer exclusions. Record filament/lot, drying, orientation, walls/infill, supports, printer and slice settings; inspect the slice before fabrication.',
        'Root lies on its wide web face; roof prints mounting-seat-down with rim/crown supports reviewed. Lower panels print tray-face-down, rotated 45 degrees for the study bed. Print stud head-down with flange supports. Review every slice, pocket, taper and bore; these are not support-free poses.'], 'inventory')
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
        'The revised 11 mm head has a flat underside at Z149.8, 0.2 mm above the fork top. Unloading permits manual sliding; downward load engages the flat shoulder after the gap closes. This nominal contact geometry does not establish release force or retention strength.',
        'For supported manual insertion: retract fork 40 mm, raise the stud into the final bore until its head reaches the upper stop, then close the fork while retaining external support. Release only after supporting/unloading the dummy; retract 40 mm and lower it.',
        'The illustration sections the actual locator at Y=0 to expose the head stop, fork and axial bolt; print the whole carrier STL. Do not expect automatic push-in capture. Spring return, anti-backdrive, release force under preload, sensors and recovery remain physical development tasks.'], 'latch')
    page(6,'Pod bridge and through-bolt',[
        'Use the current 230 mm spider with 22 mm arms and 7 mm plate. Place four upper feet at radius 90 mm on diagonals 45/135/225/315 degrees. Fit one lower shoe per arm, with cheeks around the width; eight M3 x 30 clamps use two washers and locking nuts each.',
        'Verify the nominal 0.5 mm shoe-cheek gap to the upper foot so preload reaches the spider. Shoes constrain across the arm; radial retention depends on clamping friction. Mark and test for slip, plate crushing, layer separation and creep. Do not represent this as a positive radial structural lock.',
        'Attach the stud flange to the bridge at Z=75 mm with one M4 x 100 axial bolt, two washers and locking nut. Verify the underside bolt tip clears the actual hood and electronics; never carry capture load through the hood.',
        f'Added solid CAD print volume is {report["pod_attachment_volume_cm3"]:.2f} cm3 before metal hardware. Complete-pod mass must include every attachment and remain under 170 g. Weigh actual sliced parts and complete pod; the kit is restricted to supported dummy testing while that budget and joint strength remain unresolved.'], 'pod')
    page(7,'Rounded shelter and line slots',[
        'Place four 49 mm roof spacers on locator flange at (+/-40,+/-40). Fit four roof quadrants rotated 0/90/180/270 degrees over them. Four M4 x 100 bolts pass through roof boss, spacer, locator flange and arm; put lower washers in the platform recesses at Z124-125 and locking nuts at Z120-124.',
        'Join seams with four M3 x 16 bolts, eight washers and four nuts. The warm-white crown has a 300 mm rounded-square plan, 40 mm outer corners and skirt at Z175 mm; the core stays charcoal. Roof and guide have 18 mm open radial line slots. Roof M4 heads sit in 11 mm wells on the existing Z215 mm washer floors.',
        'Remove all lower panels, then extract their upper washers/nuts inward; all dedicated hardware must be clear. For roof service, support dummy and carrier, remove roof-stack and seam hardware, lift one quarter 60 mm, then slide inward 100 mm along its diagonal. Reverse to install. Actual lines and hand access still need review.',
        'Seams, exposed corridors and lack of seals do not establish rain protection or an IP rating. Bench-check runoff, accumulation, splash and optical access without live electronics.'], 'roof')
    page(8,'Charcoal lower enclosure',[
        'Fit three common lower panels at 0/90/270 degrees and the rear service-window panel at 180 degrees. The conical bowl surrounds the upper guide and arm; it does not retain the pod. Its open lower lip and diagonal cable corridors must stay clear.',
        'Use eight dedicated M3 x 25 socket-head bolts upward through lower washers and tray, into roof bosses. Insert upper washers and DIN 985 M3 nuts from the inward side before panels obscure access. Boss floors contact the Z174 tray; the rim stays at Z175, leaving a 1 mm shadow gap.',
        'Remove only the supported moving panel\'s two bolts and lower washers; other hardware stays. Common panels move outward 110 mm then down 100 mm. Rear moves outward 60 mm, down 20 mm, onward to 110 mm outward, then to 100 mm total down. Reverse to install. Remove upper washers/nuts only after all panels clear, before roof service.',
        'The section below cuts the actual panel and roof to expose one joint; print whole registered parts. Check received hardware, pocket access, rear window, supports and line sweep. Cladding adds station dead load and wind area; it provides no structural rating, seal or installed-service authority.'], 'lower')
    page(9,'Bench checks and acceptance',[
        'Use bench-test-plan.md DT01-DT12 and acceptance-record.md. Record source hashes, configured post, printer/process, received hardware, dummy mass, clearances and measured geometry. Keep real site details out of public records.',
        'Check repeated supported insertion/release, offset/tilt, fork travel and false seating, force/displacement, spring removal, contamination, wear and manual recovery. Review force limits and fixture restraint before applying loads; this package invents no proof factor or operating tension.',
        'Separate physical seating from fork engagement and released-clear observations. Select and test switch targets/circuit diagnostics before feeding a controller. A command receipt, HOME or software Parked state does not establish retention.',
        'Accept all-line restraint through driver disable and total/partial power loss separately (LS16-LS18). A captured pod does not prove the four lines remain above the accessible zone.'], 'open')
    page(10,'Evidence and next development',[
        f'{report["checks"]} nominal mesh checks include connected print parts, bed poses, full-pod release, crown/bowl skin, local tools, captive hardware insertion and sampled panel/roof service against four lines. Controls reject blocked capture, line paths and wrong lower-panel removal. These are geometric checks, not continuous-flight or physical acceptance.',
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
    report=dict(revision=REVISION,status='concept-unvalidated',configuration='DOCK-IF-01 / non-powered round 120 / supported dummy bench',
        fabrication_ids=IDS,printed_model_ids=IDS,openscad='2021.01',checks=0,printer_envelope_mm=[256]*3,bed_edge_reserve_mm=5,print_parts={},meshes={})
    style_directory=ROOT/'docs/assets/dock'
    style_sources=[p for p in style_directory.glob('*') if p.is_file()]
    for reference in json.loads((style_directory/'generation.json').read_text())['references']:
        path=(style_directory/reference['path']).resolve()
        assert path.is_relative_to(ROOT) and path.is_file(),('Missing style reference',path)
        style_sources.append(path)
    with tempfile.TemporaryDirectory(prefix='arbi-dock-build-',dir='/tmp') as temporary:
        work=Path(temporary)
        sources=sorted(set([ROOT/'hardware/models.json',ROOT/'bom/catalog/parts.json',ROOT/'bom/assemblies/assemblies.json',ROOT/'bom/catalog/fabrication.json',
            *ROOT.glob('hardware/lib/*.scad'),*ROOT.glob('hardware/assemblies/camera-pod/*.scad'),*ROOT.glob('hardware/assemblies/dock/*.scad'),
            *(p for p in (ROOT/'hardware/vendor').rglob('*') if p.is_file()),
            *ROOT.glob('docs/assemblies/dock/**/*.md'),*style_sources,*ROOT.glob('scripts/dock-booklet/*.*'),ROOT/'scripts/corner-support/build.py',
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
            if mid=='dock-pod-stud':matrix=trimesh.transformations.rotation_matrix(math.pi,[1,0,0])
            if mid in ['dock-lower-panel','dock-lower-rear-panel']:
                matrix=trimesh.transformations.rotation_matrix(math.pi,[1,0,0])@trimesh.transformations.rotation_matrix(math.pi/4,[0,0,1])
            printed=mesh.copy();printed.apply_transform(matrix);shift=-printed.bounds[0];matrix[:3,3]=shift;printed.apply_translation(shift)
            assert np.all(printed.extents[:2]<=246.002) and printed.extents[2]<=256.002,(mid,printed.extents)
            path=work/'models/print'/models[mid]['output'];path.parent.mkdir(exist_ok=True);printed.export(path)
            report['print_parts'][mid]=dict(file=path.relative_to(work).as_posix(),installed_to_print=matrix.tolist(),extents_mm=printed.extents.round(3).tolist(),bed_fits=True)
            report['meshes'][mid]=dict(volume_cm3=round(mesh.volume/1000,6),bounds_mm=mesh.bounds.round(3).tolist(),bodies=1)
            report['checks']+=4
        roof=meshes['dock-roof-quarter']
        assert np.allclose(roof.bounds,[[0,0,174],[150,150,220]],atol=.002)
        skin=[]
        for axis,at in SKIN_PROBES:
            crossings=section_crossings(roof,axis,at)
            assert len(crossings)==2,(axis,at,crossings)
            thickness=float(np.ptp(crossings))
            assert 2.6<=thickness<=3.3,(axis,at,thickness)
            skin.append(dict(axis=axis,at_mm=at,crossings_mm=crossings.tolist(),thickness_mm=round(thickness,4)))
            report['checks']+=1
        report['roof_skin_sections']=skin
        report['roof_shell_volume_cm3']=round(roof.volume/1000*4,3)
        lower=meshes['dock-lower-panel'];rear=meshes['dock-lower-rear-panel']
        lower_sections=[];slope=(283-140)/2/66.02
        for z in [115,135,160]:
            crossings=section_crossings(lower,0,[0,z])
            assert len(crossings)==2,(z,crossings)
            radial=float(np.ptp(crossings));normal=radial/math.sqrt(1+slope*slope)
            assert 2.75<=normal<=2.85,(z,normal)
            lower_sections.append(dict(z_mm=z,crossings_mm=crossings.tolist(),radial_mm=round(radial,4),normal_mm=round(normal,4)))
            report['checks']+=1
        tray=section_crossings(lower,2,[100,0]);tray=tray[tray>=170]
        assert np.allclose(tray,[171,174],atol=.002),tray
        assert len(section_crossings(rear,0,[0,135]))==0 and len(section_crossings(rear,2,[100,0]))==0
        report['lower_shell_sections']=dict(cone_slope=slope,wall=lower_sections,tray_crossings_mm=tray.tolist(),tray_thickness_mm=3,
            scope='sampled normal wall and tray thickness; print/process acceptance pending')
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
        assert len(bought_components)==165,'Keep dedicated lower hardware after the original 125 solids.'
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
        lower_instances=[m for label,m in placed if label.startswith('lower-')]
        lower_volume=sum(m.volume for m in lower_instances)
        report['lower_shell']=dict(volume_cm3=round(lower_volume/1000,6),
            center_of_mass_mm=(sum(m.volume*m.center_mass for m in lower_instances)/lower_volume).round(6).tolist(),
            models=[dict(model_id='dock-lower-rear-panel' if p['label']=='lower-180' else 'dock-lower-panel',
                file=p['file'],label=p['label'],installed_matrix=p['matrix']) for p in parts if p['label'].startswith('lower-')],
            scope='printed shells only; no bought hardware, supports, slice or physical mass')
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
        bearings=[]
        for at in [[-5,10],[0,10],[-5,-10],[0,-10]]:
            head_section=section_crossings(stud,2,at);fork_section=section_crossings(fork,2,at)
            head_section=head_section[head_section>100] # Exclude the separate bridge flange at Z75-79.
            assert len(head_section)==2 and np.allclose(head_section,[149.8,160.8],atol=.002),(at,head_section)
            assert len(fork_section)==2 and abs(fork_section[-1]-149.6)<.002,(at,fork_section)
            bearings.append(dict(at_mm=at,head_lower_z_mm=float(head_section[0]),fork_top_z_mm=float(fork_section[-1])))
            report['checks']+=2
        contact_volume=helpers.overlap(fork,helpers.translated(stud,[0,0,-.2]));assert contact_volume<.015
        bearing_blocked=helpers.overlap(fork,helpers.translated(stud,[0,0,-1]));assert bearing_blocked>1
        stem_section=section_crossings(stud,0,[0,149])
        assert np.allclose(stem_section,[-7,-2.25,2.25,7],atol=.002),stem_section
        report['retaining_shoulder']=dict(head_lower_z_mm=149.8,head_upper_z_mm=160.8,head_height_mm=11,
            fork_top_z_mm=149.6,unloaded_gap_mm=.2,sections=bearings,stem_section_at_z149_mm=stem_section.tolist(),
            contact_descent_mm=.2,contact_overlap_mm3=round(contact_volume,4),
            blocked_descent_mm=1,blocked_overlap_mm3=round(bearing_blocked,4),scope='nominal planar contact; no load or release qualification')
        for travel in [0,5,10,20,30,40]:
            moving=helpers.translated(fork,[-travel,0,0])
            for label,m in placed:
                if label!='dock-latch-fork':clear(moving,m,f'fork-{travel}/'+label)
        opened=helpers.translated(fork,[-40,0,0])
        pod_attached=[m for label,m in placed if label in ['dock-pod-bridge','dock-pod-stud'] or label.startswith('shoe-')]
        fixed=[m for label,m in placed if label not in ['dock-pod-bridge','dock-pod-stud'] and not label.startswith('shoe-') and label!='dock-latch-fork']
        moving_pod=trimesh.util.concatenate([*pod_components,*pod_attached,*bought_components[60:105]])
        release_fixed=[*fixed,*bought_components[:60],*bought_components[105:],post,opened]
        for down in [1,5,10,20,40,80,120,170]:
            moved=helpers.translated(stud,[0,0,-down]);clear(moved,opened,f'released-stud-down-{down}')
            for j,m in enumerate(fixed):clear(moved,m,f'released-stud-down-{down}/fixed-{j}')
            moved_pod=helpers.translated(moving_pod,[0,0,-down])
            for j,m in enumerate(release_fixed):clear(moved_pod,m,f'released-full-pod-down-{down}/fixed-{j}')
        report['full_pod_release_mm']=[1,5,10,20,40,80,120,170]
        # Full-height probes prevent a lifted roof from escaping a short line
        # model before it has actually exited the outward-open slot.
        service_lines=[]
        for a in [45,135,225,315]:
            line=trimesh.creation.cylinder(radius=.75,height=1000,sections=24)
            line.apply_translation([104*math.cos(math.radians(a)),104*math.sin(math.radians(a)),300])
            service_lines.append(line)
        long_lines=trimesh.util.concatenate(service_lines)
        long_lines.export(references/'roof-service-lines.stl')
        lower_path=[(outward,0) for outward in range(0,LOWER_OUTWARD_MM+1,10)]
        lower_path += [(LOWER_OUTWARD_MM,down) for down in range(10,LOWER_DOWN_MM+1,10)]
        rear_path=[(outward,0) for outward in range(0,61,10)]+[(60,down) for down in [5,10,15,20]]
        rear_path += [(outward,20) for outward in range(70,111,10)]+[(110,down) for down in range(30,101,10)]
        lower_paths={str(a):rear_path if a==180 else lower_path for a in [0,90,180,270]}
        captive_indices=[index for base in range(125,165,5) for index in [base+3,base+4]]
        lower_retained={}
        for panel_index,a in enumerate([0,90,180,270]):
            label=f'lower-{a}';installed=next(m for name,m in placed if name==label)
            base=125+panel_index*10
            removed=[base,base+1,base+2,base+5,base+6,base+7]
            retained=[i for i in range(125,165) if i not in removed];lower_retained[str(a)]=retained
            obstacles=[m for name,m in placed if name!=label]+bought_components[:125]+[bought_components[i] for i in retained]+pod_components+[post,long_lines]
            radians=math.radians(a)
            for outward,down in lower_paths[str(a)]:
                moving=helpers.translated(installed,[outward*math.cos(radians),outward*math.sin(radians),-down])
                for j,obstacle in enumerate(obstacles):clear(moving,obstacle,f'{label}/service-{outward}-{down}/fixed-{j}')
        report['lower_service']=dict(outward_mm=LOWER_OUTWARD_MM,down_mm=LOWER_DOWN_MM,
            outward_samples_mm=list(range(0,LOWER_OUTWARD_MM+1,10)),down_samples_mm=list(range(10,LOWER_DOWN_MM+1,10)),
            paths_by_angle=lower_paths,
            quarters=4,line_diameter_mm=1.5,line_bounds_z_mm=[-200,800],
            removed_hardware='only moving panel\'s two bolts and two lower washers; all other hardware stays',
            retained_component_indices_by_angle=lower_retained,
            scope='sampled staged cardinal withdrawal/lowering; all other panels remain; supported unloaded dummy')
        # Captive hardware enters from the center side before lower panels and
        # their bolts are fitted. Existing capture/roof hardware stays in place.
        insertion_fixed=[m for label,m in placed if not label.startswith('lower-')]+bought_components[:125]+pod_components+[post,long_lines]
        insertion_indices=[]
        for i,a in enumerate([0,90,180,270]):
            radians=math.radians(a)
            for side in [0,1]:
                base=125+i*10+side*5
                for index in [base+3,base+4]:
                    insertion_indices.append(index)
                    for inward in [30,20,10,5,2,1,0]:
                        moving=helpers.translated(bought_components[index],[-inward*math.cos(radians),-inward*math.sin(radians),0])
                        for j,obstacle in enumerate(insertion_fixed):clear(moving,obstacle,f'lower-hardware-{index}/insert-{inward}/fixed-{j}')
        report['lower_hardware_insertion']=dict(component_indices=insertion_indices,samples_from_seat_mm=[30,20,10,5,2,1,0],
            direction='radially outward from inward side; lower panels and dedicated bolts removed',
            scope='actual nominal upper washer/nut solids; hand grip and received hardware unvalidated')
        service_hardware=[*bought_components[:20],*bought_components[40:105]]
        for a in [0,90,180,270]:
            label=f'roof-{a}'
            installed=next(m for name,m in placed if name==label)
            obstacles=[m for name,m in placed if name!=label and not name.startswith('lower-')]+service_hardware+pod_components+[post,long_lines]
            path=[(lift,0) for lift in [0,5,10,20,40,ROOF_LIFT_MM]]
            path += [(ROOF_LIFT_MM,inward) for inward in range(10,ROOF_INWARD_MM+1,10)]
            angle=math.radians(a+45)
            for lift,inward in path:
                moving=helpers.translated(installed,[-inward*math.cos(angle),-inward*math.sin(angle),lift])
                for j,obstacle in enumerate(obstacles):clear(moving,obstacle,f'{label}/service-{lift}-{inward}/fixed-{j}')
        report['roof_service']=dict(lift_mm=ROOF_LIFT_MM,inward_mm=ROOF_INWARD_MM,
            line_diameter_mm=1.5,line_bounds_z_mm=[-200,800],quarters=4,
            vertical_samples_mm=[0,5,10,20,40,ROOF_LIFT_MM],inward_samples_mm=list(range(10,ROOF_INWARD_MM+1,10)),
            removed_hardware='all lower panels/dedicated hardware, four roof/carrier/arm bolts and four seam bolts with washers/nuts',
            scope='sampled nominal rigid geometry; vertical lines; independently supported dummy and carrier')
        # Local socket envelopes at crown wells and under the open skirt.
        # These do not model a human hand or the complete approach of a tool.
        tool_probes=[]
        for x in [-40,40]:
            for y in [-40,40]:
                tool=trimesh.creation.cylinder(radius=5,height=80,sections=32)
                tool.apply_translation([x,y,259.02]);tool_probes.append(tool)
        for a in [0,90,180,270]:
            for x in [15.52,-15.92]:
                tool=helpers.cylinder(10,20,[x,80,203]);tool.apply_transform(pose(angle=a));tool_probes.append(tool)
        for i,tool in enumerate(tool_probes):
            for label,m in placed:clear(tool,m,f'roof-tool-{i}/'+label)
            clear(tool,long_lines,f'roof-tool-{i}/lines')
        report['roof_tool_envelopes']=dict(crown_socket_diameter_mm=10,crown_socket_length_mm=80,
            seam_socket_diameter_mm=10,seam_socket_length_mm=20,scope='local socket clearance; full tool/hand access unvalidated')
        for a in [0,90,180,270]:
            for y in [-60,60]:
                tool=trimesh.creation.cylinder(radius=2.5,height=80,sections=32)
                tool.apply_translation([141,y,126.98]);tool.apply_transform(pose(angle=a))
                for label,m in placed:clear(tool,m,f'lower-driver-{a}-{y}/'+label)
                for j,m in enumerate(bought_components):clear(tool,m,f'lower-driver-{a}-{y}/bought-{j}')
                clear(tool,long_lines,f'lower-driver-{a}-{y}/lines')
        report['lower_tool_envelopes']=dict(driver_diameter_mm=5,driver_length_mm=80,top_z_mm=166.98,
            scope='local axial driver clearance below socket heads; complete tool/hand access unvalidated')
        assert not collisions,('Nominal interference',collisions)
        closed_collision=helpers.overlap(fork,helpers.translated(stud,[0,0,-10]));assert closed_collision>1
        # Independent uncut conical wall control crosses the synthetic vertical line.
        probe=work/'uncut-guide.scad';probe.write_text('difference(){cylinder(h=55,d1=283,d2=68,$fn=128);translate([0,0,-.02])cylinder(h=55.04,d1=275,d2=60,$fn=128);}')
        uncut=helpers.export(probe,work/'models/controls/uncut-guide.stl');uncut.apply_translation([0,0,65])
        line_collision=helpers.overlap(uncut,lines);assert line_collision>1
        probe.unlink()
        closed_roof_source=work/'closed-roof-slot.scad'
        closed_roof_source.write_text('include <'+str(ROOT/'hardware/lib/dock.scad')+'>\ndock_roof_quarter(open_lines=false);\n')
        closed_roof=helpers.export(closed_roof_source,work/'models/controls/closed-roof-slot.stl')
        moved_closed_roof=helpers.translated(closed_roof,[-50/math.sqrt(2),-50/math.sqrt(2),ROOF_LIFT_MM])
        closed_roof_collision=helpers.overlap(moved_closed_roof,long_lines);assert closed_roof_collision>1
        closed_roof_source.unlink()
        def lower_control(name,call):
            source=work/(name+'.scad');source.write_text('include <'+str(ROOT/'hardware/lib/dock.scad')+'>\n'+call+'\n')
            result=helpers.export(source,work/'models/controls'/(name+'.stl'));source.unlink();return result
        closed_lower=lower_control('closed-lower-lines','dock_lower_panel(open_lines=false);')
        closed_lower_collision=helpers.overlap(closed_lower,long_lines);assert closed_lower_collision>1
        closed_rear=lower_control('closed-lower-rear-window','dock_lower_panel(rear=true,open_arm=false);')
        closed_rear.apply_transform(pose(angle=180))
        arm_collision=sum(helpers.overlap(closed_rear,m) for label,m in placed if 'arm-' in label or label=='dock-locator-carrier')
        assert arm_collision>1
        downward_lower=helpers.translated(lower,[0,0,-10])
        wrong_removal=sum(helpers.overlap(downward_lower,m) for label,m in placed if label.startswith('guide-'))
        assert wrong_removal>1
        straight_rear=next(m.copy() for label,m in placed if label=='lower-180');straight_rear.apply_translation([-90,0,0])
        straight_rear.export(work/'models/controls/rear-straight-withdrawal.stl')
        rear_lap_collision=sum(helpers.overlap(straight_rear,m) for m in bought_components[10:20]);assert rear_lap_collision>1
        # Reproduce the incomplete rectangular washer entry that leaves the
        # far arc blocked, using the exact roof with its circular pocket omitted.
        control_source=(ROOT/'hardware/lib/dock.scad').read_text()
        washer_cut='        dk_cyl(7.4,1.2,[0,0,185]);'
        assert control_source.count(washer_cut)==1,'Washer-pocket control must remove exactly one helper cut.'
        control_source=control_source.replace(washer_cut,'')
        for include in ['corner-head.scad','camera-pod.scad']:
            control_source=control_source.replace('include <'+include+'>','include <'+str(ROOT/'hardware/lib'/include)+'>')
        control_file=work/'incomplete-lower-washer-pocket.scad';control_file.write_text(control_source+'\ndock_roof_quarter();\n')
        blocked_washer=helpers.export(control_file,work/'models/controls/incomplete-lower-washer-pocket.stl');control_file.unlink()
        washer_collision=helpers.overlap(blocked_washer,bought_components[133]);assert washer_collision>1
        report['negative_controls']=dict(closed_fork_descent_mm3=round(closed_collision,3),uncut_guide_line_collision_mm3=round(line_collision,3),
            closed_roof_service_line_collision_mm3=round(closed_roof_collision,3),
            closed_lower_line_collision_mm3=round(closed_lower_collision,3),closed_rear_arm_collision_mm3=round(arm_collision,3),
            lower_down_before_out_collision_mm3=round(wrong_removal,3),incomplete_washer_pocket_collision_mm3=round(washer_collision,3))
        report['negative_controls']['rear_straight_withdrawal_lap_collision_mm3']=round(rear_lap_collision,3)
        context=[dict(file='models/reference/bought-hardware.stl',matrix=np.eye(4).tolist(),color=[.66,.70,.73],bomPartId='dock-bench-hardware'),
                 dict(file='models/reference/current-pod.stl',matrix=np.eye(4).tolist(),color=[.65]*3,fit=True),
                 dict(file='models/reference/post.stl',matrix=np.eye(4).tolist(),color=[.63,.53,.39],bomPartId='corner-post-treated-timber'),
                 dict(file='models/reference/nominal-lines.stl',matrix=np.eye(4).tolist(),color=[.12,.14,.15],bomPartId='dyneema-positioning-line')]
        print('Rendering actual-mesh figures...',flush=True)
        renderer=load_module('dock_renderer',work/'source/render_figures.py')
        renderer.render('covered',parts+context,direction=(.65,-1,.7),size=(1600,1100))
        renderer.render('open',[p for p in parts if not p['label'].startswith(('roof-','lower-'))]+context,direction=(.65,-1,.7),size=(1600,1100))
        exploded=[]
        for p in parts+context:
            matrix=np.asarray(p['matrix']).copy();label=p.get('label','context')
            if label.startswith('roof'):matrix[2,3]+=95
            if label.startswith('guide'):matrix[2,3]-=65
            if label.startswith('lower'):
                angle=math.radians(int(label.split('-')[1]));matrix[:3,3]+=[55*math.cos(angle),55*math.sin(angle),-25]
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
        lower_cut=trimesh.creation.box(extents=[220,200,250]);lower_cut.apply_translation([100,160,140])
        lower_section=trimesh.boolean.intersection([meshes['dock-lower-panel'],lower_cut],engine='manifold')
        roof_section=trimesh.boolean.intersection([meshes['dock-roof-quarter'],lower_cut],engine='manifold')
        for name,m in [('lower-panel-section',lower_section),('lower-roof-section',roof_section)]:
            assert m.is_watertight and m.is_winding_consistent and m.volume>0
            m.export(references/(name+'.stl'))
        renderer.render('lower',[
            dict(file='models/reference/lower-panel-section.stl',matrix=np.eye(4).tolist(),color=[.12,.14,.15],bomPartId='dock-lower-enclosure'),
            dict(file='models/reference/lower-roof-section.stl',matrix=np.eye(4).tolist(),color=[.94,.94,.92],bomPartId='dock-weather-hood'),
            *bought_items(range(130,135))],direction=(.6,-1,.45),size=(1500,950))
        inventory=[];anchors={}
        for i,mid in enumerate(IDS):
            mesh=trimesh.load_mesh(work/report['print_parts'][mid]['file']);matrix=pose((i%4)*260,(i//4)*260)
            anchors[str(i+1)]=(mesh.bounds.mean(axis=0)+matrix[:3,3]).tolist()
            inventory.append(dict(file=report['print_parts'][mid]['file'],matrix=matrix.tolist(),color=[.12,.14,.15]))
        renderer.render('inventory',inventory,direction=(.3,-.8,1),size=(1500,1100),anchors=anchors)
        (work/'figure-manifest.json').write_text(json.dumps(renderer.manifest,indent=2)+'\n')
        report['mesh_sha256']={p.relative_to(work).as_posix():digest(p) for p in sorted(work.rglob('*.stl'))}
        (work/'geometry-report.json').write_text(json.dumps(report,indent=2)+'\n');booklet(work,report)
        (work/'README.txt').write_text(f'DOCK-IF-01 r{REVISION}: supported dummy bench only. See PDF, source docs, geometry-report.json. Print models/print, not context. No physical acceptance.\n')
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
