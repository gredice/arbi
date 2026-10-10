# Corner station OpenSCAD sources

System context: [Corner station assembly documentation](../../../docs/assemblies/corner-station/README.md).

## Indoor WT-806 stand fixture

The [print and assembly instructions](stand-adapter.md) define removable tube
clamps for the owner's two Walimex pro WT-806 stands. Four fabrication models
install eight prints per stand: two head fronts/rears on a nominal 26 mm tube,
and two winch fronts/rears on a nominal 35 mm tube. The 30 mm section can be
selected with matching exports. All five entrypoints are r0.1.0,
`concept-unvalidated`; their optional BOM kit is excluded from installed poles.

| Model | Purpose |
| --- | --- |
| [corner-stand-head-front](corner-stand-head-front.scad) | Curved round-120 head seat, short M12 mounting and front tube clamp |
| [corner-stand-head-rear](corner-stand-head-rear.scad) | Matching removable 26 mm rear clamp |
| [corner-stand-winch-front](corner-stand-winch-front.scad) | Passive winch base seat and front 35 mm clamp |
| [corner-stand-winch-rear](corner-stand-winch-rear.scad) | Matching removable 35 mm rear clamp |
| [corner-stand-assembly](corner-stand-assembly.scad) | Actual printed head and covered passive winch with schematic tube samples |

