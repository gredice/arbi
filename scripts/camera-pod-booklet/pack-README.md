# ARBI camera pod bench assembly — printed mount set r0.1.0

Start with **ARBI-camera-pod-bench-assembly-STL.pdf**. The pack includes the missing electronics deck, servo mounts, camera cradle, removable pivot support, horn retainers, hood and cover. All dimensions are mm.

## What to print

| Model in models/printable | Installed quantity |
| --- | ---: |
| camera-pod-spider-r0.1.0.stl | 1 existing spider |
| camera-pod-electronics-deck-r0.1.0.stl | 1 |
| camera-pod-spider-spacer-r0.1.0.stl | 4 |
| camera-pod-pan-servo-mount-r0.1.0.stl | 1 |
| camera-pod-pan-yoke-r0.1.0.stl | 1 |
| camera-pod-tilt-pivot-support-r0.1.0.stl | 1 |
| camera-pod-camera-cradle-r0.1.0.stl | 1 |
| camera-pod-horn-retainer-r0.1.0.stl | 2 |
| camera-pod-camera-hood-r0.1.0.stl | 1 |
| camera-pod-electronics-cover-r0.1.0.stl | 1 |
| camera-pod-servo-fit-coupon-r0.1.0.stl | 1 test piece, not installed |

Eleven printable files; fourteen installed printed pieces including the existing spider. The other 29 STLs are bought-part references. The context folder contains one legacy keep-out mesh, not an enclosure and not the envelope of this revised assembly. Do not print bought-part or keep-out meshes as functional hardware.

## Check the actual parts first

The provisional servo is 20 x 8.5 x 18 mm, ear span 27 mm, hole pitch 24 mm, shaft offset 5 mm and output tip 22 mm above its case bottom. The stock horn reference has an 8 mm hub and one 12 mm arm, 2 mm hub thickness / 1.5 mm arm thickness. Measure the real case, lug heights, shaft, horn and lead exit. Print the coupon before the complete set. No supplier model, spline or OEM screw thread has been verified.

Converter: 45 x 25 x 15 mm reference; capacitor: 10 x 16 mm can. The tiedown method is only usable if the actual components leave the represented clear strap strips. The camera/Pi board mounting patterns follow their cited drawings; connector/component envelopes remain simplified. All source URLs and assumptions are in sources.json.

Countersunk screws at servo ears and horn retainers are essential: ordinary proud screw heads collide during rotation. The pivot support is detachable to let the cradle slide onto its stock horn. Install servo ear screws before closing the gimbal; install the tilt centre screw before the camera board. Full screw counts and stack order are in the PDF.

## What is checked

- Exported STLs reopened: closed, consistent winding, positive volume, one connected body per fabrication/hardware part.
- 555 rigid poses at 5-degree steps: pan -90..90, tilt 0..70.
- Mechanical stop contact outside nominal travel.
- Nominal insertion/removal paths, selected short-driver access, and 66 x 41 degree camera viewing volume to 80 mm.
- A deliberately proud screw-head control must reproduce a collision.

The JSON reports specify every tested pose range, exclusion, tool envelope and assumption. Servo spline and original centre-screw engagement are intentional exclusions. This is sampled rigid-geometry checking, not continuous collision proof or a flexible-ribbon simulation.

The existing spider plus mounts have a high full-solid mass. That calculation, before electronics/metal hardware, does not demonstrate the 170 g flying ceiling. Measure sliced and actual mass and redesign lighter parts before suspended use. Line tensile terminations, docking-stud support, balance, strength, fatigue, power, cable flex, weather protection and physical fit remain unverified.

## Inspect and rebuild

- ARBI-camera-pod-bench-assembled.glb: colored complete assembly; GLB uses metres, while STL files use millimetres.
- assembly-manifest.json and figure-manifest.json: source mesh filenames and transforms.
- mesh-manifest.json: dimensions, body counts, volumes and SHA-256 hashes.
- source-provenance.json: source snapshot and starting repository commit.
- source/arbi-hardware: canonical OpenSCAD snapshots and model registry.
- source/reference-parts.scad: editable simplified purchased parts.

With Python dependencies from source/requirements.txt and OpenSCAD 2021.01:

```bash
python3 source/export_models.py
python3 source/check_integration.py
python3 source/check_service.py
python3 source/render_figures.py
python3 source/build_booklet.py
```

The complete repository wrapper is scripts/camera-pod-booklet/build.py in https://github.com/gredice/arbi. Bench concepts remain concept-unvalidated; no physical test is claimed.
