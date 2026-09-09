# High-dock locating nest

> Generated from canonical BOM inputs by `pnpm bom:generate`. Do not edit this page by hand.

[BOM](../../README.md) · [All items](README.md) · [Canonical part catalog](../../catalog/parts.json)

- Part ID: `dock-nest`
- Unit: each
- Kind: component
- Lifecycle: active
- Disciplines: mechanical
- Traits: fabricated, printed

## Requirements

- One locating socket and mounting plate receiving the pod after the separate alignment funnel.

## Used in

Quantities are per assembly definition, before build multipliers. Optional and deferred usages are shown even when excluded from a scenario. Procurement stock is not an installed physical owner.

| Assembly or purchasing bucket | Quantity | Inclusion | Usage note |
| --- | ---: | --- | --- |
| [Dock](../../../docs/assemblies/dock/README.md) | 1 each | base | Funnel and nest are separate physical artifacts with separate CAD entrypoints. |

[Canonical assembly quantities](../../assemblies/assemblies.json)

## BOM reports

- [ARBI V1 — Zagreb repository baseline](../arbi-v1-hr-zagreb.md#required-parts-by-physical-owner-or-procurement-bucket) — included.

## Fabrication

- Process: openscad
- Model status: concept-unvalidated
- [hardware/assemblies/dock/dock-nest.scad](../../../hardware/assemblies/dock/dock-nest.scad) — module `dock_nest`; revision 0.1.0.

Catalog lifecycle, procurement, and generated documentation do not establish physical validation. See the owning assembly for evidence and acceptance requirements.
