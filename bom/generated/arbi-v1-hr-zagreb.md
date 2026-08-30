# BOM — ARBI V1 — Zagreb repository baseline

> **Status: INCOMPLETE. This is not a trustworthy complete landed total.**
> Unknown package rules, prices, tax treatment, shipping, availability, and unqualified baseline selections remain visible below. Null values are never treated as zero.

## Calculation identity

- Scenario: arbi-v1-hr-zagreb
- Build: arbi-v1
- Destination: hr-zagreb
- Quote snapshot: hr-zagreb-2026-08-30
- Input digest: sha256:d39c1f376900d6797932710455046e3d5dae21fdaac5038feaafeda8a3adb884
- Complete landed total: **unavailable**
- Known quoted goods subtotal: **EUR 867.73**
- Known checkout-group shipping subtotal: **EUR 48.72**
- Known partial subtotal: **EUR 916.45**

The known partial subtotal is evidence about recorded values only. It excludes every unresolved amount and must not be presented as the project cost.

## Physical assembly goods

| Physical assembly | Known directly attributable goods |
| --- | ---: |
| camera-pod | EUR 115.07 |
| control-cabinet | EUR 29.49 |
| corner-support-set | EUR 129.17 |
| dock | EUR 0.96 |
| positioning-line-set | EUR 103.97 |
| site-installation | EUR 141.00 |
| winch-set | EUR 48.20 |
| Shared multi-part purchase bundles | EUR 256.68 |
| Shared checkout-group shipping | EUR 48.72 |

Bundle and shipping costs stay in explicit shared buckets when the committed record does not provide defensible physical-assembly allocation weights.

## Non-physical procurement bucket

| Purchasing bucket | Known directly attributable goods |
| --- | ---: |
| shared-procurement-stock | EUR 43.19 |

This bucket is not a subsystem or physical owner. It holds assortment purchases until consumption can be allocated to an installed assembly.

## Checkout groups

| Checkout group | Supplier | Shipping evidence | Charged |
| --- | --- | --- | ---: |
| aliexpress-hr | aliexpress | unknown | unknown |
| baseline-top-pulley-combined-hr | baseline-top-pulley-combined | known | EUR 6.00 |
| bauhaus-hr | bauhaus | unknown | unknown |
| cotra-zagreb-hr | cotra-zagreb | unknown | unknown |
| dive-store-hr | dive-store | known | EUR 6.25 |
| in-house-fabrication-hr | in-house-fabrication | not-applicable | not applicable |
| kabel24-hr | kabel24 | unknown | unknown |
| njuskalo-hr | njuskalo | unknown | unknown |
| pimoroni-hr | pimoroni | unknown | unknown |
| ronis-hr | ronis | unknown | unknown |
| stepperonline-hr | stepperonline | known | EUR 34.01 |
| tme-hr | tme | known | EUR 2.46 |

Shipping is evaluated once per checkout group. The recorded TME EUR 2.46 charge is represented once.

## Selected purchase units

