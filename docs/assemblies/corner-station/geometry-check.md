# Corner head nominal geometry record

8 October 2026, package r0.1.0, **concept-unvalidated**.

The [package builder](../../../scripts/corner-support/build.py) exports registered
CAD with OpenSCAD 2021.01 and reads every written STL back. It verifies positive
volume, watertightness, consistent winding and single-body custom parts; checks
round-100/120/140 and square-100 configurations; includes the nominal powered
4.5 mm line study; compares represented post, bolts, washers, nuts, block and
line/strap envelopes; samples the roof's 20 mm lift/80 mm side slide, the stem's
40 mm outward pull/80 mm side slide, and the rear cover's 80 mm pull; and rejects a straight roof pull against the provisional
connector. Socket access
is checked with the covers removed.

The generated report identifies source/mesh hashes, bounds, volumes, checks,
bolt engagement and tangent error. Independent negative controls reject the
historical round-120/150-angle depth mismatch (42.55 mm) and insufficient
M12 × 160 engagement with the round-120 saddle stack. Synthetic vector-statics
references check the right-angle resultant, a unilateral guy, transverse load
and residual eccentric ground moment.

The tangent comparison reads the canonical winch's axis height, effective drum
diameter and post surface with OpenSCAD, then compares that independent result
with the written corner line mesh to 0.001 mm, accounting for ASCII STL coordinate
rounding and its polygonal line radius. The pack records both winch tangents and hashes
the dependent winch CAD/documents as well as the corner sources.

The eight-page A4 PDF and GLB use current exported meshes, recorded filenames,
product-role colors and installed/exploded transforms. The builder verifies
PDF page count/status text and every archived file hash. Review all rendered
PDF pages separately; source/geometry checks do not establish drawing legibility.

## Local execution, 8 October 2026

OpenSCAD 2021.01 on the proposed round-100/120/140, powered-line and square-100
configurations passed 1,398 nominal mesh checks. The independent archive checker
verified eight A4 pages, 68 current meshes and matching source/ZIP hashes. All
eight PDF pages were rendered and visually inspected. The repository CAD check
compiled all 92 registered entrypoints. These are nominal/software checks;
physical acceptance remains unperformed.

Exact source/mesh identity and per-configuration dimensions travel in
`geometry-report.json` and `manifest.json` with the generated package. Run the
builder and independent checker again after source changes; the dated result
does not validate later revisions.

Unrepresented factory holes/perforations, actual bend and material, received
double-tang/pin fit, flexible cable motion, keeper retention, guy connection,
timber variability/preload, wind/dynamics, corrosion, soil, load capacity, print
process and installed acceptance remain open in the
[acceptance record](acceptance-record.md). Nominal contact is not a pressure,
clamp-friction or load qualification.
