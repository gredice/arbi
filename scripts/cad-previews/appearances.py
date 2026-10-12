"""Export source-declared material components alongside the ordinary STL."""
import hashlib
import json
import math
import re
from concurrent.futures import ThreadPoolExecutor
from assembly_scenes import checked_export


def model_appearance(model, repo, work, jobs):
    entrypoint = repo / model["entrypoint"]
    if "ARBI_MODEL_APPEARANCE" not in entrypoint.read_text(encoding="utf-8"):
        return None
    metadata = work / f"{model['id']}-appearance.csg"
    diagnostics = checked_export(["openscad", "-o", str(metadata), "-D", "emit_appearance=true", str(entrypoint)], metadata)
    declarations = [json.loads(line.removeprefix("ECHO: ")) for line in diagnostics.splitlines()
                    if line.startswith('ECHO: ["ARBI_MODEL_APPEARANCE",')]
    if len(declarations) != 1:
        raise ValueError("Model must emit exactly one appearance declaration")
    marker, version, envelope, declared = declarations[0]
    vector = lambda v: isinstance(v, list) and len(v) == 3 and all(isinstance(x, (float, int)) and math.isfinite(x) for x in v)
    if marker != "ARBI_MODEL_APPEARANCE" or version != 1 or not vector(envelope) or min(envelope) <= 0 or not declared:
        raise ValueError("Invalid model appearance declaration")
    parts, seen = [], set()
    for node, color, roughness, metalness, transmission, thickness, ior in declared:
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", node) or node in seen:
            raise ValueError("Appearance components need unique stable IDs")
        seen.add(node)
        if not vector(color) or min(color) < 0 or max(color) > 1 or not all(
                isinstance(v, (int, float)) and math.isfinite(v) and 0 <= v <= 1 for v in [roughness, metalness, transmission]) or not (
                isinstance(thickness, (int, float)) and math.isfinite(thickness) and thickness >= 0 and
                isinstance(ior, (int, float)) and math.isfinite(ior) and 1 <= ior <= 2.333):
            raise ValueError("Invalid physical material")
        parts.append({"node": node, "mesh": f"appearances/{model['id']}/{node}.stl",
                      "material": dict(color=color, roughness=roughness, metalness=metalness,
                                       transmission=transmission, thickness=thickness, ior=ior)})

    def export(index):
        part = parts[index]
        target = work / part["mesh"]
        target.parent.mkdir(parents=True, exist_ok=True)
        checked_export(["openscad", "-o", str(target), "-D", f"appearance_part={index}", str(entrypoint)], target)
        part["sha256"] = hashlib.sha256(target.read_bytes()).hexdigest()

    with ThreadPoolExecutor(max_workers=jobs) as executor:
        list(executor.map(export, range(len(parts))))
    return {"envelope": envelope, "parts": parts}
