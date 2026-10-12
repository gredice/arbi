# Received Camera Module 3 Wide and hood fit revision — 12 October 2026

The owner confirmed the received camera is **Wide (120° diagonal FOV)** and
reported that it could not fit the previous integrated hood or get beneath the
plastic screw mounts. This is an owner-reported fit failure and variant identity,
not an independently measured envelope. The [design proposal](https://github.com/gredice/arbi/issues/215)
selects Wide under the existing camera BOM ID. The [official source review](../../hardware/assemblies/camera-pod/raspberry-pi-camera-module-3/README.md)
records both variants, source hashes, datum conversions and PDF/STEP conflicts.

## Geometry and assembly changes

- Camera reference r0.1.1 uses one canonical source for the Parts illustration
  and booklet. Rounded PCB, square autofocus region, lens centre and larger
  correctly placed rear CSI socket replace the former box/cylinder assumption.
- The selected conservative envelope is 25 ×23.862 ×12.4 mm. Carrier thickness
  1.12 follows the PDF; the larger 22.92 ×6.54 rear socket follows the STEP.
  These primitives retain uncertainty instead of claiming a production mesh.
- Reprint `camera-pod-integrated-camera-hood` r0.1.2. Rear cavity is 27.8 ×26.6,
  front aperture 12.2 mm rounded-square and the body is 2 mm shallower. Four 1.4 mm seating lands
  move 2 mm toward its optical face; assembly r0.3.8 moves the hood 2 mm rearward
  so the installed PCB/cradle and original four M2 ×12 clamp stacks stay aligned.
- Load the camera lens-first from the open rear. Its PCB rests **on** the rear
  lands. Do not bend it or tuck it beneath plastic; insert the front screws and
  washers through the tunnels before fitting the rear nuts.
- Optical checks use the selected Wide 102° horizontal ×67° vertical field,
  including an aft lens-origin allowance; the earlier Standard 66° ×41° reports
  describe only their original revisions.

- Reprint the black outer head r0.1.4 too. Its lower opening grows from
  42 ×48 to 48 ×54, removing Wide-ray chin intersections at tilt 0°/35°
  while preserving the upper opening, circular neck and four head clamps.

## Source checks

The reproducible booklet build includes `check_camera_fit.py` before assembly,
service, converter, cradle and sampled motion checks. It inspects the exported
camera and hood meshes independently, a 25.4 ×24.4 ×1.52 PCB allowance and a
10.95-square front footprint. The retained exact r0.1.1 hood is a negative
control: a square body near the face and a PCB pushed 1 mm under its old lands
must intersect plastic. The earlier nominal assembled Standard pose was clear;
its test never independently loaded a camera into the hood.

The [inspection JSON](camera-module-3-wide-2026-10-12.json) records the exact
source/mesh hashes and these final nominal outcomes:

| Check | Result |
| --- | --- |
| Camera and padded PCB rear insertion | 81 poses at 0.25 mm increments; no interference |
| Old-hood controls | Both detected: square-face 2.790 mm³ and under-land PCB 53.899 mm³ |
| Complete enclosure motion | 555 poses; neutral and motion intersections absent; four overtravel stops detected |
| Service and tools | 30 paths, 22 tool envelopes; no unintended intersections |
| Wide optical volume | 102° ×67°, 80 mm deep, 15 poses; no intersections |
| Cable ports / fixed lead | 6 local ports; 111 rigid-route poses; no intersections; wrong-route control detected |
| Printed mesh estimate | 250.820 g fully dense PETG at 1.27 g/cm³ for sixteen installed prints, excluding electronics/metal; not sliced or measured mass |
| Booklets | Enclosure revision 7: sixteen pages; bench revision 6: fourteen pages; current models and source/ZIP checks |

These are source-derived CAD outcomes, not physical fit or optical qualification.

Reproduce using the repository-pinned OpenSCAD 2021.01 and the
[booklet dependencies](../../scripts/winch-booklet/requirements.txt):

```sh
python3 scripts/camera-pod-booklet/build.py --enclosure --output hardware/generated/camera-module-3-wide
python3 scripts/check-booklet.py hardware/generated/camera-module-3-wide --variant enclosure
python3 scripts/camera-pod-booklet/build.py --output hardware/generated/camera-module-3-wide-bench
python3 scripts/check-booklet.py hardware/generated/camera-module-3-wide-bench --variant bench
```

## Remaining physical acceptance

Reprint and inspect the actual Wide camera seating, corner clearance, washer
support, latch/ribbon access and unplugged hand travel at all pan/tilt extremes.
Record print settings and dimensional results. Recalibrate Wide intrinsics/FOV,
focus and plant framing; do not reuse a Standard optical calibration. Inspect
rain ingress and drip paths after the optical opening changes, and weigh the
complete build. Servo/horn detail, flexible cable fatigue, electrical/thermal
behavior, flight mass and suspended-operation qualification remain unverified.
