# Integrated payload rain enclosure r0.1.0

This is a proposed rounded black/white shell for the [payload mount family](payload-mounts.md). It is designed to reduce ordinary rain and splash exposure of the fixed Pi/power electronics, both servo bodies, and the camera rear connector. All models remain **concept-unvalidated**. The shell has downward openings, drainage, an open gimbal aperture and exposed moving interfaces; it has no ingress rating. It does not change the [weather operating policy](../../../docs/operations/weather-parking-and-maintenance.md), dock shelter requirement or physical flight acceptance gates.

![Selected integrated black/white appearance concept](../../../docs/assemblies/camera-pod/enclosure/integrated-concept.png)

The selected illustration records the appearance direction: one rounded white upper body, a black lower core, and a white moving camera cowl. It is an appearance proposal, not a dimensioned CAD render or proof of clearance. The [earlier alternatives](../../../docs/assemblies/camera-pod/enclosure/concepts.png) are retained for design history. The canonical geometry is [payload-enclosure.scad](../../lib/payload-enclosure.scad); [payload-rain-assembly.scad](payload-rain-assembly.scad) is its assembled reference.

![Actual assembled CAD preview](../../../docs/assemblies/camera-pod/enclosure/assembled-cad.png)

This second image renders the actual modeled neutral assembly. Its [CAD check record](payload-enclosure-check.md) and [machine-readable results](payload-enclosure-check.json) identify the inspected geometry and limitations.

## Configuration and print quantities

Choose either the dry bench arrangement with `payload-electronics-cover`, or the enclosure arrangement below. **Do not print or install the old cover under the rain hood.** The camera optical hood remains installed in both arrangements. The original `camera-pod-*` concept gimbal is a separate family and is not combined with this kit.

| Model | Revision | Per enclosed pod | Suggested colour | Change from the dry bench set |
| --- | --- | ---: | --- | --- |
| `camera-pod-spider` | 0.1.0 | 1 | Black | Reuse; no geometry change |
| `payload-electronics-deck` | 0.1.1 | 1 | Black | Reprint: CSI passage and separate tie anchors |
| `payload-spider-spacer` | 0.1.0 | 4 | Black | Reuse |
| `payload-pan-servo-mount` | 0.1.0 | 1 | Black | Reuse |
| `payload-pan-yoke` | 0.1.1 | 1 | Black | Reprint: boot attachment ears |
| `payload-camera-cradle` | 0.1.0 | 1 | Black | Reuse |
| `payload-tilt-pivot-support` | 0.1.0 | 1 | Black | Reuse |
| `payload-horn-retainer` | 0.1.0 | 2 | Black | Reuse |
| `payload-camera-hood` | 0.1.0 | 1 | Black | Reuse optical hood |
| `payload-rain-hood` | 0.1.0 | 1 | White | New fixed upper shell |
| `payload-enclosure-base` | 0.1.0 | 1 | Black | New upper rain tray |
| `payload-pan-fairing` | 0.1.0 | 1 | Black | New removable lower pan shield |
| `payload-tilt-servo-boot` | 0.1.0 | 1 | Black | New moving servo splash shield |
| `payload-camera-cowl` | 0.1.0 | 1 | White | New moving rear camera shield |

This is 18 installed printed pieces. The optional `payload-servo-fit-coupon` is a separate test print and is not installed. `payload-rain-assembly` and `payload-assembly` are reference CSGs, not print parts. The stable BOM owners remain [camera-pod-chassis](../../../bom/generated/parts/camera-pod-chassis.md) and [camera-gimbal](../../../bom/generated/parts/camera-gimbal.md); their fabrication-source lists retain alternatives, not a requirement to print every listed source.

The new shell walls start at 1.2 mm. ASA remains the preferred exposed-release material and PETG is a prototype starting point; neither material/colour choice establishes UV resistance, creep performance, water resistance or thermal acceptance. Slice the complete chosen quantities with the intended nozzle, walls, layers and supports, inspect thin walls and bridging, and weigh the printed assembly. Keep support scars away from mating lips, nut pockets, horn pockets and pivot bores. Print orientation and removable-support access need slicer review before manufacture.

## Fixed body and attachment interfaces

Coordinates below use millimetres in the spider-centred assembly frame: Z points toward the dock and the spider line plane is Z=0. Moving-part coordinates and service paths use neutral pan=0°, tilt=0°, except the lower fairing's removal path, which requires pan=45°, tilt=0°.

