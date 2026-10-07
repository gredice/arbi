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

- One kit per winch: passive 3 main panels, 2 payout shutters, 6 fascia strips, 3 rear shield segments and one removable bench blank; powered 5 main panels, 4 shutters, 10 fascia strips, 5 rear shield segments and one blank. Four r0.2.0 base clips per main-panel position and one fixed-loom anchor.
- Warm-white rounded removable shell over existing dark core. Full-width 24 mm payout slot for 1.5 mm passive or nominal 4.5 mm hybrid line; no fixed fairlead or completed slip-ring support.
- Concept-unvalidated: drilling, fit, full-travel abrasion, ventilation, heat, rain, strength and safe guarding require physical acceptance.

## Notes

Three passive plus one powered kit: 14 main panels, 10 payout shutters, 56 clips, four cable anchors, 28 fascia strips, 14 rear shield segments and four optional bench blanks (130 prints including blanks). Reprint main panels, shutters and clips at r0.2.0; reuse drivetrain and anchors. Fascia and rear shields conceal all represented enclosure fasteners. Remove the bench blank for the 100 mm nominal post interface. Physical snap retention, received hardware and support fit remain unverified. See hardware/assemblies/winch/full-cover.md.

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
- [hardware/assemblies/winch/winch-cover-passive-left.scad](../../../hardware/assemblies/winch/winch-cover-passive-left.scad) — module `wc_print_panel`; revision 0.2.0.
- [hardware/assemblies/winch/winch-cover-passive-middle.scad](../../../hardware/assemblies/winch/winch-cover-passive-middle.scad) — module `wc_print_panel`; revision 0.2.0.
- [hardware/assemblies/winch/winch-cover-passive-right.scad](../../../hardware/assemblies/winch/winch-cover-passive-right.scad) — module `wc_print_panel`; revision 0.2.0.
- [hardware/assemblies/winch/winch-cover-powered-left.scad](../../../hardware/assemblies/winch/winch-cover-powered-left.scad) — module `wc_print_panel`; revision 0.2.0.
- [hardware/assemblies/winch/winch-cover-powered-middle.scad](../../../hardware/assemblies/winch/winch-cover-powered-middle.scad) — module `wc_print_panel`; revision 0.2.0.
- [hardware/assemblies/winch/winch-cover-powered-transition.scad](../../../hardware/assemblies/winch/winch-cover-powered-transition.scad) — module `wc_print_panel`; revision 0.2.0.
- [hardware/assemblies/winch/winch-cover-powered-right.scad](../../../hardware/assemblies/winch/winch-cover-powered-right.scad) — module `wc_print_panel`; revision 0.2.0.
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

Catalog lifecycle, procurement, and generated documentation do not establish physical validation. See the owning assembly for evidence and acceptance requirements.
