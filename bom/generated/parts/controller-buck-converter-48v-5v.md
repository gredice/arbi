# 48 V → 5 V controller buck converter

> Generated from canonical BOM inputs by `pnpm bom:generate`. Do not edit this page by hand.

[BOM](../../README.md) · [All items](README.md) · [Canonical part catalog](../../catalog/parts.json)

- Part ID: `controller-buck-converter-48v-5v`
- Unit: each
- Kind: component
- Lifecycle: active
- Disciplines: electronics
- Traits: off-the-shelf

## Requirements

- Input rating ≥60 V; 5 V output with sufficient current for Pico 2 W and cabinet auxiliaries.
- Fixed 5 V received variant; 50 x 30 x 17 mm envelope, four diameter-3 mm holes at 45 x 24 mm centre pitch, solder-pad input and output.

## Notes

Received fixed-5 V variant of AliExpress item 1005007014032926, confirmed by the owner on 2026-10-12. Measured envelope 50 x 30 x 17 mm; four diameter-3 mm mounting holes at 45 x 24 mm centre pitch. Input/output use solder pads, not terminal blocks. Geometry/evidence: docs/evidence/buck-converter-2026-10-12.md. Same selected module is used for pod and cabinet. Receipt and dimensions do not verify input limits, continuous current, efficiency, cooling or electrical suitability; PCB thickness and component geometry remain nominal. No new price, stock or commercial observation is claimed.

## Used in

Quantities are per assembly definition, before build multipliers. Optional and deferred usages are shown even when excluded from a scenario. Procurement stock is not an installed physical owner.

| Assembly or purchasing bucket | Quantity | Inclusion | Usage note |
| --- | ---: | --- | --- |
| [Control cabinet](../../../docs/assemblies/control-cabinet/README.md) | 1 each | base | — |

[Canonical assembly quantities](../../assemblies/assemblies.json)

## BOM reports

- [ARBI V1 — Zagreb repository baseline](../arbi-v1-hr-zagreb.md#required-parts-by-physical-owner-or-procurement-bucket) — included.

Catalog lifecycle, procurement, and generated documentation do not establish physical validation. See the owning assembly for evidence and acceptance requirements.
