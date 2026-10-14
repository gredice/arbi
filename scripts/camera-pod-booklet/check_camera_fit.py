"""Independent Wide camera/hood fit, loading paths and old-hood controls.

Uses the exported meshes and manufacturer/product-envelope allowances. It does
not qualify a printed fit, flexible ribbon, strength or physical optical result.
"""
import hashlib,json,subprocess,tempfile
from pathlib import Path
import numpy as np
import trimesh
import manifold3d as mf
from integration import ROOT,ENCLOSURE,assembly,T,R

EPS=.005

def solid(mesh):
    return mf.Manifold(mf.Mesh(np.asarray(mesh.vertices,dtype=np.float32),
                               np.asarray(mesh.faces,dtype=np.uint32)))

def moved(mesh,matrix):
    result=mesh.copy();result.apply_transform(matrix);return result

def fixture_mesh(name):
    fixture=ROOT/'source/fixtures'/name
    with tempfile.TemporaryDirectory(prefix='arbi-old-camera-hood-') as temp:
        out=Path(temp)/'hood.stl'
        result=subprocess.run(['openscad','-o',str(out),str(fixture)],capture_output=True,text=True,timeout=120)
        assert result.returncode==0 and 'WARNING:' not in result.stderr and 'ERROR:' not in result.stderr,result.stderr
        mesh=trimesh.load_mesh(out)
        assert mesh.is_watertight and mesh.is_winding_consistent and mesh.body_count==1 and mesh.volume>0
    return mesh,hashlib.sha256(fixture.read_bytes()).hexdigest()

