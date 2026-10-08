# Corner support set printed design package

8 October 2026. The printed-head models are revision `0.1.0`,
**concept-unvalidated**. The owner selected this
[printed-head proposal](design-proposal.md) for design development. The package
defines nominal geometry, print-kit selection and assembly; structural and
physical completion requires the [acceptance record](acceptance-record.md).
No installed load capacity, maximum operating tension or installation approval
is assigned.

## Configuration and dimensions

Units are mm. +Z is up the post; +X points toward the span; Y is across it.
The carrier bottom is Z=0. Default is round-120/passive-1.5; round-100/140,
square-100 and round-120/powered-4.5 are separate study configurations.

| Interface | Proposed default | Basis |
| --- | ---: | --- |
| Round post | 120 diameter; 100/140 studies | Measure diameter at both bolt rows, taper and ovality |
| Square study | 100 × 100 | Separate adapter geometry; do not use curved seats |
| Carrier height / root width | 205 / 80 | Two joined printed carrier halves |
| Side web thickness | 16 each | Triangular outer webs joined by the top chord |
| Curved post bore | Post diameter + 0.5 | Nominal fit allowance; not a universal timber tolerance |
| Vertical M12 centres | Y=0, Z=45/155 | 110 pitch; printed/template pattern |
| M12 clearance | 13 | Nominal clearance; recheck printed and timber holes |
| Front washer seat X | Post radius + 32 | Integrated front printed adapter/carrier |
| Rear washer seat X | -post radius - 16 | Two printed rear pads, one per row |
| Rear pad width / height | 80 / 50 each | Curved depth varies away from the central 16 mm seat |
| M8 cross-bolt centres | X=post radius + 50, Z=100/190 | Two bolts through the 80 mm root width |
| Passive pulley pin X | Post radius + 149.2657 | 45° equal-tension horizontal-span block pose |
| Powered pulley pin X | Post radius + 148.3657 | Provisional 4.5 mm line, same nominal pose |
| Sheave centre X | Post radius + 177.55 passive / 176.65 powered | Distinct from attachment-pin X |
| Pulley pin Z / sheave centre Z | 165 / 136.7157 | Provisional 40 mm pin-to-sheave separation at 45° |
| Terminal lug / tang gap | 8 / provisional 9 | Layout assumption, not BA01090 fit evidence |
| Carrier end | Pulley pin X + 16 | Terminal edge material remains subject to strength review |
| Front / rear cosmetic cover | 39 × 130 × 180 / nominal 25.25 × 98 × 180 | Default round-120 bolt stack; regenerate other configurations |
| Front fascia | 3 thick, X=front seat + 33…36 | Intact face; cosmetic strap cuts stop behind it |
| Front rib-clearance channels | 18 wide, Y=23…41 / -41…-23; open above Z=30 | Clear structural webs; cover remains connected through its lower bridge/sidewalls |
| Cosmetic straps / slots | Two <=2.5 × 1 straps; Z=20/170 | 800 mm starting length; replace after removal |
| Shared marking tool size | 205 × 50 × 4 | 3 mm centre marks at 45/155; not a drill bush |
| Shared marking tool | One per four-station set | Check printed scale; remove before drilling |

The canonical
[printed library](../../../hardware/lib/corner-head-printed.scad) and registered
entrypoints own geometry. Re-export the whole selected configuration after a
post, line or fit parameter changes; do not combine halves or rear pads from
different exports. Printed clearance is not final manufactured clearance.
The front cover's strap openings lie in its sidewalls at X=front seat + 27…33,
behind the intact fascia. Its open rib channels and underside permit clearance
and drainage; these cosmetic covers have no sealed-enclosure or weather rating.

## Line alignment

