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

Includes the camera-pod concept family and the alternative payload mount family, sharing the unchanged camera-pod-spider. Select one arrangement; these sources are not a combined print kit. The integrated ordinary-rain/splash configuration uses electronics deck r0.1.1 and replaces payload-electronics-cover with payload-rain-hood, payload-enclosure-base and removable payload-pan-fairing. Quantities, hardware and cable routes are in hardware/assemblies/camera-pod/payload-mounts.md and payload-enclosure.md. Physical fit, rain/thermal behavior and complete flying mass remain unverified. Updated for Raspberry Pi 3A+ V1 pod architecture; replaces earlier Pi Zero 2 W mass/layout assumptions.

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
- [hardware/assemblies/camera-pod/payload-rain-hood.scad](../../../hardware/assemblies/camera-pod/payload-rain-hood.scad) — module `payload_rain_hood`; revision 0.1.0.
- [hardware/assemblies/camera-pod/payload-enclosure-base.scad](../../../hardware/assemblies/camera-pod/payload-enclosure-base.scad) — module `payload_enclosure_base`; revision 0.1.0.
- [hardware/assemblies/camera-pod/payload-pan-fairing.scad](../../../hardware/assemblies/camera-pod/payload-pan-fairing.scad) — module `payload_pan_fairing`; revision 0.1.0.

Catalog lifecycle, procurement, and generated documentation do not establish physical validation. See the owning assembly for evidence and acceptance requirements.
