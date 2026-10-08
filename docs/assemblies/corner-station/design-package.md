# Corner support set design package

Revision `0.1.0`, 8 October 2026, **concept-unvalidated**. This is the nominal
completion package proposed in [the design proposal](design-proposal.md).
It is ready for CAD and design review; physical/structural completion requires
the [acceptance record](acceptance-record.md). No installed load capacity is
assigned.

## Configuration and dimensional drawing

Units are mm. +Z is up the post; +X points toward the span; Y is across it.
The angle bottom is Z=0. The standard preview is the proposed round-120,
200 mm angle, passive 1.5 mm line arrangement. Matching front and rear saddles
are **metal**; the white stem hood, separate roof and rear shield are non-structural prints.

| Interface | Proposed default | Basis |
| --- | ---: | --- |
| Round post | 120 diameter; 100/140 study variants | Repository starting range; measure both rows |
| Front/rear saddle central depth | 10 each | Machining envelope; review material/contact |
| Angle | 200 × 40 × 200, 5 thick | Alternative to baseline 150 mm angle |
| Vertical bolt centres | Y=0, Z=45/155 | 110 pitch; proposed pattern, factory holes unrepresented |
| Through holes | 13 | M12 clearance, not timber structural approval |
| Rear plates | 2 × 100 × 200 × 2 | Existing stacked-plate allowance; actual perforations unrepresented |
| Terminal hole | 9, Y=0 | Connector must fit received double tang |
| Passive terminal X from angle seat | 167.55 | Nominal winch tangent matching |
| Powered terminal X from angle seat | 166.65 | Separate nominal 4.5 mm line assumption |
| Sheave centre below beam underside | 70 | Provisional connector/block layout; measure before manufacture |
| Stem hood envelope | 31.25 × 54 × 177 | Conceals front bolts; separate roof permits removal |
| Roof envelope | 149.8 × 54 × 20 | Stops 17 mm before terminal axis; no keeper function |
| Rear shield envelope | 37.25 × 110 × 210 | Default M12 × 180 stack; regenerate if bolt/post changes |
| Marking template | 200 × 50 × 4 | 3 mm centre marks at 45/155; not a drill guide |
| Stem/rear strap slots | 7 × 3, Z=20/170 | Two <=2.5 × 1 straps; third wraps roof/arm; 800 mm starting length |

Bought angles are shown without factory holes, dimples, bend radius or material
certificate. Inspect the actual part and obtain structural review before
drilling. The printed template marks the vertical centres only; the horizontal
hole needs a separate measured metalworking setup. Check the template dimensions
after printing and remove it before powered drilling.

