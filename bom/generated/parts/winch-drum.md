# Single-layer grooved winch drum

> Generated from canonical BOM inputs by `pnpm bom:generate`. Do not edit this page by hand.

[BOM](../../README.md) · [All items](README.md) · [Canonical part catalog](../../catalog/parts.json)

- Part ID: `winch-drum`
- Unit: each
- Kind: component
- Lifecycle: active
- Disciplines: mechanical
- Traits: fabricated, printed

## Requirements

- Direct-drive, single-layer grooved drum on independent 8 mm shaft. No GT2 pulley, belt or gearbox in V1.

## Notes

One assembled drum per BOM unit. Print three passive kits and one powered kit using hardware/assemblies/winch/README.md; source list is a variant/component library, not one copy of every source per drum. PLA first prototype; later ASA requires separate fit/process qualification. Full-travel powered drum is substantially wider and its shaft deflection is unvalidated.

## Used in

Quantities are per assembly definition, before build multipliers. Optional and deferred usages are shown even when excluded from a scenario. Procurement stock is not an installed physical owner.

| Assembly or purchasing bucket | Quantity | Inclusion | Usage note |
| --- | ---: | --- | --- |
| [Winch set](../../../docs/assemblies/winch/README.md) | 4 each | base | — |

[Canonical assembly quantities](../../assemblies/assemblies.json)

## BOM reports

- [ARBI V1 — Zagreb repository baseline](../arbi-v1-hr-zagreb.md#required-parts-by-physical-owner-or-procurement-bucket) — included.

## Fabrication

- Process: openscad
- Model status: concept-unvalidated
- [hardware/assemblies/winch/winch-drum-alignment-pin.scad](../../../hardware/assemblies/winch/winch-drum-alignment-pin.scad) — module `wd_alignment_pin`; revision 0.1.0.
- [hardware/assemblies/winch/winch-drum-clamp-half.scad](../../../hardware/assemblies/winch/winch-drum-clamp-half.scad) — module `wd_clamp_half`; revision 0.1.0.
- [hardware/assemblies/winch/winch-drum-flange.scad](../../../hardware/assemblies/winch/winch-drum-flange.scad) — module `wd_flange`; revision 0.1.0.
- [hardware/assemblies/winch/winch-drum-passive-1.scad](../../../hardware/assemblies/winch/winch-drum-passive-1.scad) — module `wd_body_section`; revision 0.1.0.
- [hardware/assemblies/winch/winch-drum-passive-2.scad](../../../hardware/assemblies/winch/winch-drum-passive-2.scad) — module `wd_body_section`; revision 0.1.0.
- [hardware/assemblies/winch/winch-drum-powered-1.scad](../../../hardware/assemblies/winch/winch-drum-powered-1.scad) — module `wd_body_section`; revision 0.1.0.
- [hardware/assemblies/winch/winch-drum-powered-2.scad](../../../hardware/assemblies/winch/winch-drum-powered-2.scad) — module `wd_body_section`; revision 0.1.0.
- [hardware/assemblies/winch/winch-drum-powered-3.scad](../../../hardware/assemblies/winch/winch-drum-powered-3.scad) — module `wd_body_section`; revision 0.1.0.
- [hardware/assemblies/winch/winch-drum-tail-clamp.scad](../../../hardware/assemblies/winch/winch-drum-tail-clamp.scad) — module `wd_tail_clamp`; revision 0.1.0.
- [hardware/assemblies/winch/winch-drum-flange-right.scad](../../../hardware/assemblies/winch/winch-drum-flange-right.scad) — module `wd_flange_right`; revision 0.1.0.

Catalog lifecycle, procurement, and generated documentation do not establish physical validation. See the owning assembly for evidence and acceptance requirements.
