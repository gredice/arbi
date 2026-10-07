# STL-based winch assembly booklet

- [Assembly booklet, revision 9](ARBI-winch-assembly-STL.pdf) — 20 A4 pages.
- [STL and source pack](ARBI-winch-STL-pack.zip) — 42 ARBI fabrication meshes,
  44 nominal hardware/base/pole/routing references, source snapshots and illustration manifests.
- [Generator and rebuild instructions](../../../../scripts/winch-booklet/README.md).
- [Cover clearance evidence](../../../../hardware/assemblies/winch/coupling-cover-geometry-check.md).

This edition uses furniture-instruction-style line drawings of the actual meshes:
opaque white faces with dark visible outlines and feature edges, without the STL
triangle grid. The [white-shell / black-core conventions](../../../project/industrial-design.md)
remain the product palette in the manifests. It includes the
[full cover r0.3.0](../../../../hardware/assemblies/winch/full-cover.md): three main
panels and two payout shutters for passive, five main panels and four shutters
for powered. Pages 15-20 give clips, added base holes, bottom routing, round-pole
saddles and ordered service.
It covers the passive-line winch and desk feet; powered drum STLs are included
for completeness. The passive-line winch still has a motor.

Coupling cover **0.1.1** adds clearance for the motor mounting screws, washers
and nuts. Its replacement print is `winch-coupling-guard-r0.1.1.stl`. Resolve the
mixed full-cover revisions and selective reprints in the full-cover guide; the
drivetrain is unchanged. The coupling cover accepts a nominal 12 mm-diameter fastener envelope,
14 mm projection from the stand, and the full ±2 mm adjustment with 1 mm added
clearance. Check the actual hardware and dry-fit the replacement.

The purchased-part models are simplified reference geometry, not supplier-certified
manufacturing models or printed substitutes. All model dimensions are in mm.
The booklet distinguishes mesh/clearance checks from unperformed physical tests.

The 7 October 2026 revision 6 introduced a distinct powered index-3 transition
panel, whose payout aperture stops before the bearing/coupling. Revision 9 uses
one pole middle at index 1, one plain middle at index 2 and that transition at
index 3. The [full-cover record](../../../../hardware/assemblies/winch/full-cover-check.md)
reports nominal mesh checks separately from unperformed physical tests.

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

Revision 8 adds actual fascia, rear-shield and bench-blank meshes, keeps the metal fasteners in installed views, and gives reprint quantities, the nominal post opening and release sequence on page 19. The key interfaces still require physical retention/cycle testing.

Revision 9 moves both stationary looms to lower ports beside the pole and adds
the [round-timber mount](../../../../hardware/assemblies/winch/round-pole.md) on
page 20. The supplied saddle meshes fit nominal 120 mm timber and are machined
metal parts, not prints. The [round-pole record](../../../../hardware/assemblies/winch/round-pole-check.md)
checks the 100/120/140 mm study, bolt/cap envelopes and removal paths. Structural
capacity, actual timber fit and cable/retention tests remain outstanding.
