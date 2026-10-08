# Winch bearing/motor mount and guard

> Generated from canonical BOM inputs by `pnpm bom:generate`. Do not edit this page by hand.

[BOM](../../README.md) · [All items](README.md) · [Canonical part catalog](../../catalog/parts.json)

- Part ID: `winch-mount-and-guard`
- Unit: each
- Kind: component
- Lifecycle: active
- Disciplines: mechanical
- Traits: fabricated, printed

## Requirements

- Motor mount, two bearing supports, line guide, coupling guard and weather cover for direct-drive winch.

## Notes

Mount kit: per winch print two bearing lowers, two caps, one motor stand and one coupling guard. Requires separately budgeted rigid base, spacers and fasteners. The full shell is the separate winch-full-cover kit; line guidance, homing and powered slip-ring support remain unfinished. See hardware/assemblies/winch/mount.md and full-cover.md.

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
- [hardware/assemblies/winch/winch-bearing-lower.scad](../../../hardware/assemblies/winch/winch-bearing-lower.scad) — module `wm_bearing_lower`; revision 0.1.0.
- [hardware/assemblies/winch/winch-bearing-cap.scad](../../../hardware/assemblies/winch/winch-bearing-cap.scad) — module `wm_bearing_cap`; revision 0.1.0.
- [hardware/assemblies/winch/winch-motor-stand.scad](../../../hardware/assemblies/winch/winch-motor-stand.scad) — module `wm_motor_stand`; revision 0.1.0.
- [hardware/assemblies/winch/winch-coupling-guard.scad](../../../hardware/assemblies/winch/winch-coupling-guard.scad) — module `wm_coupling_guard`; revision 0.1.1.

### Print material estimate

Build arbi-v1; batch represents 1 BOM unit(s). One mount kit includes two bearing supports/caps, one motor stand and one coupling guard; metal plate, spacers and fasteners belong to winch-mount-hardware.

| Model | Copies in batch | Solid volume per copy |
| --- | ---: | ---: |
| winch-bearing-lower r0.1.0 | 2 | 60.812971 cm³ |
| winch-bearing-cap r0.1.0 | 2 | 5.243271 cm³ |
| winch-motor-stand r0.1.0 | 1 | 156.792774 cm³ |
| winch-coupling-guard r0.1.1 | 1 | 30.825830 cm³ |

| Material | Density | Single spool | Estimated batch weight | Estimated batch cost |
| --- | ---: | ---: | ---: | ---: |
| [Bambu Lab PLA Basic](https://eu.store.bambulab.com/products/pla-basic-filament) | [1.24 g/cm³](https://store.bblcdn.com/s1/default/58b85d0f3db94878854a28fdb8a0006e/Bambu_PLA_Basic_Technical_Data_Sheet.pdf) | 19.99 EUR / 1000 g | 396.467 g | 7.93 EUR |
| [Bambu Lab PETG Basic](https://eu.store.bambulab.com/products/petg-basic) (costing selection) | [1.25 g/cm³](https://store.bblcdn.com/s1/default/cb94589bf7994fdcbfa833badefae9cd/Bambu_PETG_Basic_Technical_Data_Sheet.pdf) | 18.99 EUR / 1000 g | 399.664 g | 7.59 EUR |
| [Bambu Lab ASA](https://eu.store.bambulab.com/products/asa-filament) | [1.05 g/cm³](https://store.bblcdn.com/ad7b08230c164e72856cffbe06bb7dc9.pdf) | 24.99 EUR / 1000 g | 335.718 g | 8.39 EUR |

Volume evidence: [cad-v0.1.4](https://github.com/gredice/arbi/releases/tag/cad-v0.1.4); [canonical recipes, mesh checksums and source hashes](../../catalog/fabrication.json).

Material consumption only at single 1 kg filament-with-spool MSRP; bulk discounts excluded. EU displayed VAT may change at Croatian checkout; shipping, supports, purge, failed prints, energy, machine time and labour are unknown. PETG is a prototype costing assumption; ASA is used for exposed cover recipes. Solid CAD volume represents fully dense plastic, not slicer infill or measured weight.

Catalog lifecycle, procurement, and generated documentation do not establish physical validation. See the owning assembly for evidence and acceptance requirements.
