# Corner head removable weather shield kit

> Generated from canonical BOM inputs by `pnpm bom:generate`. Do not edit this page by hand.

[BOM](../../README.md) · [All items](README.md) · [Canonical part catalog](../../catalog/parts.json)

- Part ID: `corner-head-weather-kit`
- Unit: each
- Kind: component
- Lifecycle: planned
- Disciplines: mechanical
- Traits: fabricated, printed

## Requirements

- One stem hood, one separate roof and one rear cover per station. Non-structural ASA candidate; pulley remains visible. Match post/angle/bolt configuration; three replaceable straps required.

## Notes

Historical metal-head alternative; excluded from baseline and printed-head selection. Do not combine its geometry or hardware stack with the printed carrier. See docs/assemblies/corner-station/design-package.md#historical-metal-alternatives. No full fabrication price or engineering qualification asserted. Optional PETG Matte White material consumption is estimated separately, without selecting a qualified print process.

## Used in

Quantities are per assembly definition, before build multipliers. Optional and deferred usages are shown even when excluded from a scenario. Procurement stock is not an installed physical owner.

| Assembly or purchasing bucket | Quantity | Inclusion | Usage note |
| --- | ---: | --- | --- |
| [Corner support set](../../../docs/assemblies/corner-station/README.md) | 4 each | optional | Historical metal head only: four three-piece non-structural shield kits, not printed-carrier covers or line keepers. |

[Canonical assembly quantities](../../assemblies/assemblies.json)

## BOM reports

- [ARBI V1 — Zagreb repository baseline](../arbi-v1-hr-zagreb.md) — not included by this build/inclusion policy.

## Fabrication

- Process: openscad
- Model status: concept-unvalidated
- [hardware/assemblies/corner-station/corner-head-hood.scad](../../../hardware/assemblies/corner-station/corner-head-hood.scad) — module `corner_head_hood`; revision 0.1.0.
- [hardware/assemblies/corner-station/corner-head-rear-cover.scad](../../../hardware/assemblies/corner-station/corner-head-rear-cover.scad) — module `corner_head_rear_cover`; revision 0.1.0.
- [hardware/assemblies/corner-station/corner-head-roof.scad](../../../hardware/assemblies/corner-station/corner-head-roof.scad) — module `corner_head_roof`; revision 0.1.0.

### Print material estimate

Build arbi-v1; batch represents 1 BOM unit(s). Optional historical metal-head shield set; excluded from the purchasing baseline. PETG Matte White is the material consumption costing assumption using the recorded bulk rate, not a qualified weather material or chosen print process. Fully dense CAD consumption only; physical fit, weather performance and manufacturing labour remain unresolved. Printed carriers and stand adapters are separate alternatives.

| Model | Copies in batch | Material / colour | Solid volume per copy |
| --- | ---: | --- | ---: |
| corner-head-hood r0.1.0 | 1 | Bambu Lab PETG Matte / white | 84.644851 cm³ |
| corner-head-roof r0.1.0 | 1 | Bambu Lab PETG Matte / white | 62.757844 cm³ |
| corner-head-rear-cover r0.1.0 | 1 | Bambu Lab PETG Matte / white | 145.729470 cm³ |

Selected recipe consumption:

| Material / colour | Roll price basis | Estimated batch weight | Estimated batch cost |
| --- | --- | ---: | ---: |
| [Bambu Lab PETG Matte](https://eu.store.bambulab.com/products/petg-matte?id=775952393450868758) / white | 11.39 EUR / 1000 g; 10+ eligible mixed rolls | 401.591 g | 4.57 EUR |
| **Selected recipe total** | | **401.591 g** | **4.57 EUR** |

Comparisons below assume every component uses the same material; the selected mixed recipe above is costed separately.

| Material | Density | Roll price | Estimated batch weight | Estimated batch cost |
| --- | ---: | ---: | ---: | ---: |
| [Bambu Lab PLA Basic](https://eu.store.bambulab.com/products/pla-basic-filament) | [1.24 g/cm³](https://store.bblcdn.com/s1/default/58b85d0f3db94878854a28fdb8a0006e/Bambu_PLA_Basic_Technical_Data_Sheet.pdf) | 11.99 EUR / 1000 g; 10+ eligible mixed rolls | 363.484 g | 4.36 EUR |
| [Bambu Lab PETG Basic](https://eu.store.bambulab.com/products/petg-basic) | [1.25 g/cm³](https://store.bblcdn.com/s1/default/cb94589bf7994fdcbfa833badefae9cd/Bambu_PETG_Basic_Technical_Data_Sheet.pdf) | 11.39 EUR / 1000 g; 10+ eligible mixed rolls | 366.415 g | 4.17 EUR |
| [Bambu Lab PETG Matte](https://eu.store.bambulab.com/products/petg-matte) | [1.37 g/cm³](https://store.bblcdn.eu/s8/default/240fb0c791fb4903a9d72934895e9a16/PETG_Matte.pdf) | 11.39 EUR / 1000 g; 10+ eligible mixed rolls | 401.591 g | 4.57 EUR |
| [Bambu Lab ASA](https://eu.store.bambulab.com/products/asa-filament) | [1.05 g/cm³](https://store.bblcdn.com/ad7b08230c164e72856cffbe06bb7dc9.pdf) | 24.99 EUR / 1000 g; single spool | 307.789 g | 7.69 EUR |

Volume evidence: current local OpenSCAD exports; [canonical recipes, mesh checksums and source hashes](../../catalog/fabrication.json).

Material consumption at observed 10+ mixed eligible 1 kg filament-with-spool bulk rates for PLA Basic, PETG Basic and PETG Matte. The shared Bambu EU mix-and-match basket must contain at least 10 eligible rolls; this is a conditional estimate, not an order or whole-roll procurement total. ASA has no evidenced eligible bulk rate and retains its single-spool price. PETG Matte White/Black is selected only for cosmetic shell surfaces; functional parts retain existing material assumptions. EU displayed VAT may change at Croatian checkout; shipping, supports, purge, failed prints, energy, machine time and labour are unknown. Solid CAD volume represents fully dense plastic, not slicer infill or measured weight.

Catalog lifecycle, procurement, and generated documentation do not establish physical validation. See the owning assembly for evidence and acceptance requirements.
