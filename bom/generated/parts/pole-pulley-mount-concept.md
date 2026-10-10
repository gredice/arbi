# Round-pole split-clamp pulley mount concept pair

> Generated from canonical BOM inputs by `pnpm bom:generate`. Do not edit this page by hand.

[BOM](../../README.md) · [All items](README.md) · [Canonical part catalog](../../catalog/parts.json)

- Part ID: `pole-pulley-mount-concept`
- Unit: each
- Kind: component
- Lifecycle: planned
- Disciplines: mechanical
- Traits: fabricated

## Requirements

- Alternative concept for a measured 100–140 mm round pole. One front collar/clevis plus one rear collar, with four nominal M8 clamp bolts and a separate M8 pulley pin.
- STLs support fit and appearance mock-ups only. Structural material, manufacturing process, friction/slip resistance, timber movement and allowable loads are unverified.

## Notes

Not included in any build or purchasing quantity; does not replace the through-bolted top-pulley-bracket baseline. Nominal hardware and generic pulley envelopes are not supplied fabrication parts.

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
- [hardware/assemblies/corner-station/pole-pulley-mount-front.scad](../../../hardware/assemblies/corner-station/pole-pulley-mount-front.scad) — module `pole_pulley_mount_front`; revision 0.1.0.
- [hardware/assemblies/corner-station/pole-pulley-mount-rear.scad](../../../hardware/assemblies/corner-station/pole-pulley-mount-rear.scad) — module `pole_pulley_mount_rear`; revision 0.1.0.

### Print material estimate

Build arbi-v1; batch represents 1 BOM unit(s). Deferred concept clamp pair; excluded from the base build. Pricing does not qualify its load-bearing use.

| Model | Copies in batch | Material / colour | Solid volume per copy |
| --- | ---: | --- | ---: |
| pole-pulley-mount-front r0.1.0 | 1 | Bambu Lab PETG Basic / black | 357.917151 cm³ |
| pole-pulley-mount-rear r0.1.0 | 1 | Bambu Lab PETG Basic / black | 264.313526 cm³ |

Selected recipe consumption:

| Material / colour | Roll price basis | Estimated batch weight | Estimated batch cost |
| --- | --- | ---: | ---: |
| [Bambu Lab PETG Basic](https://eu.store.bambulab.com/products/petg-basic) / black | 11.39 EUR / 1000 g; 10+ eligible mixed rolls | 777.788 g | 8.86 EUR |
| **Selected recipe total** | | **777.788 g** | **8.86 EUR** |

Comparisons below assume every component uses the same material; the selected mixed recipe above is costed separately.

| Material | Density | Roll price | Estimated batch weight | Estimated batch cost |
| --- | ---: | ---: | ---: | ---: |
| [Bambu Lab PLA Basic](https://eu.store.bambulab.com/products/pla-basic-filament) | [1.24 g/cm³](https://store.bblcdn.com/s1/default/58b85d0f3db94878854a28fdb8a0006e/Bambu_PLA_Basic_Technical_Data_Sheet.pdf) | 11.99 EUR / 1000 g; 10+ eligible mixed rolls | 771.566 g | 9.25 EUR |
| [Bambu Lab PETG Basic](https://eu.store.bambulab.com/products/petg-basic) | [1.25 g/cm³](https://store.bblcdn.com/s1/default/cb94589bf7994fdcbfa833badefae9cd/Bambu_PETG_Basic_Technical_Data_Sheet.pdf) | 11.39 EUR / 1000 g; 10+ eligible mixed rolls | 777.788 g | 8.86 EUR |
| [Bambu Lab PETG Matte](https://eu.store.bambulab.com/products/petg-matte) | [1.37 g/cm³](https://store.bblcdn.eu/s8/default/240fb0c791fb4903a9d72934895e9a16/PETG_Matte.pdf) | 11.39 EUR / 1000 g; 10+ eligible mixed rolls | 852.456 g | 9.71 EUR |
| [Bambu Lab ASA](https://eu.store.bambulab.com/products/asa-filament) | [1.05 g/cm³](https://store.bblcdn.com/ad7b08230c164e72856cffbe06bb7dc9.pdf) | 24.99 EUR / 1000 g; single spool | 653.342 g | 16.33 EUR |

Volume evidence: [cad-v0.1.12](https://github.com/gredice/arbi/releases/tag/cad-v0.1.12); [canonical recipes, mesh checksums and source hashes](../../catalog/fabrication.json).

Material consumption at observed 10+ mixed eligible 1 kg filament-with-spool bulk rates for PLA Basic, PETG Basic and PETG Matte. The shared Bambu EU mix-and-match basket must contain at least 10 eligible rolls; this is a conditional estimate, not an order or whole-roll procurement total. ASA has no evidenced eligible bulk rate and retains its single-spool price. PETG Matte White/Black is selected only for cosmetic shell surfaces; functional parts retain existing material assumptions. EU displayed VAT may change at Croatian checkout; shipping, supports, purge, failed prints, energy, machine time and labour are unknown. Solid CAD volume represents fully dense plastic, not slicer infill or measured weight.

Catalog lifecycle, procurement, and generated documentation do not establish physical validation. See the owning assembly for evidence and acceptance requirements.
