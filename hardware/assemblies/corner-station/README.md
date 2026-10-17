# Corner station OpenSCAD sources

System context: [Corner station assembly documentation](../../../docs/assemblies/corner-station/README.md).

## Already printed r0.1.0 heads

The [temporary Barton adapter](legacy-pulley-adapter.md) reuses both old
carrier halves with two small socket prints and an extra M8 bolt. Its separate
rounded lug takes the received block's supplied pin, without drilling the
pulley or carrier. The [inspection assembly](corner-head-legacy-adapter-assembly.scad)
shows the old interface and lower pulley position. It is an optional
`concept-unvalidated` fit/hand-routing trial while current r1.1.0 halves are fabricated;
see the instructions for revision identification, print poses, hardware,
35 mm height change and physical test limits.

## Indoor WT-806 stand fixture

The [print and assembly instructions](stand-adapter.md) define removable tube
clamps for the owner's two Walimex pro WT-806 stands. Four fabrication models
install eight prints per stand: two head fronts/rears on a nominal 26 mm tube,
and two winch fronts/rears on a nominal 35 mm tube. The 30 mm section can be
selected with matching exports. The four clamp solids are r0.1.0; the revised head and stand assembly references are r1.1.0,
`concept-unvalidated`; their optional BOM kit is excluded from installed poles.

The [mounting assembly guide](../../../docs/assemblies/corner-station/stand-assembly.md)
and corner support booklet pages 9–14 show part IDs, fastener stacks and the
unpowered trial sequence. The corner pack includes the four current adapter
STLs in `models/stand/print/` and their figure transforms.

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
The front/rear cosmetic covers each use four independent M3 × 12 screws,
washers and captive plain hex nuts; no ties or strap channels remain. These
cosmetic joints are non-structural. The integrated top chord is part of the
load-bearing carrier, not a removable weather roof. The front cover retains a
3 mm fascia and two open-top 18 mm channels for the structural webs. The
[tie-free attachment contract](../../../docs/assemblies/corner-station/tie-free-covers.md)
defines carrier bosses, rear-pad ears and removable cover stacks. The covers
remain open cosmetic shields; drainage and received-fit review remain required.

Carrier halves and assembly are r1.1.0; pads and covers are r0.2.0; the marking
template remains r0.1.0. Reprint all six installed prints as a matching kit.
All are `concept-unvalidated`:

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
Pin-to-sheave distance is owner measured at 42 mm; actual articulation and groove seating remain unverified.
The six fabrication IDs yield six installed
prints per head from five models, plus the one shared marking tool.

The [design package](../../../docs/assemblies/corner-station/design-package.md)
records dimensions, bolt stacks, print process and alternative selection.
[Build instructions](../../../scripts/corner-support/README.md) produce actual
meshes, print poses, booklet, GLB, source/STL ZIP and a hash/geometry report.
The carrier's broad web plane remains parallel to printer XY in the recorded
print transform. Added bosses reach the bed first, leaving the broad web faces
20.5 mm above it; rear-pad ears leave the main pad backplane 14 mm above it.
Review supports beneath both bodies and around lug/boss/ear transitions in the
slicer. Inspect supported surfaces, roots, holes and nut pockets after support
removal; do not assume support-free printing. A bed-fit mesh is not a sliced
or manufactured part. Walls, infill, bonding, shrinkage and the complete print
process remain unqualified.

