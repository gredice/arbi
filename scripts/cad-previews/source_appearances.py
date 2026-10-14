"""Carry canonical OpenSCAD display colors into checksum-checked inspection assets."""
import hashlib
import shutil
from concurrent.futures import ThreadPoolExecutor, as_completed

from assembly_scenes import checked_export
from csg import colored_components
from reference_meshes import prepare_references

CORE = (.12, .14, .15)


def surface(color):
    # Display finishes only. Explicit ARBI_MODEL_APPEARANCE metadata overrides
    # these defaults, including transmission and rigid-envelope definitions.
    silver = .5 <= min(color) and max(color) <= .85 and max(color) - min(color) <= .12
    brass = color in ((.72, .55, .22), (.73, .65, .36), (.72, .68, .48), (.74, .65, .38))
    metal = silver or brass
    return dict(color=color, roughness=.28 if metal else .48, metalness=.8 if metal else 0,
                transmission=0, thickness=0, ior=1.5)


def compile_sources(models, cad, repo, work, jobs):
    """Compile display trees cheaply; only multicolor STL models need new meshing."""
    sources = {}

    def compile_model(model):
        if "ARBI_MODEL_APPEARANCE" in (repo / model["entrypoint"]).read_text(encoding="utf-8"):
            return model["id"], None
        path = cad / model["output"]
        if path.suffix != ".csg":
            path = work / f"{model['id']}-colors.csg"
            checked_export(["openscad", "-o", str(path), str(repo / model["entrypoint"])], path)
        colors = [color or CORE for _, color in colored_components(path.read_text(encoding="utf-8"))]
        if not colors:
            raise ValueError(f"Model has no display solids: {model['id']}")
        return model["id"], (path, colors)

    executor = ThreadPoolExecutor(max_workers=jobs)
    try:
        futures = [executor.submit(compile_model, model) for model in models]
        for future in as_completed(futures):
            model_id, source = future.result()
            if source:
                sources[model_id] = source
    finally:
        executor.shutdown(wait=True, cancel_futures=True)
    return sources


def source_appearance(model, source, cad, work, references, mesh_data, write_mesh):
    path, colors = source
    solid = cad / model["output"]
    grouped = {}
    if solid.suffix == ".stl" and len(set(colors)) == 1:
        # Reuse the exact released mesh for single-finish fabrication parts.
        grouped[colors[0]] = [solid]
    else:
        for mesh, color in zip(references[path], colors, strict=True):
            grouped.setdefault(color, []).append(mesh)
    bounds = mesh_data([mesh for meshes in grouped.values() for mesh in meshes]).GetBounds()
    envelope = [bounds[i + 1] - bounds[i] for i in (0, 2, 4)]
    parts = []
    for index, (color, meshes) in enumerate(grouped.items()):
        node = f"surface-{index}"
        name = f"appearances/{model['id']}/{node}.stl"
        target = work / name
        target.parent.mkdir(parents=True, exist_ok=True)
        if len(meshes) == 1:
            shutil.copyfile(meshes[0], target)
        else:
            write_mesh(meshes, target)
        parts.append(dict(node=node, mesh=name, material=surface(color),
                          sha256=hashlib.sha256(target.read_bytes()).hexdigest()))
    return dict(envelope=envelope, parts=parts)


def scene_appearances(scene, model, repo, work, jobs, mesh_data, write_mesh):
    """Preserve inner finishes of world-placed selectable inspection components."""
    sources = {}
    for index, part in enumerate(scene["parts"]):
        path = work / f"{model['id']}-{part['node']}-colors.csg"
        checked_export(["openscad", "-o", str(path), "-D", f"scene_part={index}",
                        str(repo / model["entrypoint"])], path)
        colors = [color or tuple(part["color"]) for _, color in colored_components(path.read_text(encoding="utf-8"))]
        if len(set(colors)) > 1:
            sources[part["node"]] = (path, colors)
    if not sources:
        return
    references = prepare_references([path for path, _ in sources.values()], work, jobs)
    for part in scene["parts"]:
        if part["node"] in sources:
            item = dict(id=f"{model['id']}-{part['node']}", output=part["mesh"])
            part["appearance"] = source_appearance(item, sources[part["node"]], work, work,
                                                  references, mesh_data, write_mesh)
