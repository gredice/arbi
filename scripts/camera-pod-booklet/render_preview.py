"""Product-color previews from the same registered meshes and assembly transforms.

These are CAD views, not concept artwork or physical acceptance evidence.
"""
import json
import numpy as np
import vtk
from integration import ROOT, assembly, ENCLOSURE


def render(name, parts, direction, size=(1400, 1100)):
    renderer = vtk.vtkRenderer()
    renderer.SetBackground(1, 1, 1)
    lights = vtk.vtkLightKit()
    lights.SetKeyLightIntensity(.85)
    lights.SetKeyToFillRatio(1.5)
    lights.SetKeyToHeadRatio(2)
    lights.SetKeyLightWarmth(.5)
    lights.SetFillLightWarmth(.5)
    lights.AddLightsToRenderer(renderer)
    bounds = []
    for part in parts:
        reader = vtk.vtkSTLReader()
        reader.SetFileName(str(ROOT / part['file']))
        reader.Update()
        if part['name'] == 'camera':
            # Color the actual simplified camera surfaces by source height:
            # board green, optical housing dark, existing lens-tip facets a
            # subdued glass colour, rear connector neutral metal. No overlay or
            # substitute lens geometry is added to make the optical face legible.
            entry = next(e for e in json.loads((ROOT / 'mesh-manifest.json').read_text())
                         if e['model_id'] == part['model'])
            offset = entry['export_translation_mm'][2]
            data = reader.GetOutput()
            colors = vtk.vtkUnsignedCharArray()
            colors.SetNumberOfComponents(3)
            for i in range(data.GetNumberOfCells()):
                cell = data.GetCell(i)
                z = np.mean([data.GetPoint(cell.GetPointId(j))[2]
                             for j in range(cell.GetNumberOfPoints())]) - offset
                colors.InsertNextTuple3(*((40, 62, 69) if z > 8.5
                                         else (25, 30, 32) if z > 1.12
                                         else (145, 150, 146) if z < 0 else (45, 100, 65)))
            data.GetCellData().SetScalars(colors)
        normals = vtk.vtkPolyDataNormals()
        normals.SetInputConnection(reader.GetOutputPort())
        normals.SetFeatureAngle(35)
        normals.SplittingOn()
        mapper = vtk.vtkPolyDataMapper()
        mapper.SetInputConnection(normals.GetOutputPort())
        mapper.SetScalarVisibility(part['name'] == 'camera')
        actor = vtk.vtkActor()
        actor.SetMapper(mapper)
        matrix = vtk.vtkMatrix4x4()
        matrix.DeepCopy(np.array(part['matrix']).ravel())
        actor.SetUserMatrix(matrix)
        material = actor.GetProperty()
        material.SetColor(*part['color'])
        material.SetAmbient(.22)
        material.SetDiffuse(.72)
        material.SetSpecular(.22)
        material.SetSpecularPower(30)
        renderer.AddActor(actor)
        bounds.append(np.array(actor.GetBounds()).reshape(3, 2))
    bounds = np.array(bounds)
    low, high = bounds[:, :, 0].min(0), bounds[:, :, 1].max(0)
    centre = (low + high) / 2
    direction = np.array(direction, dtype=float)
    direction /= np.linalg.norm(direction)
    camera = renderer.GetActiveCamera()
    camera.ParallelProjectionOn()
    camera.SetFocalPoint(*centre)
    camera.SetPosition(*(centre + direction * 600))
    camera.SetViewUp(0, 1, 0) if abs(direction[2]) > .99 else camera.SetViewUp(0, 0, 1)
    renderer.ResetCamera()
    camera.Zoom(1.14)
    window = vtk.vtkRenderWindow()
    window.SetOffScreenRendering(1)
    window.SetSize(*size)
    window.SetMultiSamples(8)
    window.AddRenderer(renderer)
    window.Render()
    capture = vtk.vtkWindowToImageFilter()
    capture.SetInput(window)
    capture.ReadFrontBufferOff()
    capture.Update()
    writer = vtk.vtkPNGWriter()
    writer.SetFileName(str(ROOT / 'figures' / (name + '.png')))
    writer.SetInputConnection(capture.GetOutputPort())
    writer.Write()
    window.Finalize()
    return {'file': 'figures/' + name + '.png', 'direction': direction.tolist(),
            'parts': parts, 'basis': 'registered CAD meshes; nominal hardware'}


def main():
    if not ENCLOSURE:
        return
    (ROOT / 'figures').mkdir(exist_ok=True)
    views = {}
    for name, pan, tilt, cover, direction in [
        ('product-hero', 0, 70, True, (.7, 1, .55)),
        ('product-neutral', 0, 0, True, (.7, 1, .55)),
        ('product-front', 0, 70, True, (0, 1, 0)),
        # At tilt70 the real optical axis is (0,sin70,-cos70). Retain the full
        # assembly in this diagnostic so its housings can still obscure the eye.
        ('product-eye-aligned', 0, 70, True,
         (0, np.sin(np.radians(70)), -np.cos(np.radians(70)))),
        ('product-side', 0, 0, True, (1, 0, .12)),
        ('product-underside', 0, 0, True, (.7, 1, -.9)),
        ('product-bottom', 0, 0, True, (0, 0, -1)),
        ('product-underside-pan90', 90, 0, True, (.7, 1, -.9)),
        ('product-electronics', 0, 0, False, (0, 0, 1)),
    ]:
        views[name] = render(name, assembly(pan, tilt, cover), direction)
        views[name].update(pan_deg=pan, tilt_deg=tilt, hood=cover)
    (ROOT / 'preview-manifest.json').write_text(json.dumps(views, indent=2) + '\n')


if __name__ == '__main__':
    main()
