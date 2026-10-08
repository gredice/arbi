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

Includes the camera-gimbal concept family and the alternative payload mount family, with dry bench and integrated ordinary-rain/splash configurations. Select one arrangement; these sources are not a combined print kit. The current enclosure uses one-piece tapered outer payload-integrated-gimbal-head r0.1.3 with a separate payload-integrated-gimbal-carrier r0.1.1, both moving in pan, in place of the legacy pan yoke, fixed fairing and tilt-servo boot. Four M2 x 10 clamp stacks join the head and carrier. The compact kit uses payload-integrated-camera-cradle and payload-integrated-tilt-pivot-support r0.1.0, omits the rear camera cowl and its four secondary nuts, and uses four M2 x 12 camera screws. The legacy cradle, pivot support, yoke and shields remain alternative sources and are not printed for this configuration. The selected compact kit exports 13 fabrication models including the optional coupon and installs 16 printed pieces. Quantities, hardware and cable routes are in hardware/assemblies/camera-pod/payload-mounts.md and payload-enclosure.md. Servo/connector dimensions are provisional; source checks do not validate physical fit, rain protection or flying mass. The compact integrated variant substitutes payload-integrated-camera-hood r0.1.1 as the rounded white optical surround; the dry bench hood remains an alternative.

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
- [hardware/assemblies/camera-pod/camera-gimbal-base.scad](../../../hardware/assemblies/camera-pod/camera-gimbal-base.scad) — module `camera_gimbal_base`; revision 0.1.0.
- [hardware/assemblies/camera-pod/camera-gimbal-camera-plate.scad](../../../hardware/assemblies/camera-pod/camera-gimbal-camera-plate.scad) — module `camera_gimbal_camera_plate`; revision 0.1.0.
- [hardware/assemblies/camera-pod/camera-gimbal-optical-hood.scad](../../../hardware/assemblies/camera-pod/camera-gimbal-optical-hood.scad) — module `camera_gimbal_optical_hood`; revision 0.1.0.
- [hardware/assemblies/camera-pod/camera-gimbal-rain-cap.scad](../../../hardware/assemblies/camera-pod/camera-gimbal-rain-cap.scad) — module `camera_gimbal_rain_cap`; revision 0.1.0.
- [hardware/assemblies/camera-pod/camera-gimbal-yoke.scad](../../../hardware/assemblies/camera-pod/camera-gimbal-yoke.scad) — module `camera_gimbal_yoke`; revision 0.1.0.
- [hardware/assemblies/camera-pod/payload-integrated-camera-cradle.scad](../../../hardware/assemblies/camera-pod/payload-integrated-camera-cradle.scad) — module `payload_integrated_camera_cradle`; revision 0.1.0.
- [hardware/assemblies/camera-pod/payload-integrated-tilt-pivot-support.scad](../../../hardware/assemblies/camera-pod/payload-integrated-tilt-pivot-support.scad) — module `payload_integrated_tilt_pivot_support`; revision 0.1.0.
- [hardware/assemblies/camera-pod/payload-camera-cradle.scad](../../../hardware/assemblies/camera-pod/payload-camera-cradle.scad) — module `payload_camera_cradle`; revision 0.1.0.
- [hardware/assemblies/camera-pod/payload-camera-hood.scad](../../../hardware/assemblies/camera-pod/payload-camera-hood.scad) — module `payload_camera_hood`; revision 0.1.0.
- [hardware/assemblies/camera-pod/payload-horn-retainer.scad](../../../hardware/assemblies/camera-pod/payload-horn-retainer.scad) — module `payload_horn_retainer`; revision 0.1.0.
- [hardware/assemblies/camera-pod/payload-pan-yoke.scad](../../../hardware/assemblies/camera-pod/payload-pan-yoke.scad) — module `payload_pan_yoke`; revision 0.1.1.
- [hardware/assemblies/camera-pod/payload-servo-fit-coupon.scad](../../../hardware/assemblies/camera-pod/payload-servo-fit-coupon.scad) — module `payload_servo_fit_coupon`; revision 0.1.0.
- [hardware/assemblies/camera-pod/payload-tilt-pivot-support.scad](../../../hardware/assemblies/camera-pod/payload-tilt-pivot-support.scad) — module `payload_tilt_pivot_support`; revision 0.1.0.
- [hardware/assemblies/camera-pod/payload-tilt-servo-boot.scad](../../../hardware/assemblies/camera-pod/payload-tilt-servo-boot.scad) — module `payload_tilt_servo_boot`; revision 0.1.0.
- [hardware/assemblies/camera-pod/payload-camera-cowl.scad](../../../hardware/assemblies/camera-pod/payload-camera-cowl.scad) — module `payload_camera_cowl`; revision 0.1.0.
- [hardware/assemblies/camera-pod/payload-integrated-camera-hood.scad](../../../hardware/assemblies/camera-pod/payload-integrated-camera-hood.scad) — module `payload_integrated_camera_hood`; revision 0.1.1.
- [hardware/assemblies/camera-pod/payload-integrated-gimbal-head.scad](../../../hardware/assemblies/camera-pod/payload-integrated-gimbal-head.scad) — module `payload_integrated_gimbal_head`; revision 0.1.3.
- [hardware/assemblies/camera-pod/payload-integrated-gimbal-carrier.scad](../../../hardware/assemblies/camera-pod/payload-integrated-gimbal-carrier.scad) — module `payload_integrated_gimbal_carrier`; revision 0.1.1.

