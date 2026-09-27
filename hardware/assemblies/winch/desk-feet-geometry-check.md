# Desk feet geometry check - 2026-09-27

Models: `winch-desk-foot-short` and `winch-desk-foot-long`, revision `0.1.0`.
State: **concept-unvalidated**. Automated geometry check; physical inspection
and human engineering review remain outstanding.

Configuration: passive 550 x 180 x 8 mm plate, 50 x 120 mm post-hole pattern,
35 mm foot height, 9.2 mm bolt passage and 26 x 27 mm underside nut recess.
Reference mount geometry: commit `d8235b0`.

OpenSCAD 2021.01 exports and the mesh checker reported:

| Check | Short foot | Long foot |
| --- | --- | --- |
| Bounding box, mm | 160 x 60 x 35 | 244 x 60 x 35 |
| Connected components | 1 | 1 |
| Triangles | 1564 | 1564 |
| Closed, consistently oriented manifold mesh | Pass | Pass |
| Non-degenerate triangles and positive volume | Pass | Pass |
| Solid CAD volume, cm3 | 74.28 | 105.80 |

A Boolean intersection check of all four installed feet against eight
20 mm diameter fastener envelopes, extending 25 mm below the plate,
returned an empty intersection. This checks nominal geometry only; measure
the actual protruding fasteners and inspect the printed parts.

## Reproduction

Use OpenSCAD 2021.01, Python 3 and NumPy:

```bash
python3 scripts/check-winch-desk-feet.py
pnpm cad:check -- --require-openscad
```

Exports and the collision model are generated in a temporary directory.
This record does not establish print quality, bolt clamping capacity, stiffness,
desk friction, tipping resistance or suitability for tensioned cable tests.
