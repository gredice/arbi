# Corner head reusable centre marking template

> Generated from canonical BOM inputs by `pnpm bom:generate`. Do not edit this page by hand.

[BOM](../../README.md) · [All items](README.md) · [Canonical part catalog](../../catalog/parts.json)

- Part ID: `corner-head-marking-template`
- Unit: each
- Kind: component
- Lifecycle: planned
- Disciplines: mechanical
- Traits: fabricated, printed

## Requirements

- One shared 200 x 50 x 4 mm marking template, 45/155 mm centre pattern. Mark with 3 mm punch; remove before drilling. Check scale and actual bought angle holes.

## Notes

Proposed package; excluded from the baseline scenario. See docs/assemblies/corner-station/design-package.md. No supplier price or engineering qualification asserted.

## Used in

Quantities are per assembly definition, before build multipliers. Optional and deferred usages are shown even when excluded from a scenario. Procurement stock is not an installed physical owner.

| Assembly or purchasing bucket | Quantity | Inclusion | Usage note |
| --- | ---: | --- | --- |
| [Corner support set](../../../docs/assemblies/corner-station/README.md) | 1 each | optional | One shared reusable tool, not four installed parts. |

[Canonical assembly quantities](../../assemblies/assemblies.json)

## BOM reports

- [ARBI V1 — Zagreb repository baseline](../arbi-v1-hr-zagreb.md) — not included by this build/inclusion policy.

## Fabrication

- Process: openscad
- Model status: concept-unvalidated
- [hardware/assemblies/corner-station/corner-head-marking-template.scad](../../../hardware/assemblies/corner-station/corner-head-marking-template.scad) — module `corner_head_marking_template`; revision 0.1.0.

Catalog lifecycle, procurement, and generated documentation do not establish physical validation. See the owning assembly for evidence and acceptance requirements.
