# Coupling-cover clearance check — 2026-09-27

Configuration: coupling cover and mount reference **0.1.1**, motor stand and
bearing parts **0.1.0**, drum fabrication parts **0.1.0**. Status remains
**concept-unvalidated**. The owner reported that motor mounting screws, washers
and nuts prevent the 0.1.0 cover from seating. No dimensions of the received
fasteners were supplied; the envelope below is a documented design allowance.

## Change and compatibility

The original cover had a 48 mm-wide internal cavity with its roof 24 mm above
the shaft axis. Motor mounting centres are at Y/Z=±23.57 mm, with ±2 mm vertical
adjustment, so a normal washer overlaps the walls and roof near the stand.

Revision 0.1.1 adds a wider, open-bottom motor-end cavity. It accepts four
12 mm-diameter fastener envelopes projecting 14 mm from the coupling-side stand
face, including screw tips. It adds 1 mm radial/axial clearance and preserves the
entire ±2 mm motor adjustment. The recess is 61.14 mm wide, extends 32.57 mm above
the shaft axis and is 15 mm deep. Its side/top/forward walls are 3 mm thick.
The existing front shell remains 4 mm thick. The stand and cover attachment
centres are unchanged, so only the cover needs reprinting.

Print bounds are **65.57 × 86 × 39 mm** in the exported orientation; the
motor-facing flange remains on Z=0. Check the new internal step in the slicer.
Mount it with four M4×20 screws, eight 9 mm OD washers and four locknuts. The
minimum lateral gap to the modelled cover-washer envelope is **0.43 mm**.

## Independent checks

The [mesh checker](../../../scripts/check-winch-mount-meshes.py) loads current
registry output names and uses trimesh/manifold boolean intersections. It checks:

- One watertight body, positive volume, build-plate contact and print bounds.
- The convex hull of the motor-fastener cylinders at both adjustment limits.
- The original cover as a regression control: **3624.095 mm³** of total
  overlap with the motor hardware envelope, required to fail clearance.
- Revised cover versus those envelopes: no overlap above **0.001 mm³**.
- Cover removal/installation at 1 mm increments over a 0–70 mm vertical lift:
  **284 motor-fastener checks per configuration** passed.
- Four cover screw-head/washer envelopes, motor, bearings, collars, spacers,
  coupling, printed supports and full-revolution drum rod/nut sweeps:
  **665 passive** and **684 powered** component-pair checks passed.

Reproduce with current exported models:

```sh
python3 scripts/check-winch-mount-meshes.py hardware/generated/booklet/models/arbi hardware/generated/booklet/models/arbi
```

OpenSCAD **2021.01** compiled all **23 registered entrypoints** with
`pnpm cad:check -- --require-openscad`. BOM regeneration and `pnpm bom:check`
passed with the existing 232 procurement-incompleteness warnings. Local Markdown
link validation passed. The 14-page booklet was rebuilt from these STL exports
and every page was rendered for visual inspection.

The older [mount check](mount-geometry-check.md) remains a historical 0.1.0
record; it did not include motor mounting hardware. The new check addresses that
omission. It uses nominal envelopes, not a scan or measurement of the actual
fasteners, and samples a straight vertical installation path. It does not prove
fit after printing, unrestricted tool access, strength, guarding performance or
thermal endurance. Dry-fit the revision before any powered test.
