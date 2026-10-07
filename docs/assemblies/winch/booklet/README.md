# STL-based winch assembly booklet

- [Assembly booklet, revision 7](ARBI-winch-assembly-STL.pdf) — 18 A4 pages.
- [STL and source pack](ARBI-winch-STL-pack.zip) — 27 ARBI fabrication meshes,
  35 nominal hardware/base/routing references, source snapshots and illustration manifests.
- [Generator and rebuild instructions](../../../../scripts/winch-booklet/README.md).
- [Cover clearance evidence](../../../../hardware/assemblies/winch/coupling-cover-geometry-check.md).

This edition uses furniture-instruction-style line drawings of the actual meshes:
opaque white faces with dark visible outlines and feature edges, without the STL
triangle grid. The [white-shell / black-core conventions](../../../project/industrial-design.md)
remain the product palette in the manifests. It includes the
[full cover r0.1.0](../../../../hardware/assemblies/winch/full-cover.md): three main
panels and two payout shutters for passive, five main panels and four shutters
for powered. Pages 15-18 give clips, added base holes, routing and ordered service.
It covers the passive-line winch and desk feet; powered drum STLs are included
for completeness. The passive-line winch still has a motor.

Coupling cover **0.1.1** adds clearance for the motor mounting screws, washers
and nuts. Reprint only `winch-coupling-guard-r0.1.1.stl`. Other fabrication models
remain 0.1.0. The cover accepts a nominal 12 mm-diameter fastener envelope,
14 mm projection from the stand, and the full ±2 mm adjustment with 1 mm added
clearance. Check the actual hardware and dry-fit the replacement.

The purchased-part models are simplified reference geometry, not supplier-certified
manufacturing models or printed substitutes. All model dimensions are in mm.
The booklet distinguishes mesh/clearance checks from unperformed physical tests.

The 7 October 2026 revision 6 regenerates the figures, PDF and ZIP with a distinct powered index-3 transition panel, whose payout aperture stops before the bearing/coupling. Print two powered middles and one transition; a third middle is incompatible. It retains the original drivetrain and M8 locknut correction and the passive/powered installed and exploded previews. The [full-cover record](../../../../hardware/assemblies/winch/full-cover-check.md) reports nominal mesh checks separately from unperformed physical tests.

The owner explicitly requested this PDF and downloadable STL/source bundle be
committed on 27 September 2026. They are published artifact snapshots; canonical
geometry remains in `hardware/**/*.scad`. Individual working STLs and bulk render
PNGs stay in the ignored build directory. Regenerate the PDF and ZIP together
after changes using the generator's `--publish` option.

Revision 7 refreshes every figure for the current redesigned winch and full-cover
kit. [Booklet CI](../../../../.github/workflows/booklets.yml) builds the current
winch and both payload variants on relevant PRs and manual runs. On `main`, their
PDFs and STL/source packs join the same commit's
[CAD release](../../../../.github/workflows/cad-release.yml). The files above are
the checked-in publication snapshot; release downloads match their tagged commit.
