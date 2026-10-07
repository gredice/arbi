# Modular full-winch protective shell kit

> Generated from canonical BOM inputs by `pnpm bom:generate`. Do not edit this page by hand.

[BOM](../../README.md) · [All items](README.md) · [Canonical part catalog](../../catalog/parts.json)

- Part ID: `winch-full-cover`
- Unit: each
- Kind: component
- Lifecycle: active
- Disciplines: mechanical
- Traits: fabricated, printed

## Requirements

- One kit per winch: passive 3 main panels, 2 shutters, 6 fascia strips (one lower pole-port variant), 3 rear shield segments and one optional bench blank; powered 5 main panels including one index-1 pole middle, one plain index-2 middle and index-3 transition, 4 shutters, 10 fascia strips (one lower pole-port variant), 5 rear shields and one blank. Four r0.2.0 clips per panel and one independent loom anchor.
- Warm-white rounded removable shell over existing dark core. Full-width 24 mm payout slot for 1.5 mm passive or nominal 4.5 mm hybrid line; no fixed fairlead or completed slip-ring support.
- Concept-unvalidated: drilling, fit, full-travel abrasion, ventilation, heat, rain, strength and safe guarding require physical acceptance.
- r0.3.0 bottom-loom layout: two 14 mm apertures near the pole; right-end ports closed. Provisional motor/encoder looms <=10 mm OD, routed under the drum. Independent anchor moves to X=W/2+60, Y=-60; add its revised base holes.

## Notes

Three passive plus one powered kit retains 14 hoods, 10 shutters, 56 clips, four anchors, 28 fascia strips and 14 rear shields. Replace passive left/right and powered right at r0.3.0; add the powered pole middle and one pole fascia per winch. Reuse unchanged drivetrain, clips, shutters and common fascia. Round-pole saddles/caps are separate alternative kits. Physical fit, cable bend/strain relief and support acceptance remain open. See hardware/assemblies/winch/full-cover.md.

## Used in

Quantities are per assembly definition, before build multipliers. Optional and deferred usages are shown even when excluded from a scenario. Procurement stock is not an installed physical owner.

| Assembly or purchasing bucket | Quantity | Inclusion | Usage note |
| --- | ---: | --- | --- |
| [Winch set](../../../docs/assemblies/winch/README.md) | 4 each | base | — |

[Canonical assembly quantities](../../assemblies/assemblies.json)

## BOM reports

- [ARBI V1 — Zagreb repository baseline](../arbi-v1-hr-zagreb.md#required-parts-by-physical-owner-or-procurement-bucket) — included.

## Fabrication

- Process: openscad
- Model status: concept-unvalidated
- [hardware/assemblies/winch/winch-cover-passive-left.scad](../../../hardware/assemblies/winch/winch-cover-passive-left.scad) — module `wc_print_panel`; revision 0.3.0.
- [hardware/assemblies/winch/winch-cover-passive-middle.scad](../../../hardware/assemblies/winch/winch-cover-passive-middle.scad) — module `wc_print_panel`; revision 0.2.0.
- [hardware/assemblies/winch/winch-cover-passive-right.scad](../../../hardware/assemblies/winch/winch-cover-passive-right.scad) — module `wc_print_panel`; revision 0.3.0.
- [hardware/assemblies/winch/winch-cover-powered-left.scad](../../../hardware/assemblies/winch/winch-cover-powered-left.scad) — module `wc_print_panel`; revision 0.2.0.
- [hardware/assemblies/winch/winch-cover-powered-middle.scad](../../../hardware/assemblies/winch/winch-cover-powered-middle.scad) — module `wc_print_panel`; revision 0.2.0.
- [hardware/assemblies/winch/winch-cover-powered-transition.scad](../../../hardware/assemblies/winch/winch-cover-powered-transition.scad) — module `wc_print_panel`; revision 0.2.0.
- [hardware/assemblies/winch/winch-cover-powered-right.scad](../../../hardware/assemblies/winch/winch-cover-powered-right.scad) — module `wc_print_panel`; revision 0.3.0.
- [hardware/assemblies/winch/winch-cover-clip.scad](../../../hardware/assemblies/winch/winch-cover-clip.scad) — module `wc_print_clip`; revision 0.2.0.
- [hardware/assemblies/winch/winch-cover-cable-anchor.scad](../../../hardware/assemblies/winch/winch-cover-cable-anchor.scad) — module `wc_print_cable_anchor`; revision 0.1.0.
- [hardware/assemblies/winch/winch-cover-passive-shutter.scad](../../../hardware/assemblies/winch/winch-cover-passive-shutter.scad) — module `wc_print_shutter`; revision 0.2.0.
- [hardware/assemblies/winch/winch-cover-powered-shutter.scad](../../../hardware/assemblies/winch/winch-cover-powered-shutter.scad) — module `wc_print_shutter`; revision 0.2.0.
- [hardware/assemblies/winch/winch-cover-passive-fascia.scad](../../../hardware/assemblies/winch/winch-cover-passive-fascia.scad) — module `wc_print_fascia`; revision 0.1.0.
- [hardware/assemblies/winch/winch-cover-passive-rear-left.scad](../../../hardware/assemblies/winch/winch-cover-passive-rear-left.scad) — module `wc_print_rear`; revision 0.1.0.
- [hardware/assemblies/winch/winch-cover-passive-rear-right.scad](../../../hardware/assemblies/winch/winch-cover-passive-rear-right.scad) — module `wc_print_rear`; revision 0.1.0.
- [hardware/assemblies/winch/winch-cover-powered-fascia.scad](../../../hardware/assemblies/winch/winch-cover-powered-fascia.scad) — module `wc_print_fascia`; revision 0.1.0.
- [hardware/assemblies/winch/winch-cover-powered-rear-left.scad](../../../hardware/assemblies/winch/winch-cover-powered-rear-left.scad) — module `wc_print_rear`; revision 0.1.0.
- [hardware/assemblies/winch/winch-cover-powered-rear-right.scad](../../../hardware/assemblies/winch/winch-cover-powered-rear-right.scad) — module `wc_print_rear`; revision 0.1.0.
- [hardware/assemblies/winch/winch-cover-rear-blank.scad](../../../hardware/assemblies/winch/winch-cover-rear-blank.scad) — module `wc_print_rear_blank`; revision 0.1.0.
- [hardware/assemblies/winch/winch-cover-powered-pole-middle.scad](../../../hardware/assemblies/winch/winch-cover-powered-pole-middle.scad) — module `wc_print_panel`; revision 0.1.0.
- [hardware/assemblies/winch/winch-cover-passive-pole-fascia.scad](../../../hardware/assemblies/winch/winch-cover-passive-pole-fascia.scad) — module `wc_print_fascia`; revision 0.1.0.
- [hardware/assemblies/winch/winch-cover-powered-pole-fascia.scad](../../../hardware/assemblies/winch/winch-cover-powered-pole-fascia.scad) — module `wc_print_fascia`; revision 0.1.0.

Catalog lifecycle, procurement, and generated documentation do not establish physical validation. See the owning assembly for evidence and acceptance requirements.