The carrier and rear-pad STLs are intended printed prototype parts, with
PAHT-CF or tested ASA as unqualified candidates. Structural, anisotropic,
fastener-pressure, sustained-creep, cyclic, outdoor and installed qualification
remain required. The revised 14.8 mm central lug / 5.2 mm bore uses the measured
15.8 mm tang gap and supplied 4.7 mm pin. Reprint both carrier halves; check
actual printed clearances and usable pin/locking engagement. Neither cover is a fitted thin-line
keeper. See the [load-study note](../../../docs/assemblies/corner-station/printed-load-study.md),
[measured Barton nominal checks](../../../docs/assemblies/corner-station/barton-geometry-check.md),
[current cover verification contract](../../../docs/assemblies/corner-station/tie-free-covers.md#nominal-verification-and-physical-evidence) and
[physical acceptance](../../../docs/assemblies/corner-station/acceptance-record.md).

## Historical steel-angle head alternatives

These models and their dedicated BOM items are archived. Sources and earlier
evidence remain traceable, but current parts, quantities and fabrication downloads
use the printed head above.

The six metal-head fabrication models remain r0.1.0; the assembly reference is
r1.0.0 with the measured block. These `concept-unvalidated` alternatives remain
separate from the printed selection. They are not parts of the printed selection:

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

This alternative and its BOM concept pair are archived in favor of the selected
through-bolted printed head. It is excluded from the current parts inventory,
BOM quantities and fabrication downloads.

The [split-clamp proposal and dimensions](pole-pulley-mount.md) define an adjustable
round-pole mount with two removable collar halves and a gusseted pulley clevis.
This remains separate from both through-bolted head designs. Its three
front/assembly models are revision `1.0.0`; the rear remains `0.1.0`. All are
`concept-unvalidated`:

| Model | Purpose |
| --- | --- |
| [pole-pulley-mount-front](pole-pulley-mount-front.scad) | Front half with central rounded lug; fit/mock-up solid |
| [pole-pulley-mount-rear](pole-pulley-mount-rear.scad) | Removable rear half; fit/mock-up solid |
| [pole-pulley-mount-assembly](pole-pulley-mount-assembly.scad) | Assembly with nominal hardware, pole and measured Barton block |

The common [source](../../lib/pole-pulley-mount.scad) starts at a 120 mm pole and
30 mm sheave. Its BOM concept pair is not added to the printed-head quantities.
Friction, timber seating and structural acceptance remain unverified.

## Received block and keeper candidate

The [Barton N01090 measurement/specification record](../../../bom/sourcing/barton-n01090-2026-10-11.md)
links owner photos, catalogue evidence, the [dimension diagram](../../../docs/assets/barton-n01090-dimensions.svg)
and shared [block source](../../lib/barton-size-1-block.scad). The registered
pulley reference is r1.0.0: measured envelope/interface, reconstructed detail
surfaces, no manufacturing or loaded-use approval.

[top-pulley-keeper.scad](top-pulley-keeper.scad) r1.0.0 is a non-structural
candidate reworked around the 36 × 24 mm cheek envelope with 1 mm radial/side
allowance. Two side bridges keep the upper clevis neck clear. Its separate
mounting legs and M5 holes do not define an accepted attachment to the printed
head; it is not installed or counted as completed protection in that package.

The model does not define actual groove/side gaps, full line sweep, attachment
locking, outdoor process or discard limits. Derive a fitted keeper from actual
line and groove measurements, then verify approach angles, slack states,
loaded deflection, service access and retention. A nominal envelope clearance
check does not establish retention of 1.5 mm Dyneema.

## Appearance

The registered [mounted corner reference](corner-station-assembly.scad) places
the current ordinary winch shell, round-pole saddles and proposed printed pulley
head on one nominal 120 mm round timber post. A sinusoidal drawing break omits
the middle post and line length. It is an abbreviated illustration: do not cut
the post or use the displayed vertical spacing as installation dimensions.
The view uses the existing source modules and round-pole coordinate transform;
it adds no fabricated part, quantity or accepted physical configuration.
The closed winch exterior omits concealed internals; use the winch subassembly
for its complete exploded inspection. Powered winch geometry is shown separately.
Actual mounting heights, timber, guy connection, alignment and payout motion
remain subject to the owning design and acceptance records.

Structural carrier and rear pads preview in charcoal; removable protective
covers use rounded warm-white shells following the
[industrial design conventions](../../../docs/project/industrial-design.md).
Bought hardware uses neutral metal coloring. Keep loaded interfaces, pulley,
wear and drainage visible and accessible when covers are removed.

## Approximate BOM visualizations

These `visualization` models retain catalog references, including archived metal-head items. Only current items appear in the active Parts inventory. They are **Unverified** and are not manufacturing sources. Shape is not yet fully defined and needs rework against the selected supplier drawing or measured item before fit or clearance decisions. Nominal dimensions recorded in the catalog remain requirements, not measurement evidence. Threads, connectors, internal construction and fine detail are simplified. Kits and assortments show representative samples, not quantities; cable loops and lengths show samples, not installed routing.

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
| [top-positioning-line-pulley](top-positioning-line-pulley.scad) · [BOM](../../../bom/generated/parts/top-positioning-line-pulley.md) | double-tang block | Owner measured 65 × 36 × 24 mm, 4.7 mm pin, 15.8 mm tang gap, 42 mm centres; catalogue 30 × 12 mm sheave; groove and detail surfaces reconstructed. |
| [top-pulley-bracket](top-pulley-bracket.scad) · [BOM](../../../bom/generated/parts/top-pulley-bracket.md) | angle | Catalog 150 × 40 × 150 mm, 5 mm solid angle; starting drill pattern simplified. |
| [wire-rope-clamp-3mm](wire-rope-clamp-3mm.scad) · [BOM](../../../bom/generated/parts/wire-rope-clamp-3mm.md) | rope clamp | Representative 3 mm wire-rope U-clamp; saddle, threaded legs and overall envelope assumed. |
| [wire-rope-thimble-3mm](wire-rope-thimble-3mm.scad) · [BOM](../../../bom/generated/parts/wire-rope-thimble-3mm.md) | thimble | Representative grooved thimble for 3 mm wire; eye shape and bend radius assumed. |
| [zinc-spray](zinc-spray.scad) · [BOM](../../../bom/generated/parts/zinc-spray.md) | can | Catalog 400 ml can represented by an assumed Ø65 × 200 mm package; can/nozzle dimensions unknown. |
| [corner-head-retention-straps](corner-head-retention-straps.scad) · [BOM](../../../bom/generated/parts/corner-head-retention-straps.md) | ring | Catalog <=2.5 mm strap width and <=1 mm thickness, shown as one assumed circular loop; actual length, latch and installed routing undefined. |
| [corner-head-angle-200](corner-head-angle-200.scad) · [BOM](../../../bom/generated/parts/corner-head-angle-200.md) | angle | Catalog historical 200 × 40 × 200 mm, 5 mm steel angle; illustrative holes and bend are simplified and do not define the proposed drilling pattern. |
| [corner-head-through-bolts](corner-head-through-bolts.scad) · [BOM](../../../bom/generated/parts/corner-head-through-bolts.md) | bolt | Catalog M12 with one representative 180 mm shank and assumed 19 mm hex head; the 160/180/200 mm pair variants, threads and received stack remain undefined. |
| [corner-guy-post-connection](corner-guy-post-connection.scad) · [BOM](../../../bom/generated/parts/corner-guy-post-connection.md) | shackle | Assumed M8 shackle silhouette representing an unselected bought attachment set; post mounting, height, load path and capacity are undefined. |
| [corner-head-printed-hardware](corner-head-printed-hardware.scad) · [BOM](../../../bom/generated/parts/corner-head-printed-hardware.md) | hardware sample | Representative M12 × 190, M8 × 100 and M3 × 12 socket-head bolts with nominal washers and nuts; M3 plain hex nuts AF5.5 × 2.4 and washers OD7 × bore3.2 × 0.5; grade, threads, locking, pulley pin and received stack remain undefined. No ties. |
