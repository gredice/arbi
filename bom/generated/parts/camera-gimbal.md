# Pan/tilt camera gimbal

> Generated from canonical BOM inputs by `pnpm bom:generate`. Do not edit this page by hand.

[BOM](../../README.md) · [All items](README.md) · [Canonical part catalog](../../catalog/parts.json)

- Part ID: `camera-gimbal`
- Unit: each
- Kind: component
- Lifecycle: active
- Disciplines: mechanical, optics
- Traits: fabricated, printed

## Requirements

- Lightweight 2-axis Camera Module 3 gimbal; approx. ±90° pan and 0–70° tilt target.

## Notes

Current compact enclosure uses payload-integrated-gimbal-head r0.1.3, payload-integrated-gimbal-carrier r0.1.1, integrated cradle/pivot support r0.1.0, horn retainers and payload-integrated-camera-hood r0.1.1. Historical concept and dry bench gimbal parts, fixed fairing, tilt-servo boot and rear camera cowl are archived and excluded from this BOM. Four M2 x 10 clamp stacks join head and carrier; four M2 x 12 camera screws retain four primary nuts and eight washers. The selected kit exports 13 fabrication models including the optional coupon and installs 16 printed pieces. See hardware/assemblies/camera-pod/payload-enclosure.md for quantities and service routes. Servo/connector dimensions, physical fit, rain protection and complete flying mass remain unverified.

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
- [hardware/assemblies/camera-pod/payload-integrated-camera-cradle.scad](../../../hardware/assemblies/camera-pod/payload-integrated-camera-cradle.scad) — module `payload_integrated_camera_cradle`; revision 0.1.0.
- [hardware/assemblies/camera-pod/payload-integrated-tilt-pivot-support.scad](../../../hardware/assemblies/camera-pod/payload-integrated-tilt-pivot-support.scad) — module `payload_integrated_tilt_pivot_support`; revision 0.1.0.
- [hardware/assemblies/camera-pod/payload-horn-retainer.scad](../../../hardware/assemblies/camera-pod/payload-horn-retainer.scad) — module `payload_horn_retainer`; revision 0.1.0.
- [hardware/assemblies/camera-pod/payload-servo-fit-coupon.scad](../../../hardware/assemblies/camera-pod/payload-servo-fit-coupon.scad) — module `payload_servo_fit_coupon`; revision 0.1.0.
- [hardware/assemblies/camera-pod/payload-integrated-camera-hood.scad](../../../hardware/assemblies/camera-pod/payload-integrated-camera-hood.scad) — module `payload_integrated_camera_hood`; revision 0.1.1.
- [hardware/assemblies/camera-pod/payload-integrated-gimbal-head.scad](../../../hardware/assemblies/camera-pod/payload-integrated-gimbal-head.scad) — module `payload_integrated_gimbal_head`; revision 0.1.3.
- [hardware/assemblies/camera-pod/payload-integrated-gimbal-carrier.scad](../../../hardware/assemblies/camera-pod/payload-integrated-gimbal-carrier.scad) — module `payload_integrated_gimbal_carrier`; revision 0.1.1.

### Print material estimate

Build arbi-v1; batch represents 1 BOM unit(s). Current compact rain-enclosure gimbal; excludes earlier gimbal and dry-bench alternatives. Cosmetic shell surfaces use PETG Matte White (35100) or Black (35101) as listed per component; functional parts retain their existing material assumptions. Material and colour selections require physical fit, retention, weather and thermal checks.

| Model | Copies in batch | Material / colour | Solid volume per copy |
| --- | ---: | --- | ---: |
| payload-integrated-gimbal-carrier r0.1.1 | 1 | Bambu Lab PETG Basic / black | 8.458834 cm³ |
| payload-integrated-gimbal-head r0.1.3 | 1 | Bambu Lab PETG Matte / black | 22.087140 cm³ |
| payload-integrated-camera-cradle r0.1.0 | 1 | Bambu Lab PETG Basic / black | 3.191199 cm³ |
| payload-integrated-tilt-pivot-support r0.1.0 | 1 | Bambu Lab PETG Basic / black | 1.088757 cm³ |
| payload-horn-retainer r0.1.0 | 2 | Bambu Lab PETG Basic / black | 0.545253 cm³ |
| payload-integrated-camera-hood r0.1.1 | 1 | Bambu Lab PETG Matte / white | 4.588465 cm³ |

