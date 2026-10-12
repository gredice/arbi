# Raspberry Pi 3 Model A+ sources and geometry

Owning assembly: [camera pod](../../../../docs/assemblies/camera-pod/README.md).
Catalog item: [raspberry-pi-3a-plus](../../../../bom/generated/parts/raspberry-pi-3a-plus.md).
ARBI visualization: [OpenSCAD entrypoint](../raspberry-pi-3a-plus.scad), revision
`0.2.0`, role `visualization`, geometry `drawing-derived`, engineering status
`concept-unvalidated`. The Parts page identifies it as an official drawing
reference with physical fit unverified.

## Official source review — 12 October 2026

The following PDFs were downloaded successfully from Raspberry Pi's
[Product Information Portal](https://pip.raspberrypi.com/categories/512).
All relevant drawing pages were rendered and inspected. This is a document
review, not a received-board measurement or physical fit acceptance. The
portal's 6 October 2025 update dates do not identify board design revisions.

| Official source | Identity and use |
| --- | --- |
| [Board mechanical drawing][board] | Portal document RP-008330-DS-1, one sheet; board outline, mounting positions, corner radius and connector Z-height labels. No visible drawing revision/date title block. |
| [Dimensioned board drawing, 2018][board-2018] | RP-008328-DS-1; title block `RPI-3A+_V1-0`, 13 July 2018; explicitly dimensions the mounting pitch. |
| [Reduced schematic][schematic] | RP-008332-DS-1; `RPI-3A+`, revision 1.0, 6 February 2019, sheet 1 of 1; connector and power-circuit reference. |
| [Product brief][brief] | RP-008331-DS-1, published April 2024; electrical specification on page 3 and dimensioned physical specification on page 4. |
| [Official case drawing][case] | RP-008329-DS-1; geometry of the separate Raspberry Pi case, not the bare board or ARBI enclosure. |

The [official schematics and mechanical-drawings index][index] lists PDF
schematic, board and case drawings for the 3A+. No 3A+ STEP or DXF file was
listed in that index or product portal at review time. A community CAD model
would need its own provenance and dimensional comparison.

## Published mechanical dimensions

All dimensions below are millimetres. The board's populated face is viewed from
above, with GPIO along the upper 65 mm edge and USB on the right. For this
document, X runs right and Y runs up from the lower-left PCB bounding corner.

| Feature | Published value | Basis / limit |
| --- | --- | --- |
| PCB outline | 65 × 56 | Both board drawings and product brief |
| Mounting-hole centre inset | 3.5 from adjacent edges | 2018 drawing and product brief |
| Mounting-hole centre pitch | 58 × 49 | Explicit in 2018 drawing; also derived from outline and insets |
| PCB corner radius | 3 | RP-008330 drawing |
| GPIO header Z-height label | 8.5 | Both board drawings |
| CSI and DSI connector Z-height labels | 5.5 | Both board drawings |
| HDMI Z-height label | 6.5 | Both board drawings |
| Audio/video jack Z-height label | 6 | Both board drawings |
| USB Z-height label | 7.0 / 7.1 | RP-008330 / 2018 drawing respectively; discrepancy unresolved |

Derived hole centres are `(3.5,3.5)`, `(61.5,3.5)`, `(3.5,52.5)` and
`(61.5,52.5)`. In ARBI's centred XY frame they are `(±29,±24.5)`.
The Z-height labels have no explicit datum or tolerance on these sheets; do not
add an assumed PCB thickness and call the result an official overall height.

Neither reviewed board drawing nor the product brief dimensions the mounting
hole diameter, PCB thickness, underside component height, plugged connector
envelopes or cable bend radii. ARBI's **Ø2.75 mm holes and 1.6 mm PCB thickness
remain assumptions**. The printed mount's 3.2 mm clearance bore is a separate
design allowance, not a Raspberry Pi board-hole specification.

## Electrical reference

The reduced schematic is a public interface reference, not a complete board
design or ARBI wiring diagram. It identifies camera connector J3, display
connector J4 and the 40-position GPIO header J8. The J8 5 V rail is on physical
pins 2 and 4; ID_SD/ID_SC on pins 27/28 are reserved for HAT identification
EEPROM use. It also shows the micro-USB input path through F1 and its protection
circuit. Keep connector pin numbering separate from BCM GPIO numbering.

The product brief specifies 5 V/2.5 A DC via micro-USB and also permits 5 V DC
via GPIO. ARBI's pod converter, harness, protection, servo supply and selected
Pi power-entry route still need their own electrical design and bench evidence;
these sources do not establish that a GPIO-fed harness traverses the micro-USB
input protection.

## Drawing-derived reference r0.2.0

The [shared reference](../../../lib/raspberry-pi-3a-plus.scad) replaces the
r0.1.0 catalog blocks and the independent booklet Pi. The public entrypoint and
[booklet reference](../../../../scripts/camera-pod-booklet/reference-parts.scad)
now call `raspberry_pi_3a_plus`. It models the R3 PCB, four mounting holes,
40 separate GPIO pins, CSI/DSI sockets, micro-USB, HDMI, audio/video and USB
housings with open mouths, plus a nominal underside SD socket and processor.

The [drawing trace](drawing-trace.json) records PDF vector bounds, source
checksum and the transform into millimetres. Connector plan outlines come from
RP-008330, rounded to practical nominal dimensions. Published PCB dimensions
and hole centres override drawing stroke rounding. Traced plan dimensions are
not manufacturing tolerances.

Published connector heights are interpreted **above the populated PCB face**
for this model, using nominal PCB thickness 1.6 mm. USB uses the larger 7.1 mm
2018 height label. With the nominal 1.1 mm underside SD projection, the model
bounds are **67.5 × 58.5 × 11.2 mm**, not a supplier-certified overall envelope.
Micro-USB height (2.8 mm), processor height, GPIO pin section, socket internals
and SD detail are nominal. Radio-package details, passives and solder joints
are omitted.

The [committed CAD inspection](cad-check.json) verifies connector plan bounds
against the independent trace within 0.08 mm, published heights under the stated
datum, R3 corner relief, clear mounting holes, 40 GPIO pins, six open connector
mouths, a closed connected mesh and identical public/booklet geometry.
One-millimetre shifted-hole and square-corner controls must fail. These are
source-reproduction checks, not physical fit or electrical acceptance.

Reproduce with OpenSCAD 2021.01 on PATH and the
[booklet Python dependencies](../../../../scripts/winch-booklet/requirements.txt):

```sh
python3 scripts/camera-pod-booklet/check_pi_reference.py
```

`--record hardware/assemblies/camera-pod/raspberry-pi-3a-plus/cad-check.json`
refreshes the inspection only after the checks pass. Registry validation rejects
missing evidence, a different model revision or changed source hashes for a
`drawing-derived` reference. Both booklet builds run the same inspection.
This clears the generic approximate-geometry warning while retaining specific
drawing/nominal-detail and physical-acceptance limits.

Record the actual board revision, measurement method/uncertainty, underside and
connector clearances, mounting stack, plugged-cable access and physical fit
before accepting a dependent assembly. The
[booklet source inventory](../../../../scripts/camera-pod-booklet/sources.json)
retains the observation date and SHA-256 hashes of the reviewed PDFs.

[board]: https://pip-assets.raspberrypi.com/categories/512-raspberry-pi-3-model-a/documents/RP-008330-DS-1-raspberry-pi-3-a-plus-mechanical-drawing.pdf
[board-2018]: https://pip-assets.raspberrypi.com/categories/512-raspberry-pi-3-model-a/documents/RP-008328-DS-1-raspberry-pi-3-a-mechanical-drawing.pdf
[schematic]: https://pip-assets.raspberrypi.com/categories/512-raspberry-pi-3-model-a/documents/RP-008332-DS-1-raspberry-pi-3-a-plus-reduced-schematics.pdf
[brief]: https://pip-assets.raspberrypi.com/categories/512-raspberry-pi-3-model-a/documents/RP-008331-DS-1-raspberry-pi-3-a-plus-product-brief.pdf
[case]: https://pip-assets.raspberrypi.com/categories/512-raspberry-pi-3-model-a/documents/RP-008329-DS-1-raspberry-pi-3-a-plus-case-mechanical-drawing.pdf
[index]: https://www.raspberrypi.com/documentation/computers/raspberry-pi.html#schematics-and-mechanical-drawings
