# Single-layer grooved winch drum

> Generated from canonical BOM inputs by `pnpm bom:generate`. Do not edit this page by hand.

[BOM](../../README.md) · [All items](README.md) · [Canonical part catalog](../../catalog/parts.json)

- Part ID: `winch-drum`
- Unit: each
- Kind: component
- Lifecycle: active
- Disciplines: mechanical
- Traits: fabricated, printed

## Requirements

- Direct-drive, single-layer grooved drum on independent 8 mm shaft. No GT2 pulley, belt or gearbox in V1.

## Notes

One assembled drum per BOM unit. Print three passive kits and one powered kit using hardware/assemblies/winch/README.md; source list is a variant/component library, not one copy of every source per drum. PLA first prototype; later ASA requires separate fit/process qualification. Full-travel powered drum is substantially wider and its shaft deflection is unvalidated.

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
- [hardware/assemblies/winch/winch-drum-alignment-pin.scad](../../../hardware/assemblies/winch/winch-drum-alignment-pin.scad) — module `wd_alignment_pin`; revision 0.1.0.
- [hardware/assemblies/winch/winch-drum-clamp-half.scad](../../../hardware/assemblies/winch/winch-drum-clamp-half.scad) — module `wd_clamp_half`; revision 0.1.0.
- [hardware/assemblies/winch/winch-drum-flange.scad](../../../hardware/assemblies/winch/winch-drum-flange.scad) — module `wd_flange`; revision 0.1.0.
- [hardware/assemblies/winch/winch-drum-passive-1.scad](../../../hardware/assemblies/winch/winch-drum-passive-1.scad) — module `wd_body_section`; revision 0.1.0.
- [hardware/assemblies/winch/winch-drum-passive-2.scad](../../../hardware/assemblies/winch/winch-drum-passive-2.scad) — module `wd_body_section`; revision 0.1.0.
- [hardware/assemblies/winch/winch-drum-powered-1.scad](../../../hardware/assemblies/winch/winch-drum-powered-1.scad) — module `wd_body_section`; revision 0.1.0.
- [hardware/assemblies/winch/winch-drum-powered-2.scad](../../../hardware/assemblies/winch/winch-drum-powered-2.scad) — module `wd_body_section`; revision 0.1.0.
- [hardware/assemblies/winch/winch-drum-powered-3.scad](../../../hardware/assemblies/winch/winch-drum-powered-3.scad) — module `wd_body_section`; revision 0.1.0.
- [hardware/assemblies/winch/winch-drum-tail-clamp.scad](../../../hardware/assemblies/winch/winch-drum-tail-clamp.scad) — module `wd_tail_clamp`; revision 0.1.0.
- [hardware/assemblies/winch/winch-drum-flange-right.scad](../../../hardware/assemblies/winch/winch-drum-flange-right.scad) — module `wd_flange_right`; revision 0.1.0.

### Print material estimate

Build arbi-v1; batch represents 4 BOM unit(s). Four-drum batch: three passive kits and one powered kit, including repeated flanges, clamps and pins; per-unit values are batch averages.

| Model | Copies in batch | Solid volume per copy |
| --- | ---: | ---: |
| winch-drum-passive-1 r0.1.0 | 3 | 316.427023 cm³ |
| winch-drum-passive-2 r0.1.0 | 3 | 316.426147 cm³ |
| winch-drum-powered-1 r0.1.0 | 1 | 456.629544 cm³ |
| winch-drum-powered-2 r0.1.0 | 1 | 454.324400 cm³ |
| winch-drum-powered-3 r0.1.0 | 1 | 456.627803 cm³ |
| winch-drum-flange r0.1.0 | 4 | 75.053615 cm³ |
| winch-drum-flange-right r0.1.0 | 4 | 75.053615 cm³ |
| winch-drum-clamp-half r0.1.0 | 8 | 13.614323 cm³ |
| winch-drum-tail-clamp r0.1.0 | 4 | 1.742899 cm³ |
| winch-drum-alignment-pin r0.1.0 | 13 | 0.156072 cm³ |

| Material | Density | Single spool | Estimated batch weight | Estimated batch cost |
| --- | ---: | ---: | ---: | ---: |
| [Bambu Lab PLA Basic](https://eu.store.bambulab.com/products/pla-basic-filament) | [1.24 g/cm³](https://store.bblcdn.com/s1/default/58b85d0f3db94878854a28fdb8a0006e/Bambu_PLA_Basic_Technical_Data_Sheet.pdf) | 19.99 EUR / 1000 g | 4940.762 g | 98.77 EUR |
| [Bambu Lab PETG Basic](https://eu.store.bambulab.com/products/petg-basic) (costing selection) | [1.25 g/cm³](https://store.bblcdn.com/s1/default/cb94589bf7994fdcbfa833badefae9cd/Bambu_PETG_Basic_Technical_Data_Sheet.pdf) | 18.99 EUR / 1000 g | 4980.607 g | 94.58 EUR |
| [Bambu Lab ASA](https://eu.store.bambulab.com/products/asa-filament) | [1.05 g/cm³](https://store.bblcdn.com/ad7b08230c164e72856cffbe06bb7dc9.pdf) | 24.99 EUR / 1000 g | 4183.71 g | 104.55 EUR |

Volume evidence: [cad-v0.1.4](https://github.com/gredice/arbi/releases/tag/cad-v0.1.4); [canonical recipes, mesh checksums and source hashes](../../catalog/fabrication.json).

Material consumption only at single 1 kg filament-with-spool MSRP; bulk discounts excluded. EU displayed VAT may change at Croatian checkout; shipping, supports, purge, failed prints, energy, machine time and labour are unknown. PETG is a prototype costing assumption; ASA is used for exposed cover recipes. Solid CAD volume represents fully dense plastic, not slicer infill or measured weight.

Catalog lifecycle, procurement, and generated documentation do not establish physical validation. See the owning assembly for evidence and acceptance requirements.
