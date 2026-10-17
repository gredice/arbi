# Printed corner-head carrier, pads and covers kit

> Generated from canonical BOM inputs by `pnpm bom:generate`. Do not edit this page by hand.

[BOM](../../README.md) · [All items](README.md) · [Canonical part catalog](../../catalog/parts.json)

- Part ID: `corner-head-printed-kit`
- Unit: each
- Kind: component
- Lifecycle: planned
- Disciplines: mechanical
- Traits: fabricated, printed

## Requirements

- One left carrier, one right carrier, two copies of the rear pad, one front cosmetic cover and one rear cosmetic cover per station: six installed prints from five distinct models. Default round 120; separate round 100/140, square 100 and powered 4.5 mm line studies. No steel angle, custom machined saddle or rear metal plate in this variant. Carrier halves r1.1.0 and pads/covers r0.2.0 replace earlier prints; all six installed prints must be reprinted together for tie-free retention. The shared marking template is unchanged.
- Primary carriers and rear pads are load-bearing printed concepts. PAHT-CF or tested ASA are candidates, not qualified materials; orientation, printer/slicer process, conditioning, hole finishing, bolt-seat pressure, creep, cycles, weather and complete-head proof tests remain required. Independent M3 cosmetic cover screws carry no line or guy load.
- Two M12 through-bolts at Z45/155 and two M8 cross-bolts at X=post radius+50, Z100/190 join the selected kit. Measured Barton interface: 14.8 mm rounded central lug inside 15.8 mm clear tang gap, 5.2 mm bore for the supplied 4.7 mm retained pin. Equal-tension horizontal-span pose rotates -45 degrees about Y with measured 42 mm pin-to-sheave centres: pin X=post radius+147.8515 passive /146.9515 powered, Z165; sheave X=post radius+177.55/176.65, Z135.3015. These allowances and pose require physical inspection. Groove seating, thin-line keeper, guy connection, other angles and unequal tension remain unresolved.
- No ties, straps or strap channels in the revised head. Four M3 x 12 screws per cover enter from both sides into captive plain hex nuts in added carrier bosses or rear-pad ears; each cover is independently removable without loosening M12/M8 structural hardware. See docs/assemblies/corner-station/tie-free-covers.md and proposal #230. Physical fit, retention, creep, vibration and weather acceptance remain pending.

## Design warnings

- **Warning:** Fabrication status is concept-unvalidated; fit, materials and physical acceptance still need committed evidence.
- **Warning:** This part is planned; confirm its specification and selection with committed evidence.

## Notes

Selected printed-head development configuration in the current BOM. Historical steel-angle, backing-plate, metal-saddle and split-clamp alternatives are archived. See docs/assemblies/corner-station/design-package.md. No supplier offer, full fabrication quote or physical qualification asserted. ASA solid-volume material consumption is a costing assumption, not a qualified process.

## Used in

Quantities are per assembly definition, before build multipliers. Optional and deferred usages are shown even when excluded from a scenario. Procurement stock is not an installed physical owner.

| Assembly or purchasing bucket | Quantity | Inclusion | Usage note |
| --- | ---: | --- | --- |
| [Corner support set](../../../docs/assemblies/corner-station/README.md) | 4 each | base | Selected development configuration: four kits, each left/right carrier, two rear pads and two covers. Printed load-bearing parts remain concept-unvalidated. |

[Canonical assembly quantities](../../assemblies/assemblies.json)

## BOM reports

