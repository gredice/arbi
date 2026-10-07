# Four-winch full-cover fastening and loom allowance

> Generated from canonical BOM inputs by `pnpm bom:generate`. Do not edit this page by hand.

[BOM](../../README.md) · [All items](README.md) · [Canonical part catalog](../../catalog/parts.json)

- Part ID: `winch-full-cover-hardware`
- Unit: each
- Kind: consumable
- Lifecycle: active
- Disciplines: mechanical, electrical
- Traits: fastener, off-the-shelf

## Requirements

- One unquoted set for 3 passive + 1 powered cover: 56 M4x16 shell screws, 56 plain M4 captive nuts and 56 M4 washers (9 mm OD). Use a reviewed removable screw-locking method.
- 56 M4x25 clip-to-base screws plus 8 M4x25 cable-anchor screws; 64 M4 locknuts and 128 M4 washers. Stack: 6 mm print, 8 mm base, two 0.8 mm washers, 5 mm locknut, 4.4 mm nominal tip projection.
- Eight soft hook-and-loop loom wraps, <=5.5 mm wide and <=2.5 mm thick through the 6x3 mm base-anchor slots; eight soft-edged 14 mm bottom loom exits. Cable OD, connector size, bend radius, drip loop and strain relief require received-unit confirmation.
- 14 / 22 cover holes per passive / powered aluminium base, diameter 4.5 mm. Anchor holes now X=W/2+50 and W/2+70, Y=-60; reuse clip holes and add the relocated anchor pair to an old plate. Existing drivetrain/post holes retained.
- 16 steel M8 standoffs, 25 mm long, nominal 16 mm OD / 9 mm bore (four per winch), between the aluminium base and 100 mm timber post. Existing M8x160 length gives 11.8 mm nominal projection after 8 mm base, 25 mm spacer, 100 mm timber, 4 mm backing, two 1.6 mm washers and 8 mm locknut. Structural capacity, received stack and installation remain unverified; no printed structural spacers.

## Notes

No supplier offers or prices asserted. Do not assume assortment coverage. Motor/encoder looms <=10 mm OD each are envelope assumptions. Separate rotating-conductor/slip-ring support remains unresolved.

## Used in

Quantities are per assembly definition, before build multipliers. Optional and deferred usages are shown even when excluded from a scenario. Procurement stock is not an installed physical owner.

| Assembly or purchasing bucket | Quantity | Inclusion | Usage note |
| --- | ---: | --- | --- |
| [Winch set](../../../docs/assemblies/winch/README.md) | 1 each | base | — |

[Canonical assembly quantities](../../assemblies/assemblies.json)

## BOM reports

- [ARBI V1 — Zagreb repository baseline](../arbi-v1-hr-zagreb.md#required-parts-by-physical-owner-or-procurement-bucket) — included.

Catalog lifecycle, procurement, and generated documentation do not establish physical validation. See the owning assembly for evidence and acceptance requirements.
