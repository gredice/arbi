# Winch bearing/motor mount and guard

> Generated from canonical BOM inputs by `pnpm bom:generate`. Do not edit this page by hand.

[BOM](../../README.md) · [All items](README.md) · [Canonical part catalog](../../catalog/parts.json)

- Part ID: `winch-mount-and-guard`
- Unit: each
- Kind: component
- Lifecycle: active
- Disciplines: mechanical
- Traits: fabricated, printed

## Requirements

- Motor mount, two bearing supports, line guide, coupling guard and weather cover for direct-drive winch.

## Notes

Partial mount kit: per winch print two bearing lowers, two caps, one motor stand and one coupling cover. Requires separately budgeted rigid base, spacers and fasteners. Full drum/weather guard, line guide, homing and powered slip-ring mount remain unfinished; see hardware/assemblies/winch/mount.md.

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
- [hardware/assemblies/winch/winch-bearing-lower.scad](../../../hardware/assemblies/winch/winch-bearing-lower.scad) — module `wm_bearing_lower`; revision 0.1.0.
- [hardware/assemblies/winch/winch-bearing-cap.scad](../../../hardware/assemblies/winch/winch-bearing-cap.scad) — module `wm_bearing_cap`; revision 0.1.0.
- [hardware/assemblies/winch/winch-motor-stand.scad](../../../hardware/assemblies/winch/winch-motor-stand.scad) — module `wm_motor_stand`; revision 0.1.0.
- [hardware/assemblies/winch/winch-coupling-guard.scad](../../../hardware/assemblies/winch/winch-coupling-guard.scad) — module `wm_coupling_guard`; revision 0.1.0.

Catalog lifecycle, procurement, and generated documentation do not establish physical validation. See the owning assembly for evidence and acceptance requirements.
