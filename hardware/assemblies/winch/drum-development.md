# Winch drum development proposal

Status: **Proposed, concept-unvalidated**. This working proposal does not release a
manufacturing interface or change the direct-drive V1 baseline.

## Implemented CAD pass — 2026-09-08

The earlier concept study has been replaced by a segmented assembly reference
(revision 2.0.0) and ten fabrication entrypoints (each 0.1.0). The
[current model README](README.md) owns dimensions, print counts, fasteners,
assembly and limitations. The proposal text below records the earlier assumptions;
where those differ, use the current model README for the implemented geometry.

Implemented: two passive and three powered grooved body sections; shared flanges,
two-piece screw clamp, Dyneema tail clamp, alignment pins and M5 through-rod joints.
The nominal full-travel shaft allowances are now 340 mm passive and 660 mm powered,
not four 400 mm blanks. Three passive shafts and one powered shaft use 1680 mm of
the BAUHAUS 2000 mm stock before kerfs. The longer powered shaft still requires
structural review. Slip-ring mounting and electrical strain relief remain outside
these drum parts. The model status remains concept-unvalidated.

## First geometry pass

Keep the nominal 100 mm core and the 1.5 mm passive-line starting point. Replace
isolated circumferential grooves with one continuous rounded helical groove.
Separate deployable line capacity from reserve turns retained at full payout.
Expose the overall drum envelope so a printer or shaft mismatch is visible.

The 32 m deployable allowance is inherited from the earlier study, not a measured
travel requirement. Three reserve turns are a sizing experiment, not an approved
termination specification. Actual travel must come from the surveyed workspace,
dock and maintenance paths, fixed line routing, and end allowances. Reserve wraps
must never be counted as deployable travel.

The reference remains a solid core with an illustrative 8.2 mm bore. Neither a
plain bore nor reserve wraps establish torque transfer or line retention. Do not
print this full reference as a working drum.

## Owner constraints recorded on 2026-09-08

The owner confirmed a **Bambu Lab X1 Carbon (X1C)**, no shaft on hand, and an
already ordered AliExpress coupling. The BOM specifies an 8-to-8 mm jaw coupling,
approximately D20/L25; its actual clamping and engagement dimensions await receipt.

