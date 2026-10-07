# Winch booklet generator

This workflow exports current ARBI winch models, makes bought-part reference
STLs, renders assembly views from the meshes and builds the A4 PDF and portable
STL/source pack. The source models in `hardware/` remain canonical.

Install OpenSCAD **2021.01** and Python 3.12 or compatible. Install the Python
dependencies from `requirements.txt` in a virtual environment. VTK 9.5.2 needs
a working OpenGL/EGL/OSMesa backend for rendering; the documented build used EGL.
Run from the repository root:

```sh
python3 -m pip install -r scripts/winch-booklet/requirements.txt
python3 scripts/winch-booklet/build.py
```

Outputs go to ignored `hardware/generated/booklet/`. The build copies the current
winch CAD, scripts and fonts into a portable source snapshot, validates 62 STLs,
writes hashes and part transforms, renders the figures and generates the PDF/ZIP.
Use `--output PATH` for another build location. `--publish` updates the checked-in
PDF and ZIP under `docs/assemblies/winch/booklet/`.

After text or camera edits, `--reuse-models` skips CAD exports only if the source
input hashes and all STL hashes still match. CAD changes require a full rebuild.
Rendering and PDF generation always rerun. Old model revisions are removed on a
full export. The snapshot is identified by content hashes; its recorded Git base
commit can precede edits in the working tree. This avoids falsely claiming that
a PDF generated before its own commit came from an unchanged earlier revision.

## CI and drawing style

The shared renderer makes white-face line drawings with dark silhouettes and
visible feature edges. Opaque faces hide rear edges and omit the STL triangle
grid. Product colors remain in the figure/assembly manifests and payload GLB.

[Booklet CI](../../.github/workflows/booklets.yml) builds the winch, dry payload
and enclosed payload in separate jobs with Python 3.12, OpenSCAD 2021.01 and VTK
9.5.2 on software EGL. Relevant pull requests get downloadable PDF/ZIP artifacts
for 14 days. The required CI result includes booklet checks. A manual workflow
dispatch rebuilds all three variants from the selected branch.

On `main`, [CAD release CI](../../.github/workflows/cad-release.yml) builds the
same three booklets and adds them to the `cad-<commit>` release alongside the
registered STL/CSG files and checksums. CI uses fresh exports, with neither
`--reuse-models` nor `--publish`; it does not commit generated files back to Git.
Checked-in PDFs/ZIPs are dated snapshots; releases contain commit-matched builds.

Validate a local build with:

```sh
python3 scripts/check-booklet.py hardware/generated/booklet --variant winch
```

The check verifies A4 page totals, headers, revisions, source/STL hashes,
registry filenames, non-empty line-art figures and matching PDF/ZIP contents.
Render every PDF page for visual review before updating a checked-in snapshot.

## Editing

| File | Responsibility |
| --- | --- |
| `build.py` | Snapshot, dependency order, packaging and optional publication |
| `export_arbi.py` | Registered winch fabrication exports and mesh manifests |
| `reference-parts.scad` | Nominal purchased-part geometry |
| `export_reference.py` | Reference STLs, including base plates from canonical CAD |
| `render_figures.py` | Assembly transforms, cameras and STL render manifest |
| `build_booklet.py` | Booklet text, vector labels and A4 page layout |
| `pack-README.md` | User-facing instructions included in the ZIP |

Resolve fabrication filenames from the model registry. Keep corresponding BOM
revisions current. Never make a picture fit by changing the rendered custom part
independently of its CAD. Hardware details without supplier confirmation remain
labelled references. The motor screw illustration is a representative M4 through
stack; actual screw selection depends on the received flange.

## Verification and publication

Run the mount mesh checker and the CAD/BOM/docs checks described by the repository.
Render every PDF page with Poppler and inspect it after layout changes. Verify
current revision filenames and no old cover in the ZIP. Review affected views
with actual motor and cover attachment hardware present. The booklet build is
not a physical fit or load validation.

The [published booklet directory](../../docs/assemblies/winch/booklet/README.md)
records the owner's request to commit the downloadable artifact snapshot. Other
working STL exports and individual render PNGs remain ignored. The reusable
skill is maintained under `.agents/skills/create-assembly-booklets/`.

Revision 7 retains the distinct powered index-3 transition panel from revision 6 and adds line-art illustrations. The full-cover kit includes
main panels, payout shutters, clips, fixed-loom anchor,
covered-base drilling references and nominal line/loom references. The PDF has
18 pages; the pack contains 27 fabrication and 35 reference meshes. Run
`python scripts/check-winch-cover-meshes.py hardware/generated/booklet/models/arbi`
for the full-cover nominal checks, as well as the existing mount checker.
