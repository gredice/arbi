# Micro pan/tilt servo measurements and fit report — 12 October 2026

The project owner reported a physical servo fit test: **the body opening fits,
but the mounting screws need more separation**. The corrected end-to-end screw
centre pitch is **25 mm**. The initial 15 mm value was explicitly corrected and
is not a design input. This is owner-reported dimensional and limited fit
evidence. The instrument, uncertainty, printer settings, tested file/revision,
servo manufacturer and exact product identity were not supplied.

## Revised fit accepted by the owner

After receiving the revised
`camera-pod-servo-fit-coupon-r0.1.1.stl` with the preserved body opening and
25 mm screw pitch, the owner reported: **"Checked the fit, can be used like
that."** This follow-up on 12 October 2026 accepts the revised servo fit for
continued prototype work. The issued file is identified here for traceability;
the owner did not provide photographs, print settings, measurement equipment,
fastener torque or an assembled motion test. The acceptance is limited to
the reported fit and does not establish full-pod load, electrical or weather
qualification.

| Feature | Owner-reported result |
| --- | --- |
| Total length including both mounting ears | 31.8 mm |
| Case width | 9 mm |
| Overall height, including rotating output shaft | 24.5 mm |
| Mounting holes | One at each end; 25 mm centre to centre |
| Lead length | 145 mm |
| Appearance | Translucent blue case; white, red and black leads |
| Lead exit | Shaft end of the case |
| Body opening | Fits the received servo |
| Earlier screw spacing | Needs more separation |
| Revised opening and 25 mm spacing | Owner checked the fit and accepted continued use |

## Source changes and limits

The [canonical servo reference](../../hardware/lib/micro-pan-tilt-servo.scad)
and [public entrypoint](../../hardware/assemblies/camera-pod/micro-pan-tilt-servo.scad)
r0.2.0 use the measured rigid envelope and hole pitch. The public model's origin
is the case bottom, X follows the length, and the shaft/lead exit is at +X.
The 145 mm leads follow an illustrative relaxed loop; their sampled centreline
length is 145 mm, but insulation diameter, exit coordinates, connector and
installed routing remain unknown. Wire colours do not establish electrical pinout.

Case length is still nominal 20 mm. The nominal case/shaft split is 20.5 mm
case height plus a 4 mm output crown/shaft stack. The reference retains the
historical lug and output seating datums and adds the extra 2.5 mm behind them.
That allocation, lug height/thickness, shaft offset/diameter, spline, horn and
hole diameter remain assumptions requiring measurement. Display internals and
optical properties suggest the reported appearance; they are not inspected
motor/gear construction or measured material properties.

The [mount family](../../hardware/lib/camera-pod-mounts.scad) preserves the
**20.8 × 9.3 mm body window**. Both pan and tilt fasteners, the compact carrier
and the coupon use the corrected 25 mm pitch. The compact head r0.1.4 increases its tapered X radius from 47 to 49.5 mm
for the larger rear envelope, retaining the Ø100 mm neck and 1.2 mm nominal
wall; the dry yoke removes a small rear reinforcing-web interference.
The pan mount widens its upper
insertion opening and moves its side supports outward to clear the 31.8 mm ears.
The updated coupon is 35.8 × 15 × 2.5 mm with two Ø1.9 mm bores; nominal servo
ear holes remain Ø1.7 mm for the existing M1.6 screws.

The revised fit has owner acceptance. When assembling the complete pod, check
both servos, full ear seating, washer/nut access, lug height, shaft and supplied
horn. Repeat assembled travel and wire-slack inspection. The owner's fit
acceptance does not validate the complete assembly, torque, settling,
electrical behaviour or weathering.
Models remain **concept-unvalidated**.

The proposed interface correction is tracked in [GitHub issue #212](https://github.com/gredice/arbi/issues/212).

## Shaded visualization

The preview pack exports separate source-declared material components with
source hashes and mesh checksums. The public viewer uses a translucent blue
physical material, pale output shaft, separate white/red/black leads and
illustrative internal detail. The displayed measured dimensions describe the
rigid servo, excluding the flexible lead pose. Ordinary STL downloads cannot
carry these material properties. Shaded GLTF scenes preserve authored colours,
textures and material groups; line drawings retain the manual's white-face style.

## Local CAD verification

The [13 October CAD revalidation record](micro-servo-cad-2026-10-13.json) identifies
model revisions, source/mesh hashes, both assembly checks and the coupon probes
after integrating the drawing-derived Pi reference from PR #216. Both manuals
were rebuilt and all 30 final pages reviewed. The
[original 12 October record](micro-servo-cad-2026-10-12.json) remains historical;
the owner's fit acceptance still applies to the unchanged revised servo interface.

| Check | Result |
| --- | --- |
| Rigid reference | 31.8 × 9 × 24.5 mm, including shaft |
| Body window | Original 20.8 × 9.3 mm retained; nominal 20 × 9 mm case passes |
| Corrected coupon bores | M1.6 probes clear at 25 mm pitch |
| Deliberately old 24 mm pitch | Both probes detect 1.229 mm³ interference |
| Flexible display leads | Three sampled centrelines, each 145 mm |
| Enclosure / bench travel | 555 poses each; no unintended rigid collisions |
| Enclosure service / drivers | 30 staged paths / 22 driver probes; no blocked checks |
| Bench service / drivers | 8 staged paths / 10 driver probes; no blocked checks |
| Enclosure print mass | 254.516 g at fully solid PETG density 1.27 g/cm³; excludes electronics/metal hardware |

Reproduce with pinned OpenSCAD on PATH and the booklet Python dependencies:

```sh
python3 scripts/camera-pod-booklet/check-servo-fit.py
python3 scripts/camera-pod-booklet/build.py --enclosure --checks-only --output hardware/generated/servo-enclosure
python3 scripts/camera-pod-booklet/build.py --checks-only --output hardware/generated/servo-bench
```

These checks validate the nominal source geometry. The owner separately
accepted the revised fit; assembled motion, fastening loads and field
performance remain unverified.
