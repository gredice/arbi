# STL-based winch assembly booklet

- [Assembly booklet, revision 4](ARBI-winch-assembly-STL.pdf) — 14 A4 pages.
- [STL and source pack](ARBI-winch-STL-pack.zip) — 16 ARBI fabrication meshes,
  29 nominal hardware/base references, source snapshots and illustration manifests.
- [Generator and rebuild instructions](../../../../scripts/winch-booklet/README.md).
- [Cover clearance evidence](../../../../hardware/assemblies/winch/coupling-cover-geometry-check.md).

This edition applies the [white-shell / black-core conventions](../../../project/industrial-design.md) to all actual-mesh illustrations. The coupling guard is white and the mechanical core is charcoal. It adds no full winch cover; that is separate follow-up work.
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

The 7 October 2026 edition regenerates figures, PDF and ZIP with the neutral palette, retaining the M8 locknut correction and all fabrication dimensions.

The owner explicitly requested this PDF and downloadable STL/source bundle be
committed on 27 September 2026. They are published artifact snapshots; canonical
geometry remains in `hardware/**/*.scad`. Individual working STLs and bulk render
PNGs stay in the ignored build directory. Regenerate the PDF and ZIP together
after changes using the generator's `--publish` option.
