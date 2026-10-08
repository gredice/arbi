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

Includes the camera-pod concept family and the alternative payload mount family, sharing the unchanged camera-pod-spider. Select one arrangement; these sources are not a combined print kit. The integrated ordinary-rain/splash configuration uses compact payload-integrated-deck r0.1.0 instead of the dry bench deck and replaces payload-electronics-cover with payload-rain-hood r0.2.1 and payload-enclosure-base r0.2.3. Its pan-moving payload-integrated-gimbal-head belongs to the camera-gimbal part; the separate fixed payload-pan-fairing remains a historical alternative and is omitted from the current enclosure kit. Quantities, hardware and cable routes are in hardware/assemblies/camera-pod/payload-mounts.md and payload-enclosure.md. Physical fit, rain/thermal behavior and complete flying mass remain unverified. Updated for Raspberry Pi 3A+ V1 pod architecture; replaces earlier Pi Zero 2 W mass/layout assumptions.

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
- [hardware/assemblies/camera-pod/camera-pod-docking-stud.scad](../../../hardware/assemblies/camera-pod/camera-pod-docking-stud.scad) — module `camera_pod_docking_stud`; revision 0.1.0.
- [hardware/assemblies/camera-pod/camera-pod-electronics-mount.scad](../../../hardware/assemblies/camera-pod/camera-pod-electronics-mount.scad) — module `camera_pod_electronics_mount`; revision 0.1.0.
- [hardware/assemblies/camera-pod/camera-pod-line-strain-relief.scad](../../../hardware/assemblies/camera-pod/camera-pod-line-strain-relief.scad) — module `camera_pod_line_strain_relief`; revision 0.1.0.
- [hardware/assemblies/camera-pod/camera-pod-spider.scad](../../../hardware/assemblies/camera-pod/camera-pod-spider.scad) — module `camera_pod_spider`; revision 0.1.0.
- [hardware/assemblies/camera-pod/payload-electronics-deck.scad](../../../hardware/assemblies/camera-pod/payload-electronics-deck.scad) — module `payload_electronics_deck`; revision 0.1.1.
- [hardware/assemblies/camera-pod/payload-pan-servo-mount.scad](../../../hardware/assemblies/camera-pod/payload-pan-servo-mount.scad) — module `payload_pan_servo_mount`; revision 0.1.0.
- [hardware/assemblies/camera-pod/payload-electronics-cover.scad](../../../hardware/assemblies/camera-pod/payload-electronics-cover.scad) — module `payload_electronics_cover`; revision 0.1.0.
- [hardware/assemblies/camera-pod/payload-spider-spacer.scad](../../../hardware/assemblies/camera-pod/payload-spider-spacer.scad) — module `payload_spider_spacer`; revision 0.1.0.
- [hardware/assemblies/camera-pod/payload-rain-hood.scad](../../../hardware/assemblies/camera-pod/payload-rain-hood.scad) — module `payload_rain_hood`; revision 0.2.1.
- [hardware/assemblies/camera-pod/payload-enclosure-base.scad](../../../hardware/assemblies/camera-pod/payload-enclosure-base.scad) — module `payload_enclosure_base`; revision 0.2.3.
- [hardware/assemblies/camera-pod/payload-pan-fairing.scad](../../../hardware/assemblies/camera-pod/payload-pan-fairing.scad) — module `payload_pan_fairing`; revision 0.2.1.
- [hardware/assemblies/camera-pod/payload-integrated-deck.scad](../../../hardware/assemblies/camera-pod/payload-integrated-deck.scad) — module `payload_integrated_deck`; revision 0.1.0.

### Print material estimate

Build arbi-v1; batch represents 1 BOM unit(s). Current rain-enclosure kit from payload-enclosure.md; excludes dry-bench alternatives and test coupons.

| Model | Copies in batch | Solid volume per copy |
| --- | ---: | ---: |
| camera-pod-spider r0.1.0 | 1 | 66.232475 cm³ |
| payload-integrated-deck r0.1.0 | 1 | 13.441886 cm³ |
| payload-spider-spacer r0.1.0 | 4 | 0.875489 cm³ |
| payload-pan-servo-mount r0.1.0 | 1 | 8.299465 cm³ |
| payload-rain-hood r0.2.1 | 1 | 36.443415 cm³ |
| payload-enclosure-base r0.2.3 | 1 | 31.381263 cm³ |

| Material | Density | Single spool | Estimated batch weight | Estimated batch cost |
| --- | ---: | ---: | ---: | ---: |
| [Bambu Lab PLA Basic](https://eu.store.bambulab.com/products/pla-basic-filament) | [1.24 g/cm³](https://store.bblcdn.com/s1/default/58b85d0f3db94878854a28fdb8a0006e/Bambu_PLA_Basic_Technical_Data_Sheet.pdf) | 19.99 EUR / 1000 g | 197.533 g | 3.95 EUR |
| [Bambu Lab PETG Basic](https://eu.store.bambulab.com/products/petg-basic) (costing selection) | [1.25 g/cm³](https://store.bblcdn.com/s1/default/cb94589bf7994fdcbfa833badefae9cd/Bambu_PETG_Basic_Technical_Data_Sheet.pdf) | 18.99 EUR / 1000 g | 199.126 g | 3.78 EUR |
| [Bambu Lab ASA](https://eu.store.bambulab.com/products/asa-filament) | [1.05 g/cm³](https://store.bblcdn.com/ad7b08230c164e72856cffbe06bb7dc9.pdf) | 24.99 EUR / 1000 g | 167.265 g | 4.18 EUR |

Volume evidence: [cad-v0.1.4](https://github.com/gredice/arbi/releases/tag/cad-v0.1.4); [canonical recipes, mesh checksums and source hashes](../../catalog/fabrication.json).

Material consumption only at single 1 kg filament-with-spool MSRP; bulk discounts excluded. EU displayed VAT may change at Croatian checkout; shipping, supports, purge, failed prints, energy, machine time and labour are unknown. PETG is a prototype costing assumption; ASA is used for exposed cover recipes. Solid CAD volume represents fully dense plastic, not slicer infill or measured weight.

Catalog lifecycle, procurement, and generated documentation do not establish physical validation. See the owning assembly for evidence and acceptance requirements.
