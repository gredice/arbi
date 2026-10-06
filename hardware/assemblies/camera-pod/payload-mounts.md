# Payload bench mount set r0.1.0

This is a proposed, unbuilt mount set for the existing r0.1.0 spider. The stock Pi 3A+, Camera Module 3 Standard, and two 3.7 g servo architecture is unchanged. All models remain `concept-unvalidated`. The model coordinates and hardware are assembled by `scripts/payload-booklet/integration.py`; the booklet uses exactly those transforms.

The set adds a Pi/power deck, four removable spider spacers, a pan servo mount, pan yoke, supported camera cradle, two stock-horn retainers, camera hood, and removable electronics cover. A separate servo fit coupon checks the assumed 20 x 8.5 mm body and 24 mm lug-hole pitch before the full print. It does not test output-axis position or horn geometry; those must also be measured.

## Interfaces

- Existing spider: four M4 clearances on a 22 mm radius, 45-degree phase (31.113 mm square).
- Deck: 14 mm printed spacers above the spider; Pi underside 10 mm above the deck. Pi 58 x 49 mm hole pitch, M2.5 fasteners.
- Camera: 21 x 12.5 mm hole pitch; four M2 through bolts. Camera backside stands 4 mm off its carrier; lens faces down at zero tilt.
- Servos: provisional body 20 x 8.5 x 18 mm, mounting ears 27 mm long, 24 mm screw pitch, output axis offset 5 mm. Body windows add 0.4 mm clearance per side. Body-window dimensions are parameters; a different case/lug/shaft height also needs revised stack coordinates in the CAD and assembly definition, not just a wider window. Use two M1.6 x 6 countersunk through bolts and nuts per servo; heads seat flush in the lug plate and nuts sit on the outer side of the ears. Pan screws enter upward from below, with nuts above the ears; tilt screws enter from the inner face, with nuts outside the ears. Do not force the bolts into a smaller supplier ear hole.
- Stock horns: provisional 8 mm round hub, one 12 mm arm, 2 mm hub / 1.5 mm arm thickness. Pockets are 8.6 mm / 4 mm wide, 2.2 mm deep. Retainer rib captures the arm; use the servo's original center screw. Never print a spline. Rework the parametric pocket if the supplied horn differs; it must have no perceptible free play.
- Tilt pivot: M3 through bolt, 0.7 mm shim in the 0.7 mm side gap, plain nut in an open-top capture slot. The opposite support is removable so the cradle can slide onto the stock horn. Adjust for free rotation and retain the nut with suitable thread locking; clamp-up/creep and wear require physical testing.
- Converter: provisional 45 x 25 mm PCB, 2 mm support pads; two insulated ties across clear PCB strips, not solder joints. Capacitor: provisional 10 mm can, loose 10.6 mm cup with a lead opening. Add an insulating sleeve and secondary tie to the can.
- Incoming wire: two tie slots on the deck secure an insulating sleeve. This does not replace an independent line tensile termination.
- Nominal software travel: pan -90..90 degrees, tilt 0..70 degrees. Printed stops are designed for pan +/-95 and tilt -5..75. Do not drive powered servos against the stops.

## Print quantities

| Model | Quantity |
| --- | ---: |
| Existing camera-pod-spider r0.1.0 | 1 |
| payload-electronics-deck | 1 |
| payload-spider-spacer | 4 |
| payload-pan-servo-mount | 1 |
| payload-pan-yoke | 1 |
| payload-camera-cradle | 1 |
| payload-tilt-pivot-support | 1 |
| payload-horn-retainer | 2 |
| payload-camera-hood | 1 |
| payload-electronics-cover | 1 |
| payload-servo-fit-coupon | 1 test piece, not installed |

PETG is a starting material for a dry bench prototype. Use 0.2 mm layers and at least 3 walls; solid small spacers/retainers and mount bosses. Deck and spacer exports sit flat. Complex servo/yoke/cradle parts need removable supports; keep support scars out of the horn pockets and pivot bores. Ream only clearance holes to the documented size. Weigh all sliced/printed parts before considering suspension; the existing spider and this complete mount set may exceed the original flying mass budget.

## Limits

This set supplies an assembleable bench mechanical arrangement for compute, power and pan/tilt imaging. It does not supply the unresolved load-rated line terminations or docking-stud interface. The electronics cover and camera hood are splash shields, not a waterproof enclosure. Servo, converter, capacitor, connector and ribbon dimensions need comparison with received hardware. Ribbon routing and fatigue, physical motion, servo torque, load capacity, balance and mass remain unverified.

## Assembly and fastener access

Install pan and tilt servo ear screws before engaging the horns. Capture each stock horn with a printed retainer and countersunk M2 screws; use no washer under a countersunk head. For pan use M2 x 10, for tilt use M2 x 8. Both use a washer and nut behind the carrier. The nominal 1 mm clearance to each servo body depends on fully recessed heads. Socket-head substitutions failed the motion sweep.

The camera board is offset 5 mm from the tilt axis. This leaves an access bore for the OEM horn screw without crossing a camera bolt. Seat the cradle on the tilt spline while the opposite support is removed, install the OEM screw from inside the cradle, then fit the camera board and hood. Drop the M3 pivot nut into its top-access pocket and install the removable support with two M2 x 12 bolts, four washers and two nuts. Add the M3 pivot screw and shim last.

Frame: four M4 x 35, eight washers, four plain nuts. Pi: four M2.5 x 20, eight washers, four nuts. Camera/hood: four M2 x 12, eight washers, four nuts. Cover: four M3 x 35, eight washers, four nuts. The pivot takes one M3 x 12, a 0.5 mm outer washer and a 0.7 mm shim. Refer to the booklet for the complete stack order.

A 15 mm long, 2 mm diameter straight driver-tip envelope reaches the retainer screws at neutral. This is a short-tool check, not proof that every screwdriver handle or wrench fits. The camera centre screw is reached before mounting the board. The cover comes off vertically after its four bolts are removed.

## CAD evidence

See [geometry check](payload-geometry-check.md), [machine-readable results](payload-geometry-check.json), and the [assembly booklet](../../../docs/assemblies/camera-pod/booklet/README.md). Sampled rigid motion, intentional spline engagement, service paths, optical volume and the mass limitation are recorded separately. This record does not change the concept-unvalidated status.
