# Removable charcoal dock underside

15 October 2026. **Nominal CAD candidate; physical acceptance pending.**

The lower enclosure extends the [selected dock appearance](rounded-shelter.md)
with a continuous charcoal bowl beneath the warm-white crown. It conceals the
locator and upper guide attachment from side views while leaving the lower
flared guide and downward capture mouth exposed. It is a
removable cosmetic shelter, separate from the pod-retention load path. The
current guide, locator, fork, stud, bridge and arm retain their interfaces.

## Geometry and print inventory

Four cardinal panels meet at the 45/135/225/315 degree cable axes, with 18 mm
edge-open radial passages. Print three
`dock-lower-panel` pieces for 0/90/270 degrees and one
`dock-lower-rear-panel` for 180 degrees; both are revision `0.1.0`. The rear panel
faces the post and includes the arm/fork opening. The roof quadrants and
assembled reference become revision `0.3.0`; the guide remains `0.2.0` and stud
`0.1.1`. Reprint four white roof quadrants and add these four charcoal panels.
Inspect the retained prints and received hardware before reuse.

In the existing dock frame, the tapered body runs from Z105–171 with outer
diameter 140–283 mm. The nominal wall is 2.8 mm normal to the slope, formed by
a 4.128 mm radial inset. At Z105 the inner opening is approximately Ø131.744
versus the guide's nominal Ø126.636 outer diameter, giving about 2.55 mm radial
separation before faceting, print tolerance or deflection. The rounded 300 mm
R40 top tray occupies Z171–174, has a Ø148 center opening and ends 1 mm below
the white roof skirt at Z175. The enclosure must not become a rubbing surface
or a second stud locator.

The rear panel has a 70 mm wide opening, local Y=-35–35, from Z118 through
the tray top. It clears the arm and manual fork route; remove the rear
panel for complete hand/tool access. Open cable seams and the rear opening
also leave runoff, air and inspection paths. They do not create an ingress
rating or demonstrate wind-driven rain protection.

Use the supplied print-coordinate meshes: rotate the cardinal sector 45
degrees about Z, then turn the top tray onto the bed by 180 degrees about X.
Review the full slice, support contact/removal and the actual printer envelope;
inspect the thin wall, tray, lip, cable seams, rear opening and bolt holes.
The nominal bed check does not establish support-free manufacture.
The exported ordinary and rear panel print poses each occupy approximately
185.496 × 185.496 × 69 mm before supports, brim and other slicer exclusions.

## Dedicated fastening

