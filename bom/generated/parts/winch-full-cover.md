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

- One kit per winch: passive left/middle/right main panels (3) plus two identical payout shutters; powered left/two middle/transition/right main panels (5) plus four identical payout shutters. Four base clips per main-panel position and one fixed-loom anchor.
- Warm-white rounded removable shell over existing dark core. Full-width 24 mm payout slot for 1.5 mm passive or nominal 4.5 mm hybrid line; no fixed fairlead or completed slip-ring support.
- Concept-unvalidated: drilling, fit, full-travel abrasion, ventilation, heat, rain, strength and safe guarding require physical acceptance.

## Notes

Three passive plus one powered kit: 14 main panels, 10 payout shutters, 56 clips and four cable anchors (84 added prints). No drivetrain reprints. Existing aluminium plates need dedicated cover/anchor holes. Remove shutters along +Y before lifting main panels along +Z; see hardware/assemblies/winch/full-cover.md.

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
- [hardware/assemblies/winch/winch-cover-passive-left.scad](../../../hardware/assemblies/winch/winch-cover-passive-left.scad) — module `wc_print_panel`; revision 0.1.0.
- [hardware/assemblies/winch/winch-cover-passive-middle.scad](../../../hardware/assemblies/winch/winch-cover-passive-middle.scad) — module `wc_print_panel`; revision 0.1.0.
- [hardware/assemblies/winch/winch-cover-passive-right.scad](../../../hardware/assemblies/winch/winch-cover-passive-right.scad) — module `wc_print_panel`; revision 0.1.0.
- [hardware/assemblies/winch/winch-cover-powered-left.scad](../../../hardware/assemblies/winch/winch-cover-powered-left.scad) — module `wc_print_panel`; revision 0.1.0.
- [hardware/assemblies/winch/winch-cover-powered-middle.scad](../../../hardware/assemblies/winch/winch-cover-powered-middle.scad) — module `wc_print_panel`; revision 0.1.0.
- [hardware/assemblies/winch/winch-cover-powered-transition.scad](../../../hardware/assemblies/winch/winch-cover-powered-transition.scad) — module `wc_print_panel`; revision 0.1.0.
- [hardware/assemblies/winch/winch-cover-powered-right.scad](../../../hardware/assemblies/winch/winch-cover-powered-right.scad) — module `wc_print_panel`; revision 0.1.0.
- [hardware/assemblies/winch/winch-cover-clip.scad](../../../hardware/assemblies/winch/winch-cover-clip.scad) — module `wc_print_clip`; revision 0.1.0.
- [hardware/assemblies/winch/winch-cover-cable-anchor.scad](../../../hardware/assemblies/winch/winch-cover-cable-anchor.scad) — module `wc_print_cable_anchor`; revision 0.1.0.
- [hardware/assemblies/winch/winch-cover-passive-shutter.scad](../../../hardware/assemblies/winch/winch-cover-passive-shutter.scad) — module `wc_print_shutter`; revision 0.1.0.
- [hardware/assemblies/winch/winch-cover-powered-shutter.scad](../../../hardware/assemblies/winch/winch-cover-powered-shutter.scad) — module `wc_print_shutter`; revision 0.1.0.

Catalog lifecycle, procurement, and generated documentation do not establish physical validation. See the owning assembly for evidence and acceptance requirements.
