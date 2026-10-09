# Segmented winch drum sources

System requirements: [winch](../../../docs/assemblies/winch/README.md).
Design rationale and owner inputs: [development proposal](drum-development.md).
Wire evidence: [AWG26 table](../../../bom/sourcing/pod-wire-dimensions-2026-09-08.md).

## Winch-owned line and power visualizations

The line and slip-ring models retain stable IDs, revisions and output names. They belong to the winch set within the corner support set, following [ADR-0010](../../../docs/decisions/0010-corner-support-and-winch-line-ownership.md). The [ownership source check](line-ownership-check.md) records unchanged geometry and fabrication provenance. These approximate `visualization` models are **Unverified** and are not manufacturing sources or installed routing.

| BOM item / source | Shape | Dimension basis and remaining uncertainty |
| --- | --- | --- |
| [capsule-slip-ring-6x2a](capsule-slip-ring-6x2a.scad) · [BOM](../../../bom/generated/parts/capsule-slip-ring-6x2a.md) | slip ring | Powered winch only. Assumed Ø22 × 28 mm capsule with illustrative leads; exact SKU and mounting are unknown. |
| [dyneema-positioning-line](dyneema-positioning-line.scad) · [BOM](../../../bom/generated/parts/dyneema-positioning-line.md) | coil | All four winches. Catalog 1.5 mm nominal line shown as a short loop, not the purchase length or installed routing. |
| [pod-power-wire-black-awg26](pod-power-wire-black-awg26.scad) · [BOM](../../../bom/generated/parts/pod-power-wire-black-awg26.md) | coil | Powered winch return conductor. Assumed 1.5 mm insulated OD; conductor/insulation and hybrid-line fit remain unverified. |
| [pod-power-wire-red-awg26](pod-power-wire-red-awg26.scad) · [BOM](../../../bom/generated/parts/pod-power-wire-red-awg26.md) | coil | Powered winch +48 V conductor. Assumed 1.5 mm insulated OD; loop is a sample, not installed helical routing. |

## Passive-base bench aids

- [Modular full assembly cover r0.3.0](full-cover.md): three main white panels
  and two payout shutters on a passive winch / five panels and four shutters on
  the powered variant. Reuse the drivetrain; drill extra base holes for clips
  and the fixed-loom anchor. See the [geometry record](full-cover-check.md).

- [STL-based assembly booklet and model pack](../../../docs/assemblies/winch/booklet/README.md),
  including the revised motor-fastener-clearance coupling cover **0.1.1**.
- [Printable drilling template](passive-base-drilling-A4.pdf) and
  [printing/alignment instructions](drilling-template.md) for the 550 x 180 mm base.
- [Optional desk feet](desk-feet.md): print two
  [short feet](winch-desk-foot-short.scad) and two
  [long feet](winch-desk-foot-long.scad) to lift that base by 35 mm for unloaded
  desk checks. See the [geometry check record](desk-feet-geometry-check.md).

## Drum family

The drum family now contains individual **concept-unvalidated fabrication models**
for an X1C PLA bench prototype. [winch-drum.scad](winch-drum.scad), revision `2.1.1`,
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

## Appearance previews

Follow the [industrial design conventions](../../../docs/project/industrial-design.md): charcoal mechanical core and white protective surfaces. Drum reference r2.1.1 and mount reference r0.1.2 change presentation only; all fabrication dimensions remain compatible. The [full-cover kit](full-cover.md) adds removable shells over those parts; the [booklet](../../../docs/assemblies/winch/booklet/README.md) uses the same palette.

## Round timber interface and bottom cables

The [round-pole kit](round-pole.md) adds matching machined-metal saddles, removable white rear nut covers and a non-structural cable guide. Default diameter is 120 mm; nominal 100–140 mm parameter studies do not replace measured fit or structural review. [Development proposal](round-pole-development.md), [assembly reference](winch-pole-assembly.scad), and [nominal record](round-pole-check.md). The [full-cover r0.3.0](full-cover.md) moves stationary looms to the lower pole side while preserving upward positioning-line payout.

## Approximate BOM visualizations

These `visualization` models show catalog items in the Parts inventory. They are **Unverified** and are not manufacturing sources. Shape is not yet fully defined and needs rework against the selected supplier drawing or measured item before fit or clearance decisions. Nominal dimensions recorded in the catalog remain requirements, not measurement evidence. Threads, connectors, internal construction and fine detail are simplified. Kits and assortments show representative samples, not quantities; cable loops and lengths show samples, not installed routing.

