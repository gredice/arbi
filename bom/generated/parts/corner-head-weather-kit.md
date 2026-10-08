# Corner head removable weather shield kit

> Generated from canonical BOM inputs by `pnpm bom:generate`. Do not edit this page by hand.

[BOM](../../README.md) · [All items](README.md) · [Canonical part catalog](../../catalog/parts.json)

- Part ID: `corner-head-weather-kit`
- Unit: each
- Kind: component
- Lifecycle: planned
- Disciplines: mechanical
- Traits: fabricated, printed

## Requirements

- One stem hood, one separate roof and one rear cover per station. Non-structural ASA candidate; pulley remains visible. Match post/angle/bolt configuration; three replaceable straps required.

## Notes

Proposed package; excluded from the baseline scenario. See docs/assemblies/corner-station/design-package.md. No supplier price or engineering qualification asserted.

## Used in

Quantities are per assembly definition, before build multipliers. Optional and deferred usages are shown even when excluded from a scenario. Procurement stock is not an installed physical owner.

| Assembly or purchasing bucket | Quantity | Inclusion | Usage note |
| --- | ---: | --- | --- |
| [Corner support set](../../../docs/assemblies/corner-station/README.md) | 4 each | optional | Optional three-piece non-structural shield kit, not a line keeper. |

[Canonical assembly quantities](../../assemblies/assemblies.json)

## BOM reports

- [ARBI V1 — Zagreb repository baseline](../arbi-v1-hr-zagreb.md) — not included by this build/inclusion policy.

## Fabrication

- Process: openscad
- Model status: concept-unvalidated
- [hardware/assemblies/corner-station/corner-head-hood.scad](../../../hardware/assemblies/corner-station/corner-head-hood.scad) — module `corner_head_hood`; revision 0.1.0.
- [hardware/assemblies/corner-station/corner-head-rear-cover.scad](../../../hardware/assemblies/corner-station/corner-head-rear-cover.scad) — module `corner_head_rear_cover`; revision 0.1.0.
- [hardware/assemblies/corner-station/corner-head-roof.scad](../../../hardware/assemblies/corner-station/corner-head-roof.scad) — module `corner_head_roof`; revision 0.1.0.

Catalog lifecycle, procurement, and generated documentation do not establish physical validation. See the owning assembly for evidence and acceptance requirements.
