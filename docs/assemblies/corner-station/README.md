# Corner station

## Responsibility and boundary

The corner support set groups the four complete corner installations. Each station reacts positioning-line load and routes one line between the garden span and its [winch](../winch/README.md). The support assembly directly owns its post, soil/foundation interface, outward guy, guy anchor interface, top head, pulley attachment, non-structural line keeper/weather cover, winch mounting envelope, and installed inspection points.

The four-winch set is a separately documented child assembly: three ordinary winches with Dyneema lines and one powered winch with a hybrid line and slip ring. Lines and their conductors belong to the winches rather than a standalone line set. The shared [positioning-line specification](../positioning-lines/README.md) defines construction and maintenance requirements. See [ADR-0010](../../decisions/0010-corner-support-and-winch-line-ownership.md).

Support and winch BOM quantities and goods allocations have separate direct owners. Build definitions include both sets once; the ownership hierarchy does not multiply or duplicate child parts. The support CAD preview shows the head, not an assembled scene of every corner subassembly.

One corner station also supports the [dock](../dock/README.md). Dock loads and clearances must be included in that station's variant.

The owner selected a [mostly printed head proposal](design-proposal.md) for
design development. The [design package](design-package.md) supplies ribbed
carrier halves with integrated post adapters, two rear pads, removable cosmetic
covers, a shared marking tool and ordinary bought fasteners. Its line position
matches the committed round-pole winch nominally. It requires no custom metal
angle, machined saddles or backing plates. The new load-bearing prints remain
`concept-unvalidated`; print-process, creep, load and site acceptance are recorded
in the [acceptance form](acceptance-record.md) and
[load-study note](printed-load-study.md). Historical 150/200 mm steel arrangements
remain separate alternatives and preserve their purchasing records.

## V1 starting geometry

For indoor development before the timber poles arrive, the optional
[WT-806 stand adapters](../../../hardware/assemblies/corner-station/stand-adapter.md)
mount the round-120 printed head and passive winch to two owned light stands
using reversible tube clamps and short bolts. Their nominal line alignment is
preserved. This `concept-unvalidated` fixture is for unloaded fit/rotation
checks; it does not establish cable-load capacity or installed acceptance.

| Property | Starting value | Status |
| --- | ---: | --- |
| Quantity | 4 | Baseline |
| Timber | Treated square or round fence/vineyard-style post | Baseline |
| Square section | 100 × 100 mm | Starting point |
| Round diameter | Approximately 100–140 mm | Starting range |
| Purchased length | Approximately 3.8–4.0 m | Starting range |
| Buried length | Approximately 0.8–1.0 m | Starting range |
| Exposed height | Approximately 2.9–3.1 m | Starting range |
| Pulley height | Approximately 3.0 m | Target |
| Guys | One outward guy per post | Baseline |

The final section, embedment, guy, and anchor depend on measured line loads, real timber properties, soil, wind, dock variant, corrosion, and qualified structural review.

## Load path and guying

The proposed printed-head load path is:

```text
positioning line → pulley → compatible bought metal pin
→ printed carrier lug, webs and integrated post adapters
→ two M12 through-bolts / printed rear pads / large washers → timber
→ embedded post and outward guy → soil and guy anchor
```

The printed head uses two M8 cross-bolts to join its carrier halves; no steel
angle, metal saddle or rear plate is part of that variant. Both halves and all
fasteners must be present. Cosmetic covers and straps carry no positioning-line
or guy load.

The pod is light, but configured line tension can dominate post loading. The
outward guy opposes one inward load direction; transverse and eccentric loads
remain in the post/soil system. The guy attachment is independently reviewed
bought hardware, with no product/rating yet selected.

Direct embedment without concrete is a conditional concept, not a universal construction rule. Do not install it without site-specific evidence.

## Top pulley

The repository baseline calls for one weather-resistant marine single block per corner for approximately 1.5 mm Dyneema:

- 25–30 mm sheave, with 30 mm preferred;
- approximately 20:1 sheave-to-line diameter ratio at 30 mm;
- bearing suitable for repeated movement, with a ball-bearing block preferred;
- positive side enclosure that prevents the thin line entering a side gap;
- known load rating and suitable groove geometry;
- removable printed keeper that does not carry structural load.

The [purchase record](../../../bom/sourcing/wasi-pulley-2026-10-08.md) identifies
four received WASI Barton BA01090 30 mm plain-bearing double-tang blocks.
Inspect their tang/pin geometry and thin-line retention before selection for
loaded operation. Supplier offers and receipt do not prove engineering fit.

## Drill-only bracket baseline

The historical, unvalidated per-post metal assembly uses:

- 1 × galvanized solid steel angle, 150 × 40 × 150 mm, 5 mm thick;
- 2 × galvanized perforated backing plates, 100 × 200 × 2 mm, stacked to approximately 4 mm;
- 2 × M12 × 160 mm galvanized class-8.8 through-bolts;
- 4 × M12 DIN 9021 large washers;
- 2 × M12 locking nuts;
- 1 × M8 A4 stainless shackle between angle and pulley;
- zinc-rich protection on deburred drilled edges.

Baseline drilling:

1. Two 13 mm holes through the vertical angle leg, timber, and both backing plates, vertically separated and centered across the 40 mm width.
2. One 9 mm shackle hole centered in the horizontal 40 mm arm, approximately 25 mm inboard from the outer end.
3. The resulting attachment is approximately 125 mm outboard from the pole face, within the repository target of 100–150 mm.

