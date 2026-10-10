"""Nominal WT-806 adapter meshes/interfaces. No physical load qualification.

Requires OpenSCAD 2021.01, numpy, scipy, trimesh and manifold3d. Outputs stay outside
Git; --record writes a source-hashed JSON record to the requested location.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import re
import subprocess
import tempfile

import numpy as np
import trimesh

ROOT = Path(__file__).resolve().parents[2]
LIB = ROOT / "hardware/lib"
CHECKS = []
MESHES = {}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def export(task):
    name, source, output = task
    source.write_text(name[1], encoding="utf-8")
    result = subprocess.run(["openscad", "-o", str(output), str(source)],
                            capture_output=True, text=True, timeout=120)
    log = result.stdout + result.stderr
    if result.returncode or re.search(r"\b(?:WARNING|ERROR):", log):
        raise ValueError(f"{name[0]}: {log}")
    mesh = trimesh.load_mesh(output)
    is_adapter = re.fullmatch(r"(?:head|winch)-(?:front|rear)-\d+", name[0]) is not None
    if not (mesh.is_watertight and mesh.is_winding_consistent and
            mesh.body_count == 1 and mesh.volume > 0 and
            (not is_adapter or np.all(mesh.area_faces > 1e-9))):
        raise ValueError(f"Invalid mesh: {name[0]}: watertight={mesh.is_watertight}, "
                         f"winding={mesh.is_winding_consistent}, bodies={mesh.body_count}, "
                         f"volume={mesh.volume}, min_area={mesh.area_faces.min()}")
    return name[0], mesh, dict(sha256=digest(output), volume_mm3=float(mesh.volume),
                             bounds_mm=mesh.bounds.tolist(),
                             degenerateFaces=int(np.count_nonzero(mesh.area_faces <= 1e-9)))


def move(mesh, xyz):
    result = mesh.copy()
    result.apply_translation(xyz)
    return result


def cylinder(diameter, length, center, axis="x"):
    result = trimesh.creation.cylinder(radius=diameter/2, height=length, sections=128)
    if axis == "x":
        result.apply_transform(trimesh.transformations.rotation_matrix(np.pi/2, [0, 1, 0]))
    result.apply_translation(center)
    return result


def clear(a, b, label):
    if np.any(np.minimum(a.bounds[1], b.bounds[1])-np.maximum(a.bounds[0], b.bounds[0]) <= 1e-6):
        volume = 0
    else:
        intersection = trimesh.boolean.intersection([a, b], engine="manifold")
        volume = abs(intersection.volume) if not intersection.is_empty else 0
    if volume > .002:
        raise ValueError(f"{label}: intersection {volume:.6f} mm3")
    CHECKS.append(dict(check=label, intersection_mm3=float(volume)))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--record", type=Path)
    args = parser.parse_args()
    version = subprocess.run(["openscad", "--version"], capture_output=True, text=True, check=True)
    assert (version.stdout+version.stderr).strip() == "OpenSCAD version 2021.01"
    tasks = []
    with tempfile.TemporaryDirectory(prefix="arbi-stand-check-") as directory:
        work = Path(directory)
        for diameter in [26, 30, 35]:
            for role, call in [
                ("head-front", "csa_print_front(\"head\");"),
                ("head-rear", "csa_print_rear(head_tube_diameter_mm);"),
                ("winch-front", "csa_print_front(\"winch\");"),
                ("winch-rear", "csa_print_rear(winch_tube_diameter_mm);")]:
                name = f"{role}-{diameter}"
                source = (f"include <{LIB}/corner-stand-adapter.scad>\n"
                          f"head_tube_diameter_mm={diameter}; winch_tube_diameter_mm={diameter};\n"+call)
                tasks.append(((name, source), work/(name+".scad"), work/(name+".stl")))
        references = {
            "head-left": ("corner-head-printed.scad", "corner_head_printed_left();"),
            "head-right": ("corner-head-printed.scad", "corner_head_printed_right();"),
            "winch-base": ("winch-cover.scad", "wc_base(false);"),
            "winch-rear-left": ("winch-cover.scad", "wc_rear_installed(false,true,0);"),
            "winch-rear-right": ("winch-cover.scad", "wc_rear_installed(false,false,0);"),
            "winch-fascia": ("winch-cover.scad", "wc_fascia_installed(false,0,true);"),
        }
        for name, (library, call) in references.items():
            source = f"include <{LIB}/{library}>\n"+call
            tasks.append(((name, source), work/(name+".scad"), work/(name+".stl")))
        with ThreadPoolExecutor(max_workers=4) as executor:
            for name, mesh, record in executor.map(export, tasks):
                MESHES[name] = mesh
                records[name] = record
        # Independent inverse transforms for the released print poses.
        front_pose = [[0,0,1,.4],[0,1,0,-51],[-1,0,0,25],[0,0,0,1]]
        rear_pose = [[0,0,-1,-.4],[0,1,0,-51],[1,0,0,-25],[0,0,0,1]]
        for diameter in [26, 30, 35]:
            installed = {}
            for role in ["head-front", "head-rear", "winch-front", "winch-rear"]:
                name = f"{role}-{diameter}"
                mesh = MESHES[name].copy()
                expected = [50, 102, (90 if role=="head-front" else 115)-.4]
                if role.endswith("rear"):
                    expected[2] = diameter/2+10-.4
                assert np.allclose(mesh.bounds[0], [0,0,0], atol=.002), (name, "bed", mesh.bounds)
                assert np.allclose(mesh.extents, expected, atol=.002), (name, "envelope", mesh.extents)
                CHECKS.append(dict(check=name+" closed mesh / print envelope"))
                mesh.apply_transform(rear_pose if role.endswith("rear") else front_pose)
                installed[role] = mesh
                clear(mesh, cylinder(diameter, 52, [0,0,0], "z"), name+" / unmodified tube")
                # Clamp bolts and washer envelopes independently sized.
                depth = diameter/2+10
                for y in [-42,42]:
                    clear(mesh, cylinder(6, 2*depth+20, [0,y,0]), name+f" / M6 at Y={y}")
                    for x in [-depth-.8,depth+.8]:
                        clear(mesh, cylinder(12, 1.58, [x,y,0]), name+" / M6 washer")
            for role in ["head", "winch"]:
                clear(installed[role+"-front"], installed[role+"-rear"], f"{role}-{diameter} / split faces")
            for row in [45,155]:
                for carrier in ["head-left", "head-right"]:
                    clear(cylinder(12,90,[80,0,row]), move(MESHES[carrier],[30,0,0]),
                          f"head-{diameter} / short M12 through actual {carrier} at {row}")
                for role in ["head-front", "head-rear"]:
                    adapter = move(installed[role], [0,0,row])
                    for carrier in ["head-left", "head-right"]:
                        clear(adapter, move(MESHES[carrier], [30,0,0]), f"{role}-{diameter} / {carrier} at {row}")
                front = installed["head-front"]
                clear(front, cylinder(12, 90, [80,0,0]), f"head-{diameter} / M12 shaft")
                clear(front, cylinder(37, 2.98, [51.5,0,0]), f"head-{diameter} / rear M12 washer")
                clear(front, cylinder(22, 12, [44,0,0]), f"head-{diameter} / M12 locking nut envelope")
                # A 20 mm-long tool envelope occupies the nut bay and can enter
                # from above/below between the webs; it need not pass the tube.
                clear(front, cylinder(30, 20, [40,0,0]), f"head-{diameter} / rear wrench bay")
            for y in [-25,25]:
                front = installed["winch-front"]
                clear(front, cylinder(8,40,[104.6,y,0]), f"winch-{diameter} / M8 shaft at {y}")
                clear(front, cylinder(16,1.58,[98.2,y,0]), f"winch-{diameter} / rear M8 washer at {y}")
                clear(front, cylinder(16,8,[93.4,y,0]), f"winch-{diameter} / M8 nut at {y}")
                clear(front, cylinder(24,40,[77,y,0]), f"winch-{diameter} / socket approach at {y}")
            # Derive the drum width and payout from the canonical winch source,
            # rather than repeating its width/effective diameter as constants.
            probe = work/"tangent.scad"
            probe.write_text(f"include <{LIB}/winch-pole.scad>\n"
                             "echo(width=wd_width(false), tangent=mount_axis_height+wd_effective_diameter(false)/2, "
                             "post_offset=-pole_front, plate=base_thickness);\n")
            result = subprocess.run(["openscad","-o",str(work/"tangent.csg"),str(probe)],
                                    capture_output=True,text=True,check=True)
            log = result.stdout+result.stderr
            assert not re.search(r"\b(?:WARNING|ERROR):", log), log
            values = {key:float(value) for key,value in re.findall(r"(width|tangent|post_offset|plate) = ([\d.]+)",log)}
            transform = [[0,0,1,123],[1,0,0,-values["width"]/2],[0,1,0,0],[0,0,0,1]]
            for name in ["winch-base","winch-rear-left","winch-rear-right","winch-fascia"]:
                mesh = MESHES[name].copy()
                mesh.apply_transform(transform)
                # Both fascia sides and both right shield segments use the same
                # post corridor; include the reflected fascia too.
                variants = [mesh]
                if name == "winch-fascia":
                    reflected = mesh.copy()
                    reflected.apply_transform([[1,0,0,0],[0,1,0,0],[0,0,-1,0],[0,0,0,1]])
                    variants.append(reflected)
                for row in [-60,60]:
                    if name == "winch-base":
                        for y in [-25,25]:
                            clear(cylinder(8,40,[104.6,y,row]), mesh,
                                  f"winch-{diameter} / M8 through actual base at {y},{row}")
                    for role in ["winch-front","winch-rear"]:
                        for variant in variants:
                            clear(move(installed[role],[0,0,row]), variant, f"{role}-{diameter} / {name} at {row}")
            head_probe = work/"head-line.scad"
            head_probe.write_text(f"include <{LIB}/corner-head-printed.scad>\npch_line();\n")
            _, line, line_record = export((("head-line",head_probe.read_text()),head_probe,work/"head-line.stl"))
            line_x = line.bounds[0,0]+line.extents[1]/2+30
            winch_x = 123+values["tangent"]
            assert abs(line_x-winch_x)<.001, (line_x,winch_x)
            assert values["plate"]==8 and values["post_offset"]==33
            CHECKS.append(dict(check=f"diameter {diameter} / canonical payout alignment", head_mm=float(line_x),winch_mm=winch_x))
            records["head-line"] = line_record
        for definition in ["head_tube_diameter_mm=25", "winch_tube_diameter_mm=36", "split_gap_mm=0.2", "virtual_post_offset_mm=31"]:
            source = work/"invalid.scad"
            call = 'csa_print_front("winch");' if definition.startswith("winch") else 'csa_print_front("head");'
            source.write_text(f"include <{LIB}/corner-stand-adapter.scad>\n{definition};\n{call}\n")
            result = subprocess.run(["openscad","-o",str(work/"invalid.csg"),str(source)],capture_output=True,text=True,timeout=30)
            assert "ERROR: Assertion" in result.stderr, (definition,result.stderr)
            CHECKS.append(dict(check="invalid parameter rejected: "+definition))
    paths = [ROOT/"scripts/corner-support/check-stand-adapter.py", ROOT/"hardware/models.json"]
    paths += list((ROOT/"hardware/assemblies/corner-station").glob("corner-stand-*.scad"))
    visited = set()
    def visit(path):
        if path in visited: return
        visited.add(path)
        for include in re.findall(r"^\s*(?:include|use)\s*<([^>]+)>",path.read_text(),re.M):
            visit((path.parent/include).resolve())
    for path in paths: visit(path.resolve())
    report = dict(schemaVersion=1, revision="0.1.0", evidence="nominal CAD only; unprinted/unloaded",
                  openscad="2021.01", trimesh=trimesh.__version__,
                  sourceSha256={p.relative_to(ROOT).as_posix():digest(p) for p in sorted(visited)},
                  meshes=records, checks=CHECKS, checkCount=len(CHECKS))
    if args.record:
        args.record.parent.mkdir(parents=True,exist_ok=True)
        args.record.write_text(json.dumps(report,indent=2)+"\n")
    print(f"PASS: {len(CHECKS)} mesh/interface checks; 26/30/35 mm tubes; nominal CAD only.")


records = {}
if __name__ == "__main__":
    main()
