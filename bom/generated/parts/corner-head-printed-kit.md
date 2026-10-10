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

New printed-head proposal; excluded from the purchasing baseline. Select instead of steel angle/plates, metal saddles and their covers. See docs/assemblies/corner-station/design-package.md. No supplier offer, full fabrication quote or physical qualification asserted. An optional ASA solid-volume material estimate is recorded separately; it is only a costing assumption.

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

### Print material estimate

Build arbi-v1; batch represents 1 BOM unit(s). Optional concept set; excluded from the purchasing baseline. ASA is a costing assumption using the recorded single-spool rate, not a qualified structural material or chosen print process. Fully dense CAD consumption only; physical fit, load, creep and manufacturing labour remain unresolved. Historical metal-head shields, printed carriers and stand adapters are separate alternatives.

| Model | Copies in batch | Material / colour | Solid volume per copy |
| --- | ---: | --- | ---: |
| corner-head-printed-left r0.1.0 | 1 | Bambu Lab ASA / black | 563.335205 cm³ |
| corner-head-printed-right r0.1.0 | 1 | Bambu Lab ASA / black | 563.335205 cm³ |
| corner-head-printed-rear-pad r0.1.0 | 2 | Bambu Lab ASA / black | 80.102232 cm³ |
| corner-head-printed-front-cover r0.1.0 | 1 | Bambu Lab PETG Matte / white | 104.128616 cm³ |
| corner-head-printed-rear-cover r0.1.0 | 1 | Bambu Lab PETG Matte / white | 114.600742 cm³ |

Selected recipe consumption:

| Material / colour | Roll price basis | Estimated batch weight | Estimated batch cost |
| --- | --- | ---: | ---: |
| [Bambu Lab ASA](https://eu.store.bambulab.com/products/asa-filament) / black | 24.99 EUR / 1000 g; single spool | 1351.219 g | 33.77 EUR |
| [Bambu Lab PETG Matte](https://eu.store.bambulab.com/products/petg-matte?id=775952393450868758) / white | 11.39 EUR / 1000 g; 10+ eligible mixed rolls | 299.659 g | 3.41 EUR |
| **Selected recipe total** | | **1650.878 g** | **37.18 EUR** |

Comparisons below assume every component uses the same material; the selected mixed recipe above is costed separately.

| Material | Density | Roll price | Estimated batch weight | Estimated batch cost |
| --- | ---: | ---: | ---: | ---: |
| [Bambu Lab PLA Basic](https://eu.store.bambulab.com/products/pla-basic-filament) | [1.24 g/cm³](https://store.bblcdn.com/s1/default/58b85d0f3db94878854a28fdb8a0006e/Bambu_PLA_Basic_Technical_Data_Sheet.pdf) | 11.99 EUR / 1000 g; 10+ eligible mixed rolls | 1866.949 g | 22.38 EUR |
| [Bambu Lab PETG Basic](https://eu.store.bambulab.com/products/petg-basic) | [1.25 g/cm³](https://store.bblcdn.com/s1/default/cb94589bf7994fdcbfa833badefae9cd/Bambu_PETG_Basic_Technical_Data_Sheet.pdf) | 11.39 EUR / 1000 g; 10+ eligible mixed rolls | 1882.005 g | 21.44 EUR |
| [Bambu Lab PETG Matte](https://eu.store.bambulab.com/products/petg-matte) | [1.37 g/cm³](https://store.bblcdn.eu/s8/default/240fb0c791fb4903a9d72934895e9a16/PETG_Matte.pdf) | 11.39 EUR / 1000 g; 10+ eligible mixed rolls | 2062.678 g | 23.49 EUR |
| [Bambu Lab ASA](https://eu.store.bambulab.com/products/asa-filament) | [1.05 g/cm³](https://store.bblcdn.com/ad7b08230c164e72856cffbe06bb7dc9.pdf) | 24.99 EUR / 1000 g; single spool | 1580.884 g | 39.51 EUR |

Volume evidence: current local OpenSCAD exports; [canonical recipes, mesh checksums and source hashes](../../catalog/fabrication.json).

Material consumption at observed 10+ mixed eligible 1 kg filament-with-spool bulk rates for PLA Basic, PETG Basic and PETG Matte. The shared Bambu EU mix-and-match basket must contain at least 10 eligible rolls; this is a conditional estimate, not an order or whole-roll procurement total. ASA has no evidenced eligible bulk rate and retains its single-spool price. PETG Matte White/Black is selected only for cosmetic shell surfaces; functional parts retain existing material assumptions. EU displayed VAT may change at Croatian checkout; shipping, supports, purge, failed prints, energy, machine time and labour are unknown. Solid CAD volume represents fully dense plastic, not slicer infill or measured weight.

Catalog lifecycle, procurement, and generated documentation do not establish physical validation. See the owning assembly for evidence and acceptance requirements.