The committed [round-winch mount](../../../hardware/assemblies/winch/round-pole.md)
puts its post surface at local Z=-33. The
[line tangent](../../../hardware/assemblies/winch/full-cover.md#routing-and-service)
is local Z=130.3 passive or 130.9 powered. The corresponding drop is 163.3 or
163.9 mm in front of the post surface. For a 30 mm sheave the represented
line-centre radius is 15 minus half the line diameter.

```text
sheave centre X from post surface = winch drop + line-centre sheave radius
passive: 163.3 + 14.25 = 177.55 mm
powered: 163.9 + 12.75 = 176.65 mm

provisional pin-to-sheave distance = 40 mm
nominal equal-tension horizontal-span pose = 45 degrees about the Y pin
pin X from post surface = sheave centre offset - 40 / sqrt(2)
passive pin: 149.2657 mm; powered pin: 148.3657 mm
sheave centre Z = 165 - 40 / sqrt(2) = 136.7157 mm
```

The nominal pose assumes equal span/descending-leg tension, a horizontal +X
span, a freely articulating Y pin and no restraining couple. Their resultant
points 45° toward the span and down, so the sheave lies forward/below the pin;
a vertical hanging-block pose would misplace the downward tangent. In the
represented 45° pose, the tangent coincides with the winch reference.
Actual span elevation/azimuth, unequal tensions, bearing friction, articulation
stops and received pin-to-sheave distance change this pose. Check alignment
through full span/winding travel and loaded deflection physically. The nominal
pose is neither an articulation envelope nor acceptance of every line angle.
The square-100 printed study uses the same head alignment reference; its lower
winch must supply the matching measured tangent before installation.

## Pulley, pin and keeper

The [received purchase record](../../../bom/sourcing/wasi-pulley-2026-10-08.md)
identifies four Barton BA01090 plain-bearing double-tang blocks. The
[WASI listing](https://wasi.hr/kolotura-jednostruka-fiksna-za-uze-do-8m), observed
8 October 2026, lists a 66 × 32 × 25 envelope and 30 × 12 sheave.
[Barton's double-tang range](https://bartonmarine.com/block-type/double-tang/)
confirms the attachment type. The CAD block is a provisional layout envelope,
not supplier-certified geometry, and maximum rope size is not proof of retention
of 1.5 mm Dyneema or the actual powered hybrid line.

Measure tang gap, pin diameter, usable pin length, locking details, sheave
position, groove and hazardous side gaps. Select a compatible bought pin and
locking arrangement; the nominal M8 envelope is not authorization to force
M8 hardware into the received block. Check terminal-lug bearing, edge distance,
pin bending and articulation. Retain the supplier's locking parts where applicable.

The historical `top-pulley-keeper` r0.1.0 defaults to a 58 mm pulley and is not
fitted to this received 30 mm block. The new covers do not close pulley side gaps.
A fitted removable keeper remains required before loaded acceptance; its gap
must be derived from the actual groove, line and full tension/slack sweep.

## Bought hardware and bolt stacks

The proposed load path is:

```text
positioning line → received block → compatible bought metal pin
→ printed terminal lug / triangular carrier webs / root adapters
→ M12 through-bolts, washers and printed rear pads → timber
→ embedded post and reviewed guy attachment → guy/anchor and soil
```

Both carrier halves participate in the printed structure. The integrated top
chord spans Z=185–205; the 8 mm central terminal lug spans Z=150–190. Two M8
cross-bolts join the halves; do not run with a missing half or missing cross-bolt. There are no
steel angles, custom metal saddles or rear steel plates in this printed variant.

| Printed timber configuration | Nominal M12 length | Represented stack | Protrusion |
| --- | ---: | ---: | ---: |
| Round 100 | 170 | 166 | 4 |
| Round 120 | 190 | 186 | 4 |
| Round 140 | 210 | 206 | 4 |
| Square 100 | 170 | 166 | 4 |

The represented M12 stack is post + 32 mm front seat + 16 mm rear central pad
+ two 3 mm washers + 12 mm locking nut. The selected nominal lengths provide
only 4 mm projection. Measure every received stack and require full nut and
locking-zone engagement plus at least two protruding M12 coarse threads
(3.5 mm). Timber variability, print tolerance and actual nut dimensions may
require the next suitable bought bolt length and regenerated cover clearance.
Do not infer clamp preload or torque from this length calculation. The historical
M12 × 160 pair is too short for the printed stacks.

Two M8 × 100 cross-bolts use four nominal 1.6 mm washers and two nominal
6.5 mm locking nuts. The 80 mm root width gives 10.3 mm nominal projection.
Verify the actual head/nut dimensions, locking engagement, tool access and cover
clearance. Use bought large M12 washers to spread local pressure; their presence
does not prove printed-seat compression, creep, timber contact or clamp retention.
No metal compression sleeve, torque value or structural rating is assigned.
The cosmetic covers shield the M12 mounting stack. The upper M8 cross-bolt
at Z=190 remains exposed above the 180 mm front cover and must stay inspectable.
The two small rounded cosmetic strap channels through the web at Z=20/170
are stress concentrations to include in structural review and complete-head
tests; their nominal clearance does not establish residual strength.

## Prototype printing and qualification

This design contains load-bearing prints. PAHT-CF or tested ASA are provisional
material candidates. The filament name alone does not qualify the geometry or
the printer process. Covers may be ASA candidates separately from the carrier;
their cosmetic role does not qualify the load-bearing carrier. See the
[load-study note](printed-load-study.md) for the load/material assumptions and
sources.

Use the exported print orientations and inspect them in the slicer. Carrier
halves should place their broad X/Z web faces on the bed so the main web load
path lies in deposited layers; verify the transformed mounting holes and lug
faces against the installed model. Rear pads and covers need their own slicer
review. Record material manufacturer/lot, drying and conditioning, nozzle,
layer height, wall count, infill, temperatures, enclosure, supports, seam
positions and actual part dimensions. A prototype process should provide
continuous walls around bolt and pin holes and avoid sparse infill as the only
connection between loaded features. Final settings must come from testing.

The current round-120 carrier mesh encloses approximately 563 cm³ per half,
about 1.13 litres for the pair before pads and covers. These are substantial
prototype prints. The generated geometry report owns the exact solid volume
for each configuration; older exports with different bore or pulley-pin geometry
do not describe the current carrier. CAD volume is not a filament, finished-mass,
print-time or strength estimate.
Slice and review one complete head before printing four sets, recording actual
support/brim footprint, material usage and time from the chosen process.
Changing infill to reduce consumption must preserve tested loaded sections and
be covered by qualification.

Inspect holes, first-layer distortion, voids, layer bonding, support damage,
root curves and bolt-seat surfaces before bench assembly. Do not install a
part with visible cracking or a damaged hole. Any reaming/finishing must retain
reviewed wall/edge dimensions and be recorded. Keep spare prints as replaceable
parts after a validated process exists; a fresh print does not automatically
qualify an altered filament, orientation or printer setting.

Define maximum line tension and span angles first. Review both line-leg forces,
web bending/shear, lug and bolt bearing, interlayer failure, fastener pressure,
joint slip and creep under sustained preload and line load. Test a complete
assembled head at worst-case outdoor temperature/conditioning, in the required
directions, for reviewer-defined loads and durations. Include sustained creep,
cyclic reversal, slack/derailment response and post-test inspection. Record
deflection and permanent set against quantitative acceptance limits. No print
settings or synthetic CAD/statics calculation substitute for this evidence.

## Quantities and alternative selection

The canonical [assembly BOM](../../../bom/assemblies/assemblies.json) preserves
the historical purchasing baseline. The new printed kit and bought-hardware
set are optional alternatives while this proposal is under review. Do not
enable every optional item as a build selection. No prices or supplier offers
are invented for the new items.

| Item | One printed head | Four printed heads |
| --- | ---: | ---: |
| Printed left / right carrier | 1 / 1 | 4 / 4 |
| Printed rear pads, same STL | 2 | 8 |
| Printed front / rear cosmetic covers | 1 / 1 | 4 / 4 |
| Correct-length M12 bolts | 2 | 8 |
| M12 large washers / locking nuts | 4 / 2 | 16 / 8 |
| M8 × 100 cross-bolts / washers / locking nuts | 2 / 4 / 2 | 8 / 16 / 8 |
| Received pulley / compatible bought pin set | 1 / 1 | 4 / 4 |
| Cosmetic cover straps | 2 | 8 |
| Shared printed marking tool | — | 1 |

Selecting the printed head replaces the baseline steel angle, two backing
plates, M12 × 160 bolt pair and generic shackle with the printed kit and its
hardware set. Existing measured M12 washers/nuts can be reused; count them once.
Do not select the 200 mm steel angle, metal saddles, metal-head shields/straps,
historical keeper or split collar as additional parts of the printed head.
The received pulley, timber post, guy, anchor and turnbuckle remain required.
The fitted keeper and four reviewed bought guy-to-post attachments remain
unresolved interfaces, not completed parts supplied by this print kit.

Existing 16 m guy wire / 16 clamps / 8 thimbles are allowances. Site geometry,
tails and the selected termination specification determine final quantities.
Guy loads must not be assigned to a cosmetic strap or the printed cover.

## Assembly, routing and service

1. Record post and received-pulley measurements. Complete the print-process and
   bench-test plan before a loaded prototype. Select one matching configuration
   and verify dimensions and current source/mesh hashes.
2. Print and inspect the two carrier halves, two matching rear pads and covers.
   Check the marking tool's scale. Mark the two timber centres, remove the tool,
   and drill coaxial 13 mm holes using a controlled fixture. Protect exposed
   timber as specified by the site review.
3. Join the carrier halves with the two M8 cross-bolts, washers and locking nuts.
   Check seat continuity, cross-bolt engagement and absence of print damage.
4. Assemble each M12 row: bolt head → large washer → printed carrier seat →
   timber → printed rear pad → large washer → locking nut. Use the reviewed
   clamp process; inspect printed-seat pressure and timber contact. Record
   witness marks and nut engagement. Do not use torque to hide gaps or crush a pad.
5. Attach the inspected block with the compatible bought pin/locking set. Check
   tang articulation through the nominal 45° pose, line sweep and fitted keeper.
   Align with the lower winch
   tangent across its complete winding travel and both directions.
6. Fit the front cover from below, sliding its open rib channels around the
   structural webs; fit the rear cover from -X. Fit two independent bought straps,
   reserving the service/tool paths shown by the current assembly exports. Covers
   and straps retain no pulley, carrier or bolt load. The top chord is part of
   the structural carrier and must not be removed as a service roof.
7. Before service, isolate and independently secure/unload the line and loose
   covers. Release cosmetic straps. Lower the front cover 190 mm -Z, then slide
   100 mm +Y; pull the rear cover 80 mm -X. Inspect holes, web roots,
   pads, cracks, witness marks, bolt engagement and drainage. Replace cut straps.
   Structural carrier, pad or fastener removal requires the reviewed unloaded
   procedure; do not transfer load to one remaining carrier half.

The [winch](../winch/README.md) remains separately owned. Its stationary loom,
strain relief, local driver box and 48 V/signal branches follow the
[pole wiring plan](../winch/pole-box-wiring.md). Keep fixed cables outside line
sweep, maintain drip paths and leave structure and pulley damage inspectable.

## Whole-station acceptance

The [site document](../site-installation/README.md) owns survey and soil geometry.
Pulley centres are targeted near 3 m, but post length, embedment, wind, loads,
maintenance access and anchor layout must be reviewed together. Select a bought
guy-to-post connection with reviewed timber attachment, direction, dimensions
and rating; the printed pulley carrier is not a qualified guy anchor.

The builder's vector statics resolves both line-leg tensions, span elevation
and azimuth, unilateral guy reaction, eccentric load and residual ground
moment. Equal 10 N legs at a right-angle turn give a 14.142 N resultant. A 45°
span azimuth leaves 7.071 N transverse force and 21.213 N·m transverse ground
moment at 3 m despite the guy. These are synthetic arithmetic references, not
capacity or configured limits. A single guy does not cancel every load direction.

The dock corner also needs parked-pod, latch, shelter and wind loads and service
access. The powered corner needs actual hybrid-line bend, electrical/fatigue
and driver/cable acceptance. The generic head preview does not close those
surfaces. A qualified reviewer defines proof directions, loads, durations,
creep/cycle conditions and movement/discard limits in the
[acceptance record](acceptance-record.md). No numerical proof factor or operating
limit is invented.

## Historical metal alternatives

The old sources remain unchanged: square-100/150 mm steel angle, and
round-100/120/140 with 200 mm angle and machined metal saddles. Metal-saddle
STLs remain machining/fit envelopes and are not the new printable adapters.
Use the distinct model IDs to avoid substitution. The
[150 mm supplier listing](https://www.bauhaus.hr/kutnici-za-velika-opterecenja/stabilit-cvrsti-kutnik/p/10670739)
and [200 mm listing](https://www.bauhaus.hr/kutnici-za-velika-opterecenja/stabilit-cvrsti-kutnik/p/10670753)
were observed 8 October 2026 as envelope evidence, not structural ratings or
refreshed quotations. Their bolt stacks and cosmetic covers are separate from
this printed selection.

The 150 mm round-120 metal layout puts its downward tangent 42.55 mm behind
the passive winch tangent. The 200 mm alternative corrected that nominal depth
with a terminal hole 167.55 mm from its 10 mm front saddle seat. This historical
comparison does not qualify either metal or printed installation.

## Reproducible deliverables

[Build instructions](../../../scripts/corner-support/README.md) produce the
assembly PDF, actual-mesh figures, GLB inspection model, source/STL ZIP and
hash/geometry report from the selected printed sources. The
[nominal evidence record](geometry-check.md) states the tests and their limits.
Generated exports remain ignored; canonical SCAD, registry, BOM and these
instructions remain editable repository sources. Keep installed/exploded,
post-size and powered study configurations labelled.
