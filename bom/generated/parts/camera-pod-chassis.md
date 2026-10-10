# Camera pod spider/chassis

> Generated from canonical BOM inputs by `pnpm bom:generate`. Do not edit this page by hand.

[BOM](../../README.md) · [All items](README.md) · [Canonical part catalog](../../catalog/parts.json)

- Part ID: `camera-pod-chassis`
- Unit: each
- Kind: component
- Lifecycle: active
- Disciplines: mechanical, optics
- Traits: fabricated, printed

## Requirements

- ASA/PETG lightweight cable spider and electronics chassis sized for Raspberry Pi 3A+, 48 V → 5 V converter and bulk capacitor fixed on the pod. Complete flying pod target ~100–120 g; hard design limit 170 g.

## Notes

Current compact ordinary-rain/splash chassis uses camera-pod-spider, camera-pod-integrated-deck r0.1.0, spacers, pan-servo mount, camera-pod-rain-hood r0.2.1 and camera-pod-enclosure-base r0.2.3. Historical concept parts, the dry bench deck/cover and fixed fairing are archived and excluded from this BOM. Select the current print quantities in hardware/assemblies/camera-pod/camera-pod-enclosure.md; the dry bench configuration remains an explicit alternative in camera-pod-mounts.md. Docking and line-termination interfaces, physical fit, rain/thermal behavior and complete flying mass remain unverified.

## Used in

Quantities are per assembly definition, before build multipliers. Optional and deferred usages are shown even when excluded from a scenario. Procurement stock is not an installed physical owner.

| Assembly or purchasing bucket | Quantity | Inclusion | Usage note |
| --- | ---: | --- | --- |
| [Camera pod](../../../docs/assemblies/camera-pod/README.md) | 1 each | base | — |

[Canonical assembly quantities](../../assemblies/assemblies.json)

## BOM reports

