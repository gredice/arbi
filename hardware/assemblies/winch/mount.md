# Drum and winch mount

Status: **concept-unvalidated**, revision **0.1.0**, PLA inspection prototype.
The [development proposal](mount-development.md) records scope; the
[drum guide](README.md) defines compatible printed drum parts, revision 0.1.0.
The contextual drum reference is now revision 2.1.0 because bearing inner-ring
spacers were added. No physical fit, powered run or structural qualification has
been performed. ASA is a later, separately inspected and tested process.

## Models and print quantities

| Entrypoint | Per winch | Four winches |
| --- | ---: | ---: |
| [Bearing lower](winch-bearing-lower.scad) | 2 | 8 |
| [Bearing cap](winch-bearing-cap.scad) | 2 | 8 |
| [Motor stand](winch-motor-stand.scad) | 1 | 4 |
| [Coupling cover](winch-coupling-guard.scad) | 1 | 4 |

The same prints fit either drum width. [winch-mount.scad](winch-mount.scad) is
an assembly/drilling reference, not one printable object. Set `powered=true`
for the long variant; `show_drum=false` exposes the supports and base holes;
`show_guard=false` exposes the coupling. Shared dimensions are in
[the mount library](../../lib/winch-mount.scad).

## Evidence and adjustable interfaces