- Upper hood: 160 × 86 mm plan envelope centred at X=-3.5, Y=0, 10 mm plan corner radius, lower edge Z=14.8 and roof Z=49.5. A sloped shoulder joins the upper roof. Its roof has no screw openings.
- Upper rain tray: 156.8 × 82.8 mm plan envelope; floor Z=13.2–14.4. The raised lip overlaps inside the hood. The removable lower pan fairing attaches underneath, leaving a narrow horizontal seam in the black core and an open gimbal aperture at approximately Z=-38. Splitting these parts lets them approach the unchanged spider from opposite sides instead of forcing its arms through closed holes.
- Hood, deck and tray share four M3 axes at X=-72 and 65, Y=-32 and 32. Four M3 × 35 bolts enter from underneath, each with one washer at Z=12.7, and engage plain M3 nuts captured in side-loaded pockets at Z=44. Nominal screw tips reach Z=47.7, leaving 0.6 mm below the inner roof at Z=48.3; the represented 2.4 mm nut leaves 1.3 mm tip protrusion. The nut slots face inward for installation with the hood off the assembly; there are no external rain-facing vents at the pockets. No threads depend on printed plastic. Check actual washer, nut and bolt dimensions, nut insertion access, thread engagement and roof clearance before tightening.
- Lower fairing: top at Z=-4.3 below the spider, with four towers through the gaps between arms at [40, 0], [-40, 0], [0, 36], [0, -36] reaching the tray floor at Z=13.2. Four M2 × 25 bolts enter upward at Z=-7.8, with four 0.3 mm lower washers seated against the flange at Z=-7.5 and four nuts on top of the tray at Z=14.4. Nominal screw tips end at Z=17.2, below the deck at Z=17.5. This attachment retains a shield and does not replace the spider's structural fasteners.
- The tray fits around the existing four spider spacers and Pi fastener axes. Frame, Pi, servo ear, horn retainer and pivot fasteners remain as listed in [payload-mounts.md](payload-mounts.md); the shell does not create a new tensile load path or resolve the docking stud interface.

Install the tray from above and the lower fairing from below the spider before the deck, Pi hardware and enclosure clamp bolts. Fit the four fairing bolts and top nuts while accessible. Insert the four hood nuts through their inward side pockets with the hood off the assembly, fit the wiring, then lower the hood onto the raised lip. Tighten its bolts from underneath with the assembly secured and unpowered. Remove those four bolts to lift the hood for electronics service; inspect cables before lifting and do not pull against an attached harness. The overlapping lip and body seam are rain-shield details, not seals.

For secured bench service, park pan at 45° with tilt at 0° before the fairing descends, then isolate the assembly before removing its four fasteners; the towers snag the tilt-servo envelope during a neutral-pan descent. The tested pan=45° path retains the servo boot as an obstacle, so the boot can remain installed. The lower fairing's rigid removal path is checked before routing the incoming harness. Removing a fitted fairing may require disconnecting the isolated incoming lead or feeding its measured service slack; a clear rigid path does not prove removal around an attached harness. Inspect all three outlet routes before lowering the fairing or lifting the tray.

## Moving shields and fasteners

The black tilt-servo boot bolts to the revised yoke at two X-directed M2 axes, Y=-10 and 10, Z=-35, above the camera horn sweep. Use **two M2 × 8 bolts, two washers and two nuts**. Bolts enter toward +X at X=-29.3 with nominal 0.3 mm washers seated against X=-29. It is a removable splash shield, not the servo retention. The spline side remains open and the downward lead relief is open to that side, so the boot can be fitted around an attached servo lead. Confirm the received servo's lead-exit position and boot clearance before use.

Its separate neutral-pose service path removes both M2 fastener stacks, withdraws 20 mm toward -X, lowers 15 mm below the fairing, then continues another 20 mm toward -X. Inspect the lead and available slack before that staged movement.

The white rear camera cowl shares the four camera mounting axes with the cradle and optical hood. Replace the dry bench set's **four M2 × 12 bolts with four M2 × 18 bolts**, retain the existing eight washers and four nuts, and add **four M2 nuts** to retain the cowl on the same protruding screw axes. Secure the optical hood/board/cradle stack first, then the cowl. Four integral Ø5 × 3.4 mm cowl bosses extend from Z=-55.6 to -52.2 and seat on the existing camera nuts' nominal top faces at Z=-55.6; the four additional nuts clamp against the cowl roof at Z=-52.2. This contact completes the represented clamp stack. Measure actual nut height, boss/support contact, thread engagement and screw-tip clearance before tightening; avoid loading the camera PCB or pinching the CSI connector. Its service path lifts approximately 14 mm, then withdraws 45 mm toward -Y in the camera's local frame rather than continuing straight upward past the yoke. The rear cable opening is open to the lower cowl edge so the lip can pass the retained screw shanks. Inspect the attached ribbon, actual driver and nut access on the print; disconnect the ribbon or provide measured slack before service.

Nominal software travel remains pan ±90° and tilt 0–70°; the mechanical range used for checks is pan ±95° and tilt -5–75°. Establish physical limits inside the measured cable and collision envelope. A moving shield adds inertia even when a CAD sweep clears.

## Harness entry, exit and strain relief

The base provides dedicated downward outlets with exterior collars. These dimensions are nominal passage dimensions, not approved connector specifications:

