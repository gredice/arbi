# Dock bench assembly guide

DOCK-IF-01 assembles the split guide, locator/fork, structural pod attachment,
support arm and rounded shelter on a restrained bench fixture with a supported
dummy. Roof quadrants and the assembled reference are revision `0.3.0`;
lower panels are `0.1.0`, guide quadrants `0.2.0` and the flat-shoulder stud
`0.1.1`. Locator/fork and bridge interfaces
retain their current revisions.
**Concept-unvalidated; no suspended or automatic operation.**

The illustrated ten-page PDF and matching print/source ZIP are published as
[CAD-release artifacts](booklet/README.md). Read the
[design package](design-package.md), [bench plan](bench-test-plan.md) and
[acceptance record](acceptance-record.md) before testing. The BOM owns quantities;
[hardware sources](../../../hardware/assemblies/dock/README.md) identify every
current entrypoint. Historical funnel/nest and pod-stud files are excluded.

Replace four white roof quadrants with revision `0.3.0`; add three ordinary
lower panels and one rear lower panel at `0.1.0`. The current guide quadrants
`0.2.0` and stud `0.1.1` remain compatible. Existing arm, rear pad, locator,
fork, bridge, shoe and spacer prints remain revision
`0.1.0`; inspect fit, damage and hardware stacks before reuse. The changed
crown dead load and wind area require a renewed LC-05 arm/post review.

## Select the configuration and print files

The owner selected a **non-powered corner** with the corner support's shared post
radius. Published nominal pack: round-120, radius 60 mm, dock axis 450 mm from
post center / 390 mm from front face. Measure the actual post and mounting rows;
do not treat this default as a survey. Shared 100–140 mm round parameters exist
in source, but other configurations need regenerated checks, stacks and records.

Use `models/print` for individual printing and `models/arbi` for installed
coordinates. `models/reference` is context, including the actual current pod;
never print that context as a dock part. Each part individually fits a nominal
256 mm cube with 5 mm XY edge reserve. Brim, supports, purge and exclusions are
outside that bound. Confirm the user's actual printer and the full sliced preview.

The arm root lies on a wide web face; each roof quadrant prints mounting-seat
down from its dedicated Z174 boss contacts. The perimeter at Z175, hollow
rounded crown and integral bosses need support planning. Lower panels print
top-tray down after 45-degree Z and 180-degree X rotations in the supplied
print meshes. Review supports for the guide overhangs, bridge top links and
locator flange/fork channel too. Inspect support contact/removal without
damaging the 2.8 mm skin, access pockets or seam tabs. These print poses do not
assert support-free manufacture.
The stud prints head down on its Ø24 face; plan supports beneath the elevated
Ø32 flange and inspect the flat head bearing face, Ø4.5 axial bore and washer
seat after support removal.

Record material/lot, drying, printer, nozzle, plate, enclosure, orientation,
walls/infill, supports, layer height and temperatures. Inspect layers, flatness,
critical bores, guide surfaces and the sliced root webs/stud/bridge. PETG costing
is a solid-volume estimate, not a validated load-bearing print prescription.

## Inventory for one dock

| Printed item | Quantity |
| --- | ---: |
| Guide quadrant | 4 |
| Locator carrier / sliding fork | 1 / 1 |
| Pod bridge / lower shoe / axial-bolt stud | 1 / 4 / 1 |
| Arm root / extension / rear pad | 1 / 1 / 2 |
| Roof quadrant / 49 mm roof spacer | 4 / 4 |
| Ordinary lower panel / rear lower panel | 3 / 1 |

The pod bridge, shoes and stud are dock-owned parts fitted to the pod. Do not
count them again in the camera-pod fabrication recipe. The following bought
set is a nominal sizing proposal with no selected supplier or quoted price.

| Bought hardware | Quantity |
| --- | ---: |
| M12 × 190 through-bolt / large washer 37 × 3 / locking nut | 2 / 4 / 2 |
| M8 × 50 arm-lap bolt / washer / locking nut | 2 / 4 / 2 |
| M4 × 100 roof/carrier/arm bolt | 4 |
| M4 × 50 guide bolt | 4 |
| M4 × 100 stud through-bolt | 1 |
| M4 washer / locking nut | 18 / 9 |
| M3 × 30 bridge clamp bolt | 8 |
| M3 × 16 roof-seam bolt | 4 |
| M3 washer / locking nut | 24 / 12 |
| M3 × 25 lower-enclosure socket-head bolt | 8 |
| M3 lower-enclosure washer, Ø7 × 1 mm | 16 |
| DIN 985 M3 lower-enclosure locking nut, 4 mm high | 8 |

