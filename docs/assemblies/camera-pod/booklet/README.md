# Camera pod assembly booklets

> **Critical — temporary cable-tie retention.** The archived snapshots below show converter ties; current generator outputs replace them with four screw stacks. Capacitor and harness ties remain temporary bench workarounds only. Dedicated capacitor retention and harness strain relief remain unresolved; see the [prioritized BOM warnings](../../../../bom/README.md#warning-priorities).

The checked-in publications below are the earlier enclosure r0.1.0 and unchanged dry bench snapshots. The current `camera-pod-assembly` r0.3.10 uses enclosure booklet revision 9, camera hood r0.1.3 and integrated electronics deck r0.1.1. Rebuild it locally from CAD with the [build command](../../../../scripts/camera-pod-booklet/README.md), or use CI artifacts or releases matching the selected commit when available. It uses head r0.1.5 and tray r0.2.3, carrier r0.1.2 and reinforced integrated cradle r0.1.1 / pivot-support r0.1.0. Its camera axis is 14 mm higher; the tilt servo is horizontal and 2 mm inboard. The separate rear camera cowl and four secondary nuts are omitted, and camera screws return to M2 × 12. Use this compact kit’s print list and hardware rather than the earlier enclosure pack.

Reproduce the current enclosure build from the repository root:

```sh
python3 scripts/camera-pod-booklet/build.py --enclosure --output hardware/generated/camera-pod-compact-gimbal
```

The preferred integrated appearance follows the [industrial design conventions](../../../project/industrial-design.md). Choose one configuration and use its own print list and hardware stacks.

| Configuration | Assembly guide | Source / mesh pack |
| --- | --- | --- |
| Integrated rain/splash enclosure | [Revision 2, 16 A4 pages](ARBI-payload-enclosure-assembly-STL.pdf) | [48-STL pack](ARBI-payload-enclosure-STL-pack.zip) |
| Dry bench alternative | [Revision 4, 14 A4 pages](ARBI-payload-assembly-STL.pdf) | [41-STL pack](ARBI-payload-STL-pack.zip) |

Both historical 7 October 2026 publications use the r0.1.1 dry deck/yoke, the CAD and nominal hardware meshes of their own revisions, source hashes, assembly transforms, geometry/service reports and an assembled GLB. They replace the earlier published dry bench revision 2; that r0.1.0 snapshot remains in Git history. The dry cover is white, and is omitted from the rain kit.

The [current enclosure configuration](../../../../hardware/assemblies/camera-pod/camera-pod-enclosure.md) owns its 13 fabrication models, 16 installed prints, replacement list, hood/head/camera hardware and supported harness/service steps. The [dry mount document](../../../../hardware/assemblies/camera-pod/camera-pod-mounts.md) owns the alternative quantities. The current compact pack has 44 meshes: 13 fabrication models, 30 nominal hardware references and one routing proxy. The test coupon is optional; do not print every STL as an installed part.

The [current enclosure record](../../../../hardware/assemblies/camera-pod/camera-pod-enclosure-check.md), [historical enclosure evidence](../../../../hardware/assemblies/camera-pod/camera-pod-enclosure-check-r0.1.0.md) and [dry bench evidence](../../../../hardware/assemblies/camera-pod/camera-pod-geometry-check.md) distinguish sampled rigid CAD checks from physical validation. Received-part fit, flexible cable behaviour, electrical function, strength, rain, heat and flying mass remain unverified. The earlier compact-gimbal build passed its stated sampled nominal checks and totalled 253.622 g for 16 installed prints as a solid-volume PETG estimate at 1.27 g/cm³. This excludes electronics and hardware, is not sliced or measured mass, and does not demonstrate the 170 g complete-pod ceiling.

The owner requested the updated publications on 7 October 2026. PDFs and ZIPs are reviewable snapshots; canonical geometry remains `hardware/**/*.scad`, and loose meshes/bulk renders remain untracked. Follow the [rebuild instructions](../../../../scripts/camera-pod-booklet/README.md) and regenerate each PDF and pack together with `--publish` after changes.

Enclosure revision 2 and bench revision 4 refresh every illustration as white-face
line art with dark silhouettes and visible feature edges, so black brackets and
hardware remain readable. Configuration headers and page totals are specific to
each variant. The GLB and assembly manifests retain the product palette.

[Booklet CI](../../../../.github/workflows/ci.yml) builds affected booklets
on relevant PRs and all four on release runs or manual dispatches. On `main`,
[CAD release CI](../../../../.github/workflows/ci.yml) adds their PDFs and
STL/source packs to the same commit's geometry release. Checked-in files remain
dated snapshots; tagged releases contain current commit-matched builds.

## Received-converter update, 12 October 2026

The [received-unit and CAD record](../../../evidence/buck-converter-2026-10-12.md) supersedes the converter envelope and retention in the archived snapshots above. Current generator outputs are enclosure revision 6 (16 pages, deck r0.1.1) and bench revision 5 (14 pages, deck r0.1.2). Both use four M2.5 × 10 converter screw stacks and the measured 50 × 30 × 17 mm envelope with Ø3 mm holes at 45 × 24 mm pitch. The compact centre moves to [35,0] and the dry centre to [46,0] to clear existing frame nuts. Tagged CAD releases publish the regenerated PDFs/ZIPs; committed earlier PDFs retain their original revisions.

## Camera hood assembly correction — 14 October 2026

Reprint only white P09 r0.1.3 for the repeat insertion failure. Its lower flared
walls, open CSI edge and larger optical opening are illustrated in enclosure
booklet revision 9. Prepare the camera in the loose hood on the bench before
clamping it to the cradle; inspect all four PCB seats and connect the ribbon
while accessible. Existing four M2 ×12 bolts, four nuts and eight washers remain.
The [new fit record](../../../evidence/camera-cover-assembly-2026-10-14.md)
records nominal mesh/path checks and the required physical reprint inspection.
Committed historical PDF/ZIP snapshots retain their stated revisions; use the
current source build or matching CI/release artifacts for this update.
