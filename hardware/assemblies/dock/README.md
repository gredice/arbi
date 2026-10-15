# Dock OpenSCAD sources

DOCK-IF-01 is a supported-dummy bench kit, **concept-unvalidated**. Roof
quadrants and the assembled reference are revision `0.3.0`; guide quadrants
remain `0.2.0`, lower panels are `0.1.0` and the flat-shoulder
stud is revision `0.1.1`. Locator/fork and bridge interfaces retain revision
`0.1.0`.
Canonical dimensions and geometry are in [dock.scad](../../lib/dock.scad).
The [design package](../../../docs/assemblies/dock/design-package.md),
[assembly guide](../../../docs/assemblies/dock/assembly-guide.md) and
[bench plan](../../../docs/assemblies/dock/bench-test-plan.md) own the interfaces
and remaining acceptance work.

## Current fabrication entrypoints

| Model | One dock quantity | Function |
| --- | ---: | --- |
| [dock-guide-quarter.scad](dock-guide-quarter.scad) | 4 | Ø275 mouth / Ø60 throat split guide, edge-open radial line passage |
| [dock-locator-carrier.scad](dock-locator-carrier.scad) | 1 | Ø26 final bore, head stop and fork guide |
| [dock-latch-fork.scad](dock-latch-fork.scad) | 1 | Ø17 stem slot, 40 mm manual release |
| [dock-pod-bridge.scad](dock-pod-bridge.scad) | 1 | Fixed-spider attachment above hood |
| [dock-pod-bridge-shoe.scad](dock-pod-bridge-shoe.scad) | 4 | Lower arm-width captive clamp shoe |
| [dock-pod-stud.scad](dock-pod-stud.scad) | 1 | Ø14 stem / Ø24 × 11 mm flat-shoulder head, axial M4 through-bolt |
| [dock-arm-root.scad](dock-arm-root.scad) | 1 | Shared round-post interface and lap tongue |
| [dock-arm-extension.scad](dock-arm-extension.scad) | 1 | Arm lap and locator platform |
| [dock-post-rear-pad.scad](dock-post-rear-pad.scad) | 2 | Dedicated dock mounting-row rear seats |
| [dock-roof-quarter.scad](dock-roof-quarter.scad) | 4 | Hollow rounded 300 × 300 mm R40 crown with removable seams and edge-open line passage |
| [dock-roof-spacer.scad](dock-roof-spacer.scad) | 4 | 49 mm roof stand-off |
| [dock-lower-panel.scad](dock-lower-panel.scad) | 3 | Cardinal charcoal bowl panel; dedicated appearance fasteners |
| [dock-lower-rear-panel.scad](dock-lower-rear-panel.scad) | 1 | Rear charcoal panel with open-top arm/fork window |

[dock-assembly.scad](dock-assembly.scad) registers the assembled reference pose;
`dock_assembly(true)` shows the manually opened fork. Charcoal mechanical parts
and a white protective crown implement the [owner-selected dock appearance](../../../docs/assemblies/dock/rounded-shelter.md).
The hollow roof skin is nominally 2.8 mm, skirt Z175 and apex Z220; it preserves
49 mm spacers, M4 × 100 stack bolts and M3 seam hardware. Print roof quadrants
mounting-seat down from the dedicated Z174 boss contacts and review supports
for the perimeter, skin and bosses before slicing.
Print the stud head down and plan supports under the elevated Ø32 flange;
inspect the bearing face, axial bore and washer seat. Its flat underside at
Z149.8 has a nominal 0.2 mm gap to fork top Z149.6 before supported settling.
The [lower enclosure](../../../docs/assemblies/dock/lower-enclosure.md) prints
three ordinary panels and one rear panel, top-tray down using the supplied
rotations. Its tapered 2.8 mm normal wall surrounds the guide with nominal
separation; the enclosure carries no pod-retention load. Eight dedicated
M3 × 25 bolts, sixteen washers and eight DIN 985 nuts attach panels to the
white crown without disturbing the structural M4 stack. Remove all panels
before roof service and the rear panel for complete manual fork/core access.
The default post is the corner set's round-120 (radius 60 mm), on a non-powered
corner. Shared 100–140 mm round parameters adjust root, joint and projection;
the published pack checks only the round-120 nominal configuration.

The kit's bridge/shoes/stud belong to the dock BOM but install on the pod. They
are not duplicated in the compact camera-pod BOM. Their added mass and radial
clamp friction remain unresolved; nominal fit is not structural acceptance.
The guide and roof passages are 18 mm wide and open radially from radius 95 mm
to their edges around the radius 104 mm line axes. Synthetic vertical 1.5 mm
lines are a nominal checked pose, not installed routing evidence. Shelter
service requires an unloaded supported fixture because roof bolts share the
locator/arm stack.

## Artifacts and checks

The [booklet builder](../../../scripts/dock-booklet/README.md) exports installed
and print-coordinate meshes, checks nominal interfaces against actual current
pod geometry, and renders a ten-page illustrated assembly PDF. CI/release
artifacts include the paired source/STL ZIP; generated files are not committed.

[dock-bench-hardware.scad](dock-bench-hardware.scad) revision `0.2.0` is an approximate
visualization of bought size samples, not fabrication or received-part evidence.
The exact provisional quantities are in the BOM and assembly guide. Measure
received heads, washers, nuts, locking zones and stacks before use.

## Archived concepts

`dock-funnel`, `dock-nest`, `dock-latch-hardware` and `dock-weather-hood` r0.1.0
remain historical entrypoints in `archivedModels`, superseded by this kit. They
are not current compact-pod fabrication sources. The archived camera-pod stud is
also excluded. Do not combine historical and current parts or infer physical
acceptance from their registration.