| Offer | Qualification | Purchase units | Coverage and surplus | Known goods |
| --- | --- | ---: | --- | ---: |
| aliexpress-bearing-608-2rs | baseline-selected | 1 | bearing-608-2rs: 10 each required, 10 each purchased; 0 surplus | EUR 3.97 |
| aliexpress-bulk-capacitor-1000uf | baseline-selected | 1 | bulk-capacitor-1000uf: 2 each required, 20 each purchased; 18 surplus | EUR 3.29 |
| aliexpress-cable-gland-assortment | baseline-selected | 1 | cable-gland-assortment: 1 each required, 1 each purchased; 0 surplus | EUR 11.19 |
| aliexpress-capsule-slip-ring-6x2a | baseline-selected | 1 | capsule-slip-ring-6x2a: 1 each required, 1 each purchased; 0 surplus | EUR 9.69 |
| aliexpress-controller-buck-converter-48v-5v | baseline-selected | 1 | controller-buck-converter-48v-5v: 1 each required, 1 each purchased; 0 surplus | EUR 5.55 |
| aliexpress-emergency-stop-switch | baseline-selected | unknown | emergency-stop-switch: 1 each required, unknown purchase quantity | unknown |
| aliexpress-flexible-jaw-coupling-8mm | baseline-selected | unknown | flexible-jaw-coupling-8mm: 4 each required, unknown purchase quantity | unknown |
| aliexpress-heat-set-insert-assortment | baseline-selected | 1 | heat-set-insert-assortment: 1 each required, 1 each purchased; 0 surplus | EUR 16.00 |
| aliexpress-micro-pan-tilt-servo | baseline-selected | 1 | micro-pan-tilt-servo: 2 each required, 3 each purchased; 1 surplus | EUR 16.72 |
| aliexpress-pod-buck-converter-48v-5v | baseline-selected | 1 | pod-buck-converter-48v-5v: 1 each required, 1 each purchased; 0 surplus | EUR 5.55 |
| aliexpress-pod-power-wire-black-awg26 | baseline-selected | 10 | pod-power-wire-black-awg26: 50 m required, 50 m purchased; 0 surplus | EUR 10.38 |
| aliexpress-pod-power-wire-red-awg26 | baseline-selected | 10 | pod-power-wire-red-awg26: 50 m required, 50 m purchased; 0 surplus | EUR 10.38 |
| aliexpress-roller-lever-microswitch | baseline-selected | 1 | roller-lever-microswitch: 5 each required, 10 each purchased; 5 surplus | EUR 4.79 |
| aliexpress-shaft-collar-8mm | baseline-selected | 4 | shaft-collar-8mm: 8 each required, 8 each purchased; 0 surplus | EUR 40.40 |
| aliexpress-stainless-fastener-assortment | baseline-selected | 1 | stainless-fastener-assortment: 1 each required, 1 each purchased; 0 surplus | EUR 16.00 |
| aliexpress-winch-drum-shaft-8mm | baseline-selected | unknown | winch-drum-shaft-8mm: 4 each required, unknown purchase quantity | unknown |
| baseline-combined-top-pulley-offer | unresolved | unknown | top-positioning-line-pulley: 4 each required, unknown purchase quantity | unknown |
| bauhaus-din-rail-ground-distribution-block | baseline-selected | 1 | din-rail-ground-distribution-block: 1 each required, 1 each purchased; 0 surplus | EUR 5.95 |
| bauhaus-guy-turnbuckle-m12 | baseline-selected | unknown | guy-turnbuckle-m12: 4 each required, unknown purchase quantity | unknown |
| bauhaus-guy-wire-3mm | baseline-selected | unknown | guy-wire-3mm: 16 m required, unknown purchase quantity | unknown |
| bauhaus-motor-power-branch-cable | baseline-selected | 1 | motor-power-branch-cable: 50 m required, 50 m purchased; 0 surplus | EUR 89.00 |
| bauhaus-post-electronics-enclosure | baseline-selected | unknown | post-electronics-enclosure: 4 each required, unknown purchase quantity | unknown |
| bauhaus-pulley-bracket-backing-plate | baseline-selected | 8 | pulley-bracket-backing-plate: 8 each required, 8 each purchased; 0 surplus | EUR 28.40 |
| bauhaus-pulley-bracket-locknut-m12 | baseline-selected | 1 | pulley-bracket-locknut-m12: 8 each required, 50 each purchased; 42 surplus | EUR 9.00 |
| bauhaus-pulley-bracket-shackle-m8 | baseline-selected | 4 | pulley-bracket-shackle-m8: 4 each required, 4 each purchased; 0 surplus | EUR 14.28 |
| bauhaus-pulley-bracket-through-bolt-m12x160 | baseline-selected | 1 | pulley-bracket-through-bolt-m12x160: 8 each required, 40 each purchased; 32 surplus | EUR 33.20 |
| bauhaus-pulley-bracket-washer-m12 | baseline-selected | 1 | pulley-bracket-washer-m12: 16 each required, 100 each purchased; 84 surplus | EUR 16.00 |
| bauhaus-top-pulley-bracket | baseline-selected | 4 | top-pulley-bracket: 4 each required, 4 each purchased; 0 surplus | EUR 16.60 |
| bauhaus-wire-rope-clamp-3mm | baseline-selected | unknown | wire-rope-clamp-3mm: 16 each required, unknown purchase quantity | unknown |
| bauhaus-wire-rope-thimble-3mm | baseline-selected | unknown | wire-rope-thimble-3mm: 8 each required, unknown purchase quantity | unknown |
| bauhaus-zinc-spray | baseline-selected | 1 | zinc-spray: 1 each required, 1 each purchased; 0 surplus | EUR 11.69 |
| cotra-zagreb-corner-post-treated-timber | baseline-selected | unknown | corner-post-treated-timber: 4 each required, unknown purchase quantity | unknown |
| dive-store-dyneema-positioning-line | baseline-selected | 4 | dyneema-positioning-line: 180 m required, 200 m purchased; 20 surplus | EUR 73.52 |
| in-house-fabrication-camera-gimbal | baseline-selected | 1 | camera-gimbal: 1 each required, 1 each purchased; 0 surplus | unknown |
| in-house-fabrication-camera-pod-chassis | baseline-selected | 1 | camera-pod-chassis: 1 each required, 1 each purchased; 0 surplus | unknown |
| in-house-fabrication-dock-capture-set | baseline-selected | 1 | dock-funnel: 1 each required, 1 each purchased; 0 surplus; dock-nest: 1 each required, 1 each purchased; 0 surplus | unknown |
| in-house-fabrication-dock-latch-hardware | baseline-selected | 1 | dock-latch-hardware: 1 each required, 1 each purchased; 0 surplus | unknown |
| in-house-fabrication-dock-weather-hood | baseline-selected | 1 | dock-weather-hood: 1 each required, 1 each purchased; 0 surplus | unknown |
| in-house-fabrication-top-pulley-keeper | baseline-selected | 4 | top-pulley-keeper: 4 each required, 4 each purchased; 0 surplus | unknown |
| in-house-fabrication-winch-drum | baseline-selected | 4 | winch-drum: 4 each required, 4 each purchased; 0 surplus | unknown |
| in-house-fabrication-winch-mount-and-guard | baseline-selected | 4 | winch-mount-and-guard: 4 each required, 4 each purchased; 0 surplus | unknown |
| kabel24-control-panel-enclosure | baseline-selected | unknown | control-panel-enclosure: 1 each required, unknown purchase quantity | unknown |
| njuskalo-guy-ground-anchor | baseline-selected | unknown | guy-ground-anchor: 4 each required, unknown purchase quantity | unknown |
| pimoroni-raspberry-pi-3a-plus | baseline-selected | 1 | raspberry-pi-3a-plus: 1 each required, 1 each purchased; 0 surplus | EUR 28.00 |
| ronis-outdoor-cat5e-signal-cable | baseline-selected | 1 | outdoor-cat5e-signal-cable: 85 m required, 100 m purchased; 15 surplus | EUR 52.00 |
| stepperonline-4-axis-v2-kit | baseline-selected | 1 | cl57y-v20-driver: 4 each required, 4 each purchased; 0 surplus; matched-motor-cable: 4 each required, 4 each purchased; 0 surplus; nema23-closed-loop-motor: 4 each required, 4 each purchased; 0 surplus; power-supply-48v-350w: 2 each required, 2 each purchased; 0 surplus | EUR 256.68 |
| tme-microsd-card-32gb | baseline-selected | 1 | microsd-card-32gb: 1 each required, 1 each purchased; 0 surplus | EUR 24.00 |
| tme-pico-terminal-expansion-board | baseline-selected | 1 | pico-terminal-expansion-board: 1 each required, 1 each purchased; 0 surplus | EUR 9.40 |
| tme-raspberry-pi-camera-module-3 | unresolved | 1 | raspberry-pi-camera-module-3: 1 each required, 1 each purchased; 0 surplus | EUR 37.51 |
| tme-raspberry-pi-pico-2-w | baseline-selected | 1 | raspberry-pi-pico-2-w: 1 each required, 1 each purchased; 0 surplus | EUR 8.59 |

