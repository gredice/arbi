# Camera pod removable retention without ties

Design proposal: [#228](https://github.com/gredice/arbi/issues/228).
The selected compact pod is assembly **r0.5.0**. Its current installation uses
**zero ties**. Historical dry-bench alternatives and dated evidence retain their
original geometry and hardware; do not mix their instructions with this kit.

## Retention interfaces

| Interface | Mechanical solution | Nominal dimensions and use |
| --- | --- | --- |
| Bulk capacitor | Deck cup, two integral posts and removable rim ring | Ø10 × 16 mm can; Ø10.6 cup; can bottom Z23.5; ring underside Z39.8; Ø8.6 central opening. The cup and ring provide positive capture, with 0.3 mm nominal axial/radial allowance. Verify the actual vent and insulation. |
| Incoming power | Split jaw aligned with the existing base outlet | Axis [10,40]; Z20.5–30.5; stopped Ø6.8 bore; nominal Ø6 sleeved lead with a split soft liner, free ID6/OD7 × 10 mm. Two side screws close the jaw. |
| Fixed CSI ribbon | Removable stopped bridge on the deck | Centre [0,-39], base Z24; 16.8 mm channel width, 1.1 mm stopped gap; 26 mm screw pitch. |
| Pan CSI ribbon | Same bridge on the carrier | Centre [0,-19], base Z-35; bridge faces downward; anchors the separate pan/tilt loops without a tie around the FPC. |
| Fixed servo loom | Removable stopped bridge below the Pi | Centre [-40,11], base Z21.5; 4.8 mm width, 2.8 mm gap; 15 mm screw pitch. Assemble before the Pi. |
| Pan servo loom | Same bridge on the carrier | Centre [0,-7], base Z-34.6; bridge faces downward; keeps the servo loom separate from the ribbon and hard stops. |

CSI uses four soft insulating pads, **16 × 12 × 0.5 mm free**; the servo loom
uses four pads, **4 × 10 × 0.5 mm free**. Each clamp has one pad above and one
below its nominal 0.3 mm ribbon or 2 mm loom. The loaded CAD pads are 0.4 mm
thick: 20% nominal thickness compression is a design assumption, not a qualified
material response or grip claim. Measure the actual cable and liner before
printing; select compatible insulating material and test pull-out, creep and
connector unloading. Protect the base outlet edges separately with received-fit
soft lining/grommets. Do not substitute a sharp printed contact against an FPC.

The deck and rim ring expose matched `can_d` / `can_h` OpenSCAD parameters;
the checked defaults are 10 / 16 mm. Changing the can requires matched parts,
updated booklet references and a complete recheck.

The capacitor is still a nominal package, not a selected measured part. Keep
all actual vent features exposed and leads insulated. The CAD check uses only
an Ø8 mm central vent probe; it cannot establish the received vent geometry.

## Replacement prints

From stock-fastener assembly r0.4.0, replace two prints and add six small prints:

| STL | Quantity | Reason |
| --- | ---: | --- |
| `camera-pod-integrated-deck-r0.3.0.stl` | 1 | Cup posts, power jaw and fixed harness seats replace tie pads/slots |
| `camera-pod-integrated-gimbal-carrier-r0.3.0.stl` | 1 | Separate pan ribbon/servo seats replace the soft-wrap anchors |
| `camera-pod-capacitor-retainer-r0.1.0.stl` | 1 | Positive axial can capture with an open centre |
| `camera-pod-power-clamp-r0.1.0.stl` | 1 | Removable half of the split power jaw |
| `camera-pod-ribbon-clamp-r0.1.0.stl` | 2 | Fixed and pan ribbon bridges |
| `camera-pod-loom-clamp-r0.1.0.stl` | 2 | Fixed and pan servo bridges |

Retain all other r0.4.0 kit prints. The complete kit has **18 installed prints
from 15 model types**; its **16 fabrication models** include the optional,
uninstalled servo coupon. Deck posts remain on both faces: check support
placement, nut-seat roofs and removal access in the slicer. Inspect bridges,
layer adhesion and every hard-stop foot before assembly. Start ribbon/loom
bridges with their broad exterior face on the bed, and the power jaw with its
split face on the bed; inspect counterbores and liner contact faces. These are
slicer starting orientations, not qualified print settings.

## Hardware and assembly order

The six retainers add **12 M3 × 12 screws, 16 M3 flat washers and 12 plain M3
nuts**. They add no screw-length variant. Eight flat-clamp nuts bear directly
on printed hex-seat ceilings, without lower washers; all twelve screw heads
have washers, and capacitor/power joints also have lower washers.

The complete compact kit now uses 8 M3 × 25, 19 M3 × 12, 12 ordinary M2 × 8,
4 countersunk M2 × 8 and 4 countersunk M1.6 × 6 screws, plus two OEM horn centre
screws. It has 41 M3 and 20 M2 flat washers, one M3 0.7 mm pivot shim, 27 M3,
16 M2 and 4 M1.6 plain nuts. Existing washer dimensions and head distinctions
remain in the [stock-fastener inventory](fastener-standardization.md).

1. Work unpowered with deck and carrier separate. Load four deck nuts from below and four carrier nuts from above; hold them
   until screws engage. The carrier bridges face downward below their carrier seats, keeping
   their screws and bodies below the fixed pan mount throughout rotation. These are anti-rotation seats, not independently latched nut cages.
2. Preload the capacitor washer/nut pairs from the rear and the power-jaw pairs
   from above. Fit liners and bridge feet against their hard stops. Fit the
   fixed servo clamp before the Pi and the moving clamps before mounting the
   carrier on the fixed servo; the appropriate nut-loading face must remain accessible.
3. Seat the capacitor without loading its leads; fit the rim ring with two
   screws and inspect the real vent. Route power through the lined split jaw,
   close its two side screws, and keep connectors inside the upper enclosure.
4. Keep separate relaxed pan and tilt loops for CSI and servo wiring. Confirm
   movement in both directions with the actual harness before setting limits.
   The clamps anchor local harness sections; they do not define bend radii or
   transfer positioning-line tension.
5. Camera screws use a **50° service tilt** with the upper stack and outer head
   removed. Set that pose using the supported bench controller, then isolate
   power; never force geared servos. Insert/remove the screws and camera along
   the tilted camera normal. Neutral rear-tool access is intentionally blocked
   by the loom clamp; a negative control records this. Return to neutral before
   fitting the outer head or removing the pan-centre screw.
6. For service, release fixed anchors before lifting the upper stack. Remove
   the supported carrier for moving-anchor service, retaining loose underside
   nuts as screws disengage. Recheck liners and loops after reassembly.

## Evidence and acceptance

The [dated source/mesh record](../../evidence/camera-pod-tie-free-2026-10-15.md)
records the tested sources, model revisions, nominal clearances, capture and
wrong-size controls, loading/removal/driver paths, motion and booklet checks.
Physical can/cable fit, compression and grip, electrical isolation, flex fatigue,
print durability, heat/rain behavior and complete flying mass remain unverified.
The clamps are not positioning-line tensile terminations and do not authorize
suspended or public operation.
