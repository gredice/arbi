# Shared procurement stock geometry

See the [owning assembly or procurement policy](../../../bom/README.md).

## Approximate BOM visualizations

These `visualization` models show catalog items in the Parts inventory. They are **Unverified** and are not manufacturing sources. Shape is not yet fully defined and needs rework against the selected supplier drawing or measured item before fit or clearance decisions. Nominal dimensions recorded in the catalog remain requirements, not measurement evidence. Threads, connectors, internal construction and fine detail are simplified. Kits and assortments show representative samples, not quantities; cable loops and lengths show samples, not installed routing.

| BOM item / source | Shape | Dimension basis and remaining uncertainty |
| --- | --- | --- |
| [cable-gland-assortment](cable-gland-assortment.scad) · [BOM](../../../bom/generated/parts/cable-gland-assortment.md) | glands | Representative M12/M16/M20 glands; overall lengths and cable bores are assumed, not pack contents. |
| [heat-set-insert-assortment](heat-set-insert-assortment.scad) · [BOM](../../../bom/generated/parts/heat-set-insert-assortment.md) | inserts | Representative M3/M4/M5 insert rings; knurl, length and pack quantities unknown. |
| [stainless-fastener-assortment](stainless-fastener-assortment.scad) · [BOM](../../../bom/generated/parts/stainless-fastener-assortment.md) | fasteners | Representative M3/M4/M5/M6 bolts, nuts and washers; no size-level pack contents or quantities claimed. |
