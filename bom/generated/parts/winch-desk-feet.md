# Optional passive winch desk-foot kit

> Generated from canonical BOM inputs by `pnpm bom:generate`. Do not edit this page by hand.

[BOM](../../README.md) · [All items](README.md) · [Canonical part catalog](../../catalog/parts.json)

- Part ID: `winch-desk-feet`
- Unit: each
- Kind: component
- Lifecycle: active
- Disciplines: mechanical
- Traits: fabricated, printed

## Requirements

- One bench kit contains two short and two long feet for the passive 550 x 180 x 8 mm base, using its existing 50 x 120 mm post-hole pattern.
- 35 mm plate underside height; existing mounting fasteners may protrude at most 25 mm below the plate.
- Attach with four M8 x 35 bolts, eight standard M8 washers and four M8 nuts; these are separate from the printed parts.
- Unloaded desk assembly and rotation checks only; physical fit and stability are unverified.

## Notes

Optional bench fixture, excluded from installed-system assembly quantities and procurement totals. Print settings and installation: hardware/assemblies/winch/desk-feet.md. No structural or loaded-line qualification.

## Used in

Quantities are per assembly definition, before build multipliers. Optional and deferred usages are shown even when excluded from a scenario. Procurement stock is not an installed physical owner.

| Assembly or purchasing bucket | Quantity | Inclusion | Usage note |
| --- | ---: | --- | --- |

No assembly usage recorded.

[Canonical assembly quantities](../../assemblies/assemblies.json)

## BOM reports

- [ARBI V1 — Zagreb repository baseline](../arbi-v1-hr-zagreb.md) — not included by this build/inclusion policy.

## Fabrication

- Process: openscad
- Model status: concept-unvalidated
- [hardware/assemblies/winch/winch-desk-foot-short.scad](../../../hardware/assemblies/winch/winch-desk-foot-short.scad) — module `wdf_print_foot`; revision 0.1.0.
- [hardware/assemblies/winch/winch-desk-foot-long.scad](../../../hardware/assemblies/winch/winch-desk-foot-long.scad) — module `wdf_print_foot`; revision 0.1.0.

### Print material estimate

Build arbi-v1; batch represents 1 BOM unit(s). Optional desk-foot kit for one winch; excluded from the base build.

| Model | Copies in batch | Solid volume per copy |
| --- | ---: | ---: |
| winch-desk-foot-short r0.1.0 | 2 | 74.282202 cm³ |
| winch-desk-foot-long r0.1.0 | 2 | 105.802227 cm³ |

| Material | Density | Single spool | Estimated batch weight | Estimated batch cost |
| --- | ---: | ---: | ---: | ---: |
| [Bambu Lab PLA Basic](https://eu.store.bambulab.com/products/pla-basic-filament) | [1.24 g/cm³](https://store.bblcdn.com/s1/default/58b85d0f3db94878854a28fdb8a0006e/Bambu_PLA_Basic_Technical_Data_Sheet.pdf) | 19.99 EUR / 1000 g | 446.609 g | 8.93 EUR |
| [Bambu Lab PETG Basic](https://eu.store.bambulab.com/products/petg-basic) (costing selection) | [1.25 g/cm³](https://store.bblcdn.com/s1/default/cb94589bf7994fdcbfa833badefae9cd/Bambu_PETG_Basic_Technical_Data_Sheet.pdf) | 18.99 EUR / 1000 g | 450.211 g | 8.55 EUR |
| [Bambu Lab ASA](https://eu.store.bambulab.com/products/asa-filament) | [1.05 g/cm³](https://store.bblcdn.com/ad7b08230c164e72856cffbe06bb7dc9.pdf) | 24.99 EUR / 1000 g | 378.177 g | 9.45 EUR |

Volume evidence: [cad-v0.1.4](https://github.com/gredice/arbi/releases/tag/cad-v0.1.4); [canonical recipes, mesh checksums and source hashes](../../catalog/fabrication.json).

Material consumption only at single 1 kg filament-with-spool MSRP; bulk discounts excluded. EU displayed VAT may change at Croatian checkout; shipping, supports, purge, failed prints, energy, machine time and labour are unknown. PETG is a prototype costing assumption; ASA is used for exposed cover recipes. Solid CAD volume represents fully dense plastic, not slicer infill or measured weight.

Catalog lifecycle, procurement, and generated documentation do not establish physical validation. See the owning assembly for evidence and acceptance requirements.
