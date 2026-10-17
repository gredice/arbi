"""Independently validate the generated corner support PDF and source/STL pack."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import zipfile

import numpy as np
from PIL import Image, ImageChops
from pypdf import PdfReader
import trimesh
from scipy.spatial import cKDTree

ROOT = Path(__file__).resolve().parents[2]
ARTIFACT = 'ARBI-corner-support'
PREFIX = ARTIFACT+'-STL-pack/'
IDS = ['corner-head-printed-left', 'corner-head-printed-right', 'corner-head-printed-rear-pad',
       'corner-head-printed-front-cover', 'corner-head-printed-rear-cover', 'corner-head-printed-template']
VARIANTS = {'round-100-printed-line-1.5', 'round-120-printed-line-1.5', 'round-140-printed-line-1.5',
            'round-120-printed-line-4.5', 'square-100-printed-line-1.5'}
STAND_IDS = ['corner-stand-head-front', 'corner-stand-head-rear',
             'corner-stand-winch-front', 'corner-stand-winch-rear']
STAND_FIGURES = ['stand-inventory', 'stand-clamp', 'stand-head', 'stand-winch', 'stand-alignment']
PAGE_COUNT = 14


def check(output):
    archive = output/(ARTIFACT+'-STL-pack.zip')
    with zipfile.ZipFile(archive) as pack:
        assert pack.testzip() is None
        manifest = json.loads(pack.read(PREFIX+'manifest.json'))['files_sha256']
        assert set(pack.namelist()) == {PREFIX+name for name in [*manifest,'manifest.json']}, 'Unexpected/stale pack files'
        for name, expected in manifest.items():
            assert hashlib.sha256(pack.read(PREFIX+name)).hexdigest() == expected, name
        assert pack.read(PREFIX+ARTIFACT+'-assembly-STL.pdf') == (output/(ARTIFACT+'-assembly-STL.pdf')).read_bytes()
        report = json.loads(pack.read(PREFIX+'geometry-report.json'))
        assert report == json.loads((output/'geometry-report.json').read_text())
        for name, expected in report['sources_sha256'].items():
            assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==expected, 'Source changed: '+name
            assert hashlib.sha256(pack.read(PREFIX+'source/repository/'+name)).hexdigest()==expected
        registry = json.loads((ROOT/'hardware/models.json').read_text())
        models = {model['id']:model for model in registry['models']}
        outputs = {models[mid]['output'] for mid in IDS}
        current = {Path(name).name for name in report['mesh_sha256'] if name.startswith('models/arbi/')}
        assert outputs==current, 'Wrong fabrication revisions'
        assert report['revision']=='1.2.0'
        barton=json.loads(pack.read(PREFIX+'barton-block-check.json'))
        assert barton['measured_envelope_mm']==[65,36,24] and barton['pin_to_sheave_mm']==42
        assert barton['rejected_M8_pin_collision_mm3']>1 and barton['rejected_16mm_lug_collision_mm3']>1
        assert barton['keeper_block_overlap_mm3']<.002
        for name, expected in barton['sources_sha256'].items():
            assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==expected, name
            assert hashlib.sha256(pack.read(PREFIX+'source/repository/'+name)).hexdigest()==expected, name
        legacy = json.loads(pack.read(PREFIX+'legacy-pulley-adapter/geometry-check.json'))
        assert legacy['revision']=='0.1.0' and legacy['status']=='concept-unvalidated'
        assert len(legacy['variants'])==5 and legacy['rejected_bushing_only_collision_mm3']>1
        assert set(legacy['articulation'])=={'0','15','30','45','60','75','90'}
        assert all(result['adapter_collision_mm3']<.002 for result in legacy['articulation'].values())
        for name, expected in legacy['source_sha256'].items():
            assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==expected, name
            assert hashlib.sha256(pack.read(PREFIX+'source/repository/'+name)).hexdigest()==expected, name
        for side in ['left','right']:
            output_name = models['corner-head-legacy-adapter-'+side]['output']
            mesh = trimesh.load_mesh(io.BytesIO(pack.read(PREFIX+'legacy-pulley-adapter/'+output_name)),file_type='stl')
            assert mesh.is_watertight and mesh.is_winding_consistent and mesh.body_count==1 and mesh.volume>0
            assert np.allclose(mesh.bounds,[[0,0,0],[40.6,57,7.4]],atol=.002), side
        assert 'source/repository/hardware/assemblies/corner-station/legacy-pulley-adapter.md' in pack.read(PREFIX+'legacy-pulley-adapter/INSTALLATION.md').decode()
        assert report['fabrication_ids']==IDS and report['printed_model_ids']==IDS
        assert report['configuration']=='Printed round 120 / passive line; concept-unvalidated'
        assert set(report['variants'])==VARIANTS and report['checks']>400
        assert report['printer_envelope_mm']==[256,256,256] and report['bed_edge_reserve_mm']==5
        assert 'scripts/corner-support/check_cover_retention.py' in report['sources_sha256']
        assert not any(Path(name).stem=='straps' or 'cover_hardware' in Path(name).stem
                       for name in report['mesh_sha256']), 'Cover metal or tie mesh remains in current pack'
        for key, variant in report['variants'].items():
            assert variant['tip_projection_mm']>=3.5
            assert abs(variant['tangent_error_mm'])<.001
            assert variant['crossbar_length_mm']==100 and variant['crossbar_tip_projection_mm']>=3.5
            assert len(variant['wall_probes_mm3'])==4 and all(v>=.99 for v in variant['wall_probes_mm3'].values())
            assert len(variant['pin_bore_probes_mm3'])==2 and all(v<=.01 for v in variant['pin_bore_probes_mm3'].values())
            assert abs(variant['sheave_center_Z_mm']-(165-42/np.sqrt(2)))<.001
            assert abs(variant['line_center_Z_from_mesh_mm']-variant['sheave_center_Z_mm'])<.001
            retention=variant['cover_retention']
            assert retention['checks']>=70
            assert (retention['follower_count'],retention['front_follower_count'],retention['rear_follower_count'])==(8,4,4)
            assert all(retention[name]==0 for name in ['cover_screw_count','cover_washer_count','cover_nut_count','cover_tie_count'])
            assert retention['exterior_skins_closed'] and retention['former_M3_holes_closed']
            assert retention['former_tie_slots_closed'] and retention['hidden_underside_release']
            size=int(key.split('-')[1])
            assert len(retention['followers'])==8
            actual_interfaces=set()
            for joint in retention['followers']:
                which,side=joint['cover'],joint['side']
                assert which in ['front','rear'] and side in [-1,1]
                actual_interfaces.add((which,side,joint['Z_mm']))
                assert joint['X_mm']==(size/2+36 if which=='front' else -size/2-24)
                assert set(joint['material_fractions'])=={'root','neck','head'}
                assert all(value>=.99 for value in joint['material_fractions'].values())
                assert joint['outward_pull_collision_mm3']>=.99
            assert actual_interfaces=={(which,side,z) for which,rows in [('front',[20,170]),('rear',[45,155])]
                                       for side in [-1,1] for z in rows}
            assert len(retention['continuous_guide_samples'])==18
            assert all(point['wall_fraction']>=.99 for point in retention['continuous_guide_samples'])
            assert set(retention['latches'])=={'front','rear'}
            for which,hold,blade in [('front',8,[.6,2,74]),('rear',6,[2,.6,54])]:
                latch=retention['latches'][which]
                assert latch['engaged_first_motion_collision_mm3']>.5
                assert latch['fixed_catch_material_fraction']>=.99
                assert latch['released_first_motion_clear'] and latch['hold_released_travel_mm']==hold
                assert latch['underside_tool_path_clear'] and latch['underside_blade_envelope_mm']==blade
                assert latch['blade_actuation_contact_mm3']>.1
                assert latch['blade_released_contact_mm3']>.01
                assert latch['blade_rotation_deg']==(2.8 if which=='front' else -4)
                assert (latch['released_rotation_deg']>0 if which=='front' else latch['released_rotation_deg']<0)
            assert set(variant['print_parts'])==set(IDS)
            directory = 'models/arbi' if key=='round-120-printed-line-1.5' else 'variants/'+key
            control_directory='models/controls' if key=='round-120-printed-line-1.5' else directory+'/controls'
            for which in ['front','rear']:
                filename=control_directory+'/'+which+'-cover-released.stl'
                assert filename in report['mesh_sha256'], 'Missing released-latch control: '+filename
                control=trimesh.load_mesh(io.BytesIO(pack.read(PREFIX+filename)),file_type='stl')
                assert control.is_watertight and control.is_winding_consistent and control.volume>0 and control.body_count==1
            for mid, record in variant['print_parts'].items():
                canonical = trimesh.load_mesh(io.BytesIO(pack.read(PREFIX+directory+'/'+models[mid]['output'])),file_type='stl')
                printed = trimesh.load_mesh(io.BytesIO(pack.read(PREFIX+record['file'])),file_type='stl')
                matrix = np.asarray(record['installed_to_print'])
                assert matrix.shape==(4,4) and np.allclose(matrix[3],[0,0,0,1])
                assert np.allclose(matrix[:3,:3].T@matrix[:3,:3],np.eye(3)) and np.linalg.det(matrix[:3,:3])>0
                canonical.apply_transform(matrix)
                assert np.allclose(canonical.bounds,printed.bounds,atol=.002), (key,mid,'print transformation')
                assert cKDTree(canonical.vertices).query(printed.vertices)[0].max()<.002
                assert cKDTree(printed.vertices).query(canonical.vertices)[0].max()<.002
                assert printed.is_watertight and printed.is_winding_consistent and printed.body_count==1 and printed.volume>0
                assert abs(printed.bounds[0,2])<.002 and np.all(printed.bounds[0]>=-.002)
                assert np.all(printed.extents[:2]<=246) and printed.extents[2]<=256
                assert np.allclose(record['extents_mm'],printed.extents,atol=.002) and record['bed_fits']
                assert record['usable_footprint_mm']==[246,246]
        assert report['negative_controls']['legacy_round_120_tangent_error_mm']==-42.55
        assert report['negative_controls']['m12x180_printed_round_120_missing_engagement_mm']==9.5
        assert report['negative_controls']['unrelieved_front_fascia_collision_mm3']>1
        assert report['negative_controls']['rejected_front_X40_Y5_collision_mm3']>.01
        assert report['negative_controls']['overlong_M12_cut_removes_lug_probe']
        assert report['negative_controls']['overlong_pin_cut_removes_web_probe']
        equilibrium=report['block_equilibrium']
        assert equilibrium['rotation_about_Y_deg']==-45 and equilibrium['pin_to_sheave_length_mm']==42
        assert np.allclose(np.cross(equilibrium['pin_to_sheave_mm'],[10,0,-10]),[0,0,0],atol=1e-8)
        assert np.allclose(equilibrium['rejected_vertical_10N_moment_Nmm'],[0,-420,0])
        assert report['service_paths_mm']==dict(front_cover=[[0,0,-190],[0,100,-190]],rear_cover=[[-80,0,0]])
        figures=json.loads(pack.read(PREFIX+'figure-manifest.json'))
        assert {'covered','open','exploded','concealed-latches','print-left','template',*STAND_FIGURES}==set(figures)
        for name, figure in figures.items():
            assert figure['render_style']=='assembly-line-art-v1'
            with Image.open(output/'figures'/(name+'.png')) as image:
                assert list(image.size)==figure['size']
                assert ImageChops.difference(image.convert('RGB'),Image.new('RGB',image.size,'white')).getbbox(), 'Blank figure'
            for part in figure['parts']:
                assert part['file'] in report['mesh_sha256']
                if name in ['covered','open','exploded']:
                    assert not any(old in part['file'] for old in ['bracket','backing','saddle','connector'])
                assert Path(part['file']).stem!='straps' and 'cover_hardware' not in part['file'], 'Cover metal or tie mesh remains in figure'
        concealed={Path(part['file']).name for part in figures['concealed-latches']['parts']}
        assert {models[mid]['output'] for mid in ['corner-head-printed-front-cover','corner-head-printed-rear-cover']}<=concealed
        pads = [part for part in figures['covered']['parts'] if models['corner-head-printed-rear-pad']['output'] in part['file']]
        assert len(pads)==2 and sorted(part['matrix'][2][3] for part in pads)==[45,155]
        stand=report['stand_instructions']
        assert stand['status']=='concept-unvalidated' and stand['revision']=='0.1.0'
        assert (stand['head_tube_mm'],stand['winch_tube_mm'])==(26,35)
        assert (stand['head_pitch_mm'],stand['winch_pitch_mm'])==(110,120)
        assert set(stand['print_parts'])==set(STAND_IDS)
        assert {Path(name).name for name in report['mesh_sha256'] if name.startswith('models/stand/print/')}=={models[mid]['output'] for mid in STAND_IDS}
        for mid,data in stand['print_parts'].items():
            assert data['quantity_per_stand']==2 and data['quantity_two_stands']==4
            mesh=trimesh.load_mesh(io.BytesIO(pack.read(PREFIX+data['file'])),file_type='stl')
            assert mesh.is_watertight and mesh.is_winding_consistent and mesh.body_count==1 and mesh.volume>0
            assert np.allclose(mesh.bounds[0],[0,0,0],atol=.002)
            assert np.allclose(mesh.extents,data['extents_mm'],atol=.002)
            matrix=np.array(data['print_to_installed'])
            assert np.allclose(matrix[:3,:3].T@matrix[:3,:3],np.eye(3)) and np.linalg.det(matrix[:3,:3])>0
            mesh.apply_transform(matrix)
            # Independently recover the installed clamp row and split plane.
            assert np.allclose(mesh.bounds[:,2],[-25,25],atol=.002)
            assert np.allclose(mesh.bounds[:,1],[-51,51],atol=.002)
            assert abs((mesh.bounds[0,0] if mid.endswith('front') else mesh.bounds[1,0])-(.4 if mid.endswith('front') else -.4))<.002
            name='stand-head' if 'head' in mid else 'stand-winch'
            parts=[p for p in figures[name]['parts'] if p['file']==data['file']]
            assert len(parts)==2, (mid,'one half per row')
            installed=[np.array(p['matrix'])@np.linalg.inv(matrix) for p in parts]
            assert sorted(round(m[2,3],3) for m in installed)==([45,155] if 'head' in mid else [-60,60])
            assert all(np.allclose(m[:3,:3],np.eye(3)) and np.allclose(m[:2,3],[0,0]) for m in installed)
        for name in STAND_FIGURES:
            assert figures[name]['anchors'], name
            assert all(0<=v<=1 for xy in figures[name]['anchors'].values() for v in xy), name
            assert not any('rear-pad' in p['file'] or 'cover' in p['file'] for p in figures[name]['parts'])
        nominal=json.loads(pack.read(PREFIX+'stand-adapter-check.json'))
        assert nominal['revision']=='0.1.0' and nominal['evidence']=='nominal CAD only; unprinted/unloaded'
        assert len(nominal['checks'])>250 and nominal['checkCount']==len(nominal['checks'])
        for name,expected in nominal['sourceSha256'].items():
            assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==expected
            assert hashlib.sha256(pack.read(PREFIX+'source/repository/'+name)).hexdigest()==expected
    pages=PdfReader(output/(ARTIFACT+'-assembly-STL.pdf')).pages
    assert len(pages)==PAGE_COUNT
    for i,page in enumerate(pages,1):
        text=page.extract_text()
        assert f'{i} / {PAGE_COUNT}' in text and 'CONCEPT - UNVALIDATED' in text
        assert f'ARBI / CORNER SUPPORT SET / r{report["revision"]} /' in text, 'Stale booklet revision'
        assert abs(float(page.mediabox.width)-595.276)<1 and abs(float(page.mediabox.height)-841.890)<1
    indoor='\n'.join(page.extract_text() for page in pages[8:])
    for value in ['WT-806','M6 x 60','M6 x 70','M12 x 90','M8 x 40','110 mm','120 mm','253.3 mm','locking nut']:
        assert value in indoor,value
    print(f'Checked corner support: {PAGE_COUNT} A4 pages including WT-806, {len(report["mesh_sha256"])} meshes, {report["checks"]} nominal checks and current source/ZIP hashes.')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output',type=Path)
    check(parser.parse_args().output.resolve())