def main():
    manifest=json.loads((ROOT/'mesh-manifest.json').read_text())
    parts={p['name']:p for p in assembly()}
    def source(name):
        p=parts[name];mesh=trimesh.load_mesh(ROOT/p['file'])
        assert mesh.is_watertight and mesh.is_winding_consistent and mesh.body_count==1 and mesh.volume>0,name
        return mesh,p
    camera,cp=source('camera');hood,hp=source('camera-hood')
    assert np.allclose(camera.bounds,[[-12.5,-11.931,-2.75],[12.5,11.931,9.65]],atol=.002),camera.bounds
    # In the raw supplier-derived camera frame, inspect the actual four bores.
    camera_solid=solid(camera);hole_checks=[]
    for x in [-10.5,10.5]:
        for y in [-9.931,2.569]:
            probe=trimesh.creation.cylinder(radius=1.05,height=13,sections=64)
            probe.apply_translation([x,y,3.5]);v=float((camera_solid^solid(probe)).volume())
            assert v<EPS,(x,y,v)
            hole_checks.append({'xy_mm':[x,y],'intersection_mm3':v})
    hc=np.linalg.inv(np.array(hp['matrix']))@np.array(cp['matrix'])
    installed=moved(camera,hc);hood_solid=solid(hood)
    initial=float((solid(installed)^hood_solid).volume());assert initial<EPS,initial
    # Larger planar guard preserves the front seating datum but allows +0.2
    # per PCB edge and extra thickness behind it. No hole is needed at contact.
    pcb=trimesh.creation.box([25.4,24.4,1.52]);pcb.apply_translation([0,0,.36])
    pcb=moved(pcb,hc);failures=[];offsets=np.arange(20,-.001,-.25)
    for z in offsets:
        for name,mesh in [('complete camera',installed),('PCB allowance',pcb)]:
            v=float((solid(moved(mesh,T(0,0,z)))^hood_solid).volume())
            if v>EPS:failures.append({'rear_offset_mm':float(z),'probe':name,'intersection_mm3':v})
    assert not failures,failures
    report={'variant':'Camera Module 3 Wide, IR-cut','status':'nominal CAD only',
        'camera_bounds_mm':camera.bounds.tolist(),'mounting_bore_probes':hole_checks,
        'camera_in_hood_matrix':hc.tolist(),'installed_intersection_mm3':initial,
        'rear_loading':{'poses':len(offsets),'step_mm':.25,'PCB_allowance_mm':[25.4,24.4,1.52],'failures':failures},
        'source_sha256':{p['file']:hashlib.sha256((ROOT/p['file']).read_bytes()).hexdigest() for p in [cp,hp]},
        'limits':'Supplier-derived conservative primitives; PCB/STEP differ. Printed fit, lens calibration, latch/cable movement and rain performance require physical inspection.'}
    if ENCLOSURE:
        # The complete 10.8 ±0.15 square module must clear the front region,
        # including its corners, even when its body approaches the face.
        face=trimesh.creation.box([10.95,10.95,1.2])
        face.apply_translation([0,-2.469,2.6])
        # Undo the export bed translation to inspect the canonical hood frame.
        entry=next(e for e in manifest if e['model_id']=='camera-pod-integrated-camera-hood')
        raw_hood=hood.copy();raw_hood.apply_translation(-np.array(entry['export_translation_mm']))
        opening=float((solid(face)^solid(raw_hood)).volume());assert opening<EPS,opening
        report['full_square_front_clearance']={'square_mm':10.95,'z_mm':[2,3.2],'intersection_mm3':opening}
        # Deliberately larger than the drawing: this is an ARBI print/handling
        # allowance, not a newly measured camera dimension. Reserve the whole
        # square all the way to the lens front, including autofocus travel.
        guard=trimesh.creation.box([11.6,11.6,7.2]);guard.apply_translation([0,2.469,6.15])
        guarded=moved(guard,hc)
        guarded_loading=[]
        for axis in ['x','y']:
            for angle in [-20,20]:
                failures=[]
                for z in offsets:
                    fraction=min(1,float(z)/12)
                    around=T(*hc[:3,3])@R(axis,angle*fraction)@T(*(-hc[:3,3]))
                    pose=T(.8*fraction,0,z)@around
                    for name,mesh in [('complete camera',installed),('PCB allowance',pcb),('autofocus allowance',guarded)]:
                        v=float((solid(moved(mesh,pose))^hood_solid).volume())
                        if v>EPS:failures.append({'rear_offset_mm':float(z),'probe':name,'intersection_mm3':v})
                assert not failures,(axis,angle,failures)
                guarded_loading.append({'axis':axis,'initial_angle_deg':angle,'positions':len(offsets),'failures':failures})
        report['guided_loading']={'autofocus_allowance_mm':[11.6,11.6,7.2],
            'initial_lateral_offset_mm':.8,'alignment_distance_mm':12,'paths':guarded_loading,
            'scope':'Hand approach up to 20 degrees; align continuously over the last 12 mm before the PCB contacts its seats.'}
        # Full-square face guard, displaced in either direction, exposes the
        # previous aperture's small print/alignment margin without claiming
        # that the photograph proves an exact collision or printed revision.
        front_guard=trimesh.creation.box([11.6,11.6,1.2]);front_guard.apply_translation([0,-2.469,2.6])
        previous,previous_hash=fixture_mesh('camera-hood-r0.1.2.scad')
        clearance=[]
        for dx in [-.8,.8]:
            probe=moved(front_guard,T(dx))
            current=float((solid(probe)^solid(raw_hood)).volume())
            former=float((solid(probe)^solid(previous)).volume())
            assert current<EPS and former>EPS,(dx,current,former)
            clearance.append({'offset_x_mm':dx,'current_intersection_mm3':current,'previous_intersection_mm3':former})
        report['print_alignment_clearance']={'square_mm':11.6,'probes':clearance,'previous_fixture_sha256':previous_hash}
        # No roof/lip above any PCB corner or over the rear CSI cable edge.
        rear=trimesh.creation.box([26,25,3]);rear.apply_translation([0,0,10.9])
        rear_volume=float((solid(rear)^solid(raw_hood)).volume());assert rear_volume<EPS,rear_volume
        # Span from the inner cavity to well outside the complete shell,
        # independently of the notch dimensions. This catches a closing lip
        # left beyond a cutter which only clears the inside of the pocket.
        cable=trimesh.creation.box([24,18,5]);cable.apply_translation([0,-18,6.5])
        cable_volume=float((solid(cable)^solid(raw_hood)).volume());assert cable_volume<EPS,cable_volume
        old_cable_volume=float((solid(cable)^solid(previous)).volume());assert old_cable_volume>EPS,old_cable_volume
        short_exit,short_exit_hash=fixture_mesh('camera-hood-short-exit.scad')
        lip_volume=float((solid(cable)^solid(short_exit)).volume());assert lip_volume>EPS,lip_volume
        report['rear_access']={'above_PCB_seat_intersection_mm3':rear_volume,
            'CSI_edge_envelope_mm':[24,18,5],'CSI_edge_y_mm':[-27,-9],
            'CSI_edge_intersection_mm3':cable_volume,'previous_CSI_edge_intersection_mm3':old_cable_volume,
            'short_exit_fixture_sha256':short_exit_hash,'closing_lip_control_intersection_mm3':lip_volume}
        legacy,legacy_hash=fixture_mesh('camera-hood-r0.1.1.scad')
        old=solid(legacy);corner_collision=float((solid(face)^old).volume())
        # Reproduce the reported attempt to put the PCB beneath the old lands.
        wrong=moved(camera,T(0,0,11.52)@R('x',180))
        under_collision=float((solid(wrong)^old).volume())
        assert corner_collision>EPS and under_collision>EPS,(corner_collision,under_collision)
        report['old_hood_controls']={'fixture_sha256':legacy_hash,
            'full_square_body_collision_mm3':corner_collision,'PCB_1mm_under_lands_collision_mm3':under_collision,
            'detected':True,'scope':'Old full-square front restriction and incorrect under-tab loading; the earlier nominal assembled Standard pose was clear.'}
    (ROOT/'camera-fit-check.json').write_text(json.dumps(report,indent=2)+'\n')
    print('PASS Wide camera: shared envelope/bores, independent rear PCB loading and installed hood fit'+('; both old-hood controls detected.' if ENCLOSURE else '.'),flush=True)

if __name__=='__main__':main()
