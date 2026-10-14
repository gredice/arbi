# 23HS40 motor supplier drawing and CAD reference r1.0.0

Date: **2026-10-12**. Model: `nema23-closed-loop-motor` **r1.0.0**.
Status remains **concept-unvalidated**; this is a supplier-drawing reference,
not a manufacturing source or physical acceptance record.
The [machine-readable CAD record](nema23-closed-loop-motor-cad-check.json) pins
the entrypoint, shared motor module, mesh checker and booklet reference source.
The registry uses the repository's `drawing-derived` evidence status.

The 14 October 2026 appearance update adds silver caps/shaft and a dark motor
body. The independent motor section and stand-interference checks were rerun;
canonical triangle coordinates match the `cad-v0.1.32` r1.0.0 mesh exactly after
sorting. The machine-readable record pins the updated source and mesh hashes.
Dimensions, revision and physical-fit status are unchanged.

## Source and transcription

The StepperOnline
[23HS40-5004D-E1000 dimensional SVG](https://www.omc-stepperonline.com/image/catalog/dimensions/23HS40-5004D-E1000_Dimension-1.svg)
was opened and visually inspected in Microsoft Edge on the recorded date.
Its title identifies `23HS40-5004D-E1000`; the exact received motor identity
still needs inspection against the selected `4-CLYS30-V20` kit.

| Feature | Drawing value in mm | Reference geometry |
| --- | --- | --- |
| Square frame | 57.3 MAX | 57.3 across the outer faces |
| Mounting face to rear housing | 122 ±1 | 122; includes the encoder housing |
| Rear encoder housing length | 22 ±1 | Last 22 of the 122 body length |
| Shaft projection from mounting face | 22 ±0.5 | Z=-22 to 0 |
| Shaft diameter | Ø8, +0 / -0.012 | Ø8 nominal |
| Shaft flat length from tip | 15 ±0.2 | Z=-22 to -7 |
| P-P remaining flat section | 7.5 ±0.1 | Flat plane Y=+3.5, opposite tangent Y=-4 |
| Pilot diameter | Ø38.1, +0 / -0.05 | Ø38.1 nominal |
| Pilot projection | 1.6 ±0.2 | Z=-1.6 to 0 |
| Four mounting-hole pitch | 47.14 ±0.2 square | Centers X/Y=±23.57 |
| Mounting holes | 4-Ø5.1 THROUGH | Through the simplified front flange |
| Rear outlet reference dimensions | (32) axial, (13) beyond frame | Z=90 to 122; Y=-41.65 to -28.65 |
| Motor and encoder leads | Each 300 ±10 | Flexible leads and connectors omitted |

Nominal values are used except for the frame's stated maximum. This is not a
worst-case tolerance envelope. The parenthesized outlet dimensions are reference
dimensions; do not turn them into manufacturing tolerances.

## Datums, scope and compatibility

The [canonical shared model](../../lib/nema23-motor.scad) places the mounting face
at Z=0, the shaft towards -Z and the outlet towards -Y. The
[registered entrypoint](nema23-closed-loop-motor.scad),
[assembly library](../../lib/winch-mount.scad) and booklet purchased-part reference
all call this module. Assembly placement rotates +90° about Y and lifts the
shaft to Z=80 mm; the existing mounting-face X position stays unchanged.

The old generic 57 mm block, Ø4.5 mm blind recesses and booklet's independent
motor geometry are superseded. Revision 1.0.0 identifies the changed reference
envelope and mounting-hole representation. Custom stand/cover fabrication
revisions and their hole interfaces do not change.

The drawing does not dimension the front/rear cap thicknesses, stator corner
relief, small screw heads, cable-outlet width or connector dimensions. These are
illustrative: front/rear caps 8 mm, corner radius 1.5 mm, stator corner chamfer
14 mm and outlet width 30 mm. Small screw heads are omitted. The model cannot
determine a motor bolt length, cable bend radius or service sweep. The two
300 mm leads and connector types shown in the drawing require a separate
installed routing model. The outlet replaces neither the purchased extension
cables nor the existing illustrative stationary loom references.
Those rigid loom references reach the body in the installed pose and follow the
port-bearing fascia in service views. They are disconnected in those views;
their inner ends may leave the motor body. All five sampled animation poses
retain fascia/port clearance checks, but they do not model flexible tail
deformation or establish a physical cable service sweep.

## Reproducible nominal checks

Use pinned OpenSCAD **2021.01** and the winch booklet's Python mesh dependencies:

```sh
openscad -o /tmp/nema23-motor.stl hardware/assemblies/winch/nema23-closed-loop-motor.scad
openscad -o /tmp/nema23-stand.stl hardware/assemblies/winch/winch-motor-stand.scad
python3 scripts/check-nema23-motor-mesh.py /tmp/nema23-motor.stl --stand /tmp/nema23-stand.stl
pnpm cad:check -- --require-openscad
python3 scripts/winch-booklet/build.py --output /tmp/arbi-motor-booklet
python3 scripts/check-booklet.py /tmp/arbi-motor-booklet --variant winch
pnpm bom:check
pnpm docs:check
```

The independent mesh checker tests a single watertight positive-volume solid,
bounds **57.3 × 70.3 × 144 mm** including the outlet and shaft, four circular
Ø5.1 mm holes at four flange depths, including the rear flange edge, pitch, pilot diameter, shaft diameter,
and the transition from the 7.5 mm D-section to the round shaft at Z=-7 mm.
With the stand supplied, it checks nominal intersection at -2, 0 and +2 mm
vertical adjustment. The booklet build also checks its exported motor reference.

These source/mesh checks do not establish actual flange thickness, physical
fit, bolt/nut access, tolerance extremes, installed routing, motor heat,
weather resistance, load capacity or safe actuation. Earlier 57 mm box-based
cover/mount records remain historical evidence for their recorded configuration.
Inspect the supplied motor and repeat relevant physical acceptance before use.

The final branch preserves the merged servo-fit baseline's fabrication evidence.
The [print compatibility record](motor-print-compatibility.json) identifies that
baseline commit, verifies all 73 costed model identities and pins the current
transitive fabrication sources. Only `winch-mount.scad` and the newly imported
motor module change within that dependency set. All **27 affected fabrication
entrypoints** were exported as CSG with pinned OpenSCAD 2021.01 from both the
merged baseline and this branch; every pair was byte-identical. The baseline's
mesh checksums, solid volumes, recipes and accepted servo updates were retained,
then compatible source/registry hashes and generated reports were refreshed.
This is nominal source-equivalence evidence, not physical print acceptance.
