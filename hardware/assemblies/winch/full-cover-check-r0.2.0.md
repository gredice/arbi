# Winch full-cover r0.2.0 nominal geometry record

Checked 7 October 2026 with OpenSCAD 2021.01 and the repository's mesh checker. Status remains **concept-unvalidated**. [Machine-readable record](full-cover-check-r0.2.0.json) identifies exact source/checker/STL hashes; the [r0.1.0 record](full-cover-check-r0.1.0.md) is preserved.

## Configuration and hardware envelope

Main panels, shutters and clips r0.2.0; coupling guard r0.1.1; unchanged drivetrain and anchor; fascia/rear shields/bench blank r0.1.0. Both 246.9 mm passive and 570.3 mm powered winding widths are represented. The closed bench variant includes the common blank. The post variant omits it and uses a 100 mm-wide post on four **25 mm steel M8 standoffs**, nominal 16 mm OD / 9 mm bore. Post front Z=-33 mm clears the cosmetic rear envelope Z=-32 mm by 1 mm. This changes the mounting offset and requires structural/bolt-bending review; it is not a qualified installation. No printed part carries post load. Far-side post/backing-plate hardware is outside this winch enclosure.

Nominal side stacks: M4×16 shank, 7 mm OD × 4 mm head, 9 mm OD × 0.8 mm washer and 7 mm AF × 3.2 mm plain nut. Clip/base stack: M4×25 through a 6 mm clip and 8 mm base, two 0.8 mm washers and 5 mm locknut; maximum rear tip Z=-20.4 mm. Original M6 base/anchor rear clearance uses a conservative 14 mm diameter × 12 mm envelope down to Z=-20.4 mm. Oversized heads, washers, nuts or excess tip projection require a fresh check. These are nominal references, not received-unit measurements.

The existing swept drum/core, motor adjustment, bearing-cap hardware, line corridor, 10 mm looms and reserved powered slip-ring bay remain checked. The cover does not implement the unresolved slip-ring/harness or CL57Y driver enclosure. Five motor vents move to Z=58..63 mm above fascia/visors, preserving five 10×5 mm openings. Vent witnesses have a 0.01 mm inset solely to avoid coincident STL coordinate rounding.

## Results

| Check | Result |
| --- | --- |
| Cover fabrication models (18 IDs) | One connected watertight solid each, consistent winding, positive volume, print Z minimum zero |
| Largest print axis | 198.5 mm; every cover print is below 240 mm per axis |
| Passive nominal checks | 57,978 passed |
| Powered nominal checks | 128,323 passed |
| Total nominal checks | **186,301 passed**, clearance intersection volume <0.001 mm³ |
| Passive concealment | 3,220 bench + 3,220 post rays blocked; omitted-concealment control exposes 2,164 rays |
| Powered concealment | 4,900 bench + 4,900 post rays blocked; omitted-concealment control exposes 3,297 rays |
| Key retention control | Straight 2 mm sideways pull collides with keys; required 2 mm +Z unlock clears them |
| Powered transition control | Correct index-3 wall retains 960 mm³; incorrect middle substitution retains 0 mm³ |

Five conservative points around every represented exterior head/tip witness are viewed along fourteen direct and oblique directions, including front, rear, both sides and both ends. Real hardware remains in the renderer; cosmetic meshes occlude it. This is a bounded nominal sightline check, not an exhaustive optical or physical proof. Functional line/loom openings remain open.

Fascia and rear shields lift together +Z in 0.5 mm steps through 2 mm; fascia then withdraws ±Y in 2 mm steps through 40 mm, with clips, original hardware, hoods, shutters and lifted shields present. Rear shields withdraw -Z after fascia removal. Original shutter withdrawal, ordered hood lift, original driver axes and drum lift are retained. The deliberately unlifted straight-pull control proves the keys are not cosmetic voids. These are rigid sampled paths; assembly force, warpage, vibration retention, wear and human access still need physical inspection.

## Acceptance still open

No fabrication, print fit, material, key retention, creep, vibration, structural/post capacity, bolt bending, torque, thermal, water/UV, powered harness, loaded-line or safe guarding acceptance is claimed. Qualify the small key interfaces before full panels. Confirm received hardware, all underside tip clearances, mounting stack and access. The 25 mm spacers need structural review and remain an unquoted procurement allowance. Desk feet use the open service configuration. Keep physical operation under the existing commissioning gates.
