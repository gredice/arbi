# Top-pulley Dyneema keeper / weather cover

> Generated from canonical BOM inputs by `pnpm bom:generate`. Do not edit this page by hand.

[BOM](../../README.md) · [All items](README.md) · [Canonical part catalog](../../catalog/parts.json)

- Part ID: `top-pulley-keeper`
- Unit: each
- Kind: component
- Lifecycle: active
- Disciplines: mechanical
- Traits: cable, fabricated, printed

## Requirements

- ASA preferred; PETG acceptable for prototype. Close side gaps around 1.5 mm Dyneema, keep line centred, prevent jump-off, shield direct rain/UV, drain below and remain removable for inspection.

## Notes

Non-structural only; must not carry pulley or cable load and should not rub the line during normal running.

## Used in

Quantities are per assembly definition, before build multipliers. Optional and deferred usages are shown even when excluded from a scenario. Procurement stock is not an installed physical owner.

| Assembly or purchasing bucket | Quantity | Inclusion | Usage note |
| --- | ---: | --- | --- |
| [Corner support set](../../../docs/assemblies/corner-station/README.md) | 4 each | base | — |

[Canonical assembly quantities](../../assemblies/assemblies.json)

## BOM reports

- [ARBI V1 — Zagreb repository baseline](../arbi-v1-hr-zagreb.md#required-parts-by-physical-owner-or-procurement-bucket) — included.

## Fabrication

- Process: openscad
- Model status: concept-unvalidated
- [hardware/assemblies/corner-station/top-pulley-keeper.scad](../../../hardware/assemblies/corner-station/top-pulley-keeper.scad) — module `top_pulley_keeper`; revision 0.1.0.

### Print material estimate

Build arbi-v1; batch represents 1 BOM unit(s). One line keeper per corner pulley.

| Model | Copies in batch | Solid volume per copy |
| --- | ---: | ---: |
| top-pulley-keeper r0.1.0 | 1 | 22.146573 cm³ |

| Material | Density | Single spool | Estimated batch weight | Estimated batch cost |
| --- | ---: | ---: | ---: | ---: |
| [Bambu Lab PLA Basic](https://eu.store.bambulab.com/products/pla-basic-filament) | [1.24 g/cm³](https://store.bblcdn.com/s1/default/58b85d0f3db94878854a28fdb8a0006e/Bambu_PLA_Basic_Technical_Data_Sheet.pdf) | 19.99 EUR / 1000 g | 27.462 g | 0.55 EUR |
| [Bambu Lab PETG Basic](https://eu.store.bambulab.com/products/petg-basic) (costing selection) | [1.25 g/cm³](https://store.bblcdn.com/s1/default/cb94589bf7994fdcbfa833badefae9cd/Bambu_PETG_Basic_Technical_Data_Sheet.pdf) | 18.99 EUR / 1000 g | 27.683 g | 0.53 EUR |
| [Bambu Lab ASA](https://eu.store.bambulab.com/products/asa-filament) | [1.05 g/cm³](https://store.bblcdn.com/ad7b08230c164e72856cffbe06bb7dc9.pdf) | 24.99 EUR / 1000 g | 23.254 g | 0.58 EUR |

Volume evidence: [cad-v0.1.4](https://github.com/gredice/arbi/releases/tag/cad-v0.1.4); [canonical recipes, mesh checksums and source hashes](../../catalog/fabrication.json).

Material consumption only at single 1 kg filament-with-spool MSRP; bulk discounts excluded. EU displayed VAT may change at Croatian checkout; shipping, supports, purge, failed prints, energy, machine time and labour are unknown. PETG is a prototype costing assumption; ASA is used for exposed cover recipes. Solid CAD volume represents fully dense plastic, not slicer infill or measured weight.

Catalog lifecycle, procurement, and generated documentation do not establish physical validation. See the owning assembly for evidence and acceptance requirements.