Each panel has two dedicated M3 × 25 socket-head bolts, two Ø7 × 1 mm washers
per bolt and one DIN 985 locking nut per bolt. The nominal nut dimensions are
M3, 0.5 mm pitch, 5.5 mm across flats and 4 mm high, from the
[supplier's DIN 985 drawing](https://www.intafast.com/wp-content/uploads/2019/11/DIN985_NYLON_INSERT_NUT_LOW.pdf)
checked on 15 October 2026. This is a dimensional reference, not a selected
supplier offer or proof of received-part fit. One dock adds eight bolts,
sixteen washers and eight locking nuts, bringing the provisional
bought-hardware set to 132 pieces.
These fasteners retain only the appearance enclosure. Do not remove the
M4 guide/carrier or roof/carrier/arm fasteners to service a black panel.

The eight axes are (+/-141,+/-60) and (+/-60,+/-141) in dock coordinates.
The nominal upward stack is Ø5.5 × 3 mm bolt head Z167–170, lower washer
Z170–171, panel tray Z171–174, roof boss contact at Z174, upper washer
Z185–186 and locking nut Z186–190. The M3 × 25 bolt bears at Z170 and ends
at Z195, leaving approximately 5 mm beyond the nut. Ø16 roof bosses extend
Z174–193 and directly contact the panel tray; there is no gap inside the
clamped contact stack. The 1 mm perimeter shadow gap remains between the
panel top Z174 and the white outer skirt Z175, away from these contacts.

Roof bosses incorporate side-loaded captive nut pockets. Measure the
received head, washer, nut and locking-zone envelopes; inspect full locking
engagement, the pocket restraint and tool access. Printed bosses and captive
pockets require material/process, pull-through and creep evidence. No torque
or retention force is inferred from screw diameter or nominal projection.
The nominal nut pocket has 6.9 mm circumdiameter, with a 5.9 mm wide ×
4.2 mm high entry. Review as-printed clearance and anti-rotation restraint.

## Installation and service

Keep the dummy independently supported throughout this unloaded bench
procedure. Fit the rear panel at 180 degrees and ordinary panels at
0/90/270 degrees, preserving open cable seams, rear arm clearance and the
downward guide mouth. Install their dedicated fasteners only after checking
the assembled gaps and nut pockets.

For removal, undo the panel's two dedicated M3 bolts and remove their two
lower washers. Keep every other panel's bolts/lower washers fitted, and leave
all upper washers and locking nuts in the roof pockets; they are fixed
obstacles during withdrawal. Support the panel and use its sampled nominal path:

- Ordinary panel: move 110 mm outward horizontally in its cardinal direction,
  then lower 100 mm.
- Rear panel: move 60 mm toward the post, lower 20 mm, move another 50 mm
  toward the post, then lower another 80 mm. Its cumulative displacement is
  110 mm outward and 100 mm down. The intermediate drop clears retained M8
  arm-lap hardware; a straight outward rear move is obstructed.

The generated mesh check passes these discrete poses; it does not prove
continuous or physical clearance. Do not pull a panel straight down around
the flared guide. Remove the
rear panel before manually working on the fork or inspecting the enclosed
core. Reverse the checked path to install and inspect all fits afterward.

Remove all four black panels before the existing roof service procedure:
slide the eight upper washers and eight nuts inward out of the now-accessible
roof pockets, then independently support dummy and locator and remove
roof-stack/seam hardware. Lift one white quarter 60 mm and translate it
inward 100 mm along its
diagonal. Roof service changes the shared carrier/arm fastener stack; black
panel service does not. These procedures do not authorize loaded or installed
service, nor establish actual hand, harness or sloping-line clearance.

To reassemble, reverse the roof procedure, insert upper washers/nuts into the
accessible pockets with black panels absent, fit the panels and install their
bolts/lower washers. Do not require hidden upper nuts to be removed before
withdrawing a panel.

The white crown now prints mounting-seat down from its Z174 boss contacts;
support planning must include the perimeter one millimeter above that plane.

## Nominal stationary dead load

The exported ordinary panels have 86.435493 cm³ solid volume each; the rear
panel has 54.244505 cm³. Three ordinary panels plus one rear panel total
313.551 cm³. The [fabrication catalog](../../../bom/catalog/fabrication.json)
assigns PETG Matte at 1.37 g/cm³ to the charcoal panels and white crown.
These are solid CAD estimates before slices, supports or measured prints.

The rear opening removes material asymmetrically. Combining the actual
installed panel meshes gives a lower-enclosure center of mass at
X=+11.253671 mm, Y=0, Z=158.701054 mm. Its gravity lever from the post face
is therefore 0.401254 m, rather than the dock axis's 0.390 m. Four identical
white quarters remain symmetric about the dock axis. With
`g=9.80665 m/s²`, calculate grams as `volume×density`, convert to kilograms,
then use `moment=mass_kg×g×lever_m`:

| Stationary appearance parts | Solid volume | Estimated mass | Gravity lever | Post-face moment |
| --- | ---: | ---: | ---: | ---: |
| Prior rounded crown `0.2.0` | 367.132 cm³ | 502.971 g | 0.390 m | 1.924 N·m |
| Current crown `0.3.0`, four quarters | 392.062 cm³ | 537.125 g | 0.390 m | 2.054 N·m |
| Four charcoal lower panels | 313.551 cm³ | 429.565 g | 0.401254 m | 1.690 N·m |
| Added bosses and lower panels | 338.481 cm³ | 463.719 g | Component-specific | 1.821 N·m |

The prior geometry/recipe is from source commit
`b3bdd81a8bd8ca16a1e53eba17b8820208571650`. This estimate excludes the new
eight bolts, sixteen washers and eight nuts, retained spacers/hardware,
arm, pod, cable tensions, wind, contact and service forces. It records one
LC-05 contribution, not an allowable load or proof of arm/post capacity.
Use actual slices/materials and all reviewed forces before physical load
testing or installation.

## Nominal evidence and remaining acceptance

The 15 October 2026 local generator run passed **54,082 nominal geometry
checks** for DOCK-IF-01, non-powered round-120, with the independently
supported dummy configuration. OpenSCAD `2021.01` exported thirteen connected,
watertight fabrication meshes and their checked print poses. The canonical
dock library SHA-256 for this record is
`7d3a8e5251cef8fc9409373bb50c6dd38fb7456012bd32737b75354273f8bd32`.
The generated `geometry-report.json` preserves registry, entrypoint, library,
source and mesh hashes plus the exact installed transforms.

- Ordinary panels pass 22 sampled poses each: 0–110 mm outward in 10 mm
  increments, then 10–100 mm down at full outward displacement. The rear
  panel passes 24 poses, with the 20 mm intermediate drop sampled in 5 mm
  increments. Only its own bolts/lower washers are absent; all other panels,
  upper washers/nuts, structural hardware, represented pod, post and four
  Ø1.5 mm lines from Z=-200–800 remain fixed obstacles.
- Upper washer/nut insertion and reverse extraction pass at 30/20/10/5/2/1/0
  mm from their seats, with black panels and dedicated bolts removed. Local
  Ø5 × 80 mm axial driver envelopes beneath all eight bolt heads clear the
  represented assembly. This does not establish hand or complete tool access.
- Three ordinary-panel sections at Z115/135/160 measure 2.7902/2.7989/2.8098
  mm normal wall thickness; the sampled tray is 3 mm. Seven crown/skirt
  sections remain 2.8000–3.1734 mm. These values apply only to those sections.
- Existing roof-quarter service, fork travel, the 0.2 mm flat-shoulder gap and
  full represented pod release pass their nominal regressions. Roof service
  first removes all black panels and their dedicated hardware, then samples
  60 mm upward and 100 mm inward against the retained core and long lines.

Deliberately obstructed controls produce positive mesh intersections:

| Control | Intersection volume |
| --- | ---: |
| Closing a lower cable seam | 11.902 mm³ |
| Closing the rear arm window | 7,544.278 mm³ |
| Lowering a panel before outward withdrawal | 517.737 mm³ |
| An incomplete circular washer pocket | 6.028 mm³ |
| Straight rear withdrawal into retained M8 lap hardware | 274.154 mm³ |

The existing closed-fork, uncut-guide and closed-roof-slot controls also
remain positive. These control volumes demonstrate detection of the modeled
obstructions; they are not contact areas, forces or physical damage results.

The [booklet builder](../../../scripts/dock-booklet/README.md) and its independent
ZIP checker own regenerated meshes, nominal collision checks, print poses,
hardware stacks, service samples and control failures. Exact volumes, mesh
identities and check results are recorded in the generated pack. Nominal
source consistency remains separate from physical acceptance.

The kit remains **concept-unvalidated and restricted to an independently
supported dummy**. Review the actual slices/materials, extra wind and dead
load, fastener/pocket strength, print creep, rain/runoff/condensation, service
access and full line/harness sweep through the [bench plan](bench-test-plan.md)
and [acceptance record](acceptance-record.md). Automatic capture, actuator,
observations, complete pod mass and all-line power-loss restraint remain
separate unresolved gates.
