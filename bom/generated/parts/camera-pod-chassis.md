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

## Design warnings

- **Critical:** Compact deck/carrier screw-fastened retainers replace ties. Received fit, captive-pocket retention, print strength/creep and complete mass require physical inspection and testing.
- **Warning:** Fabrication status is concept-unvalidated; fit, materials and physical acceptance still need committed evidence.

## Notes

Current compact assembly r0.5.0 uses integrated deck and carrier r0.3.0, four new removable retainer models r0.1.0, existing head/cradle/support/optical hood r0.2.0, rain hood r0.3.0 and tray r0.2.3. Six removable prints secure the capacitor, incoming power sleeve and separate fixed/pan CSI and servo anchors without ties. The selected kit has 18 installed prints from 15 model types and 16 fabrication models including its optional coupon. Reprint the deck and carrier from r0.4.0; add one capacitor retainer, one power jaw, two ribbon clamps and two loom clamps. Historical dry-bench sources and publications retain their original configurations. See hardware/assemblies/camera-pod/camera-pod-enclosure.md and docs/assemblies/camera-pod/tie-free-retention.md. Physical acceptance remains open.

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
- [hardware/assemblies/camera-pod/camera-pod-pan-servo-mount.scad](../../../hardware/assemblies/camera-pod/camera-pod-pan-servo-mount.scad) — module `camera_pod_pan_servo_mount`; revision 0.1.1.
- [hardware/assemblies/camera-pod/camera-pod-rain-hood.scad](../../../hardware/assemblies/camera-pod/camera-pod-rain-hood.scad) — module `camera_pod_rain_hood`; revision 0.3.0.
- [hardware/assemblies/camera-pod/camera-pod-enclosure-base.scad](../../../hardware/assemblies/camera-pod/camera-pod-enclosure-base.scad) — module `camera_pod_enclosure_base`; revision 0.2.3.
- [hardware/assemblies/camera-pod/camera-pod-integrated-deck.scad](../../../hardware/assemblies/camera-pod/camera-pod-integrated-deck.scad) — module `camera_pod_integrated_deck`; revision 0.3.0.
- [hardware/assemblies/camera-pod/camera-pod-capacitor-retainer.scad](../../../hardware/assemblies/camera-pod/camera-pod-capacitor-retainer.scad) — module `camera_pod_capacitor_retainer`; revision 0.1.0.
- [hardware/assemblies/camera-pod/camera-pod-power-clamp.scad](../../../hardware/assemblies/camera-pod/camera-pod-power-clamp.scad) — module `camera_pod_power_clamp`; revision 0.1.0.
- [hardware/assemblies/camera-pod/camera-pod-ribbon-clamp.scad](../../../hardware/assemblies/camera-pod/camera-pod-ribbon-clamp.scad) — module `camera_pod_ribbon_clamp`; revision 0.1.0.
- [hardware/assemblies/camera-pod/camera-pod-loom-clamp.scad](../../../hardware/assemblies/camera-pod/camera-pod-loom-clamp.scad) — module `camera_pod_loom_clamp`; revision 0.1.0.

### Print material estimate

Build arbi-v1; batch represents 1 BOM unit(s). Current rain-enclosure kit from camera-pod-enclosure.md; excludes dry-bench alternatives and test coupons. Cosmetic shell surfaces use PETG Matte White (35100) or Black (35101) as listed per component; functional parts retain their existing material assumptions. Material and colour selections require physical fit, retention, weather and thermal checks.

| Model | Copies in batch | Material / colour | Solid volume per copy |
| --- | ---: | --- | ---: |
| camera-pod-spider r0.1.0 | 1 | Bambu Lab PETG Basic / black | 66.232469 cm³ |
| camera-pod-integrated-deck r0.3.0 | 1 | Bambu Lab PETG Basic / black | 23.825675 cm³ |
| camera-pod-pan-servo-mount r0.1.1 | 1 | Bambu Lab PETG Basic / black | 8.273944 cm³ |
| camera-pod-rain-hood r0.3.0 | 1 | Bambu Lab PETG Matte / white | 36.443431 cm³ |
| camera-pod-enclosure-base r0.2.3 | 1 | Bambu Lab PETG Matte / black | 31.381277 cm³ |
| camera-pod-capacitor-retainer r0.1.0 | 1 | Bambu Lab PETG Basic / black | 0.754306 cm³ |
| camera-pod-power-clamp r0.1.0 | 1 | Bambu Lab PETG Basic / black | 0.903406 cm³ |
| camera-pod-ribbon-clamp r0.1.0 | 2 | Bambu Lab PETG Basic / black | 0.982786 cm³ |
| camera-pod-loom-clamp r0.1.0 | 2 | Bambu Lab PETG Basic / black | 0.881187 cm³ |

