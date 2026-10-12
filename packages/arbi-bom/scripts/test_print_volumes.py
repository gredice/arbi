"""Independent 1 cm³ tetrahedron and invalid-mesh controls for volume capture."""
import importlib.util
import hashlib
import json
import struct
import tempfile
import unittest
import zipfile
from pathlib import Path

spec = importlib.util.spec_from_file_location('capture', Path(__file__).with_name('capture-print-volumes.py'))
capture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(capture)

# Right tetrahedron: axis lengths 10, 10, 60 mm => 1000 mm³.
a, b, c, d = (0, 0, 0), (10, 0, 0), (0, 10, 0), (0, 0, 60)
triangles = [(a, c, b), (a, b, d), (a, d, c), (b, c, d)]


def ascii_stl(faces):
    return ('solid test\n' + ''.join('facet normal 0 0 0\nouter loop\n' +
        ''.join('vertex %s %s %s\n' % v for v in face) + 'endloop\nendfacet\n'
        for face in faces) + 'endsolid test\n').encode()


class VolumeTests(unittest.TestCase):
    def test_release_reuse_pins_transitive_print_sources_and_ignores_unrelated_purchased_geometry(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp).resolve()
            previous_root = capture.ROOT
            capture.ROOT = root
            self.addCleanup(setattr, capture, 'ROOT', previous_root)
            print_model = dict(id='print', revision='1.0.0', entrypoint='hardware/print.scad',
                               output='print-r1.0.0.stl', artifactRole='fabrication')
            bought_model = dict(id='bought', revision='1.0.0', entrypoint='hardware/bought.scad',
                                output='bought-r1.0.0.stl', artifactRole='visualization')
            old_registry = {'models': [print_model, bought_model]}
            new_registry = {'models': [print_model, {**bought_model, 'revision': '2.0.0'}]}
            files = {'hardware/models.json': json.dumps(old_registry).encode(),
                     'hardware/print.scad': b'include <lib/common.scad>\npart();',
                     'hardware/lib/common.scad': b'use <nested.scad>\nmodule part() {cube(1);}',
                     'hardware/lib/nested.scad': b'module helper() {}',
                     'hardware/bought.scad': b'old_reference();'}
            inputs = {p: hashlib.sha256(raw).hexdigest() for p, raw in files.items()}
            for p, raw in files.items():
                path = root / p
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(raw)
            (root / 'hardware/models.json').write_text(json.dumps(new_registry))
            (root / 'hardware/bought.scad').write_text('changed_reference();')
            catalog = root / 'bom/catalog/fabrication.json'
            catalog.parent.mkdir(parents=True)
            catalog.write_text(json.dumps({'recipes': [{'components': [{'modelId': 'print'}]}]}))
            release_dir = root / 'release'
            release_dir.mkdir()
            commit = 'a' * 40
            release = dict(version='0.1.0', commit=commit, inputs=inputs)
            (release_dir / 'cad-release.json').write_text(json.dumps(release))
            (release_dir / print_model['output']).write_bytes(ascii_stl(triangles))
            archive = release_dir / f'cad-sources-{commit}.zip'
            with zipfile.ZipFile(archive, 'w') as source:
                source.writestr('hardware/models.json', files['hardware/models.json'])
            assets = [release_dir / 'cad-release.json', release_dir / print_model['output'], archive]
            (release_dir / 'SHA256SUMS.txt').write_text(''.join(hashlib.sha256(p.read_bytes()).hexdigest() + '  ' + p.name + '\n' for p in assets))
            capture.capture(release_dir)
            geometry = json.loads(catalog.read_text())['geometry']
            self.assertEqual(geometry['models'][0]['volumeCm3'], '1.000000')
            self.assertEqual(set(geometry['sourceHashes']), set(inputs) - {'hardware/bought.scad'})
            original = catalog.read_bytes()
            (root / 'hardware/lib/nested.scad').write_text('changed_helper();')
            with self.assertRaisesRegex(ValueError, 'Release does not match current CAD'):
                capture.capture(release_dir)
            self.assertEqual(catalog.read_bytes(), original)

    def test_local_booklet_source_copies_are_not_canonical_geometry_inputs(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            paths = ['hardware/models.json', 'hardware/lib/original.scad',
                     'hardware/generated/booklet/source/arbi-hardware/lib/original.scad']
            for name in paths:
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text('source')
            self.assertEqual(capture.canonical_inputs(root), [root / name for name in paths[:2]])
            (root / paths[2]).write_text('outdated source copy')
            self.assertEqual(capture.canonical_inputs(root), [root / name for name in paths[:2]])

    def test_registry_archival_requires_unchanged_costed_model_identity(self):
        model = dict(id='current', revision='1.0.0', entrypoint='hardware/current.scad',
                     output='current-r1.0.0.stl', artifactRole='fabrication')
        original = {'models': [model, {**model, 'id': 'historical'}]}
        current = {'models': [model], 'archivedModels': [{**model, 'id': 'historical'}]}
        capture.verify_registry_metadata(original, current, {'current'})
        for key in ['revision', 'entrypoint', 'output', 'artifactRole']:
            with self.assertRaises(ValueError):
                capture.verify_registry_metadata(original, {'models': [{**model, key: 'changed'}]}, {'current'})
        with self.assertRaises(ValueError):
            capture.verify_registry_metadata(original, current, {'historical'})

    def test_ascii_and_binary_volume_units(self):
        self.assertEqual(capture.volume_cm3(ascii_stl(triangles)), '1.000000')
        raw = b'test'.ljust(80, b'\0') + struct.pack('<I', len(triangles))
        for face in triangles:
            raw += struct.pack('<12fH', 0, 0, 0, *sum(face, ()), 0)
        self.assertEqual(capture.volume_cm3(raw), '1.000000')

    def test_open_reversed_and_duplicate_triangles_fail(self):
        for faces in [triangles[:-1], [tuple(reversed(t)) for t in triangles], triangles + [triangles[0]]]:
            with self.assertRaises(ValueError):
                capture.volume_cm3(ascii_stl(faces))


if __name__ == '__main__':
    unittest.main()
