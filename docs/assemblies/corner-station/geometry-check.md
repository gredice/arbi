# Printed corner head nominal geometry record

8 October 2026. New printed models r0.1.0, **concept-unvalidated**.

The [package builder](../../../scripts/corner-support/build.py) exports the
registered printed carrier halves, rear pad, cosmetic covers and shared marking
tool with OpenSCAD 2021.01. Every written STL is read back for positive volume,
watertightness, winding and connected-body checks. Round-100/120/140, square-100
and nominal powered-4.5 configurations remain separately identified.

Nominal checks compare the carrier/pads/covers with the represented timber,
M12 through-bolts, M8 cross-bolts, washers, nuts, provisional received block,
pin, line and cosmetic straps. The current report records sampled cosmetic
service paths (front -Z190 then +Y100; rear -X80), removed-cover tool access,
matching halves, installed and print
transforms, per-configuration bounds and bolt-stack engagement. The top chord
is structural; it is not a lift-off weather roof. No collision sample permits
removing a loaded carrier half.

The tangent comparison reads the canonical winch's axis height, effective drum
diameter and post surface, then compares that independent result with the
exported corner line. The report records rounding tolerance, both winch
tangents and dependent winch source hashes. Nominal tangent agreement does not
establish actual pulley freedom, lateral fleet angle or loaded deflection.
The current nominal block pose is 45° about its Y pin, with a provisional
40 mm pin-to-sheave separation, equal leg tensions and a horizontal +X span.
The pin and sheave centres therefore have distinct X/Z coordinates; an upright
block envelope is not the equal-tension alignment reference. Other span angles,
unequal tensions, friction and received articulation remain unverified.
An independently transformed vertical block mesh matches the installed pose.
The synthetic 10 N reaction produces zero moment at that pose; the rejected
vertical block leaves 400 N mm. This is an equilibrium arithmetic check for
the represented geometry, not a received-hardware or motion test.

Independent negative controls reject insufficient M12 × 180 engagement in the
printed stack and the historical round-120/150-angle tangent mismatch of
42.55 mm. Synthetic vector statics checks right-angle resultant, unilateral
guy reaction, transverse load and eccentric ground moment. These are arithmetic
references without an operating load limit or material capacity calculation.
One-cubic-millimetre material probes in both halves verify that root through-
bolt cutters do not remove the terminal lug, and the short central pin cutter
does not perforate the outer webs. Separate void probes verify the pin bore
remains open. Negative controls reproduce both incorrect long cutters, an
unrelieved fascia collision and the rejected +X40/+Y5 front-cover path.

The PDF and GLB use actual exported meshes, recorded filenames, product-role
colors and installed/exploded transforms. Archive validation checks registered
filenames, current source/mesh identity, figure references, PDF status/page
information and file hashes. Inspect every rendered PDF page separately for
legibility. Generated `geometry-report.json` and `manifest.json` identify the
exact source/mesh revision; rerun builder/checker after source changes.

## Execution status

Local nominal execution on 8 October 2026 used Node.js 24.15.0 and OpenSCAD
2021.01. `pnpm cad:check -- --require-openscad` compiled all 99 registered
entrypoints. The printed package builder passed 1,785 nominal checks across all
five named configurations and produced 95 STL files: fabrication meshes,
print poses, bought-part references and vertical-block controls. Every single
part's longest print dimension was at most 205 mm, within the checked 256 mm
envelope and 5 mm XY edge reserve. This excludes slicing/support clearance.

The eight-page A4 guide was rendered page by page and inspected for legibility,
figure correspondence, clipping and overlap. The matching generated report
contains exact mesh/source hashes, per-configuration bounds and controls.
Run `python3 scripts/check-booklet.py hardware/generated/corner-support
--variant corner` against the final pack to verify current source/ZIP identity;
an older archive with matching filenames is insufficient. The historical
metal-head execution record does not qualify these printed load-bearing parts.

These checks cannot establish layer bonding, anisotropic strength, fastener
pressure, sustained-load creep, fatigue, outdoor temperature/conditioning,
printer quality, actual timber contact/preload, received double-tang/pin fit,
thin-line keeper retention, guy connection, soil, wind or installed capacity.
The [acceptance record](acceptance-record.md) keeps those physical/process
requirements open. Nominal geometric contact is not a pressure, clamp-friction
or structural qualification.
