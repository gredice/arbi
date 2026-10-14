import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from build import mesh_data, write_reference_mesh
from source_appearances import compile_sources, source_appearance, surface

STL = '''solid sample
facet normal 0 0 1
outer loop
vertex 0 0 0
vertex 1 0 0
vertex 0 1 1
endloop
endfacet
endsolid sample
'''


class SourceAppearanceTests(unittest.TestCase):
    def test_single_finish_reuses_released_geometry_and_never_boolean_unions_it(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            mesh = root / 'sample.stl'
            mesh.write_text(STL)
            model = dict(id='sample', output=mesh.name)
            result = source_appearance(model, (root / 'sample.csg', [(.66,.7,.73)]),
                                       root, root, {}, mesh_data, write_reference_mesh)
            self.assertEqual((root / result['parts'][0]['mesh']).read_bytes(), mesh.read_bytes())
            self.assertEqual(result['envelope'], [1,1,1])
            self.assertEqual(result['parts'][0]['material']['metalness'], .8)

    def test_equal_geometry_can_have_different_colors_without_losing_world_placement(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            mesh = root / 'sample.stl'
            mesh.write_text(STL)
            csg = root / 'sample.csg'
            result = source_appearance(dict(id='sample', output=csg.name),
                                       (csg, [(.66,.7,.73), (.12,.14,.15)]), root, root,
                                       {csg: [mesh, mesh]}, mesh_data, write_reference_mesh)
            self.assertEqual(len(result['parts']), 2)
            self.assertEqual([p['material']['metalness'] for p in result['parts']], [.8,0])
            for part in result['parts']:
                self.assertEqual((root / part['mesh']).read_bytes(), mesh.read_bytes())

    def test_explicit_transmissive_appearance_keeps_its_authoritative_path(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / 'servo.scad').write_text('// ARBI_MODEL_APPEARANCE')
            with patch('source_appearances.checked_export') as export:
                result = compile_sources([dict(id='servo', entrypoint='servo.scad')], root, root, root, 1)
            self.assertEqual(result, {})
            export.assert_not_called()

    def test_shells_boards_and_wood_are_not_metal_while_silver_and_brass_are(self):
        for color in [(.94,.94,.92), (.13,.32,.16), (.63,.53,.39), (.72,.025,.035)]:
            self.assertEqual(surface(color)['metalness'], 0)
        self.assertEqual(surface((.72,.55,.22))['metalness'], .8)


if __name__ == '__main__':
    unittest.main()
