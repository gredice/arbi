# Top-pulley Dyneema keeper / weather cover

> Generated from canonical BOM inputs by `pnpm bom:generate`. Do not edit this page by hand.

[BOM](../../README.md) · [All items](README.md) · [Canonical part catalog](../../catalog/parts.json)

- Part ID: `top-pulley-keeper`
- Unit: each
- Kind: component
- Lifecycle: active
- Disciplines: mechanical
- Traits: cable, fabricated, printed

## Requirements

- ASA preferred; PETG acceptable for prototype. Close side gaps around 1.5 mm Dyneema, keep line centred, prevent jump-off, shield direct rain/UV, drain below and remain removable for inspection.

## Notes

Non-structural only; must not carry pulley or cable load and should not rub the line during normal running.

## Used in

Quantities are per assembly definition, before build multipliers. Optional and deferred usages are shown even when excluded from a scenario. Procurement stock is not an installed physical owner.

| Assembly or purchasing bucket | Quantity | Inclusion | Usage note |
| --- | ---: | --- | --- |
| [Corner support set](../../../docs/assemblies/corner-station/README.md) | 4 each | base | — |

[Canonical assembly quantities](../../assemblies/assemblies.json)

## BOM reports

- [ARBI V1 — Zagreb repository baseline](../arbi-v1-hr-zagreb.md#required-parts-by-physical-owner-or-procurement-bucket) — included.

## Fabrication

- Process: openscad
- Model status: concept-unvalidated
- [hardware/assemblies/corner-station/top-pulley-keeper.scad](../../../hardware/assemblies/corner-station/top-pulley-keeper.scad) — module `top_pulley_keeper`; revision 0.1.0.

Catalog lifecycle, procurement, and generated documentation do not establish physical validation. See the owning assembly for evidence and acceptance requirements.
