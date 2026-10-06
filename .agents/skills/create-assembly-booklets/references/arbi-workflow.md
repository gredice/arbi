# ARBI booklet workflow

Use the current checkout of `gredice/arbi`; resolve paths relative to its root. Read `AGENTS.md`, `WORKSPACE.md`, `CONTRIBUTING.md` and the owning assembly docs first.

## Sources and build

- Canonical geometry: `hardware/lib/*.scad` and `hardware/assemblies/winch/*.scad`.
- Model revisions/outputs: `hardware/models.json`; fabrication links: `bom/catalog/parts.json`.
- Booklet generator: `scripts/winch-booklet/build.py`. Inspect its `--help`, README and pinned Python requirements before running it.
- PDF layout: `scripts/winch-booklet/build_booklet.py`.
- Rendered assembly transforms: `scripts/winch-booklet/render_figures.py`.
- Bought hardware references: `scripts/winch-booklet/reference-parts.scad`.
- Published booklet and pack: `docs/assemblies/winch/booklet/`.
- Local export/build directory: ignored `hardware/generated/booklet/`.

For a one-page insert, copy the needed renderer/layout helpers into a temporary workspace and export only the required current meshes; the generator produces the complete booklet and has no page-selection option. Keep the final full booklet synchronized when editing the project.

The build snapshots current CAD and scripts into its pack, exports registry fabrication models and hardware references, validates meshes, renders STL figures, and creates the PDF and ZIP. Use `--publish` only when the user has requested the repository deliverables to be updated. Follow the script's existing reuse options only when their required source/mesh checks pass.

## Assembly details to re-derive from current CAD

The passive-line winch still has a motor. Its two body sections differ from the three powered sections; never mix them. A right flange is a handed mesh, rotated 180 degrees about local X in assembly. The tie-rod pattern is asymmetric. There is one alignment pin at each joint. Preload split-clamp foot screws from inside the right flange before closing the drum. Clamp the shaft before tightening the feet.

Bearing supports are offset; rotate the right lower 180 degrees about global Z so its feet face outward. Plain M5 nuts fit their windows. Collars contact bearing inner rings through spacers. Motor and coupling dimensions include nominal assumptions that need comparison with received hardware.

Revision 0.1.1 coupling cover adds a wider open-bottom motor-end cavity for mounting fasteners. Read the current mount documentation for its hardware diameter/projection limit and adjustment range. Show the motor mounting fasteners in the booklet; check cover attachment hardware too.

## Verification

Use the current scripts rather than copying numeric results from old evidence records:

```sh
pnpm cad:check -- --require-openscad
pnpm bom:generate
pnpm bom:check
pnpm docs:check
python3 scripts/check-winch-mount-meshes.py hardware/generated/booklet/models/arbi hardware/generated/booklet/models/arbi
```

Run `bom:generate` only when canonical BOM input changed. `bom:check` also builds its package and may write ignored build outputs. Read the checker arguments if the pipeline layout changes. Review every rendered PDF page. Include a geometry-check record identifying the tested cover revision, represented hardware envelope, regression control and limitations. Do not overwrite earlier dated evidence to imply it tested a newer model.
