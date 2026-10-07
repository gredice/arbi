# Round timber-pole machined metal saddle kit

> Generated from canonical BOM inputs by `pnpm bom:generate`. Do not edit this page by hand.

[BOM](../../README.md) · [All items](README.md) · [Canonical part catalog](../../catalog/parts.json)

- Part ID: `winch-round-pole-adapter`
- Unit: each
- Kind: component
- Lifecycle: active
- Disciplines: mechanical
- Traits: fabricated

## Requirements

- Two front and two rear machined metal saddles per winch. Nominal pole diameter 120 mm, parameter study 100–140 mm. Existing four-hole 50x120 mm M8 pattern and 25 mm front offset retained. DO NOT print these load-bearing parts.
- Material grade, stock, machining, corrosion treatment, contact fit, pole capacity and proof load require qualified review.

## Notes

Optional round-timber interface; replace the flat-post standoffs/backing plate, do not combine both mounting stacks. No supplier quote or qualified material assertion. See hardware/assemblies/winch/round-pole.md.

## Used in

Quantities are per assembly definition, before build multipliers. Optional and deferred usages are shown even when excluded from a scenario. Procurement stock is not an installed physical owner.

| Assembly or purchasing bucket | Quantity | Inclusion | Usage note |
| --- | ---: | --- | --- |
| [Winch set](../../../docs/assemblies/winch/README.md) | 4 each | optional | Round timber alternative for four winches; replaces flat-post spacer/backing/bolt allowances, not an additional structural stack. |

[Canonical assembly quantities](../../assemblies/assemblies.json)

## BOM reports

- [ARBI V1 — Zagreb repository baseline](../arbi-v1-hr-zagreb.md) — not included by this build/inclusion policy.

## Fabrication

- Process: openscad
- Model status: concept-unvalidated
- [hardware/assemblies/winch/winch-pole-front-saddle.scad](../../../hardware/assemblies/winch/winch-pole-front-saddle.scad) — module `wp_front_saddle`; revision 0.1.0.
- [hardware/assemblies/winch/winch-pole-rear-saddle.scad](../../../hardware/assemblies/winch/winch-pole-rear-saddle.scad) — module `wp_rear_saddle`; revision 0.1.0.

Catalog lifecycle, procurement, and generated documentation do not establish physical validation. See the owning assembly for evidence and acceptance requirements.
