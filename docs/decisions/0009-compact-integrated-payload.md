# ADR-0009: Compact integrated payload packaging

- Status: Accepted design direction on merge; physical validation pending
- Date: 2026-10-07
- Refines: [ADR-0007](0007-integrated-product-design.md)

## Context

The selected [payload concept](../assets/payload-concept.png) shows a compact rounded white upper shell, one continuous charcoal central body around the spider, an open gimbal aperture and a small white optical surround. The existing enclosed bench arrangement retains a long side-by-side electronics deck, a shallow chamfered roof and a separate circular lower fairing. Matching its colours alone does not reproduce the selected form.

The owner selected a compact implementation that may rearrange the internal electronics to approach that concept. This decision records that design direction and the resulting packaging revision. The artwork establishes appearance priorities; it does not supply fabrication dimensions, component clearances or physical evidence.

## Decision

Repackage the fixed electronics on a new compact integrated deck. Keep the existing dry bench deck and cover as an explicit alternative configuration rather than silently changing their interfaces. The compact deck, enclosing parts and assembled references must carry their own current model revisions, fabrication-source mappings and compatibility documentation.

Use these nominal starting coordinates in the existing spider-centred assembly frame, in millimetres. They remain subject to the actual modeled component, fastener, wiring and service clearances:

| Item | Nominal placement |
| --- | --- |
| Upper shell plan envelope | 124 × 118, centred at X=0, Y=0 |
| Raspberry Pi 3A+ | Board centre X=-22, Y=0; preserve its mounting pattern |
| Converter | Centre X=32, Y=0; rotate 90° about Z relative to the existing layout |
| Capacitor | Centre X=32, Y=-34 |

Replace the shallow roof chamfer with a broad rounded crown and centre the 124 × 118 mm upper shell over the camera axes. Make the black lower housing one printed outer head that narrows continuously from its upper opening toward its smallest lower section. The compact head mesh measures 94 × 76 × 72.545 mm, ending at Z=-76.6453 below its Z=-4.1 open neck. This reduces its bounding-box volume by approximately 42.48% from the preceding tapered head; the geometry record owns the comparison and nominal checks. A separate internal carrier permits assembly and service through four M2 × 10 head clamps. Rotate the tilt servo 90° about X into a horizontal orientation, move its driven interface 2 mm inboard to X=-19.8, and place the tilt axis at Y=3, Z=-45, raising the camera 14 mm. New integrated cradle and pivot-support prints implement this packaging while retaining the camera mounting pattern and existing M3 opposite pivot. The outer head and carrier rotate in pan; the camera and white optical surround tilt inside. Omit the separate rear camera cowl and four secondary nuts, using four M2 × 12 camera screws with four primary nuts and eight washers. Recheck the outer head’s proposed rear-camera shielding and CSI loops physically.

This compact gimbal uses `payload-integrated-gimbal-head` r0.1.2, `payload-integrated-gimbal-carrier` r0.1.1, and new integrated cradle/pivot-support models r0.1.0. The upper white hood, tray, electronics deck and optical surround keep their current revisions. The assembled references advance to rain assembly r0.2.4 and payload/camera-pod assembly r0.3.4; the legacy cradle, pivot support and cowl remain alternative sources.

The owner's [Mavic 4 Pro spherical gimbal](https://repair.dji.com/help/content?customId=01700012427&lang=en&paperDocType=ARTICLE&re=US&spaceId=17) and [Portal/Wheatley](https://www.thinkwithportals.com/media.html) references supply visual inspiration for a rounded head and centred eye only. ARBI retains pan ±90° and tilt 0–70°; the references do not change its hardware, interfaces or required clearance evidence.

Judge the silhouette from actual registered geometry in neutral, front, side and representative tilted poses. Label pose angles so a tilted presentation cannot conceal a difference in the underlying packaging. Keep service and exploded views alongside the covered assembly.

## Underside refinement — 8 October 2026

