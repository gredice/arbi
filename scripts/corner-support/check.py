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
        assert report['fabrication_ids']==IDS and report['printed_model_ids']==IDS
        assert report['configuration']=='Printed round 120 / passive line; concept-unvalidated'
        assert set(report['variants'])==VARIANTS and report['checks']>400
        assert report['printer_envelope_mm']==[256,256,256] and report['bed_edge_reserve_mm']==5
        for key, variant in report['variants'].items():
            assert variant['tip_projection_mm']>=3.5
            assert abs(variant['tangent_error_mm'])<.001
            assert variant['crossbar_length_mm']==100 and variant['crossbar_tip_projection_mm']>=3.5
            assert len(variant['wall_probes_mm3'])==4 and all(v>=.99 for v in variant['wall_probes_mm3'].values())
            assert len(variant['pin_bore_probes_mm3'])==2 and all(v<=.01 for v in variant['pin_bore_probes_mm3'].values())
            assert abs(variant['sheave_center_Z_mm']-(165-40/np.sqrt(2)))<.001
            assert abs(variant['line_center_Z_from_mesh_mm']-variant['sheave_center_Z_mm'])<.001
            assert set(variant['print_parts'])==set(IDS)
            directory = 'models/arbi' if key=='round-120-printed-line-1.5' else 'variants/'+key
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
        assert equilibrium['rotation_about_Y_deg']==-45 and equilibrium['pin_to_sheave_length_mm']==40
        assert np.allclose(np.cross(equilibrium['pin_to_sheave_mm'],[10,0,-10]),[0,0,0],atol=1e-8)
        assert np.allclose(equilibrium['rejected_vertical_10N_moment_Nmm'],[0,-400,0])
        assert report['service_paths_mm']==dict(front_cover=[[0,0,-190],[0,100,-190]],rear_cover=[[-80,0,0]])
        figures=json.loads(pack.read(PREFIX+'figure-manifest.json'))
        assert {'covered','open','exploded','print-left','template'}==set(figures)
        for name, figure in figures.items():
            assert figure['render_style']=='assembly-line-art-v1'
            with Image.open(output/'figures'/(name+'.png')) as image:
                assert list(image.size)==figure['size']
                assert ImageChops.difference(image.convert('RGB'),Image.new('RGB',image.size,'white')).getbbox(), 'Blank figure'
            for part in figure['parts']:
                assert part['file'] in report['mesh_sha256']
                if name in ['covered','open','exploded']:
                    assert not any(old in part['file'] for old in ['bracket','backing','saddle','connector'])
        pads = [part for part in figures['covered']['parts'] if models['corner-head-printed-rear-pad']['output'] in part['file']]
        assert len(pads)==2 and sorted(part['matrix'][2][3] for part in pads)==[45,155]
    pages=PdfReader(output/(ARTIFACT+'-assembly-STL.pdf')).pages
    assert len(pages)==8
    for i,page in enumerate(pages,1):
        text=page.extract_text()
        assert f'{i} / 8' in text and 'CONCEPT - UNVALIDATED' in text
        assert abs(float(page.mediabox.width)-595.276)<1 and abs(float(page.mediabox.height)-841.890)<1
    print(f'Checked corner support: 8 A4 pages, {len(report["mesh_sha256"])} meshes, {report["checks"]} nominal checks and current source/ZIP hashes.')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output',type=Path)
    check(parser.parse_args().output.resolve())
