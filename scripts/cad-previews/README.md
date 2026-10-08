# Registered CAD previews

Generate one 480 × 360 PNG for every model in
[the registry](../../hardware/models.json). Fabrication parts use opaque white
faces with visible feature edges and silhouettes. CSG references use shaded
OpenCSG previews that preserve component surfaces and role colors. Both renderers
fit each model to its own frame. References retain their released format and
engineering evidence status; no fabrication STL is created for them.

```bash
pnpm cad:check -- --require-openscad --output-dir /tmp/arbi-cad
python -m pip install -r scripts/cad-previews/requirements.txt
python scripts/cad-previews/build.py --cad-dir /tmp/arbi-cad --output /tmp/arbi-previews
```

OpenSCAD must match the registry's pinned version. CI uses VTK's EGL backend with
`VTK_DEFAULT_OPENGL_WINDOW=vtkEGLRenderWindow` and software Mesa; the same VTK
renderer also runs on macOS. CSG previews use `xvfb-run` on Linux and require
`xvfb` and `xauth`. Generation fails on missing exports, empty meshes,
missing or blank images, and incorrect image dimensions.

The output is `ARBI-CAD-previews.zip`, containing PNGs and `manifest.json` under
`ARBI-CAD-previews/`. Each entry records the model ID, revision, output name,
entrypoint, every transitively included source hash, and the image SHA-256.
The CAD release publishes the pack with its checksum. Generated figures and
temporary meshes stay outside Git.

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
