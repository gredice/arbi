# Printed corner-head carrier, pads and covers kit

> Generated from canonical BOM inputs by `pnpm bom:generate`. Do not edit this page by hand.

[BOM](../../README.md) · [All items](README.md) · [Canonical part catalog](../../catalog/parts.json)

- Part ID: `corner-head-printed-kit`
- Unit: each
- Kind: component
- Lifecycle: planned
- Disciplines: mechanical
- Traits: fabricated, printed

## Requirements

- One left carrier, one right carrier, two copies of the rear pad, one front cosmetic cover and one rear cosmetic cover per station: six installed prints from five distinct models. Default round 120; separate round 100/140, square 100 and powered 4.5 mm line studies. No steel angle, custom machined saddle or rear metal plate in this variant.
- Primary carriers and rear pads are load-bearing printed concepts. PAHT-CF or tested ASA are candidates, not qualified materials; orientation, printer/slicer process, conditioning, hole finishing, bolt-seat pressure, creep, cycles, weather and complete-head proof tests remain required. Cosmetic cover straps carry no line or guy load.
- Two M12 through-bolts at Z45/155 and two M8 cross-bolts at X=post radius+50, Z100/190 join the selected kit. Provisional 8 mm terminal lug and 9 mm tang gap require received BA01090 pin/tang measurements. Fitted thin-line keeper and independent guy connection remain unresolved. Nominal equal-tension horizontal-span pose articulates the block 45 degrees about Y with assumed 40 mm pin-to-sheave distance: pin X=post radius+149.2657 passive /148.3657 powered, Z165; sheave X=post radius+177.55/176.65, Z136.7157. Other angles, unequal tensions, friction and received articulation require physical review.

## Notes

New printed-head proposal; excluded from the purchasing baseline. Select instead of steel angle/plates, metal saddles and their covers. See docs/assemblies/corner-station/design-package.md. No supplier offer, cost or physical qualification asserted.

## Used in

Quantities are per assembly definition, before build multipliers. Optional and deferred usages are shown even when excluded from a scenario. Procurement stock is not an installed physical owner.

| Assembly or purchasing bucket | Quantity | Inclusion | Usage note |
| --- | ---: | --- | --- |
| [Corner support set](../../../docs/assemblies/corner-station/README.md) | 4 each | optional | Proposed printed alternative: four kits, each left/right carrier, two rear pads and two covers. Replaces steel angles/backing plates and excludes metal-saddle/collar alternatives. |

[Canonical assembly quantities](../../assemblies/assemblies.json)

## BOM reports

- [ARBI V1 — Zagreb repository baseline](../arbi-v1-hr-zagreb.md) — not included by this build/inclusion policy.

## Fabrication

- Process: openscad
- Model status: concept-unvalidated
- [hardware/assemblies/corner-station/corner-head-printed-left.scad](../../../hardware/assemblies/corner-station/corner-head-printed-left.scad) — module `corner_head_printed_left`; revision 0.1.0.
- [hardware/assemblies/corner-station/corner-head-printed-right.scad](../../../hardware/assemblies/corner-station/corner-head-printed-right.scad) — module `corner_head_printed_right`; revision 0.1.0.
- [hardware/assemblies/corner-station/corner-head-printed-rear-pad.scad](../../../hardware/assemblies/corner-station/corner-head-printed-rear-pad.scad) — module `corner_head_printed_rear_pad`; revision 0.1.0.
- [hardware/assemblies/corner-station/corner-head-printed-front-cover.scad](../../../hardware/assemblies/corner-station/corner-head-printed-front-cover.scad) — module `corner_head_printed_front_cover`; revision 0.1.0.
- [hardware/assemblies/corner-station/corner-head-printed-rear-cover.scad](../../../hardware/assemblies/corner-station/corner-head-printed-rear-cover.scad) — module `corner_head_printed_rear_cover`; revision 0.1.0.

Catalog lifecycle, procurement, and generated documentation do not establish physical validation. See the owning assembly for evidence and acceptance requirements.