The 200 mm [BAUHAUS 10670753 listing](https://www.bauhaus.hr/kutnici-za-velika-opterecenja/stabilit-cvrsti-kutnik/p/10670753)
describes a galvanized 200 × 40 × 200 mm, 5 mm angle. Observed on 8 October 2026;
this is size evidence, not a rated overhead bracket or a refreshed quote.
The [150 mm listing](https://www.bauhaus.hr/kutnici-za-velika-opterecenja/stabilit-cvrsti-kutnik/p/10670739)
supports the historical angle envelope. Existing supplier offers and dated
prices remain historical.

## Why the longer angle is proposed

The committed [round-winch mount](../../../hardware/assemblies/winch/round-pole.md)
puts the post front at local Z=-33. The
[line tangent](../../../hardware/assemblies/winch/full-cover.md#routing-and-service)
is local Z=130.3 passive or 130.9 powered, so the drop is respectively 163.3 or
163.9 mm in front of the post surface. For a 30 mm sheave, the represented line
centre radius is 15 minus half the line diameter.

```text
terminal offset from angle seat
  = winch drop from post surface + line-centre sheave radius - front saddle depth
passive: 163.3 + 14.25 - 10 = 167.55 mm
powered: 163.9 + 12.75 - 10 = 166.65 mm
```

The historical 150 mm angle's 125 mm hole on a round post instead gives
10 + 125 - 14.25 = 120.75 mm, **42.55 mm behind** the passive winch tangent.
The 200 mm proposal resolves this nominal depth mismatch; it does not establish
acceptable fleet angle across the complete drum width or actual block freedom.
Do not move the hole to a new location in a 150 mm angle: that angle is too short.

## Pulley, connection and keeper

The [received purchase record](../../../bom/sourcing/wasi-pulley-2026-10-08.md)
identifies four Barton BA01090 plain-bearing double-tang blocks.
The [WASI listing](https://wasi.hr/kolotura-jednostruka-fiksna-za-uze-do-8m),
observed on 8 October 2026, lists a 66 × 32 × 25 envelope and 30 × 12 sheave.
[Barton's double-tang range](https://bartonmarine.com/block-type/double-tang/)
confirms the attachment type and plain-bearing option; its maximum rope size
does not establish retention of 1.5 mm Dyneema or electrical hybrid line.

CAD uses a conservative 36 mm body and provisional tang/pin/connector shapes.
These are layout references, not supplier-certified BA01090 geometry. Measure
the received tang gap, pin diameter, pin usable length, sheave position, groove
and hazardous side gaps. Verify articulation through span angles and both
winding directions. Do not drill the factory tangs or force an M8 pin/shackle.

The old `top-pulley-keeper` r0.1.0 defaults to a 58 mm pulley and is not fitted
to this 30 mm block. The new weather shields do not replace it as a line keeper.
Keeper design cannot be frozen until the received groove/side gaps and line
sweep are recorded. Keep this item explicitly open in acceptance.

## Fasteners and fabrication

Load path: positioning line → purchased block → reviewed compatible metal
connector → steel angle → M12 through-bolts → timber/saddles/backing plates →
embedded post and reviewed guy connection → guy/anchor and soil.

| Timber configuration | Nominal bolt length | Represented stack before protrusion | Protrusion |
| --- | ---: | ---: | ---: |
| Round 100 + two 10 mm saddles | 160 | 147 | 13 |
| Round 120 + two 10 mm saddles | 180 | 167 | 13 |
| Round 140 + two 10 mm saddles | 200 | 187 | 13 |
| Historical square 100, no saddles | 160 | 127 | 33 |

Stack includes 5 mm angle, 4 mm backing plates, two 3 mm washers and a provisional
12 mm locking nut. M12 coarse pitch is represented as 1.75 mm; require full nut
and locking-zone engagement plus at least two protruding threads in the
received stack. Nominal square 100 projection is long: retain tip clearance in
its matching cover and review a shorter bolt on the actual stack. **M12 × 160
does not suit the round-120 saddle stack.** Do not infer torque/preload from this
length calculation or cut bolts without an approved finish/thread procedure.

The metal saddle solids are machining envelopes, not finished manufacturing
drawings. Review grade, stock, tolerances, actual timber contact, corrosion,
holes, pressure distribution and edge finish. The rear saddle is a full-width
curved seat, so its edge depth exceeds its nominal central depth. ASA is a
weather-shield candidate; slicing/orientation/support, shrinkage, strength,
creep and retention remain unqualified. The exported fitted parts use the
installed frame; the marking template alone is placed flat on Z=0.

## Quantities and alternatives

The canonical [assembly BOM](../../../bom/assemblies/assemblies.json) preserves
the existing purchasing baseline. Proposed shield, saddle, marking and replacement
hardware quantities are optional; enabling all optional items is **not** a
valid variant-selection method. No prices or supplier offers are invented.

| Item | One proposed round head | Four proposed round heads |
| --- | ---: | ---: |
| 200 mm angle, replacing 150 mm angle | 1 | 4 |
| Backing plates | 2 | 8 |
| Metal front/rear saddle pair | 1 pair | 4 pairs / 8 pieces |
| Correct-length M12 bolt pair, replacing baseline pair | 1 pair | 4 pairs / 8 bolts |
| M12 washers / locking nuts | 4 / 2 | 16 / 8 |
| Received pulley / compatible connector | 1 / 1 | 4 / 4 |
| Optional stem hood / roof / rear cover | 1 / 1 / 1 | 4 / 4 / 4 |
| Optional independent straps | 3 | 12 |
| Shared marking tool | — | 1 |

Remove baseline angle and bolt quantities when selecting the proposed round
configuration. Do not add the split collar or historical keeper to this kit.
The four reviewed guy-to-post connection sets are a deferred, required unresolved
interface; the current BOM lacked this named interface. Each station also needs
one post, outward guy, anchor and turnbuckle, and two wire-rope terminations.
Existing 16 m wire / 16 clamps / 8 thimbles are allowances; actual guy geometry,
tails and supplier-specific termination requirements determine final quantities.

## Assembly, routing and service

1. Complete the measurement sheet and structural/site review. Inspect timber,
   actual angle/perforated plates, saddles and connector; confirm exact variants.
2. Mark inspected steel first. Drill controlled coaxial 13 mm through holes;
   protect deburred galvanized edges and exposed timber as specified by review.
3. Assemble head → washer → angle → front metal saddle → timber → rear metal
   saddle → two backing plates → washer → locking nut. Square baseline omits
   both saddles. Avoid crushing timber; use reviewed preload and recheck settlement.
4. Attach the inspected block with its compatible reviewed connection, retaining
   all supplier locking parts. Route line, align drum tangent, and inspect the
   entire span, winding width, direction reversals and slack setup.
5. Fit the stem hood from +X and rear cover from -X after inspecting metalwork.
   Pass two independent straps through both shields at Z=20/170. Seat the separate
   roof from above and retain it with a third strap around the roof/metal arm. Verify positive
   retention physically; straps and printed shields retain no structural parts.
6. For service, isolate/secure, retain loose covers independently, release straps,
   roof: lift 20 mm +Z, then slide 80 mm +Y; stem: pull 40 mm +X, then slide
   80 mm +Y; rear: pull 80 mm -X. A straight roof pull collides with the provisional
   connector. Reserve all these movements plus hand/tool clearance. Replace cut straps. Inspect witness
   marks, nut engagement, corrosion, print cracks and drainage before refitting.

The winch remains separately owned. Position it at the reviewed 0.5–1.0 m
starting height and use its existing stationary-loom exits/strain relief.
The local driver enclosure and 48 V/signal branches follow the
[pole wiring plan](../winch/pole-box-wiring.md). Do not trap water, obscure damage,
route a fixed cable into line sweep, or assign the keeper a strain-relief role.

## Whole-station design and remaining acceptance

The [site document](../site-installation/README.md) owns survey/soil geometry.
Pulley centres are targeted near 3 m, but purchased post length, embedment,
wind, loads and maintenance access must be settled together. The guy-to-post
connection needs its own reviewed dimensions and rating. A strap, weather
cover, wood screw or unspecified wrap is not that connection.

The builder's executable statics calculation resolves both line-leg tensions,
span elevation/azimuth, guy angle, eccentric reaction and residual ground
moment. Equal 10 N legs at a right-angle turn yield 14.142 N resultant. A 45°
span azimuth leaves 7.071 N transverse force and a 21.213 N·m transverse ground
moment at 3 m despite the guy. These are **synthetic arithmetic references**,
not capacity or configured limits. A single guy does not cancel every line
direction; post/soil analysis must include the residuals and dynamic/fault loads.

The dock corner must include parked pod, latch, shelter and wind loads and keep
cover/tool access. The powered-line corner must include the actual hybrid line's
bend, electrical/fatigue limits and driver/cable protection. Those surfaces
remain separate acceptance work; no generic head preview proves them complete.

Use the [acceptance record](acceptance-record.md) to capture received-part fit,
keeper design, complete structural load calculations, soil/anchor proof tests,
corrosion review, thermal/weather checks, inspection intervals and discard
criteria. A qualified reviewer defines proof loads, durations and movement
limits; there is no invented numerical proof factor or operating limit.

## Reproducible deliverables

[Build instructions](../../../scripts/corner-support/README.md) produce an A4
eight-page assembly PDF, actual-mesh figures, GLB inspection model, matching
source/STL ZIP and hash/geometry report. The
[nominal evidence record](geometry-check.md) states exactly what was checked.
Working exports remain ignored; canonical SCAD, registry, BOM and instructions
remain editable repository sources. Keep installed, exploded, square-baseline
and powered study configurations labelled.
