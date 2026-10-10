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

Build arbi-v1; batch represents 1 BOM unit(s). Optional covers for one round-pole mount. The machined metal saddles are not prints. Cosmetic shell surfaces use PETG Matte White (35100) or Black (35101) as listed per component; functional parts retain their existing material assumptions. Material and colour selections require physical fit, retention, weather and thermal checks.

| Model | Copies in batch | Material / colour | Solid volume per copy |
| --- | ---: | --- | ---: |
| winch-pole-nut-cover r0.1.0 | 2 | Bambu Lab PETG Matte / white | 44.800318 cm³ |
| winch-pole-nut-cover-bottom r0.1.0 | 2 | Bambu Lab PETG Matte / white | 16.878400 cm³ |
| winch-pole-cable-guide r0.1.0 | 1 | Bambu Lab ASA / black | 9.881734 cm³ |

Selected recipe consumption:

| Material / colour | Roll price basis | Estimated batch weight | Estimated batch cost |
| --- | --- | ---: | ---: |
| [Bambu Lab ASA](https://eu.store.bambulab.com/products/asa-filament) / black | 24.99 EUR / 1000 g; single spool | 10.376 g | 0.26 EUR |
| [Bambu Lab PETG Matte](https://eu.store.bambulab.com/products/petg-matte?id=775952393450868758) / white | 11.39 EUR / 1000 g; 10+ eligible mixed rolls | 169 g | 1.92 EUR |
| **Selected recipe total** | | **179.376 g** | **2.18 EUR** |

Comparisons below assume every component uses the same material; the selected mixed recipe above is costed separately.

| Material | Density | Roll price | Estimated batch weight | Estimated batch cost |
| --- | ---: | ---: | ---: | ---: |
| [Bambu Lab PLA Basic](https://eu.store.bambulab.com/products/pla-basic-filament) | [1.24 g/cm³](https://store.bblcdn.com/s1/default/58b85d0f3db94878854a28fdb8a0006e/Bambu_PLA_Basic_Technical_Data_Sheet.pdf) | 11.99 EUR / 1000 g; 10+ eligible mixed rolls | 165.217 g | 1.98 EUR |
| [Bambu Lab PETG Basic](https://eu.store.bambulab.com/products/petg-basic) | [1.25 g/cm³](https://store.bblcdn.com/s1/default/cb94589bf7994fdcbfa833badefae9cd/Bambu_PETG_Basic_Technical_Data_Sheet.pdf) | 11.39 EUR / 1000 g; 10+ eligible mixed rolls | 166.549 g | 1.9 EUR |
| [Bambu Lab PETG Matte](https://eu.store.bambulab.com/products/petg-matte) | [1.37 g/cm³](https://store.bblcdn.eu/s8/default/240fb0c791fb4903a9d72934895e9a16/PETG_Matte.pdf) | 11.39 EUR / 1000 g; 10+ eligible mixed rolls | 182.538 g | 2.08 EUR |
| [Bambu Lab ASA](https://eu.store.bambulab.com/products/asa-filament) | [1.05 g/cm³](https://store.bblcdn.com/ad7b08230c164e72856cffbe06bb7dc9.pdf) | 24.99 EUR / 1000 g; single spool | 139.901 g | 3.5 EUR |

Volume evidence: [cad-v0.1.12](https://github.com/gredice/arbi/releases/tag/cad-v0.1.12); [canonical recipes, mesh checksums and source hashes](../../catalog/fabrication.json).

Material consumption at observed 10+ mixed eligible 1 kg filament-with-spool bulk rates for PLA Basic, PETG Basic and PETG Matte. The shared Bambu EU mix-and-match basket must contain at least 10 eligible rolls; this is a conditional estimate, not an order or whole-roll procurement total. ASA has no evidenced eligible bulk rate and retains its single-spool price. PETG Matte White/Black is selected only for cosmetic shell surfaces; functional parts retain existing material assumptions. EU displayed VAT may change at Croatian checkout; shipping, supports, purge, failed prints, energy, machine time and labour are unknown. Solid CAD volume represents fully dense plastic, not slicer infill or measured weight.

Catalog lifecycle, procurement, and generated documentation do not establish physical validation. See the owning assembly for evidence and acceptance requirements.