The fixture uses short bolts and preserves nominal line alignment without
drilling the stand or relying on its top thread. It supports unloaded indoor
fit/rotation development only; tube fit, friction/creep, equipment mass,
independent retention and tipping remain physical acceptance work. See the
[geometry record](stand-adapter-check.md) and
[proposal](https://github.com/gredice/arbi/issues/147).

## Mostly printed through-bolted corner head

The owner selected the [printed design proposal](../../../docs/assemblies/corner-station/design-proposal.md)
for development. Two ribbed carrier halves integrate the front round/square
post adapter and terminal lug. Two rear pads react the M12 washer seats.
Ordinary bought M12/M8 fasteners and a compatible purchased pulley pin complete
the head without a custom metal angle, machined saddles or backing plates.
The front/rear cosmetic covers and two straps are non-structural. The integrated
top chord is part of the load-bearing carrier, not a removable weather roof.
The front cover retains a 3 mm fascia, with sidewall strap passages behind it
and two open-top 18 mm channels for the structural webs. It is an open cosmetic
shield, with drainage and received-fit review still required.

All seven new registered entrypoints are r0.1.0, `concept-unvalidated`:

| Model | Purpose / installed quantity per head |
| --- | --- |
| [corner-head-printed-left](corner-head-printed-left.scad) | Printed left carrier with integrated post seat/web/chord/lug / 1 |
| [corner-head-printed-right](corner-head-printed-right.scad) | Printed right carrier with matching post seat/web/chord/lug / 1 |
| [corner-head-printed-rear-pad](corner-head-printed-rear-pad.scad) | Printed rear post pad / 2 copies, at Z=45/155 |
| [corner-head-printed-front-cover](corner-head-printed-front-cover.scad) | Non-structural front cover with intact fascia and open rib-clearance channels / 1 |
| [corner-head-printed-rear-cover](corner-head-printed-rear-cover.scad) | Non-structural rear nut cover with drains / 1 |
| [corner-head-printed-template](corner-head-printed-template.scad) | Shared 205 mm centre marking tool / 1 per four-head set |
| [corner-head-printed-assembly](corner-head-printed-assembly.scad) | Installed/exploded head with provisional bought-part references |

Parameters live in [corner-head-printed.scad](../../lib/corner-head-printed.scad).
Match `post_shape`, `post_size_mm` and `line_diameter_mm` across all selected
exports. Default is round/120/1.5; round/100/140, square/100 and round/120/4.5
are separately labelled studies. The provisional 45° block pose assumes equal
leg tensions and a horizontal +X span; pin and sheave coordinates differ.
Received pin-to-sheave distance and full articulation remain unverified.
The six fabrication IDs yield six installed
prints per head from five models, plus the one shared marking tool.

The [design package](../../../docs/assemblies/corner-station/design-package.md)
records dimensions, bolt stacks, print process and alternative selection.
[Build instructions](../../../scripts/corner-support/README.md) produce actual
meshes, print poses, booklet, GLB, source/STL ZIP and a hash/geometry report.
Place the carrier's broad web plane in printer XY using its recorded print
transform; local support around lug/boss transitions may be required. A bed-fit
mesh is not a sliced or manufactured part. Check support, walls, infill, bonding,
shrinkage and holes in the slicer and on the prototype.

The carrier and rear-pad STLs are intended printed prototype parts, with
PAHT-CF or tested ASA as unqualified candidates. Structural, anisotropic,
fastener-pressure, sustained-creep, cyclic, outdoor and installed qualification
remain required. The provisional 8 mm lug / 9 mm block tang gap / M8 pin
must be checked against received parts. Neither cover is a fitted thin-line
keeper. See the [load-study note](../../../docs/assemblies/corner-station/printed-load-study.md),
[nominal checks](../../../docs/assemblies/corner-station/geometry-check.md) and
[physical acceptance](../../../docs/assemblies/corner-station/acceptance-record.md).

## Historical steel-angle head alternatives

The original seven r0.1.0, `concept-unvalidated` entrypoints remain unchanged as
separate metal-head alternatives. They are not parts of the printed selection:

| Model | Purpose |
| --- | --- |
| [corner-head-hood](corner-head-hood.scad) | Non-structural metal-angle front weather shield |
| [corner-head-roof](corner-head-roof.scad) | Separate lift-off metal-angle roof |
| [corner-head-rear-cover](corner-head-rear-cover.scad) | Non-structural metal-head rear nut shield |
| [corner-head-front-saddle](corner-head-front-saddle.scad) | Machined **metal** round-post front seating envelope |
| [corner-head-rear-saddle](corner-head-rear-saddle.scad) | Machined **metal** full-width rear seating envelope |
| [corner-head-marking-template](corner-head-marking-template.scad) | Historical 200 mm metal-head marking tool |
| [corner-head-assembly](corner-head-assembly.scad) | Metal-head installed/exploded purchased-hardware reference |

Their parameters live in [corner-head.scad](../../lib/corner-head.scad).
Round/120/200/1.5 uses a 200 mm steel angle and machined metal saddles; the
square/100/150 study retains the historical 150 mm angle. Metal-saddle meshes
are machining/fit envelopes and must not be printed as structural substitutes.
The new `corner-head-printed-*` sources define their own printed geometry,
fastener stack, covers and print poses; never substitute the old saddle STLs.

## Round-pole split-collar alternative

The [split-clamp proposal and dimensions](pole-pulley-mount.md) define an adjustable
round-pole mount with two removable collar halves and a gusseted pulley clevis.
This remains separate from both through-bolted head designs. Its three
registered models are revision `0.1.0`, `concept-unvalidated`:

| Model | Purpose |
| --- | --- |
| [pole-pulley-mount-front](pole-pulley-mount-front.scad) | Front half with integral gusseted arms; fit/mock-up solid |
| [pole-pulley-mount-rear](pole-pulley-mount-rear.scad) | Removable rear half; fit/mock-up solid |
| [pole-pulley-mount-assembly](pole-pulley-mount-assembly.scad) | Assembly with nominal hardware, pole and generic marine block |

The common [source](../../lib/pole-pulley-mount.scad) starts at a 120 mm pole and
30 mm sheave. Its BOM concept pair is not added to the printed-head quantities.
Friction, timber seating and structural acceptance remain unverified.

## Historical `top-pulley-keeper`

[top-pulley-keeper.scad](top-pulley-keeper.scad) is a two-cheek upper guard concept
with nominal semicircular keeper cheeks, mounting legs, fastener holes and
three bridges. It remains `top-pulley-keeper` r0.1.0, `concept-unvalidated`.
Its default 58 mm pulley geometry has not been fitted to the received 30 mm
BA01090 or the printed head.

The model does not define actual groove/side gaps, pin/bearing, line sweep,
installation sequence, locking, outdoor material or discard limits. A fitted
keeper must not rub in normal operation or conceal a derailed/damaged line.
Derive it from received pulley and line measurements and verify all approach
angles, slack states, loaded deflection, service access and retention before
counting it as completed protection.

## Appearance

Structural carrier and rear pads preview in charcoal; removable protective
covers use rounded warm-white shells following the
[industrial design conventions](../../../docs/project/industrial-design.md).
Bought hardware uses neutral metal coloring. Keep loaded interfaces, pulley,
wear and drainage visible and accessible when covers are removed.

## Approximate BOM visualizations

These `visualization` models show catalog items in the Parts inventory. They are **Unverified** and are not manufacturing sources. Shape is not yet fully defined and needs rework against the selected supplier drawing or measured item before fit or clearance decisions. Nominal dimensions recorded in the catalog remain requirements, not measurement evidence. Threads, connectors, internal construction and fine detail are simplified. Kits and assortments show representative samples, not quantities; cable loops and lengths show samples, not installed routing.

| BOM item / source | Shape | Dimension basis and remaining uncertainty |
| --- | --- | --- |
| [corner-post-treated-timber](corner-post-treated-timber.scad) · [BOM](../../../bom/generated/parts/corner-post-treated-timber.md) | box | Catalog alternative of a 100 × 100 mm, 4 m square post; actual timber section and length need a survey. |
| [guy-ground-anchor](guy-ground-anchor.scad) · [BOM](../../../bom/generated/parts/guy-ground-anchor.md) | anchor | Catalog 800 mm starting anchor length with assumed Ø12 mm shaft, eye and helical plate. |
| [guy-turnbuckle-m12](guy-turnbuckle-m12.scad) · [BOM](../../../bom/generated/parts/guy-turnbuckle-m12.md) | turnbuckle | Catalog M12 rod size with assumed 180 mm body; eye, travel and thread details unspecified. |
| [guy-wire-3mm](guy-wire-3mm.scad) · [BOM](../../../bom/generated/parts/guy-wire-3mm.md) | coil | Catalog 3 mm wire represented by a short loop; actual cut length and lay are not modeled. |
| [pulley-bracket-backing-plate](pulley-bracket-backing-plate.scad) · [BOM](../../../bom/generated/parts/pulley-bracket-backing-plate.md) | plate | Catalog 100 × 200 × 2 mm stock plate; shows one plate, with assumed perforations; two are stacked per post. |
| [pulley-bracket-locknut-m12](pulley-bracket-locknut-m12.scad) · [BOM](../../../bom/generated/parts/pulley-bracket-locknut-m12.md) | nut | Catalog M12 locking nut with assumed 19 mm across flats and 12 mm height; thread and nylon insert simplified. |
| [pulley-bracket-shackle-m8](pulley-bracket-shackle-m8.scad) · [BOM](../../../bom/generated/parts/pulley-bracket-shackle-m8.md) | shackle | Catalog 8 mm pin with assumed 32 × 48 mm shackle envelope; exact supplier clearances unverified. |
| [pulley-bracket-through-bolt-m12x160](pulley-bracket-through-bolt-m12x160.scad) · [BOM](../../../bom/generated/parts/pulley-bracket-through-bolt-m12x160.md) | bolt | Catalog M12 × 160 shank; assumed 19 mm hex head and 8 mm head height; threads omitted. |
| [pulley-bracket-washer-m12](pulley-bracket-washer-m12.scad) · [BOM](../../../bom/generated/parts/pulley-bracket-washer-m12.md) | ring | Catalog nominal 37 mm OD, 13 mm ID and 3 mm thickness; edges simplified. |
| [top-positioning-line-pulley](top-positioning-line-pulley.scad) · [BOM](../../../bom/generated/parts/top-positioning-line-pulley.md) | pulley | Catalog preferred 30 mm sheave with assumed cheeks and attachment eye; supplier block envelope unknown. |
| [top-pulley-bracket](top-pulley-bracket.scad) · [BOM](../../../bom/generated/parts/top-pulley-bracket.md) | angle | Catalog 150 × 40 × 150 mm, 5 mm solid angle; starting drill pattern simplified. |
| [wire-rope-clamp-3mm](wire-rope-clamp-3mm.scad) · [BOM](../../../bom/generated/parts/wire-rope-clamp-3mm.md) | rope clamp | Representative 3 mm wire-rope U-clamp; saddle, threaded legs and overall envelope assumed. |
| [wire-rope-thimble-3mm](wire-rope-thimble-3mm.scad) · [BOM](../../../bom/generated/parts/wire-rope-thimble-3mm.md) | thimble | Representative grooved thimble for 3 mm wire; eye shape and bend radius assumed. |
| [zinc-spray](zinc-spray.scad) · [BOM](../../../bom/generated/parts/zinc-spray.md) | can | Catalog 400 ml can represented by an assumed Ø65 × 200 mm package; can/nozzle dimensions unknown. |
| [corner-head-retention-straps](corner-head-retention-straps.scad) · [BOM](../../../bom/generated/parts/corner-head-retention-straps.md) | ring | Catalog <=2.5 mm strap width and <=1 mm thickness, shown as one assumed circular loop; actual length, latch and installed routing undefined. |
| [corner-head-angle-200](corner-head-angle-200.scad) · [BOM](../../../bom/generated/parts/corner-head-angle-200.md) | angle | Catalog historical 200 × 40 × 200 mm, 5 mm steel angle; illustrative holes and bend are simplified and do not define the proposed drilling pattern. |
| [corner-head-through-bolts](corner-head-through-bolts.scad) · [BOM](../../../bom/generated/parts/corner-head-through-bolts.md) | bolt | Catalog M12 with one representative 180 mm shank and assumed 19 mm hex head; the 160/180/200 mm pair variants, threads and received stack remain undefined. |
| [corner-guy-post-connection](corner-guy-post-connection.scad) · [BOM](../../../bom/generated/parts/corner-guy-post-connection.md) | shackle | Assumed M8 shackle silhouette representing an unselected bought attachment set; post mounting, height, load path and capacity are undefined. |
| [corner-head-printed-hardware](corner-head-printed-hardware.scad) · [BOM](../../../bom/generated/parts/corner-head-printed-hardware.md) | hardware sample | Representative catalog M12 × 190 and M8 × 100 bolts with nominal washer/nut samples; grade, threads, locking, pulley pin, straps and received stack are undefined. |
