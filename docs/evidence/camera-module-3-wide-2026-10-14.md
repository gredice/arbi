# Wide camera and current-main fit reconciliation — 14 October 2026

This source-derived inspection reconciles PR #218 with main
`61c46d57bf39db5fdcb4fe7c2795d64f0f8744f0`. It retains the received-servo
mounts and drawing-derived Pi reference accepted on main, alongside the
[Wide-camera source review](../../hardware/assemblies/camera-pod/raspberry-pi-camera-module-3/README.md).
The [12 October Wide record](camera-module-3-wide-2026-10-12.md) and
[servo record](micro-servo-cad-2026-10-13.json) describe their earlier configurations.

The combined outer head is **r0.1.5**: main's 49.5 mm tapered X radius and
servo clearance are preserved, with the Wide 48 ×54 mm lower optical opening.
Assembly **r0.3.9** retains the Wide hood's 2 mm rearward placement. Camera
reference r0.1.1, white hood r0.1.2, carrier r0.1.2 and reinforced cradle r0.1.1
remain selected. Load the camera lens-first from the rear with its PCB resting
on the lands; do not bend it under the tabs. Retain the current tray r0.2.3.

The corner booklet failure was a missing `raspberry-pi-camera-module-3.scad`
dependency in its portable ZIP. Main's recursive SCAD collector resolves it.
The [regression](../../scripts/winch-booklet/test-source-packs.py) tests the real
collector against the catalog, checks the resulting ZIP, then removes the
camera library and confirms that the dependency validator rejects it.

## Nominal CAD inspection

Reviewer: Codex source/mesh inspection. Compiler: OpenSCAD 2021.01, macOS
x86_64 executable. Python dependencies follow the
[booklet requirements](../../scripts/winch-booklet/requirements.txt).
The [inspection JSON](camera-module-3-wide-2026-10-14.json) pins the final source
hashes and nominal results. All geometry remains `concept-unvalidated`.

| Check | Result |
| --- | --- |
| Independent camera/hood loading | 81 rear insertion positions; camera and padded PCB clear; both old-hood controls detected |
| Enclosed motion | 555 positions; no unintended intersections; four overtravel stops detected |
| Measured servo interface | Received envelope clears; 25 mm screw pitch clears; old 24 mm control intersects |
| Service, tools and local ports | 30 paths, 22 tool envelopes, six ports; no unintended intersections |
| Wide optical volume | 102° ×67°, 80 mm deep; 15 enclosed positions clear |
| Fixed power route | 111 positions clear; misplaced-route control detected |
| Moving head and neck | 1,545 taper sections; 1.423 mm minimum sampled radial neck clearance; oversized-neck control detected |
| Pi reference | Official plan trace, four holes, 40 GPIO pins, six open sockets and public/booklet equivalence pass; shared-reference evidence regenerated |
| Print-volume evidence | All 73 costed meshes freshly exported and checked closed before BOM regeneration |
| Installed print estimate | Sixteen parts: 251.734 g full-solid PETG at 1.27 g/cm³, including 27.920 g for the head; excludes electronics/metal; not sliced or measured mass |

Reproduce the combined configuration with:

```sh
python3 scripts/winch-booklet/test-source-packs.py
python3 scripts/camera-pod-booklet/build.py --enclosure --output hardware/generated/camera-wide-repair-enclosure
python3 scripts/check-booklet.py hardware/generated/camera-wide-repair-enclosure --variant enclosure
python3 scripts/camera-pod-booklet/build.py --output hardware/generated/camera-wide-repair-bench
python3 scripts/check-booklet.py hardware/generated/camera-wide-repair-bench --variant bench
```

The new enclosure booklet is revision 8 and the bench booklet revision 7.
Their portable packs contain current sources, meshes and machine-readable
inspection reports. Generated PDFs/STLs/ZIPs stay outside Git.

Physical camera seating, washer support, actual latch/ribbon routing, focus,
Wide calibration, rain paths, mass, servo settling and suspended operation
remain unverified. The owner's earlier servo opening-fit acceptance does not
qualify this complete assembly.
