# Raspberry Pi Camera Module 3 Wide

> Generated from canonical BOM inputs by `pnpm bom:generate`. Do not edit this page by hand.

[BOM](../../README.md) · [All items](README.md) · [Canonical part catalog](../../catalog/parts.json)

- Part ID: `raspberry-pi-camera-module-3`
- Unit: each
- Kind: component
- Lifecycle: active
- Disciplines: electronics, optics
- Traits: off-the-shelf

## Requirements

- Received Camera Module 3 Wide with IR-cut filter and 12 MP Sony IMX708 autofocus sensor; 120° diagonal / 102° horizontal / 67° vertical field of view. Normal-FOV Standard and NoIR are not the selected variant.
- Published Wide product envelope 25 × 24 × 12.4 mm; official Wide drawing gives a 25 × 23.862 mm PCB, 1.12 mm PCB thickness and four Ø2.2 mm holes at 21 × 12.5 mm pitch.
- 15-contact, 1 mm pitch CSI connector; use a Standard-Standard camera ribbon with the Pi 3A+. Inspect focus travel, connector access and actual ribbon clearance through the full gimbal range.

## Notes

Owner confirmed Wide (120°) on 2026-10-12 and reported interference with the prior Standard hood. Official Wide drawing RP-008155-DS-1, Standard/Wide STEP archive RP-008154-DS-1 and reference schematic RP-008969-SD R1 reviewed. Sources, hashes, pinout and conservative model limits: hardware/assemblies/camera-pod/raspberry-pi-camera-module-3/README.md. Hood r0.1.2 needs reprinting and physical acceptance.

## Used in

Quantities are per assembly definition, before build multipliers. Optional and deferred usages are shown even when excluded from a scenario. Procurement stock is not an installed physical owner.

| Assembly or purchasing bucket | Quantity | Inclusion | Usage note |
| --- | ---: | --- | --- |
| [Camera pod](../../../docs/assemblies/camera-pod/README.md) | 1 each | base | — |

[Canonical assembly quantities](../../assemblies/assemblies.json)

## BOM reports

- [ARBI V1 — Zagreb repository baseline](../arbi-v1-hr-zagreb.md#required-parts-by-physical-owner-or-procurement-bucket) — included.

Catalog lifecycle, procurement, and generated documentation do not establish physical validation. See the owning assembly for evidence and acceptance requirements.