| Route | Base opening and XY centre | Internal path / moving exit | Remaining measurement |
| --- | --- | --- | --- |
| Powered line to fixed converter | Ø8 mm at [-8, 31] | Enter from below, turn outboard above the pan stops, form an exterior drip loop, sleeve the conductors, and secure the sleeve to the deck's separate power tie pad | Received wire/insulation diameter, bend radius, connector envelope and dielectric separation |
| Pi CSI to camera | 24 × 8 mm at [0, -27] | Aligned deck passage is 18.8 × 4.8 mm; route the nominal 16 × 0.3 mm ribbon at Y=-28 within it to clear the Pi post; cowl rear edge opening is 24 mm wide × 9.2 mm high, cut through a 6 mm depth | Actual ribbon width/thickness, end stiffener/connector size, permitted bend radius and fatigue |
| Fixed power/control to servos | 9 × 6 mm at [-22, -32] | Branch to the fixed pan servo and a separate relaxed loop to the moving tilt servo; boot relief opens downward and toward the spline side | Actual bundled leads, servo plug and case lead-exit position |

Keep mating electrical connectors inside the upper body where their measured dimensions permit; do not assume a connector fits through the narrowest slot. Route an unattached ribbon through the passages before closing its connector latches, or enlarge the parametric passage after measuring the received end. The shell does not provide glands or compressed cable seals.

The power opening is near the pan-stop radius in plan. Below the outlet, turn the sleeved incoming lead outboard before it reaches the rotating stop's depth (approximately Z=-21.5 to -31.7). The proposed nominal Ø6 mm route runs from [-8, 31, 24] down to [-8, 31, -14], turns toward [16, 37, -14], descends to [16, 37, -42], then exits outboard toward [16, 60, -42]. The outboard turn is below the fairing tower/fastener and above the pan stops; it must not continue straight down into the stop sweep. These waypoints define a CAD routing proxy, not sharp bends to impose on a real lead: smooth every turn to the received wire's permitted bend radius, fit service slack, and check the entire stop sweep. The local port clearance alone does not establish this exterior harness path.

Give the CSI ribbon and tilt-servo lead **separate relaxed pan and tilt loops**. Anchor the fixed ends on the deck, provide a pan loop to the yoke, then a tilt loop to the camera; keep them clear of horn pockets, servo shafts, hard stops, the optical opening and nut pockets. Use soft wraps rather than a sharp tie pressing directly on the ribbon. Verify the whole movement range with the intended harness installed, including reverse moves and service removal. Minimum bend radii and allowed twist remain received-part questions; a straight nominal routing proxy cannot establish fatigue life.

The positioning line requires an **independent tensile termination** on the spider/line interface. Conductors, connectors, deck ties and enclosure collars must not carry line tension. Downward entries and drip loops must not channel water into the converter, servo case or camera connector. The tray has two 6 × 2 mm downward drain slots at [±40, -40], straddling the lip's inner edge, and the gimbal remains open underneath; inspect that supports, debris and wiring do not block them. Their location is a drainage provision, not proof that rain cannot enter through them.

## Evidence and acceptance boundary

The [28 September geometry record](payload-geometry-check.md) and [booklet revision 2](../../../docs/assemblies/camera-pod/booklet/README.md) describe the earlier dry bench configuration. They do not validate the new shell or the revised deck/yoke. The [7 October enclosure record](payload-enclosure-check.md) separately records 555 sampled motion poses, 20 service paths, 111 nominal power-route poses, clamp/port/tool/optical checks and the revised dry bench regression. Its full-solid PETG calculation is **248.336 g for the 18 installed prints alone**; this does not demonstrate compliance with the 170 g complete-pod ceiling.

The owner reported **103.05 g for the earlier sliced printed parts**. Installed quantities, print settings, supports and actual printed mass have not been independently confirmed. Do not add this number to a new mesh estimate or present it as a measured flying assembly. The complete configured pod still targets **100–120 g**, with a **170 g hard design ceiling**. Weigh all installed prints, Pi, camera, servos, converter, capacitor, horns, fasteners, ribbon, wiring, insulation and any retention before assessing that ceiling.

Before claiming ordinary-rain/splash protection, record the tested part revisions, material, print settings, fitted hardware, angles, duration, water direction/intensity and inspection method. Check wet paths at the lip, nut pockets, spider passages, servo spline, lead exits, camera opening and drain slots. Record drainage and post-exposure drying/condensation. The target is a bounded rain/splash prototype; immersion, pressure washing and an ingress rating are outside this proposal.

Thermal acceptance needs temperatures with the upper shell fitted, at representative ambient conditions and camera/Wi-Fi/servo/converter loads, plus sheltered dock heat soak. White upper surfaces are an appearance/material choice and do not prove sufficient cooling. Physical fit, cable fatigue, electrical isolation, fastener retention, servo torque/settling, flying mass, balance, load capacity, dock clearance and rain/thermal behavior remain separate unverified gates after source checks.
