"""Check PDF pagination, current mesh revisions, source hashes and paired ZIP contents."""
from pathlib import Path
import argparse
import hashlib
import json
import zipfile

from PIL import Image, ImageChops
from pypdf import PdfReader


def check(root, variant):
    artifact, pages, revision, label = {
        'winch': ('ARBI-winch', 18, 7, 'PASSIVE / COVER KIT'),
        'bench': ('ARBI-payload', 14, 4, 'MOUNT SET / BENCH EDITION'),
        'enclosure': ('ARBI-payload-enclosure', 16, 2, 'RAIN / SPLASH EDITION'),
    }[variant]
    pdf = root / (artifact + '-assembly-STL.pdf')
    reader = PdfReader(pdf)
    assert len(reader.pages) == pages, (pdf, len(reader.pages), pages)
    for number, page in enumerate(reader.pages, 1):
        content = page.extract_text()
        assert f'{number:02d} / {pages}' in content, (pdf, number, 'page footer')
        assert f'Revision {revision} |' in content, (pdf, number, 'revision')
        assert label in content, (pdf, number, 'configuration header')
        assert abs(float(page.mediabox.width) - 595.276) < 1
        assert abs(float(page.mediabox.height) - 841.890) < 1
    provenance = json.loads((root / 'source-provenance.json').read_text())
    assert provenance['booklet_revision'] == revision
    assert provenance['render_style'] == 'assembly-line-art-v1'
    registry = json.loads((root / 'source/arbi-hardware/models.json').read_text())
    outputs = {m['id']: m['output'] for m in registry['models']}
    manifests = ['arbi-mesh-manifest.json', 'reference-mesh-manifest.json'] if variant == 'winch' else ['mesh-manifest.json']
    meshes = [entry for name in manifests for entry in json.loads((root / name).read_text())]
    for entry in meshes:
        path = root / entry['file']
        assert hashlib.sha256(path.read_bytes()).hexdigest() == entry['stl_sha256'], path
        if entry['file'].startswith(('models/arbi/', 'models/printable/')):
            assert path.name == outputs[entry.get('model_id', entry['id'])], path
    for name, digest in provenance['source_hashes'].items():
        assert hashlib.sha256((root / name).read_bytes()).hexdigest() == digest, name
    figures = json.loads((root / 'figure-manifest.json').read_text())
    for name, figure in figures.items():
        assert figure['render_style'] == 'assembly-line-art-v1', name
        with Image.open(root / 'figures' / (name + '.png')) as image:
            assert list(image.size) == figure['size'], name
            rgb = image.convert('RGB')
            assert ImageChops.difference(rgb, Image.new('RGB', image.size, 'white')).getbbox(), (name, 'blank figure')
            red, green, blue = rgb.split()
            assert not ImageChops.difference(red, green).getbbox() and not ImageChops.difference(red, blue).getbbox(), (name, 'colored figure')
    with zipfile.ZipFile(root / (artifact + '-STL-pack.zip')) as archive:
        assert archive.testzip() is None
        prefix = artifact + '-STL-pack/'
        assert archive.read(prefix + pdf.name) == pdf.read_bytes(), 'PDF/ZIP mismatch'
        archived_meshes = {name[len(prefix):] for name in archive.namelist() if name.endswith('.stl')}
        assert archived_meshes == {entry['file'] for entry in meshes}, 'Stale or missing STL'
        for entry in meshes:
            assert hashlib.sha256(archive.read(prefix + entry['file'])).hexdigest() == entry['stl_sha256']
    print(f'Checked {artifact}: {pages} A4 pages, {len(meshes)} meshes, {len(figures)} line-art figures.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('root', type=Path)
    parser.add_argument('--variant', required=True, choices=['winch', 'bench', 'enclosure'])
    args = parser.parse_args()
    check(args.root.resolve(), args.variant)
