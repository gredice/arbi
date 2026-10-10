# DOCK-IF-01 fork, structural pod bridge and stud print set

> Generated from canonical BOM inputs by `pnpm bom:generate`. Do not edit this page by hand.

[BOM](../../README.md) · [All items](README.md) · [Canonical part catalog](../../catalog/parts.json)

- Part ID: `dock-latch-hardware`
- Unit: each
- Kind: component
- Lifecycle: active
- Disciplines: mechanical
- Traits: fabricated, printed

## Requirements

- One manually released sliding fork, one fixed structural bridge, four captive shoes and one axial-bolt stud. Spring force/product and stationary actuator circuit remain unselected.

## Notes

DOCK-IF-01 bench-development kit, not accepted for suspended installation. Bought hardware is counted separately.

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
- [hardware/assemblies/dock/dock-latch-fork.scad](../../../hardware/assemblies/dock/dock-latch-fork.scad) — module `dock_latch_fork`; revision 0.1.0.
- [hardware/assemblies/dock/dock-pod-bridge.scad](../../../hardware/assemblies/dock/dock-pod-bridge.scad) — module `dock_pod_bridge`; revision 0.1.0.
- [hardware/assemblies/dock/dock-pod-bridge-shoe.scad](../../../hardware/assemblies/dock/dock-pod-bridge-shoe.scad) — module `dock_pod_bridge_shoe`; revision 0.1.0.
- [hardware/assemblies/dock/dock-pod-stud.scad](../../../hardware/assemblies/dock/dock-pod-stud.scad) — module `dock_pod_stud`; revision 0.1.0.

### Print material estimate

Build arbi-v1; batch represents 1 BOM unit(s). Solid CAD volume material estimate for one DOCK-IF-01 bench kit; slicing, supports, load and outdoor acceptance pending.

| Model | Copies in batch | Material / colour | Solid volume per copy |
| --- | ---: | --- | ---: |
| dock-latch-fork r0.1.0 | 1 | Bambu Lab PETG Basic / black | 7.021294 cm³ |
| dock-pod-bridge r0.1.0 | 1 | Bambu Lab PETG Basic / black | 50.561306 cm³ |
| dock-pod-bridge-shoe r0.1.0 | 4 | Bambu Lab PETG Basic / black | 6.747810 cm³ |
| dock-pod-stud r0.1.0 | 1 | Bambu Lab PETG Basic / black | 16.888763 cm³ |

Selected recipe consumption:

| Material / colour | Roll price basis | Estimated batch weight | Estimated batch cost |
| --- | --- | ---: | ---: |
| [Bambu Lab PETG Basic](https://eu.store.bambulab.com/products/petg-basic) / black | 11.39 EUR / 1000 g; 10+ eligible mixed rolls | 126.828 g | 1.44 EUR |
| **Selected recipe total** | | **126.828 g** | **1.44 EUR** |

Comparisons below assume every component uses the same material; the selected mixed recipe above is costed separately.

| Material | Density | Roll price | Estimated batch weight | Estimated batch cost |
| --- | ---: | ---: | ---: | ---: |
| [Bambu Lab PLA Basic](https://eu.store.bambulab.com/products/pla-basic-filament) | [1.24 g/cm³](https://store.bblcdn.com/s1/default/58b85d0f3db94878854a28fdb8a0006e/Bambu_PLA_Basic_Technical_Data_Sheet.pdf) | 11.99 EUR / 1000 g; 10+ eligible mixed rolls | 125.814 g | 1.51 EUR |
| [Bambu Lab PETG Basic](https://eu.store.bambulab.com/products/petg-basic) | [1.25 g/cm³](https://store.bblcdn.com/s1/default/cb94589bf7994fdcbfa833badefae9cd/Bambu_PETG_Basic_Technical_Data_Sheet.pdf) | 11.39 EUR / 1000 g; 10+ eligible mixed rolls | 126.828 g | 1.44 EUR |
| [Bambu Lab PETG Matte](https://eu.store.bambulab.com/products/petg-matte) | [1.37 g/cm³](https://store.bblcdn.eu/s8/default/240fb0c791fb4903a9d72934895e9a16/PETG_Matte.pdf) | 11.39 EUR / 1000 g; 10+ eligible mixed rolls | 139.004 g | 1.58 EUR |
| [Bambu Lab ASA](https://eu.store.bambulab.com/products/asa-filament) | [1.05 g/cm³](https://store.bblcdn.com/ad7b08230c164e72856cffbe06bb7dc9.pdf) | 24.99 EUR / 1000 g; single spool | 106.536 g | 2.66 EUR |

Volume evidence: current local OpenSCAD exports; [canonical recipes, mesh checksums and source hashes](../../catalog/fabrication.json).

Material consumption at observed 10+ mixed eligible 1 kg filament-with-spool bulk rates for PLA Basic, PETG Basic and PETG Matte. The shared Bambu EU mix-and-match basket must contain at least 10 eligible rolls; this is a conditional estimate, not an order or whole-roll procurement total. ASA has no evidenced eligible bulk rate and retains its single-spool price. PETG Matte White/Black is selected only for cosmetic shell surfaces; functional parts retain existing material assumptions. EU displayed VAT may change at Croatian checkout; shipping, supports, purge, failed prints, energy, machine time and labour are unknown. Solid CAD volume represents fully dense plastic, not slicer infill or measured weight.

Catalog lifecycle, procurement, and generated documentation do not establish physical validation. See the owning assembly for evidence and acceptance requirements.
