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

Build arbi-v1; batch represents 1 BOM unit(s). One mount kit includes two bearing supports/caps, one motor stand and one coupling guard; metal plate, spacers and fasteners belong to winch-mount-hardware. Cosmetic shell surfaces use PETG Matte White (35100) or Black (35101) as listed per component; functional parts retain their existing material assumptions. Material and colour selections require physical fit, retention, weather and thermal checks.

| Model | Copies in batch | Material / colour | Solid volume per copy |
| --- | ---: | --- | ---: |
| winch-bearing-lower r0.1.0 | 2 | Bambu Lab PETG Basic / black | 60.812971 cm³ |
| winch-bearing-cap r0.1.0 | 2 | Bambu Lab PETG Basic / black | 5.243271 cm³ |
| winch-motor-stand r0.1.0 | 1 | Bambu Lab PETG Basic / black | 156.792774 cm³ |
| winch-coupling-guard r0.1.1 | 1 | Bambu Lab PETG Matte / white | 30.825830 cm³ |

Selected recipe consumption:

| Material / colour | Roll price basis | Estimated batch weight | Estimated batch cost |
| --- | --- | ---: | ---: |
| [Bambu Lab PETG Matte](https://eu.store.bambulab.com/products/petg-matte?id=775952393450868758) / white | 11.39 EUR / 1000 g; 10+ eligible mixed rolls | 42.231 g | 0.48 EUR |
| [Bambu Lab PETG Basic](https://eu.store.bambulab.com/products/petg-basic) / black | 11.39 EUR / 1000 g; 10+ eligible mixed rolls | 361.132 g | 4.11 EUR |
| **Selected recipe total** | | **403.363 g** | **4.59 EUR** |

Comparisons below assume every component uses the same material; the selected mixed recipe above is costed separately.

| Material | Density | Roll price | Estimated batch weight | Estimated batch cost |
| --- | ---: | ---: | ---: | ---: |
| [Bambu Lab PLA Basic](https://eu.store.bambulab.com/products/pla-basic-filament) | [1.24 g/cm³](https://store.bblcdn.com/s1/default/58b85d0f3db94878854a28fdb8a0006e/Bambu_PLA_Basic_Technical_Data_Sheet.pdf) | 11.99 EUR / 1000 g; 10+ eligible mixed rolls | 396.467 g | 4.75 EUR |
| [Bambu Lab PETG Basic](https://eu.store.bambulab.com/products/petg-basic) | [1.25 g/cm³](https://store.bblcdn.com/s1/default/cb94589bf7994fdcbfa833badefae9cd/Bambu_PETG_Basic_Technical_Data_Sheet.pdf) | 11.39 EUR / 1000 g; 10+ eligible mixed rolls | 399.664 g | 4.55 EUR |
| [Bambu Lab PETG Matte](https://eu.store.bambulab.com/products/petg-matte) | [1.37 g/cm³](https://store.bblcdn.eu/s8/default/240fb0c791fb4903a9d72934895e9a16/PETG_Matte.pdf) | 11.39 EUR / 1000 g; 10+ eligible mixed rolls | 438.032 g | 4.99 EUR |
| [Bambu Lab ASA](https://eu.store.bambulab.com/products/asa-filament) | [1.05 g/cm³](https://store.bblcdn.com/ad7b08230c164e72856cffbe06bb7dc9.pdf) | 24.99 EUR / 1000 g; single spool | 335.718 g | 8.39 EUR |

Volume evidence: [cad-v0.1.4](https://github.com/gredice/arbi/releases/tag/cad-v0.1.4); [canonical recipes, mesh checksums and source hashes](../../catalog/fabrication.json).

Material consumption at observed 10+ mixed eligible 1 kg filament-with-spool bulk rates for PLA Basic, PETG Basic and PETG Matte. The shared Bambu EU mix-and-match basket must contain at least 10 eligible rolls; this is a conditional estimate, not an order or whole-roll procurement total. ASA has no evidenced eligible bulk rate and retains its single-spool price. PETG Matte White/Black is selected only for cosmetic shell surfaces; functional parts retain existing material assumptions. EU displayed VAT may change at Croatian checkout; shipping, supports, purge, failed prints, energy, machine time and labour are unknown. Solid CAD volume represents fully dense plastic, not slicer infill or measured weight.

Catalog lifecycle, procurement, and generated documentation do not establish physical validation. See the owning assembly for evidence and acceptance requirements.
