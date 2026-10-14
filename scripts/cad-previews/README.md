# Registered CAD previews

Generate one 480 × 360 PNG for every model in
[the registry](../../hardware/models.json). Every model uses opaque white
faces with visible feature edges and silhouettes, fitted to its own frame.
CSG references are meshed by additive component for the same line-art renderer.
Their surfaces are combined without a boolean union into a binary inspection STL
under `references/`, preserving world placement. References retain their released CSG format and
engineering evidence status.

```bash
pnpm cad:check -- --require-openscad --jobs 4 --output-dir /tmp/arbi-cad
python -m pip install -r scripts/cad-previews/requirements.txt
python -m unittest discover -s scripts/cad-previews -p 'test_*.py'
python scripts/cad-previews/build.py --jobs 4 --cad-dir /tmp/arbi-cad --output /tmp/arbi-previews
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

Each CSG entry records `referenceMesh` and `referenceMeshSha256`. The site checks
these inspection surfaces against the same identity and complete source hashes
as the figure, then writes them into a separate `referenceMeshes` inventory.
Assembly detail pages use them for rotation, zoom, and line/shaded views.
They never enter the part mesh or download inventory; the download remains CSG.
Production requires a current inspection mesh for every registered reference.
Local/preview builds with older packs show the static CAD figure in the viewer.

For `visualization` models, the pack also includes the registered STL under
`meshes/`, with its path and SHA-256 in the same source-checked manifest entry.
The site uses these approximate meshes for BOM item detail pages. They remain
illustrative models with explicit assumptions and rework requirements; including
them in the pack does not make them fabrication sources.

An explicit `ARBI_ASSEMBLY_SCENE` declaration in a reference source enables
selectable assembly inspection assets, currently used by the
[control cabinet](../../hardware/assemblies/control-cabinet/README.md). The same
OpenSCAD file emits component identity/BOM ownership, colors and exploded
offsets with `emit_scene=true`, and exports each component with `scene_part=N`.
The builder stores these STL meshes separately under `assemblies/` with
checksums, covered by the reference's complete source hashes. The site accepts
the scene only when every constituent mesh is intact and registered component
ownership matches the catalog. These assets never populate the fabrication or
individual downloadable-mesh inventory. The combined reference preview remains
available independently of a selectable assembly scene.

Reference meshing keeps subtraction, intersections and hulls intact and preserves
each component's world transforms. Components are drawn together with depth
occlusion, without an expensive assembly-wide boolean union. A temporary cache
shares identical component meshes across references. The pack includes combined
reference previews and any explicitly declared selectable assembly assets.
Unique components are exported with a bounded pool of OpenSCAD processes before
VTK draws figures serially. The default worker count is the available CPU count
capped at four; `--jobs N` overrides this, and `--jobs 1` runs serially. Every
reference export has a 300-second timeout to allow the large winch boolean
components to complete on shared CI CPUs; explicit assembly inspection exports
retain their 120-second timeout. Both reject compiler failures, warnings/errors
and missing or empty meshes. A failure cancels queued work and waits for active
processes before removing temporary files or returning; no pack is published.

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

Models may declare `ARBI_MODEL_APPEARANCE` and export each material component
with `appearance_part=N`. The pack stores these meshes under `appearances/`,
with source and mesh checksums, an explicit rigid envelope excluding flexible
display leads, and sRGB colour, roughness, metalness, transmission, thickness
(mm) and IOR. The site accepts the complete component set atomically and uses
it for shaded and line views. The servo and Camera Module 3 Wide use this path; future
multi-material models can use the same path. These assets supplement the
ordinary release STL; they do not change engineering status or create new
fabrication entrypoints. Authored GLTF materials are also preserved in shaded
views instead of being replaced with a single colour.
