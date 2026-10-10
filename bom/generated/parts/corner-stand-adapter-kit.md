# Optional WT-806 indoor corner-station adapter kit

> Generated from canonical BOM inputs by `pnpm bom:generate`. Do not edit this page by hand.

[BOM](../../README.md) · [All items](README.md) · [Canonical part catalog](../../catalog/parts.json)

- Part ID: `corner-stand-adapter-kit`
- Unit: each
- Kind: component
- Lifecycle: active
- Disciplines: mechanical
- Traits: fabricated, printed

## Requirements

- One stand kit: two head fronts, two head rears, two winch fronts and two winch rears; eight installed prints from four models, revision 0.1.0.
- Default head tube 26 mm, lower winch tube 35 mm; measure both stands and export matching halves for any parameter change. No tube drilling or top-thread attachment.
- Round-120 printed carriers at 110 mm M12 pitch; passive winch original 50 x 120 mm M8 base-hole pattern. Short M12 x 90 and M8 x 40 mounting bolts replace timber bolts.
- Per stand, buy separately: four M6 x 60 and four M6 x 70 bolts, sixteen M6 washers, eight M6 locking nuts; two M12 x 90 bolts, four large M12 washers, two M12 locking nuts; four M8 x 40 bolts, eight M8 washers, four M8 locking nuts.
- Unloaded indoor fit/rotation development only. No validated clamp strength, tube-crush limit, creep, side-load or tipping capacity. Actual assembled mass and independent retention must be checked.

## Notes

The owner has two WT-806 stands (ASIN B000LWEA0I). Two optional kits produce sixteen prints. Reuse existing carrier cross-bolts, pulley and compatible pin; omit timber rear pads, long through-bolts and rear cosmetic cover. Hardware/printing/acceptance: hardware/assemblies/corner-station/stand-adapter.md. No supplier offer or sliced-material estimate is assigned.

## Used in

Quantities are per assembly definition, before build multipliers. Optional and deferred usages are shown even when excluded from a scenario. Procurement stock is not an installed physical owner.

| Assembly or purchasing bucket | Quantity | Inclusion | Usage note |
| --- | ---: | --- | --- |
| [Corner support set](../../../docs/assemblies/corner-station/README.md) | 2 each | optional | Two owned WT-806 stands for indoor development; sixteen adapter prints total. Excluded from installed baseline. Bought short bolts, washers and nuts are separate; see fixture instructions. |

[Canonical assembly quantities](../../assemblies/assemblies.json)

## BOM reports

- [ARBI V1 — Zagreb repository baseline](../arbi-v1-hr-zagreb.md) — not included by this build/inclusion policy.

## Fabrication

- Process: openscad
- Model status: concept-unvalidated
- [hardware/assemblies/corner-station/corner-stand-head-front.scad](../../../hardware/assemblies/corner-station/corner-stand-head-front.scad) — module `csa_print_front`; revision 0.1.0.
- [hardware/assemblies/corner-station/corner-stand-head-rear.scad](../../../hardware/assemblies/corner-station/corner-stand-head-rear.scad) — module `csa_print_rear`; revision 0.1.0.
- [hardware/assemblies/corner-station/corner-stand-winch-front.scad](../../../hardware/assemblies/corner-station/corner-stand-winch-front.scad) — module `csa_print_front`; revision 0.1.0.
- [hardware/assemblies/corner-station/corner-stand-winch-rear.scad](../../../hardware/assemblies/corner-station/corner-stand-winch-rear.scad) — module `csa_print_rear`; revision 0.1.0.

### Print material estimate

Build arbi-v1; batch represents 1 BOM unit(s). Optional concept set; excluded from the purchasing baseline. ASA is a costing assumption using the recorded single-spool rate, not a qualified structural material or chosen print process. Fully dense CAD consumption only; physical fit, load, creep and manufacturing labour remain unresolved. Historical metal-head shields, printed carriers and stand adapters are separate alternatives.

| Model | Copies in batch | Material / colour | Solid volume per copy |
| --- | ---: | --- | ---: |
| corner-stand-head-front r0.1.0 | 2 | Bambu Lab ASA / black | 260.280311 cm³ |
| corner-stand-head-rear r0.1.0 | 2 | Bambu Lab ASA / black | 100.468360 cm³ |
| corner-stand-winch-front r0.1.0 | 2 | Bambu Lab ASA / black | 218.332513 cm³ |
| corner-stand-winch-rear r0.1.0 | 2 | Bambu Lab ASA / black | 112.409719 cm³ |

Selected recipe consumption:

| Material / colour | Roll price basis | Estimated batch weight | Estimated batch cost |
| --- | --- | ---: | ---: |
| [Bambu Lab ASA](https://eu.store.bambulab.com/products/asa-filament) / black | 24.99 EUR / 1000 g; single spool | 1452.131 g | 36.29 EUR |
| **Selected recipe total** | | **1452.131 g** | **36.29 EUR** |

Comparisons below assume every component uses the same material; the selected mixed recipe above is costed separately.

| Material | Density | Roll price | Estimated batch weight | Estimated batch cost |
| --- | ---: | ---: | ---: | ---: |
| [Bambu Lab PLA Basic](https://eu.store.bambulab.com/products/pla-basic-filament) | [1.24 g/cm³](https://store.bblcdn.com/s1/default/58b85d0f3db94878854a28fdb8a0006e/Bambu_PLA_Basic_Technical_Data_Sheet.pdf) | 11.99 EUR / 1000 g; 10+ eligible mixed rolls | 1714.897 g | 20.56 EUR |
| [Bambu Lab PETG Basic](https://eu.store.bambulab.com/products/petg-basic) | [1.25 g/cm³](https://store.bblcdn.com/s1/default/cb94589bf7994fdcbfa833badefae9cd/Bambu_PETG_Basic_Technical_Data_Sheet.pdf) | 11.39 EUR / 1000 g; 10+ eligible mixed rolls | 1728.727 g | 19.69 EUR |
| [Bambu Lab PETG Matte](https://eu.store.bambulab.com/products/petg-matte) | [1.37 g/cm³](https://store.bblcdn.eu/s8/default/240fb0c791fb4903a9d72934895e9a16/PETG_Matte.pdf) | 11.39 EUR / 1000 g; 10+ eligible mixed rolls | 1894.685 g | 21.58 EUR |
| [Bambu Lab ASA](https://eu.store.bambulab.com/products/asa-filament) | [1.05 g/cm³](https://store.bblcdn.com/ad7b08230c164e72856cffbe06bb7dc9.pdf) | 24.99 EUR / 1000 g; single spool | 1452.131 g | 36.29 EUR |

Volume evidence: current local OpenSCAD exports; [canonical recipes, mesh checksums and source hashes](../../catalog/fabrication.json).

Material consumption at observed 10+ mixed eligible 1 kg filament-with-spool bulk rates for PLA Basic, PETG Basic and PETG Matte. The shared Bambu EU mix-and-match basket must contain at least 10 eligible rolls; this is a conditional estimate, not an order or whole-roll procurement total. ASA has no evidenced eligible bulk rate and retains its single-spool price. PETG Matte White/Black is selected only for cosmetic shell surfaces; functional parts retain existing material assumptions. EU displayed VAT may change at Croatian checkout; shipping, supports, purge, failed prints, energy, machine time and labour are unknown. Solid CAD volume represents fully dense plastic, not slicer infill or measured weight.

Catalog lifecycle, procurement, and generated documentation do not establish physical validation. See the owning assembly for evidence and acceptance requirements.