### Print material estimate

Build arbi-v1; batch represents 1 BOM unit(s). Current compact rain-enclosure gimbal; excludes earlier gimbal and dry-bench alternatives.

| Model | Copies in batch | Solid volume per copy |
| --- | ---: | ---: |
| payload-integrated-gimbal-carrier r0.1.1 | 1 | 8.458834 cm³ |
| payload-integrated-gimbal-head r0.1.3 | 1 | 22.087140 cm³ |
| payload-integrated-camera-cradle r0.1.0 | 1 | 3.191199 cm³ |
| payload-integrated-tilt-pivot-support r0.1.0 | 1 | 1.088757 cm³ |
| payload-horn-retainer r0.1.0 | 2 | 0.545253 cm³ |
| payload-integrated-camera-hood r0.1.1 | 1 | 4.588465 cm³ |

| Material | Density | Single spool | Estimated batch weight | Estimated batch cost |
| --- | ---: | ---: | ---: | ---: |
| [Bambu Lab PLA Basic](https://eu.store.bambulab.com/products/pla-basic-filament) | [1.24 g/cm³](https://store.bblcdn.com/s1/default/58b85d0f3db94878854a28fdb8a0006e/Bambu_PLA_Basic_Technical_Data_Sheet.pdf) | 19.99 EUR / 1000 g | 50.226 g | 1 EUR |
| [Bambu Lab PETG Basic](https://eu.store.bambulab.com/products/petg-basic) (costing selection) | [1.25 g/cm³](https://store.bblcdn.com/s1/default/cb94589bf7994fdcbfa833badefae9cd/Bambu_PETG_Basic_Technical_Data_Sheet.pdf) | 18.99 EUR / 1000 g | 50.631 g | 0.96 EUR |
| [Bambu Lab ASA](https://eu.store.bambulab.com/products/asa-filament) | [1.05 g/cm³](https://store.bblcdn.com/ad7b08230c164e72856cffbe06bb7dc9.pdf) | 24.99 EUR / 1000 g | 42.53 g | 1.06 EUR |

Volume evidence: [cad-v0.1.4](https://github.com/gredice/arbi/releases/tag/cad-v0.1.4); [canonical recipes, mesh checksums and source hashes](../../catalog/fabrication.json).

Material consumption only at single 1 kg filament-with-spool MSRP; bulk discounts excluded. EU displayed VAT may change at Croatian checkout; shipping, supports, purge, failed prints, energy, machine time and labour are unknown. PETG is a prototype costing assumption; ASA is used for exposed cover recipes. Solid CAD volume represents fully dense plastic, not slicer infill or measured weight.

Catalog lifecycle, procurement, and generated documentation do not establish physical validation. See the owning assembly for evidence and acceptance requirements.
