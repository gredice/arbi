# Measured Barton block and mating CAD: nominal record

Historical r1.0.0 carrier record from 11 October 2026. The measured Barton
interface remains the reference; the [tie-free cover update](tie-free-covers.md)
changes carrier/pad/cover geometry and requires fresh nominal checks. These
earlier results do not validate the new cover joints.

11 October 2026. Carrier halves, block, keeper, split-collar front and assembly
references revision `1.0.0`, all `concept-unvalidated`. Unchanged pads, covers,
template and stand clamp fabrication remain `0.1.0`. The
[owner measurement/specification record](../../../bom/sourcing/barton-n01090-2026-10-11.md)
owns physical dimensions; the historical [r0.1.0 record](geometry-check.md)
retains its earlier assumptions/results.

## Reproducible checks

Use OpenSCAD 2021.01 and the [booklet requirements](../../../scripts/winch-booklet/requirements.txt):

```bash
python3 scripts/corner-support/check-barton-block.py --record /tmp/barton-block-check.json
python3 scripts/build-pole-pulley-concept.py
python3 scripts/corner-support/build.py
python3 scripts/check-booklet.py hardware/generated/corner-support --variant corner
python3 packages/arbi-bom/scripts/capture-print-volumes.py
pnpm bom:generate
pnpm bom:check
pnpm cad:check -- --require-openscad
pnpm docs:check
```

The independent Barton regression reads actual written meshes and checks the
65 × 36 × 24 mm envelope, 4.7 mm pin section, 42 mm centres, 1.5 mm tangs and
15.8 mm clear gap. A 14.8 mm rounded lug and 5.2 mm bore leave provisional print
allowances. An 8 mm pin and an oversized 16 mm lug are deliberate rejection
controls. The keeper is checked against the measured body envelope without a
fitted-attachment or thin-line-retention claim. Central lug/collar articulation
is sampled at 0/15/30/45/60/75/90° in the nominal pin plane. The steel link is
only an envelope with its own unqualified bought dimensions.

The corner builder checks the complete printed head at round 100/120/140,
passive/powered line and square-100 configurations: connected/watertight meshes,
print transforms/bed limits, pin bore and retained lug/web probes, supplied-block
pose, winch tangent, bolt/locking/tool envelopes and sampled cover service paths.
It also runs the WT-806 adapter regression and builds the current 14-page
actual-mesh booklet. The portable source pack includes the new shared block and
its evidence; no generated STL or bulk renders are committed.

## Evidence boundary

These are nominal geometry checks, not physical fit or load acceptance. Owner
measurements have no supplied uncertainty/lot record. Cheek shape, groove root,
side gaps, axle/rivets, usable pin length and ring are reconstructed. The
catalogue outside sheave diameter still defines the illustrative line-centre
radius; actual rope seating can change alignment. Inspect the finished lug,
locking engagement, articulation/fleet angle, friction and retention with the
actual line. Print/process strength, creep, structural/site review and loaded
operation remain in the [acceptance record](acceptance-record.md).