- [ARBI V1 — Zagreb repository baseline](../arbi-v1-hr-zagreb.md#required-parts-by-physical-owner-or-procurement-bucket) — included.

## Fabrication

- Process: openscad
- Model status: concept-unvalidated
- [hardware/assemblies/camera-pod/camera-pod-spider.scad](../../../hardware/assemblies/camera-pod/camera-pod-spider.scad) — module `camera_pod_spider`; revision 0.1.0.
- [hardware/assemblies/camera-pod/camera-pod-pan-servo-mount.scad](../../../hardware/assemblies/camera-pod/camera-pod-pan-servo-mount.scad) — module `camera_pod_pan_servo_mount`; revision 0.1.0.
- [hardware/assemblies/camera-pod/camera-pod-spider-spacer.scad](../../../hardware/assemblies/camera-pod/camera-pod-spider-spacer.scad) — module `camera_pod_spider_spacer`; revision 0.1.0.
- [hardware/assemblies/camera-pod/camera-pod-rain-hood.scad](../../../hardware/assemblies/camera-pod/camera-pod-rain-hood.scad) — module `camera_pod_rain_hood`; revision 0.2.1.
- [hardware/assemblies/camera-pod/camera-pod-enclosure-base.scad](../../../hardware/assemblies/camera-pod/camera-pod-enclosure-base.scad) — module `camera_pod_enclosure_base`; revision 0.2.3.
- [hardware/assemblies/camera-pod/camera-pod-integrated-deck.scad](../../../hardware/assemblies/camera-pod/camera-pod-integrated-deck.scad) — module `camera_pod_integrated_deck`; revision 0.1.0.

### Print material estimate

Build arbi-v1; batch represents 1 BOM unit(s). Current rain-enclosure kit from camera-pod-enclosure.md; excludes dry-bench alternatives and test coupons. Cosmetic shell surfaces use PETG Matte White (35100) or Black (35101) as listed per component; functional parts retain their existing material assumptions. Material and colour selections require physical fit, retention, weather and thermal checks.

| Model | Copies in batch | Material / colour | Solid volume per copy |
| --- | ---: | --- | ---: |
| camera-pod-spider r0.1.0 | 1 | Bambu Lab PETG Basic / black | 66.232475 cm³ |
| camera-pod-integrated-deck r0.1.0 | 1 | Bambu Lab PETG Basic / black | 13.441886 cm³ |
| camera-pod-spider-spacer r0.1.0 | 4 | Bambu Lab PETG Basic / black | 0.875489 cm³ |
| camera-pod-pan-servo-mount r0.1.0 | 1 | Bambu Lab PETG Basic / black | 8.299465 cm³ |
| camera-pod-rain-hood r0.2.1 | 1 | Bambu Lab PETG Matte / white | 36.443415 cm³ |
| camera-pod-enclosure-base r0.2.3 | 1 | Bambu Lab PETG Matte / black | 31.381263 cm³ |

Selected recipe consumption:

| Material / colour | Roll price basis | Estimated batch weight | Estimated batch cost |
| --- | --- | ---: | ---: |
| [Bambu Lab PETG Matte](https://eu.store.bambulab.com/products/petg-matte?id=775952393450868774) / black | 11.39 EUR / 1000 g; 10+ eligible mixed rolls | 42.992 g | 0.49 EUR |
| [Bambu Lab PETG Matte](https://eu.store.bambulab.com/products/petg-matte?id=775952393450868758) / white | 11.39 EUR / 1000 g; 10+ eligible mixed rolls | 49.927 g | 0.57 EUR |
| [Bambu Lab PETG Basic](https://eu.store.bambulab.com/products/petg-basic) / black | 11.39 EUR / 1000 g; 10+ eligible mixed rolls | 114.345 g | 1.3 EUR |
| **Selected recipe total** | | **207.265 g** | **2.36 EUR** |

Comparisons below assume every component uses the same material; the selected mixed recipe above is costed separately.

| Material | Density | Roll price | Estimated batch weight | Estimated batch cost |
| --- | ---: | ---: | ---: | ---: |
| [Bambu Lab PLA Basic](https://eu.store.bambulab.com/products/pla-basic-filament) | [1.24 g/cm³](https://store.bblcdn.com/s1/default/58b85d0f3db94878854a28fdb8a0006e/Bambu_PLA_Basic_Technical_Data_Sheet.pdf) | 11.99 EUR / 1000 g; 10+ eligible mixed rolls | 197.533 g | 2.37 EUR |
| [Bambu Lab PETG Basic](https://eu.store.bambulab.com/products/petg-basic) | [1.25 g/cm³](https://store.bblcdn.com/s1/default/cb94589bf7994fdcbfa833badefae9cd/Bambu_PETG_Basic_Technical_Data_Sheet.pdf) | 11.39 EUR / 1000 g; 10+ eligible mixed rolls | 199.126 g | 2.27 EUR |
| [Bambu Lab PETG Matte](https://eu.store.bambulab.com/products/petg-matte) | [1.37 g/cm³](https://store.bblcdn.eu/s8/default/240fb0c791fb4903a9d72934895e9a16/PETG_Matte.pdf) | 11.39 EUR / 1000 g; 10+ eligible mixed rolls | 218.242 g | 2.49 EUR |
| [Bambu Lab ASA](https://eu.store.bambulab.com/products/asa-filament) | [1.05 g/cm³](https://store.bblcdn.com/ad7b08230c164e72856cffbe06bb7dc9.pdf) | 24.99 EUR / 1000 g; single spool | 167.265 g | 4.18 EUR |

Volume evidence: [cad-v0.1.12](https://github.com/gredice/arbi/releases/tag/cad-v0.1.12); [canonical recipes, mesh checksums and source hashes](../../catalog/fabrication.json).

Material consumption at observed 10+ mixed eligible 1 kg filament-with-spool bulk rates for PLA Basic, PETG Basic and PETG Matte. The shared Bambu EU mix-and-match basket must contain at least 10 eligible rolls; this is a conditional estimate, not an order or whole-roll procurement total. ASA has no evidenced eligible bulk rate and retains its single-spool price. PETG Matte White/Black is selected only for cosmetic shell surfaces; functional parts retain existing material assumptions. EU displayed VAT may change at Croatian checkout; shipping, supports, purge, failed prints, energy, machine time and labour are unknown. Solid CAD volume represents fully dense plastic, not slicer infill or measured weight.

Catalog lifecycle, procurement, and generated documentation do not establish physical validation. See the owning assembly for evidence and acceptance requirements.
