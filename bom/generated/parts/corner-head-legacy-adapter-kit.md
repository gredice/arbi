# Temporary Barton adapter for r0.1.0 printed corner head

> Generated from canonical BOM inputs by `pnpm bom:generate`. Do not edit this page by hand.

[BOM](../../README.md) · [All items](README.md) · [Canonical part catalog](../../catalog/parts.json)

- Part ID: `corner-head-legacy-adapter-kit`
- Unit: each
- Kind: component
- Lifecycle: planned
- Disciplines: mechanical
- Traits: fabricated, printed

## Requirements

- One left and one right r0.1.0 adapter print per existing r0.1.0 carrier. Captures the old 32 x 8 mm tongue and uses its existing 8.6 mm bore; incompatible with r1.0.0 carrier halves.
- Separate M8 x 30 bolt, two M8 washers (16 x 8.4 x 1.6 mm nominal) and an M8 locknut retain the socket. The received Barton N01090 uses its supplied 4.7 mm pin and locking ring through the separate 5.2 mm bore and 14.8 mm printed lug. Verify actual fastener stack and retention; never substitute M8 through the bought tangs.
- Temporary unloaded fit/hand-routing trial only. Native pin is 35 mm below the old hole, with -1.4142 mm X correction; nominal 45-degree vertical winch tangent is retained but horizontal span/sheave height is 35 mm below r1.0.0. Strength, process, creep, printed clearance and installed articulation remain unqualified.

## Design warnings

- **Warning:** Fabrication status is concept-unvalidated; fit, materials and physical acceptance still need committed evidence.
- **Warning:** This part is planned; confirm its specification and selection with committed evidence.

## Notes

Optional temporary reuse kit proposed in issue #209; excluded from installed V1 and r1.0.0 manufacturing kits. Contains two prints only; bought fasteners and the already-owned pulley are separate. No supplier offer or material qualification. See hardware/assemblies/corner-station/legacy-pulley-adapter.md.

## Used in

Quantities are per assembly definition, before build multipliers. Optional and deferred usages are shown even when excluded from a scenario. Procurement stock is not an installed physical owner.

| Assembly or purchasing bucket | Quantity | Inclusion | Usage note |
| --- | ---: | --- | --- |
| [Corner support set](../../../docs/assemblies/corner-station/README.md) | 1 each | optional | One temporary two-print kit for a single existing r0.1.0 head fit trial; scale to the number of old heads tested. Excluded from V1 and replacement r1.0.0 kits. Extra M8 x 30 hardware is separate. |

[Canonical assembly quantities](../../assemblies/assemblies.json)

## BOM reports

- [ARBI V1 — Zagreb repository baseline](../arbi-v1-hr-zagreb.md) — not included by this build/inclusion policy.

## Fabrication

- Process: openscad
- Model status: concept-unvalidated
- [hardware/assemblies/corner-station/corner-head-legacy-adapter-left.scad](../../../hardware/assemblies/corner-station/corner-head-legacy-adapter-left.scad) — module `lpa_print_left`; revision 0.1.0.
- [hardware/assemblies/corner-station/corner-head-legacy-adapter-right.scad](../../../hardware/assemblies/corner-station/corner-head-legacy-adapter-right.scad) — module `lpa_print_right`; revision 0.1.0.

Catalog lifecycle, procurement, and generated documentation do not establish physical validation. See the owning assembly for evidence and acceptance requirements.
