# Winch drum development proposal

Status: **Proposed, concept-unvalidated**. This working proposal does not release a
manufacturing interface or change the direct-drive V1 baseline.

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

## Interfaces to resolve before a fabrication model

- Printer model, usable build volume, material, and process: choose a one-piece or
  segmented construction only after checking the complete flange/hub envelope.
- Measured 8 mm shaft and coupling: propose a metal clamping hub with a bolted drum
  interface, then dimension its actual pilot, bolt circle, axial retention and
  torque path. This is a candidate, not a selected component or approved interface.
- Full shaft stack: drum, hub, two external bearings, retention, coupling engagement
  and assembly clearance. The catalog's approximately 200 mm shaft cannot contain
  the current full-capacity drum; reconcile travel and geometry before selecting
  a replacement shaft or shortening the drum.
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
