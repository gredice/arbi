# Camera pod fastener standardization

Design proposal: [#225](https://github.com/gredice/arbi/issues/225).

Status: proposed interface revision; nominal CAD and physical acceptance are separate.
Owning assembly: [camera pod](README.md). The existing
[compact enclosure](../../../hardware/assemblies/camera-pod/camera-pod-enclosure.md)
is the starting configuration. This proposal does not change the dry bench kit
or the dock-owned bridge and stud.

## Problem and available stock

The owner requested fewer screw variants on 15 October 2026. Available M3
lengths are 4, 5, 6, 8, 10, 12, 16, 20 and 25 mm; some M2 screws of 4, 6 and
8 mm are also available. Head styles, quantities and actual head/nut dimensions
have not been supplied. The current pod has ten bought screw variants and
35 screws, plus two servo-supplied centre screws.

## Interface limits

- Camera Module 3 Wide has manufacturer-specified Ø2.2 mm PCB holes. Keep M2;
  do not enlarge the camera PCB for M3.
- The Pi reference uses nominal Ø2.75 mm PCB holes, not a measured 3A+ hole
  diameter. M3 is not a supported direct substitution. Use M2 with washers
  and captive nuts in the printed posts; inspect board seating and retention.
- The received converter has owner-reported Ø3 mm holes. That is not an M3
  clearance specification. Use M2 without modifying the received board.
- Servo ears retain the current M1.6 × 6 countersunk screws; their nominal
  Ø1.7 mm holes and OEM shaft threads are independent of the printed mounts.
- The stock horn centre screws remain supplied-servo hardware.

Source evidence: [Pi review](../../../hardware/assemblies/camera-pod/raspberry-pi-3a-plus/README.md),
[Wide-camera review](../../../hardware/assemblies/camera-pod/raspberry-pi-camera-module-3/README.md),
[received converter](../../evidence/buck-converter-2026-10-12.md) and
[servo record](../../evidence/micro-servo-2026-10-12.md).

## Proposed joint changes

1. Integrate the four 14 mm spider spacers into the compact electronics deck.
   Load M3 nuts and washers into side pockets in these posts. Preserve the
   spider, electronics and servo heights, and use four M3 × 25 frame screws.
   Reducing diameter alone cannot make the old 35 mm frame stack accept 25 mm.
2. Move the enclosure's four captive M3 nuts 10 mm downward, retaining the
   existing screw axes, closed roof and driver approach. Use M3 × 25.
3. Enlarge the four head-clamp bores, bosses, washers and captive nut channels
   for M3 × 12. Move the support attachments to Y=±9 mm on 26 mm pads;
   this clears their larger washers/nuts from the central leg. Retain the existing M3 × 12 opposite pivot and its 0.7 mm shim.
4. Fit M2 × 8 Pi screws into captive nuts below the PCB seating lands. Recess
   the converter's lower washer/nut seats for M2 × 8. Preserve board positions
   and the converter's 2 mm supports; electrical isolation remains unverified.
5. Reverse the four camera joints: M2 × 8 screws enter from rear cradle head
   recesses into captive front nuts in the white hood. Omit camera washers;
   both metal bearing faces contact printed seats rather than the PCB. This
   avoids enlarged rear nut seats crowding the CSI connector. Preserve all
   PCB and optical datums. Reprint both cradle and white hood.
6. Keep M2 at the horn retainers: their 1.2 mm plates and nominal 1 mm
   servo clearance require flush heads. Use M2 × 8 countersunk screws for both.
   Recess the pan carrier's lower seats by 0.4 mm for nominal thread projection. A socket
   head is not interchangeable with the required flush countersunk head.

## Target installed list

| Screw | Quantity | Use |
| --- | ---: | --- |
| M3 × 25 socket/cap reference | 8 | Four frame, four enclosure |
| M3 × 12 socket/cap reference | 7 | Four head clamps, two support attachments, one pivot |
| M2 × 8 socket/cap reference | 12 | Four Pi, four converter, four camera |
| M2 × 8 countersunk | 4 | Two pan and two tilt horn-retainer clamps |
| M1.6 × 6 countersunk | 4 | Two ears per servo |
| OEM servo centre screw | 2 | One supplied screw per stock horn |

The target eliminates M2.5 and M4 from the compact pod, but reduces variants,
not the number of joints: 35 bought screws remain. Actual availability of
12 ordinary and four countersunk M2 × 8 screws must be reconciled with stock.
The integrated deck replaces four loose spacers, so the target is 12 installed
prints rather than 16. Replacement prints and revisions must be recorded in
the registry, fabrication inputs and regenerated booklet together.

## Alternatives and acceptance

Retaining the present baseline requires M2 × 12, M2.5 × 10/20 and 35 mm screws.
Direct M3 substitution would interfere with the PCB bores and would not solve
the long frame/enclosure stacks. PCB drilling and reliance on printed threads
are excluded from this proposal. Retaining separate frame spacers with two
short screws per spacer would increase screw count and joints.

Validate canonical-source compilation, mesh connectivity, nominal head/washer/
nut clearance, insertion/removal paths, driver access, complete gimbal travel,
and deliberately incorrect hardware controls. Regenerate BOM reports and
fabrication evidence from the final sources. Do not reuse old CAD acceptance
records as evidence for the new joints.

Physical inspection must establish actual hardware fit and thread engagement,
PCB support without bending, isolation, print layer strength, captive-pocket
retention, frame/clamp preload and creep, pivot freedom, full harness travel,
servo loads and complete pod mass. Smaller frame screws and integrated printed
posts require renewed mechanical acceptance; source checks do not establish
load capacity or authorize suspended operation.

## Washer and nut inventory

| Item | Quantity | Nominal dimensions, mm | Use |
| --- | ---: | --- | --- |
| M2 flat washer | 20 | Inside Ø2.2, outside Ø5, thickness 0.3 | Eight each for Pi/converter; four horn-retainer nut sides |
| M3 flat washer | 25 | Inside Ø3.2, outside Ø7, thickness 0.5 | Eight each for frame/head, four support, four enclosure, one pivot |
| M3 pivot shim | 1 | Inside Ø3.2, outside Ø7, thickness 0.7 | Opposite tilt-pivot side gap |
| Plain M2 nut | 16 | M2; reference across flats 4, height 1.6 | Board and horn-retainer stacks |
| Plain M3 nut | 15 | M3; reference across flats 5.5, height 2.4 | Frame, enclosure, head, support and pivot |
| Plain M1.6 nut | 4 | M1.6; reference across flats 3.2, height 1.28 | Retained servo ears |

These are simplified CAD envelopes, not supplier-certified dimensions. No
washer goes below a countersunk head. Keep the 0.7 mm pivot shim distinct from
the 0.5 mm M3 flat washers. Check actual heads and plain-nut pocket fit; locking
nuts are not automatically interchangeable. The separate dock bridge/stud
still requires its own M3 × 30 and M4 × 100 hardware; it is not covered by this
compact-pod stock redesign.

The camera rear head bearing plane is at canonical cradle Z=-61; the front
hood nuts occupy Z=-68.12 to -66.52 in that same frame. A nominal M2 × 8
screw projects 0.88 mm beyond the nut. The cradle recess is Ø4.2 mm; verify
the actual screw head before assembly. Front nut tunnels have 4.4 mm across
flats; load the M2 nuts before seating the camera in the hood.

Camera service uses rear screw insertion with 10 mm initial lift and an
8 mm straight driver-tip envelope after removing the outer head and upper
stack. This proves local rigid access only; check the actual short hex key
or driver, handle and wrist access on the supported bench.

## Replacement prints

Reprint integrated deck, carrier, outer head, camera cradle, opposite pivot
support and white optical hood at r0.2.0, and upper rain hood at r0.3.0. Retain
the spider, pan servo mount, two horn retainers and tray r0.2.3; omit all four
loose spacers. The optional servo coupon is not an installed part.

The integral deck has posts on both faces. Its export places the four frame
post ends on the bed; use a starting brim/support plan checked in the slicer,
including support beneath the deck spans. Review pocket-roof bridging and
removal through the open slots. These are starting print instructions, not a
validated orientation/profile; the former flat-deck setup does not apply.

## Local nominal verification

The [15 October source/mesh record](../../evidence/camera-pod-stock-fasteners-2026-10-15.md) identifies passing checks for 144 registered models, all 555 motion poses, 30 service paths, 24 tool envelopes, nut engagement and PCB interference controls. The generated sixteen-page manual and paired source/STL pack were checked together. Physical reprint/hardware acceptance remains pending.