| BOM item / source | Shape | Dimension basis and remaining uncertainty |
| --- | --- | --- |
| [as5600-angle-sensor](as5600-angle-sensor.scad) · [BOM](../../../bom/generated/parts/as5600-angle-sensor.md) | board | Assumed 23 × 23 mm breakout with a representative magnet; no selected board outline is recorded. |
| [bearing-608-2rs](bearing-608-2rs.scad) · [BOM](../../../bom/generated/parts/bearing-608-2rs.md) | ring | Catalog nominal 22 mm OD, 8 mm bore and 7 mm width; seals and races simplified. |
| [cl57y-v20-driver](cl57y-v20-driver.scad) · [BOM](../../../bom/generated/parts/cl57y-v20-driver.md) | driver | Assumed 118 × 76 × 34 mm driver body with terminal envelopes; confirm the included kit model. |
| [extension-spring-assortment](extension-spring-assortment.scad) · [BOM](../../../bom/generated/parts/extension-spring-assortment.md) | springs | Representative coil spring sizes; wire gauge, end hooks and pack contents are unknown. |
| [flexible-jaw-coupling-8mm](flexible-jaw-coupling-8mm.scad) · [BOM](../../../bom/generated/parts/flexible-jaw-coupling-8mm.md) | coupling | Catalog approximate Ø20 × 25 mm body and 8 mm bores; jaws and elastomer simplified. |
| [matched-motor-cable](matched-motor-cable.scad) · [BOM](../../../bom/generated/parts/matched-motor-cable.md) | cable | Assumed Ø8 mm cable sample with connector envelopes; selected motor/encoder connectors unknown. |
| [nema23-closed-loop-motor](nema23-closed-loop-motor.scad) · [BOM](../../../bom/generated/parts/nema23-closed-loop-motor.md) | motor | Existing winch booklet nominal 57 mm face, 122 mm body and 8 mm shaft; confirm supplied kit motor. |
| [post-electronics-enclosure](post-electronics-enclosure.scad) · [BOM](../../../bom/generated/parts/post-electronics-enclosure.md) | enclosure | Catalog approximate 150 × 100 × 70 mm box; flange, gasket and driver clearance unknown. |
| [roller-lever-microswitch](roller-lever-microswitch.scad) · [BOM](../../../bom/generated/parts/roller-lever-microswitch.md) | microswitch | Assumed KW12-class 20 × 10 × 6 mm body with lever and roller; mounting and travel unspecified. |
| [shaft-collar-8mm](shaft-collar-8mm.scad) · [BOM](../../../bom/generated/parts/shaft-collar-8mm.md) | collar | Existing winch booklet nominal Ø20 × 10 mm body, 8 mm bore; clamp slot and screw simplified. |
| [winch-drum-shaft-8mm](winch-drum-shaft-8mm.scad) · [BOM](../../../bom/generated/parts/winch-drum-shaft-8mm.md) | rod | Catalog 8 mm shaft; representative 340 mm passive cut from the existing winch booklet, not all purchased stock. |
| [winch-fail-safe-brake](winch-fail-safe-brake.scad) · [BOM](../../../bom/generated/parts/winch-fail-safe-brake.md) | brake | Assumed Ø60 × 40 mm brake envelope with 8 mm bore; mechanism and safety function not yet defined. |
| [winch-drum-joining-hardware](winch-drum-joining-hardware.scad) · [BOM](../../../bom/generated/parts/winch-drum-joining-hardware.md) | drum hardware | Representative M5 rod, M4 screws, nuts and washers from the catalog allowance; not a complete kit or count. |
| [winch-mount-hardware](winch-mount-hardware.scad) · [BOM](../../../bom/generated/parts/winch-mount-hardware.md) | mount hardware | One representative 550 × 180 × 8 mm base, spacer and fasteners from catalog assumptions; powered base/counts omitted. |
| [winch-full-cover-hardware](winch-full-cover-hardware.scad) · [BOM](../../../bom/generated/parts/winch-full-cover-hardware.md) | fasteners | Representative cover-kit fasteners; final sizes and pack contents need confirmation against assembly requirements. |
| [winch-round-pole-hardware](winch-round-pole-hardware.scad) · [BOM](../../../bom/generated/parts/winch-round-pole-hardware.md) | pole hardware | Representative M8 clamp rods/nuts and backing hardware; pole dimensions and final cut lengths need confirmation. |
