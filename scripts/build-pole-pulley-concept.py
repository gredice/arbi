"""Export, inspect and preview the r0.1.0 round-pole mount concept.

Requires OpenSCAD 2021.01 on PATH and Python numpy, trimesh, manifold3d, vtk.
Run from any directory; outputs default to ignored hardware/generated/.
Checks establish nominal mesh geometry only, not physical acceptance.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import zipfile

import numpy as np
import trimesh
import vtk

ROOT = Path(__file__).resolve().parents[1]
LIBRARY = ROOT / 'hardware/lib/pole-pulley-mount.scad'
ASSEMBLY = ROOT / 'hardware/assemblies/corner-station'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, default=ROOT / 'hardware/generated/pole-pulley-mount')
args = parser.parse_args()
OUT = args.output.resolve()
OUT.mkdir(parents=True, exist_ok=True)
generated_outputs = []
version = subprocess.run(['openscad', '--version'], capture_output=True, text=True, check=True)
assert (version.stdout + version.stderr).strip() == 'OpenSCAD version 2021.01'


def export(source, target, defines=()):
    command = ['openscad', '-o', str(target)]
    for define in defines:
        command += ['-D', define]
    run = subprocess.run(command + [str(source)], capture_output=True, text=True, timeout=120)
    diagnostics = run.stdout + run.stderr
    assert run.returncode == 0 and 'ERROR:' not in diagnostics and 'WARNING:' not in diagnostics, diagnostics
    assert target.exists() and target.stat().st_size > 0, target
    generated_outputs.append(target)


def overlap(a, b):
    intersection = trimesh.boolean.intersection([a, b], engine='manifold')
    if intersection.is_empty:
        return 0.0
    # Coincident contact can produce zero-volume faces; do not request a centroid.
    triangles = intersection.triangles
    return abs(np.einsum('ij,ij->i', triangles[:, 0], np.cross(triangles[:, 1], triangles[:, 2])).sum() / 6)


def cylinder(radius, height, center, axis='z'):
    mesh = trimesh.creation.cylinder(radius=radius, height=height, sections=128)
    if axis != 'z':
        mesh.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [0, 1, 0] if axis == 'x' else [1, 0, 0]))
    mesh.apply_translation(center)
    return mesh


report = {'revision': '0.1.0', 'status': 'concept-unvalidated', 'openscad': '2021.01', 'variants': {}}
for diameter in [100, 120, 140]:
    pieces = {}
    result = {}
    for role in ['front', 'rear']:
        name = f'pole-pulley-mount-{role}-r0.1.0'
        target = OUT / (name + ('' if diameter == 120 else f'-pole-{diameter}') + '.stl')
        export(ASSEMBLY / f'pole-pulley-mount-{role}.scad', target, [f'pole_diameter_mm={diameter}'])
        mesh = trimesh.load_mesh(target)
        assert mesh.is_watertight and mesh.body_count == 1 and mesh.volume > 0, (diameter, role)
        assert abs(mesh.bounds[0, 2]) < 1e-5, (diameter, role, mesh.bounds)
        pieces[role] = mesh
        result[role] = {'bounds_mm': mesh.bounds.round(3).tolist(), 'volume_mm3': round(mesh.volume, 3), 'watertight': True, 'bodies': 1}
    assert overlap(pieces['front'], pieces['rear']) < 0.001
    pole = cylinder(diameter / 2, 180, [0, 0, 45])
    for role, mesh in pieces.items():
        assert overlap(mesh, pole) < 0.001, (diameter, role, 'pole interference')
        # Nominal M8 shanks and 18 mm washers, independent of source hole meshes.
        for y in [-(diameter / 2 + 20.25), diameter / 2 + 20.25]:
            for z in [22, 68]:
                assert overlap(mesh, cylinder(4, 70, [0, y, z], 'x')) < 0.001
                for x in [-20.5, 20.5]:
                    assert overlap(mesh, cylinder(9, 1.98, [x, y, z], 'x')) < 0.001
    pin = cylinder(4, 80, [diameter / 2 + 110, 0, 60], 'y')
    assert overlap(pieces['front'], pin) < 0.001
    # An unobstructed 22 mm nominal clevis gap around a 12 mm eye plus spacers.
    eye_stack = cylinder(10, 21.98, [diameter / 2 + 110, 0, 60], 'y')
    assert overlap(pieces['front'], eye_stack) < 0.001
    result['clearance_checks'] = 'No nominal pole, half-to-half, bolt, washer or eye-stack interference.'
    report['variants'][str(diameter)] = result
    print(f'Pole {diameter} mm: both halves single watertight solids; nominal interface checks passed.', flush=True)

export(ASSEMBLY / 'pole-pulley-mount-assembly.scad', OUT / 'pole-pulley-mount-assembly-r0.1.0.csg')
references = {
    'pole': 'translate([0,0,-160]) cylinder(d=120,h=310,$fn=128);',
    'clamp-hardware': 'ppm_clamp_hardware();',
    'pin-hardware': 'ppm_pin_hardware();',
    'pulley': 'ppm_pulley_reference();',
    'line': 'ppm_line_reference();',
}
with tempfile.TemporaryDirectory(prefix='arbi-pulley-reference-') as temp:
    for name, call in references.items():
        source = Path(temp) / f'{name}.scad'
        source.write_text(f'include <{LIBRARY.as_posix()}>\n{call}\n')
        export(source, OUT / f'reference-{name}.stl')

colors = {'front': [.12, .14, .15], 'rear': [.12, .14, .15], 'pole': [.63, .53, .39],
          'clamp-hardware': [.66, .70, .73], 'pin-hardware': [.66, .70, .73],
          'pulley': [.45, .49, .51], 'line': [.12, .14, .15]}
files = {role: OUT / f'pole-pulley-mount-{role}-r0.1.0.stl' for role in ['front', 'rear']}
files.update({name: OUT / f'reference-{name}.stl' for name in references})
meshes = {name: trimesh.load_mesh(file) for name, file in files.items()}
for name in ['pulley', 'line', 'clamp-hardware', 'pin-hardware']:
    for role in ['front', 'rear']:
        assert overlap(meshes[role], meshes[name]) < 0.001, (role, name, 'reference interference')
report['assembly_checks'] = 'No default mount interference with nominal pulley, line or metal hardware.'

scene = trimesh.Scene()
for name, mesh in meshes.items():
    mesh.visual.face_colors = [*[round(c * 255) for c in colors[name]], 255]
    scene.add_geometry(mesh, node_name=name, geom_name=name)
scene.apply_scale(0.001)  # glTF uses metres; CAD/STL sources remain millimetres.
scene.metadata = {'units': 'm', 'status': 'concept-unvalidated', 'revision': '0.1.0'}
glb_path = OUT / 'pole-pulley-mount-assembly-r0.1.0.glb'
glb_path.write_bytes(scene.export(file_type='glb'))
generated_outputs.append(glb_path)


def text_actor(renderer, text, x, y, size, color=(.12, .14, .15)):
    actor = vtk.vtkTextActor()
    actor.SetInput(text)
    actor.SetPosition(x, y)
    actor.GetTextProperty().SetFontSize(size)
    actor.GetTextProperty().SetColor(*color)
    renderer.AddViewProp(actor)


def render(name, exploded=False):
    renderer = vtk.vtkRenderer()
    renderer.SetBackground(.972, .969, .955)
    window = vtk.vtkRenderWindow()
    window.SetOffScreenRendering(1)
    window.SetSize(1600, 1100)
    window.SetMultiSamples(8)
    window.AddRenderer(renderer)
    for part, file in files.items():
        if exploded and part in ['clamp-hardware', 'line']:
            continue
        reader = vtk.vtkSTLReader()
        reader.SetFileName(str(file))
        mapper = vtk.vtkPolyDataMapper()
        mapper.SetInputConnection(reader.GetOutputPort())
        actor = vtk.vtkActor()
        actor.SetMapper(mapper)
        actor.GetProperty().SetColor(*colors[part])
        actor.GetProperty().SetAmbient(.28)
        actor.GetProperty().SetDiffuse(.72)
        actor.GetProperty().SetSpecular(.2)
        actor.GetProperty().SetSpecularPower(30)
        if exploded:
            actor.SetPosition(-65 if part == 'rear' else (65 if part in ['front', 'pin-hardware', 'pulley'] else 0), 0, 0)
        renderer.AddActor(actor)
    camera = renderer.GetActiveCamera()
    camera.SetPosition(500, -750, 370)
    camera.SetFocalPoint(65, 0, 0)
    camera.SetViewUp(0, 0, 1)
    camera.ParallelProjectionOn()
    camera.SetParallelScale(235 if exploded else 215)
    renderer.ResetCameraClippingRange()
    text_actor(renderer, 'ARBI / ROUND-POLE PULLEY MOUNT', 55, 1030, 29)
    text_actor(renderer, 'Exploded collar view' if exploded else 'Assembled concept / r0.1.0', 55, 987, 23, (.38, .41, .42))
    text_actor(renderer, '120 mm pole  |  90 mm collar  |  110 mm pin offset', 55, 64, 23)
    text_actor(renderer, 'CONCEPT — UNVALIDATED     •     Generic pulley envelope; no load rating', 55, 28, 18, (.38, .41, .42))
    window.Render()
    capture = vtk.vtkWindowToImageFilter()
    capture.SetInput(window)
    capture.Update()
    writer = vtk.vtkPNGWriter()
    writer.SetFileName(str(OUT / name))
    writer.SetInputConnection(capture.GetOutputPort())
    writer.Write()
    generated_outputs.append(OUT / name)
    window.Finalize()


render('assembled.png')
render('exploded.png', True)
report['sources_sha256'] = {str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest()
                            for path in [LIBRARY, ROOT / 'hardware/lib/arbi.scad', *sorted(ASSEMBLY.glob('pole-pulley-mount-*.scad'))]}
report_path = OUT / 'geometry-report.json'
report_path.write_text(json.dumps(report, indent=2) + '\n')
generated_outputs.append(report_path)
with zipfile.ZipFile(OUT / 'pole-pulley-mount-concept-r0.1.0.zip', 'w', zipfile.ZIP_DEFLATED) as pack:
    pack.writestr('README.txt', 'ARBI round-pole pulley mount r0.1.0 — concept-unvalidated.\n'
                  'Unloaded fit/appearance concept; no material, load rating or overhead-use approval.\n'
                  'Default: 120 mm pole, 90 mm collar, 110 mm pin offset, generic 30 mm pulley.\n'
                  'STLs use millimetres; GLB uses metres. The 100/140 suffixes are pole variants.\n'
                  'Only front/rear STLs are custom parts. reference-* meshes are visualization only.\n'
                  'Open source/hardware/assemblies/corner-station/pole-pulley-mount-assembly.scad\n'
                  'in OpenSCAD 2021.01. Edit shared parameters in source/hardware/lib/pole-pulley-mount.scad.\n'
                  'Exact pole and purchased pulley dimensions remain to be confirmed.\n')
    # Reusing an output directory must not publish stale or unrelated artifacts.
    for path in sorted(generated_outputs):
        pack.write(path, f'outputs/{path.name}')
    for path in [LIBRARY, ROOT / 'hardware/lib/arbi.scad', *sorted(ASSEMBLY.glob('pole-pulley-mount*.scad')),
                 ASSEMBLY / 'pole-pulley-mount.md', ASSEMBLY / 'pole-pulley-mount-check.md',
                 Path(__file__).resolve(), ROOT / 'LICENSE']:
        pack.write(path, 'source/' + path.relative_to(ROOT).as_posix())
print(f'Nominal checks, GLB and CAD previews complete: {OUT}', flush=True)
