# WT-806 indoor corner-station adapters

10 October 2026. Revision **0.1.0**, **concept-unvalidated**.
[Design and acceptance issue](https://github.com/gredice/arbi/issues/147).

This optional kit mounts the existing **round-120 printed pulley head** and
**passive winch** on the owner's two Walimex pro WT-806 light stands before the
timber poles arrive. Four removable split clamps grip the straight tubes without
drilling them or loading the small top thread. Use this first for unloaded fit,
line routing and hand-rotation checks. Physical fit and retention have not yet
been demonstrated. It is not an accepted anchor for tensioned cable tests.

## Stand identification and measurements

The owner supplied [Amazon ASIN B000LWEA0I](https://www.amazon.de/dp/B000LWEA0I).
It identifies the Walimex pro WT-806, article 12138. The
[manufacturer's WT-806 manual](https://m.media-amazon.com/images/I/A1PbIZRyiuS.pdf)
lists 35 / 30 / 26 mm tubes from bottom to top, a 5/8-inch spigot and 1/4-inch
top thread, and a 6 kg maximum for centrally placed equipment. Side-mounted
winches and pulley loads are eccentric; **6 kg is not a cable-tension rating or
an accepted load for this fixture**. The manual records a 94 cm footprint;
the [manufacturer's current set listing](https://www.walimex-online.de/en/studio-photography/studio-tripod/lamp-stand/walimex-pro-set-of-4-wt-806-lamp-tripods-256cm)
lists 108 cm. Measure the received stand instead of using either number for
stability calculations. Sources checked 10 October 2026; these are published
nominal dimensions, not an inspection of the two owned stands.

Before printing, measure each stand's tube outside diameter at both planned
rows, including ovality. The default head clamps fit the nominal **26 mm upper
tube**; the default winch clamps fit the nominal **35 mm lower tube**. The 30 mm
middle tube can be selected parametrically when a straight section is more
accessible. Each pair of rows must lie on one constant-diameter tube, away from
the factory collars, levers, tube transitions, leg hub and spigot. Head rows need
160 mm of exposed straight tube (110 pitch + two 25 mm end margins); winch rows
need 170 mm (120 pitch + margins). Confirm room to fit and remove nuts and a
wrench. Do not remove the factory collars or springs to gain space.

## Print list for the two stands

Export one part per STL at **100% scale, millimetres**. Print four copies of each
model for two complete stand kits; one stand uses two of each. These are small
individual adapters, not a tall printed replacement pole.

| Registered model | Per stand | Two stands | Default tube | Print envelope, mm |
| --- | ---: | ---: | ---: | --- |
| [corner-stand-head-front](corner-stand-head-front.scad) | 2 | 4 | 26 | 50 × 102 × 89.6 |
| [corner-stand-head-rear](corner-stand-head-rear.scad) | 2 | 4 | 26 | 50 × 102 × 22.6 |
| [corner-stand-winch-front](corner-stand-winch-front.scad) | 2 | 4 | 35 | 50 × 102 × 114.6 |
| [corner-stand-winch-rear](corner-stand-winch-rear.scad) | 2 | 4 | 35 | 50 × 102 × 27.1 |

The shared [parametric source](../../lib/corner-stand-adapter.scad) exposes
`head_tube_diameter_mm`, `winch_tube_diameter_mm`, `tube_clearance_mm` (default
0.3 mm on diameter), and `split_gap_mm` (0.8 mm total). Export both matching
halves with identical values. The closing gap allows the halves to grip after
taking up the nominal clearance; a CAD bore does not establish clamping force.
Change the diameter parameter rather than scaling the STL, which would change
bolt spacing and line alignment. The 26–35 mm interval is a dimensional study,
not a compatibility claim for other stands.

PETG is a starting material for the indoor prototype. Start with 0.20 mm layers,
six walls, 50% infill and eight top/bottom layers; record the actual filament,
drying, temperatures, slicer and orientation. Both halves export with their
flat clamp split face on Z=0. Enable build-plate supports beneath the forward
head pad and winch mounting plate, and inspect those rib bridges in the slicer.
Keep nut/washer access and all bores free of support, burrs and debris. Do not
force a tight clamp onto the tube. Measure holes and printed bores, and inspect
for poor bonding or cracks before assembly. These settings assign no strength
or sustained-load rating.

```bash
mkdir -p hardware/generated/corner-stand
openscad -o hardware/generated/corner-stand/corner-stand-head-front-r0.1.0.stl hardware/assemblies/corner-station/corner-stand-head-front.scad
openscad -o hardware/generated/corner-stand/corner-stand-head-rear-r0.1.0.stl hardware/assemblies/corner-station/corner-stand-head-rear.scad
openscad -o hardware/generated/corner-stand/corner-stand-winch-front-r0.1.0.stl hardware/assemblies/corner-station/corner-stand-winch-front.scad
openscad -o hardware/generated/corner-stand/corner-stand-winch-rear-r0.1.0.stl hardware/assemblies/corner-station/corner-stand-winch-rear.scad
```

Use OpenSCAD 2021.01, as pinned in the registry. For example, add
`-D 'head_tube_diameter_mm=30'` to **both** head exports for a measured 30 mm
section. The optional BOM item is `corner-stand-adapter-kit`, quantity two for
this bench batch; it adds no installed pole hardware or material-price claim.

## Bought hardware

Lengths below are measured under the head. Use metal washers and locking nuts;
do not print fasteners. These are nominal stacks requiring received inspection.

| Item | Per stand | Two stands | Use |
| --- | ---: | ---: | --- |
| M6 × 60 bolt | 4 | 8 | Two per default 26 mm head clamp |
| M6 × 70 bolt | 4 | 8 | Two per default 35 mm winch clamp |
| M6 flat washer, nominal 12 OD × 1.6 | 16 | 32 | Both ends of every clamp bolt |
| M6 locking nut, nominal 6 thick | 8 | 16 | Clamp bolts |
| M12 × 90 bolt | 2 | 4 | Head into adapter, replacing M12 × 190 timber bolts |
| M12 large washer, nominal 37 OD × 3 | 4 | 8 | Both ends of each head bolt |
| M12 locking nut, nominal 12 thick | 2 | 4 | Head bolts |
| M8 × 40 bolt | 4 | 8 | Winch's existing four mounting holes |
| M8 flat washer, nominal 16 OD × 1.6 | 8 | 16 | Both ends of each winch bolt |
| M8 locking nut, nominal 8 thick | 4 | 8 | Winch bolts |

Reuse each head's two carrier-joining M8 cross-bolts, measured compatible pulley
pin and pulley. Retain both printed carrier halves. Omit the timber rear pads,
long M12 through-bolts and rear cosmetic cover. The first fit/rotation setup also
omits the front cosmetic cover, so fasteners and line contact remain visible.
Any later cover retention needs a separately inspected strap route on this
fixture; the stock timber strap loop is not a stand retention method.

Clamp bolt length is `ceil((tube diameter + 20 + 3.2 + 6 + 3)/5) × 5` mm:
60 / 65 / 70 for 26 / 30 / 35 mm tubes. This gives at least 3 mm nominal thread
projection past the 6 mm nut. Head stack is 32 mm carrier + 37 mm adapter + two
3 mm washers + 12 mm nut = 87 mm, leaving 3 mm with M12 × 90. Winch stack is
8 mm aluminium + 16 mm adapter + two 1.6 mm washers + 8 mm nut = 35.2 mm,
leaving 4.8 mm with M8 × 40. Inspect full locking-zone engagement, tool access
and all tips after any substitution. Do not use pole-length bolts here.

## Assembly and nominal alignment

The adapter frame has +X toward the span, +Y across it and +Z up the stand.
Tube axis is X=Y=0. Each printed part has its mounting row at Z=0 before the
print transform. Use two identical adapters per interface; do not mirror them.

1. Spread and lock the tripod legs on a level floor, add appropriate base
   ballast, keep the stand low and secure secondary retention to an independent
   stable support. Follow the WT-806 manual when handling its spring-loaded
   telescopic sections. Support equipment while positioning it.
2. Place two head front/rear pairs around a measured straight upper tube, with
   their M12 centres **110 mm apart vertically**. The curved front pads point
   toward the intended span. Insert each M6 bolt from the rear with a washer;
   add the front washer and locking nut. Alternate tightening gently until the
   clamp grips. No torque value is established: stop for face bottoming,
   printed cracking, a tube dent, or a factory lock that no longer operates.
3. Assemble the stock round-120 head's carrier halves and cross-bolts. Attach
   through its Z=45/155 holes using the short M12 bolts. Put a large washer
   under the head and behind each adapter's flat nut seat. The rear seat has
   open wrench access between the webs, ahead of the stand tube. Seat the
   curved pads evenly; confirm the pulley pin and block articulate freely.
4. Place the two winch pairs around a measured lower tube, with row centres
   **120 mm apart**. Point their flat plates in the same +X direction as the
   head. Fit and inspect their M6 clamps before adding the winch. Bolt the
   passive base through its original **50 × 120 mm** pattern using four short
   M8 bolts, two washers and one locking nut each. Access the rear nuts through
   the 26 mm rib pockets; support the winch independently during assembly.
5. Check both adapters for slip and rotation, all factory locks and the stand
   footprint. Weigh the complete mounted equipment. Even a mass below the
   published central-load maximum does not establish acceptance of this
   eccentric arrangement. Independently support the winch if its mass or
   moment is unsuitable for the stand. Isolate electrical power for the first
   checks and secure/de-tension the line before any adjustment.
6. Align using a plumb reference through the pulley groove and the drum payout
   point. Turn the drum by hand through its travel with a loose line; inspect
   fleet angle, rubbing, bolts and covers. Record witnesses at every clamp and
   factory collar and recheck them after each trial. Remove equipment before
   moving the tripod or changing telescopic height.

The head's virtual 120 mm post centre lies **30 mm forward of the stand axis**.
The winch aluminium front face is **123 mm forward**, and its rear mounting
face is 115 mm. With the canonical passive drum, the nominal vertical line
centre is **253.3 mm forward of the stand axis** on both assemblies. This is
the payout tangent, not the head attachment pin or sheave centre. The
[reference assembly](corner-stand-assembly.scad) uses the actual head and
covered passive winch sources, with schematic disconnected tube samples.
Its example elevations are not a measured WT-806 setup or proof that factory
collars/legs clear the equipment. Physical line alignment across the full drum
travel remains an inspection item.

## Check scope and acceptance still required

The [geometry record](stand-adapter-check.md) and
[reproduction script](../../../scripts/corner-support/check-stand-adapter.py) check
meshes, print envelopes, all three nominal tube sizes, fastener clearance,
stock-head/base fit and nominal payout alignment. Source compilation and
collision checks do not measure clamp friction, print anisotropy, tube crushing,
creep, tipping, dynamic cable loads or actual equipment mass.

Record both stand IDs, measured tube diameters/straight lengths, print process,
CAD revisions, received bolt/washer/nut sizes, equipment mass, footprint,
ballast/independent restraint and slip/rotation observations in issue #147.
Stop for visible movement, loosened locks, cracking, dents or line contact.
No allowable cable tension or unattended operation is assigned. Any powered,
tensioned or suspended trial needs independent restraint, measured limits and
a reviewed stage-specific procedure under the existing
[commissioning gates](../../../docs/operations/prototype-and-commissioning.md#local-safety-and-update-gates).
Two stands support development of two station interfaces; they do not supply
the four independently accepted anchors required for the flying system.
