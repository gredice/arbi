# Segmented winch drum sources

System requirements: [winch](../../../docs/assemblies/winch/README.md).
Design rationale and owner inputs: [development proposal](drum-development.md).
Wire evidence: [AWG26 table](../../../bom/sourcing/pod-wire-dimensions-2026-09-08.md).

The drum family now contains individual **concept-unvalidated fabrication models**
for an X1C PLA bench prototype. [winch-drum.scad](winch-drum.scad), revision `2.1.0`,
is the assembly reference; all new component entrypoints are revision `0.1.0`.
No component has been physically printed or inspected in this work. Later ASA
parts require separate print settings, fit inspection and load/cycle evidence.

## Print list

One BOM `winch-drum` unit means one assembled kit. For the four-winch system use
three passive kits and one powered kit; do not print every variant for every kit.

| Source | Per passive drum | Per powered drum | Total for system |
| --- | ---: | ---: | ---: |
| [Passive section 1](winch-drum-passive-1.scad) | 1 | 0 | 3 |
| [Passive section 2](winch-drum-passive-2.scad) | 1 | 0 | 3 |
| [Powered section 1](winch-drum-powered-1.scad) | 0 | 1 | 1 |
| [Powered section 2](winch-drum-powered-2.scad) | 0 | 1 | 1 |
| [Powered section 3](winch-drum-powered-3.scad) | 0 | 1 | 1 |
| [Left flange](winch-drum-flange.scad) | 1 | 1 | 4 |
| [Right flange](winch-drum-flange-right.scad) | 1 | 1 | 4 |
| [Shaft clamp half](winch-drum-clamp-half.scad) | 2 | 2 | 8 |
| [Dyneema tail clamp](winch-drum-tail-clamp.scad) | 1 | 1 | 4 |
| [Alignment pin](winch-drum-alignment-pin.scad) | 3 | 4 | 13 |

## Nominal geometry

| Quantity | Passive | Powered |
| --- | ---: | ---: |
| Core / flange diameter | 100 / 128 mm | 100 / 128 mm |
| Line-envelope diameter | 1.5 mm | 4.5 mm |
| Groove pitch | 2.2 mm | 5.3 mm |
| Groove radius / depth | 0.95 / 0.45 mm | 2.55 / 1.35 mm |
| Working + retained reserve turns | 102 + 3 | 101 + 3 |
| Calculated deployable capacity | 32,237.3 mm | 32,305.7 mm |
| Winding-body width | 246.9 mm | 570.3 mm |
| Section count / height | 2 / 123.45 mm | 3 / 190.1 mm |
| Body plus two flanges | 258.9 mm | 582.3 mm |
| Shaft cut allowance | 340 mm | 660 mm |
| M5 tie-rod cut allowance | 280 mm | 610 mm |

The 32 m deployable allowance and three reserve turns remain design assumptions.
Capacity excludes the reserve turns. Length per revolution is calculated from
`sqrt((pi × (core_diameter - 2 × groove_depth + line_diameter))² + pitch²)`.
For the powered variant this treats the 4.5 mm envelope as a circular seating
approximation; real hybrid compression, contact radius and payout need calibration.

The larger powered drum is intentional: increasing pitch without increasing width
would silently lose travel. **A 660 mm nominal 8 mm hot-rolled shaft is not qualified
for service by this geometry.** The full shaft span needs deflection, fatigue and
load review. See the [geometry check record](drum-geometry-check.md).

## Interfaces and assembly

Shared parameters live in [the drum library](../../lib/winch-drum.scad). Shaft
nominal diameter and printed-bore diametral clearance are separate (8 + 0.2 mm).
The split clamp has a 0.8 mm initial gap; use M4 through-screws, washers and metal
nuts. Clamp the shaft first, then secure the clamp feet to the flange. This permits
small lateral take-up within the mounting-hole clearance. No screw threads rely
on plastic. Clamp torque and creep resistance must be established on the bench.

Bodies have a 5 mm outer shell, a central shaft tube and three full-length ribs
with M5 tie-rod passages. The asymmetric bolt angles (0°, 115°, 240°) prevent
120° misassembly. A 5 mm pin in 5.2 mm sockets aligns each flange/body or body/body
joint. Sockets are 4.3 mm deep for an 8 mm pin across the joint, so the pin does not
hold the mating faces apart. All joints must close flush; remove print burrs.

Section 1 is the lower-Z section. One, two or three shallow dots on its top hub
identify the section number. Stack the bodies in order without turning one over;
the helix is cut in one common coordinate frame. The flanges are handed parts,
not two copies of the same STL. Rotate the right flange 180° about X from its
print orientation when assembling it. The flanges' socket faces point
inward toward the body. Three M5 threaded rods compress the complete stack.

