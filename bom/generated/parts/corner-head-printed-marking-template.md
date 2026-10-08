# Printed-head shared timber centre marking template

> Generated from canonical BOM inputs by `pnpm bom:generate`. Do not edit this page by hand.

[BOM](../../README.md) · [All items](README.md) · [Canonical part catalog](../../catalog/parts.json)

- Part ID: `corner-head-printed-marking-template`
- Unit: each
- Kind: component
- Lifecycle: planned
- Disciplines: mechanical
- Traits: fabricated, printed

## Requirements

- One shared 205 x 50 x 4 mm printed marking tool for the four-station set, with 3 mm centre marks at 45/155 mm. Check scale and selected print dimensions; remove before drilling controlled coaxial 13 mm timber holes. Not a drill bush or installed structural part.

## Notes

New printed-head proposal; excluded from the purchasing baseline. Select instead of steel angle/plates, metal saddles and their covers. See docs/assemblies/corner-station/design-package.md. No supplier offer, cost or physical qualification asserted.

## Used in

Quantities are per assembly definition, before build multipliers. Optional and deferred usages are shown even when excluded from a scenario. Procurement stock is not an installed physical owner.

| Assembly or purchasing bucket | Quantity | Inclusion | Usage note |
| --- | ---: | --- | --- |
| [Corner support set](../../../docs/assemblies/corner-station/README.md) | 1 each | optional | One shared 205 mm printed-head marking tool, not four installed components. |

[Canonical assembly quantities](../../assemblies/assemblies.json)

## BOM reports

- [ARBI V1 — Zagreb repository baseline](../arbi-v1-hr-zagreb.md) — not included by this build/inclusion policy.

## Fabrication

- Process: openscad
- Model status: concept-unvalidated
- [hardware/assemblies/corner-station/corner-head-printed-template.scad](../../../hardware/assemblies/corner-station/corner-head-printed-template.scad) — module `corner_head_printed_template`; revision 0.1.0.

Catalog lifecycle, procurement, and generated documentation do not establish physical validation. See the owning assembly for evidence and acceptance requirements.