The existing BOM kit is `4-CLYS30-V20`. The manufacturer's
[kit page](https://www.omc-stepperonline.com/ys-series-4-axis-closed-loop-stepper-cnc-kit-v2-0-3-00nm-424-83oz-in-nema-23-motor-w-2-0m-cables-power-supply-4-clys30-v20),
accessed 2026-09-08, identifies `23HS40-5004D-E1000`, a 57 × 57 mm frame,
122 mm body and 8 mm shaft projecting 22 mm. These values define the motor
context; the received kit revision still needs a physical match.

The linked dimensional SVG and full datasheet could not be retrieved (unsupported
web content type; direct download returned HTTP 403). Accordingly **47.14 mm bolt
pitch and 38.1 mm pilot are explicit NEMA23 starting assumptions**, not verified
measurements from that motor drawing. The model exposes their parameters and uses
5.5 mm mounting slots and a 38.6 mm pilot clearance, with ±2 mm vertical travel.
Inspect the received motor's hole type and flange thickness before selecting its
four screws; M4×25 through-screws/nuts are only a procurement allowance. Do not
assume blind threaded holes or force a screw into the motor.

608 dimensions remain the BOM's 8 × 22 × 7 mm. The split housing seat is 22.2 mm
in diameter and 7.2 mm axially; outer-ring retaining lips are 1.5 mm thick with
an 18.4 mm center opening. A 0.4 mm initial split gap permits gentle take-up.
Two M5 cap screws engage accessible metal nuts; no threads rely on plastic.
Seat clearance is a trial parameter, not a proven bearing fit. Excess cap force
can distort the bearing or crack the housing; verify free rotation after tightening.

Both shaft collars now bear through nominal steel **8.2 ID × 11 OD × 2 mm**
spacers. Confirm that their contact annulus lies wholly on the actual inner ring
and clears its chamfer and seals. Printed substitutes are not specified. Set
collars with slight free axial endplay; do not preload the two bearings by forcing
collars together. The slotted supports allow alignment before securing the base.

## Coordinates, base and clearance

X follows the shaft from the left flange toward the motor; Y lies across the
base; Z points outward from its front face. On a bench, Z is up; on a flat post,
Y is vertical and Z points away from the timber. The shaft center is Z=80 mm.
The 128 mm flange therefore clears the base by 16 mm; its outgoing tangent is
approximately 130 mm from the base front for the nominal 100 mm core.

Let W be winding-body width. Relative to the left flange at X=0:

| Quantity | Passive | Powered |
| --- | ---: | ---: |
| W | 246.9 mm | 570.3 mm |
| Bearing centers X | -5.5 / 284.4 mm | -5.5 / 607.8 mm |
| Bearing center span | 289.9 mm | 613.3 mm |
| Motor front face X | 339.9 mm | 663.3 mm |
| Motor back face X | 461.9 mm | 785.3 mm |
| Base blank L × width × thickness | 550 × 180 × 8 mm | 880 × 180 × 8 mm |

The base blank is aluminium, beginning at X=-50, Y=-90, Z=-8; it is **unquoted
stock and an unvalidated thickness assumption**, not a printed beam or a verified
structural plate. Cut edges require finishing. Eight nominal Ø7 mm support holes:

- Left bearing: X=-21.5, Y=±40.
- Right bearing: X=W+53.5, Y=±40.
- Motor stand: X=W+113 and W+155, Y=±44.

The lower bearing prints have their long feet facing outward: mirror the entire
right lower about X in the assembly reference, physically achieved by rotating
an identical print 180° about Z. The cap is symmetric. The reference rotates the
complete drum 180° about its own axis before the
Z-to-X rotation for visibility. Clearance does not depend on drum angle: the
pedestal stem sits behind the projecting tie rods, and its compact upper housing
fits inside their full revolution envelope. Lower slots allow ±5 mm
axial adjustment and motor slots ±6 mm. Set bearing alignment with the shaft,
then align the motor; the flexible coupling must not pull misaligned supports
into position. Washers must bridge slots. Shim bases as needed after measuring.

Four Ø9 mm post holes at X=W/2±25, Y=±60 give a centered 50 × 120 mm pattern.
The proposed flat-post stack uses four M8 through-bolts and a 100 × 180 × 4 mm
steel backing plate per winch. Keep them separate from the top pulley bracket.
This is a drilling proposal for nominal 100 mm timber, not evidence of post/plate
strength or adequate edge distances. A round post needs a shaped adapter before
this flat plate can be fitted. The large powered cantilever and existing long
8 mm shaft remain unresolved load cases; see [shaft screening](drum-geometry-check.md).

## Assembly and hardware

Per winch, in addition to the existing bearings, collars, shaft and drum hardware:

- Eight M6×30 base bolts, eight locking nuts and sixteen washers (8 mm printed
  foot + 8 mm plate; check actual washer stack and nut engagement).
- Four M5×35 cap screws, four ordinary M5 hex nuts and four washers. Slide nuts
  into the side windows before installing caps; their pockets are sized for plain
  nuts, not tall locking nuts. Establish a compatible screw-locking method on the bench.
- Four motor screws with nuts/washers as required by the received motor flange.
- Four M4×20 coupling-cover screws, four locking nuts and eight washers.
- Two steel inner-ring spacers and one aluminium base; four M8×160 post bolts,
  four locking nuts, eight large washers and one steel backing plate for the
  proposed nominal timber stack. Actual timber can change required bolt length.

These are recorded under `winch-mount-hardware`, a separate unquoted BOM
allowance for all four winches. The existing assortment is not assumed to cover
these sizes. Aluminium/steel contact treatment, grades and outdoor corrosion
protection need selection before an outdoor build.

Install caps loosely, assemble shaft/bearings/spacers, then align and secure
supports. Set collars without bearing preload. Offer the motor with its screws
loose, align its axis and coupling engagement, then secure the stand and motor.
The coupling envelope is still the ordered part's nominal Ø20 × 25 mm; a 10 mm
engagement at each end leaves 5 mm between shaft tips in this layout. Confirm
actual jaw/spider clearances and locking-screw access. The two shafts must not touch.

Fit the removable coupling cover last. It has 4 mm walls and an open underside
and axial ends; it is a local cover, **not complete entanglement protection or
an outdoor enclosure**. It can be removed without disturbing shaft alignment.

## Print and next checks

Exported parts sit on Z=0. Lower bearings and the motor stand print on their feet;
caps print on their split face; the coupling cover prints on its motor-facing
flange. Start PLA at 0.2 mm layers with a 0.4 mm nozzle and six walls; inspect
slicer support for bearing lips, nut-window roofs, pilot opening and horizontal
holes. Use removable supports where the slicer needs them. These settings do not
provide a load rating. Print one lower/cap and the motor stand first to check fit.

Check the [geometry evidence](mount-geometry-check.md), then physically inspect
bearing seats, screw/nut access, rod fit/straightness, flange clearance, motor
alignment and free rotation. Inspect motor temperature and printed-part creep
before any endurance test. ASA must repeat fit and load/cycle checks.

Full-travel line guidance, the complete drum/weather guard, homing actuator,
slip-ring support/strain relief and field structural qualification remain open.
A stationary eye close to either wide drum would create a substantial fleet
angle; this model does not pretend that a simple eye solves line management.
Do not operate a loaded powered winch on the strength of these CAD checks.
