# Round-pole nut covers and cable guide kit

> Generated from canonical BOM inputs by `pnpm bom:generate`. Do not edit this page by hand.

[BOM](../../README.md) · [All items](README.md) · [Canonical part catalog](../../catalog/parts.json)

- Part ID: `winch-round-pole-covers`
- Unit: each
- Kind: component
- Lifecycle: active
- Disciplines: mechanical
- Traits: fabricated, printed

## Requirements

- Two white sliding rear nut covers, two snug underside closures and one dark two-loom cable guide per winch. Covers use metal saddle rails; remove underside closures before lifting caps. Guide tied to the pole independently of winch load.
- Concept-unvalidated: print fit, underside closure/gravity-stop retention, vibration, UV and cable-clipping force require physical acceptance.

## Notes

Optional round-timber interface; replace the flat-post standoffs/backing plate, do not combine both mounting stacks. No supplier quote or qualified material assertion. See hardware/assemblies/winch/round-pole.md.

## Used in

Quantities are per assembly definition, before build multipliers. Optional and deferred usages are shown even when excluded from a scenario. Procurement stock is not an installed physical owner.

| Assembly or purchasing bucket | Quantity | Inclusion | Usage note |
| --- | ---: | --- | --- |
| [Winch set](../../../docs/assemblies/winch/README.md) | 4 each | optional | Round timber alternative for four winches; replaces flat-post spacer/backing/bolt allowances, not an additional structural stack. |

[Canonical assembly quantities](../../assemblies/assemblies.json)

## BOM reports

- [ARBI V1 — Zagreb repository baseline](../arbi-v1-hr-zagreb.md) — not included by this build/inclusion policy.

## Fabrication

- Process: openscad
- Model status: concept-unvalidated
- [hardware/assemblies/winch/winch-pole-nut-cover.scad](../../../hardware/assemblies/winch/winch-pole-nut-cover.scad) — module `wp_print_nut_cover`; revision 0.1.0.
- [hardware/assemblies/winch/winch-pole-nut-cover-bottom.scad](../../../hardware/assemblies/winch/winch-pole-nut-cover-bottom.scad) — module `wp_print_nut_cover_bottom`; revision 0.1.0.
- [hardware/assemblies/winch/winch-pole-cable-guide.scad](../../../hardware/assemblies/winch/winch-pole-cable-guide.scad) — module `wp_print_cable_guide`; revision 0.1.0.

### Print material estimate

Build arbi-v1; batch represents 1 BOM unit(s). Optional covers for one round-pole mount. The machined metal saddles are not prints.

| Model | Copies in batch | Solid volume per copy |
| --- | ---: | ---: |
| winch-pole-nut-cover r0.1.0 | 2 | 44.800318 cm³ |
| winch-pole-nut-cover-bottom r0.1.0 | 2 | 16.878400 cm³ |
| winch-pole-cable-guide r0.1.0 | 1 | 9.881734 cm³ |

| Material | Density | Single spool | Estimated batch weight | Estimated batch cost |
| --- | ---: | ---: | ---: | ---: |
| [Bambu Lab PLA Basic](https://eu.store.bambulab.com/products/pla-basic-filament) | [1.24 g/cm³](https://store.bblcdn.com/s1/default/58b85d0f3db94878854a28fdb8a0006e/Bambu_PLA_Basic_Technical_Data_Sheet.pdf) | 19.99 EUR / 1000 g | 165.217 g | 3.3 EUR |
| [Bambu Lab PETG Basic](https://eu.store.bambulab.com/products/petg-basic) | [1.25 g/cm³](https://store.bblcdn.com/s1/default/cb94589bf7994fdcbfa833badefae9cd/Bambu_PETG_Basic_Technical_Data_Sheet.pdf) | 18.99 EUR / 1000 g | 166.549 g | 3.16 EUR |
| [Bambu Lab ASA](https://eu.store.bambulab.com/products/asa-filament) (costing selection) | [1.05 g/cm³](https://store.bblcdn.com/ad7b08230c164e72856cffbe06bb7dc9.pdf) | 24.99 EUR / 1000 g | 139.901 g | 3.5 EUR |

Volume evidence: [cad-v0.1.4](https://github.com/gredice/arbi/releases/tag/cad-v0.1.4); [canonical recipes, mesh checksums and source hashes](../../catalog/fabrication.json).

Material consumption only at single 1 kg filament-with-spool MSRP; bulk discounts excluded. EU displayed VAT may change at Croatian checkout; shipping, supports, purge, failed prints, energy, machine time and labour are unknown. PETG is a prototype costing assumption; ASA is used for exposed cover recipes. Solid CAD volume represents fully dense plastic, not slicer infill or measured weight.

Catalog lifecycle, procurement, and generated documentation do not establish physical validation. See the owning assembly for evidence and acceptance requirements.
