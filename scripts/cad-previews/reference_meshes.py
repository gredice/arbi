"""Mesh each unique reference component once with bounded OpenSCAD workers."""
import hashlib
import os
import re
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed

from csg import components


def default_jobs():
    cpus = len(os.sched_getaffinity(0)) if hasattr(os, "sched_getaffinity") else os.cpu_count() or 1
    return min(4, cpus)


def positive_jobs(value):
    if not re.fullmatch(r"[1-9][0-9]*", value):
        raise ValueError("--jobs requires a positive integer")
    return int(value)


def export_component(task):
    geometry, source, mesh = task
    source.write_text(geometry + "\n", encoding="utf-8")
    result = subprocess.run(["openscad", "-o", str(mesh), str(source)],
                            capture_output=True, text=True, timeout=120, check=True)
    diagnostics = "\n".join([result.stdout, result.stderr])
    if re.search(r"\b(?:ERROR|WARNING):", diagnostics):
        raise ValueError(f"{source.name} emitted OpenSCAD diagnostics:\n{diagnostics}")
    if not mesh.is_file() or not mesh.stat().st_size:
        raise ValueError(f"Missing or empty reference mesh: {mesh}")


def prepare_references(paths, work, jobs):
    references = {}
    tasks = {}
    for path in paths:
        meshes = []
        for geometry in components(path.read_text(encoding="utf-8")):
            key = hashlib.sha256(geometry.encode()).hexdigest()
            mesh = work / f"{key}.stl"
            tasks.setdefault(key, (geometry, work / f"{key}.scad", mesh))
            meshes.append(mesh)
        references[path] = meshes

    executor = ThreadPoolExecutor(max_workers=jobs)
    try:
        futures = [executor.submit(export_component, task) for task in tasks.values()]
        for future in as_completed(futures):
            future.result()
    finally:
        # Cancel queued exports on failure and drain active subprocesses before
        # the caller removes the shared temporary directory.
        executor.shutdown(wait=True, cancel_futures=True)
    print(f"Meshed {len(tasks)} unique reference components with {jobs} worker(s).", flush=True)
    return references
