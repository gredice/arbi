# Round-pole nut covers and cable guide kit

> Generated from canonical BOM inputs by `pnpm bom:generate`. Do not edit this page by hand.

[BOM](../../README.md) · [All items](README.md) · [Canonical part catalog](../../catalog/parts.json)

- Part ID: `winch-round-pole-covers`
- Unit: each
- Kind: component
- Lifecycle: active
- Disciplines: mechanical
- Traits: fabricated, printed

## Requirements

- Two white sliding rear nut covers, two snug underside closures and one dark two-loom cable guide per winch. Covers use metal saddle rails; remove underside closures before lifting caps. Guide tied to the pole independently of winch load.
- Concept-unvalidated: print fit, underside closure/gravity-stop retention, vibration, UV and cable-clipping force require physical acceptance.

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
- [hardware/assemblies/winch/winch-pole-nut-cover.scad](../../../hardware/assemblies/winch/winch-pole-nut-cover.scad) — module `wp_print_nut_cover`; revision 0.1.0.
- [hardware/assemblies/winch/winch-pole-nut-cover-bottom.scad](../../../hardware/assemblies/winch/winch-pole-nut-cover-bottom.scad) — module `wp_print_nut_cover_bottom`; revision 0.1.0.
- [hardware/assemblies/winch/winch-pole-cable-guide.scad](../../../hardware/assemblies/winch/winch-pole-cable-guide.scad) — module `wp_print_cable_guide`; revision 0.1.0.

Catalog lifecycle, procurement, and generated documentation do not establish physical validation. See the owning assembly for evidence and acceptance requirements.
