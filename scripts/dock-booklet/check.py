"""Independently check DOCK-IF-01 PDF, complete ZIP, fabrication poses and source freshness."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import zipfile

import numpy as np
from PIL import Image, ImageChops
from pypdf import PdfReader
from scipy.spatial import cKDTree
import trimesh

ROOT=Path(__file__).resolve().parents[2]
ARTIFACT='ARBI-dock'
PREFIX=ARTIFACT+'-STL-pack/'


def overlap(a,b):
    if np.any(a.bounds[1]<b.bounds[0]-.001) or np.any(b.bounds[1]<a.bounds[0]-.001):return 0
    intersection=trimesh.boolean.intersection([a,b],engine='manifold')
    if intersection.is_empty:return 0
    t=intersection.triangles
    return abs(np.einsum('ij,ij->i',t[:,0],np.cross(t[:,1],t[:,2])).sum()/6)


def section_crossings(mesh,axis,at):
    other=[i for i in range(3) if i!=axis];tri=mesh.triangles
    a=tri[:,0,other];u=tri[:,1,other]-a;v=tri[:,2,other]-a;p=np.asarray(at)-a
    den=u[:,0]*v[:,1]-u[:,1]*v[:,0];valid=np.abs(den)>1e-9
    b=(p[valid,0]*v[valid,1]-p[valid,1]*v[valid,0])/den[valid]
    c=(u[valid,0]*p[valid,1]-u[valid,1]*p[valid,0])/den[valid]
    selected=(b>=-1e-6)&(c>=-1e-6)&(b+c<=1+1e-6)
    xyz=tri[valid,:,axis]
    return np.unique(np.round((xyz[:,0]+b*(xyz[:,1]-xyz[:,0])+c*(xyz[:,2]-xyz[:,0]))[selected],4))


def check(output):
    kit=json.loads((Path(__file__).parent/'kit.json').read_text())
    ids=[mid for items in kit.values() for mid,_,_ in items]
    with zipfile.ZipFile(output/(ARTIFACT+'-STL-pack.zip')) as pack:
        assert pack.testzip() is None
        manifest=json.loads(pack.read(PREFIX+'manifest.json'))['files_sha256']
        assert set(pack.namelist())=={PREFIX+p for p in [*manifest,'manifest.json']}
        for name,digest in manifest.items():assert hashlib.sha256(pack.read(PREFIX+name)).hexdigest()==digest,name
        assert pack.read(PREFIX+ARTIFACT+'-assembly-STL.pdf')==(output/(ARTIFACT+'-assembly-STL.pdf')).read_bytes()
        report=json.loads(pack.read(PREFIX+'geometry-report.json'))
        assert report==json.loads((output/'geometry-report.json').read_text())
        for name,digest in report['sources_sha256'].items():
            assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==digest,'Stale source '+name
            assert hashlib.sha256(pack.read(PREFIX+'source/repository/'+name)).hexdigest()==digest
        assert {'docs/assets/dock/concept-board-2026-10-14.png','docs/assets/dock/generation.json',
            'docs/project/industrial-design.md'}<=set(report['sources_sha256'])
        registry=json.loads((ROOT/'hardware/models.json').read_text());models={m['id']:m for m in registry['models']}
        assert report['fabrication_ids']==ids and report['printed_model_ids']==ids
        assert report['bought_solid_components']==165
        assert report['revision']=='0.3.0'
        assert report['status']=='concept-unvalidated' and report['checks']>500
        assert report['printer_envelope_mm']==[256]*3 and report['bed_edge_reserve_mm']==5
        mesh_cache={}
        def mesh(name):
            if name not in mesh_cache:mesh_cache[name]=trimesh.load_mesh(io.BytesIO(pack.read(PREFIX+name)),file_type='stl')
            return mesh_cache[name].copy()
        assert {Path(p).name for p in report['mesh_sha256'] if p.startswith('models/arbi/')}=={models[mid]['output'] for mid in ids}
        for path,digest in report['mesh_sha256'].items():assert hashlib.sha256(pack.read(PREFIX+path)).hexdigest()==digest
        for mid in ids:
            canonical=mesh('models/arbi/'+models[mid]['output']);record=report['print_parts'][mid];printed=mesh(record['file'])
            assert canonical.is_watertight and canonical.is_winding_consistent and canonical.body_count==1 and canonical.volume>0
            assert abs(canonical.volume/1000-report['meshes'][mid]['volume_cm3'])<.0001
            matrix=np.asarray(record['installed_to_print']);assert np.allclose(matrix[3],[0,0,0,1])
            assert np.allclose(matrix[:3,:3].T@matrix[:3,:3],np.eye(3)) and np.linalg.det(matrix[:3,:3])>0
            canonical.apply_transform(matrix)
            assert cKDTree(canonical.vertices).query(printed.vertices)[0].max()<.002
            assert cKDTree(printed.vertices).query(canonical.vertices)[0].max()<.002
            assert printed.is_watertight and printed.is_winding_consistent and printed.body_count==1
            assert np.all(printed.bounds[0]>=-.002) and abs(printed.bounds[0,2])<.002
            assert np.all(printed.extents[:2]<=246.002) and printed.extents[2]<=256.002
            assert np.allclose(record['extents_mm'],printed.extents,atol=.002) and record['bed_fits']
        roof=mesh('models/arbi/'+models['dock-roof-quarter']['output'])
        assert np.allclose(roof.bounds,[[0,0,174],[150,150,220]],atol=.002)
        assert np.allclose(report['print_parts']['dock-roof-quarter']['installed_to_print'],
            [[1,0,0,0],[0,1,0,0],[0,0,1,-174],[0,0,0,1]],atol=.002)
        assert len(report['roof_skin_sections'])==7
        for sample in report['roof_skin_sections']:
            crossings=section_crossings(roof,sample['axis'],sample['at_mm'])
            assert len(crossings)==2 and 2.6<=np.ptp(crossings)<=3.3
            assert np.allclose(crossings,sample['crossings_mm'],atol=.0002)
            assert abs(np.ptp(crossings)-sample['thickness_mm'])<.0002
        lower=mesh('models/arbi/'+models['dock-lower-panel']['output'])
        rear=mesh('models/arbi/'+models['dock-lower-rear-panel']['output'])
        for mid in ['dock-lower-panel','dock-lower-rear-panel']:
            matrix=np.asarray(report['print_parts'][mid]['installed_to_print'])
            c=1/np.sqrt(2)
            assert np.allclose(matrix[:3,:3],[[c,-c,0],[-c,-c,0],[0,0,-1]],atol=.002)
            assert abs(matrix[2,3]-174)<.002
        sections=report['lower_shell_sections'];assert len(sections['wall'])==3
        assert [s['z_mm'] for s in sections['wall']]==[115,135,160]
        assert abs(sections['cone_slope']-(283-140)/2/66.02)<.00001
        for sample in sections['wall']:
            crossings=section_crossings(lower,0,[0,sample['z_mm']])
            assert len(crossings)==2 and np.allclose(crossings,sample['crossings_mm'],atol=.0002)
            normal=np.ptp(crossings)/np.sqrt(1+sections['cone_slope']**2)
            assert 2.75<=normal<=2.85 and abs(normal-sample['normal_mm'])<.0002
        tray=section_crossings(lower,2,[100,0]);assert np.allclose(tray[tray>=170],[171,174],atol=.002)
        assert len(section_crossings(rear,0,[0,135]))==0 and len(section_crossings(rear,2,[100,0]))==0
        assert report['negative_controls']['closed_fork_descent_mm3']>1
        assert report['negative_controls']['uncut_guide_line_collision_mm3']>1
        assert report['negative_controls']['closed_roof_service_line_collision_mm3']>1
        figures=json.loads(pack.read(PREFIX+'figure-manifest.json'))
        assert set(figures)=={'covered','open','exploded','arm','latch','pod','roof','lower','inventory'}
        for name,figure in figures.items():
            assert figure['render_style']=='assembly-line-art-v1'
            with Image.open(output/'figures'/(name+'.png')) as image:
                assert list(image.size)==figure['size']
                assert ImageChops.difference(image.convert('RGB'),Image.new('RGB',image.size,'white')).getbbox()
            for p in figure['parts']:assert p['file'] in report['mesh_sha256']
        installed=figures['covered']['parts']
        # One full kit; context cannot masquerade as fabricated inventory.
        for pid,items in kit.items():
            for mid,_,q in items:assert sum(Path(p['file']).name==models[mid]['output'] for p in installed)==q,(pid,mid)
        assert len(figures['covered']['parts'])==len(figures['exploded']['parts'])
        # Recompute retention regression from the written meshes, not its reported boolean.
        fork=mesh('models/arbi/'+models['dock-latch-fork']['output']);stud=mesh('models/arbi/'+models['dock-pod-stud']['output']);stud.apply_translation([0,0,-10])
        trapped=trimesh.boolean.intersection([fork,stud],engine='manifold');assert not trapped.is_empty and trapped.volume>1
        fork.apply_translation([-40,0,0]);free=trimesh.boolean.intersection([fork,stud],engine='manifold');assert free.is_empty or free.volume<.015
        unloaded_stud=mesh('models/arbi/'+models['dock-pod-stud']['output'])
        closed_fork=mesh('models/arbi/'+models['dock-latch-fork']['output'])
        shoulder=report['retaining_shoulder'];assert shoulder['unloaded_gap_mm']==.2 and shoulder['head_height_mm']==11
        assert len(shoulder['sections'])==4
        for sample in shoulder['sections']:
            head=section_crossings(unloaded_stud,2,sample['at_mm'])
            head=head[head>100]
            support=section_crossings(closed_fork,2,sample['at_mm'])
            assert len(head)==2 and np.allclose(head,[149.8,160.8],atol=.002)
            assert abs(support[-1]-149.6)<.002
        assert np.allclose(section_crossings(unloaded_stud,0,[0,149]),[-7,-2.25,2.25,7],atol=.002)
        seated=unloaded_stud.copy();seated.apply_translation([0,0,-.2]);assert overlap(seated,closed_fork)<.015
        seated.apply_translation([0,0,-.8]);assert overlap(seated,closed_fork)>1
        assert overlap(seated,fork)<.015
        # Independently repeat service and complete-pod release from the packed
        # meshes, including the other three lines and retained bought hardware.
        def placed(part):
            result=mesh(part['file']);result.apply_transform(np.asarray(part['matrix']));return result
        line=mesh('models/reference/roof-service-lines.stl')
        assert np.allclose(line.bounds[:,2],[-200,800])
        service=report['roof_service'];assert service['lift_mm']==60 and service['inward_mm']==100 and service['quarters']==4
        bought=[mesh(f'models/reference/bought-components/{i}.stl') for i in range(165)]
        all_fixed=[p for p in installed if p['file'] not in ['models/reference/bought-hardware.stl','models/reference/nominal-lines.stl']]
        service_fixed=[p for p in all_fixed if not p.get('label','').startswith('lower-')]
        retained=[*bought[:20],*bought[40:105],line]
        path=[(h,0) for h in [0,5,10,20,40,60]]+[(60,s) for s in range(10,101,10)]
        for angle in [0,90,180,270]:
            part=next(p for p in service_fixed if p.get('label')==f'roof-{angle}')
            obstacles=[placed(p) for p in service_fixed if p is not part]+retained
            radians=np.deg2rad(angle+45)
            for height,inward in path:
                moving=placed(part);moving.apply_translation([-inward*np.cos(radians),-inward*np.sin(radians),height])
                for obstacle in obstacles:assert overlap(moving,obstacle)<.015,(angle,height,inward,'roof service')
        closed=mesh('models/controls/closed-roof-slot.stl');closed.apply_translation([-50/np.sqrt(2),-50/np.sqrt(2),60])
        closed_overlap=overlap(closed,line);assert closed_overlap>1
        assert abs(closed_overlap-report['negative_controls']['closed_roof_service_line_collision_mm3'])<.002
        lower_parts=[p for p in installed if p.get('label','').startswith('lower-')]
        lower_meshes=[placed(p) for p in lower_parts]
        lower_volume=sum(m.volume for m in lower_meshes)
        lower_com=sum(m.volume*m.center_mass for m in lower_meshes)/lower_volume
        assert abs(lower_volume/1000-report['lower_shell']['volume_cm3'])<.00001
        assert np.allclose(lower_com,report['lower_shell']['center_of_mass_mm'],atol=.00001)
        assert len(report['lower_shell']['models'])==4
        for record in report['lower_shell']['models']:
            part=next(p for p in lower_parts if p['label']==record['label'])
            assert part['file']==record['file'] and np.allclose(part['matrix'],record['installed_matrix'])
        lower_service=report['lower_service'];assert lower_service['outward_mm']==110 and lower_service['down_mm']==100
        captive=[index for base in range(125,165,5) for index in [base+3,base+4]]
        lower_path=[(s,0) for s in range(0,111,10)]+[(110,h) for h in range(10,101,10)]
        rear_path=[(s,0) for s in range(0,61,10)]+[(60,h) for h in [5,10,15,20]]
        rear_path += [(s,20) for s in range(70,111,10)]+[(110,h) for h in range(30,101,10)]
        for panel_index,angle in enumerate([0,90,180,270]):
            part=next(p for p in lower_parts if p['label']==f'lower-{angle}')
            base=125+panel_index*10;removed=[base,base+1,base+2,base+5,base+6,base+7]
            retained_indices=[i for i in range(125,165) if i not in removed]
            assert lower_service['retained_component_indices_by_angle'][str(angle)]==retained_indices
            lower_retained=[*bought[:125],*[bought[i] for i in retained_indices],line]
            obstacles=[placed(p) for p in all_fixed if p is not part]+lower_retained
            radians=np.deg2rad(angle)
            path=rear_path if angle==180 else lower_path
            assert lower_service['paths_by_angle'][str(angle)]==[list(p) for p in path]
            for outward,down in path:
                moving=placed(part);moving.apply_translation([outward*np.cos(radians),outward*np.sin(radians),-down])
                for obstacle in obstacles:assert overlap(moving,obstacle)<.015,(angle,outward,down,'lower service')
        insertion=report['lower_hardware_insertion'];assert insertion['component_indices']==captive
        assert insertion['samples_from_seat_mm']==[30,20,10,5,2,1,0]
        insertion_obstacles=[placed(p) for p in service_fixed]+bought[:125]+[line]
        for index in captive:
            angle=((index-125)//10)*90;radians=np.deg2rad(angle)
            for inward in insertion['samples_from_seat_mm']:
                moving=bought[index].copy();moving.apply_translation([-inward*np.cos(radians),-inward*np.sin(radians),0])
                for obstacle in insertion_obstacles:assert overlap(moving,obstacle)<.015,(index,inward,'captive hardware insertion')
        tools=report['lower_tool_envelopes'];assert tools['driver_diameter_mm']==5 and tools['driver_length_mm']==80 and tools['top_z_mm']==166.98
        for angle in [0,90,180,270]:
            radians=np.deg2rad(angle)
            for y in [-60,60]:
                driver=trimesh.creation.cylinder(radius=2.5,height=80,sections=32)
                driver.apply_translation([141*np.cos(radians)-y*np.sin(radians),141*np.sin(radians)+y*np.cos(radians),126.98])
                for obstacle in [*[placed(p) for p in all_fixed],*bought,line]:assert overlap(driver,obstacle)<.015,(angle,y,'lower driver')
        closed_lower=mesh('models/controls/closed-lower-lines.stl')
        line_overlap=overlap(closed_lower,line);assert line_overlap>1
        assert abs(line_overlap-report['negative_controls']['closed_lower_line_collision_mm3'])<.002
        closed_rear=mesh('models/controls/closed-lower-rear-window.stl')
        closed_rear.apply_transform(np.asarray(next(p for p in lower_parts if p['label']=='lower-180')['matrix']))
        arm_overlap=sum(overlap(closed_rear,placed(p)) for p in installed if 'arm-' in p.get('label','') or p.get('label')=='dock-locator-carrier')
        assert arm_overlap>1 and abs(arm_overlap-report['negative_controls']['closed_rear_arm_collision_mm3'])<.002
        wrong_lower=lower.copy();wrong_lower.apply_translation([0,0,-10])
        guide_overlap=sum(overlap(wrong_lower,placed(p)) for p in installed if p.get('label','').startswith('guide-'))
        assert guide_overlap>1 and abs(guide_overlap-report['negative_controls']['lower_down_before_out_collision_mm3'])<.002
        rear_straight=placed(next(p for p in lower_parts if p['label']=='lower-180'));rear_straight.apply_translation([-90,0,0])
        lap_overlap=sum(overlap(rear_straight,m) for m in bought[10:20])
        assert lap_overlap>1 and abs(lap_overlap-report['negative_controls']['rear_straight_withdrawal_lap_collision_mm3'])<.002
        control=mesh('models/controls/rear-straight-withdrawal.stl')
        assert cKDTree(rear_straight.vertices).query(control.vertices)[0].max()<.002
        incomplete=mesh('models/controls/incomplete-lower-washer-pocket.stl');washer_overlap=overlap(incomplete,bought[133])
        assert washer_overlap>1 and abs(washer_overlap-report['negative_controls']['incomplete_washer_pocket_collision_mm3'])<.002
        is_pod=lambda p:p['file']=='models/reference/current-pod.stl' or p.get('label','').startswith(('dock-pod','shoe-'))
        # The combined context STL intentionally contains touching component
        # surfaces. Reloading it merges contact vertices into a non-manifold
        # display mesh, so boolean evidence must use the written solid components.
        pod_components=[mesh(name) for name in report['mesh_sha256'] if name.startswith('models/reference/pod-components/')]
        assert pod_components and all(m.is_watertight and m.is_winding_consistent and m.volume>0 for m in pod_components)
        moving_pod=trimesh.util.concatenate([*[placed(p) for p in installed if is_pod(p) and p['file']!='models/reference/current-pod.stl'],
            *pod_components,*bought[60:105]])
        fixed=[placed(p) for p in installed if not is_pod(p) and p['file']!='models/reference/bought-hardware.stl' and p.get('label')!='dock-latch-fork']
        fixed += [*bought[:60],*bought[105:],fork]
        assert report['full_pod_release_mm']==[1,5,10,20,40,80,120,170]
        for down in report['full_pod_release_mm']:
            moving=moving_pod.copy();moving.apply_translation([0,0,-down])
            for obstacle in fixed:assert overlap(moving,obstacle)<.015,(down,'full pod release')
    pages=PdfReader(output/(ARTIFACT+'-assembly-STL.pdf')).pages
    assert len(pages)==10
    for i,page in enumerate(pages,1):
        content=page.extract_text();assert f'{i} / 10' in content and 'CONCEPT - UNVALIDATED' in content
        assert 'r0.3.0' in content
        assert abs(float(page.mediabox.width)-595.276)<1 and abs(float(page.mediabox.height)-841.890)<1
    print(f'Checked dock: 10 A4 pages, {len(ids)} fabrication models, {report["checks"]} nominal checks, current complete source/STL pack.')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('output',type=Path)
    check(parser.parse_args().output.resolve())
