# Temporary Barton adapter for already printed r0.1.0 heads

Proposed in [issue #209](https://github.com/gredice/arbi/issues/209), 12 October
2026. Adapter revision `0.1.0`, **concept-unvalidated**. This is a removable
reuse adapter while the measured-interface r1.0.0 carrier halves are made.
Use it for unloaded fit and hand-routing trials; no structural capacity or
loaded-operation approval is established.

## Identify the old part

Use **both old r0.1.0 carrier halves** from commit `84f3b52` (introduced in
[PR #137](https://github.com/gredice/arbi/pull/137)). Together they have a
32 mm wide × 8 mm thick rectangular terminal tongue, an 8.6 mm transverse
bore at Z165, and a flat lower edge 15 mm below that bore. Each half contributes
4 mm of the tongue thickness. Measure the assembled tongue before printing
the adapter. The r1.0.0 head has a rounded 14.8 mm tongue and 5.2 mm bore and
uses the pulley directly; this adapter does not fit that revision. Do not mix
old and new carrier halves.

The received [Barton N01090 record](../../../docs/assemblies/corner-station/received-barton-pulley.md)
owns the measured 4.7 mm pin, 15.8 mm clear tang gap and 42 mm pin-to-sheave
centres. A reducing bush alone leaves the old rectangular tongue obstructing
the reconstructed block neck at the nominal 45° pose. The adapter provides a
separate lower rounded tongue instead.

## Print and hardware

Print one of each registered entrypoint; **these STLs already use print poses**:

| Part | Print quantity | Nominal print envelope |
| --- | ---: | --- |
| [Left socket half](corner-head-legacy-adapter-left.scad) | 1 | 40.6 × 57 × 7.4 mm |
| [Right socket half](corner-head-legacy-adapter-right.scad) | 1 | 40.6 × 57 × 7.4 mm |

The outside flat face lies at Z0, the socket pocket faces upward, and both
bores are vertical. Nominal geometry requires no support; inspect the slicer
preview and hole finish. Use a solid/perimeter-filled fit sample to avoid a
sparse neck. This is a process starting point, not a qualified print recipe or
material choice. PLA/PETG fit samples establish neither weather nor load capacity.

Additional bought hardware for **one head**:

- One M8 × 30 bolt; threads and head details are not represented in the
  nominal hardware envelope. This is an unloaded fit attachment.
- Two M8 washers, nominal 16 mm OD × 8.4 mm ID × 1.6 mm thick.
- One M8 locknut. The modeled washer-to-nut stack is 24.5 mm from under the
  bolt head, leaving 5.5 mm of a 30 mm shank beyond the nut. Actual locking
  engagement governs selection. Longer bolts may reach the old outer ribs;
  recheck clearance before changing the bolt or washer stack.
- The already received Barton pulley, its **supplied 4.7 mm pin and locking
  ring**. An M8 bolt belongs only at the old carrier hole; never put it through
  the factory tang holes or enlarge those holes.

## Reversible installation

1. Remove line tension, disable powered motion, and support the head/pulley
   while working. Remove any old provisional pulley attachment.
2. Check the old tongue dimensions above and the joined carrier's condition.
   Fit the left/right socket halves around it, with the rounded lower lug
   pointing down. The 32.6 × 8.6 mm pocket gives nominal 0.3 mm clearance on
   each side of the old tongue; its floor is 0.5 mm below the old lower edge.
   The sidewalls and floor locate the adapter against rotation.
3. Pass the M8 bolt through a washer, both socket halves and the existing old
   carrier bore; add the second washer and locknut. Seat without distorting or
   crushing the prints. No tightening torque or clamp-load qualification is
   available. Stop if the adapter can rock excessively or the carrier cracks.
4. Place the Barton's two tangs around the new **14.8 mm** rounded lower lug.
   Pass the native 4.7 mm pin through the tangs and **5.2 mm** adapter bore;
   refit its locking ring and inspect positive engagement. Do not force the pin.
5. Check free movement with the real block, pin/ring and intended line, then
   hand-route the line with the payload independently supported. Inspect
   rubbing, pin locking, socket movement and line retention before each trial.
   No loaded movement, suspended payload or outdoor commissioning follows
   from the nominal check. Retain the separate physical acceptance gates in
   the [head acceptance record](../../../docs/assemblies/corner-station/acceptance-record.md).
6. When r1.0.0 halves arrive, remove the adapter and its extra M8 hardware;
   mount the block directly on the new carrier's native-pin lug.

## Position and test boundary

The native pin is **35 mm below the old bore**, with a **−1.4142 mm X**
correction toward the post to account for 42 mm rather than 40 mm centres.
The nominal 45° vertical line tangent retains the committed winch position;
the sheave and horizontal span sit **35 mm lower than r1.0.0**. For round-120
passive configuration the new pin is X207.8515/Z130 and the sheave is
X237.55/Z100.3015. Check mounting heights and route the trial span at that
height; this is not a dimensionally interchangeable head or a calibration
update for powered motion. Covers are omitted from the inspection reference;
their service clearance with the temporary adapter is not qualified.

The [shared source](../../lib/corner-head-legacy-adapter.scad),
[frozen old-interface reference](../../lib/corner-head-legacy-interface.scad)
and [assembled reference](corner-head-legacy-adapter-assembly.scad) own this
geometry. The two adapter halves use the same print files for old round
100/120/140, square-100 and powered-line heads. Other old dimensions need
another measured interface review.

Run from the repository root with OpenSCAD 2021.01 and the
[existing Python requirements](../../../scripts/winch-booklet/requirements.txt):

```bash
python3 scripts/corner-support/check-legacy-adapter.py
pnpm bom:generate
pnpm bom:check
pnpm cad:check -- --require-openscad
pnpm docs:check
git diff --check
```

The checker writes both print STLs and `geometry-check.json` to the ignored
`hardware/generated/legacy-pulley-adapter/` directory. It compares the frozen
old carrier against its original Git source, checks connected/watertight
prints and bed transforms, socket/hardware clearance, pin bores, nominal
winch tangent and sampled block articulation at 0/15/30/45/60/75/90°.
An M8 native-pin substitution and a bush-only old attachment are rejection
controls. This uses the reconstructed Barton surface model; actual neck,
groove, locking ring, tolerances, print strength and loaded behavior still
require physical inspection and acceptance.

The [12 October nominal record](legacy-pulley-adapter-check.md) records the
source hashes and observed results. `*-reference.stl` and the GLB in generated
output are inspection surfaces; print only the two registered adapter STLs.