One spring assortment and two microswitches remain BOM allowances. Spring
product/force, switch mounts/targets/circuit and stationary release actuator are
unselected. This kit provides **manual supported insertion/release**, not passive
automatic capture. Do not connect an unreviewed observation to control authority.

## 1. Assemble the arm on a restrained bench post

1. Support the fixture and dummy independently. Mark dedicated dock rows at
   root-frame Z=45 and 155 mm (110 mm pitch); measure the actual post. Survey existing
   corner head, guys, lines and head-cover removal space before deciding real
   site elevations, bolt rows or drilling. Do not reuse corner-head rows.
2. Fit the arm root to the +X post face and two rear pads at those rows. Stack:
   M12 head → large washer → root → timber → rear pad → large washer → locking
   nut. Round-120 sizing is 120 + 28 + 14 + 6 + 12 = 180 mm before bolt projection;
   M12 × 190 leaves 10 mm nominally. Recalculate against measured seats/hardware.
3. Place extension over the root lap and join with two M8 × 50 bolts at X=260/280 mm,
   two washers and one locking nut each. Nominal lap stack 30 mm + washers 3.2 + nut 6.5 mm
   leaves 10.3 mm projection. Inspect full locking engagement and at least two threads.
4. Seat locator flange on the platform at Z=150 mm. Its body passes through the
   70 mm opening. Roof/carrier/arm fasteners share axes (+/-40,+/-40) in dock frame.
   The final roof bolts retain this stack; keep the locator supported until fitted.

Derive the tightening procedure from reviewed printed/timber contact and creep;
no torque is invented here. The clamp cannot establish post/arm strength.

## 2. Fit guide and sliding fork

1. Install four identical guide quadrants rotated 0/90/180/270 degrees. The guide mouth
   is Z=65 mm, throat Z=120 mm; mounting tabs occupy Z=115–120 mm.
2. At four (+/-30,+/-30) axes, fit M4 × 50 bolts through guide tab 5 + arm
   platform 30 + locator flange 6 mm. Use two washers and locking nut each;
   inspect seam steps and the guide-to-locator transition.
3. Insert the fork from -X into its 5.2 mm channel. Its 4 mm plate runs at
   Z145.6–149.6. Closed 17 mm slot clears the 14 mm stem; the 24 mm head has 3.5 mm ideal overlap per
   side, reducing to 2.5 mm on the smaller side at 1 mm center offset. This is a
   nominal dimension calculation, not qualified retention area or strength.
4. With independent dummy support, retract 40 mm toward the post, raise the
   stud until the head reaches the Z=160.8 mm upper stop, then close the fork. Keep
   the dummy supported. The flat stud underside at Z149.8 has a nominal 0.2 mm
   unloaded gap to fork top Z149.6; controlled seating closes that gap. This is
   nominal geometry, not a qualified bearing/contact or load result. For release,
   support/unload first, retract 40 mm and lower.

Do not push a suspended head through a closed fork or assume spring return,
anti-backdrive or automatic capture. Test these as separate mechanism development.

## 3. Fit the pod-side structural attachment

1. Use the current 230 mm spider / 22 mm arms / 7 mm plate. Place the bridge feet
   at radius 90 mm on 45/135/225/315 degree diagonals, with the fixed hood clear inside them.
2. Fit one lower shoe around each arm width and eight M3 × 30 bolts. Use two
   washers and one locking nut per bolt; inspect arm crushing and shoe cheeks.
   Inspect the nominal 0.5 mm cheek-to-upper-foot gap so preload reaches the
   spider plate; reject an as-printed stack that bottoms on the cheeks.
   Arm-width capture is positive; radial retention depends on clamp friction.
   Witness-mark it and test slip/creep or revise to an accepted positive stop.
3. Fit the stud flange to bridge top Z=75 mm using an axial M4 × 100 bolt, two washers
   and locking nut. Measure bolt-tip/head envelopes and verify the underside
   tip clears the real hood/electronics. Dock loads must bypass the cosmetic hood.
4. Weigh bridge, four shoes, stud, all added fasteners and complete configured pod;
   record center of gravity. The solid CAD attachment alone is about 95 cm³ / 119 g
   at the costing PETG density, before metal hardware. Actual slicing may reduce
   that estimate but does not establish mass. The complete pod's 170 g ceiling
   remains a gate; this candidate is restricted to a supported dummy.

The mesh check uses the current neutral assembled pod. Gimbal motion, harness,
line attachment hardware, actual print shrinkage and swept approaches need their
own measurements. Nominal bridge clearance does not qualify the structural joints.

## 4. Fit roof and inspect line corridors

