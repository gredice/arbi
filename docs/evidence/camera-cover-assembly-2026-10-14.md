# Camera cover insertion correction — 14 October 2026

The owner reported that the Camera Module 3 Wide still could not be fitted into
the printed cover and supplied `20261014_172445.jpg`. The image shows the camera
partly inserted at an angle beside the cover's screw seats. It supplies physical
failure evidence, but cannot identify the printed revision, quantify the contact
or establish received-unit/printer tolerances. The photograph SHA-256 is
`ac446cdcb04562b91469b33abdd8cab675a2a6effca97b86721e0e1c9c15b15b`.
The prior [Wide reconciliation](camera-module-3-wide-2026-10-14.md) tested nominal
straight loading into hood r0.1.2; that CAD result did not establish printed fit.

## Revised design and assembly

Reprint **only white P09 `camera-pod-integrated-camera-hood` r0.1.3** for this
update. Assembly `camera-pod-assembly` advances to r0.3.10. The cradle, outer
head, four 21 ×12.5 mm camera screw axes, installed PCB seat and existing four
M2 ×12 screws, four nuts and eight washers retain their current geometry.

- The rear cavity grows from 27.8 ×26.6 to 29.4 ×28.2 mm and flares to 31 ×30 mm.
- The side walls end at local Z=6 rather than Z=8. The four PCB lands still seat
  at Z=9.4, with outside gussets joining them to the low walls and no inward lip.
- The optical opening grows from 12.2 to 13.6 mm rounded square, retaining
  nominal 1 mm webs beside the Ø5.4 screw/washer access tunnels.
- The rear CSI edge is open above the front rim for ribbon/latch access.

These dimensions are ARBI handling/print allowances; they do not change the
[manufacturer dimensions](../../hardware/assemblies/camera-pod/raspberry-pi-camera-module-3/README.md)
or claim measurements from the photograph.

With power disconnected, support the loose hood by its outer rim with the rear
facing up and at least 3 mm free space below the lens opening. Lower the camera
lens-first from its open rear, level it before contact and check all
four PCB holes rest on the seats. Keep the CSI connector at the open edge and
connect the ribbon while accessible. Secure the horn centre screw and opposite
pivot support before offering the seated pair to the cradle, then
fit the existing screws/washers/nuts and tighten evenly without bending the PCB.
No PCB corner goes underneath plastic. The updated enclosure booklet is
revision 9 and illustrates the loose-hood loading step with actual CAD meshes.

## Nominal verification scope

The [fit checker](../../scripts/camera-pod-booklet/check_camera_fit.py) checks
straight loading with a 25.4 ×24.4 ×1.52 mm PCB guard; four guided approaches
from ±20° about X/Y with a 0.8 mm lateral start offset; and a larger
11.6 ×11.6 ×7.2 mm autofocus envelope. The guided paths align over the last
12 mm before seating. Arbitrary angled insertion is not qualified. A symmetric
±0.8 mm front-clearance probe detects the previous r0.1.2 aperture's reduced
margin while clearing r0.1.3. This reproduces a bounded clearance deficit,
not an exact reconstruction of the photograph. The old r0.1.1 interference
controls are retained too. A 24 ×18 ×5 mm rear-access envelope crosses the
complete shell edge (Y=−27..−9), independently of the cutter dimensions. It
clears the revised exit and detects both the previous closed edge and an
unreleased short-cut fixture which leaves a thin closing lip. The notch must
reach beyond the outer Y=−20.469 shell edge.

The [machine-readable inspection record](camera-cover-assembly-2026-10-14.json)
pins the source hashes and nominal results. The corrected hood has zero
installed intersections; all 555 pan/tilt positions, four overtravel controls,
30 service paths, 22 tool envelopes, 15 Wide optical poses and 111 fixed-route
poses pass. The current sixteen-print full-solid PETG estimate is 249.886 g at
1.27 g/cm³, excluding hardware/electronics; it is not sliced or measured mass.

The final local pack uses a complete source export with accepted camera
reference r0.2.0 from PR #220. Its nominal overall envelope and bores are
unchanged; the detailed camera reference, camera fit, assembly/service, motion
and source-pack checks pass again after reconciliation. The rear exit extends
through the outer wall. CI must perform a clean source rebuild and
package check before merge.
OpenSCAD 2021.01 and the pinned booklet dependencies generate the meshes,
service/motion checks, illustrated PDF and portable source/STL pack. Generated
STLs, PDFs, ZIPs and bulk figures stay outside Git.

Reproduce the current enclosure with:

```sh
python3 scripts/camera-pod-booklet/build.py --enclosure --output hardware/generated/camera-cover-assembly-final
python3 scripts/check-booklet.py hardware/generated/camera-cover-assembly-final --variant enclosure
pnpm cad:check -- --require-openscad
pnpm bom:check
pnpm docs:check
```

Physical reprint/received-camera seating, four-seat support, washer support,
latch operation, ribbon bends, focus/framing, rain paths and strength remain
unverified. The enlarged opening/open CSI edge needs renewed splash inspection.
Sampled CAD paths and CI do not establish physical fit or suspended operation.