[Bambu's specification](https://us.store.bambulab.com/products/x1-carbon?variant=42698346037384)
lists 256 × 256 × 256 mm nominal volume, with a default 250 mm print height and a
filament-cutter exclusion area. The current 270.9 mm drum cannot print upright as
one part. Proposed construction: two axial drum sections, approximately 135.45 mm
body length each before joint details, with positive angular registration of the
helical groove and a bolted connection. Keep each finished part below 240 mm in
height and check brim/exclusion clearance in Bambu Studio. The joint, hub, groove
seam, hollow walls and print orientation are not yet modeled or released.

Domestic shaft research is recorded in the [dated sourcing note](../../../bom/sourcing/winch-shaft-2026-09-08.md).
The owner subsequently selected BAUHAUS nominal Ø8 mm hot-rolled steel rod for
the prototype. A 400 mm blank per winch is an allowance for the complete stack,
not a final cut length or structural approval. Measure the rod before assigning
final bore clearances and inspect bearing/coupling fit and straightness.

## Nominal inputs and tolerance strategy — 2026-09-08

Owner direction: use BOM nominal dimensions and mechanical adjustment rather than
blocking the CAD on measurements of parts already specified. These are sufficient
to develop the first passive-line prototype; inspection is a fabrication/assembly
check, not a prerequisite for drawing it.

| Interface | BOM fact | CAD treatment |
| --- | --- | --- |
| Shaft | BAUHAUS nominal Ø8 mm steel | Expose nominal diameter and diametral clearance separately. Use 0.2 mm initial diametral clearance for printed locating bores, plus a split clamp and through-bolts/nuts for take-up; do not depend on an exact printed press fit. |
| Bearings | 608-2RS, 8 × 22 × 7 mm | Reserve the stated envelope. Printed housing clearance is adjustable, but the steel bearing's 8 mm bore is fixed; reject or finish rod stock that will not fit without forcing. |
| Motor coupling | 8-to-8 mm jaw coupling, approximately Ø20 × 25 mm | Reserve the full outside envelope. Use 10 mm shaft engagement as an explicit layout assumption, with axial positioning allowance; it is not a supplier-specified engagement depth. Do not infer 12.5 mm simply by halving total length because jaws/spider occupy the centre. |
| Passive line | 1.5 mm Dyneema | Use the existing 1.5 mm nominal line, 0.2 mm radial groove clearance, 0.45 mm groove depth and 2.2 mm pitch as prototype defaults. |
| Powered line | 1.5 mm core plus two AWG26 silicone-insulated wires, each provisionally 1.5 mm OD | Use a 4.5 mm opposed-wire envelope before groove clearance, based on the owner-supplied table. Keep wire OD and groove clearance separate parameters. The passive groove is not the powered-line design. |

The proposed split clamp uses machine screws, washers and captive/accessible metal
nuts rather than threads cut directly into printed plastic. Bolt hole clearance,
nut clearance and clamp gap must be independent parameters. Include a positive
angular locating feature and bolted joint between drum sections so the helical
groove joins in phase. Axial location uses the already selected shaft collars.
Clamp torque transfer, joint strength and retained line wraps still require bench
verification; adjustment does not establish those ratings.

The coupling's exact engagement does not determine the drum geometry: axial
positioning and the 400 mm shaft blank allowance can accommodate the chosen layout
before final cutting. The powered-line envelope remains a separate engineering
variant because increasing its groove pitch also changes total winding width and
shaft length; do not squeeze it into the passive groove or silently reduce travel.

## Materials and readiness — 2026-09-08

Owner-selected print sequence: **PLA for the first prototype; ASA for the later
revision**. Use PLA for dimensional assembly and controlled bench evaluation.
Do not transfer fit, clamp preload, creep or load-test results automatically to
ASA; its print process and resulting parts need their own inspection and evidence.
Neither material selection establishes outdoor operating readiness.

The [owner-supplied wire table](../../../bom/sourcing/pod-wire-dimensions-2026-09-08.md)
is now recorded with the BOM wire parts. Nominal inputs are sufficient to continue
both passive and powered drum CAD without another measurement request. Remaining
items below are design and verification work, not missing owner decisions. Keep
32 m capacity and three reserve turns as explicit sizing assumptions.

The passive two-section layout and four 400 mm shaft-blank allocation must not be
assumed to fit the powered variant. Its 4.5 mm line envelope requires a wider
pitch and potentially more printed sections and a longer shaft. Reconcile that
layout with the 2000 mm BAUHAUS stock before finalizing purchasing yield or cuts.

## Design work before a fabrication model

- Use the X1C and PLA prototype baseline; size printed sections to the usable
  volume and define print orientation and process settings.
- Model the nominal 8 mm split-clamp shaft interface and bolted drum connection
  using the tolerance strategy above. Verify fit and torque retention before use;
  a separate metal clamping hub remains an alternative if the printed clamp fails
  the required torque/creep checks.
- Full shaft stack: drum, hub, two external bearings, retention, coupling engagement
  and assembly clearance. The selected stock is a 2000 mm BAUHAUS rod with provisional 400 mm blanks;
  reconcile the passive and powered layouts before establishing final cut lengths.
- Line termination: provide an accessible, radiused mechanical attachment and a
  justified minimum retained-wrap count; test pullout and reversals on the selected
  Dyneema. The previous shallow witness holes were not working anchors.
- Powered line: measure the complete hybrid outside diameter and bend requirements;
  the 1.5 mm passive-line groove does not specify the powered drum. Resolve separate
  conductor strain relief, insulation and slip-ring routing.
- Line approach: check fleet angle across the entire winding width and determine
  whether a guide is required. A helical groove alone does not guarantee spooling.

## Evidence sequence

1. Compile the reference using pinned OpenSCAD 2021.01 and inspect groove continuity,
   handedness, end margins and envelope.
2. Resolve the interfaces above in a reviewed design proposal and create the
   manufacturing model, registry/BOM mapping and fastener specification.
3. Print a short representative groove and hub specimen; inspect dimensional fit,
   line seating and assembly access before printing the full drum.
4. Test the assembled drum on a guarded bench for torque transfer, retention,
   repeatable payout/rewind, flange climb and line abrasion over the full travel.
5. Establish load, creep, temperature and fatigue acceptance for the chosen print
   process before changing the model's evidence status.

System requirements: [winch](../../../docs/assemblies/winch/README.md),
[positioning lines](../../../docs/assemblies/positioning-lines/README.md), and
[site geometry](../../../docs/system/site-geometry.md).
