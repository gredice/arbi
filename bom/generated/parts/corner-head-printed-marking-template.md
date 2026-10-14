# Printed-head shared timber centre marking template

> Generated from canonical BOM inputs by `pnpm bom:generate`. Do not edit this page by hand.

[BOM](../../README.md) · [All items](README.md) · [Canonical part catalog](../../catalog/parts.json)

- Part ID: `corner-head-printed-marking-template`
- Unit: each
- Kind: component
- Lifecycle: planned
- Disciplines: mechanical
- Traits: fabricated, printed

## Requirements

- One shared 205 x 50 x 4 mm printed marking tool for the four-station set, with 3 mm centre marks at 45/155 mm. Check scale and selected print dimensions; remove before drilling controlled coaxial 13 mm timber holes. Not a drill bush or installed structural part.

## Design warnings

- **Warning:** Fabrication status is concept-unvalidated; fit, materials and physical acceptance still need committed evidence.
- **Warning:** This part is planned; confirm its specification and selection with committed evidence.

## Notes

Selected printed-head development configuration in the current BOM. Historical steel-angle, backing-plate, metal-saddle and split-clamp alternatives are archived. See docs/assemblies/corner-station/design-package.md. No supplier offer, full fabrication quote or physical qualification asserted. ASA solid-volume material consumption is a costing assumption, not a qualified process.

## Used in

Quantities are per assembly definition, before build multipliers. Optional and deferred usages are shown even when excluded from a scenario. Procurement stock is not an installed physical owner.

| Assembly or purchasing bucket | Quantity | Inclusion | Usage note |
| --- | ---: | --- | --- |
| [Corner support set](../../../docs/assemblies/corner-station/README.md) | 1 each | base | One shared 205 mm printed-head marking tool for four heads; not an installed structural part. |

[Canonical assembly quantities](../../assemblies/assemblies.json)

## BOM reports

- [ARBI V1 — Zagreb repository baseline](../arbi-v1-hr-zagreb.md#required-parts-by-physical-owner-or-procurement-bucket) — included.

## Fabrication

- Process: openscad
- Model status: concept-unvalidated
- [hardware/assemblies/corner-station/corner-head-printed-template.scad](../../../hardware/assemblies/corner-station/corner-head-printed-template.scad) — module `corner_head_printed_template`; revision 0.1.0.

### Print material estimate

Build arbi-v1; batch represents 1 BOM unit(s). Selected printed-head development configuration in the current BOM. ASA is a costing assumption using the recorded single-spool rate, not a qualified structural material or print process. Fully dense CAD consumption only; physical fit, load, creep and manufacturing labour remain unresolved.

| Model | Copies in batch | Material / colour | Solid volume per copy |
| --- | ---: | --- | ---: |
| corner-head-printed-template r0.1.0 | 1 | Bambu Lab ASA / black | 40.865757 cm³ |

Selected recipe consumption:

| Material / colour | Roll price basis | Estimated batch weight | Estimated batch cost |
| --- | --- | ---: | ---: |
| [Bambu Lab ASA](https://eu.store.bambulab.com/products/asa-filament) / black | 24.99 EUR / 1000 g; single spool | 42.909 g | 1.07 EUR |
| **Selected recipe total** | | **42.909 g** | **1.07 EUR** |

Comparisons below assume every component uses the same material; the selected mixed recipe above is costed separately.

| Material | Density | Roll price | Estimated batch weight | Estimated batch cost |
| --- | ---: | ---: | ---: | ---: |
| [Bambu Lab PLA Basic](https://eu.store.bambulab.com/products/pla-basic-filament) | [1.24 g/cm³](https://store.bblcdn.com/s1/default/58b85d0f3db94878854a28fdb8a0006e/Bambu_PLA_Basic_Technical_Data_Sheet.pdf) | 11.99 EUR / 1000 g; 10+ eligible mixed rolls | 50.674 g | 0.61 EUR |
| [Bambu Lab PETG Basic](https://eu.store.bambulab.com/products/petg-basic) | [1.25 g/cm³](https://store.bblcdn.com/s1/default/cb94589bf7994fdcbfa833badefae9cd/Bambu_PETG_Basic_Technical_Data_Sheet.pdf) | 11.39 EUR / 1000 g; 10+ eligible mixed rolls | 51.082 g | 0.58 EUR |
| [Bambu Lab PETG Matte](https://eu.store.bambulab.com/products/petg-matte) | [1.37 g/cm³](https://store.bblcdn.eu/s8/default/240fb0c791fb4903a9d72934895e9a16/PETG_Matte.pdf) | 11.39 EUR / 1000 g; 10+ eligible mixed rolls | 55.986 g | 0.64 EUR |
| [Bambu Lab ASA](https://eu.store.bambulab.com/products/asa-filament) | [1.05 g/cm³](https://store.bblcdn.com/ad7b08230c164e72856cffbe06bb7dc9.pdf) | 24.99 EUR / 1000 g; single spool | 42.909 g | 1.07 EUR |

Volume evidence: [cad-v0.1.32](https://github.com/gredice/arbi/releases/tag/cad-v0.1.32); [canonical recipes, mesh checksums and source hashes](../../catalog/fabrication.json).

Material consumption at observed 10+ mixed eligible 1 kg filament-with-spool bulk rates for PLA Basic, PETG Basic and PETG Matte. The shared Bambu EU mix-and-match basket must contain at least 10 eligible rolls; this is a conditional estimate, not an order or whole-roll procurement total. ASA has no evidenced eligible bulk rate and retains its single-spool price. PETG Matte White/Black is selected only for cosmetic shell surfaces; functional parts retain existing material assumptions. EU displayed VAT may change at Croatian checkout; shipping, supports, purge, failed prints, energy, machine time and labour are unknown. Solid CAD volume represents fully dense plastic, not slicer infill or measured weight.

Catalog lifecycle, procurement, and generated documentation do not establish physical validation. See the owning assembly for evidence and acceptance requirements.
