# WASI pulley purchase and shipping — 2026-10-08

Destination: Zagreb, Croatia. This date records the owner's confirmation and
website observation; the original order and collection dates were not supplied.

## Owner-confirmed purchase

Aleks confirmed four **BA01090** pulleys from WASI for **EUR 56.80 total**, collected
in store with **no delivery charge**. The unit price is EUR 56.80 / 4 = **EUR 14.20**.
These details clarify the four WASI top pulleys already recorded as received in
the [receipt log](../receipts.md) on 2026-09-08; they do not add another four units.
No invoice or VAT breakdown was supplied, so goods tax treatment remains unknown.

The [WASI product listing](https://wasi.hr/kolotura-jednostruka-fiksna-za-uze-do-8m),
observed on 2026-10-08, identifies **BA 01090** as the Barton **30mm STANDARD
Koloturnik, dvostruko hvatište**, sold per piece at **EUR 14.20**, with stock listed.
The supplier specifies a plain bearing. Purchase and supplier specifications do
not establish inspected identity, measured friction, line retention or installed
engineering qualification.

## Separate delivery tariff

[WASI delivery and payment terms](https://wasi.hr/shipping-returns), observed on
2026-10-08, state that personal collection in a WASI branch incurs no delivery
charge. Published Croatian delivery charges include VAT:

| Order value, as stated by WASI | Delivery charge |
| --- | ---: |
| Up to EUR 60 | EUR 6 |
| EUR 60 to EUR 120 | EUR 4 |
| Above EUR 120 | Free |

WASI may quote different charges for bulky or heavy shipments. Its terms also
state a separate EUR 2 cash-on-delivery fee. A delivered EUR 56.80 basket would
fall in the EUR 6 delivery tier; that hypothetical charge is not applied to this
collected purchase. At exactly EUR 60 the published tier wording overlaps, so a
future order at that boundary needs checkout confirmation.

## Canonical records

The [offer catalog](../catalog/offers.json) keeps stable offer `wasi-barton-30mm`,
now selected with one pulley per purchase unit and SKU BA01090. The
[scenario](../scenarios/scenarios.json) selects that WASI offer instead of the
unresolved `baseline-combined-top-pulley-offer`.

The [new quote snapshot](../quotes/hr-zagreb-2026-10-08-wasi-pulley.json) records
EUR 14.20 per purchase unit and zero shipping for store pickup. It copies every
other observation unchanged from the
[previous quote](../quotes/hr-zagreb-2026-09-08-bauhaus-shaft.json); its capture date
does not refresh those prices. Earlier snapshots and the legacy combined offer
remain available as history. The order remains `baseline-selected`, without
engineering approval.
