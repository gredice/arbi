# High-dock alignment funnel

> Generated from canonical BOM inputs by `pnpm bom:generate`. Do not edit this page by hand.

[BOM](../../README.md) · [All items](README.md) · [Canonical part catalog](../../catalog/parts.json)

- Part ID: `dock-funnel`
- Unit: each
- Kind: component
- Lifecycle: active
- Disciplines: mechanical
- Traits: fabricated, printed

## Requirements

- Approx. 250–300 mm approach opening guiding the pod toward the separate locating nest; dock capture at ~2.65–2.70 m.

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
- [hardware/assemblies/dock/dock-funnel.scad](../../../hardware/assemblies/dock/dock-funnel.scad) — module `dock_funnel`; revision 0.1.0.

Catalog lifecycle, procurement, and generated documentation do not establish physical validation. See the owning assembly for evidence and acceptance requirements.