At the clamp-side flange, route the bare Dyneema tail across the end margin and
through the open rim notch, then beneath the tail clamp's two shallow channels.
Leave a return loop outside the clamp; two M4 screws clamp the outgoing and return
tail legs. Smooth the notch, channels and flange chamfers before feeding line.
This is a candidate friction termination, not a demonstrated termination strength.
Keep at least the configured reserve turns at maximum payout and test tail slip
and abrasion under reversals before loading the pod.

For the powered variant, separate the conductors from the tensile tail before
clamping; pass them through the two 5 mm flange lead-throughs and provide slack.
The tail clamp must not pinch insulated conductors. The holes are routing features,
not completed conductor strain relief. The external rotating harness, slip-ring
mount, conductor strain-relief hardware, guarding, bearings' housings and motor
mount are outside these drum parts and remain unfinished in their owning assemblies.

## Hardware and shaft layout

Per drum: three M5 tie rods, six M5 locking nuts and six M5 washers; four M4×25
clamp-foot screws plus two M4×25 tail-clamp screws; two M4×45 cross-clamp screws;
eight M4 locking nuts and sixteen M4 washers. Screw lengths are nominal allowances;
confirm washer/nut engagement and clearance during dry assembly. Install foot
screws before closing the drum if access behind the flange is required.

The new BOM `winch-drum-joining-hardware` procurement allowance covers all four
drums. Its exact supplier packages and cost are unresolved; the mixed fastener
assortment is not assumed to contain these lengths. Five 1 m M5 threaded rods can
be cut into nine 280 mm and three 610 mm pieces: three stock rods each yield
610 + 280 mm; two each yield 3 × 280 mm, with room for saw kerfs.

One 2 m BAUHAUS Ø8 rod allocates 3 × 340 + 660 = 1680 mm before kerfs, leaving
320 mm. This supersedes the earlier four 400 mm blanks. Check the completed layout
before cutting; the material selection remains a prototype selection.

The [mount proposal](mount.md) adds split bearing supports, an adjustable motor
stand and a coupling cover. Reference revision 2.1.0 adds metal inner-ring spacers
and moves collars/coupling; the printable drum parts remain revision 0.1.0.

Reference frame: left flange is Z=0…6; winding body is Z=6…6+W; right flange ends
at Z=W+12; shaft clamp ends at W+32. The two 7 mm bearings occupy Z=-9…-2 and
W+34…W+41. Two 2 mm metal spacers occupy -11…-9 and W+41…W+43 to contact only the
bearing inner rings. Assumed 10 mm collars occupy -21…-11 and W+43…W+53. The
approximately 25 mm coupling starts at W+56 with 10 mm drum-shaft engagement.
The contextual shaft runs from -22 to W+66; the rounded cut allowances above leave trimming allowance.
Collar envelope and coupling engagement are layout assumptions, not supplier
measurements. Their positions can be adjusted before final shaft finishing.

## Printing and verification

Each component is exported flat on Z=0. Print body sections upright with the
shaft along Z; the open ribbed cavities avoid internal roof supports. Print clamp
halves and flanges on their flat feet/faces. All default parts are under 128 mm in
XY and 191 mm in height, leaving X1C bed-edge and height allowance. Locate them
clear of the slicer's filament-cutter exclusion zone.

PLA starting process for inspection specimens: 0.4 mm nozzle, 0.2 mm layers,
six walls and six top/bottom layers; 40% infill in remaining solid regions.
Use solid infill for the small pins/clamps. These are trial settings, not a
strength rating. Check bridging in the clamp cross-holes and tail channels in the
slicer; chase only clearance holes if needed. Use a brim where bed adhesion needs
it. Inspect dimensions after cooling. Do not assume ASA prints to identical size.

Before full drums, export both passive sections with `-D required_line_length=500`
for a short, two-part groove/joint specimen, plus the actual clamp halves and one
flange. These shortened exports are fit specimens, not full-travel drum artifacts.

```bash
pnpm cad:check -- --require-openscad
openscad -o /tmp/winch-drum-passive-1.stl hardware/assemblies/winch/winch-drum-passive-1.scad
openscad -D powered=true -o /tmp/winch-drum-powered.csg hardware/assemblies/winch/winch-drum.scad
```

Use OpenSCAD 2021.01. Generated geometry belongs in temporary/ignored output,
not Git. Compile and mesh checks do not establish structural capacity, termination
retention, electrical reliability, weather life or safe operation.
