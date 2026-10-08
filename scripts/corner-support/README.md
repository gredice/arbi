# Corner support package builder

Use OpenSCAD 2021.01 and the existing
[booklet Python dependencies](../winch-booklet/requirements.txt).

```sh
python3 scripts/corner-support/build.py
```

The fresh temporary build exports six registered fabrication models and nominal
bought references; checks round 100/120/140 mm, passive/powered line assumptions
and the historical square-100/150-angle configuration; checks bolt engagement,
alignment, socket access and sampled shield-removal paths; renders actual meshes
with the existing winch line-art renderer; and writes an eight-page A4 PDF, GLB,
hash reports and verified portable source/STL ZIP. All working outputs go to
ignored `hardware/generated/corner-support`. `--output` overrides the location.

The pack has installed-frame meshes in millimetres, a GLB in metres, source
configuration, registry filenames and exact hashes. The square baseline has no
saddles. Default saddle meshes are metal machining envelopes and must not be
printed as structural parts. Never combine study variants in one installation.
The builder uses fresh exports, not prior renders or an existing output folder's
files, when making its ZIP. Portable canonical sources are under
`source/repository`; rebuild from an ARBI checkout with pinned Node/pnpm tooling.

Render every PDF page with `pdftoppm` and inspect it after layout changes. CAD
checks establish nominal geometry only. The received BA01090 connection, keeper,
guy attachment, material/fabrication process, timber, soil, load capacity and
installed operation remain separate acceptance work.

Validate the final archive and current source hashes with:

```sh
python3 scripts/check-booklet.py hardware/generated/corner-support --variant corner
```

CI builds this fourth booklet variant, includes its PDF/ZIP in CAD releases and
the public site consumes its checked installed/exploded mesh poses. For a local
site review, set `ARBI_OFFLINE=1` and `ARBI_CORNER_SUPPORT_PACK` to the ZIP path.
Production accepts only the verified release asset, with current source hashes.
