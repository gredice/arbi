# Corner station

## Responsibility and boundary

Each of four corner stations reacts positioning-line load and routes one line between the garden span and a separately documented [winch](../winch/README.md). The assembly owns its post, soil/foundation interface, outward guy, guy anchor interface, top bracket, pulley attachment, non-structural line keeper/weather cover, winch mounting envelope, and installed inspection points.

One corner station also supports the [dock](../dock/README.md). Dock loads and clearances must be included in that station's variant.

## V1 starting geometry

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

The intended primary load path is:

```text
positioning line → pulley → shackle/pin → steel angle
→ two M12 through-bolts → timber and backing plates
→ embedded post and outward guy → soil and guy anchor
```

The pod is light, but the horizontal component of configured line tension can dominate post loading. The outward guy opposes the inward Skycam pull so the post is not treated as an unsupported tall cantilever.

Direct embedment without concrete is a conditional concept, not a universal construction rule. Do not install it without site-specific evidence.

## Top pulley

The repository baseline calls for one weather-resistant marine single block per corner for approximately 1.5 mm Dyneema:

- 25–30 mm sheave, with 30 mm preferred;
- approximately 20:1 sheave-to-line diameter ratio at 30 mm;
- bearing suitable for repeated movement, with a ball-bearing block preferred;
- positive side enclosure that prevents the thin line entering a side gap;
- known load rating and suitable groove geometry;
- removable printed keeper that does not carry structural load.

Specific supplier offers belong in the BOM. Two differently described preferred pulley choices currently use the same product URL; verify manufacturer and SKU before selection.

## Drill-only bracket baseline

The current, unvalidated per-post assembly uses:

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

## Printed keeper and weather cover

The removable keeper should:

- keep approximately 1.5 mm Dyneema centered without normal rubbing;
- close hazardous side gaps and reduce derailment during low-tension setup or parking;
- shield direct rain and UV while staying open below for drainage;
- permit inspection and removal without unloading the structural bracket.

ASA is preferred for outdoor use. PETG is prototype-only pending creep, temperature, and weather evidence. The print is expressly non-structural.

## Winch and line alignment

The winch mounts on the same pole face directly below the top pulley, approximately 0.5–1.0 m above ground. Align the incoming drum tangent with the pulley groove so the line runs nearly vertically, without fleet angle or timber contact. The pulley turns the line approximately 90 degrees from the garden span toward the drum.

The station drawing must define the winch mounting interface, guard envelope, service access, cable route, driver enclosure mount, and drainage without owning the winch internals.

## Electronics, cabling, and retention

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

The repository baseline suggests at least the maximum configured line tension, preferably twice it, as a proof-load starting point. The final procedure must be derived from the approved structural design.

## Open questions

- Final post section, treatment, embedment, guy, and anchor for the actual site.
- Maximum configured line tension and proof-load factor.
- Final pulley manufacturer/SKU, groove, attachment, bearing, and fatigue life.
- Corrosion compatibility between galvanized and stainless components.
- Required guard and enclosure mounting without trapping water or hiding damage.
- Whether seasonal timber movement requires scheduled resurvey or automatic calibration checks.
