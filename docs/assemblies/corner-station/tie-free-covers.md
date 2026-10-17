# Pulley post head: tie-free cosmetic covers

17 October 2026. [Proposal #230](https://github.com/gredice/arbi/issues/230)
replaces the selected printed head's two cosmetic ties with eight independent
M3 screw joints. Carrier halves and the assembly are r1.1.0; rear pads and both
covers are r0.2.0; the bought-hardware visualization is r0.2.0. The shared
marking template remains r0.1.0. All affected models remain
**concept-unvalidated**. The proposal becomes the selected repository design
on merge; physical fit, fastener retention, creep and weather acceptance remain
pending in the [acceptance record](acceptance-record.md).

## Attachment contract

Units are mm; installed axes are +X toward the span, +Y across it and +Z up.
`front` is the M12 front washer-seat plane (post radius + 32), and `rear` is
the rear washer-seat plane (-post radius - 16). These datums follow each named
post-size study; do not scale a default STL.

| Interface | Nominal geometry |
| --- | --- |
| Front cover joints | Four Y-axis screws at X=`front + 10`, Z=20/170, entering from both Y sides |
| Front carrier bosses | Added from the carrier sides to Y=±60.5, below cover inner walls at ±61; 0.5 shell-to-boss gap |
| Front nut centres | Y=±56; top-loaded slots behind the cover sidewalls |
| Front outer shell / washer | Y=±65 / outer washer face ±65.5 |
| Rear pad ears | Each pad adds ears at X=`rear - 14…rear + 4`, outer Y=±44.5, local Z=±8 |
| Rear cover joints | Four Y-axis screws at X=`rear - 8`, Z=45/155, entering from both Y sides |
| Rear nut centres | Y=±40; top-loaded slots in the pad ears |
| Rear outer shell / washer | Y=±49 / outer washer face ±49.5; 0.5 shell-to-ear gap |
| M3 clearance bores | Diameter 3.4 in covers and matching attachment features |
| Captive plain hex nut | AF5.5 × 2.4 thick reference in an AF5.7 × 2.8 deep slot, open above for loading |
| Cover screw / washer | M3 × 12 socket head / OD7 × bore3.2 × 0.5 |
| Nominal tip projection | 1.3 beyond each plain nut, into the remaining clearance bore; verify actual screw/nut dimensions |

The nut pocket restrains rotation; it is not a threaded print or heat-set
insert. Load nuts from above before fitting either cover. Each cover has four
screws, washers and captive nuts; the eight joints do not share the structural
M12 or M8 bolts. Snug the cosmetic joints without crushing the shell, boss or
ear. No torque, preload, locking performance or structural rating is assigned.
Check nut capture, tool access, screw-tip clearance and loosening on the actual
prints and received hardware before selecting a maintenance interval.

The carrier web strap channels and cover strap passages are removed. No tie,
strap or lashing retains a revised cover. Existing open rib-clearance channels
and drains remain; the covers have no sealed-enclosure or weather rating and
do not close the pulley's thin-line side gaps.

## Reprint and hardware quantities

Reprint **both carrier halves, both copies of the rear pad and both covers**.
Earlier carrier, pad and cover revisions lack the matching screw interfaces;
do not mix them with this kit. The shared marking template, M12 timber-hole
pattern, M8 carrier cross-bolts, measured Barton pin/lug and line alignment are
unchanged. The optional indoor stand uses the new carrier filenames with its
unchanged adapter fabrication geometry; its first fit still omits both covers
and all M3 cosmetic hardware.

| Bought cosmetic hardware | One head | Four heads |
| --- | ---: | ---: |
| M3 × 12 socket-head screws | 8 | 32 |
| OD7 × bore3.2 × 0.5 washers | 8 | 32 |
| Plain M3 hex nuts, AF5.5 × 2.4 | 8 | 32 |
| Ties / straps | 0 | 0 |

These counts belong to `corner-head-printed-hardware`; reconcile any shared
purchasing stock once. Plain hex nuts must not be replaced by taller locking
nuts without a new slot, stack and clearance review. No new supplier offer,
price, material qualification or received-stock match is asserted.

## Print pose and support review

The retained carrier transforms keep the principal XZ load plane parallel to
printer XY. The added Y=±60.5 cover-boss faces reach the bed first in the
normalized print poses; the broad carrier web faces sit **20.5 mm above the
bed**. The rear pads rest on their rearward ear faces, leaving the main pad
backplane **14 mm above the bed**. These are nominal geometry distances, not
verified print-process settings.

Review supports beneath the broad carrier webs and rear-pad body, including
the lug/boss/ear transitions and nut-slot access. The poses do not establish
support-free fabrication or acceptable bridging. Check support footprint and
removal access in the slicer before printing; choose and qualify the support
process with the material and orientation. After removal, inspect supported
undersides, boss/ear roots, washer seats, bores and nut pockets for cracks,
gouges, poor layers or lost material. Record this inspection before assembly;
mesh integrity alone does not qualify those manufactured sections.

## Assembly and service

1. Inspect the matching prints and top-load all eight plain nuts into the
   carrier bosses and rear-pad ears. Record actual nut-slot fit and inspect
   the added roots and holes for cracks or poor layer bonding.
2. Assemble the structural carrier, pads, M12/M8 fasteners and received pulley
   under the [design package](design-package.md). Nut capture must not hide
   structural damage or obstruct the timber seats.
3. Fit the front cover upward around the webs and the rear cover from -X.
   Install four M3 × 12 screws with washers per cover from the two Y sides.
   Inspect tip projection, seating and drainage; do not use tightening to
   correct distorted prints or gaps.
4. Before service, isolate and independently secure/unload the line and loose
   covers. Remove all eight M3 screws and washers. Lower the front cover
   190 mm -Z, then translate 100 mm +Y; withdraw the rear cover 80 mm -X.
   Leave all structural M12/M8 fasteners installed. Capture loose hardware and
   check that the nuts remain seated before refitting.

## Nominal verification and physical evidence

The [corner builder](../../../scripts/corner-support/build.py) and its geometry
checks must verify each round-100/120/140, square-100 and powered-line study
against the current sources. Required checks cover positive/watertight single
part meshes, matching print/installed transforms, eight screw/nut/washer stacks,
open bores, nut capture, nominal tip projection, shell clearance, screw/tool
access, cover service paths after removing cosmetic hardware, and separation
from structural hardware. Deliberately misplaced or incompatible fastening
controls must fail. The generated geometry report identifies the actual source
and mesh hashes; no older r1.0.0 report establishes these new interfaces.

This document defines the nominal contract; it is not a physical test result.
Nominal mesh/export checks cannot establish print accuracy, nut insertion and
retention, fastener loosening, material strength, layer bonding, creep,
weathering or installed load capacity. Record measured assembly/removal,
vibration/retention and outdoor-aging results separately in the
[acceptance record](acceptance-record.md). The added holes, bosses and ear roots
also require the load-bearing print review described in the
[load study](printed-load-study.md).
