# WT-806 indoor mounting assembly guide

Guide updated **17 October 2026** for adapter revision **0.1.0**,
current carrier/reference revision **1.1.0**,
**concept-unvalidated**. This builds one round-120 printed pulley head and one
complete **passive winch, including its motor**, onto each of the two owned
WT-806 stands. Use it for isolated, unloaded fit, loose-line routing and
hand-rotation trials. No stand side-load or cable-tension limit is established.

The [adapter specification](../../../hardware/assemblies/corner-station/stand-adapter.md)
owns measured tube selection, print settings, bolt stacks and acceptance limits.
The optional [BOM kit](../../../bom/generated/parts/corner-stand-adapter-kit.md)
contains **eight adapter prints per stand**, sixteen for two stands; bought
fasteners and existing equipment are additional.

## Illustrated guide and model pack

The **corner support assembly PDF, pages 9–14**, contains labeled actual-mesh
figures, a fastener table and the mounting sequence below. Download
`ARBI-corner-support-assembly-STL.pdf` and `ARBI-corner-support-STL-pack.zip`
from the [current CAD release](https://github.com/gredice/arbi/releases/latest)
once this guide's source has been published. Check the release provenance;
an earlier eight-page booklet does not contain the indoor insert.

The pack includes current registry filenames under `models/stand/print/`,
nominal purchased hardware under `models/stand/reference/`, assembly transforms
in `figure-manifest.json`, the reproducible adapter check, and editable sources.
The four adapter STLs are **already in their print orientation**. Do not apply
the head's installed-to-print transform to them. Export both halves with the
same measured tube diameter; never resize them in the slicer.

Rebuild and check the guide from the repository root with OpenSCAD 2021.01 and
the [booklet dependencies](../../../scripts/winch-booklet/requirements.txt):

```sh
python3 scripts/corner-support/build.py
python3 scripts/check-booklet.py hardware/generated/corner-support --variant corner
```

## Lay out the parts

The figure letters A–D identify adapter roles, not left/right handed parts.
Each row uses one front and one matching rear half. Both rows use the same
orientation; do not mirror the second row.

| ID | Registered print / role | One stand | Two stands | Default tube |
| --- | --- | ---: | ---: | --- |
| A | [corner-stand-head-front](../../../hardware/assemblies/corner-station/corner-stand-head-front.scad), curved head seat | 2 | 4 | 26 mm |
| B | [corner-stand-head-rear](../../../hardware/assemblies/corner-station/corner-stand-head-rear.scad), matching rear half | 2 | 4 | 26 mm |
| C | [corner-stand-winch-front](../../../hardware/assemblies/corner-station/corner-stand-winch-front.scad), flat winch seat | 2 | 4 | 35 mm |
| D | [corner-stand-winch-rear](../../../hardware/assemblies/corner-station/corner-stand-winch-rear.scad), matching rear half | 2 | 4 | 35 mm |

Retain **one left and one right round-120 carrier**, one received BA01090 pulley,
its measured compatible pin and all pin locking parts per head. Retain each
head's **two M8 × 100 cross-bolts, four washers and two locking nuts**. For two
heads those quantities double. Assemble each passive winch using the
[winch guide](../winch/README.md) and its assembly booklet; its internal parts
and fastening order belong to that assembly.

Omit the timber rear pads, head drilling template, long M12 timber through-bolts,
both head cosmetic covers and all M3 cover screws, washers and nuts for the
first inspection. Omit the
winch's timber saddle/spacer/backing stack, pole through-bolts, saddle nut covers
and common bench rear blank. Keep mounting holes and clamp witnesses accessible.
The unchanged stand clamp interfaces retain the revised carriers. No cosmetic
cover joint, top spigot or top thread retains this fixture.

## Collect the additional metal hardware

These are adapter mounting quantities, in addition to the reused head
cross-hardware and the complete winch. Lengths are measured under the bolt head.
Use bought metal washers and locking nuts. Nominal washer/nut dimensions below
are fit envelopes requiring received inspection.

| Hardware | One stand | Two stands | Interface |
| --- | ---: | ---: | --- |
| M6 × 60 bolts | 4 | 8 | Two per 26 mm A/B row |
| M6 × 70 bolts | 4 | 8 | Two per 35 mm C/D row |
| M6 washers, 12 mm OD × 1.6 mm | 16 | 32 | Two per M6 bolt |
| M6 locking nuts, 6 mm thick | 8 | 16 | One per M6 bolt |
| M12 × 90 bolts | 2 | 4 | Head to A |
| M12 large washers, 37 mm OD × 3 mm | 4 | 8 | Two per M12 bolt |
| M12 locking nuts, 12 mm thick | 2 | 4 | Head to A |
| M8 × 40 bolts | 4 | 8 | Winch base to C |
| M8 washers, 16 mm OD × 1.6 mm | 8 | 16 | Two per M8 bolt |
| M8 locking nuts, 8 mm thick | 4 | 8 | Winch base to C |

A measured 30 mm section needs matching front/rear exports and **M6 × 65**
clamp bolts at that interface. Change the relevant rows, not the entire inventory.
Inspect the actual locking zone, exposed tips and wrench clearance after any
substitution; the [stack calculation](../../../hardware/assemblies/corner-station/stand-adapter.md#bought-hardware)
is the nominal starting point.

## Mount in this order

The fixture frame is **+X toward the intended span, +Y across it, +Z up**.
Both head seats and winch plates point +X. The illustrations show disconnected
straight tube samples; they omit the tripod, factory collars and springs.
Illustrated heights are not measured assembly positions.

1. **Prepare the stand.** Spread and lock its legs on a level floor. Keep
   extension low, arrange suitable ballast and retention to an independent
   stable support, and separately support the equipment while mounting it.
   Hold each spring-loaded section when releasing a factory lock, following the
   [WT-806 manufacturer manual](https://m.media-amazon.com/images/I/A1PbIZRyiuS.pdf).
   Measure actual tube diameter/ovality and exposed length before printing.
2. **Fit A/B head rows.** Select one constant-diameter straight section with
   **160 mm available length**. Set M12 row centres **110 mm apart**. Keep clear
   of factory collars, levers, transitions and the spigot. Insert each M6 bolt
   from behind the tube: **head → washer → B → A → washer → locking nut**.
   Alternate gentle tightening; inspect grip and remaining face gap. Stop for
   bottomed faces, cracks, dents or impaired factory locks. No torque is assigned.
3. **Join the head carriers on the bench.** Use their two M8 × 100 cross-bolts
   at carrier Z=100/190 with washers and locking nuts. Inspect and fit the
   compatible retained BA01090 pin. Do not force a nominal bolt into an
   unmeasured pulley tang or omit its locking feature.
4. **Attach the supported head to A.** Seat its curved carrier surfaces evenly
   against the curved pads. Align the carrier Z=45/155 holes with the 110 mm
   adapter pitch. Insert both M12 × 90 bolts from the carrier/span side:
   **head → large washer → carrier → A → large washer → locking nut**.
   Reach the rear nut between A's webs, ahead of the tube. B is outside this
   M12 stack. Inspect locking-zone engagement, bolt tips and block articulation;
   keep the head covers off.
5. **Fit C/D winch rows.** Select one constant-diameter lower straight section
   with **170 mm available length**. Set row centres **120 mm apart**; face both
   flat C plates toward +X. Fit and inspect the two M6 clamps per row before
   mounting the winch. Default 35 mm tubes use M6 × 70.
6. **Attach the supported passive winch.** Expose the original **50 × 120 mm**
   base pattern using the [full-cover service sequence](../../../hardware/assemblies/winch/full-cover.md#printing-installation-and-service).
   Use four M8 × 40 bolts from the base/span side:
   **head → washer → 8 mm aluminium base → 16 mm C plate → washer → locking nut**.
   Access the rear nuts through C's 26 mm rib pockets. D is outside this M8
   stack. Fit all four bolts before final tightening, with the winch separately
   supported. Inspect tips and locking zones before refitting compatible covers.
7. **Check the mounted setup.** Weigh the equipment and inspect all four clamp
   pairs, factory locks, base footprint, ballast and independent retention.
   The manufacturer's 6 kg central-equipment maximum does not qualify this
   eccentric mounting or cable tension. Independently support unsuitable mass
   or moment; do not test by loading the fixture to that published value.
8. **Perform the first unpowered trial.** Isolate electrical power and use a
   loose line. Place a plumb reference through the actual pulley groove and
   drum payout point. The nominal payout plane is **253.3 mm forward of the
   tube axis**; the winch base front is at 123 mm. Turn the drum by hand through
   its travel and inspect fleet angle, rubbing, block articulation, fasteners
   and factory-collar clearance. Mark clamp/collar witnesses and recheck after
   each trial. Stop for slip, rotation, loose locks, cracks, dents or line contact.

Secure/de-tension the line before every adjustment. Remove equipment before
moving the tripod or changing telescopic height. Tensioned, powered or suspended
trials need independent restraint, measured limits and a reviewed procedure
under the [commissioning gates](../../operations/prototype-and-commissioning.md#local-safety-and-update-gates).
Two stands provide two development interfaces; four accepted anchors are still
required for the flying system.

## Blank fit and hand-rotation record

Complete one record per stand and commit the results with photos and a reviewer
when available. Link the record from [issue #147](https://github.com/gredice/arbi/issues/147);
an unchecked form is not evidence of acceptance.

| Record field | Measured value / observation |
| --- | --- |
| Date, stand ID, builder, reviewer | |
| CAD source commit/hashes, adapter/head/winch revisions | |
| Head/winch tube diameter at both rows, ovality, straight lengths | |
| Actual row heights/pitches and clearance to collars/legs | |
| Filament, printer, slicer, orientation, supports, full process | |
| Print bore/hole dimensions, cracks/bonding, face gap | |
| Actual bolt/washer/nut sizes, locking zones and tip projections | |
| Received pulley tang/pin dimensions and pin retention | |
| Equipment mass, footprint, extension, ballast, independent restraint | |
| Factory-lock operation, initial clamp/collar witnesses | |
| Plumb alignment, complete hand-rotation/payout sweep, rubbing | |
| Witnesses after each trial; slip/rotation/settlement observations | |
| Defects, stopped trials, corrections, photos, reviewer result | |

Mesh/export checks establish nominal source geometry and document consistency.
Clamp friction, tube-crush limits, print creep, tipping and loaded operation
remain unverified; see the [existing nominal geometry record](../../../hardware/assemblies/corner-station/stand-adapter-check.md).
