import unittest
from csg import components, colored_components


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

    def test_nested_colors_and_boolean_cuts_keep_component_finishes(self):
        source = '''multmatrix([[1,0,0,10],[0,1,0,0],[0,0,1,0],[0,0,0,1]]) {
color([0.12,0.14,0.15,1]) {
union() {
cube(size=[10,10,1]);
color([0.66,0.7,0.73,1]) {
difference() {
cylinder(h=10,r=2);
cylinder(h=12,r=1);
}
}
}
}
}'''
        parts = colored_components(source)
        self.assertEqual([c for _, c in parts], [(0.12,0.14,0.15), (0.66,0.7,0.73)])
        self.assertIn('difference()', parts[1][0])
        self.assertIn('h=12', parts[1][0])
        self.assertTrue(all(g.startswith('multmatrix(') for g, _ in parts))

    def test_multicolor_difference_distributes_every_cut_in_original_coordinates(self):
        parts = colored_components('''difference() {
union() {
color([0.13,0.32,0.16,1]) {
cube(size=[25,24,1]);
}
color([0.12,0.14,0.15,1]) {
multmatrix([[1,0,0,5],[0,1,0,0],[0,0,1,0],[0,0,0,1]]) {
cube(size=[8,8,6]);
}
}
}
cylinder(h=20,r=1);
}''')
        self.assertEqual(len(parts), 2)
        for geometry, _ in parts:
            self.assertTrue(geometry.startswith('difference()'))
            self.assertIn('cylinder(h=20,r=1);', geometry)
        self.assertIn('multmatrix(', parts[1][0])

    def test_invalid_color_is_rejected(self):
        for value in ('[2,0,0,1]', '[0,0,0]', '[0,0,0,null]'):
            with self.assertRaises(ValueError):
                colored_components(f'color({value}) {{\ncube(size=[1,1,1]);\n}}')


if __name__ == '__main__':
    unittest.main()
