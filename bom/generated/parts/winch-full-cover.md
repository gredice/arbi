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

### Print material estimate

Build arbi-v1; batch represents 4 BOM unit(s). Four-winch pole-routing cover batch per full-cover.md; 126 installed prints, excluding four optional removable bench blanks. Per-unit values are batch averages.

| Model | Copies in batch | Solid volume per copy |
| --- | ---: | ---: |
| winch-cover-passive-left r0.3.0 | 3 | 374.072990 cm³ |
| winch-cover-passive-middle r0.2.0 | 3 | 250.605223 cm³ |
| winch-cover-passive-right r0.3.0 | 3 | 449.144055 cm³ |
| winch-cover-powered-left r0.2.0 | 1 | 367.652286 cm³ |
| winch-cover-powered-middle r0.2.0 | 1 | 242.744073 cm³ |
| winch-cover-powered-pole-middle r0.1.0 | 1 | 240.640072 cm³ |
| winch-cover-powered-transition r0.2.0 | 1 | 241.880800 cm³ |
| winch-cover-powered-right r0.3.0 | 1 | 437.959117 cm³ |
| winch-cover-clip r0.2.0 | 56 | 6.118286 cm³ |
| winch-cover-cable-anchor r0.1.0 | 4 | 4.514930 cm³ |
| winch-cover-passive-shutter r0.2.0 | 6 | 79.436506 cm³ |
| winch-cover-powered-shutter r0.2.0 | 4 | 76.694057 cm³ |
| winch-cover-passive-fascia r0.1.0 | 15 | 73.077741 cm³ |
| winch-cover-powered-fascia r0.1.0 | 9 | 70.548380 cm³ |
| winch-cover-passive-pole-fascia r0.1.0 | 3 | 76.231311 cm³ |
| winch-cover-powered-pole-fascia r0.1.0 | 1 | 73.701924 cm³ |
| winch-cover-passive-rear-left r0.1.0 | 3 | 74.675803 cm³ |
| winch-cover-powered-rear-left r0.1.0 | 2 | 86.862141 cm³ |
| winch-cover-passive-rear-right r0.1.0 | 6 | 99.716010 cm³ |
| winch-cover-powered-rear-right r0.1.0 | 3 | 100.859819 cm³ |

| Material | Density | Single spool | Estimated batch weight | Estimated batch cost |
| --- | ---: | ---: | ---: | ---: |
| [Bambu Lab PLA Basic](https://eu.store.bambulab.com/products/pla-basic-filament) | [1.24 g/cm³](https://store.bblcdn.com/s1/default/58b85d0f3db94878854a28fdb8a0006e/Bambu_PLA_Basic_Technical_Data_Sheet.pdf) | 19.99 EUR / 1000 g | 11443.398 g | 228.75 EUR |
| [Bambu Lab PETG Basic](https://eu.store.bambulab.com/products/petg-basic) | [1.25 g/cm³](https://store.bblcdn.com/s1/default/cb94589bf7994fdcbfa833badefae9cd/Bambu_PETG_Basic_Technical_Data_Sheet.pdf) | 18.99 EUR / 1000 g | 11535.683 g | 219.06 EUR |
| [Bambu Lab ASA](https://eu.store.bambulab.com/products/asa-filament) (costing selection) | [1.05 g/cm³](https://store.bblcdn.com/ad7b08230c164e72856cffbe06bb7dc9.pdf) | 24.99 EUR / 1000 g | 9689.974 g | 242.15 EUR |

Volume evidence: [cad-v0.1.4](https://github.com/gredice/arbi/releases/tag/cad-v0.1.4); [canonical recipes, mesh checksums and source hashes](../../catalog/fabrication.json).

Material consumption only at single 1 kg filament-with-spool MSRP; bulk discounts excluded. EU displayed VAT may change at Croatian checkout; shipping, supports, purge, failed prints, energy, machine time and labour are unknown. PETG is a prototype costing assumption; ASA is used for exposed cover recipes. Solid CAD volume represents fully dense plastic, not slicer infill or measured weight.

Catalog lifecycle, procurement, and generated documentation do not establish physical validation. See the owning assembly for evidence and acceptance requirements.
