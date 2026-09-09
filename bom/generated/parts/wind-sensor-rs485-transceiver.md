# 3.3 V RS485 transceiver module for wind sensor

> Generated from canonical BOM inputs by `pnpm bom:generate`. Do not edit this page by hand.

[BOM](../../README.md) · [All items](README.md) · [Canonical part catalog](../../catalog/parts.json)

- Part ID: `wind-sensor-rs485-transceiver`
- Unit: each
- Kind: component
- Lifecycle: planned
- Disciplines: electronics
- Traits: off-the-shelf

## Requirements

- MAX3485/SP3485-class 3.3 V UART↔RS485 module; one active + one spare. This is only for weather sensor, not motor control.

## Used in

Quantities are per assembly definition, before build multipliers. Optional and deferred usages are shown even when excluded from a scenario. Procurement stock is not an installed physical owner.

| Assembly or purchasing bucket | Quantity | Inclusion | Usage note |
| --- | ---: | --- | --- |
| [Site installation](../../../docs/assemblies/site-installation/README.md) | 2 each | deferred | Site weather endpoint with a control-cabinet interface. |

[Canonical assembly quantities](../../assemblies/assemblies.json)

## BOM reports

- [ARBI V1 — Zagreb repository baseline](../arbi-v1-hr-zagreb.md) — not included by this build/inclusion policy.

Catalog lifecycle, procurement, and generated documentation do not establish physical validation. See the owning assembly for evidence and acceptance requirements.
