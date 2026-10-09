"""Package explicitly declared OpenSCAD assembly inspection components."""
import hashlib
import json
import re
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed


def checked_export(command, path):
    result = subprocess.run(command, capture_output=True, text=True, timeout=120, check=True)
    diagnostics = "\n".join([result.stdout, result.stderr])
    if re.search(r"\b(?:ERROR|WARNING):", diagnostics):
        raise ValueError(f"Assembly export diagnostics:\n{diagnostics}")
    if not path.is_file() or not path.stat().st_size:
        raise ValueError(f"Missing assembly inspection mesh: {path}")
    return diagnostics


def assembly_scene(model, repo, work, jobs):
    entrypoint = repo / model["entrypoint"]
    if model["artifactRole"] != "reference" or "ARBI_ASSEMBLY_SCENE" not in entrypoint.read_text(encoding="utf-8"):
        return None
    metadata = work / f"{model['id']}-metadata.csg"
    diagnostics = checked_export(["openscad", "-o", str(metadata), "-D", "emit_scene=true", str(entrypoint)], metadata)
    declarations = [json.loads(line.removeprefix("ECHO: ")) for line in diagnostics.splitlines()
                    if line.startswith('ECHO: ["ARBI_ASSEMBLY_SCENE",')]
    if len(declarations) != 1:
        raise ValueError("Assembly must emit exactly one scene declaration")
    marker, version, slug, configuration, pose, declared = declarations[0]
    if marker != "ARBI_ASSEMBLY_SCENE" or version != 1 or slug != model["assembly"] or not declared:
        raise ValueError("Invalid assembly scene declaration")
    parts = []
    seen = set()
    for node, registered_model, bom_id, group, color, explode in declared:
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", node) or node in seen:
            raise ValueError("Assembly nodes must have unique stable IDs")
        seen.add(node)
        if group not in ("fixed", "cover") or len(color) != 3 or len(explode) != 3:
            raise ValueError("Invalid assembly display metadata")
        parts.append({"node": node, "model": registered_model or node, "registered": bool(registered_model),
                      "bomPartId": bom_id or None, "group": group, "color": color, "explode": explode,
                      "mesh": f"assemblies/{model['id']}/{node}.stl"})

    def export(index, part):
        target = work / part["mesh"]
        target.parent.mkdir(parents=True, exist_ok=True)
        checked_export(["openscad", "-o", str(target), "-D", f"scene_part={index}", str(entrypoint)], target)
        part["sha256"] = hashlib.sha256(target.read_bytes()).hexdigest()

    executor = ThreadPoolExecutor(max_workers=jobs)
    try:
        futures = [executor.submit(export, index, part) for index, part in enumerate(parts)]
        for future in as_completed(futures):
            future.result()
    finally:
        executor.shutdown(wait=True, cancel_futures=True)
    print(f"Packaged {len(parts)} inspection components for {model['id']}", flush=True)
    return {"slug": slug, "configuration": configuration, "pose": pose, "parts": parts}
