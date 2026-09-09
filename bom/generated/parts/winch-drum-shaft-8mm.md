# 8 mm steel drum shaft (variant cut allowance)

> Generated from canonical BOM inputs by `pnpm bom:generate`. Do not edit this page by hand.

[BOM](../../README.md) · [All items](README.md) · [Canonical part catalog](../../catalog/parts.json)

- Part ID: `winch-drum-shaft-8mm`
- Unit: each
- Kind: component
- Lifecycle: active
- Disciplines: mechanical
- Traits: off-the-shelf

## Requirements

- Solid nominal 8 mm steel shaft for the direct-drive drum, supported independently by bearings. Layout allowances: three passive shafts 340 mm and one powered shaft 660 mm; verify the full shaft stack before cutting.
- Prototype selection: BAUHAUS hot-rolled stock. Inspect actual diameter, roundness, straightness and 608 bearing/coupling fit before use; no precision tolerance or structural qualification is claimed.

## Notes

Owner-selected BAUHAUS 2000 mm stock rod. Modeled layout allocates 3 × 340 mm + 1 × 660 mm = 1680 mm before kerfs, leaving 320 mm for kerfs/offcut. This supersedes four approximate 400 mm blanks; length is not structural approval. Cutting, deburring, corrosion protection and fit finishing are not included in the stock price.

## Used in

Quantities are per assembly definition, before build multipliers. Optional and deferred usages are shown even when excluded from a scenario. Procurement stock is not an installed physical owner.

| Assembly or purchasing bucket | Quantity | Inclusion | Usage note |
| --- | ---: | --- | --- |
| [Winch set](../../../docs/assemblies/winch/README.md) | 4 each | base | — |

[Canonical assembly quantities](../../assemblies/assemblies.json)

## BOM reports

- [ARBI V1 — Zagreb repository baseline](../arbi-v1-hr-zagreb.md#required-parts-by-physical-owner-or-procurement-bucket) — included.

Catalog lifecycle, procurement, and generated documentation do not establish physical validation. See the owning assembly for evidence and acceptance requirements.
