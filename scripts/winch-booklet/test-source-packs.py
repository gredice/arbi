"""Portable source ZIP controls for relative and transitive SCAD dependencies."""
import importlib.util
import io
from pathlib import Path
import unittest
import zipfile

spec = importlib.util.spec_from_file_location('booklet', Path(__file__).parents[1] / 'check-booklet.py')
booklet = importlib.util.module_from_spec(spec)
spec.loader.exec_module(booklet)


class SourcePackTests(unittest.TestCase):
    def check_files(self, files):
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w') as pack:
            for name, source in files.items():
                pack.writestr(name, source)
        with zipfile.ZipFile(buffer) as pack:
            booklet.check_pack_dependencies(pack)

    def sources(self, layout):
        base = 'kit/source/' + layout
        return {base + '/part.scad': 'include <lib/arbi.scad>\n',
                base + '/lib/arbi.scad': 'include <../vendor/BOSL2/std.scad>\n',
                base + '/vendor/BOSL2/std.scad': 'use <constants.scad>\n',
                base + '/vendor/BOSL2/constants.scad': 'UP = [0,0,1];\n'}

    def test_both_pack_layouts_resolve_relative_bosl2_includes(self):
        for layout in ['arbi-hardware', 'repository/hardware']:
            self.check_files(self.sources(layout))

    def test_missing_library_and_transitive_dependency_are_rejected(self):
        for name in ['std.scad', 'constants.scad']:
            files = self.sources('arbi-hardware')
            del files['kit/source/arbi-hardware/vendor/BOSL2/' + name]
            with self.assertRaisesRegex(AssertionError, 'Missing packed SCAD dependency'):
                self.check_files(files)

    def test_corner_pack_collects_catalog_camera_dependency(self):
        root = Path(__file__).resolve().parents[2]
        spec = importlib.util.spec_from_file_location('corner_build', root / 'scripts/corner-support/build.py')
        corner = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(corner)
        sources = corner.with_scad_dependencies([root / 'hardware/lib/catalog-visualizations.scad'])
        camera = root / 'hardware/lib/raspberry-pi-camera-module-3.scad'
        self.assertIn(camera, sources)
        files = {'kit/source/repository/' + path.relative_to(root).as_posix(): path.read_text()
                 for path in sources}
        self.check_files(files)
        del files['kit/source/repository/hardware/lib/raspberry-pi-camera-module-3.scad']
        with self.assertRaisesRegex(AssertionError, 'Missing packed SCAD dependency.*raspberry-pi-camera-module-3'):
            self.check_files(files)


if __name__ == '__main__':
    unittest.main()