## Required parts by physical owner or procurement bucket

| Part | Required | Owner or typed purchasing bucket | Pinned offer |
| --- | ---: | --- | --- |
| bearing-608-2rs | 10 each | winch-set (10 each) | aliexpress-bearing-608-2rs |
| bulk-capacitor-1000uf | 2 each | camera-pod (2 each) | aliexpress-bulk-capacitor-1000uf |
| cable-gland-assortment | 1 each | shared-procurement-stock [non-physical] (1 each) | aliexpress-cable-gland-assortment |
| camera-gimbal | 1 each | camera-pod (1 each) | in-house-fabrication-camera-gimbal |
| camera-pod-chassis | 1 each | camera-pod (1 each) | in-house-fabrication-camera-pod-chassis |
| capsule-slip-ring-6x2a | 1 each | positioning-line-set (1 each) | aliexpress-capsule-slip-ring-6x2a |
| cl57y-v20-driver | 4 each | winch-set (4 each) | stepperonline-4-axis-v2-kit |
| control-panel-enclosure | 1 each | control-cabinet (1 each) | kabel24-control-panel-enclosure |
| controller-buck-converter-48v-5v | 1 each | control-cabinet (1 each) | aliexpress-controller-buck-converter-48v-5v |
| corner-post-treated-timber | 4 each | corner-support-set (4 each) | cotra-zagreb-corner-post-treated-timber |
| din-rail-ground-distribution-block | 1 each | control-cabinet (1 each) | bauhaus-din-rail-ground-distribution-block |
| dock-funnel | 1 each | dock (1 each) | in-house-fabrication-dock-capture-set |
| dock-latch-hardware | 1 each | dock (1 each) | in-house-fabrication-dock-latch-hardware |
| dock-nest | 1 each | dock (1 each) | in-house-fabrication-dock-capture-set |
| dock-weather-hood | 1 each | dock (1 each) | in-house-fabrication-dock-weather-hood |
| dyneema-positioning-line | 180 m | positioning-line-set (180 m) | dive-store-dyneema-positioning-line |
| emergency-stop-switch | 1 each | control-cabinet (1 each) | aliexpress-emergency-stop-switch |
| flexible-jaw-coupling-8mm | 4 each | winch-set (4 each) | aliexpress-flexible-jaw-coupling-8mm |
| guy-ground-anchor | 4 each | corner-support-set (4 each) | njuskalo-guy-ground-anchor |
| guy-turnbuckle-m12 | 4 each | corner-support-set (4 each) | bauhaus-guy-turnbuckle-m12 |
| guy-wire-3mm | 16 m | corner-support-set (16 m) | bauhaus-guy-wire-3mm |
| heat-set-insert-assortment | 1 each | shared-procurement-stock [non-physical] (1 each) | aliexpress-heat-set-insert-assortment |
| matched-motor-cable | 4 each | winch-set (4 each) | stepperonline-4-axis-v2-kit |
| micro-pan-tilt-servo | 2 each | camera-pod (2 each) | aliexpress-micro-pan-tilt-servo |
| microsd-card-32gb | 1 each | camera-pod (1 each) | tme-microsd-card-32gb |
| motor-power-branch-cable | 50 m | site-installation (50 m) | bauhaus-motor-power-branch-cable |
| nema23-closed-loop-motor | 4 each | winch-set (4 each) | stepperonline-4-axis-v2-kit |
| outdoor-cat5e-signal-cable | 85 m | site-installation (85 m) | ronis-outdoor-cat5e-signal-cable |
| pico-terminal-expansion-board | 1 each | control-cabinet (1 each) | tme-pico-terminal-expansion-board |
| pod-buck-converter-48v-5v | 1 each | camera-pod (1 each) | aliexpress-pod-buck-converter-48v-5v |
| pod-power-wire-black-awg26 | 50 m | positioning-line-set (50 m) | aliexpress-pod-power-wire-black-awg26 |
| pod-power-wire-red-awg26 | 50 m | positioning-line-set (50 m) | aliexpress-pod-power-wire-red-awg26 |
| post-electronics-enclosure | 4 each | winch-set (4 each) | bauhaus-post-electronics-enclosure |
| power-supply-48v-350w | 2 each | control-cabinet (2 each) | stepperonline-4-axis-v2-kit |
| pulley-bracket-backing-plate | 8 each | corner-support-set (8 each) | bauhaus-pulley-bracket-backing-plate |
| pulley-bracket-locknut-m12 | 8 each | corner-support-set (8 each) | bauhaus-pulley-bracket-locknut-m12 |
| pulley-bracket-shackle-m8 | 4 each | corner-support-set (4 each) | bauhaus-pulley-bracket-shackle-m8 |
| pulley-bracket-through-bolt-m12x160 | 8 each | corner-support-set (8 each) | bauhaus-pulley-bracket-through-bolt-m12x160 |
| pulley-bracket-washer-m12 | 16 each | corner-support-set (16 each) | bauhaus-pulley-bracket-washer-m12 |
| raspberry-pi-3a-plus | 1 each | camera-pod (1 each) | pimoroni-raspberry-pi-3a-plus |
| raspberry-pi-camera-module-3 | 1 each | camera-pod (1 each) | tme-raspberry-pi-camera-module-3 |
| raspberry-pi-pico-2-w | 1 each | control-cabinet (1 each) | tme-raspberry-pi-pico-2-w |
| roller-lever-microswitch | 5 each | dock (1 each), winch-set (4 each) | aliexpress-roller-lever-microswitch |
| shaft-collar-8mm | 8 each | winch-set (8 each) | aliexpress-shaft-collar-8mm |
| stainless-fastener-assortment | 1 each | shared-procurement-stock [non-physical] (1 each) | aliexpress-stainless-fastener-assortment |
| top-positioning-line-pulley | 4 each | corner-support-set (4 each) | baseline-combined-top-pulley-offer |
| top-pulley-bracket | 4 each | corner-support-set (4 each) | bauhaus-top-pulley-bracket |
| top-pulley-keeper | 4 each | corner-support-set (4 each) | in-house-fabrication-top-pulley-keeper |
| winch-drum | 4 each | winch-set (4 each) | in-house-fabrication-winch-drum |
| winch-drum-shaft-8mm | 4 each | winch-set (4 each) | aliexpress-winch-drum-shaft-8mm |
| winch-mount-and-guard | 4 each | winch-set (4 each) | in-house-fabrication-winch-mount-and-guard |
| wire-rope-clamp-3mm | 16 each | corner-support-set (16 each) | bauhaus-wire-rope-clamp-3mm |
| wire-rope-thimble-3mm | 8 each | corner-support-set (8 each) | bauhaus-wire-rope-thimble-3mm |
| zinc-spray | 1 each | corner-support-set (1 each) | bauhaus-zinc-spray |

