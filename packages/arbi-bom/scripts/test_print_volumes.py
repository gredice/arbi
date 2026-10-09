"""Independent 1 cm³ tetrahedron and invalid-mesh controls for volume capture."""
import importlib.util
import struct
import tempfile
import unittest
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