Selected recipe consumption:

| Material / colour | Roll price basis | Estimated batch weight | Estimated batch cost |
| --- | --- | ---: | ---: |
| [Bambu Lab PETG Matte](https://eu.store.bambulab.com/products/petg-matte?id=775952393450868774) / black | 11.39 EUR / 1000 g; 10+ eligible mixed rolls | 30.259 g | 0.34 EUR |
| [Bambu Lab PETG Matte](https://eu.store.bambulab.com/products/petg-matte?id=775952393450868758) / white | 11.39 EUR / 1000 g; 10+ eligible mixed rolls | 6.286 g | 0.07 EUR |
| [Bambu Lab PETG Basic](https://eu.store.bambulab.com/products/petg-basic) / black | 11.39 EUR / 1000 g; 10+ eligible mixed rolls | 17.287 g | 0.2 EUR |
| **Selected recipe total** | | **53.832 g** | **0.61 EUR** |

Comparisons below assume every component uses the same material; the selected mixed recipe above is costed separately.

| Material | Density | Roll price | Estimated batch weight | Estimated batch cost |
| --- | ---: | ---: | ---: | ---: |
| [Bambu Lab PLA Basic](https://eu.store.bambulab.com/products/pla-basic-filament) | [1.24 g/cm³](https://store.bblcdn.com/s1/default/58b85d0f3db94878854a28fdb8a0006e/Bambu_PLA_Basic_Technical_Data_Sheet.pdf) | 11.99 EUR / 1000 g; 10+ eligible mixed rolls | 50.226 g | 0.6 EUR |
| [Bambu Lab PETG Basic](https://eu.store.bambulab.com/products/petg-basic) | [1.25 g/cm³](https://store.bblcdn.com/s1/default/cb94589bf7994fdcbfa833badefae9cd/Bambu_PETG_Basic_Technical_Data_Sheet.pdf) | 11.39 EUR / 1000 g; 10+ eligible mixed rolls | 50.631 g | 0.58 EUR |
| [Bambu Lab PETG Matte](https://eu.store.bambulab.com/products/petg-matte) | [1.37 g/cm³](https://store.bblcdn.eu/s8/default/240fb0c791fb4903a9d72934895e9a16/PETG_Matte.pdf) | 11.39 EUR / 1000 g; 10+ eligible mixed rolls | 55.492 g | 0.63 EUR |
| [Bambu Lab ASA](https://eu.store.bambulab.com/products/asa-filament) | [1.05 g/cm³](https://store.bblcdn.com/ad7b08230c164e72856cffbe06bb7dc9.pdf) | 24.99 EUR / 1000 g; single spool | 42.53 g | 1.06 EUR |

Volume evidence: current local OpenSCAD exports; [canonical recipes, mesh checksums and source hashes](../../catalog/fabrication.json).

Material consumption at observed 10+ mixed eligible 1 kg filament-with-spool bulk rates for PLA Basic, PETG Basic and PETG Matte. The shared Bambu EU mix-and-match basket must contain at least 10 eligible rolls; this is a conditional estimate, not an order or whole-roll procurement total. ASA has no evidenced eligible bulk rate and retains its single-spool price. PETG Matte White/Black is selected only for cosmetic shell surfaces; functional parts retain existing material assumptions. EU displayed VAT may change at Croatian checkout; shipping, supports, purge, failed prints, energy, machine time and labour are unknown. Solid CAD volume represents fully dense plastic, not slicer infill or measured weight.

Catalog lifecycle, procurement, and generated documentation do not establish physical validation. See the owning assembly for evidence and acceptance requirements.
