# Printed corner support package builder

Use OpenSCAD 2021.01 and the existing
[booklet Python dependencies](../winch-booklet/requirements.txt).

```sh
python3 scripts/corner-support/build.py
```

The fresh temporary build exports the six registered printed fabrication models,
nominal bought references and deliberate print poses. It checks round 100/120/140
mm, passive/powered line assumptions and square-100; bolt engagement, alignment,
socket access, installed clearance and sampled cover-removal paths. It renders
actual meshes with the existing winch line-art renderer and writes an eight-page
A4 PDF, GLB, hash reports and verified portable source/STL ZIP. Working outputs
go to ignored `hardware/generated/corner-support`; `--output` overrides it.

The default printed head replaces the angle, machined saddles and stacked backing
plates. It retains ordinary metal through-bolts, washers, locking nuts,
cross-bolts and the received pulley/pin. Historical metal geometry remains in
the source snapshot for context, but its fabricated meshes are absent from the
new installed scene. Never combine study variants in one installation.

## Frames and printing

`models/arbi` files use the installed frame in millimetres. The rear-pad STL is
centred at Z=0; two installed instances sit at Z=45/155. The template is already
flat. `models/print` files rotate each real fabrication mesh into its documented
print pose, then translate its XY minimum to zero. The geometry report records
the complete rigid installed-to-print matrix and read-back mesh bounds. The GLB
uses metres and applies the real installed transforms.

Each part is checked separately against a nominal 256 × 256 × 256 mm printer
envelope, with a 5 mm edge reserve in XY: maximum footprint 246 × 246 mm. This
bounding-box check is not slicing approval and does not reserve brim, supports,
purge lines or machine-specific excluded areas. The carrier web faces lie on
the bed; the central lug and horizontal holes need reviewed local supports.
See the [design package](../../docs/assemblies/corner-station/design-package.md)
for process and load qualification. No numerical slicing settings or strength
rating follows from a watertight mesh or a nominal bed fit.

The builder exports from canonical SCAD into an empty temporary directory. It
reads the written STLs back and checks watertightness, winding, positive volume,
single connected bodies, current registry filenames, print transforms and bed
bounds. It compares every installed custom part instance against references and
other custom parts with only zero-volume mating contact permitted. Portable
canonical sources are under `source/repository`; rebuild from an ARBI checkout
with the pinned tooling. Stale output-folder files never enter the ZIP.

The provisional block uses the frictionless equal-leg-tension 90-degree pose:
-45° about its Y pin, with a 40 mm pin-to-sheave distance. An independent
moment calculation rejects the vertical block pose, and the actual block mesh
is compared with the transformed vertical reference. The new pin X offset
preserves the canonical winch tangent; arbitrary span azimuth and received
articulation remain unqualified. One-mm³ lug/web probes reject accidental
extended M12/pin cutters. Regression controls also reject an unrelieved cover
fascia and the old front-cover X/Y removal. The checked service is front cover
190 mm down then 100 mm sideways, and rear cover 80 mm backward.

Render every PDF page with `pdftoppm` and inspect it after layout changes. These
checks establish nominal geometry only. Received BA01090 pin/groove/retention,
guy attachment, print process, long-term creep, timber, soil, structural load
capacity and installed operation require separate acceptance.

Validate the final archive and current source hashes with:

```sh
python3 scripts/check-booklet.py hardware/generated/corner-support --variant corner
```

CI builds this fourth booklet variant and includes its PDF/ZIP in CAD releases.
The public site consumes the checked installed/exploded mesh poses. For local
site review, set `ARBI_OFFLINE=1` and `ARBI_CORNER_SUPPORT_PACK` to the ZIP path.
Production accepts only the verified release asset, with current source hashes.
