# Raspberry Pi Camera Module 3 Wide: geometry and official references

The owner confirmed **Wide (120° diagonal FOV)** on 12 October 2026 and reported
that the received camera could not fit the earlier integrated hood or get beneath
its plastic screw mounts. [Proposal #215](https://github.com/gredice/arbi/issues/215)
selects this variant under the stable `raspberry-pi-camera-module-3` BOM ID.
The selected version has the normal IR-cut filter; NoIR is a different selection.
See the [camera pod](../../../../docs/assemblies/camera-pod/README.md) and
[BOM item](../../../../bom/generated/parts/raspberry-pi-camera-module-3.md).

This review identifies published nominal geometry, not measured received-unit
sizes. The [canonical camera reference](../../../lib/raspberry-pi-camera-module-3.scad)
is shared by the Parts illustration r0.1.1 and assembly/booklet. It uses
conservative primitive envelopes; it remains `concept-unvalidated`.

## Official sources

Sources were retrieved and visually inspected on **12 October 2026**, using the
[Raspberry Pi design-files portal](https://pip.raspberrypi.com/categories/1207-design-files).
Portal dates and URL suffixes do not necessarily equal printed revisions.

| Source | Identity and inspected contents | Portal update |
| --- | --- | --- |
| [Wide mechanical drawing](https://pip-assets.raspberrypi.com/categories/1207-design-files/documents/RP-008155-DS-1-camera-module-3-wide-mechanical-drawing.pdf) | RP-008155-DS-1; one page, three views; no printed revision or tolerance block | 6 October 2025 |
| [Standard mechanical drawing](https://pip-assets.raspberrypi.com/categories/1207-design-files/documents/RP-008153-DS-1-camera-module-3-standard-mechanical-drawing.pdf) | RP-008153-DS-1; comparison only | 6 October 2025 |
| [STEP archive](https://pip-assets.raspberrypi.com/categories/1207-design-files/documents/RP-008154-DS-1-camera-module-3-step.zip) | RP-008154-DS-1; `Camera_module_3_wide_model_simple.stp` and `Camera_module_3_std_model_simple.stp`; both imported for solid/bounding-box inspection | 6 October 2025 |
| [Reference schematic](https://pip-assets.raspberrypi.com/categories/1207-design-files/documents/RP-008969-SD-3-Raspberry%20Pi%20Camera%20Module%203%20Reference%20Schematic.pdf) | RP-008969-SD, printed R1; sheet 1 dated 30 June 2025, circuit sheet 2 dated 1 April 2026 | 1 April 2026 |
| [IR-cut Wide sensor-assembly drawing](https://pip-assets.raspberrypi.com/categories/1207-design-files/documents/RP-009995-DS-1-camera-module-3-sensor-assembly-standard-widefov-datasheet.pdf) | RP-009995-DS-1; drawing TNBA2004, A0, P1.0; sensor assembly, not complete carrier PCB | 11 May 2026 |
| [IR-cut normal-FOV sensor drawing](https://pip-assets.raspberrypi.com/categories/1207-design-files/documents/RP-009992-DS-1-camera-module-3-sensor-assembly-standard-normalfov-datasheet.pdf) | RP-009992-DS-1; TNBA1392, A0, P1.0; comparison only | 11 May 2026 |
| [Product specification](https://www.raspberrypi.com/products/camera-module-3/) and [camera installation guide](https://www.raspberrypi.com/documentation/accessories/camera.html) | Variant, envelope, optics, cable and contact-orientation information | Retrieved 12 October 2026 |

Select the `wide` STEP for this camera. Upstream models are named `simple`;
they do not establish manufacturing tolerances. Upstream PDFs/STEP retain their
own rights and are linked rather than redistributed in the public tree.

## Published geometry and coordinate frame

Dimensions are in millimetres. In the drawing's front view, X starts at the left
PCB edge and Y at the edge beside the lower mounting-hole row. The large rear
CSI socket is at the opposite, +Y end; the lower front flex is a different part.

| Feature | Wide drawing | Standard comparison |
| --- | --- | --- |
| PCB outline / thickness | 25 × 23.862 / 1.12 | Same |
| Four mounting holes | Ø2.2; surrounding circular features Ø4.75 | Same |
| Hole centres | (2,2), (23,2), (2,14.5), (23,14.5) | Same |
| Derived hole pitch | 21 × 12.5 | Same |
| Lens centre / sensor housing | (12.5,14.4) / 10.8 square | Same |
| Lens outside diameter | 6.95 | 5.75 |
| Drawing side-view thickness | 12.0 | 11.3 |
| Product envelope | 25 × 24 × 12.4 | 25 × 24 × 11.5 |
| Horizontal / vertical / diagonal FOV | 102° / 67° / 120° | 66° / 41° / 75° |

The centred ARBI frame has its origin at the carrier underside, X along the
25 mm side and lens toward +Z. Holes are X=±10.5, Y=−9.931/+2.569; lens
Y=14.4−23.862/2=**2.469**. Rounded PCB corner radius 2 comes from the STEP.

The original STEP axes map as X=STEP Y−12.5, Y=STEP X−11.931 and
Z=−STEP Z+0.37578. The Z offset puts the STEP lens-facing carrier surface at
ARBI Z=1.12 while preserving the PDF's thicker carrier. STEP carrier thickness
is 0.75692, while the PDF says 1.12; these are not interchangeable tolerances.
The Wide STEP occupies Z=−8.805..2.595 in its original frame (11.4 total);
Standard occupies −7.65..2.595 (10.245 total). PDF/product totals also differ.

The rear CSI connector STEP footprint is **22.92 × 6.54**, centred at ARBI
[0,8.291], larger than the drawing's 19.61 width. The new reference uses the
larger footprint and a 2.75 rear projection. The tall autofocus assembly has
an 8.5 square occupied region in addition to the 10.8 square base and round lens.
The selected Wide model reserves Z=−2.75..9.65, the complete 12.4 product
height, instead of the earlier small cylinder and misplaced rear connector.

The Wide sensor drawing gives focus-dependent axial sizes **7.08 ±0.2 at
infinity** and **7.15 ±0.2 at 10 cm**, a **4.07 ±0.15** body height and
**10.8 ±0.15** square body. Its 0.8 bend-radius statement concerns the small
sensor flex under specified limited-cycle conditions, not the external ribbon
cycling through the gimbal. Complete-module dimensions, connector latch access,
focus extremes and actual cable routing still need received-part inspection.

## Electrical and CSI interface

Schematic sheet 2 shows J1 (`SFW15R-1STE1LF`) to the Pi's 15-contact FPC and
J2 (`DF37NC-30DS-0.4V(51)`) to the sensor assembly. The complete camera uses
**15 contacts at 1 mm pitch**. Pi 3A+ uses a Standard-Standard cable; Pi Zero
and Pi 5 use Standard-Mini. Here “Standard” describes the connector, not FOV.

| J1 pins | Reference connection |
| --- | --- |
| 1,4,7,10 | Ground |
| 2 / 3 | CSI data lane 0, negative / positive |
| 5 / 6 | CSI data lane 1, negative / positive |
| 8 / 9 | CSI clock, negative / positive |
| 11 | ENABLE from Pi CAMGPIO0 |
| 12 | Unconnected in this reference |
| 13 / 14 | I²C SCL / SDA |
| 15 | 3.3 V |

The circuit level-shifts I²C to 1.8 V, supplies local 1.8/2.8/1.1 V rails and a
24 MHz clock; only CSI lanes 0 and 1 reach J1. It is a reference design, not
a production-board netlist or measured power budget. J1 numbering does not
identify the 30-contact sensor interface. Follow the installation guide for
contact orientation and disconnect power before inserting/removing a ribbon.

## Hood, insertion and acceptance

[Integrated hood r0.1.2](../camera-pod-integrated-camera-hood.scad) replaces the
old restricted face with 12.2 mm rounded-square clearance for the complete square autofocus body.
Its rear cavity is 27.8 × 26.6 and the front-to-seat distance is 2 mm shorter.
The four 1.4-thick M2 lands move from Z=10..11.4 to Z=8..9.4; assembly r0.3.9
moves the hood 2 mm rearward, preserving the installed PCB, cradle, bolt and
washer planes. The original four M2 ×12 screws/four nuts/eight washers remain.

Insert the camera **lens first from the open rear**; its PCB front rests **on**
the exposed rear lands. Do not bend the board or tuck it underneath plastic.
Disconnect power and keep the rear CSI connector/latch accessible. Reprint P09
and the black outer head r0.1.5, whose lower opening clears Wide rays;
[the reconciled Wide fit record](../../../../docs/evidence/camera-module-3-wide-2026-10-14.md)
owns insertion, aperture, fastener, optical and motion-check results. Earlier
Standard records and images remain historical evidence for their stated revisions.

After reprinting, inspect seating, screw-head/washer support, cable insertion,
focus, all pan/tilt corners, vignetting, rain paths and actual mass. The Wide
view also requires a new physical camera calibration; old Standard image or
field-of-view calibration is not qualification for this variant.

## Download fingerprints

These SHA-256 values identify the reviewed downloads, not manufacturer approval.
A changed file at the same URL requires another review.

| Download | SHA-256 |
| --- | --- |
| Wide mechanical PDF | `c5f87a9b48d63857fb3d9c0a3deeec797325c56d198c80bcb77a2062e6925b92` |
| Wide sensor PDF | `abec0ec5202996608df9d84ff3997a5f9b4c0a883a103da797f4ddb84ddfccdb` |
| STEP ZIP | `b2e2026ea5322bddf1ddcbae97c094822ee9e0ca92d7bc5c748f60a8b5ef6683` |
| Standard mechanical PDF | `bde27f5ab38dd46aa05713bbb17c6e8acc4cb1d48ff9109df511256f6fbc66ac` |
| Standard sensor PDF | `92cb659c2f825326ad7de5f962aadc8342b82da92624c3a11ad18e623e50ac9c` |
| Reference schematic PDF | `a527a9edc4d2b75f938f0b19d5c33ae1f482beb8e964f4f14260c786025a581b` |
