"""Independently validate the generated corner support PDF and source/STL pack."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile

from PIL import Image, ImageChops
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[2]
ARTIFACT = 'ARBI-corner-support'
PREFIX = ARTIFACT+'-STL-pack/'


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
        outputs = {model['output'] for model in registry['models'] if model['id'].startswith('corner-head-') and model['artifactRole']=='fabrication'}
        current = {Path(name).name for name in report['mesh_sha256'] if name.startswith('models/arbi/')}
        assert outputs==current, 'Wrong fabrication revisions'
        assert len(report['variants'])==5 and report['checks']>400
        for key, variant in report['variants'].items():
            assert variant['tip_projection_mm']>=3.5
            if 'angle-200' in key:assert abs(variant['tangent_error_mm'])<.001
        figures=json.loads(pack.read(PREFIX+'figure-manifest.json'))
        for name, figure in figures.items():
            assert figure['render_style']=='assembly-line-art-v1'
            with Image.open(output/'figures'/(name+'.png')) as image:
                assert list(image.size)==figure['size']
                assert ImageChops.difference(image.convert('RGB'),Image.new('RGB',image.size,'white')).getbbox(), 'Blank figure'
            for part in figure['parts']:assert part['file'] in report['mesh_sha256']
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
