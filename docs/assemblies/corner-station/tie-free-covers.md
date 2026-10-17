# Pulley post head: concealed, tie-free cosmetic covers

17 October 2026. [Proposal #232](https://github.com/gredice/arbi/issues/232)
replaces the exposed M3 cover joints introduced by
[PR #231](https://github.com/gredice/arbi/pull/231) with entirely printed,
concealed retention. Carrier halves and the assembly are r1.2.0; rear pads and
both covers are r0.3.0; the bought structural-hardware visualization is r0.3.0.
The shared marking template remains r0.1.0. All affected models remain
**concept-unvalidated**. The proposal becomes the selected repository design
on merge; printed fit, latch force/fatigue, creep and weather acceptance remain
pending in the [acceptance record](acceptance-record.md).

## Attachment contract

Units are mm; installed axes are +X toward the span, +Y across it and +Z up.
`front` is the M12 front washer-seat plane (post radius + 32), and `rear` is
the rear washer-seat plane (-post radius - 16). `B` is the inner rear-shell
backplane, `pch_bolt_tip() - 3` in the source; it is `rear - 22` in the named
100/120/140 studies. These datums follow each named post-size and bolt-stack
study; do not scale a default STL.

The cover side, front and back faces are smooth and have no fastening bores,
visible screw heads or nuts. Underside blade access and existing drains remain.
Each cover uses continuous internal T-slide guides engaging four fixed printed
T-followers, plus a positive cantilever latch accessible
from underneath. Guides prevent the shell pulling away across the slide axis;
the latch blocks sliding removal. Friction alone is not the retention method.
All cover screws, washers, nuts, tie passages and nut pockets are removed.
The concealed printed joints are independent of the structural M12/M8 bolts.
The front guides sit 6 mm rearward of the previous M3 joint datum and extend
2 mm behind the original shell edge to clear the M8 shaft; the former M3 holes
at X=`front + 10` are filled. The rear latch/catch and release access sit 10 mm
in +Y from the centre plane to clear the projecting M12 bolt tip. These shifts
do not change the rear T-guide datums.

| Interface | Nominal geometry |
| --- | --- |
| Front carrier followers | Four at X=`front + 4`, Z=20/170, on both Y sides; 6 high |
| Front follower section | Root ends at absolute Y=54.1; 8-wide neck to Y=58; 14-wide head at Y=58…60.2 |
| Front internal guides | Outer X=`front - 5…front + 13`, absolute Y=54.5…61.3; neck/head cavities 8.6/14.6 wide, with nominal 0.3 side and 0.4 depth clearances. Nearest M8 shaft begins X=`front + 14`, giving 1 nominal X clearance |
| Front guide entry / lower stop | Continuous vertical guides open at Z=180; lower stop at Z=16.7 |
| Rear pad followers | Four, centred at X=`rear - 8`, Z=45/155, on both Y sides; same T-section shifted 16 inward along Y |
| Rear internal guides | Continuous along X, open at front rim X=`rear - 0.75`; back stop at X=`rear - 11.3` |
| Front catch / hook | Catch X=`front…front + 28.5`, Y=±6, Z=72…75; hook lower face Z=75.3 with 0.3 vertical gap |
| Front latch beam | X=`front + 29.5…31`, Y=±5, Z=40.5…79, anchored at Z=37…41; nominal release envelope moves toward +X by approximately 1.5 |
| Rear catches on identical pads | Catch local Z=21…25; installed lower Z=66…70, upper Z=176…180. Only lower catch engages; unused upper catch is 6 below inner roof Z=186 |
| Rear catch bridge / stop | Bridge X=`B + 0.5…rear + 4`, Y=4…7; stop X=`B + 0.5…B + 1.7`, Y=4…9 |
| Rear latch root / beam | Root X=`B - 0.2…B + 6`, Y=10…11.5, Z=37…41; beam X=`B + 2…B + 6`, Y=10…11.5, Z=40.5…69 |
| Rear hook and engagement | Hook Y=8…10.2, Z=65…69; 0.3 neutral X clearance, 1 Y overlap and 3 Z overlap with lower catch; nominal release envelope moves toward +Y by approximately 1.5 |
| Rear underside blade port | 3 × 7 opening at X=`B + 2.5…B + 5.5`, Y=6.5…13.5, through floor Z=10…14; side/back faces remain unpierced |
| Positive retention | One printed cantilever latch per cover; hidden underside blade access releases it before sliding |
| Cosmetic hardware | Zero screws, washers, nuts, ties or straps per head |

The latch and guide dimensions in the
[canonical library](../../../hardware/lib/corner-head-printed.scad) govern each
export. The released CAD envelopes rotate the front beam about Y by
`atan(1.5/36)` and the rear beam about -X by `atan(1.5/26)`, around their
nominal Z=40.5 roots (rear pivot X=`B + 4`, Y=10.75). These are rigid kinematic
clearance studies, not elastic predictions or evidence of achievable force,
deformation or life. Separate nominal blade sweeps use 2.8° at the front and
4.0° at the rear to establish contact with the released beams; these tool
angles are not the smaller latch-envelope rotations. Measure the
actual printed engagement and release before selecting a maintenance interval.
No assembly force, release force, latch cycle life,
vibration rating, preload or structural rating is assigned. Do not force a
stiff or distorted guide, omit the latch, or add ties to compensate for poor fit.

Existing open rib-clearance channels and drains remain. The covers have no
sealed-enclosure or weather rating and do not close the pulley's thin-line
side gaps. M12 nuts beneath the rear shell and structural hardware become
accessible by removing the shell. The upper M8 cross-bolt remains above the
180 mm front cover and must remain inspectable; no cover fastener is exposed.

## Reprint and hardware quantities

Reprint **both carrier halves, both copies of the rear pad and both covers**.
Earlier carrier, pad and cover revisions lack the matching printed interfaces;
do not mix them with this kit. The shared marking template, M12 timber-hole
pattern, M8 carrier cross-bolts, measured Barton pin/lug and line alignment are
unchanged. The optional indoor stand uses the new carrier filenames with its
unchanged adapter fabrication geometry; its first fit still omits both covers.

No purchased cover fasteners are required for one head or four heads. Remove
the previous allowance of eight M3 × 12 screws, eight washers and eight plain
M3 nuts per head from the buying list; the shared stock is not consumed by
these cover joints. The `corner-head-printed-hardware` set now owns only the
structural M12/M8 fastening and compatible supplied pulley-pin requirements.
No new supplier offer, price, material qualification or received-stock match
is asserted.

## Print pose and support review

The retained carrier transforms keep the principal XZ load plane parallel to
printer XY. The added Y=±60.2 follower faces reach the bed first in the
normalized print poses; the broad carrier web faces sit **20.2 mm above the
bed**. Rear pads print on the original local **Z=-25 lower face**, translated
25 mm upward with no rotation; the main pad body contacts the bed. This revised
pose keeps the rearward catch above the bed instead of lowering it through
the former ear-based print plane. These are nominal geometry placements, not
verified print-process settings.

Review supports beneath the broad carrier webs, rearward pad-catch bridge and
horizontal M12 bore, including follower roots and the internal guide/latch
overhangs. The poses do not
establish support-free fabrication or acceptable bridging. Check support
footprint and removal access in the slicer before printing; choose and qualify
the support process with the material and orientation. After removal, inspect
supported undersides, roots, guide lips, cantilever beams/hooks, washer seats
and structural bores for cracks, gouges, poor layers or lost material. Record
this inspection before assembly; mesh integrity alone does not qualify those
manufactured sections. Keep support debris out of the continuous guide cavities.

## Assembly and service

1. Inspect the matching prints. Check follower/guide clearance, guide stops,
   latch hooks, catch engagement and accessible underside release with no
   structural load. Record actual fit and inspect roots for cracks or poor
   layer bonding.
2. Assemble the structural carrier, pads, M12/M8 fasteners and received pulley
   under the [design package](design-package.md). Cover retention must not
   hide structural damage or obstruct the timber seats.
3. Offer the front cover from below, align all four followers with the open
   guide tops and slide the cover upward to its stops and positive latch.
   Offer the rear cover from -X and slide it toward +X until its stops and
   latch engage. Confirm both catches positively block reverse travel and
   inspect seating and drainage. No screws, nuts or ties are fitted.
4. Before service, isolate and independently secure/unload the line and loose
   covers. Release each cantilever through the hidden underside access with a
   0.6-thick flat blade, without prying on the exterior faces. For the front,
   rock the blade from below to move the hook toward +X; hold it released for
   the first 8 mm of downward cover travel, then withdraw the blade. Continue
   lowering the front cover to 190 mm -Z, then translate 100 mm +Y. For the
   rear, pass a 2-wide blade through the underside port at Y=9.2…9.8 to
   Z=64 and rock it about Z=41 to move the hook toward +Y. Hold it released for the first 6 mm
   of -X cover travel, then withdraw the blade and continue to 80 mm -X. Leave
   all structural M12/M8 fasteners installed. Inspect the guides, follower roots,
   catches and latch beams before refitting; replace damaged prints rather than
   forcing them.

## Nominal verification and physical evidence

The [corner builder](../../../scripts/corner-support/build.py) and its geometry
checks must verify each round-100/120/140, square-100 and powered-line study
against the current sources. Required checks cover positive/watertight single
part meshes, matching print/installed transforms, smooth side/front/back faces
with no cover hardware or fastening through-holes, guide/follower clearances
and stops,
positive latch engagement and released clearance, underside tool access,
shell clearance, cover installation/service paths after release, and separation
from structural hardware. Deliberately misplaced or incompatible guides,
unreleased latches and rejected removal paths must fail. The generated
geometry report identifies the actual source and mesh hashes; older r1.1.0
or earlier reports do not establish these new interfaces.

This document defines the nominal contract; it is not a physical test result.
Nominal mesh/export checks cannot establish print accuracy, latch insertion
or release force, repeated bending life, vibration/retention, material strength,
layer bonding, creep, weathering or installed load capacity. Record measured
assembly/removal, latch cycles and retention, vibration and outdoor-aging
results separately in the [acceptance record](acceptance-record.md). Follower
roots and guide/latch sections also require the load-bearing print review
described in the [load study](printed-load-study.md).
