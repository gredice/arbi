# Payload assembly booklet

- [Assembly booklet, revision 2](ARBI-payload-assembly-STL.pdf): 14 A4 pages.
- [STL/source pack](ARBI-payload-STL-pack.zip): 11 fabrication STLs, 29 hardware references, one legacy keep-out, assembled GLB, source snapshots and check reports.
- [Mount dimensions and quantities](../../../../hardware/assemblies/camera-pod/payload-mounts.md).
- [CAD integration evidence](../../../../hardware/assemblies/camera-pod/payload-geometry-check.md).
- [Rebuild instructions](../../../../scripts/payload-booklet/README.md).

This revision adds the missing printed mounting structure. It uses provisional servo, horn, converter and capacitor dimensions and remains a dry bench prototype. Rigid motion and selected assembly/service checks pass for those nominal references. Actual fit, cable behaviour, electrical function, strength and flying mass are not validated.

The 6 October 2026 text correction clarifies servo-ear screw orientation in the mount documentation and its ZIP source snapshot. The existing CAD, meshes, PDF and geometry/service results are unchanged.

The owner requested the completed payload work and booklet be pushed to the repository on 28 September 2026. The PDF and ZIP are reviewable artifact snapshots, matching the existing winch-booklet publication convention. Canonical CAD remains `hardware/**/*.scad`; individual generated meshes and bulk renders remain outside the tracked tree. Regenerate both deliverables together using `--publish` after geometry changes.