Tray r0.2.3 and moving head r0.1.3 form a matched underside revision. A rolled fixed shoulder changes from the existing rounded tray outline to a Ø103 mm throat at Z=-6.1. A Ø100 mm moving neck at Z=-4.1 blends into the existing lower head over 28 mm. Their nominal 1.5 mm radial seam and 2 mm overlap make the visible underside continuous while keeping fixed and moving skins separate. Open-bottom spider reliefs, recessed access, the rear power breakout and through-drains preserve the existing structure and supported service sequence. The preceding 94 × 76 mm head dimensions above describe r0.1.2; the [current enclosure record](../../hardware/assemblies/camera-pod/payload-enclosure-check.md) owns the refined mesh dimensions and checks. Physical interfaces, pan/tilt travel, load path and electrical architecture remain as recorded above.

## Preserved interfaces and limits

- Retain the four-cable architecture, existing spider geometry and line attachment interfaces, structural frame axes, pan axis, purchased servo horns and nominal camera mounting pattern.
- Retain software travel of pan ±90° and tilt 0–70°, and the existing mechanical stop targets of pan ±95° and tilt -5–75°. A narrower aperture must not reduce these limits to obtain the desired silhouette.
- Preserve removable covers, access to hardware, drainage, downward harness exits and practical assembly/service paths. Revise compact-kit fastener lengths, support positions and cable routes explicitly where its packaging requires them.
- Keep fixed electronics separate from the pan-moving head/carrier and tilting camera. Adding the outer head to the pan group changes servo load and inertia; require renewed torque, current, retention and settling acceptance. Do not substitute shell parts for the spider's tensile load path or imply that this change resolves the docking interface.
- Keep the 100–120 g complete-pod mass target and 170 g ceiling visible. Calculate the complete selected print quantities, then require a slicer review and an assembled mass measurement; appearance improvements do not waive mass acceptance.
- Preserve the weather operating policy, local safety ownership and physical acceptance gates. The open enclosure remains an ordinary-rain/splash target without an ingress rating.

## Evidence and physical acceptance requirements

Update the [model registry](../../hardware/models.json), canonical [BOM part mappings](../../bom/catalog/parts.json), configuration instructions and generated reports together. Record the current 13 fabrication models and 16 installed printed pieces, which parts require reprinting and which existing parts remain reusable. Keep the dry bench configuration independently buildable and checked.

Use the [payload booklet pipeline](../../scripts/payload-booklet/README.md) to export the actual registered parts, check mesh integrity and nominal assembly intersections, sweep the existing motion grid, detect the overtravel stops, and check optics, wire passages, clamp seating, tools and assembly/service paths. A changed harness route must have an explicit nominal proxy and a meaningful collision control. Regenerate the geometry evidence and affected booklet packs from the revised sources; old evidence does not validate a new deck or shell.

Review component envelopes, enclosure clearance, thermal space, retained fastener contact and service access after rearrangement. Populate the carrier outside the head, fasten the tilt horn/retainer to the separate cradle before engaging the mounted servo, fit the opposite support laterally from 12 mm to its right, and load the head's captive lower washer/nut pairs before insertion; fit the four clamps before the upper tray and electronics obstruct access. The bench fixture and supported disassembly sequence require their own inspection. The converter and capacitor references remain provisional, and received-unit dimensions and flexible harness behaviour require physical inspection. Rounded shell geometry must remain connected, printable and removable; a successful exterior render cannot establish those properties.

All affected models remain `concept-unvalidated`. Passing source, mesh, sampled motion, service or booklet checks establishes only the stated nominal CAD evidence. Received-hardware fit, flexible cable fatigue, complete mass and balance, strength, docking clearance, servo torque and settling, heat, drainage and rain behaviour still require their own measured records.

## Acceptance status

This decision records the selected design direction and its constraints. It becomes the packaging baseline when merged. Physical fit, material and print performance, weather protection, complete flying mass and suspended operation remain unverified; acceptance of the design direction does not clear those gates.
