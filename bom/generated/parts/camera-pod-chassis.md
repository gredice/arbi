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

- ASA/PETG lightweight cable spider and electronics chassis sized for Raspberry Pi 3A+, 48 V → 5 V converter and bulk capacitor fixed on the pod. Complete flying pod target ~100–120 g; hard design limit ~170 g.

## Notes

Updated for Raspberry Pi 3A+ V1 pod architecture; replaces earlier Pi Zero 2 W mass/layout assumptions.

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

Catalog lifecycle, procurement, and generated documentation do not establish physical validation. See the owning assembly for evidence and acceptance requirements.
