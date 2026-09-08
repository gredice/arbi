# Winch shaft sourcing — 2026-09-08

Destination: Zagreb, Croatia. Research candidates only; no purchase or canonical
BOM supplier replacement has been made. Website listings are dated observations,
not reserved stock or supplier-confirmed quotes. Shipping and cutting costs are
unknown unless stated below.

Owner confirmed on this date: no drum shaft is owned; the AliExpress coupling is
ordered. The [catalog](../catalog/parts.json) specifies an 8 mm-to-8 mm jaw coupling,
approximately D20/L25, linked through offer `aliexpress-flexible-jaw-coupling-8mm`.
Ordered does not establish receipt, measured engagement length, or torque rating.

## Candidates

| Supplier and source | Stock unit and listed price | Availability evidence | Assessment |
| --- | --- | --- | --- |
| [BAUHAUS Kantoflex 10504331](https://www.bauhaus.hr/sipke/kantoflex-okrugla-sipka/p/10504331) | One Ø8 × 2000 mm hot-rolled steel rod; EUR 6.95 including VAT | Online listing; Zagreb branch stock not confirmed | No precision diameter/straightness tolerance stated. Not selected for finished bearing seats. |
| [PKL W 8 H6 2000](https://pkl.hr/proizvod/linearna-vodilica-fi-8-mm-materijal-ck53-cf53-60-64hrc-h6-duzina-2000mm-neobradeno-2/) | One Ø8 × 2000 mm Cf53 shaft, hardened 62 ±2 HRC, h6; EUR 24.81 including VAT | Product page showed one unit in stock; dispatch or pickup in Rijeka | Best concrete domestic stock candidate found. Delivery to Zagreb and cut/deburr service need a quote. |
| [Tuli W 8/h6](https://www.tuli.hr/okrugla-vodilica-w-8-h6) | Length configurable, maximum single length 2000 mm; C45/CK55 hardened ground shaft | Indexed supplier page advertises partner stock; current price and dispatch not independently confirmed in opened page | Delivery fallback, not confirmed Zagreb pickup. Obtain a current delivered quote including cutting and small-order charges. |

No suitable precision Ø8 shaft listing was found on Pevex during this search.
This is not evidence that every Pevex branch lacks one. No suitable same-day
Zagreb pickup option was confirmed.

## Proposed purchasing specification

Prefer a ground solid steel shaft with specified diameter tolerance, straightness,
material and finish over general-purpose hot-rolled rod. An h6 shaft is a candidate
for evaluation; the final rotating bearing fit and ring retention still depend on
the actual bearings and load case. Corrosion protection and shaft deflection need
review in the full winch design.

A 400 mm blank is a provisional procurement allowance, **not a final cut length**.
Four such blanks consume 1600 mm plus saw kerfs from one 2000 mm stock shaft.
The current drum is 270.9 mm long; bearing widths, collars, coupling engagement,
hub and assembly clearances must be laid out before cutting to final length.
The existing approximately 200 mm BOM shaft cannot accommodate that drum.

The PKL product warns that its hardened surface requires suitable machining
methods. Request supplier cutting and deburring; do not base the torque interface
on casually drilling a cross-hole in hardened shaft stock. Keep the ordered 8-to-8
coupling interface while evaluating a separate clamping drum hub.

This sourcing note does not approve an 8 mm shaft's bending/fatigue performance or
release a new BOM length. See the [drum development proposal](../../hardware/assemblies/winch/drum-development.md).
