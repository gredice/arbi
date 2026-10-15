# Removable charcoal dock lower enclosure

> Generated from canonical BOM inputs by `pnpm bom:generate`. Do not edit this page by hand.

[BOM](../../README.md) · [All items](README.md) · [Canonical part catalog](../../catalog/parts.json)

- Part ID: `dock-lower-enclosure`
- Unit: each
- Kind: component
- Lifecycle: active
- Disciplines: mechanical
- Traits: fabricated, printed

## Requirements

- Three identical cardinal panels plus one rear panel form a removable 300 mm R40 underside tray and conical bowl, with four diagonal 18 mm cable corridors.
- Nominal 2.8 mm normal conical skin from Z105 to Z171, 3 mm tray from Z171 to Z174, Ø148 top opening and 70 mm open-top rear arm notch. Dedicated crown fasteners only; no retention load or sealing qualification.

## Design warnings

- **Warning:** Fabrication status is concept-unvalidated; fit, materials and physical acceptance still need committed evidence.

## Notes

DOCK-IF-01 supported-dummy bench only. Remove lower panels before servicing the white crown. Bought hardware counted separately; print/supports, real line slope, weather and installed loads remain unqualified.

## Used in

Quantities are per assembly definition, before build multipliers. Optional and deferred usages are shown even when excluded from a scenario. Procurement stock is not an installed physical owner.

| Assembly or purchasing bucket | Quantity | Inclusion | Usage note |
| --- | ---: | --- | --- |
| [Dock](../../../docs/assemblies/dock/README.md) | 1 each | base | — |

[Canonical assembly quantities](../../assemblies/assemblies.json)

## BOM reports

- [ARBI V1 — Zagreb repository baseline](../arbi-v1-hr-zagreb.md#required-parts-by-physical-owner-or-procurement-bucket) — included.

## Fabrication

- Process: openscad
- Model status: concept-unvalidated
- [hardware/assemblies/dock/dock-lower-panel.scad](../../../hardware/assemblies/dock/dock-lower-panel.scad) — module `dock_lower_panel`; revision 0.1.0.
- [hardware/assemblies/dock/dock-lower-rear-panel.scad](../../../hardware/assemblies/dock/dock-lower-rear-panel.scad) — module `dock_lower_rear_panel`; revision 0.1.0.

### Print material estimate

Build arbi-v1; batch represents 1 BOM unit(s). Solid nominal CAD material estimate for removable cosmetic panels; supports, slicing, weather, received fit and strength remain unresolved.

| Model | Copies in batch | Material / colour | Solid volume per copy |
| --- | ---: | --- | ---: |
| dock-lower-panel r0.1.0 | 3 | Bambu Lab PETG Matte / black | 86.435493 cm³ |
| dock-lower-rear-panel r0.1.0 | 1 | Bambu Lab PETG Matte / black | 54.244505 cm³ |

Selected recipe consumption:

| Material / colour | Roll price basis | Estimated batch weight | Estimated batch cost |
| --- | --- | ---: | ---: |
| [Bambu Lab PETG Matte](https://eu.store.bambulab.com/products/petg-matte?id=775952393450868774) / black | 11.39 EUR / 1000 g; 10+ eligible mixed rolls | 429.565 g | 4.89 EUR |
| **Selected recipe total** | | **429.565 g** | **4.89 EUR** |

Comparisons below assume every component uses the same material; the selected mixed recipe above is costed separately.

| Material | Density | Roll price | Estimated batch weight | Estimated batch cost |
| --- | ---: | ---: | ---: | ---: |
| [Bambu Lab PLA Basic](https://eu.store.bambulab.com/products/pla-basic-filament) | [1.24 g/cm³](https://store.bblcdn.com/s1/default/58b85d0f3db94878854a28fdb8a0006e/Bambu_PLA_Basic_Technical_Data_Sheet.pdf) | 11.99 EUR / 1000 g; 10+ eligible mixed rolls | 388.803 g | 4.66 EUR |
| [Bambu Lab PETG Basic](https://eu.store.bambulab.com/products/petg-basic) | [1.25 g/cm³](https://store.bblcdn.com/s1/default/cb94589bf7994fdcbfa833badefae9cd/Bambu_PETG_Basic_Technical_Data_Sheet.pdf) | 11.39 EUR / 1000 g; 10+ eligible mixed rolls | 391.939 g | 4.46 EUR |
| [Bambu Lab PETG Matte](https://eu.store.bambulab.com/products/petg-matte) | [1.37 g/cm³](https://store.bblcdn.eu/s8/default/240fb0c791fb4903a9d72934895e9a16/PETG_Matte.pdf) | 11.39 EUR / 1000 g; 10+ eligible mixed rolls | 429.565 g | 4.89 EUR |
| [Bambu Lab ASA](https://eu.store.bambulab.com/products/asa-filament) | [1.05 g/cm³](https://store.bblcdn.com/ad7b08230c164e72856cffbe06bb7dc9.pdf) | 24.99 EUR / 1000 g; single spool | 329.229 g | 8.23 EUR |

Volume evidence: current local OpenSCAD exports; [canonical recipes, mesh checksums and source hashes](../../catalog/fabrication.json).

Material consumption at observed 10+ mixed eligible 1 kg filament-with-spool bulk rates for PLA Basic, PETG Basic and PETG Matte. The shared Bambu EU mix-and-match basket must contain at least 10 eligible rolls; this is a conditional estimate, not an order or whole-roll procurement total. ASA has no evidenced eligible bulk rate and retains its single-spool price. PETG Matte White/Black is selected only for cosmetic shell surfaces; functional parts retain existing material assumptions. EU displayed VAT may change at Croatian checkout; shipping, supports, purge, failed prints, energy, machine time and labour are unknown. Solid CAD volume represents fully dense plastic, not slicer infill or measured weight.

Catalog lifecycle, procurement, and generated documentation do not establish physical validation. See the owning assembly for evidence and acceptance requirements.
