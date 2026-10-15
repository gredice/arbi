# Compact camera pod bought fastener set

> Generated from canonical BOM inputs by `pnpm bom:generate`. Do not edit this page by hand.

[BOM](../../README.md) · [All items](README.md) · [Canonical part catalog](../../catalog/parts.json)

- Part ID: `camera-pod-fastener-kit`
- Unit: each
- Kind: component
- Lifecycle: planned
- Disciplines: mechanical, fasteners
- Traits: fastener, off-the-shelf

## Requirements

- 8 M3 x 25 screws (4 frame, 4 enclosure), 12 M3 washers, 8 plain M3 nuts; frame washers/nuts load into the integral deck posts, enclosure nuts into the lowered hood pockets.
- 7 M3 x 12 screws (4 outer-head clamps, 2 pivot-support attachments, 1 pivot), 13 M3 washers, 7 plain M3 nuts and one 0.7 mm M3 pivot shim.
- 12 M2 x 8 screws (4 Pi, 4 converter, 4 camera), 16 M2 washers and 12 plain M2 nuts; use the revised captive/recessed seats without modifying PCB holes.
- 4 M2 x 8 countersunk horn-retainer screws (2 pan, 2 tilt), 4 lower M2 washers and 4 plain M2 nuts; no washer beneath a countersunk head.
- 4 M1.6 x 6 countersunk servo-ear screws and 4 plain M1.6 nuts; no washers.
- Two OEM horn centre screws and stock horns belong to the selected servo supply; confirm both are included.
- Nominal washers: M2 inside diameter 2.2 mm, outside diameter 5 mm, thickness 0.3 mm; M3 inside diameter 3.2 mm, outside diameter 7 mm, thickness 0.5 mm. The pivot shim has the M3 diameters and thickness 0.7 mm.
- Total: 35 bought screws in five variants, 45 flat washers, one pivot shim and 35 plain nuts. All ordinary screw lengths are at most 25 mm; actual stock counts/head styles remain to be confirmed.
- Camera M2 x 8 screws enter from the rear into front captive hood nuts; both bear on printed seats, not directly on the PCB. No camera washers. The cradle head recess and hood nut tunnels require their matching r0.2.0 prints.

## Design warnings

- **Warning:** This part is planned; confirm its specification and selection with committed evidence.

## Notes

One installed set per compact enclosed pod, derived from scripts/camera-pod-booklet/integration.py and the fastener standardization proposal (GitHub #225). M3 x 12/25 printed joints and M2 x 8 board joints eliminate M2.5/M4 without drilling the PCBs; the integrated deck replaces four loose spacers. This is a proposed nominal-CAD configuration, not received-hardware or load acceptance. Socket/cap reference heads and countersunk retainer/ear heads are distinct. Reconcile shared purchasing stock and servo-supplied accessories before ordering.

## Used in

Quantities are per assembly definition, before build multipliers. Optional and deferred usages are shown even when excluded from a scenario. Procurement stock is not an installed physical owner.

| Assembly or purchasing bucket | Quantity | Inclusion | Usage note |
| --- | ---: | --- | --- |
| [Camera pod](../../../docs/assemblies/camera-pod/README.md) | 1 each | base | — |

[Canonical assembly quantities](../../assemblies/assemblies.json)

## BOM reports

- [ARBI V1 — Zagreb repository baseline](../arbi-v1-hr-zagreb.md#required-parts-by-physical-owner-or-procurement-bucket) — included.

Catalog lifecycle, procurement, and generated documentation do not establish physical validation. See the owning assembly for evidence and acceptance requirements.