Through-bolt stack:

```text
bolt head → large washer → steel angle → timber
→ two stacked backing plates → large washer → locking nut
```

Do not substitute wood screws, coach screws, or a screw-in eye. Tightening must clamp the assembly without crushing timber, and torque/tension must be rechecked after settlement. If the selected pulley does not fit the shackle without side-plate distortion, a reviewed M8 stainless bolt, spacer/washer, and locking-nut pin may be used instead.

Material compatibility, galvanic exposure, locking method, actual edge distances, timber splitting, plate-hole geometry, and bolt preload still need engineering review.

## Load-bearing printed head, keeper and covers

The new printed carrier halves and rear pads are primary structural concepts.
PAHT-CF or tested ASA are candidates pending a recorded print process, received
fit, anisotropic strength, fastener-seat pressure, sustained-load creep, cyclic
reversal and outdoor conditioning tests. Carrier print poses place the main
web plane in deposited layers; slicer/support review and physical tests still
apply. The [package](design-package.md#prototype-printing-and-qualification)
defines process records and [acceptance](acceptance-record.md) keeps loads,
limits and authorized stages open. No torque or load rating is assigned.

The removable front/rear cosmetic covers are separate from the load-bearing
carrier. Two bought straps retain them; the structural top chord is an integral
roof and must not be removed for service. The following keeper requirements
apply to a separate fitted keeper, not to the carrier or cosmetic covers.

The removable keeper should:

- keep approximately 1.5 mm Dyneema centered without normal rubbing;
- close hazardous side gaps and reduce derailment during low-tension setup or parking;
- shield direct rain and UV while staying open below for drainage;
- permit inspection and removal without unloading the structural bracket.

ASA is a candidate for the non-structural keeper and cosmetic covers. Its
weather suitability does not qualify the printed carrier. PETG has no recorded
load-bearing qualification here. The keeper is expressly non-structural.
The legacy keeper defaults to 58 mm and is not fitted to the received 30 mm
block. The proposed white weather shields leave the pulley exposed and do not
close hazardous side gaps; keeper acceptance remains open.

## Winch and line alignment

The winch mounts on the same pole face directly below the top pulley, approximately 0.5–1.0 m above ground. Align the incoming drum tangent with the pulley groove so the line runs nearly vertically, without fleet angle or timber contact. The pulley turns the line approximately 90 degrees from the garden span toward the drum.

The [round-timber saddle concept](../../../hardware/assemblies/winch/round-pole.md) supplies a nominal 120 mm interface (100–140 mm study), metal through-bolt load path and rear nut covers. Its bottom loom guide routes stationary leads down the pole. Structural, material and physical acceptance remain open.

The station drawing must define the winch mounting interface, guard envelope, service access, cable route, driver enclosure mount, and drainage without owning the winch internals.

## Electronics, cabling, and retention

See the [pole-base box connection plan](../winch/pole-box-wiring.md) for cable entries, local terminals, remaining wiring details, and the additional pod-power branch at the powered-line corner.

Each pole is expected to carry a nearby CL57Y-V20 driver because the baseline motor and encoder cables are approximately 2 m. The corner-station variant therefore needs protected mounting/routing for:

- a separately protected 48 V and return branch;
- one outdoor STEP/DIR cable and returns;
- short driver-to-motor and encoder cables;
- home/reference wiring;
- optional local enclosure, labels, strain relief, drip loops, and bonding defined by electrical review.

No cable or enclosure may compromise the structural load path, inspection access, drainage, or line clearance. Heavier mounted hardware requires reviewed secondary retention.

## Assembly and inspection

- Inspect timber for cracks, decay, treatment condition, knots at holes, and dimensions.
- Drill with a controlled jig and protect exposed metal and timber as specified.
- Confirm backing-plate seating and prevent local crushing.
- Check pulley freedom, shackle/pin fit, line groove, keeper clearance, and drainage.
- Align the winch only after the station geometry is fixed.
- Mark witness lines or equivalent indicators for movement where useful.
- Reinspect and retighten after settlement and initial operating cycles.

## Acceptance evidence

- Site-specific structural and soil/anchor review for maximum configured load and wind environment.
- As-built dimensions and material/part revisions.
- Controlled proof-load record with calibrated load, directions, duration, quantitative movement limits, and post-test inspection.
- No permanent bracket bending, timber crushing/splitting, bolt movement, pulley binding, or line contact.
- Measured alignment across the full drum travel.
- Inspection schedule and discard criteria for timber, anchors, guys, metalwork, fasteners, keeper, and corrosion.
- Docked-corner variant tested with all dock and parking loads.

A qualified reviewer defines proof loads, directions, durations, sustained-creep
and cycle conditions, measurement accuracy and movement/discard limits from the
approved structural design. No numerical proof factor or operating tension is
assigned by this package.

## Open questions

- Final post section, treatment, embedment, guy, and anchor for the actual site.
- Maximum configured line tension and reviewed proof/creep/cycle procedure.
- Printed material, print orientation/process, conditioning and validated replacement criteria.
- Received BA01090 groove, compatible pin/tang fit, keeper, articulation and fatigue life.
- Corrosion compatibility between galvanized and stainless components.
- Required guard and enclosure mounting without trapping water or hiding damage.
- Whether seasonal timber movement requires scheduled resurvey or automatic calibration checks.
