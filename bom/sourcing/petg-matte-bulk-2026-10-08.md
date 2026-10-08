# PETG Matte and bulk filament costing — 8 October 2026

This record supersedes the single-spool costing selection in [the earlier observation](print-materials-2026-10-08.md). Geometry, installed quantities and physical qualification are unchanged. The canonical price and component assignments are in [fabrication.json](../catalog/fabrication.json).

## Observed price basis

The EU store's [filament bulk promotion](https://eu.store.bambulab.com/pages/promotions/filament-bulk-sale) lists PETG Matte, PETG Basic and PLA Basic as eligible for mixed purchases, with 10% off at two rolls, 20% at four, 30% at six and 40% at ten or more. This estimate selects the **10+ eligible mixed-roll tier**, using **1 kg filament with spool**, rather than refill pricing, membership or coupons. The order must actually qualify; a smaller order requires a new price observation and recalculation.

| Material | With-spool MSRP | Selected 10+ roll rate | Evidence |
| --- | ---: | ---: | --- |
| PLA Basic | €19.99 | €11.99 / 1 kg | [Product](https://eu.store.bambulab.com/products/pla-basic-filament); 40% promotion tier |
| PETG Basic | €18.99 | €11.39 / 1 kg | [Product](https://eu.store.bambulab.com/products/petg-basic); 40% promotion tier |
| PETG Matte | €18.99 | €11.39 / 1 kg | [Product](https://eu.store.bambulab.com/products/petg-matte); selected with-spool header displayed €11.39 and “Lowest price for 10+ rolls” |
| ASA | €24.99 | €24.99 / 1 kg, single spool | [Earlier observation](print-materials-2026-10-08.md); ASA was absent from the eligible promotion tabs |

PLA Basic and PETG Basic rates follow the observed MSRP and 40% tier, expressed at the advertised retail cent precision. PETG Matte's €9.59 refill headline is **not** the selected with-spool price. ASA retains its earlier timestamp and price; no unsupported bulk discount is applied.

Both [White 35100](https://eu.store.bambulab.com/products/petg-matte?id=775952393450868758) and [Black 35101](https://eu.store.bambulab.com/products/petg-matte?id=775952393450868774) were listed as 1 kg with-spool variants. No order was placed. Croatia delivery, stock reservation, checkout tax and shipping were not qualified. Rates remain time-specific evidence rather than a guaranteed landed quote.

## Material and component selection

The [PETG Matte technical data sheet V1.0](https://store.bblcdn.eu/s8/default/240fb0c791fb4903a9d72934895e9a16/PETG_Matte.pdf) gives density **1.37 g/cm³** and heat-deflection temperature **72.3°C at 0.45 MPa**, measured on its specified printed specimens. These are comparison values, not a continuous operating limit or qualification of the white and black ARBI prints. This is PETG Matte, a distinct product from PETG HF or PETG Basic; their densities are not interchangeable.

PETG Matte is selected as a prototype costing candidate for the cosmetic shell portions:

- White: payload rain hood and optical surround, coupling guard, winch cover shells/shutters/fascias/rear panels, and optional round-pole nut covers.
- Black: payload lower enclosure and removable outer gimbal head. The separate internal gimbal carrier retains PETG Basic.

Structural and functional recipes retain their existing assumptions: PETG Basic for the spider, deck, spacers, servo mounts, gimbal carrier/cradle/pivot supports, horn retainers, winch drum, bearing/motor mounts, dock and pulley keeper; ASA for winch cover clips/cable anchors and the optional pole cable guide. Optional configurations remain excluded from the base build. Cosmetic shells still have fastening interfaces and require inspection; appearance does not establish clamp strength or retention.

The hardware enclosure manual's preference for ASA for an exposed release remains a qualification target. This BOM change records a PETG Matte prototype material allowance, not completed UV, creep, rain, thermal, fit or flying-mass acceptance. No geometry or source revisions change.

## Calculation boundary

Each installed component uses its own assigned material density and colour. The estimate is fully dense CAD volume × installed copies × density × observed roll price / 1,000 g. It sums colour/material consumption costs separately, with total mass rounded after extension. Replacing ASA or PETG Basic with PETG Matte can increase estimated mass despite the lower price.

This is consumed filament cost, not the cash required to buy whole rolls. Supports, purge, waste, print settings, electricity, labour, hardware and shipping remain outside the allowance. Sliced weights should replace these estimates when attributable to the same revisions, installed quantities and selected material. Whole-kit material comparisons are homogeneous alternatives and do not overwrite the mixed selected recipe.
