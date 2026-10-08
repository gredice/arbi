"""Publish one CAD-derived preview for every registered model."""
import argparse
import hashlib
import json
import re
import subprocess
import tempfile
import zipfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops
import vtk
from csg import components

REPO = Path(__file__).resolve().parents[2]
SIZE = (480, 360)
ASSET = "ARBI-CAD-previews.zip"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def source_hashes(entrypoint):
    """Include shared geometry so unchanged output names cannot hide stale figures."""
    hashes = {}

    def visit(path):
        path = path.resolve()
        relative = path.relative_to(REPO).as_posix()
        if relative in hashes:
            return
        hashes[relative] = digest(path)
        for include in re.findall(r"^\s*(?:include|use)\s*<([^>]+)>", path.read_text(), re.M):
            visit(path.parent / include)

    visit(REPO / entrypoint)
    return hashes


def render(mesh, output):
    meshes = [mesh] if isinstance(mesh, Path) else mesh
    combined = vtk.vtkAppendPolyData()
    for path in meshes:
        reader = vtk.vtkSTLReader()
        reader.SetFileName(str(path))
        reader.Update()
        data = reader.GetOutput()
        if data.GetNumberOfCells() == 0:
            raise ValueError(f"Empty preview mesh: {path}")
        combined.AddInputData(data)
    combined.Update()
    data = combined.GetOutput()
    if data.GetNumberOfCells() == 0:
        raise ValueError("Reference has no visible geometry")

    renderer = vtk.vtkRenderer()
    renderer.SetBackground(1, 1, 1)
    window = vtk.vtkRenderWindow()
    window.SetOffScreenRendering(1)
    window.SetSize(*SIZE)
    window.SetMultiSamples(8)
    window.AddRenderer(renderer)
    try:
        mapper = vtk.vtkPolyDataMapper()
        mapper.SetInputData(data)
        mapper.ScalarVisibilityOff()
        mapper.SetResolveCoincidentTopologyToPolygonOffset()
        actor = vtk.vtkActor()
        actor.SetMapper(mapper)
        actor.GetProperty().SetColor(1, 1, 1)
        actor.GetProperty().LightingOff()
        renderer.AddActor(actor)

        camera = renderer.GetActiveCamera()
        edges = vtk.vtkPolyDataSilhouette()
        edges.SetInputData(data)
        edges.SetCamera(camera)
        edges.SetDirectionToCameraVector()
        edges.SetEnableFeatureAngle(1)
        edges.SetFeatureAngle(34)
        edges.BorderEdgesOn()
        edge_mapper = vtk.vtkPolyDataMapper()
        edge_mapper.SetInputConnection(edges.GetOutputPort())
        edge_mapper.ScalarVisibilityOff()
        outline = vtk.vtkActor()
        outline.SetMapper(edge_mapper)
        outline.GetProperty().SetColor(.12, .12, .12)
        outline.GetProperty().SetLineWidth(1.5)
        outline.GetProperty().LightingOff()
        renderer.AddActor(outline)

        bounds = data.GetBounds()
        points = np.array([[x, y, z] for x in bounds[:2] for y in bounds[2:4] for z in bounds[4:6]])
        center = (points.max(0) + points.min(0)) / 2
        direction = np.array([1., -1., .9])
        direction /= np.linalg.norm(direction)
        right = np.cross(-direction, [0, 0, 1])
        right /= np.linalg.norm(right)
        up = np.cross(right, -direction)
        scale = max(np.ptp((points - center) @ up) / 2,
                    np.ptp((points - center) @ right) / 2 / (SIZE[0] / SIZE[1])) * 1.13
        camera.ParallelProjectionOn()
        camera.SetFocalPoint(*center)
        camera.SetPosition(*(center + direction * max(np.linalg.norm(points.max(0) - points.min(0)) * 2, 1)))
        camera.SetViewUp(0, 0, 1)
        camera.SetParallelScale(scale)
        renderer.ResetCameraClippingRange()
        window.Render()
        capture = vtk.vtkWindowToImageFilter()
        capture.SetInput(window)
        capture.ReadFrontBufferOff()
        capture.Update()
        writer = vtk.vtkPNGWriter()
        writer.SetFileName(str(output))
        writer.SetInputConnection(capture.GetOutputPort())
        writer.Write()
    finally:
        window.Finalize()

    check_image(output)


def check_image(output):
    with Image.open(output) as image:
        rgb = image.convert("RGB")
        background = Image.new("RGB", SIZE, rgb.getpixel((0, 0)))
        if image.size != SIZE or not ImageChops.difference(rgb, background).getbbox():
            raise ValueError(f"Empty or incorrectly sized figure: {output}")


def render_reference(csg, output, work):
    # Use the same opaque white faces and visible outlines as fabrication parts.
    # This inspection mesh is temporary: the registered/released artifact stays CSG.
    # Avoid a costly boolean union of an entire assembly. VTK draws its component
    # meshes together with normal depth occlusion, retaining the assembly seams.
    meshes = []
    for geometry in components(csg.read_text()):
        key = hashlib.sha256(geometry.encode()).hexdigest()
        mesh = work / f"{key}.stl"
        if not mesh.exists():
            source = work / f"{key}.scad"
            source.write_text(geometry + "\n")
            result = subprocess.run(["openscad", "-o", str(mesh), str(source)],
                                    capture_output=True, text=True, timeout=120, check=True)
            if "ERROR:" in result.stderr:
                raise ValueError(result.stderr)
        meshes.append(mesh)
    render(meshes, output)


def build(cad, output):
    registry = json.loads((REPO / "hardware/models.json").read_text())
    version = subprocess.run(["openscad", "--version"], capture_output=True, text=True, check=True)
    label = (version.stdout or version.stderr).strip()
    if label != f"OpenSCAD version {registry['openScadVersion']}":
        raise ValueError(f"Unexpected OpenSCAD version: {label}")
    output.mkdir(parents=True, exist_ok=True)
    manifest = {"schemaVersion": 1, "style": "cad-line-art-v2", "size": SIZE, "models": {}}
    with tempfile.TemporaryDirectory(prefix="arbi-previews-") as temporary:
        work = Path(temporary)
        for model in registry["models"]:
            mesh = cad / model["output"]
            if not mesh.is_file() or not mesh.stat().st_size:
                raise ValueError(f"Missing CAD export: {mesh}")
            figure = f"figures/{model['id']}.png"
            image = work / figure
            image.parent.mkdir(exist_ok=True)
            if mesh.suffix == ".csg":
                render_reference(mesh, image, work)
            else:
                render(mesh, image)
            manifest["models"][model["id"]] = {
                "entrypoint": model["entrypoint"], "revision": model["revision"], "output": model["output"],
                "sourceHashes": source_hashes(model["entrypoint"]), "figure": figure, "sha256": digest(image),
            }
            print(f"Rendered {model['id']}", flush=True)
        (work / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
        with zipfile.ZipFile(output / ASSET, "w", zipfile.ZIP_DEFLATED) as archive:
            for path in sorted(work.rglob("*.png")) + [work / "manifest.json"]:
                archive.write(path, "ARBI-CAD-previews/" + path.relative_to(work).as_posix())
    print(f"Packaged {len(manifest['models'])} figures in {output / ASSET}", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cad-dir", type=Path, required=True, help="Output from cad:check --output-dir")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    build(args.cad_dir.resolve(), args.output.resolve())
