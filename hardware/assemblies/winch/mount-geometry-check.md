# Winch mount geometry check — 2026-09-09

Configuration: mount family 0.1.0, drum reference 2.1.0, printed drum parts 0.1.0.
Status: **concept-unvalidated**. This record concerns source/mesh inspection only;
no part has been printed, assembled, loaded or thermally tested in this work.

## Inspection scope

The same bearing and motor prints are positioned using the passive and powered
body widths. The shaft remains 80 mm from the base front. The base, motor,
bearings, collars, spacers and shaft are reference geometry, not printed outputs.
See [dimensions and assembly](mount.md) for source evidence and fit assumptions.

The offset pedestal stem sits behind the projecting tie rods. The compact upper
housing lies inside their swept annulus, so clearance does not depend on winding
angle. Conservative full-revolution envelopes use radii 36.5–41.5 mm for the M5
rods and 34–44 mm for their nut/washer stacks. The transition's maximum radial
corner distance is `sqrt(24² + 20²) = 31.24 mm`. Cap screw head/washer envelopes
are included in the independent check. The 180° drum rotation in the reference
is for presentation, not a motion constraint.

The 10.2 mm bearing housing ends 0.4 mm short of the left flange and 0.4 mm after
the right drum clamp. These small gaps require a dry clearance check before
rotation. The M6 mounting slots allow the supports to be moved axially to gain
clearance. Do not move a housing so far that its retaining lips contact the seals.

Nominal shaft-tip separation inside the coupling is 5 mm with 10 mm engagement
at either end. Inner-ring spacers separate the collars from housing lips. Actual
bearing inner-ring geometry, coupling jaw depth, shaft straightness and motor
flange screw details remain inspection items, not inferred measured values.

## Mesh and motion-envelope results

`pnpm cad:check -- --require-openscad` passed all 21 registered entrypoints
with OpenSCAD 2021.01, including the four new fabrication parts, without errors
or warnings. Independent checks used Python 3.14, trimesh 5.1.0, numpy 2.5.3 and
manifold3d 3.5.3. Every export is one watertight solid, rests on Z=0 and fits the
X1C allowance:

| Export | X × Y × Z bounds (mm) |
| --- | --- |
| Bearing lower | 33.1 × 100 × 79.8 |
| Bearing cap | 10.2 × 48 × 15.8 |
| Motor stand | 83 × 100 × 123 |
| Coupling cover | 62 × 86 × 39 |

The [independent mesh checker](../../../scripts/check-winch-mount-meshes.py)
passed 341 component-pair checks for the passive configuration and 352 for the
powered configuration, with intersection volume below 0.001 mm³. Checks include
mount parts, motor envelope, drum exports, nominal bearings/collars/spacers,
cap-screw head envelopes and conservative full-revolution tie-rod/nut/washer
sweeps. A deliberately straight pedestal control intersects the sweep and is
required to fail clearance, preventing a static-angle-only regression.

This covers nominal defaults and represented hardware, not every parameter
combination, actual screw style, all assembly insertion paths or operating loads.
Visual inspection covered the assembled passive model and the exposed powered
mount. Reproduce after exporting registered mount and drum fabrication STLs:

```bash
python scripts/check-winch-mount-meshes.py hardware/generated/winch-mount hardware/generated/winch-drum
```

Dependencies are optional inspection tools, installed outside the repository;
this command is not a new requirement for the Node workspace. Generated exports
and images remain ignored. BOM and local Markdown checks pass; the added hardware
allowance is explicitly unquoted, leaving 232 visible BOM incompleteness warnings.

## Limits

The rigid base and post-bolt pattern are a prototype proposal, not a structural
calculation or a sourced commercial plate. The powered shaft retains the long
613.3 mm span and unresolved deflection in the [shaft screening](drum-geometry-check.md).
The coupling cover is open below and at its ends; it is not a complete guard.
Line guidance, weather enclosure, homing and powered slip-ring integration remain
unfinished. PLA and later ASA need separate fit, retention, creep and load evidence.