1. Place four 49 mm roof spacers at (+/-40,+/-40), from Z=156–205 mm.
2. Fit four identical roof quadrants rotated 0/90/180/270 degrees. Use four M4 × 100 bolts
   through roof boss, spacer, carrier flange and arm; two washers and locking nut
   each. The underside Ø11 platform recesses put washer seats at Z125 and
   locking nuts at Z120–124; do not place the washer below the platform face.
   Verify engagement against the received roof/head/washer/nut stack.
3. Join the four seams with four M3 × 16 bolts, two washers and locking nut each.
   Check the Z203 seam axes, extended tabs and crown alignment, roof bosses
   and drainage without live electronics. The Ø11 upper pockets put roof-bolt
   washers at Z215 and bolt heads at Z216; inspect actual tool access and stacks.
4. Guide and roof have nominal 18 mm radial passages at the four radius 104 mm
   line axes, open to the outer edges from radius 95 mm. They clear a synthetic
   vertical 1.5 mm pose only. Surveyed sloping
   lines, approach motion, powered-line conductors and wind/pendulum movement
   can require different openings; review those swept envelopes before integration.

The 300 × 300 mm R40 crown has a nominal 2.8 mm hollow skin, skirt bottom
Z175 and apex Z220. Open passages and seams have no accepted weather/IP
rating. Preserve inspection access, optical access and runoff away from the pod.

For roof service, remove all four lower panels first using section 5. Then
slide the eight upper enclosure washers and eight nuts inward from their
now-accessible roof pockets. Independently support the dummy and locator before removing
all four seam and all four roof-stack bolts with their washers/nuts. Keep
guide/carrier fasteners fitted. Lift one quarter 60 mm, then slide it 100 mm
inward along that quarter's diagonal so the line exits its outer slot. Reverse
to install. Recheck every fastener stack and the complete assembled pose
afterward. The builder samples this path against all four full-height vertical
line probes; it does not model continuous motion, sloping lines, the harness or
hands. This is an unloaded bench procedure requiring physical acceptance.

## 5. Fit and service the removable charcoal panels

1. With the dummy supported, fit the rear panel at 180 degrees toward the post
   and ordinary panels at 0/90/270 degrees. Preserve the open diagonal cable
   seams, rear arm/fork opening and downward guide mouth. The Z105–171 tapered
   walls must remain clear of the existing guide.
2. Insert the nominal upper washers and DIN 985 nuts into the crown's side-load
   pockets. Fit two M3 × 25 socket-head bolts per panel, with one Ø7 × 1 lower
   washer per bolt. The panel tray ends at Z174 against the dedicated roof boss
   contact; the white perimeter ends at Z175, leaving its 1 mm shadow gap.
   There is no open gap inside the clamped contact stack.
3. Check head Z167–170, lower washer Z170–171, tray Z171–174, upper washer
   Z185–186 and locking nut Z186–190. Bolts bear at Z170 and end at Z195,
   with 5 mm nominal nut projection. Inspect received locking engagement,
   pocket fit/anti-rotation and local tool access. Do not infer a torque or
   strength limit from these nominal dimensions.
4. For supported, unloaded service, remove the panel's two M3 bolts and their
   two lower washers. Keep other panels' fasteners fitted and all upper
   washers/nuts in the roof pockets. For an ordinary panel, move 110 mm outward
   horizontally in its cardinal direction, then lower 100 mm. For the rear
   panel, move 60 mm toward the post, lower 20 mm, move another 50 mm outward,
   then lower another 80 mm: cumulative 110 mm outward and 100 mm down. The
   staged rear path clears retained M8 lap hardware at the sampled nominal
   poses. The pack's checks do not establish continuous or physical clearance.
   Do not pull
   straight down around the flared guide. Remove
   the rear panel for complete manual fork/core access. Keep the structural
   M4 guide/carrier and roof/carrier/arm fasteners installed during panel service.

Reverse the checked removal path to install. Recheck shell gaps, cable seams,
rear clearance and all fasteners. See [lower-enclosure details](lower-enclosure.md)
for the dedicated nominal stack, print poses and remaining load/weather gates.
Remove all black panels before roof service. No loaded or installed service
permission is implied.

Only after panels are clear, slide the upper washers/nuts inward out of the
pockets for white-quarter service. Reverse this order when rebuilding the
roof and panels.

## 6. Record supported bench results

Run the declared DT01–DT12 stages in order, recording every trial and failure.
Start with fit, manually supported insertion/release, fork travel and false seating.
Review fixture restraint, load directions, force limits and stop conditions before
applying load. Do not infer limits from CAD volume, infill or bolt diameter.

Remaining acceptance includes mass/CG, structural and radial clamp retention,
load/creep/impact/cycling, spring capture and actuator/circuit, independent physical
observations, line/harness sweep, weather and manual recovery. All-line clearance
through driver disable and total/partial power loss is a separate LS18 gate;
retaining the pod does not prove that the four lines remain safely high.
