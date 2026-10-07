# Payload assembly booklets

The preferred integrated appearance follows the [industrial design conventions](../../../project/industrial-design.md). Choose one configuration and use its own print list and hardware stacks.

| Configuration | Assembly guide | Source / mesh pack |
| --- | --- | --- |
| Integrated rain/splash enclosure | [Revision 2, 16 A4 pages](ARBI-payload-enclosure-assembly-STL.pdf) | [48-STL pack](ARBI-payload-enclosure-STL-pack.zip) |
| Dry bench alternative | [Revision 4, 14 A4 pages](ARBI-payload-assembly-STL.pdf) | [41-STL pack](ARBI-payload-STL-pack.zip) |

Both 7 October 2026 publications use the revised r0.1.1 deck/yoke, current CAD and nominal hardware meshes, source hashes, assembly transforms, geometry/service reports and an assembled GLB. They replace the earlier published dry bench revision 2; that r0.1.0 snapshot remains in Git history. The dry cover is white, and is omitted from the rain kit.

The [enclosure configuration](../../../../hardware/assemblies/camera-pod/payload-enclosure.md) owns its 18 installed prints, replacement list, hood/fairing/boot/cowl hardware and harness/service steps. The [dry mount document](../../../../hardware/assemblies/camera-pod/payload-mounts.md) owns the alternative quantities. Packs include nominal references and a test coupon; do not print every STL as an installed part.

[Enclosure evidence](../../../../hardware/assemblies/camera-pod/payload-enclosure-check.md) and [dry bench evidence](../../../../hardware/assemblies/camera-pod/payload-geometry-check.md) distinguish sampled rigid CAD checks from physical validation. Received-part fit, flexible cable behaviour, electrical function, strength, rain, heat and flying mass remain unverified. The enclosure's 248.336 g full-solid print estimate does not demonstrate the 170 g complete-pod ceiling.

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
