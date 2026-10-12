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
- One soft incoming-lead sleeve/grommet and separate soft retention for power, CSI and servo service loops. The converter uses four screw stacks; the remaining capacitor tie and harness retention are temporary bench workarounds only. Final dedicated capacitor retention and strain relief remain unresolved.
- Independent positioning-line tensile termination belongs to the winch line interface; internal conductors and connectors must carry no positioning load.

## Design warnings

- **Critical:** The capacitor tie and harness retention are shown without a complete procurement specification or quantity. Record the missing hardware data and replace those ties with dedicated mounts and strain relief; cable ties are temporary bench workarounds only.
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
