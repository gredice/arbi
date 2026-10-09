# Dock OpenSCAD sources

DOCK-IF-01 r0.1.0 is a supported-dummy bench kit, **concept-unvalidated**.
Canonical dimensions and geometry are in [dock.scad](../../lib/dock.scad).
The [design package](../../../docs/assemblies/dock/design-package.md),
[assembly guide](../../../docs/assemblies/dock/assembly-guide.md) and
[bench plan](../../../docs/assemblies/dock/bench-test-plan.md) own the interfaces
and remaining acceptance work.

## Current fabrication entrypoints

| Model | One dock quantity | Function |
| --- | ---: | --- |
| [dock-guide-quarter.scad](dock-guide-quarter.scad) | 4 | Ø275 mouth / Ø60 throat split guide, nominal vertical line corridor |
| [dock-locator-carrier.scad](dock-locator-carrier.scad) | 1 | Ø26 final bore, head stop and fork guide |
| [dock-latch-fork.scad](dock-latch-fork.scad) | 1 | Ø17 stem slot, 40 mm manual release |
| [dock-pod-bridge.scad](dock-pod-bridge.scad) | 1 | Fixed-spider attachment above hood |
| [dock-pod-bridge-shoe.scad](dock-pod-bridge-shoe.scad) | 4 | Lower arm-width captive clamp shoe |
| [dock-pod-stud.scad](dock-pod-stud.scad) | 1 | Ø14 stem / Ø24 head, axial M4 through-bolt |
| [dock-arm-root.scad](dock-arm-root.scad) | 1 | Shared round-post interface and lap tongue |
| [dock-arm-extension.scad](dock-arm-extension.scad) | 1 | Arm lap and locator platform |
| [dock-post-rear-pad.scad](dock-post-rear-pad.scad) | 2 | Dedicated dock mounting-row rear seats |
| [dock-roof-quarter.scad](dock-roof-quarter.scad) | 4 | Quarter of sloping 300 mm roof with seam flanges |
| [dock-roof-spacer.scad](dock-roof-spacer.scad) | 4 | 49 mm roof stand-off |

[dock-assembly.scad](dock-assembly.scad) registers the assembled reference pose;
`dock_assembly(true)` shows the manually opened fork. Charcoal mechanical parts
and a white protective roof follow the existing industrial design conventions.
The default post is the corner set's round-120 (radius 60 mm), on a non-powered
corner. Shared 100–140 mm round parameters adjust root, joint and projection;
the published pack checks only the round-120 nominal configuration.

The kit's bridge/shoes/stud belong to the dock BOM but install on the pod. They
are not duplicated in the compact camera-pod BOM. Their added mass and radial
clamp friction remain unresolved; nominal fit is not structural acceptance.
The guide and roof corridors check only synthetic vertical 1.5 mm lines.

## Artifacts and checks

The [booklet builder](../../../scripts/dock-booklet/README.md) exports installed
and print-coordinate meshes, checks nominal interfaces against actual current
pod geometry, and renders a nine-page illustrated assembly PDF. CI/release
artifacts include the paired source/STL ZIP; generated files are not committed.

[dock-bench-hardware.scad](dock-bench-hardware.scad) is an approximate
visualization of bought size samples, not fabrication or received-part evidence.
The exact provisional quantities are in the BOM and assembly guide. Measure
received heads, washers, nuts, locking zones and stacks before use.

## Archived concepts

`dock-funnel`, `dock-nest`, `dock-latch-hardware` and `dock-weather-hood` r0.1.0
remain historical entrypoints in `archivedModels`, superseded by this kit. They
are not current compact-pod fabrication sources. The archived camera-pod stud is
also excluded. Do not combine historical and current parts or infer physical
acceptance from their registration.
