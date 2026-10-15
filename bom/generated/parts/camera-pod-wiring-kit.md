# Camera pod internal wiring and retention set

> Generated from canonical BOM inputs by `pnpm bom:generate`. Do not edit this page by hand.

[BOM](../../README.md) · [All items](README.md) · [Canonical part catalog](../../catalog/parts.json)

- Part ID: `camera-pod-wiring-kit`
- Unit: each
- Kind: component
- Lifecycle: planned
- Disciplines: electrical, electronics
- Traits: cable, off-the-shelf

## Requirements

- One 15-pin CSI ribbon between Pi 3A+ and Camera Module 3; final length, end stiffeners, bend radius and fatigue behaviour must match the compact pan/tilt route. Check whether the selected camera supply includes a usable ribbon.
- Fixed 5 V/ground distribution and two servo power/signal leads, capacitor connections and insulated incoming power termination. Connector types, conductor gauges and cut lengths remain unselected.
- Independent positioning-line tensile termination belongs to the winch line interface; internal conductors and connectors must carry no positioning load.
- One split soft insulating power-clamp liner, nominal free ID6/OD7 x 10 mm long, for the stopped 6.8 mm bore and nominal 6 mm sleeved lead. Measure received insulation and select compatible liner hardness/thickness before printing.
- Four insulating silicone CSI pads, 16 x 12 x 0.5 mm free, and four servo pads, 4 x 10 x 0.5 mm free; two pads per clamp. Nominal loaded thickness is 0.4 mm per pad (1.1 mm CSI / 2.8 mm servo stopped gaps). These are design assumptions, not qualified compression or grip specifications.
- Protect the three base outlets with received-fit soft edge lining/grommets and inspect drip loops. Actual connector sizes, cable gauge/cut length and edge-liner product/dimensions remain unselected; no ties are used in the current compact design.

## Design warnings

- **Critical:** Stopped lined power, CSI and servo clamps replace ties. Actual cable/FPC dimensions, liner compatibility/compression, pull-out, electrical isolation, relaxed loops and flex fatigue remain unverified. These clamps do not terminate positioning-line tension.
- **Warning:** This part is planned; confirm its specification and selection with committed evidence.

## Notes

One required assembly set per pod; component selection and exact cut lengths remain unresolved. No supplier or price selected. The long powered positioning-line conductors stay owned by winch-set; this kit covers only the pod internal terminations/harness. CSI ribbon and OEM servo leads must be reconciled with supplied accessories before purchasing.

## Used in

Quantities are per assembly definition, before build multipliers. Optional and deferred usages are shown even when excluded from a scenario. Procurement stock is not an installed physical owner.

| Assembly or purchasing bucket | Quantity | Inclusion | Usage note |
| --- | ---: | --- | --- |
| [Camera pod](../../../docs/assemblies/camera-pod/README.md) | 1 each | base | — |

[Canonical assembly quantities](../../assemblies/assemblies.json)

## BOM reports

- [ARBI V1 — Zagreb repository baseline](../arbi-v1-hr-zagreb.md#required-parts-by-physical-owner-or-procurement-bucket) — included.

Catalog lifecycle, procurement, and generated documentation do not establish physical validation. See the owning assembly for evidence and acceptance requirements.
