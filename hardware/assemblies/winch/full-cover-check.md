# Winch full-cover r0.3.0 nominal geometry record

Checked 7 October 2026 with OpenSCAD 2021.01. Status remains **concept-unvalidated**. The [machine-readable record](full-cover-check.json) identifies exact source, checker and STL hashes. Earlier [r0.2.0](full-cover-check-r0.2.0.md) and [r0.1.0](full-cover-check-r0.1.0.md) records are preserved.

## Configuration

The [current kit](full-cover.md) replaces passive left/right and powered right hoods at r0.3.0. The new powered index-1 pole middle and lower pole fascia variants are r0.1.0; unchanged hoods, shutters and clips retain r0.2.0. Fascia/rear shields/bench blank and the relocated anchor retain r0.1.0. The drivetrain and its attachment patterns are unchanged.

Both passive (246.9 mm winding width) and powered (570.3 mm) cases include original hardware envelopes, the closed bench blank, and a flat-post case omitting the blank. The flat-post study remains 100 mm wide, on four 25 mm metal standoffs, with post front Z=-33 mm and rear cosmetic envelope Z=-32 mm. The [round-pole record](round-pole-check.md) separately checks the matching metal saddle/cap/guide stack against both enclosures. These are alternative mounting stacks.

Nominal side hardware remains M4×16, 7 mm head, 9 mm OD × 0.8 mm washer and 7 mm AF × 3.2 mm plain nut. Clip/anchor hardware remains M4×25, two 0.8 mm washers, 5 mm locknut and maximum rear tip Z=-20.4 mm. Original M6 base and anchor rear clearances retain a conservative 14 mm diameter × 12 mm envelope. Actual supplied hardware and installation must be checked.

## Results

| Check | Result |
| --- | --- |
| Cover fabrication models (21 IDs) | One connected watertight solid each; consistent winding, positive volume and print Z minimum zero |
| Largest print axis | 198.5 mm; every cover print below 240 mm per axis |
| Passive nominal checks | 61,303 passed |
| Powered nominal checks | 132,540 passed |
| Total nominal checks | **193,843 passed**, other-body intersection volume <0.001 mm³ |
| Passive concealment | 3,220 bench + 3,220 flat-post rays blocked; omitted-concealment control exposes 2,176 rays |
| Powered concealment | 4,900 bench + 4,900 flat-post rays blocked; omitted-concealment control exposes 3,312 rays |
| Former right-end ports | Both Z=50/75 mm witnesses now contain solid wall |
| Powered transition | Correct index-3 wall retains 960 mm³; incorrect middle substitution retains 0 mm³ |

Bottom ports are nominal 14 mm diameter at X=W/2−55 / W/2−35, Y=-98, Z=13 / 25 mm. Their 17.7 mm sleeves obscure the tested oblique views of opposite clip heads. The widened inner corridor clears the nominal 30 mm cable bend. Two 10 mm cable envelopes clear the ports, under-drum route, original fixed parts and swept drivetrain; actual received bend limits and motor outlet geometry remain open. The independent anchor moves to X=W/2+60, Y=-60 with its revised hole pair.

Five conservative witness points around each represented exterior head/tip are viewed along fourteen direct/oblique directions, including front, rear, sides and ends. This is a bounded sightline check, not an exhaustive optical or physical proof. The real nominal metal hardware remains in the renderer and actual cosmetic meshes occlude it. Functional line and loom openings remain open.

Fascia and rear shields lift together 2 mm +Z, then fascia withdraws ±Y in 2 mm steps through 40 mm. The deliberately unlifted 2 mm straight pull hits the key lugs. Rear shields withdraw -Z after fascia removal. Ordered shutter withdrawal, hood lift, driver axes and drum removal are retained. Stationary cables must first be disconnected/withdrawn from the closed lower apertures; the cable routes are excluded from that service condition. The positioning line can remain secured in its separate upper corridor.

## Acceptance still open

No physical fabrication, material, print/retention fit, vibration, creep, structural capacity, bolt bending, torque, thermal, weather, powered harness, loaded operation or safe guarding acceptance is claimed. Qualify small printed interfaces before full panels, confirm received cable/hardware geometry, and follow the existing commissioning gates. Cosmetic parts carry no post load.
