import tempfile
import unittest
from pathlib import Path

import vtk

from build import write_reference_mesh


class ReferencePreviewTests(unittest.TestCase):
    def test_inspection_mesh_preserves_disconnected_surfaces_and_world_placement(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            meshes = []
            for index, center in enumerate([(0, 0, 0), (20, -10, 30)]):
                cube = vtk.vtkCubeSource()
                cube.SetCenter(*center)
                cube.SetXLength(2)
                cube.SetYLength(4)
                cube.SetZLength(6)
                triangles = vtk.vtkTriangleFilter()
                triangles.SetInputConnection(cube.GetOutputPort())
                writer = vtk.vtkSTLWriter()
                writer.SetFileName(str(root / f"{index}.stl"))
                writer.SetInputConnection(triangles.GetOutputPort())
                self.assertEqual(writer.Write(), 1)
                meshes.append(root / f"{index}.stl")

            target = root / "references" / "assembly.stl"
            write_reference_mesh(meshes, target)
            reader = vtk.vtkSTLReader()
            reader.SetFileName(str(target))
            reader.Update()
            data = reader.GetOutput()
            self.assertEqual(data.GetNumberOfCells(), 24)
            self.assertEqual(data.GetBounds(), (-1, 21, -12, 2, -3, 33))
            regions = vtk.vtkPolyDataConnectivityFilter()
            regions.SetInputData(data)
            regions.SetExtractionModeToAllRegions()
            regions.Update()
            self.assertEqual(regions.GetNumberOfExtractedRegions(), 2)
            self.assertEqual(target.stat().st_size, 84 + 24 * 50)

    def test_empty_reference_cannot_be_published(self):
        with tempfile.TemporaryDirectory() as temporary:
            with self.assertRaisesRegex(ValueError, "no visible geometry"):
                write_reference_mesh([], Path(temporary) / "empty.stl")


if __name__ == "__main__":
    unittest.main()
