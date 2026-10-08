import unittest
from csg import components


class ComponentTests(unittest.TestCase):
    def test_boolean_subtrees_and_world_transforms_are_preserved(self):
        source = '''group() {
multmatrix([[1,0,0,10],[0,1,0,0],[0,0,1,0],[0,0,0,1]]) {
color([0.1,0.1,0.1,1]) {
union() {
difference() {
cube(size=[10,10,10], center=false);
cylinder(h=20, r=2, center=true);
}
intersection() {
sphere(r=3);
cube(size=[4,4,4], center=true);
}
}
}
}
}'''
        result = components(source)
        self.assertEqual(len(result), 2)
        for geometry in result:
            self.assertTrue(geometry.startswith('multmatrix('))
            self.assertIn('10]', geometry)
            self.assertNotIn('color(', geometry)
        self.assertIn('difference()', result[0])
        self.assertIn('cube(', result[0])
        self.assertIn('cylinder(', result[0])
        self.assertIn('intersection()', result[1])
        self.assertIn('sphere(', result[1])

    def test_background_geometry_is_excluded_and_string_braces_are_not_blocks(self):
        result = components('''%group() {
cube(size=[100,100,100]);
}
linear_extrude(height=1) {
text(text="{camera}");
}''')
        self.assertEqual(len(result), 1)
        self.assertIn('text(text="{camera}")', result[0])
        self.assertNotIn('cube(', result[0])

    def test_unknown_or_unbalanced_input_fails_instead_of_dropping_geometry(self):
        for source in ['group() {', '}', 'unexpected geometry']:
            with self.assertRaises(ValueError):
                components(source)


if __name__ == '__main__':
    unittest.main()
