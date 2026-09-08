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
