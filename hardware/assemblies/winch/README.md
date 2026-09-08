# Winch OpenSCAD sources

System context: [Winch assembly documentation](../../../docs/assemblies/winch/README.md).
Development scope and unresolved interfaces: [drum development proposal](drum-development.md).

## `winch-drum`

[winch-drum.scad](winch-drum.scad) is a **non-manufacturing CSG geometry study**
for a direct-drive, single-layer drum. Revision `1.0.0` replaces the disconnected
square-profile rings with a continuous rounded helical groove, removes the
nonfunctional anchor witness holes, and separates deployable travel from retained
reserve turns. The major revision identifies the changed groove and axial envelope;
it does not indicate manufacturing readiness.

Registry ID: `winch-drum`, revision `1.0.0`, role `reference`, status
`concept-unvalidated`. The study has no BOM fabrication mapping and exports CSG.

## Default sizing

| Parameter or calculated quantity | Value |
| --- | ---: |
| Core diameter | 100 mm |
| Passive line diameter | 1.5 mm |
| Groove pitch | 2.2 mm |
| Groove cutter radius / depth | 0.95 / 0.45 mm |
| Assumed seated line centre diameter | 100.6 mm |
| Requested deployable line allowance | 32,000 mm |
| Working / reserve revolutions | 102 / 3 |
| Calculated deployable capacity | 32,237.29 mm |
| Reserved line, excluded from deployable capacity | 948.16 mm |
| Core winding width, including margins | 246.9 mm |
| Flange diameter | 128 mm |
| Overall axial length, including flanges and hubs | 270.9 mm |
| Illustrative shaft bore | 8.2 mm |

These values are calculations from source defaults, not measured performance.
The line centre diameter assumes bottom seating:
`D_effective = D_core - 2 × groove_depth + line_diameter`.
Length per revolution is `sqrt((pi × D_effective)^2 + groove_pitch^2)`.
Working turns round up the requested length divided by that value; reserve turns
are added afterwards. The rounded groove cutter is approximated by 12 profile
facets and 96 helix segments per turn; these are discretization settings, not
manufacturing tolerances. Real line compression and seating require calibration.

The 32 m allowance is inherited and unverified. Three reserve turns are a sizing
experiment, not proof of termination retention. The reference deliberately shows
its complete width: **the listed approximately 200 mm shaft is shorter than this
270.9 mm drum, before bearing and coupling allowances**. A smaller printer also
needs a revised construction. Do not reduce capacity merely to fit a printer.

## Geometry and coordinates

The drum is centred at the origin with the shaft along Z. The cutter runs from
`z = -helix_height / 2` to `+helix_height / 2`, starting on +X and advancing
counterclockwise as viewed from +Z. Groove-end clearance includes the full cutter
radius plus the declared edge margin. The model is an assembly-oriented reference,
not an assigned print orientation. It retains a solid core and plain central bore.

The top-level parameters expose line sizing, groove geometry, reserve turns,
flanges, hubs and bore. Assertions reject overlapping groove sweeps, invalid
clearances, missing reserve turns and incompatible body dimensions. The echo
output reports both capacity and the complete envelope.

## Outstanding work and evidence

There is no shaft torque-transfer feature, usable line anchor, hollow/segmented
construction, or powered-line electrical interface. Final travel, groove fit,
fleet angle, shaft stack and deflection, torque transfer, line bend radius,
termination, flange loading, balance, material, print process, creep, fatigue,
overspeed and containment remain unvalidated.

Before a fabrication revision, measure the actual shaft/hub, line and printer,
resolve the interfaces in the development proposal, and inspect the evaluated
geometry. Then establish dimensional, load and cycle evidence on the complete
winch stack.

Run `pnpm cad:check -- --require-openscad` from the repository root for the pinned
OpenSCAD 2021.01 compile check. CSG evaluation alone does not establish that a
manufacturing mesh is manifold or that a printed drum is suitable for service.
