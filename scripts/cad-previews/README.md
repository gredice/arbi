# Registered CAD previews

Generate one 480 × 360 PNG for every model in
[the registry](../../hardware/models.json). Every model uses opaque white
faces with visible feature edges and silhouettes, fitted to its own frame.
CSG references are meshed temporarily by additive component for the same line-art renderer; those
inspection meshes are deleted after rendering and never enter the release or
fabrication inventory. References retain their released CSG format and
engineering evidence status.

```bash
pnpm cad:check -- --require-openscad --output-dir /tmp/arbi-cad
python -m pip install -r scripts/cad-previews/requirements.txt
python scripts/cad-previews/test_csg.py
python scripts/cad-previews/build.py --cad-dir /tmp/arbi-cad --output /tmp/arbi-previews
```

OpenSCAD must match the registry's pinned version. CI uses VTK's EGL backend with
`VTK_DEFAULT_OPENGL_WINDOW=vtkEGLRenderWindow` and software Mesa; the same VTK
renderer also runs on macOS. Generation fails on missing exports, empty meshes,
missing or blank images, and incorrect image dimensions.

The output is `ARBI-CAD-previews.zip`, containing PNGs and `manifest.json` under
`ARBI-CAD-previews/`. The manifest declares `cad-line-art-v2`, so earlier packs
containing shaded references cannot be reused. Each entry records the model ID, revision, output name,
entrypoint, every transitively included source hash, and the image SHA-256.
The CAD release publishes the pack with its checksum. Generated figures and
temporary meshes stay outside Git.

Reference meshing keeps subtraction, intersections and hulls intact and preserves
each component's world transforms. Components are drawn together with depth
occlusion, without an expensive assembly-wide boolean union. A temporary cache
shares identical component meshes across references; none are included in the pack.

The [public site compiler](../../apps/arbi-docs/scripts/compile-data.mjs) verifies
the release checksum and accepts each figure only when its registry identity,
complete source dependency closure, and image checksum match current sources.
Missing or outdated preview packs fall back to existing booklet drawings.
To review a new pack locally before publishing it:

```bash
ARBI_CAD_PREVIEW_PACK=/tmp/arbi-previews/ARBI-CAD-previews.zip pnpm --filter @arbi/docs dev
```

Renders establish nominal source geometry only; physical acceptance remains
separate.