Selected recipe consumption:

| Material / colour | Roll price basis | Estimated batch weight | Estimated batch cost |
| --- | --- | ---: | ---: |
| [Bambu Lab PETG Matte](https://eu.store.bambulab.com/products/petg-matte?id=775952393450868774) / black | 11.39 EUR / 1000 g; 10+ eligible mixed rolls | 42.992 g | 0.49 EUR |
| [Bambu Lab PETG Matte](https://eu.store.bambulab.com/products/petg-matte?id=775952393450868758) / white | 11.39 EUR / 1000 g; 10+ eligible mixed rolls | 49.928 g | 0.57 EUR |
| [Bambu Lab PETG Basic](https://eu.store.bambulab.com/products/petg-basic) / black | 11.39 EUR / 1000 g; 10+ eligible mixed rolls | 129.647 g | 1.48 EUR |
| **Selected recipe total** | | **222.567 g** | **2.54 EUR** |

Comparisons below assume every component uses the same material; the selected mixed recipe above is costed separately.

| Material | Density | Roll price | Estimated batch weight | Estimated batch cost |
| --- | ---: | ---: | ---: | ---: |
| [Bambu Lab PLA Basic](https://eu.store.bambulab.com/products/pla-basic-filament) | [1.24 g/cm³](https://store.bblcdn.com/s1/default/58b85d0f3db94878854a28fdb8a0006e/Bambu_PLA_Basic_Technical_Data_Sheet.pdf) | 11.99 EUR / 1000 g; 10+ eligible mixed rolls | 212.713 g | 2.55 EUR |
| [Bambu Lab PETG Basic](https://eu.store.bambulab.com/products/petg-basic) | [1.25 g/cm³](https://store.bblcdn.com/s1/default/cb94589bf7994fdcbfa833badefae9cd/Bambu_PETG_Basic_Technical_Data_Sheet.pdf) | 11.39 EUR / 1000 g; 10+ eligible mixed rolls | 214.428 g | 2.44 EUR |
| [Bambu Lab PETG Matte](https://eu.store.bambulab.com/products/petg-matte) | [1.37 g/cm³](https://store.bblcdn.eu/s8/default/240fb0c791fb4903a9d72934895e9a16/PETG_Matte.pdf) | 11.39 EUR / 1000 g; 10+ eligible mixed rolls | 235.013 g | 2.68 EUR |
| [Bambu Lab ASA](https://eu.store.bambulab.com/products/asa-filament) | [1.05 g/cm³](https://store.bblcdn.com/ad7b08230c164e72856cffbe06bb7dc9.pdf) | 24.99 EUR / 1000 g; single spool | 180.12 g | 4.5 EUR |

Volume evidence: current local OpenSCAD exports; [canonical recipes, mesh checksums and source hashes](../../catalog/fabrication.json).

Material consumption at observed 10+ mixed eligible 1 kg filament-with-spool bulk rates for PLA Basic, PETG Basic and PETG Matte. The shared Bambu EU mix-and-match basket must contain at least 10 eligible rolls; this is a conditional estimate, not an order or whole-roll procurement total. ASA has no evidenced eligible bulk rate and retains its single-spool price. PETG Matte White/Black is selected only for cosmetic shell surfaces; functional parts retain existing material assumptions. EU displayed VAT may change at Croatian checkout; shipping, supports, purge, failed prints, energy, machine time and labour are unknown. Solid CAD volume represents fully dense plastic, not slicer infill or measured weight.

Catalog lifecycle, procurement, and generated documentation do not establish physical validation. See the owning assembly for evidence and acceptance requirements.
