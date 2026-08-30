# Winch OpenSCAD sources

System context: [Winch assembly documentation](../../../docs/assemblies/winch/README.md).

## `winch-drum`

[winch-drum.scad](winch-drum.scad) is a **non-manufacturing CSG geometry study** for a parametric direct-drive, single-layer grooved drum. It starts at the repository's nominal 100 mm baseline diameter and calculates the required turns and working width from line length, effective diameter, groove pitch, line diameter, and edge margin. Its default 32 m capacity is an unverified sizing allowance for the current site geometry, not an approved travel value. The geometry includes:

- a calculated sequence of shallow square-profile circumferential grooves;
- two retaining flanges;
- a central hub and shaft bore;
- two shallow radial witness holes marking unresolved termination zones.

The calculated width is intentionally allowed to expose an impractical result rather than silently omit full travel; it may exceed common printer beds. The model has no BOM part mapping and does not define a keyed, clamped, splined, or otherwise defensible shaft torque interface. Groove profile, actual calibrated line travel, fleet angle, shaft fit, torque transfer, line bend radius, anchor termination, flange loading, balance, segmentation, manufacturing method, creep, fatigue, overspeed, and containment remain unvalidated.

Registry ID and design revision: `winch-drum` `0.1.0`, role `reference`, status `concept-unvalidated`.

Before prototype use, update the model from measured motor/shaft and line interfaces, verify the complete winch stack, then record dimensional inspection and load/cycle evidence.