## Incompleteness warnings

- aliexpress-bearing-608-2rs: Availability is unknown.
- aliexpress-bearing-608-2rs: Price and availability observation date is unknown; quote capture time is not verification time.
- aliexpress-bearing-608-2rs: Qualification is baseline-selected; the recorded selection is not engineering approval.
- aliexpress-bearing-608-2rs: Tax/VAT treatment is unknown.
- aliexpress-bulk-capacitor-1000uf: Availability is unknown.
- aliexpress-bulk-capacitor-1000uf: Price and availability observation date is unknown; quote capture time is not verification time.
- aliexpress-bulk-capacitor-1000uf: Qualification is baseline-selected; the recorded selection is not engineering approval.
- aliexpress-bulk-capacitor-1000uf: Tax/VAT treatment is unknown.
- aliexpress-cable-gland-assortment: Availability is unknown.
- aliexpress-cable-gland-assortment: Price and availability observation date is unknown; quote capture time is not verification time.
- aliexpress-cable-gland-assortment: Qualification is baseline-selected; the recorded selection is not engineering approval.
- aliexpress-cable-gland-assortment: Tax/VAT treatment is unknown.
- aliexpress-capsule-slip-ring-6x2a: Availability is unknown.
- aliexpress-capsule-slip-ring-6x2a: Price and availability observation date is unknown; quote capture time is not verification time.
- aliexpress-capsule-slip-ring-6x2a: Qualification is baseline-selected; the recorded selection is not engineering approval.
- aliexpress-capsule-slip-ring-6x2a: Tax/VAT treatment is unknown.
- aliexpress-controller-buck-converter-48v-5v: Availability is unknown.
- aliexpress-controller-buck-converter-48v-5v: Price and availability observation date is unknown; quote capture time is not verification time.
- aliexpress-controller-buck-converter-48v-5v: Qualification is baseline-selected; the recorded selection is not engineering approval.
- aliexpress-controller-buck-converter-48v-5v: Tax/VAT treatment is unknown.
- aliexpress-emergency-stop-switch: A quoted price cannot be extended without package data.
- aliexpress-emergency-stop-switch: Availability is unknown.
- aliexpress-emergency-stop-switch: Package size/MOQ is unknown.
- aliexpress-emergency-stop-switch: Price and availability observation date is unknown; quote capture time is not verification time.
- aliexpress-emergency-stop-switch: Qualification is baseline-selected; the recorded selection is not engineering approval.
- aliexpress-flexible-jaw-coupling-8mm: A quoted price cannot be extended without package data.
- aliexpress-flexible-jaw-coupling-8mm: Availability is unknown.
- aliexpress-flexible-jaw-coupling-8mm: Package size/MOQ is unknown.
- aliexpress-flexible-jaw-coupling-8mm: Price and availability observation date is unknown; quote capture time is not verification time.
- aliexpress-flexible-jaw-coupling-8mm: Qualification is baseline-selected; the recorded selection is not engineering approval.
- aliexpress-heat-set-insert-assortment: Availability is unknown.
- aliexpress-heat-set-insert-assortment: Price and availability observation date is unknown; quote capture time is not verification time.
- aliexpress-heat-set-insert-assortment: Qualification is baseline-selected; the recorded selection is not engineering approval.
- aliexpress-heat-set-insert-assortment: Tax/VAT treatment is unknown.
- aliexpress-hr: Shipping is unknown; null is not treated as free.
- aliexpress-hr: Shipping observation date is unknown; quote capture time is not verification time.
- aliexpress-micro-pan-tilt-servo: Availability is unknown.
- aliexpress-micro-pan-tilt-servo: Price and availability observation date is unknown; quote capture time is not verification time.
- aliexpress-micro-pan-tilt-servo: Qualification is baseline-selected; the recorded selection is not engineering approval.
- aliexpress-micro-pan-tilt-servo: Tax/VAT treatment is unknown.
- aliexpress-pod-buck-converter-48v-5v: Availability is unknown.
- aliexpress-pod-buck-converter-48v-5v: Price and availability observation date is unknown; quote capture time is not verification time.
- aliexpress-pod-buck-converter-48v-5v: Qualification is baseline-selected; the recorded selection is not engineering approval.
- aliexpress-pod-buck-converter-48v-5v: Tax/VAT treatment is unknown.
- aliexpress-pod-power-wire-black-awg26: Availability is unknown.
- aliexpress-pod-power-wire-black-awg26: Price and availability observation date is unknown; quote capture time is not verification time.
- aliexpress-pod-power-wire-black-awg26: Qualification is baseline-selected; the recorded selection is not engineering approval.
- aliexpress-pod-power-wire-black-awg26: Tax/VAT treatment is unknown.
- aliexpress-pod-power-wire-red-awg26: Availability is unknown.
- aliexpress-pod-power-wire-red-awg26: Price and availability observation date is unknown; quote capture time is not verification time.
- aliexpress-pod-power-wire-red-awg26: Qualification is baseline-selected; the recorded selection is not engineering approval.
- aliexpress-pod-power-wire-red-awg26: Tax/VAT treatment is unknown.
- aliexpress-roller-lever-microswitch: Availability is unknown.
- aliexpress-roller-lever-microswitch: Price and availability observation date is unknown; quote capture time is not verification time.
- aliexpress-roller-lever-microswitch: Qualification is baseline-selected; the recorded selection is not engineering approval.
- aliexpress-roller-lever-microswitch: Tax/VAT treatment is unknown.
- aliexpress-shaft-collar-8mm: Availability is unknown.
- aliexpress-shaft-collar-8mm: Price and availability observation date is unknown; quote capture time is not verification time.
- aliexpress-shaft-collar-8mm: Qualification is baseline-selected; the recorded selection is not engineering approval.
- aliexpress-shaft-collar-8mm: Tax/VAT treatment is unknown.
- aliexpress-stainless-fastener-assortment: Availability is unknown.
- aliexpress-stainless-fastener-assortment: Price and availability observation date is unknown; quote capture time is not verification time.
- aliexpress-stainless-fastener-assortment: Qualification is baseline-selected; the recorded selection is not engineering approval.
- aliexpress-stainless-fastener-assortment: Tax/VAT treatment is unknown.
- aliexpress-winch-drum-shaft-8mm: A quoted price cannot be extended without package data.
- aliexpress-winch-drum-shaft-8mm: Availability is unknown.
- aliexpress-winch-drum-shaft-8mm: Package size/MOQ is unknown.
- aliexpress-winch-drum-shaft-8mm: Price and availability observation date is unknown; quote capture time is not verification time.
- aliexpress-winch-drum-shaft-8mm: Qualification is baseline-selected; the recorded selection is not engineering approval.
- baseline-combined-top-pulley-offer: A quoted price cannot be extended without package data.
- baseline-combined-top-pulley-offer: Availability is unknown.
- baseline-combined-top-pulley-offer: Package size/MOQ is unknown.
- baseline-combined-top-pulley-offer: Price and availability observation date is unknown; quote capture time is not verification time.
- baseline-combined-top-pulley-offer: Qualification is unresolved; the recorded selection is not engineering approval.
- baseline-top-pulley-combined-hr: Shipping observation date is unknown; quote capture time is not verification time.
- baseline-top-pulley-combined-hr: Shipping tax/VAT treatment is unknown.
- bauhaus-din-rail-ground-distribution-block: Availability is unknown.
- bauhaus-din-rail-ground-distribution-block: Price and availability observation date is unknown; quote capture time is not verification time.
- bauhaus-din-rail-ground-distribution-block: Qualification is baseline-selected; the recorded selection is not engineering approval.
- bauhaus-din-rail-ground-distribution-block: Tax/VAT treatment is unknown.
- bauhaus-guy-turnbuckle-m12: A quoted price cannot be extended without package data.
- bauhaus-guy-turnbuckle-m12: Availability is unknown.
- bauhaus-guy-turnbuckle-m12: Package size/MOQ is unknown.
- bauhaus-guy-turnbuckle-m12: Price and availability observation date is unknown; quote capture time is not verification time.
- bauhaus-guy-turnbuckle-m12: Qualification is baseline-selected; the recorded selection is not engineering approval.
- bauhaus-guy-wire-3mm: A quoted price cannot be extended without package data.
- bauhaus-guy-wire-3mm: Availability is unknown.
- bauhaus-guy-wire-3mm: Package size/MOQ is unknown.
- bauhaus-guy-wire-3mm: Price and availability observation date is unknown; quote capture time is not verification time.
- bauhaus-guy-wire-3mm: Qualification is baseline-selected; the recorded selection is not engineering approval.
- bauhaus-hr: Shipping is unknown; null is not treated as free.
- bauhaus-hr: Shipping observation date is unknown; quote capture time is not verification time.
- bauhaus-motor-power-branch-cable: Availability is unknown.
- bauhaus-motor-power-branch-cable: Price and availability observation date is unknown; quote capture time is not verification time.
- bauhaus-motor-power-branch-cable: Qualification is baseline-selected; the recorded selection is not engineering approval.
- bauhaus-motor-power-branch-cable: Tax/VAT treatment is unknown.
- bauhaus-post-electronics-enclosure: A quoted price cannot be extended without package data.
- bauhaus-post-electronics-enclosure: Availability is unknown.
- bauhaus-post-electronics-enclosure: Package size/MOQ is unknown.
- bauhaus-post-electronics-enclosure: Price and availability observation date is unknown; quote capture time is not verification time.
- bauhaus-post-electronics-enclosure: Qualification is baseline-selected; the recorded selection is not engineering approval.
- bauhaus-pulley-bracket-backing-plate: Availability is unknown.
- bauhaus-pulley-bracket-backing-plate: Price and availability observation date is unknown; quote capture time is not verification time.
- bauhaus-pulley-bracket-backing-plate: Qualification is baseline-selected; the recorded selection is not engineering approval.
- bauhaus-pulley-bracket-backing-plate: Tax/VAT treatment is unknown.
- bauhaus-pulley-bracket-locknut-m12: Availability is unknown.
- bauhaus-pulley-bracket-locknut-m12: Price and availability observation date is unknown; quote capture time is not verification time.
- bauhaus-pulley-bracket-locknut-m12: Qualification is baseline-selected; the recorded selection is not engineering approval.
- bauhaus-pulley-bracket-locknut-m12: Tax/VAT treatment is unknown.
- bauhaus-pulley-bracket-shackle-m8: Availability is unknown.
- bauhaus-pulley-bracket-shackle-m8: Price and availability observation date is unknown; quote capture time is not verification time.
- bauhaus-pulley-bracket-shackle-m8: Qualification is baseline-selected; the recorded selection is not engineering approval.
- bauhaus-pulley-bracket-shackle-m8: Tax/VAT treatment is unknown.
- bauhaus-pulley-bracket-through-bolt-m12x160: Availability is unknown.
- bauhaus-pulley-bracket-through-bolt-m12x160: Price and availability observation date is unknown; quote capture time is not verification time.
- bauhaus-pulley-bracket-through-bolt-m12x160: Qualification is baseline-selected; the recorded selection is not engineering approval.
- bauhaus-pulley-bracket-through-bolt-m12x160: Tax/VAT treatment is unknown.
- bauhaus-pulley-bracket-washer-m12: Availability is unknown.
- bauhaus-pulley-bracket-washer-m12: Price and availability observation date is unknown; quote capture time is not verification time.
- bauhaus-pulley-bracket-washer-m12: Qualification is baseline-selected; the recorded selection is not engineering approval.
- bauhaus-pulley-bracket-washer-m12: Tax/VAT treatment is unknown.
- bauhaus-top-pulley-bracket: Availability is unknown.
- bauhaus-top-pulley-bracket: Price and availability observation date is unknown; quote capture time is not verification time.
- bauhaus-top-pulley-bracket: Qualification is baseline-selected; the recorded selection is not engineering approval.
- bauhaus-top-pulley-bracket: Tax/VAT treatment is unknown.
- bauhaus-wire-rope-clamp-3mm: A quoted price cannot be extended without package data.
- bauhaus-wire-rope-clamp-3mm: Availability is unknown.
- bauhaus-wire-rope-clamp-3mm: Package size/MOQ is unknown.
- bauhaus-wire-rope-clamp-3mm: Price and availability observation date is unknown; quote capture time is not verification time.
- bauhaus-wire-rope-clamp-3mm: Qualification is baseline-selected; the recorded selection is not engineering approval.
- bauhaus-wire-rope-thimble-3mm: A quoted price cannot be extended without package data.
- bauhaus-wire-rope-thimble-3mm: Availability is unknown.
- bauhaus-wire-rope-thimble-3mm: Package size/MOQ is unknown.
- bauhaus-wire-rope-thimble-3mm: Price and availability observation date is unknown; quote capture time is not verification time.
- bauhaus-wire-rope-thimble-3mm: Qualification is baseline-selected; the recorded selection is not engineering approval.
- bauhaus-zinc-spray: Availability is unknown.
- bauhaus-zinc-spray: Price and availability observation date is unknown; quote capture time is not verification time.
- bauhaus-zinc-spray: Qualification is baseline-selected; the recorded selection is not engineering approval.
- bauhaus-zinc-spray: Tax/VAT treatment is unknown.
- cotra-zagreb-corner-post-treated-timber: Availability is unknown.
- cotra-zagreb-corner-post-treated-timber: Package size/MOQ is unknown.
- cotra-zagreb-corner-post-treated-timber: Price and availability observation date is unknown; quote capture time is not verification time.
- cotra-zagreb-corner-post-treated-timber: Price is unknown.
- cotra-zagreb-corner-post-treated-timber: Qualification is baseline-selected; the recorded selection is not engineering approval.
- cotra-zagreb-hr: Shipping is unknown; null is not treated as free.
- cotra-zagreb-hr: Shipping observation date is unknown; quote capture time is not verification time.
- dive-store-dyneema-positioning-line: Availability is unknown.
- dive-store-dyneema-positioning-line: Price and availability observation date is unknown; quote capture time is not verification time.
- dive-store-dyneema-positioning-line: Qualification is baseline-selected; the recorded selection is not engineering approval.
- dive-store-dyneema-positioning-line: Tax/VAT treatment is unknown.
- dive-store-hr: Shipping observation date is unknown; quote capture time is not verification time.
- dive-store-hr: Shipping tax/VAT treatment is unknown.
- hr-zagreb: Destination tax/VAT status is unknown and blocks a complete landed total.
- in-house-fabrication-camera-gimbal: Price and availability observation date is unknown; quote capture time is not verification time.
- in-house-fabrication-camera-gimbal: Price is unknown.
- in-house-fabrication-camera-gimbal: Qualification is baseline-selected; the recorded selection is not engineering approval.
- in-house-fabrication-camera-pod-chassis: Price and availability observation date is unknown; quote capture time is not verification time.
- in-house-fabrication-camera-pod-chassis: Price is unknown.
- in-house-fabrication-camera-pod-chassis: Qualification is baseline-selected; the recorded selection is not engineering approval.
- in-house-fabrication-dock-capture-set: Price and availability observation date is unknown; quote capture time is not verification time.
- in-house-fabrication-dock-capture-set: Price is unknown.
- in-house-fabrication-dock-capture-set: Qualification is baseline-selected; the recorded selection is not engineering approval.
- in-house-fabrication-dock-latch-hardware: Price and availability observation date is unknown; quote capture time is not verification time.
- in-house-fabrication-dock-latch-hardware: Price is unknown.
- in-house-fabrication-dock-latch-hardware: Qualification is baseline-selected; the recorded selection is not engineering approval.
- in-house-fabrication-dock-weather-hood: Price and availability observation date is unknown; quote capture time is not verification time.
- in-house-fabrication-dock-weather-hood: Price is unknown.
- in-house-fabrication-dock-weather-hood: Qualification is baseline-selected; the recorded selection is not engineering approval.
- in-house-fabrication-hr: Shipping observation date is unknown; quote capture time is not verification time.
- in-house-fabrication-top-pulley-keeper: Price and availability observation date is unknown; quote capture time is not verification time.
- in-house-fabrication-top-pulley-keeper: Price is unknown.
- in-house-fabrication-top-pulley-keeper: Qualification is baseline-selected; the recorded selection is not engineering approval.
- in-house-fabrication-winch-drum: Price and availability observation date is unknown; quote capture time is not verification time.
- in-house-fabrication-winch-drum: Price is unknown.
- in-house-fabrication-winch-drum: Qualification is baseline-selected; the recorded selection is not engineering approval.
- in-house-fabrication-winch-mount-and-guard: Price and availability observation date is unknown; quote capture time is not verification time.
- in-house-fabrication-winch-mount-and-guard: Price is unknown.
- in-house-fabrication-winch-mount-and-guard: Qualification is baseline-selected; the recorded selection is not engineering approval.
- kabel24-control-panel-enclosure: A quoted price cannot be extended without package data.
- kabel24-control-panel-enclosure: Availability is unknown.
- kabel24-control-panel-enclosure: Package size/MOQ is unknown.
- kabel24-control-panel-enclosure: Price and availability observation date is unknown; quote capture time is not verification time.
- kabel24-control-panel-enclosure: Qualification is baseline-selected; the recorded selection is not engineering approval.
- kabel24-hr: Shipping is unknown; null is not treated as free.
- kabel24-hr: Shipping observation date is unknown; quote capture time is not verification time.
- njuskalo-guy-ground-anchor: A quoted price cannot be extended without package data.
- njuskalo-guy-ground-anchor: Availability is unknown.
- njuskalo-guy-ground-anchor: Package size/MOQ is unknown.
- njuskalo-guy-ground-anchor: Price and availability observation date is unknown; quote capture time is not verification time.
- njuskalo-guy-ground-anchor: Qualification is baseline-selected; the recorded selection is not engineering approval.
- njuskalo-hr: Shipping is unknown; null is not treated as free.
- njuskalo-hr: Shipping observation date is unknown; quote capture time is not verification time.
- pimoroni-hr: Shipping is unknown; null is not treated as free.
- pimoroni-hr: Shipping observation date is unknown; quote capture time is not verification time.
- pimoroni-raspberry-pi-3a-plus: Availability is unknown.
- pimoroni-raspberry-pi-3a-plus: Price and availability observation date is unknown; quote capture time is not verification time.
- pimoroni-raspberry-pi-3a-plus: Qualification is baseline-selected; the recorded selection is not engineering approval.
- pimoroni-raspberry-pi-3a-plus: Tax/VAT treatment is unknown.
- ronis-hr: Shipping is unknown; null is not treated as free.
- ronis-hr: Shipping observation date is unknown; quote capture time is not verification time.
- ronis-outdoor-cat5e-signal-cable: Availability is unknown.
- ronis-outdoor-cat5e-signal-cable: Price and availability observation date is unknown; quote capture time is not verification time.
- ronis-outdoor-cat5e-signal-cable: Qualification is baseline-selected; the recorded selection is not engineering approval.
- ronis-outdoor-cat5e-signal-cable: Tax/VAT treatment is unknown.
- stepperonline-4-axis-v2-kit: Availability is unknown.
- stepperonline-4-axis-v2-kit: Price and availability observation date is unknown; quote capture time is not verification time.
- stepperonline-4-axis-v2-kit: Qualification is baseline-selected; the recorded selection is not engineering approval.
- stepperonline-4-axis-v2-kit: Tax/VAT treatment is unknown.
- stepperonline-hr: Shipping observation date is unknown; quote capture time is not verification time.
- stepperonline-hr: Shipping tax/VAT treatment is unknown.
- tme-hr: Shipping observation date is unknown; quote capture time is not verification time.
- tme-hr: Shipping tax/VAT treatment is unknown.
- tme-microsd-card-32gb: Availability is unknown.
- tme-microsd-card-32gb: Price and availability observation date is unknown; quote capture time is not verification time.
- tme-microsd-card-32gb: Qualification is baseline-selected; the recorded selection is not engineering approval.
- tme-microsd-card-32gb: Tax/VAT treatment is unknown.
- tme-pico-terminal-expansion-board: Availability is unknown.
- tme-pico-terminal-expansion-board: Price and availability observation date is unknown; quote capture time is not verification time.
- tme-pico-terminal-expansion-board: Qualification is baseline-selected; the recorded selection is not engineering approval.
- tme-pico-terminal-expansion-board: Tax/VAT treatment is unknown.
- tme-raspberry-pi-camera-module-3: Availability is unknown.
- tme-raspberry-pi-camera-module-3: Price and availability observation date is unknown; quote capture time is not verification time.
- tme-raspberry-pi-camera-module-3: Qualification is unresolved; the recorded selection is not engineering approval.
- tme-raspberry-pi-camera-module-3: Tax/VAT treatment is unknown.
- tme-raspberry-pi-pico-2-w: Availability is unknown.
- tme-raspberry-pi-pico-2-w: Price and availability observation date is unknown; quote capture time is not verification time.
- tme-raspberry-pi-pico-2-w: Qualification is baseline-selected; the recorded selection is not engineering approval.
- tme-raspberry-pi-pico-2-w: Tax/VAT treatment is unknown.

## Evidence boundary

- The committed BOM inputs are the sole canonical project records. Supplier URLs and dated quote observations are evidence attached to those records, not a competing source of truth.
- The motor kit is modeled as four component types, and the dock funnel and nest are separate generated artifacts; reviewed Git changes may extend the catalog.
- A baseline-selected or unresolved offer is a procurement status, not engineering approval.
- OpenSCAD source consistency, calculation success, procurement, installation, and physical safety validation are separate facts.
