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
        fixture=ROOT/'source/fixtures/camera-hood-r0.1.1.scad'
        with tempfile.TemporaryDirectory(prefix='arbi-old-camera-hood-') as temp:
            out=Path(temp)/'hood.stl';result=subprocess.run(['openscad','-o',str(out),str(fixture)],capture_output=True,text=True,timeout=120)
            assert result.returncode==0 and 'WARNING:' not in result.stderr and 'ERROR:' not in result.stderr,result.stderr
            legacy=trimesh.load_mesh(out)
        old=solid(legacy);corner_collision=float((solid(face)^old).volume())
        # Reproduce the reported attempt to put the PCB beneath the old lands.
        wrong=moved(camera,T(0,0,11.52)@R('x',180))
        under_collision=float((solid(wrong)^old).volume())
        assert corner_collision>EPS and under_collision>EPS,(corner_collision,under_collision)
        report['old_hood_controls']={'fixture_sha256':hashlib.sha256(fixture.read_bytes()).hexdigest(),
            'full_square_body_collision_mm3':corner_collision,'PCB_1mm_under_lands_collision_mm3':under_collision,
            'detected':True,'scope':'Old full-square front restriction and incorrect under-tab loading; the earlier nominal assembled Standard pose was clear.'}
    (ROOT/'camera-fit-check.json').write_text(json.dumps(report,indent=2)+'\n')
    print('PASS Wide camera: shared envelope/bores, independent rear PCB loading and installed hood fit'+('; both old-hood controls detected.' if ENCLOSURE else '.'),flush=True)

if __name__=='__main__':main()
