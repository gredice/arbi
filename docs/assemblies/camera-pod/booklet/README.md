# Payload assembly booklets

The checked-in publications below are the earlier enclosure r0.1.0 and unchanged dry bench snapshots. Compact enclosure r0.2.5 uses booklet revision 5. Rebuild it locally from CAD with the [build command](../../../../scripts/payload-booklet/README.md), or use CI artifacts or releases matching the selected commit when available. It uses head r0.1.3 and tray r0.2.3, carrier r0.1.1 and new integrated cradle/pivot-support r0.1.0. Its camera axis is 14 mm higher; the tilt servo is horizontal and 2 mm inboard. The separate rear camera cowl and four secondary nuts are omitted, and camera screws return to M2 × 12. Use this compact kit’s print list and hardware rather than the earlier enclosure pack.

Reproduce the current enclosure build from the repository root:

```sh
python3 scripts/payload-booklet/build.py --enclosure --output hardware/generated/payload-compact-gimbal
```

The preferred integrated appearance follows the [industrial design conventions](../../../project/industrial-design.md). Choose one configuration and use its own print list and hardware stacks.

| Configuration | Assembly guide | Source / mesh pack |
| --- | --- | --- |
| Integrated rain/splash enclosure | [Revision 2, 16 A4 pages](ARBI-payload-enclosure-assembly-STL.pdf) | [48-STL pack](ARBI-payload-enclosure-STL-pack.zip) |
| Dry bench alternative | [Revision 4, 14 A4 pages](ARBI-payload-assembly-STL.pdf) | [41-STL pack](ARBI-payload-STL-pack.zip) |

Both historical 7 October 2026 publications use the r0.1.1 dry deck/yoke, the CAD and nominal hardware meshes of their own revisions, source hashes, assembly transforms, geometry/service reports and an assembled GLB. They replace the earlier published dry bench revision 2; that r0.1.0 snapshot remains in Git history. The dry cover is white, and is omitted from the rain kit.

The [current enclosure configuration](../../../../hardware/assemblies/camera-pod/payload-enclosure.md) owns its 13 fabrication models, 16 installed prints, replacement list, hood/head/camera hardware and supported harness/service steps. The [dry mount document](../../../../hardware/assemblies/camera-pod/payload-mounts.md) owns the alternative quantities. The current compact pack has 44 meshes: 13 fabrication models, 30 nominal hardware references and one routing proxy. The test coupon is optional; do not print every STL as an installed part.

The [current enclosure record](../../../../hardware/assemblies/camera-pod/payload-enclosure-check.md), [historical enclosure evidence](../../../../hardware/assemblies/camera-pod/payload-enclosure-check-r0.1.0.md) and [dry bench evidence](../../../../hardware/assemblies/camera-pod/payload-geometry-check.md) distinguish sampled rigid CAD checks from physical validation. Received-part fit, flexible cable behaviour, electrical function, strength, rain, heat and flying mass remain unverified. The current compact-gimbal build passes its sampled nominal checks and totals 253.753 g for 16 installed prints as a solid-volume PETG estimate at 1.27 g/cm³. This excludes electronics and hardware, is not sliced or measured mass, and does not demonstrate the 170 g complete-pod ceiling.

The owner requested the updated publications on 7 October 2026. PDFs and ZIPs are reviewable snapshots; canonical geometry remains `hardware/**/*.scad`, and loose meshes/bulk renders remain untracked. Follow the [rebuild instructions](../../../../scripts/payload-booklet/README.md) and regenerate each PDF and pack together with `--publish` after changes.

Enclosure revision 2 and bench revision 4 refresh every illustration as white-face
line art with dark silhouettes and visible feature edges, so black brackets and
hardware remain readable. Configuration headers and page totals are specific to
each variant. The GLB and assembly manifests retain the product palette.

[Booklet CI](../../../../.github/workflows/booklets.yml) builds all three booklets
on relevant PRs and manual dispatches. On `main`,
[CAD release CI](../../../../.github/workflows/cad-release.yml) adds their PDFs and
STL/source packs to the same commit's geometry release. Checked-in files remain
dated snapshots; tagged releases contain current commit-matched builds.