- [ARBI V1 — Zagreb repository baseline](../arbi-v1-hr-zagreb.md#required-parts-by-physical-owner-or-procurement-bucket) — included.

## Fabrication

- Process: openscad
- Model status: concept-unvalidated
- [hardware/assemblies/corner-station/corner-head-printed-left.scad](../../../hardware/assemblies/corner-station/corner-head-printed-left.scad) — module `corner_head_printed_left`; revision 1.1.0.
- [hardware/assemblies/corner-station/corner-head-printed-right.scad](../../../hardware/assemblies/corner-station/corner-head-printed-right.scad) — module `corner_head_printed_right`; revision 1.1.0.
- [hardware/assemblies/corner-station/corner-head-printed-rear-pad.scad](../../../hardware/assemblies/corner-station/corner-head-printed-rear-pad.scad) — module `corner_head_printed_rear_pad`; revision 0.2.0.
- [hardware/assemblies/corner-station/corner-head-printed-front-cover.scad](../../../hardware/assemblies/corner-station/corner-head-printed-front-cover.scad) — module `corner_head_printed_front_cover`; revision 0.2.0.
- [hardware/assemblies/corner-station/corner-head-printed-rear-cover.scad](../../../hardware/assemblies/corner-station/corner-head-printed-rear-cover.scad) — module `corner_head_printed_rear_cover`; revision 0.2.0.

### Print material estimate

Build arbi-v1; batch represents 1 BOM unit(s). Selected printed-head development configuration in the current BOM. ASA is a costing assumption using the recorded single-spool rate, not a qualified structural material or print process. Fully dense CAD consumption only; physical fit, load, creep and manufacturing labour remain unresolved.

| Model | Copies in batch | Material / colour | Solid volume per copy |
| --- | ---: | --- | ---: |
| corner-head-printed-left r1.1.0 | 1 | Bambu Lab ASA / black | 576.133210 cm³ |
| corner-head-printed-right r1.1.0 | 1 | Bambu Lab ASA / black | 576.133209 cm³ |
| corner-head-printed-rear-pad r0.2.0 | 2 | Bambu Lab ASA / black | 84.908368 cm³ |
| corner-head-printed-front-cover r0.2.0 | 1 | Bambu Lab PETG Matte / white | 104.271461 cm³ |
| corner-head-printed-rear-cover r0.2.0 | 1 | Bambu Lab PETG Matte / white | 114.791580 cm³ |

Selected recipe consumption:

| Material / colour | Roll price basis | Estimated batch weight | Estimated batch cost |
| --- | --- | ---: | ---: |
| [Bambu Lab ASA](https://eu.store.bambulab.com/products/asa-filament) / black | 24.99 EUR / 1000 g; single spool | 1388.187 g | 34.69 EUR |
| [Bambu Lab PETG Matte](https://eu.store.bambulab.com/products/petg-matte?id=775952393450868758) / white | 11.39 EUR / 1000 g; 10+ eligible mixed rolls | 300.116 g | 3.42 EUR |
| **Selected recipe total** | | **1688.304 g** | **38.11 EUR** |

Comparisons below assume every component uses the same material; the selected mixed recipe above is costed separately.

| Material | Density | Roll price | Estimated batch weight | Estimated batch cost |
| --- | ---: | ---: | ---: | ---: |
| [Bambu Lab PLA Basic](https://eu.store.bambulab.com/products/pla-basic-filament) | [1.24 g/cm³](https://store.bblcdn.com/s1/default/58b85d0f3db94878854a28fdb8a0006e/Bambu_PLA_Basic_Technical_Data_Sheet.pdf) | 11.99 EUR / 1000 g; 10+ eligible mixed rolls | 1911.021 g | 22.91 EUR |
| [Bambu Lab PETG Basic](https://eu.store.bambulab.com/products/petg-basic) | [1.25 g/cm³](https://store.bblcdn.com/s1/default/cb94589bf7994fdcbfa833badefae9cd/Bambu_PETG_Basic_Technical_Data_Sheet.pdf) | 11.39 EUR / 1000 g; 10+ eligible mixed rolls | 1926.433 g | 21.94 EUR |
| [Bambu Lab PETG Matte](https://eu.store.bambulab.com/products/petg-matte) | [1.37 g/cm³](https://store.bblcdn.eu/s8/default/240fb0c791fb4903a9d72934895e9a16/PETG_Matte.pdf) | 11.39 EUR / 1000 g; 10+ eligible mixed rolls | 2111.37 g | 24.05 EUR |
| [Bambu Lab ASA](https://eu.store.bambulab.com/products/asa-filament) | [1.05 g/cm³](https://store.bblcdn.com/ad7b08230c164e72856cffbe06bb7dc9.pdf) | 24.99 EUR / 1000 g; single spool | 1618.204 g | 40.44 EUR |

Volume evidence: current local OpenSCAD exports; [canonical recipes, mesh checksums and source hashes](../../catalog/fabrication.json).

Material consumption at observed 10+ mixed eligible 1 kg filament-with-spool bulk rates for PLA Basic, PETG Basic and PETG Matte. The shared Bambu EU mix-and-match basket must contain at least 10 eligible rolls; this is a conditional estimate, not an order or whole-roll procurement total. ASA has no evidenced eligible bulk rate and retains its single-spool price. PETG Matte White/Black is selected only for cosmetic shell surfaces; functional parts retain existing material assumptions. EU displayed VAT may change at Croatian checkout; shipping, supports, purge, failed prints, energy, machine time and labour are unknown. Solid CAD volume represents fully dense plastic, not slicer infill or measured weight.

Catalog lifecycle, procurement, and generated documentation do not establish physical validation. See the owning assembly for evidence and acceptance requirements.
