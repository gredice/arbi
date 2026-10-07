# Full-winch cover r0.1.0 — nominal CAD inspection

Date: 7 October 2026. Status: **concept-unvalidated**. This record covers the
[full-cover configuration](full-cover.md) on the committed passive/powered drum
and mount baseline. [Issue #91](https://github.com/gredice/arbi/issues/91) records
the proposed base modification and acceptance scope. Review authority remains
the repository PR; no physical specimen or powered test is represented here.

## Reproduction and source identity

Use Node ≥24, pnpm 11.5.2 and registry-pinned OpenSCAD **2021.01**. Python
dependencies are in [the booklet requirements](../../../scripts/winch-booklet/requirements.txt).
From the repository root:

```sh
pnpm cad:check -- --require-openscad
python scripts/winch-booklet/build.py --publish
python scripts/check-winch-cover-meshes.py hardware/generated/booklet/models/arbi --record hardware/assemblies/winch/full-cover-check.json
python scripts/check-winch-mount-meshes.py hardware/generated/booklet/models/arbi hardware/generated/booklet/models/arbi
pnpm bom:check
pnpm docs:check
git diff --check
```

The [machine-readable record](full-cover-check-r0.1.0.json) contains the tested source
and STL SHA-256 hashes and per-variant counts. The booklet pack additionally
records source snapshots, all exported mesh bounds, triangle counts and the
exact STL/transform list of every illustration. Registry model IDs, not hardcoded
revision filenames, resolve the tested meshes. All eleven new fabrication IDs are
r0.1.0; the original coupling guard stays r0.1.1 and other drivetrain fabrication
models r0.1.0. This is an automated engineering inspection, awaiting human review.

## Represented nominal hardware

- Drum/body widths 246.9 / 570.3 mm, Ø128 flanges, shaft centre Z=80 mm;
  a **Ø140 × (W+43) mm full-revolution envelope**, X=-9..W+34, conservatively
  covers the flanges, tail/clamp/tie hardware. Against the shell alone it leaves
  6 mm to the straight inner sides and 10 mm to the front face; curved shoulders
  are checked as actual mesh, not inferred from those two values.
- Existing bearing lowers/caps, motor stand and coupling guard are actual exported
  meshes. Cap heads are Ø10 × 6 mm, support washer/head envelopes Ø12 × 7 mm.
  Post washers are **at most Ø24 × 1.6 mm**. The inward clip stem starts at Z=5.8
  to clear those washers; oversized washers invalidate this representation.
- Motor body 122 × 57 × 57 mm, hulled across ±2 mm vertical adjustment;
  coupling Ø20 × 25 mm with a conservative Ø24 check envelope; motor fasteners
  Ø12 × 14 mm, also hulled across the full vertical adjustment range.
- Added M4×16 screw shafts Ø4, heads Ø7 × 4, washers Ø9 × 0.8 mm, plain nuts
  7 mm across flats × 3.2 mm. Clip/base head and washer stacks are represented;
  nominal M4×25 base stack and 4.4 mm tip projection are documented in the guide.
- Fixed looms ≤10 mm OD through Ø14 mm ports. The checked **line corridor** is
  X=6..W+6, Y=50..115, Z=124..140 mm; the aperture extends another 4 mm axially
  at both ends. This is a bounded permitted path, not a fleet-angle calculation
  or a representation of flexible cable sag under tension.
- Powered slip-ring bay 30 × 18 × 18 mm at X=W+54..W+84, Y=-71..-53,
  Z=71..89. It is empty reserved space only; the BOM supplies no body, support,
  connector or rotating-loop geometry that could validate a complete interface.

## Results

| Check | Result |
| --- | --- |
| Eleven added fabrication meshes | One connected watertight solid each, consistent winding, positive volume, print Z minimum 0 |
| Largest main-panel print bounds | 182.5 × 152.5 × 187.067 mm; all parts below 240 mm per axis |
| Passive nominal checks | 15,950 passed |
| Powered nominal checks | 32,862 passed |
| Total new checks | **48,812 passed**, clearance intersection volume <0.001 mm³ |
| Existing mount/drum regression | Passive 665 + powered 684 pair checks, plus 284 cover insertion samples per variant, passed |
| Original closed-slot removal control | Intentionally intersects the threaded line after a 20 mm lift; the checker must detect it |
| Powered transition wall / wrong-middle control | 960 mm³ retained at X=600..620, Y=76.5..79.5, Z=124..140; reusing the index-1 middle at index 3 retains 0 mm³ and must fail |
| Publication | 18-page PDF and 62-mesh source/STL pack regenerated; actual installed/exploded views of both variants |

The new checker tests installed shell/shutter pairs, core/hardware, line corridor,
clip/anchor clearances, captive nuts, complete shell screw stacks and driver
approaches. Shutters withdraw +Y in 2 mm steps through 40 mm, then hoods lift
+Z left to right in 2 mm steps through 130 mm with subsequent hoods present.
The secured line remains in its corridor. Original cap and M6/M8 driver axes are
tested with the shell off. A rigid drum envelope lifts 140 mm in 5 mm steps
after releasing the original caps/coupling, checking the clips/anchor only.
These sampled rigid paths supplement stated nominal gaps; they are not physical
motion, flexible-cable or human-access tests.

The new CAD corrects the two collisions found during development: an exterior
seam cuff touching the next payout brow, and a clip stem touching a represented
large post washer. It also provides removable lower payout shutters so hood
removal does not drag a closed slot across the threaded line. Current record
hashes identify the corrected meshes; early development exports are not releases.
Review also exposed an incorrect index-1 powered-middle export reused at index 3.
That position crosses the global payout end and now uses its own registered
transition mesh. The checker requires solid upper side wall beyond X=580.3 mm,
and reproduces the missing wall with the earlier middle-reuse control. Clearance
checks alone cannot detect material omitted from a hood. The renderer and kit
quantities use two middles and one transition to match canonical assembly CAD.

## Limits and required acceptance

No print, fit, material, torque, stiffness, rotating-hardware, thermal, outdoor or
loaded-line acceptance is claimed. Particularly open: received motor/flange and
lead geometry; actual bearing/post fasteners; print shrink/warpage and clip/cuff
strength; line traversal, rub and snag under reversals; powered conductor/slip-ring
support and strain relief; the unrepresented near-motor driver mounting/enclosure;
motor temperatures at current/duty; drainage and rain
paths in +Y-up field orientation; UV/creep; and contact/entanglement protection.
The slot, vents and open skirt admit tools/fingers and water. A CAD pass does not
close the safety case or qualify the existing powered shaft. Keep powered/load
operation gated by the owning physical commissioning records.
