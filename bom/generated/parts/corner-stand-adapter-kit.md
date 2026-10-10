# Optional WT-806 indoor corner-station adapter kit

> Generated from canonical BOM inputs by `pnpm bom:generate`. Do not edit this page by hand.

[BOM](../../README.md) · [All items](README.md) · [Canonical part catalog](../../catalog/parts.json)

- Part ID: `corner-stand-adapter-kit`
- Unit: each
- Kind: component
- Lifecycle: active
- Disciplines: mechanical
- Traits: fabricated, printed

## Requirements

- One stand kit: two head fronts, two head rears, two winch fronts and two winch rears; eight installed prints from four models, revision 0.1.0.
- Default head tube 26 mm, lower winch tube 35 mm; measure both stands and export matching halves for any parameter change. No tube drilling or top-thread attachment.
- Round-120 printed carriers at 110 mm M12 pitch; passive winch original 50 x 120 mm M8 base-hole pattern. Short M12 x 90 and M8 x 40 mounting bolts replace timber bolts.
- Per stand, buy separately: four M6 x 60 and four M6 x 70 bolts, sixteen M6 washers, eight M6 locking nuts; two M12 x 90 bolts, four large M12 washers, two M12 locking nuts; four M8 x 40 bolts, eight M8 washers, four M8 locking nuts.
- Unloaded indoor fit/rotation development only. No validated clamp strength, tube-crush limit, creep, side-load or tipping capacity. Actual assembled mass and independent retention must be checked.

## Notes

The owner has two WT-806 stands (ASIN B000LWEA0I). Two optional kits produce sixteen prints. Reuse existing carrier cross-bolts, pulley and compatible pin; omit timber rear pads, long through-bolts and rear cosmetic cover. Hardware/printing/acceptance: hardware/assemblies/corner-station/stand-adapter.md. No supplier offer or sliced-material estimate is assigned.

## Used in

Quantities are per assembly definition, before build multipliers. Optional and deferred usages are shown even when excluded from a scenario. Procurement stock is not an installed physical owner.

| Assembly or purchasing bucket | Quantity | Inclusion | Usage note |
| --- | ---: | --- | --- |
| [Corner support set](../../../docs/assemblies/corner-station/README.md) | 2 each | optional | Two owned WT-806 stands for indoor development; sixteen adapter prints total. Excluded from installed baseline. Bought short bolts, washers and nuts are separate; see fixture instructions. |

[Canonical assembly quantities](../../assemblies/assemblies.json)

## BOM reports

- [ARBI V1 — Zagreb repository baseline](../arbi-v1-hr-zagreb.md) — not included by this build/inclusion policy.

## Fabrication

- Process: openscad
- Model status: concept-unvalidated
- [hardware/assemblies/corner-station/corner-stand-head-front.scad](../../../hardware/assemblies/corner-station/corner-stand-head-front.scad) — module `csa_print_front`; revision 0.1.0.
- [hardware/assemblies/corner-station/corner-stand-head-rear.scad](../../../hardware/assemblies/corner-station/corner-stand-head-rear.scad) — module `csa_print_rear`; revision 0.1.0.
- [hardware/assemblies/corner-station/corner-stand-winch-front.scad](../../../hardware/assemblies/corner-station/corner-stand-winch-front.scad) — module `csa_print_front`; revision 0.1.0.
- [hardware/assemblies/corner-station/corner-stand-winch-rear.scad](../../../hardware/assemblies/corner-station/corner-stand-winch-rear.scad) — module `csa_print_rear`; revision 0.1.0.

Catalog lifecycle, procurement, and generated documentation do not establish physical validation. See the owning assembly for evidence and acceptance requirements.
