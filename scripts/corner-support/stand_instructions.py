"""WT-806 booklet insert built from registered prints and nominal hardware.

The four adapter STLs already use their print pose. Figures apply its inverse;
they never fabricate replacement geometry for the adapters, head or winch base.
"""
from pathlib import Path
import re
import subprocess

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
IDS = ['corner-stand-head-front', 'corner-stand-head-rear',
       'corner-stand-winch-front', 'corner-stand-winch-rear']
FIGURES = ['stand-inventory', 'stand-clamp', 'stand-head', 'stand-winch', 'stand-alignment']
PAGE_COUNT = 14
CORE = [.12, .14, .15]
METAL = [.66, .70, .73]
FRONT = np.array([[0, 0, 1, .4], [0, 1, 0, -51], [-1, 0, 0, 25], [0, 0, 0, 1]])
REAR = np.array([[0, 0, -1, -.4], [0, 1, 0, -51], [1, 0, 0, -25], [0, 0, 0, 1]])


def pose(x=0, y=0, z=0):
    matrix = np.eye(4)
    matrix[:3, 3] = [x, y, z]
    return matrix


def build(work, models, renderer, export, report):
    directory = work/'models/stand'
    references = directory/'reference'
    record = dict(revision='0.1.0', status='concept-unvalidated',
                  head_tube_mm=26, winch_tube_mm=35, head_pitch_mm=110,
                  winch_pitch_mm=120, print_parts={},
                  head_instances={}, winch_instances={},
                  limitation='Schematic straight tube samples; no tripod, factory collars, load or physical acceptance.')
    for mid in IDS:
        path = directory/'print'/models[mid]['output']
        mesh = export(ROOT/models[mid]['entrypoint'], path)
        assert mesh.body_count == 1 and np.all(mesh.area_faces > 1e-9), mid
        assert np.allclose(mesh.bounds[0], [0, 0, 0], atol=.002), mid
        inverse = REAR if mid.endswith('rear') else FRONT
        record['print_parts'][mid] = dict(file=path.relative_to(work).as_posix(),
            print_to_installed=inverse.tolist(), extents_mm=mesh.extents.tolist(),
            quantity_per_stand=2, quantity_two_stands=4)

    # Bought hardware is a simplified nominal envelope; threads/nylon omitted.
    library = ROOT/'hardware/lib/corner-stand-adapter.scad'
    def reference(name, call, include=library):
        source = work/(name+'.scad')
        source.write_text(f'include <{include.as_posix()}>\n{call}\n')
        export(source, references/(name+'.stl'))
        return (references/(name+'.stl')).relative_to(work).as_posix()

    refs = {}
    for role, diameter, length in [('head', 26, 60), ('winch', 35, 70)]:
        refs[role+'-tube'] = reference('stand-'+role+'-tube', f'cylinder(d={diameter},h=210,center=true,$fn=128);')
        refs[role+'-m6'] = reference('stand-'+role+'-m6', f'csa_clamp_hardware({diameter});')
    refs['m12'] = reference('stand-m12', '''
        translate([80,0,0]) csa_xcylinder(12,90);
        translate([129,0,0]) rotate([0,90,0]) cylinder(d=18/cos(30),h=8,center=true,$fn=6);
        for(x=[123.5,51.5]) translate([x,0,0]) csa_xring(37,13,3);
        translate([44,0,0]) difference() {
            rotate([0,90,0]) cylinder(d=19/cos(30),h=12,center=true,$fn=6);
            csa_xcylinder(12,12.04);
        }''')
    refs['m8'] = reference('stand-m8', '''
        for(y=[-25,25]) {
            translate([104.6,y,0]) csa_xcylinder(8,40);
            translate([128.6,y,0]) rotate([0,90,0]) cylinder(d=13/cos(30),h=8,center=true,$fn=6);
            for(x=[123.8,98.2]) translate([x,y,0]) csa_xring(16,8.4,1.6);
            translate([93.4,y,0]) difference() {
                rotate([0,90,0]) cylinder(d=13/cos(30),h=8,center=true,$fn=6);
                csa_xcylinder(8,8.04);
            }
        }''')
    refs['base'] = reference('stand-winch-base', 'wc_base(false);', ROOT/'hardware/lib/winch-cover.scad')

    def item(file, matrix=None, color=CORE, part='corner-stand-adapter-kit'):
        return dict(file=file, matrix=(np.eye(4) if matrix is None else matrix).tolist(),
                    color=color, bomPartId=part)

    def adapter(mid, matrix=None):
        data = record['print_parts'][mid]
        return item(data['file'], (np.eye(4) if matrix is None else matrix)@np.array(data['print_to_installed']))

    inventory = [adapter(mid, pose(y=(i % 2)*190, z=(i//2)*140)) for i, mid in enumerate(IDS)]
    renderer.render('stand-inventory', inventory, direction=(1,-1,.65), size=(1500,1000),
        anchors={'A':[65,0,0], 'B':[-15,190,0], 'C':[95,0,140], 'D':[-20,190,140]})
    clamp = [adapter(IDS[0],pose(x=40)), adapter(IDS[1],pose(x=-40)),
             item(refs['head-tube'],color=METAL), item(refs['head-m6'],color=METAL)]
    renderer.render('stand-clamp',clamp,direction=(.65,-1,.65),size=(1500,1000),
        anchors={'A':[90,0,0], 'B':[-55,0,0], 'M6':[25,-42,0]})

    head = [item(refs['head-tube'],pose(z=100),METAL)]
    for mid in ['corner-head-printed-left','corner-head-printed-right']:
        head.append(item('models/arbi/'+models[mid]['output'],pose(x=30),part='corner-head-printed-kit'))
    for name, part in [('cross_hardware','corner-head-printed-hardware'),
                       ('block','top-positioning-line-pulley'),('line','dyneema-positioning-line')]:
        head.append(item('models/reference/'+name+'.stl',pose(x=30),METAL if name=='cross_hardware' else CORE,part))
    for z in [45,155]:
        for mid in IDS[:2]:
            head.append(adapter(mid,pose(z=z)))
            record['head_instances'].setdefault(mid,[]).append((pose(z=z)@(REAR if mid.endswith('rear') else FRONT)).tolist())
        head += [item(refs[key],pose(z=z),METAL) for key in ['head-m6','m12']]
    renderer.render('stand-head',head,direction=(.8,-1,.65),size=(1500,1000),
        anchors={'A':[80,-30,45], 'B':[-20,-30,155], 'M12':[129,0,45], 'pin':[239,0,165]})

    probe=work/'stand-winch-width.scad'
    probe.write_text(f'include <{(ROOT/"hardware/lib/winch-pole.scad").as_posix()}>\n'
                     'echo(width=wd_width(false));\n')
    run=subprocess.run(['openscad','-o',str(work/'stand-winch-width.csg'),str(probe)],
                       capture_output=True,text=True,timeout=30,check=True)
    log=run.stdout+run.stderr
    assert not re.search(r'\b(?:WARNING|ERROR):',log),log
    width=float(re.search(r'width = ([\d.]+)',log).group(1))
    (work/'stand-winch-width.csg').unlink()
    record['winch_width_mm']=width
    base_matrix = np.array([[0,0,1,123],[1,0,0,-width/2],[0,1,0,0],[0,0,0,1]])
    winch = [item(refs['winch-tube'],color=METAL), item(refs['base'],base_matrix,METAL,'winch-mount-hardware')]
    for z in [-60,60]:
        for mid in IDS[2:]:
            winch.append(adapter(mid,pose(z=z)))
            record['winch_instances'].setdefault(mid,[]).append((pose(z=z)@(REAR if mid.endswith('rear') else FRONT)).tolist())
        winch += [item(refs[key],pose(z=z),METAL) for key in ['winch-m6','m8']]
    renderer.render('stand-winch',winch,direction=(-.7,-1,.6),size=(1500,1000),
        anchors={'C':[110,35,85], 'D':[-20,-32,-60], 'M8':[94,-25,60]})

    # Side-by-side local details share +X and a common nominal payout plane.
    # Vertical separation is deliberately schematic, not a stand height plan.
    alignment = [{**part,'matrix':(pose(z=400)@np.array(part['matrix'])).tolist()} for part in head]+winch
    renderer.render('stand-alignment',alignment,direction=(0,-1,0),size=(1300,1400),
        anchors={'head':[253.3,0,535], 'base':[123,0,0], 'tube':[0,0,300]})
    report['stand_instructions'] = record


def pages(page, table):
    page(9,'WT-806 / identify the parts',[
        '<b>Indoor insert, pages 9-14. One stand = one round-120 pulley head + one complete passive winch (including its motor), mounted by four clamp pairs. Two stands = two kits and sixteen adapter prints.</b>',
        'A: head front, curved seat, 26 mm default. B: head rear, 26 mm default. C: winch front, flat plate and two M8 holes, 35 mm default. D: winch rear, 35 mm default. Print two of each per stand; four of each for the two-stand batch. Never swap the rear halves between tube diameters.',
        'Retain one left and one right round-120 carrier per head, two M8 x 100 cross-bolts, four M8 washers, two locking nuts, the BA01090 block and its measured compatible retained pin. Build the passive winch using its owning booklet; this insert covers its mounting interface.',
        'Omit timber rear pads, drilling template, long M12 timber bolts, both head cosmetic covers for the first inspection. Omit the timber saddle/pole mounting stack and closeout over the winch mounting holes. No drilling of the stand or use of its top thread.'],
        'stand-inventory', labels=True)
    page(10,'WT-806 / metal fastener inventory',[
        'Adapter hardware below is additional to the complete head and passive winch. Lengths are under the bolt head; washer dimensions are OD x thickness in mm. Threads and locking inserts are simplified in the illustrations.'],
        rows=table,
        after=[
        '<b>Reused head cross-hardware:</b> per stand 2 M8 x 100 bolts, 4 M8 washers and 2 locking nuts; two stands 4 / 8 / 4. Reuse the compatible pulley attachment pin with all original locking parts. Winch internal fasteners stay with its assembly.',
        'A measured 30 mm tube needs matching front/rear exports and M6 x 65 bolts at that interface. Measure actual washers, nut locking zones, bolt tips and the 8 mm winch base. Nominal M12 x 90 projection is 3 mm; M8 x 40 is 4.8 mm. Substitutions require a fresh stack and access inspection.'])
    page(11,'WT-806 / measure and fit clamps',[
        '<b>1. Prepare.</b> Spread and lock the legs on a level floor, keep extension low, arrange suitable base ballast and independent retention. Support equipment separately during assembly. Hold spring-loaded sections when releasing factory locks; follow the WT-806 manual.',
        '<b>2. Measure before printing.</b> Head rows: 110 mm pitch and 160 mm straight tube. Winch rows: 120 mm pitch and 170 mm straight tube. Both rows of a pair stay on one measured constant-diameter section, clear of collars, levers, leg hub and spigot. Check ovality and wrench access. Export matching diameters, never scale STLs.',
        '<b>3. Fit one pair at a time.</b> A or C faces +X toward the span; B or D faces behind the tube. Insert two M6 bolts from the rear: bolt head - washer - rear half - front half - washer - locking nut. Repeat at the second row without mirroring parts.',
        'The exploded view separates A/B for identification; close both around the tube for use. Alternate gentle tightening until grip is observed. No torque or clamping force is qualified. Stop if faces bottom out, a print cracks, the tube dents, or a factory lock binds.'],
        'stand-clamp',labels=True)
    page(12,'WT-806 / attach the pulley head',[
        '<b>4. Assemble the head on the bench.</b> Join the round-120 left/right carriers with their two M8 x 100 cross-bolts at Z=100/190, washers and locking nuts. Inspect the BA01090 tang, pin and retention parts; fit only a measured compatible retained pin.',
        '<b>5. Support and seat the head.</b> Place its curved carrier contact surfaces against A at both rows. Carrier holes Z=45/155 align with the 110 mm adapter pitch. Insert each short M12 x 90 bolt from the carrier/span side toward the tube.',
        '<b>M12 stack, +X to -X:</b> bolt head - large washer - carrier seat (32 mm nominal) - A seat (37 mm) - large washer - locking nut. The nut sits in the open bay between A webs, ahead of the tube. B is the M6 rear clamp; it is not in the M12 stack.',
        'Support the head while fitting and tightening both rows. Confirm even seat contact, full locking-zone engagement, tip clearance, tool access and free block articulation. Keep both cosmetic covers off so all mounting and line interfaces remain visible.'],
        'stand-head',labels=True)
    page(13,'WT-806 / attach the passive winch',[
        '<b>6. Fit C/D at 120 mm pitch.</b> Use the measured lower straight tube (35 mm nominal) and M6 x 70 clamp bolts. The flat C plates face the same +X direction as A. Inspect clamp grip before lifting the separately supported winch into place.',
        '<b>7. Mount through the original 50 x 120 mm pattern.</b> Remove only the winch closeout over the mounting holes as described in its round-pole/full-cover documents. Use four M8 x 40 bolts; the illustration shows the actual aluminium base with the drum and covers omitted for access.',
        '<b>M8 stack, +X to -X:</b> bolt head - washer - aluminium base (8 mm nominal) - C plate (16 mm) - washer - locking nut. Access each rear nut through its 26 mm rib pocket. D is the rear tube clamp and is not in this mounting stack.',
        'Fit all four mounting bolts before final tightening, with the winch independently supported. Check full locking-zone engagement and tips. Refit only compatible winch covers after inspection; leave the mounting interface available for witness and slip checks. No stand load rating follows from this assembly.'],
        'stand-winch',labels=True)
    page(14,'WT-806 / unpowered trial and record',[
        '<b>8. Inspect and align.</b> Weigh the complete equipment; record footprint, ballast and independent retention. Check all four clamp pairs and every factory lock. Isolate power, use a loose line and turn the passive drum by hand through its travel; observe pulley articulation, fleet angle, rubbing and bolt/collar contact.',
        'Side view uses separate tube samples and schematic heights. Both payout references lie 253.3 mm forward of the stand axis; the base front is at 123 mm. Use a plumb reference at the actual groove and payout point. These values do not establish physical line tracking or clearance from factory collars and legs.',
        '<b>Record for each stand:</b> ID/date/builder; CAD revisions and source hashes; tube diameters/ovality and straight lengths; print process and inspection; received fasteners/pin; equipment mass; factory locks; footprint/ballast/restraint; row heights; alignment and slip/rotation witnesses before and after each trial. Use the blank record in stand-assembly.md.',
        'Stop for movement, loose locks, cracking, tube dents, block binding or line contact. Secure/de-tension the line before adjustments; remove equipment before moving the tripod or changing height. Two stands support two interface trials. Tensioned, powered or suspended trials require separately reviewed limits and independent restraint; no allowable cable tension is assigned.'],
        'stand-alignment',labels=True)


HARDWARE_TABLE = [
    ['Additional adapter hardware', 'One stand', 'Two stands'],
    ['M6 x 60 / head clamp bolts', '4', '8'],
    ['M6 x 70 / winch clamp bolts', '4', '8'],
    ['M6 washers / 12 x 1.6', '16', '32'],
    ['M6 locking nuts / 6 thick', '8', '16'],
    ['M12 x 90 / head mounting bolts', '2', '4'],
    ['M12 large washers / 37 x 3', '4', '8'],
    ['M12 locking nuts / 12 thick', '2', '4'],
    ['M8 x 40 / winch mounting bolts', '4', '8'],
    ['M8 washers / 16 x 1.6', '8', '16'],
    ['M8 locking nuts / 8 thick', '4', '8'],
]
