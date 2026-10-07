# Round timber-pole winch mount

Status: **concept-unvalidated**, revision r0.1.0. [Proposal and acceptance](https://github.com/gredice/arbi/issues/104). This is the round-timber alternative to the flat-post spacer/backing-plate stack; do not combine both stacks. No installation or load rating is established.

## Interface and fabrication

The default is a **120 mm diameter timber pole**. Measure the actual pole at both saddle stations, including taper and out-of-round shape. `pole_diameter` permits the 100–140 mm nominal study; a different diameter requires regenerated matching saddles. The supplied default saddle STLs fit only the nominal 120 mm case. These parts are not clamps for hollow steel poles: drilling, tube crushing, material and retention would need a separate design.

Retain the four original 9 mm base holes on the **50 × 120 mm pattern**, centered on the drum winding width. The base stays vertical, shaft horizontal, and +Y points up toward the top pulley. The round pole's nearest surface is Z=-33 mm, preserving the 25 mm offset from the aluminium plate rear face at Z=-8 mm.

| Part | Per winch | Process |
| --- | ---: | --- |
| [Front saddle](winch-pole-front-saddle.scad) | 2 | Machined metal; **do not print** |
| [Rear saddle](winch-pole-rear-saddle.scad) | 2 | Machined metal; **do not print** |
| [Rear nut cover](winch-pole-nut-cover.scad) | 2 | Non-structural white print |
| [Underside closure](winch-pole-nut-cover-bottom.scad) | 2 | Non-structural white print |
| [Cable guide](winch-pole-cable-guide.scad) | 1 | Non-structural dark print |

Each saddle is 80 mm wide × 24 mm high. Front saddles have a flat aluminium-plate seat and a cylindrical timber seat; the minimum central metal depth is 25 mm. Rear saddles distribute the two bolt loads onto matching timber surfaces, with 8 mm minimum central depth and integral cap rails. The 120 mm shape is a machining envelope, not a qualified material grade or manufacturing drawing. Select stock, tolerances, edge finish, corrosion/contact treatment and manufacturing process with the structural reviewer. Printed saddles are not specified.

## Through-bolts and concealed rear nuts

At Y=±60 mm, each saddle receives the two original M8 bolt positions at X=W/2±25. The load path is aluminium base → metal front saddles → timber → metal rear saddles → washers and locking nuts. Cosmetic parts carry no winch/post load.

| Nominal timber diameter | Starting M8 bolt length | Nominal exposed tip beyond 8 mm locking nut |
| --- | ---: | ---: |
| 100 mm | 160 mm | 7.8 mm |
| 120 mm | 180 mm | 7.8 mm |
| 140 mm | 200 mm | 7.8 mm |

These lengths use an 8 mm aluminium base, 25 mm central front offset, pole diameter, 8 mm rear depth, two 1.6 mm washers and an 8 mm locking nut. Check actual timber chords, contact seating, thread engagement and tip clearance before selecting bolts. The two X-offset bolt chords are shorter than the full pole diameter; the shaped saddles fill that difference. Non-standard diameters and rounded bolt lengths change tip projection. Use the received stack, not the table alone.

The 96 × 36 mm white nut covers slide downward onto the rear saddle rails. Their upper stop resists a straight downward slide. Fit the separate snug underside closures to conceal nuts and tips from below as well. For inspection, pull the closures down first, lift the main caps **40 mm +Y**, then withdraw rearward. No structural bolt needs loosening. Closure side contacts are nominal zero-clearance fits; calibrate print dimensions and confirm retention. The closure fit and main cap gravity stop are not qualified vibration retention. Reject loose closures before installation. Condensation/drainage and outdoor retention require physical acceptance.

## Bottom cable layout

Use the [full-cover r0.3.0 bottom ports](full-cover.md#routing-and-service): X=W/2−55 / W/2−35, Y=-98, Z=13 / 25 mm, each nominal 14 mm diameter. Recessed sleeves hide the opposite clip hardware while a wider inner corridor clears the bend. These ports sit in the lower side beside the pole, replacing the right-end outlets. Route the two provisional ≤10 mm looms along Y=-60 at Z=13 / 25 under the drum, then turn downward with the nominal 30 mm internal bend. Their independent anchor is at X=W/2+60, Y=-60. The modelled motor lead origin is provisional; inspect the supplied motor/encoder lead geometry.

Outside the enclosure, form smooth downward bends onto the pole and retain both looms in the guide at Y=-230 mm, with cable centres X=W/2±8, Z=-24 mm. Two soft ties thread through the paired 3 × 9 mm full-depth slots, wrap circumferentially around the pole and bridge the guide face at local Y=±3 mm. Keep tie width ≤2.5 mm and thickness ≤1 mm, clear of the cable jackets. The guide is held independently of the winch. The 11 mm cable channels have a 7 mm front opening; inserting/removing a 10 mm loom needs compliant clip deformation and therefore print/material tests. The guide is not certified strain relief. Maintain the received cable's minimum bend radius, a drip arrangement and jacket protection. These are stationary motor/encoder leads; the positioning line still pays out upward.

Isolate power and secure/de-tension the positioning line before service. Release the guide and anchor wraps, disconnect or withdraw the stationary looms from the closed apertures, then remove the lower fascia and hoods using the existing sequence. The guide and rear caps must not obstruct the structural inspection or cover service paths.

## Evidence and acceptance

The [nominal geometry record](round-pole-check.md) identifies the tested 100/120/140 mm cases, exact source/mesh hashes, metal/pole/cover contacts, fastener envelopes, cap removal and bottom cable clearance. CAD does not establish timber capacity, machined saddle strength, bolt bending, preload, corrosion, pole edge distances, motor heating, rain resistance or loaded operation. Perform physical fit and qualified structural/proof-load review before installation.

[Round-pole assembly reference](winch-pole-assembly.scad) combines the actual enclosure with these saddles, caps and nominal looms. The separate CL57Y driver enclosure remains corner-station electrical work.
