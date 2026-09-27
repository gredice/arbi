# Passive-base drilling template

[Download the three-page A4 PDF](passive-base-drilling-A4.pdf).
It matches the passive 550 x 180 x 8 mm base in
[the mount source](../../lib/winch-mount.scad), using W=246.9 mm.
This is nominal concept geometry; compare the actual printed supports with the
marks before drilling. The 880 mm powered base requires a different template.

1. Print all three pages single-sided, A4 landscape, actual size / 100%.
   Disable fit-to-page and shrink-to-printable-area.
2. Measure the 100 mm reference line on every sheet before using the template.
3. Arrange sheets 1, 2 and 3 left to right. Their plate coordinate ranges are
   0-200, 175-375 and 350-550 mm: each join has a 25 mm overlap.
4. Trim paper margins as needed, superimpose the matching blue crosses using
   light through the paper, and tape the joins. Both long plate-edge lines must
   continue straight. The assembled rectangle must measure 550 x 180 mm.
5. Place the template on the plate with the labelled left edge at the non-motor
   end. Align the outside plate edges, secure the paper, and center-punch the
   hole positions. Intermediate sheet boundaries are not plate edges.
6. Pilot-drill, then enlarge the bearing/motor mounting holes to 7 mm. The four
   9 mm post holes are optional for mounting to a post, but are required for
   the [desk feet](desk-feet.md). Deburr before assembly.

Hole centres, measured from the non-motor end and the same long edge:

| Use | X (mm) | Y (mm) | Diameter (mm) |
| --- | --- | --- | --- |
| Left bearing | 28.5 | 50, 130 | 7 |
| Right bearing | 350.4 | 50, 130 | 7 |
| Motor, first row | 409.9 | 46, 134 | 7 |
| Motor, second row | 451.9 | 46, 134 | 7 |
| Post / feet, first row | 148.45 | 30, 150 | 9 |
| Post / feet, second row | 198.45 | 30, 150 | 9 |

## Regeneration

Install Python 3 and ReportLab, then run from the repository root:

```bash
python3 scripts/generate-winch-drilling-template.py
```

Use `--output /tmp/passive-base.pdf` to create a review copy. The generator
records the fixed passive CAD baseline at commit `d8235b0`; recheck its
coordinates against the mount source before regenerating after a geometry
change. The PDF is a tracked, ready-to-print document.
