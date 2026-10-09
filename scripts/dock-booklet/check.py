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
        registry=json.loads((ROOT/'hardware/models.json').read_text());models={m['id']:m for m in registry['models']}
        assert report['fabrication_ids']==ids and report['printed_model_ids']==ids
        assert report['bought_solid_components']==125
        assert report['status']=='concept-unvalidated' and report['checks']>500
        assert report['printer_envelope_mm']==[256]*3 and report['bed_edge_reserve_mm']==5
        def mesh(name):return trimesh.load_mesh(io.BytesIO(pack.read(PREFIX+name)),file_type='stl')
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
        assert report['negative_controls']['closed_fork_descent_mm3']>1
        assert report['negative_controls']['uncut_guide_line_collision_mm3']>1
        figures=json.loads(pack.read(PREFIX+'figure-manifest.json'))
        assert set(figures)=={'covered','open','exploded','arm','latch','pod','roof','inventory'}
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
    pages=PdfReader(output/(ARTIFACT+'-assembly-STL.pdf')).pages
    assert len(pages)==9
    for i,page in enumerate(pages,1):
        content=page.extract_text();assert f'{i} / 9' in content and 'CONCEPT - UNVALIDATED' in content
        assert abs(float(page.mediabox.width)-595.276)<1 and abs(float(page.mediabox.height)-841.890)<1
    print(f'Checked dock: 9 A4 pages, {len(ids)} fabrication models, {report["checks"]} nominal checks, current complete source/STL pack.')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('output',type=Path)
    check(parser.parse_args().output.resolve())
