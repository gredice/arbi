"""Export and check the measured converter references and cabinet mounting stack.

Requires the pinned OpenSCAD and the camera-pod booklet Python dependencies.
Outputs are inspection meshes/reports only; physical acceptance is separate.
"""
import argparse,hashlib,json,subprocess,tempfile
from pathlib import Path
import numpy as np
import trimesh
import manifold3d as mf

ROOT=Path(__file__).resolve().parents[1]

def manifold(mesh):
    return mf.Manifold(mf.Mesh(np.asarray(mesh.vertices,dtype=np.float32),np.asarray(mesh.faces,dtype=np.uint32)))

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=ROOT/'hardware/generated/converter-cabinet-check')
    args=parser.parse_args();out=args.output.resolve();out.mkdir(parents=True,exist_ok=True)
    registry=json.loads((ROOT/'hardware/models.json').read_text())
    version=subprocess.run(['openscad','--version'],capture_output=True,text=True,check=True)
    assert (version.stdout+version.stderr).strip()=='OpenSCAD version '+registry['openScadVersion']
    exported={}
    def export(name,source,defines=(),single=False):
        target=out/(name+'.stl')
        with tempfile.TemporaryDirectory(prefix='arbi-buck-check-') as temp:
            raw=Path(temp)/'mesh.stl'
            cmd=['openscad','-o',str(raw)]
            for value in defines:cmd+=['-D',value]
            result=subprocess.run(cmd+[str(ROOT/source)],capture_output=True,text=True,timeout=120)
            assert result.returncode==0 and not any(s in result.stderr for s in ['WARNING:','ERROR:']),result.stderr
            mesh=trimesh.load_mesh(raw)
        assert mesh.is_watertight and mesh.is_winding_consistent and mesh.volume>0 and len(mesh.faces)
        if single:assert mesh.body_count==1,name
        target.write_bytes(mesh.export(file_type='stl'))
        mesh=trimesh.load_mesh(target)
        assert mesh.is_watertight and mesh.volume>0
        exported[name]={'file':target.name,'bounds_mm':mesh.bounds.tolist(),'triangles':len(mesh.faces),
            'body_count':int(mesh.body_count),'stl_sha256':hashlib.sha256(target.read_bytes()).hexdigest()}
        print('Exported',name,flush=True)
        return mesh
    pod=export('pod-converter','hardware/assemblies/camera-pod/pod-buck-converter-48v-5v.scad',single=True)
    cabinet=export('cabinet-converter','hardware/assemblies/control-cabinet/controller-buck-converter-48v-5v.scad',single=True)
    assert np.allclose(pod.extents,[50,30,17],atol=.001),pod.extents
    assert np.allclose(cabinet.extents,pod.extents,atol=.001)
    assert abs(pod.volume-cabinet.volume)<.001,'Pod/cabinet references differ'
    body=manifold(pod);probes=[]
    for x in [-22.5,22.5]:
        for y in [-12,12]:
            probe=trimesh.creation.cylinder(radius=1.45,height=18,sections=64)
            probe.apply_translation([x,y,8.5]);volume=float((body^manifold(probe)).volume())
            assert volume<.005,(x,y,volume)
            probes.append({'centre_xy_mm':[x,y],'intersection_mm3':volume})
    source='hardware/assemblies/control-cabinet/control-cabinet-assembly.scad'
    mounted=export('cabinet-mounted-converter',source,('scene_part=16',))
    mounted_body=manifold(mounted);clearances=[]
    for index,name in [(1,'mounting-plate'),(14,'pico-terminal-board'),(15,'pico'),(17,'signal-ground'),(19,'field-terminals')]:
        mesh=export('cabinet-'+name,source,(f'scene_part={index}',))
        volume=float((mounted_body^manifold(mesh)).volume())
        assert volume<.005,(name,volume)
        clearances.append({'part':name,'intersection_mm3':volume})
    # Confirm the represented plate actually has the matching clearance bores;
    # a one-millimetre misplaced screw must be detected by the same plate test.
    plate=manifold(trimesh.load_mesh(out/'cabinet-mounting-plate.stl'));controls=[]
    for x in [-22.5,22.5]:
        for y in [-12,12]:
            probe=trimesh.creation.cylinder(radius=1.25,height=4,sections=64)
            probe.apply_transform(trimesh.transformations.rotation_matrix(np.pi/2,[1,0,0]))
            probe.apply_translation([-150+x,105,55+y])
            assert float((plate^manifold(probe)).volume())<.005
            probe.apply_translation([1,0,0]);volume=float((plate^manifold(probe)).volume())
            assert volume>.005,'Misplaced cabinet screw control missed'
            controls.append({'centre_xy_mm':[x,y],'shift_mm':[1,0,0],'collision_mm3':volume})
    files=[ROOT/'hardware/models.json',ROOT/'hardware/lib/buck-converter-48v-5v.scad',
        ROOT/'hardware/lib/catalog-visualizations.scad',ROOT/'hardware/lib/arbi.scad']
    files+=list((ROOT/'hardware/assemblies/control-cabinet').glob('*.scad'))
    files+=[ROOT/'hardware/assemblies/camera-pod/pod-buck-converter-48v-5v.scad',Path(__file__)]
    report={'status':'nominal CAD only','model_revisions':{m['id']:m['revision'] for m in registry['models'] if m['id'] in ['pod-buck-converter-48v-5v','controller-buck-converter-48v-5v','control-cabinet-assembly']},
        'source_hashes':{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in files},
        'meshes':exported,'measured_hole_probes':probes,'cabinet_intersections':clearances,'misplaced_screw_controls':controls,
        'limits':'Owner-reported dimensions; component/PCB/fastener detail nominal. No physical fit, electrical, cooling or installation acceptance.'}
    (out/'converter-cabinet-check.json').write_text(json.dumps(report,indent=2)+'\n')
    print('PASS measured references and cabinet stack; all shifted-screw controls detected.',flush=True)

if __name__=='__main__':main()
