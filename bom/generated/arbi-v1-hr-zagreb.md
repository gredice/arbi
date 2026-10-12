# BOM — ARBI V1 — Zagreb repository baseline

> **Status: INCOMPLETE. This is not a trustworthy complete landed total.**
> Unknown package rules, prices, tax treatment, shipping, availability, and unqualified baseline selections remain visible below. Null values are never treated as zero.

[BOM overview](../README.md) · [All item pages](parts/README.md)

## Calculation identity

- Scenario: arbi-v1-hr-zagreb
- Build: arbi-v1
- Destination: hr-zagreb
- Quote snapshot: hr-zagreb-2026-10-08-coupling
- Input digest: sha256:f21a45c69321970cdb8bd871c50f2fe3603dcee3574ab8aa8d919ac077388839
- Complete landed total: **unavailable**
- Known quoted goods subtotal: **EUR 943.84**
- Known checkout-group shipping subtotal: **EUR 43.38**
- Known partial subtotal: **EUR 987.22**
- Estimated print materials: **EUR 254.03**
- Estimated partial subtotal (known amounts + print materials): **EUR 1241.25**

The known partial subtotal is evidence about recorded values only. It excludes every unresolved amount and must not be presented as the project cost.

## Physical assembly goods

| Physical assembly | Known allocated goods |
| --- | ---: |
| camera-pod | EUR 115.07 |
| control-cabinet | EUR 66.16 |
| corner-support-set | EUR 185.97 |
| dock | EUR 1.60 |
| site-installation | EUR 141.00 |
| winch-set | EUR 390.85 |
| Shared multi-part purchase bundles | EUR 0.00 |
| Shared customs | EUR 0.00 |
| Shared checkout-group shipping | EUR 43.38 |

Multi-part bundles of countable components are allocated by purchased part count, including surplus, with cents distributed deterministically. These shares are accounting allocations, not individual supplier prices. Unselected contents or bundles without comparable part counts remain in the shared bundle bucket; shipping remains separate.

## Estimated print material costs

Solid CAD volume × each component's material density × observed roll price / roll grams. Eligible PLA/PETG rates assume 10+ mixed eligible filament-with-spool rolls in one Bambu EU bulk order; ASA retains its evidenced single-spool price. These consumption estimates exclude supports, purge, failures, energy, machine time, labour, filament shipping and destination VAT adjustments. They do not make the landed total complete.

| Part | Required | Material | Estimated weight | Estimated material cost |
| --- | ---: | --- | ---: | ---: |
| [camera-gimbal](parts/camera-gimbal.md) | 1 | PETG Matte + PETG Basic | 54.004 g | EUR 0.61 |
| [camera-pod-chassis](parts/camera-pod-chassis.md) | 1 | PETG Matte + PETG Basic | 207.265 g | EUR 2.36 |
| [dock-funnel](parts/dock-funnel.md) | 1 | PETG Basic | 149.073 g | EUR 1.70 |
| [dock-latch-hardware](parts/dock-latch-hardware.md) | 1 | PETG Basic | 126.828 g | EUR 1.44 |
| [dock-nest](parts/dock-nest.md) | 1 | PETG Basic | 216.782 g | EUR 2.47 |
| [dock-support-arm](parts/dock-support-arm.md) | 1 | PETG Basic | 1602.762 g | EUR 18.26 |
| [dock-weather-hood](parts/dock-weather-hood.md) | 1 | PETG Basic | 299.523 g | EUR 3.41 |
| [top-pulley-keeper](parts/top-pulley-keeper.md) | 4 | PETG Basic | 73.507 g | EUR 0.84 |
| [winch-drum](parts/winch-drum.md) | 4 | PETG Basic | 4980.607 g | EUR 56.73 |
| [winch-full-cover](parts/winch-full-cover.md) | 4 | ASA + PETG Matte | 12527.69 g | EUR 147.84 |
| [winch-mount-and-guard](parts/winch-mount-and-guard.md) | 4 | PETG Matte + PETG Basic | 1613.452 g | EUR 18.37 |

## Non-physical procurement bucket

| Purchasing bucket | Known directly attributable goods |
| --- | ---: |
| shared-procurement-stock | EUR 43.19 |

This bucket is not a subsystem or physical owner. It holds assortment purchases until consumption can be allocated to an installed assembly.

## Checkout groups

| Checkout group | Supplier | Shipping evidence | Charged |
| --- | --- | --- | ---: |
| aliexpress-hr | aliexpress | unknown | unknown |
| bauhaus-hr | bauhaus | unknown | unknown |
| cotra-zagreb-hr | cotra-zagreb | unknown | unknown |
| dive-store-hr | dive-store | known | EUR 6.91 |
| in-house-fabrication-hr | in-house-fabrication | not-applicable | not applicable |
| kabel24-hr | kabel24 | unknown | unknown |
| njuskalo-hr | njuskalo | unknown | unknown |
| pimoroni-hr | pimoroni | unknown | unknown |
| ronis-hr | ronis | unknown | unknown |
| stepperonline-hr | stepperonline | known | EUR 34.01 |
| tme-hr | tme | known | EUR 2.46 |
| wasi-hr | wasi | not-applicable | not applicable |

Shipping is evaluated once per checkout group. The recorded TME EUR 2.46 charge is represented once.

## Customs

Known customs subtotal: EUR 0.00. Conditional or unknown duty is excluded from the known subtotal.

aliexpress-hr: EUR 3.00 per item type (not per piece), order goods strictly below EUR 150.00; effective 2026-07-01 until no end date set (exclusive end). 15 item types; calculated charge: unknown. Owner costing policy: EUR 3 per declared item type, not per piece, for orders strictly below EUR 150. One selected offer approximates one declared item type; actual tariff/description/origin grouping and split shipments require checkout evidence. Customs guidance includes EUR 150; this policy uses the owner-requested strict limit. VAT is separate. No end date currently recorded.

## Selected purchase units

| Offer | Qualification | Purchase units | Coverage and surplus | Known goods | Allocation |
| --- | --- | ---: | --- | ---: | --- |
| aliexpress-bearing-608-2rs | baseline-selected | 1 | [bearing-608-2rs](parts/bearing-608-2rs.md): 10 each required, 10 each purchased; 0 surplus; goods EUR 3.97 | EUR 3.97 | single-part |
| aliexpress-bulk-capacitor-1000uf | baseline-selected | 1 | [bulk-capacitor-1000uf](parts/bulk-capacitor-1000uf.md): 2 each required, 20 each purchased; 18 surplus; goods EUR 3.29 | EUR 3.29 | single-part |
| aliexpress-cable-gland-assortment | baseline-selected | 1 | [cable-gland-assortment](parts/cable-gland-assortment.md): 1 each required, 1 each purchased; 0 surplus; goods EUR 11.19 | EUR 11.19 | single-part |
| aliexpress-capsule-slip-ring-6x2a | baseline-selected | 1 | [capsule-slip-ring-6x2a](parts/capsule-slip-ring-6x2a.md): 1 each required, 1 each purchased; 0 surplus; goods EUR 9.69 | EUR 9.69 | single-part |
| aliexpress-controller-buck-converter-48v-5v | baseline-selected | 1 | [controller-buck-converter-48v-5v](parts/controller-buck-converter-48v-5v.md): 1 each required, 1 each purchased; 0 surplus; goods EUR 5.55 | EUR 5.55 | single-part |
| aliexpress-emergency-stop-switch | baseline-selected | unknown | [emergency-stop-switch](parts/emergency-stop-switch.md): 1 each required, unknown purchase quantity; goods unknown | unknown | unallocated |
| aliexpress-flexible-jaw-coupling-8mm | baseline-selected | 4 | [flexible-jaw-coupling-8mm](parts/flexible-jaw-coupling-8mm.md): 4 each required, 4 each purchased; 0 surplus; goods EUR 12.36 | EUR 12.36 | single-part |
| aliexpress-heat-set-insert-assortment | baseline-selected | 1 | [heat-set-insert-assortment](parts/heat-set-insert-assortment.md): 1 each required, 1 each purchased; 0 surplus; goods EUR 16.00 | EUR 16.00 | single-part |
| aliexpress-micro-pan-tilt-servo | baseline-selected | 1 | [micro-pan-tilt-servo](parts/micro-pan-tilt-servo.md): 2 each required, 3 each purchased; 1 surplus; goods EUR 16.72 | EUR 16.72 | single-part |
| aliexpress-pod-buck-converter-48v-5v | baseline-selected | 1 | [pod-buck-converter-48v-5v](parts/pod-buck-converter-48v-5v.md): 1 each required, 1 each purchased; 0 surplus; goods EUR 5.55 | EUR 5.55 | single-part |
| aliexpress-pod-power-wire-black-awg26 | baseline-selected | 10 | [pod-power-wire-black-awg26](parts/pod-power-wire-black-awg26.md): 50 m required, 50 m purchased; 0 surplus; goods EUR 10.38 | EUR 10.38 | single-part |
| aliexpress-pod-power-wire-red-awg26 | baseline-selected | 10 | [pod-power-wire-red-awg26](parts/pod-power-wire-red-awg26.md): 50 m required, 50 m purchased; 0 surplus; goods EUR 10.38 | EUR 10.38 | single-part |
| aliexpress-roller-lever-microswitch | baseline-selected | 1 | [roller-lever-microswitch](parts/roller-lever-microswitch.md): 6 each required, 10 each purchased; 4 surplus; goods EUR 4.79 | EUR 4.79 | single-part |
| aliexpress-shaft-collar-8mm | baseline-selected | 4 | [shaft-collar-8mm](parts/shaft-collar-8mm.md): 8 each required, 8 each purchased; 0 surplus; goods EUR 40.40 | EUR 40.40 | single-part |
| aliexpress-stainless-fastener-assortment | baseline-selected | 1 | [stainless-fastener-assortment](parts/stainless-fastener-assortment.md): 1 each required, 1 each purchased; 0 surplus; goods EUR 16.00 | EUR 16.00 | single-part |
| bauhaus-din-rail-ground-distribution-block | baseline-selected | 1 | [din-rail-ground-distribution-block](parts/din-rail-ground-distribution-block.md): 1 each required, 1 each purchased; 0 surplus; goods EUR 5.95 | EUR 5.95 | single-part |
| bauhaus-guy-turnbuckle-m12 | baseline-selected | unknown | [guy-turnbuckle-m12](parts/guy-turnbuckle-m12.md): 4 each required, unknown purchase quantity; goods unknown | unknown | unallocated |
| bauhaus-guy-wire-3mm | baseline-selected | unknown | [guy-wire-3mm](parts/guy-wire-3mm.md): 16 m required, unknown purchase quantity; goods unknown | unknown | unallocated |
| bauhaus-motor-power-branch-cable | baseline-selected | 1 | [motor-power-branch-cable](parts/motor-power-branch-cable.md): 50 m required, 50 m purchased; 0 surplus; goods EUR 89.00 | EUR 89.00 | single-part |
| bauhaus-post-electronics-enclosure | baseline-selected | unknown | [post-electronics-enclosure](parts/post-electronics-enclosure.md): 4 each required, unknown purchase quantity; goods unknown | unknown | unallocated |
| bauhaus-pulley-bracket-backing-plate | baseline-selected | 8 | [pulley-bracket-backing-plate](parts/pulley-bracket-backing-plate.md): 8 each required, 8 each purchased; 0 surplus; goods EUR 28.40 | EUR 28.40 | single-part |
| bauhaus-pulley-bracket-locknut-m12 | baseline-selected | 1 | [pulley-bracket-locknut-m12](parts/pulley-bracket-locknut-m12.md): 8 each required, 50 each purchased; 42 surplus; goods EUR 9.00 | EUR 9.00 | single-part |
| bauhaus-pulley-bracket-shackle-m8 | baseline-selected | 4 | [pulley-bracket-shackle-m8](parts/pulley-bracket-shackle-m8.md): 4 each required, 4 each purchased; 0 surplus; goods EUR 14.28 | EUR 14.28 | single-part |
| bauhaus-pulley-bracket-through-bolt-m12x160 | baseline-selected | 1 | [pulley-bracket-through-bolt-m12x160](parts/pulley-bracket-through-bolt-m12x160.md): 8 each required, 40 each purchased; 32 surplus; goods EUR 33.20 | EUR 33.20 | single-part |
| bauhaus-pulley-bracket-washer-m12 | baseline-selected | 1 | [pulley-bracket-washer-m12](parts/pulley-bracket-washer-m12.md): 16 each required, 100 each purchased; 84 surplus; goods EUR 16.00 | EUR 16.00 | single-part |
| bauhaus-top-pulley-bracket | baseline-selected | 4 | [top-pulley-bracket](parts/top-pulley-bracket.md): 4 each required, 4 each purchased; 0 surplus; goods EUR 16.60 | EUR 16.60 | single-part |
| bauhaus-winch-drum-shaft-8mm | baseline-selected | 1 | [winch-drum-shaft-8mm](parts/winch-drum-shaft-8mm.md): 4 each required, 4 each purchased; 0 surplus; goods EUR 6.95 | EUR 6.95 | single-part |
| bauhaus-wire-rope-clamp-3mm | baseline-selected | unknown | [wire-rope-clamp-3mm](parts/wire-rope-clamp-3mm.md): 16 each required, unknown purchase quantity; goods unknown | unknown | unallocated |
| bauhaus-wire-rope-thimble-3mm | baseline-selected | unknown | [wire-rope-thimble-3mm](parts/wire-rope-thimble-3mm.md): 8 each required, unknown purchase quantity; goods unknown | unknown | unallocated |
| bauhaus-zinc-spray | baseline-selected | 1 | [zinc-spray](parts/zinc-spray.md): 1 each required, 1 each purchased; 0 surplus; goods EUR 11.69 | EUR 11.69 | single-part |
| cotra-zagreb-corner-post-treated-timber | baseline-selected | unknown | [corner-post-treated-timber](parts/corner-post-treated-timber.md): 4 each required, unknown purchase quantity; goods unknown | unknown | unallocated |
| dive-store-dyneema-positioning-line | baseline-selected | 4 | [dyneema-positioning-line](parts/dyneema-positioning-line.md): 180 m required, 200 m purchased; 20 surplus; goods EUR 73.52 | EUR 73.52 | single-part |
| in-house-fabrication-camera-gimbal | baseline-selected | 1 | [camera-gimbal](parts/camera-gimbal.md): 1 each required, 1 each purchased; 0 surplus; goods unknown | unknown | unallocated |
| in-house-fabrication-camera-pod-chassis | baseline-selected | 1 | [camera-pod-chassis](parts/camera-pod-chassis.md): 1 each required, 1 each purchased; 0 surplus; goods unknown | unknown | unallocated |
| in-house-fabrication-dock-capture-set | baseline-selected | 1 | [dock-funnel](parts/dock-funnel.md): 1 each required, 1 each purchased; 0 surplus; goods unknown; [dock-nest](parts/dock-nest.md): 1 each required, 1 each purchased; 0 surplus; goods unknown | unknown | unallocated |
| in-house-fabrication-dock-latch-hardware | baseline-selected | 1 | [dock-latch-hardware](parts/dock-latch-hardware.md): 1 each required, 1 each purchased; 0 surplus; goods unknown | unknown | unallocated |
| in-house-fabrication-dock-weather-hood | baseline-selected | 1 | [dock-weather-hood](parts/dock-weather-hood.md): 1 each required, 1 each purchased; 0 surplus; goods unknown | unknown | unallocated |
| in-house-fabrication-top-pulley-keeper | baseline-selected | 4 | [top-pulley-keeper](parts/top-pulley-keeper.md): 4 each required, 4 each purchased; 0 surplus; goods unknown | unknown | unallocated |
| in-house-fabrication-winch-drum | baseline-selected | 4 | [winch-drum](parts/winch-drum.md): 4 each required, 4 each purchased; 0 surplus; goods unknown | unknown | unallocated |
| in-house-fabrication-winch-mount-and-guard | baseline-selected | 4 | [winch-mount-and-guard](parts/winch-mount-and-guard.md): 4 each required, 4 each purchased; 0 surplus; goods unknown | unknown | unallocated |
| kabel24-control-panel-enclosure | baseline-selected | unknown | [control-panel-enclosure](parts/control-panel-enclosure.md): 1 each required, unknown purchase quantity; goods unknown | unknown | unallocated |
| njuskalo-guy-ground-anchor | baseline-selected | unknown | [guy-ground-anchor](parts/guy-ground-anchor.md): 4 each required, unknown purchase quantity; goods unknown | unknown | unallocated |
| pimoroni-raspberry-pi-3a-plus | baseline-selected | 1 | [raspberry-pi-3a-plus](parts/raspberry-pi-3a-plus.md): 1 each required, 1 each purchased; 0 surplus; goods EUR 28.00 | EUR 28.00 | single-part |
| ronis-outdoor-cat5e-signal-cable | baseline-selected | 1 | [outdoor-cat5e-signal-cable](parts/outdoor-cat5e-signal-cable.md): 85 m required, 100 m purchased; 15 surplus; goods EUR 52.00 | EUR 52.00 | single-part |
| stepperonline-4-axis-v2-kit | baseline-selected | 1 | [cl57y-v20-driver](parts/cl57y-v20-driver.md): 4 each required, 4 each purchased; 0 surplus; goods EUR 73.34; [matched-motor-cable](parts/matched-motor-cable.md): 4 each required, 4 each purchased; 0 surplus; goods EUR 73.34; [nema23-closed-loop-motor](parts/nema23-closed-loop-motor.md): 4 each required, 4 each purchased; 0 surplus; goods EUR 73.33; [power-supply-48v-350w](parts/power-supply-48v-350w.md): 2 each required, 2 each purchased; 0 surplus; goods EUR 36.67 | EUR 256.68 | part-count |
| tme-microsd-card-32gb | baseline-selected | 1 | [microsd-card-32gb](parts/microsd-card-32gb.md): 1 each required, 1 each purchased; 0 surplus; goods EUR 24.00 | EUR 24.00 | single-part |
| tme-pico-terminal-expansion-board | baseline-selected | 1 | [pico-terminal-expansion-board](parts/pico-terminal-expansion-board.md): 1 each required, 1 each purchased; 0 surplus; goods EUR 9.40 | EUR 9.40 | single-part |
| tme-raspberry-pi-camera-module-3 | unresolved | 1 | [raspberry-pi-camera-module-3](parts/raspberry-pi-camera-module-3.md): 1 each required, 1 each purchased; 0 surplus; goods EUR 37.51 | EUR 37.51 | single-part |
| tme-raspberry-pi-pico-2-w | baseline-selected | 1 | [raspberry-pi-pico-2-w](parts/raspberry-pi-pico-2-w.md): 1 each required, 1 each purchased; 0 surplus; goods EUR 8.59 | EUR 8.59 | single-part |
| unresolved-winch-drum-joining-hardware | unresolved | unknown | [winch-drum-joining-hardware](parts/winch-drum-joining-hardware.md): 1 each required, unknown purchase quantity; goods unknown | unknown | unallocated |
| unresolved-winch-mount-hardware | unresolved | unknown | [winch-mount-hardware](parts/winch-mount-hardware.md): 1 each required, unknown purchase quantity; goods unknown | unknown | unallocated |
| wasi-barton-30mm | baseline-selected | 4 | [top-positioning-line-pulley](parts/top-positioning-line-pulley.md): 4 each required, 4 each purchased; 0 surplus; goods EUR 56.80 | EUR 56.80 | single-part |

## Required parts by physical owner or procurement bucket

| Part | Required | Owner or typed purchasing bucket | Pinned offer |
| --- | ---: | --- | --- |
| [bearing-608-2rs](parts/bearing-608-2rs.md) | 10 each | winch-set (10 each) | aliexpress-bearing-608-2rs |
| [bulk-capacitor-1000uf](parts/bulk-capacitor-1000uf.md) | 2 each | camera-pod (2 each) | aliexpress-bulk-capacitor-1000uf |
| [cabinet-installation-kit](parts/cabinet-installation-kit.md) | 1 each | control-cabinet (1 each) | unresolved |
| [cabinet-protection-kit](parts/cabinet-protection-kit.md) | 1 each | control-cabinet (1 each) | unresolved |
| [cable-gland-assortment](parts/cable-gland-assortment.md) | 1 each | shared-procurement-stock [non-physical] (1 each) | aliexpress-cable-gland-assortment |
| [camera-gimbal](parts/camera-gimbal.md) | 1 each | camera-pod (1 each) | in-house-fabrication-camera-gimbal |
| [camera-pod-chassis](parts/camera-pod-chassis.md) | 1 each | camera-pod (1 each) | in-house-fabrication-camera-pod-chassis |
| [camera-pod-fastener-kit](parts/camera-pod-fastener-kit.md) | 1 each | camera-pod (1 each) | unresolved |
| [camera-pod-wiring-kit](parts/camera-pod-wiring-kit.md) | 1 each | camera-pod (1 each) | unresolved |
| [capsule-slip-ring-6x2a](parts/capsule-slip-ring-6x2a.md) | 1 each | winch-set (1 each) | aliexpress-capsule-slip-ring-6x2a |
| [cl57y-v20-driver](parts/cl57y-v20-driver.md) | 4 each | winch-set (4 each) | stepperonline-4-axis-v2-kit |
| [control-panel-enclosure](parts/control-panel-enclosure.md) | 1 each | control-cabinet (1 each) | kabel24-control-panel-enclosure |
| [controller-buck-converter-48v-5v](parts/controller-buck-converter-48v-5v.md) | 1 each | control-cabinet (1 each) | aliexpress-controller-buck-converter-48v-5v |
| [corner-post-treated-timber](parts/corner-post-treated-timber.md) | 4 each | corner-support-set (4 each) | cotra-zagreb-corner-post-treated-timber |
| [din-rail-ground-distribution-block](parts/din-rail-ground-distribution-block.md) | 1 each | control-cabinet (1 each) | bauhaus-din-rail-ground-distribution-block |
| [dock-bench-hardware](parts/dock-bench-hardware.md) | 1 each | dock (1 each) | unresolved |
| [dock-funnel](parts/dock-funnel.md) | 1 each | dock (1 each) | in-house-fabrication-dock-capture-set |
| [dock-latch-hardware](parts/dock-latch-hardware.md) | 1 each | dock (1 each) | in-house-fabrication-dock-latch-hardware |
| [dock-nest](parts/dock-nest.md) | 1 each | dock (1 each) | in-house-fabrication-dock-capture-set |
| [dock-support-arm](parts/dock-support-arm.md) | 1 each | dock (1 each) | unresolved |
| [dock-weather-hood](parts/dock-weather-hood.md) | 1 each | dock (1 each) | in-house-fabrication-dock-weather-hood |
| [dyneema-positioning-line](parts/dyneema-positioning-line.md) | 180 m | winch-set (180 m) | dive-store-dyneema-positioning-line |
| [emergency-stop-switch](parts/emergency-stop-switch.md) | 1 each | control-cabinet (1 each) | aliexpress-emergency-stop-switch |
| [extension-spring-assortment](parts/extension-spring-assortment.md) | 1 each | dock (1 each) | unresolved |
| [flexible-jaw-coupling-8mm](parts/flexible-jaw-coupling-8mm.md) | 4 each | winch-set (4 each) | aliexpress-flexible-jaw-coupling-8mm |
| [guy-ground-anchor](parts/guy-ground-anchor.md) | 4 each | corner-support-set (4 each) | njuskalo-guy-ground-anchor |
| [guy-turnbuckle-m12](parts/guy-turnbuckle-m12.md) | 4 each | corner-support-set (4 each) | bauhaus-guy-turnbuckle-m12 |
| [guy-wire-3mm](parts/guy-wire-3mm.md) | 16 m | corner-support-set (16 m) | bauhaus-guy-wire-3mm |
| [heat-set-insert-assortment](parts/heat-set-insert-assortment.md) | 1 each | shared-procurement-stock [non-physical] (1 each) | aliexpress-heat-set-insert-assortment |
| [matched-motor-cable](parts/matched-motor-cable.md) | 4 each | winch-set (4 each) | stepperonline-4-axis-v2-kit |
| [micro-pan-tilt-servo](parts/micro-pan-tilt-servo.md) | 2 each | camera-pod (2 each) | aliexpress-micro-pan-tilt-servo |
| [microsd-card-32gb](parts/microsd-card-32gb.md) | 1 each | camera-pod (1 each) | tme-microsd-card-32gb |
| [motor-power-branch-cable](parts/motor-power-branch-cable.md) | 50 m | site-installation (50 m) | bauhaus-motor-power-branch-cable |
| [nema23-closed-loop-motor](parts/nema23-closed-loop-motor.md) | 4 each | winch-set (4 each) | stepperonline-4-axis-v2-kit |
| [outdoor-cat5e-signal-cable](parts/outdoor-cat5e-signal-cable.md) | 85 m | site-installation (85 m) | ronis-outdoor-cat5e-signal-cable |
| [pico-terminal-expansion-board](parts/pico-terminal-expansion-board.md) | 1 each | control-cabinet (1 each) | tme-pico-terminal-expansion-board |
| [pod-buck-converter-48v-5v](parts/pod-buck-converter-48v-5v.md) | 1 each | camera-pod (1 each) | aliexpress-pod-buck-converter-48v-5v |
| [pod-power-wire-black-awg26](parts/pod-power-wire-black-awg26.md) | 50 m | winch-set (50 m) | aliexpress-pod-power-wire-black-awg26 |
| [pod-power-wire-red-awg26](parts/pod-power-wire-red-awg26.md) | 50 m | winch-set (50 m) | aliexpress-pod-power-wire-red-awg26 |
| [post-electronics-enclosure](parts/post-electronics-enclosure.md) | 4 each | winch-set (4 each) | bauhaus-post-electronics-enclosure |
| [power-supply-48v-350w](parts/power-supply-48v-350w.md) | 2 each | control-cabinet (2 each) | stepperonline-4-axis-v2-kit |
| [pulley-bracket-backing-plate](parts/pulley-bracket-backing-plate.md) | 8 each | corner-support-set (8 each) | bauhaus-pulley-bracket-backing-plate |
| [pulley-bracket-locknut-m12](parts/pulley-bracket-locknut-m12.md) | 8 each | corner-support-set (8 each) | bauhaus-pulley-bracket-locknut-m12 |
| [pulley-bracket-shackle-m8](parts/pulley-bracket-shackle-m8.md) | 4 each | corner-support-set (4 each) | bauhaus-pulley-bracket-shackle-m8 |
| [pulley-bracket-through-bolt-m12x160](parts/pulley-bracket-through-bolt-m12x160.md) | 8 each | corner-support-set (8 each) | bauhaus-pulley-bracket-through-bolt-m12x160 |
| [pulley-bracket-washer-m12](parts/pulley-bracket-washer-m12.md) | 16 each | corner-support-set (16 each) | bauhaus-pulley-bracket-washer-m12 |
| [raspberry-pi-3a-plus](parts/raspberry-pi-3a-plus.md) | 1 each | camera-pod (1 each) | pimoroni-raspberry-pi-3a-plus |
| [raspberry-pi-camera-module-3](parts/raspberry-pi-camera-module-3.md) | 1 each | camera-pod (1 each) | tme-raspberry-pi-camera-module-3 |
| [raspberry-pi-pico-2-w](parts/raspberry-pi-pico-2-w.md) | 1 each | control-cabinet (1 each) | tme-raspberry-pi-pico-2-w |
| [roller-lever-microswitch](parts/roller-lever-microswitch.md) | 6 each | dock (2 each), winch-set (4 each) | aliexpress-roller-lever-microswitch |
| [shaft-collar-8mm](parts/shaft-collar-8mm.md) | 8 each | winch-set (8 each) | aliexpress-shaft-collar-8mm |
| [stainless-fastener-assortment](parts/stainless-fastener-assortment.md) | 1 each | shared-procurement-stock [non-physical] (1 each) | aliexpress-stainless-fastener-assortment |
| [top-positioning-line-pulley](parts/top-positioning-line-pulley.md) | 4 each | corner-support-set (4 each) | wasi-barton-30mm |
| [top-pulley-bracket](parts/top-pulley-bracket.md) | 4 each | corner-support-set (4 each) | bauhaus-top-pulley-bracket |
| [top-pulley-keeper](parts/top-pulley-keeper.md) | 4 each | corner-support-set (4 each) | in-house-fabrication-top-pulley-keeper |
| [winch-drum](parts/winch-drum.md) | 4 each | winch-set (4 each) | in-house-fabrication-winch-drum |
| [winch-drum-joining-hardware](parts/winch-drum-joining-hardware.md) | 1 each | winch-set (1 each) | unresolved-winch-drum-joining-hardware |
| [winch-drum-shaft-8mm](parts/winch-drum-shaft-8mm.md) | 4 each | winch-set (4 each) | bauhaus-winch-drum-shaft-8mm |
| [winch-full-cover](parts/winch-full-cover.md) | 4 each | winch-set (4 each) | unresolved |
| [winch-full-cover-hardware](parts/winch-full-cover-hardware.md) | 1 each | winch-set (1 each) | unresolved |
| [winch-mount-and-guard](parts/winch-mount-and-guard.md) | 4 each | winch-set (4 each) | in-house-fabrication-winch-mount-and-guard |
| [winch-mount-hardware](parts/winch-mount-hardware.md) | 1 each | winch-set (1 each) | unresolved-winch-mount-hardware |
| [wire-rope-clamp-3mm](parts/wire-rope-clamp-3mm.md) | 16 each | corner-support-set (16 each) | bauhaus-wire-rope-clamp-3mm |
| [wire-rope-thimble-3mm](parts/wire-rope-thimble-3mm.md) | 8 each | corner-support-set (8 each) | bauhaus-wire-rope-thimble-3mm |
| [zinc-spray](parts/zinc-spray.md) | 1 each | corner-support-set (1 each) | bauhaus-zinc-spray |

## Prioritized warnings

Critical warnings identify temporary workarounds or missing information. Warnings identify concepts and selections awaiting confirmation. These priorities do not establish physical acceptance.

### Critical (196)

- **Critical:** bulk-capacitor-1000uf: A cable tie currently retains the pod capacitor. Replace it with a dedicated insulated removable holder; cable ties are temporary bench workarounds only, never final retention.
- **Critical:** camera-pod-chassis: The current deck retains the converter, capacitor and harness with cable ties. Replace these with dedicated removable mounts and strain relief; cable ties are temporary bench workarounds only, never the final assembly solution.
- **Critical:** camera-pod-wiring-kit: Converter, capacitor and harness ties are shown without a complete procurement specification or quantity. Record the missing hardware data and replace tie-based retention with dedicated mounts and strain relief; cable ties are temporary bench workarounds only.
- **Critical:** pod-buck-converter-48v-5v: Two cable ties currently retain the pod converter. Replace them with a dedicated insulated removable mounting method; cable ties are temporary bench workarounds only, never final retention.
- **Critical:** aliexpress-bearing-608-2rs: Availability is unknown.
- **Critical:** aliexpress-bearing-608-2rs: Price and availability observation date is unknown; quote capture time is not verification time.
- **Critical:** aliexpress-bearing-608-2rs: Tax/VAT treatment is unknown.
- **Critical:** aliexpress-bulk-capacitor-1000uf: Availability is unknown.
- **Critical:** aliexpress-bulk-capacitor-1000uf: Price and availability observation date is unknown; quote capture time is not verification time.
- **Critical:** aliexpress-bulk-capacitor-1000uf: Tax/VAT treatment is unknown.
- **Critical:** aliexpress-cable-gland-assortment: Availability is unknown.
- **Critical:** aliexpress-cable-gland-assortment: Price and availability observation date is unknown; quote capture time is not verification time.
- **Critical:** aliexpress-cable-gland-assortment: Tax/VAT treatment is unknown.
- **Critical:** aliexpress-capsule-slip-ring-6x2a: Availability is unknown.
- **Critical:** aliexpress-capsule-slip-ring-6x2a: Price and availability observation date is unknown; quote capture time is not verification time.
- **Critical:** aliexpress-capsule-slip-ring-6x2a: Tax/VAT treatment is unknown.
- **Critical:** aliexpress-controller-buck-converter-48v-5v: Availability is unknown.
- **Critical:** aliexpress-controller-buck-converter-48v-5v: Price and availability observation date is unknown; quote capture time is not verification time.
- **Critical:** aliexpress-controller-buck-converter-48v-5v: Tax/VAT treatment is unknown.
- **Critical:** aliexpress-emergency-stop-switch: A quoted price cannot be extended without package data.
- **Critical:** aliexpress-emergency-stop-switch: Availability is unknown.
- **Critical:** aliexpress-emergency-stop-switch: Package size/MOQ is unknown.
- **Critical:** aliexpress-emergency-stop-switch: Price and availability observation date is unknown; quote capture time is not verification time.
- **Critical:** aliexpress-flexible-jaw-coupling-8mm: Availability is unknown.
- **Critical:** aliexpress-heat-set-insert-assortment: Availability is unknown.
- **Critical:** aliexpress-heat-set-insert-assortment: Price and availability observation date is unknown; quote capture time is not verification time.
- **Critical:** aliexpress-heat-set-insert-assortment: Tax/VAT treatment is unknown.
- **Critical:** aliexpress-hr: Customs is conditional: total order goods value is unknown; split orders are not assumed.
- **Critical:** aliexpress-hr: Shipping is unknown; null is not treated as free.
- **Critical:** aliexpress-micro-pan-tilt-servo: Availability is unknown.
- **Critical:** aliexpress-micro-pan-tilt-servo: Price and availability observation date is unknown; quote capture time is not verification time.
- **Critical:** aliexpress-micro-pan-tilt-servo: Tax/VAT treatment is unknown.
- **Critical:** aliexpress-pod-buck-converter-48v-5v: Availability is unknown.
- **Critical:** aliexpress-pod-buck-converter-48v-5v: Price and availability observation date is unknown; quote capture time is not verification time.
- **Critical:** aliexpress-pod-buck-converter-48v-5v: Tax/VAT treatment is unknown.
- **Critical:** aliexpress-pod-power-wire-black-awg26: Availability is unknown.
- **Critical:** aliexpress-pod-power-wire-black-awg26: Price and availability observation date is unknown; quote capture time is not verification time.
- **Critical:** aliexpress-pod-power-wire-black-awg26: Tax/VAT treatment is unknown.
- **Critical:** aliexpress-pod-power-wire-red-awg26: Availability is unknown.
- **Critical:** aliexpress-pod-power-wire-red-awg26: Price and availability observation date is unknown; quote capture time is not verification time.
- **Critical:** aliexpress-pod-power-wire-red-awg26: Tax/VAT treatment is unknown.
- **Critical:** aliexpress-roller-lever-microswitch: Availability is unknown.
- **Critical:** aliexpress-roller-lever-microswitch: Price and availability observation date is unknown; quote capture time is not verification time.
- **Critical:** aliexpress-roller-lever-microswitch: Tax/VAT treatment is unknown.
- **Critical:** aliexpress-shaft-collar-8mm: Availability is unknown.
- **Critical:** aliexpress-shaft-collar-8mm: Price and availability observation date is unknown; quote capture time is not verification time.
- **Critical:** aliexpress-shaft-collar-8mm: Tax/VAT treatment is unknown.
- **Critical:** aliexpress-stainless-fastener-assortment: Availability is unknown.
- **Critical:** aliexpress-stainless-fastener-assortment: Price and availability observation date is unknown; quote capture time is not verification time.
- **Critical:** aliexpress-stainless-fastener-assortment: Tax/VAT treatment is unknown.
- **Critical:** bauhaus-din-rail-ground-distribution-block: Availability is unknown.
- **Critical:** bauhaus-din-rail-ground-distribution-block: Price and availability observation date is unknown; quote capture time is not verification time.
- **Critical:** bauhaus-din-rail-ground-distribution-block: Tax/VAT treatment is unknown.
- **Critical:** bauhaus-guy-turnbuckle-m12: A quoted price cannot be extended without package data.
- **Critical:** bauhaus-guy-turnbuckle-m12: Availability is unknown.
- **Critical:** bauhaus-guy-turnbuckle-m12: Package size/MOQ is unknown.
- **Critical:** bauhaus-guy-turnbuckle-m12: Price and availability observation date is unknown; quote capture time is not verification time.
- **Critical:** bauhaus-guy-wire-3mm: A quoted price cannot be extended without package data.
- **Critical:** bauhaus-guy-wire-3mm: Availability is unknown.
- **Critical:** bauhaus-guy-wire-3mm: Package size/MOQ is unknown.
- **Critical:** bauhaus-guy-wire-3mm: Price and availability observation date is unknown; quote capture time is not verification time.
- **Critical:** bauhaus-hr: Shipping is unknown; null is not treated as free.
- **Critical:** bauhaus-hr: Shipping observation date is unknown; quote capture time is not verification time.
- **Critical:** bauhaus-motor-power-branch-cable: Availability is unknown.
- **Critical:** bauhaus-motor-power-branch-cable: Price and availability observation date is unknown; quote capture time is not verification time.
- **Critical:** bauhaus-motor-power-branch-cable: Tax/VAT treatment is unknown.
- **Critical:** bauhaus-post-electronics-enclosure: A quoted price cannot be extended without package data.
- **Critical:** bauhaus-post-electronics-enclosure: Availability is unknown.
- **Critical:** bauhaus-post-electronics-enclosure: Package size/MOQ is unknown.
- **Critical:** bauhaus-post-electronics-enclosure: Price and availability observation date is unknown; quote capture time is not verification time.
- **Critical:** bauhaus-pulley-bracket-backing-plate: Availability is unknown.
- **Critical:** bauhaus-pulley-bracket-backing-plate: Price and availability observation date is unknown; quote capture time is not verification time.
- **Critical:** bauhaus-pulley-bracket-backing-plate: Tax/VAT treatment is unknown.
- **Critical:** bauhaus-pulley-bracket-locknut-m12: Availability is unknown.
- **Critical:** bauhaus-pulley-bracket-locknut-m12: Price and availability observation date is unknown; quote capture time is not verification time.
- **Critical:** bauhaus-pulley-bracket-locknut-m12: Tax/VAT treatment is unknown.
- **Critical:** bauhaus-pulley-bracket-shackle-m8: Availability is unknown.
- **Critical:** bauhaus-pulley-bracket-shackle-m8: Price and availability observation date is unknown; quote capture time is not verification time.
- **Critical:** bauhaus-pulley-bracket-shackle-m8: Tax/VAT treatment is unknown.
- **Critical:** bauhaus-pulley-bracket-through-bolt-m12x160: Availability is unknown.
- **Critical:** bauhaus-pulley-bracket-through-bolt-m12x160: Price and availability observation date is unknown; quote capture time is not verification time.
- **Critical:** bauhaus-pulley-bracket-through-bolt-m12x160: Tax/VAT treatment is unknown.
- **Critical:** bauhaus-pulley-bracket-washer-m12: Availability is unknown.
- **Critical:** bauhaus-pulley-bracket-washer-m12: Price and availability observation date is unknown; quote capture time is not verification time.
- **Critical:** bauhaus-pulley-bracket-washer-m12: Tax/VAT treatment is unknown.
- **Critical:** bauhaus-top-pulley-bracket: Availability is unknown.
- **Critical:** bauhaus-top-pulley-bracket: Price and availability observation date is unknown; quote capture time is not verification time.
- **Critical:** bauhaus-top-pulley-bracket: Tax/VAT treatment is unknown.
- **Critical:** bauhaus-winch-drum-shaft-8mm: Availability is unknown.
- **Critical:** bauhaus-wire-rope-clamp-3mm: A quoted price cannot be extended without package data.
- **Critical:** bauhaus-wire-rope-clamp-3mm: Availability is unknown.
- **Critical:** bauhaus-wire-rope-clamp-3mm: Package size/MOQ is unknown.
- **Critical:** bauhaus-wire-rope-clamp-3mm: Price and availability observation date is unknown; quote capture time is not verification time.
- **Critical:** bauhaus-wire-rope-thimble-3mm: A quoted price cannot be extended without package data.
- **Critical:** bauhaus-wire-rope-thimble-3mm: Availability is unknown.
- **Critical:** bauhaus-wire-rope-thimble-3mm: Package size/MOQ is unknown.
- **Critical:** bauhaus-wire-rope-thimble-3mm: Price and availability observation date is unknown; quote capture time is not verification time.
- **Critical:** bauhaus-zinc-spray: Availability is unknown.
- **Critical:** bauhaus-zinc-spray: Price and availability observation date is unknown; quote capture time is not verification time.
- **Critical:** bauhaus-zinc-spray: Tax/VAT treatment is unknown.
- **Critical:** camera-gimbal: Print material cost is estimated from solid CAD volume; supports, waste, shipping, tax adjustment, energy, machine time and labour are unresolved.
- **Critical:** camera-pod-chassis: Print material cost is estimated from solid CAD volume; supports, waste, shipping, tax adjustment, energy, machine time and labour are unresolved.
- **Critical:** cotra-zagreb-corner-post-treated-timber: Availability is unknown.
- **Critical:** cotra-zagreb-corner-post-treated-timber: Package size/MOQ is unknown.
- **Critical:** cotra-zagreb-corner-post-treated-timber: Price and availability observation date is unknown; quote capture time is not verification time.
- **Critical:** cotra-zagreb-corner-post-treated-timber: Price is unknown.
- **Critical:** cotra-zagreb-hr: Shipping is unknown; null is not treated as free.
- **Critical:** cotra-zagreb-hr: Shipping observation date is unknown; quote capture time is not verification time.
- **Critical:** dive-store-dyneema-positioning-line: Availability is unknown.
- **Critical:** dive-store-dyneema-positioning-line: Tax/VAT treatment is unknown.
- **Critical:** dive-store-hr: Shipping tax/VAT treatment is unknown.
- **Critical:** dock-funnel: Print material cost is estimated from solid CAD volume; supports, waste, shipping, tax adjustment, energy, machine time and labour are unresolved.
- **Critical:** dock-latch-hardware: Print material cost is estimated from solid CAD volume; supports, waste, shipping, tax adjustment, energy, machine time and labour are unresolved.
- **Critical:** dock-nest: Print material cost is estimated from solid CAD volume; supports, waste, shipping, tax adjustment, energy, machine time and labour are unresolved.
- **Critical:** dock-support-arm: Print material cost is estimated from solid CAD volume; supports, waste, shipping, tax adjustment, energy, machine time and labour are unresolved.
- **Critical:** dock-weather-hood: Print material cost is estimated from solid CAD volume; supports, waste, shipping, tax adjustment, energy, machine time and labour are unresolved.
- **Critical:** hr-zagreb: Destination tax/VAT status is unknown and blocks a complete landed total.
- **Critical:** in-house-fabrication-camera-gimbal: Price and availability observation date is unknown; quote capture time is not verification time.
- **Critical:** in-house-fabrication-camera-gimbal: Price is unknown.
- **Critical:** in-house-fabrication-camera-pod-chassis: Price and availability observation date is unknown; quote capture time is not verification time.
- **Critical:** in-house-fabrication-camera-pod-chassis: Price is unknown.
- **Critical:** in-house-fabrication-dock-capture-set: Price and availability observation date is unknown; quote capture time is not verification time.
- **Critical:** in-house-fabrication-dock-capture-set: Price is unknown.
- **Critical:** in-house-fabrication-dock-latch-hardware: Price and availability observation date is unknown; quote capture time is not verification time.
- **Critical:** in-house-fabrication-dock-latch-hardware: Price is unknown.
- **Critical:** in-house-fabrication-dock-weather-hood: Price and availability observation date is unknown; quote capture time is not verification time.
- **Critical:** in-house-fabrication-dock-weather-hood: Price is unknown.
- **Critical:** in-house-fabrication-hr: Shipping observation date is unknown; quote capture time is not verification time.
- **Critical:** in-house-fabrication-top-pulley-keeper: Price and availability observation date is unknown; quote capture time is not verification time.
- **Critical:** in-house-fabrication-top-pulley-keeper: Price is unknown.
- **Critical:** in-house-fabrication-winch-drum: Price and availability observation date is unknown; quote capture time is not verification time.
- **Critical:** in-house-fabrication-winch-drum: Price is unknown.
- **Critical:** in-house-fabrication-winch-mount-and-guard: Price and availability observation date is unknown; quote capture time is not verification time.
- **Critical:** in-house-fabrication-winch-mount-and-guard: Price is unknown.
- **Critical:** kabel24-control-panel-enclosure: A quoted price cannot be extended without package data.
- **Critical:** kabel24-control-panel-enclosure: Availability is unknown.
- **Critical:** kabel24-control-panel-enclosure: Package size/MOQ is unknown.
- **Critical:** kabel24-control-panel-enclosure: Price and availability observation date is unknown; quote capture time is not verification time.
- **Critical:** kabel24-hr: Shipping is unknown; null is not treated as free.
- **Critical:** kabel24-hr: Shipping observation date is unknown; quote capture time is not verification time.
- **Critical:** njuskalo-guy-ground-anchor: A quoted price cannot be extended without package data.
- **Critical:** njuskalo-guy-ground-anchor: Availability is unknown.
- **Critical:** njuskalo-guy-ground-anchor: Package size/MOQ is unknown.
- **Critical:** njuskalo-guy-ground-anchor: Price and availability observation date is unknown; quote capture time is not verification time.
- **Critical:** njuskalo-hr: Shipping is unknown; null is not treated as free.
- **Critical:** njuskalo-hr: Shipping observation date is unknown; quote capture time is not verification time.
- **Critical:** pimoroni-hr: Shipping is unknown; null is not treated as free.
- **Critical:** pimoroni-hr: Shipping observation date is unknown; quote capture time is not verification time.
- **Critical:** pimoroni-raspberry-pi-3a-plus: Availability is unknown.
- **Critical:** pimoroni-raspberry-pi-3a-plus: Price and availability observation date is unknown; quote capture time is not verification time.
- **Critical:** pimoroni-raspberry-pi-3a-plus: Tax/VAT treatment is unknown.
- **Critical:** Required part cabinet-installation-kit has no pinned offer.
- **Critical:** Required part cabinet-protection-kit has no pinned offer.
- **Critical:** Required part camera-pod-fastener-kit has no pinned offer.
- **Critical:** Required part camera-pod-wiring-kit has no pinned offer.
- **Critical:** Required part dock-bench-hardware has no pinned offer.
- **Critical:** Required part dock-support-arm has no pinned offer.
- **Critical:** Required part extension-spring-assortment has no pinned offer.
- **Critical:** Required part winch-full-cover has no pinned offer.
- **Critical:** Required part winch-full-cover-hardware has no pinned offer.
- **Critical:** ronis-hr: Shipping is unknown; null is not treated as free.
- **Critical:** ronis-hr: Shipping observation date is unknown; quote capture time is not verification time.
- **Critical:** ronis-outdoor-cat5e-signal-cable: Availability is unknown.
- **Critical:** ronis-outdoor-cat5e-signal-cable: Price and availability observation date is unknown; quote capture time is not verification time.
- **Critical:** ronis-outdoor-cat5e-signal-cable: Tax/VAT treatment is unknown.
- **Critical:** stepperonline-4-axis-v2-kit: Availability is unknown.
- **Critical:** stepperonline-4-axis-v2-kit: Price and availability observation date is unknown; quote capture time is not verification time.
- **Critical:** stepperonline-4-axis-v2-kit: Tax/VAT treatment is unknown.
- **Critical:** stepperonline-hr: Shipping observation date is unknown; quote capture time is not verification time.
- **Critical:** stepperonline-hr: Shipping tax/VAT treatment is unknown.
- **Critical:** tme-hr: Shipping observation date is unknown; quote capture time is not verification time.
- **Critical:** tme-hr: Shipping tax/VAT treatment is unknown.
- **Critical:** tme-microsd-card-32gb: Availability is unknown.
- **Critical:** tme-microsd-card-32gb: Price and availability observation date is unknown; quote capture time is not verification time.
- **Critical:** tme-microsd-card-32gb: Tax/VAT treatment is unknown.
- **Critical:** tme-pico-terminal-expansion-board: Availability is unknown.
- **Critical:** tme-pico-terminal-expansion-board: Price and availability observation date is unknown; quote capture time is not verification time.
- **Critical:** tme-pico-terminal-expansion-board: Tax/VAT treatment is unknown.
- **Critical:** tme-raspberry-pi-camera-module-3: Availability is unknown.
- **Critical:** tme-raspberry-pi-camera-module-3: Price and availability observation date is unknown; quote capture time is not verification time.
- **Critical:** tme-raspberry-pi-camera-module-3: Tax/VAT treatment is unknown.
- **Critical:** tme-raspberry-pi-pico-2-w: Availability is unknown.
- **Critical:** tme-raspberry-pi-pico-2-w: Price and availability observation date is unknown; quote capture time is not verification time.
- **Critical:** tme-raspberry-pi-pico-2-w: Tax/VAT treatment is unknown.
- **Critical:** top-pulley-keeper: Print material cost is estimated from solid CAD volume; supports, waste, shipping, tax adjustment, energy, machine time and labour are unresolved.
- **Critical:** unresolved-winch-drum-joining-hardware: Destination quote row is missing.
- **Critical:** unresolved-winch-drum-joining-hardware: Package size/MOQ is unknown.
- **Critical:** unresolved-winch-drum-joining-hardware: Price is unknown.
- **Critical:** unresolved-winch-mount-hardware: Destination quote row is missing.
- **Critical:** unresolved-winch-mount-hardware: Package size/MOQ is unknown.
- **Critical:** unresolved-winch-mount-hardware: Price is unknown.
- **Critical:** wasi-barton-30mm: Tax/VAT treatment is unknown.
- **Critical:** winch-drum: Print material cost is estimated from solid CAD volume; supports, waste, shipping, tax adjustment, energy, machine time and labour are unresolved.
- **Critical:** winch-full-cover: Print material cost is estimated from solid CAD volume; supports, waste, shipping, tax adjustment, energy, machine time and labour are unresolved.
- **Critical:** winch-mount-and-guard: Print material cost is estimated from solid CAD volume; supports, waste, shipping, tax adjustment, energy, machine time and labour are unresolved.
- **Critical:** wire-rope-thimble-3mm: Part requirements are missing; record the specification before selecting or building this part.

### Warning (68)

- **Warning:** aliexpress-bearing-608-2rs: Qualification is baseline-selected; the recorded selection is not engineering approval.
- **Warning:** aliexpress-bulk-capacitor-1000uf: Qualification is baseline-selected; the recorded selection is not engineering approval.
- **Warning:** aliexpress-cable-gland-assortment: Qualification is baseline-selected; the recorded selection is not engineering approval.
- **Warning:** aliexpress-capsule-slip-ring-6x2a: Qualification is baseline-selected; the recorded selection is not engineering approval.
- **Warning:** aliexpress-controller-buck-converter-48v-5v: Qualification is baseline-selected; the recorded selection is not engineering approval.
- **Warning:** aliexpress-emergency-stop-switch: Qualification is baseline-selected; the recorded selection is not engineering approval.
- **Warning:** aliexpress-flexible-jaw-coupling-8mm: Qualification is baseline-selected; the recorded selection is not engineering approval.
- **Warning:** aliexpress-heat-set-insert-assortment: Qualification is baseline-selected; the recorded selection is not engineering approval.
- **Warning:** aliexpress-hr: One selected offer approximates one declared item type; actual customs grouping is unconfirmed.
- **Warning:** aliexpress-micro-pan-tilt-servo: Qualification is baseline-selected; the recorded selection is not engineering approval.
- **Warning:** aliexpress-pod-buck-converter-48v-5v: Qualification is baseline-selected; the recorded selection is not engineering approval.
- **Warning:** aliexpress-pod-power-wire-black-awg26: Qualification is baseline-selected; the recorded selection is not engineering approval.
- **Warning:** aliexpress-pod-power-wire-red-awg26: Qualification is baseline-selected; the recorded selection is not engineering approval.
- **Warning:** aliexpress-roller-lever-microswitch: Qualification is baseline-selected; the recorded selection is not engineering approval.
- **Warning:** aliexpress-shaft-collar-8mm: Qualification is baseline-selected; the recorded selection is not engineering approval.
- **Warning:** aliexpress-stainless-fastener-assortment: Qualification is baseline-selected; the recorded selection is not engineering approval.
- **Warning:** bauhaus-din-rail-ground-distribution-block: Qualification is baseline-selected; the recorded selection is not engineering approval.
- **Warning:** bauhaus-guy-turnbuckle-m12: Qualification is baseline-selected; the recorded selection is not engineering approval.
- **Warning:** bauhaus-guy-wire-3mm: Qualification is baseline-selected; the recorded selection is not engineering approval.
- **Warning:** bauhaus-motor-power-branch-cable: Qualification is baseline-selected; the recorded selection is not engineering approval.
- **Warning:** bauhaus-post-electronics-enclosure: Qualification is baseline-selected; the recorded selection is not engineering approval.
- **Warning:** bauhaus-pulley-bracket-backing-plate: Qualification is baseline-selected; the recorded selection is not engineering approval.
- **Warning:** bauhaus-pulley-bracket-locknut-m12: Qualification is baseline-selected; the recorded selection is not engineering approval.
- **Warning:** bauhaus-pulley-bracket-shackle-m8: Qualification is baseline-selected; the recorded selection is not engineering approval.
- **Warning:** bauhaus-pulley-bracket-through-bolt-m12x160: Qualification is baseline-selected; the recorded selection is not engineering approval.
- **Warning:** bauhaus-pulley-bracket-washer-m12: Qualification is baseline-selected; the recorded selection is not engineering approval.
- **Warning:** bauhaus-top-pulley-bracket: Qualification is baseline-selected; the recorded selection is not engineering approval.
- **Warning:** bauhaus-winch-drum-shaft-8mm: Qualification is baseline-selected; the recorded selection is not engineering approval.
- **Warning:** bauhaus-wire-rope-clamp-3mm: Qualification is baseline-selected; the recorded selection is not engineering approval.
- **Warning:** bauhaus-wire-rope-thimble-3mm: Qualification is baseline-selected; the recorded selection is not engineering approval.
- **Warning:** bauhaus-zinc-spray: Qualification is baseline-selected; the recorded selection is not engineering approval.
- **Warning:** cabinet-installation-kit: This part is planned; confirm its specification and selection with committed evidence.
- **Warning:** cabinet-protection-kit: This part is planned; confirm its specification and selection with committed evidence.
- **Warning:** camera-gimbal: Fabrication status is concept-unvalidated; fit, materials and physical acceptance still need committed evidence.
- **Warning:** camera-pod-chassis: Fabrication status is concept-unvalidated; fit, materials and physical acceptance still need committed evidence.
- **Warning:** camera-pod-fastener-kit: This part is planned; confirm its specification and selection with committed evidence.
- **Warning:** camera-pod-wiring-kit: This part is planned; confirm its specification and selection with committed evidence.
- **Warning:** cotra-zagreb-corner-post-treated-timber: Qualification is baseline-selected; the recorded selection is not engineering approval.
- **Warning:** dive-store-dyneema-positioning-line: Qualification is baseline-selected; the recorded selection is not engineering approval.
- **Warning:** dock-funnel: Fabrication status is concept-unvalidated; fit, materials and physical acceptance still need committed evidence.
- **Warning:** dock-latch-hardware: Fabrication status is concept-unvalidated; fit, materials and physical acceptance still need committed evidence.
- **Warning:** dock-nest: Fabrication status is concept-unvalidated; fit, materials and physical acceptance still need committed evidence.
- **Warning:** dock-support-arm: Fabrication status is concept-unvalidated; fit, materials and physical acceptance still need committed evidence.
- **Warning:** dock-weather-hood: Fabrication status is concept-unvalidated; fit, materials and physical acceptance still need committed evidence.
- **Warning:** in-house-fabrication-camera-gimbal: Qualification is baseline-selected; the recorded selection is not engineering approval.
- **Warning:** in-house-fabrication-camera-pod-chassis: Qualification is baseline-selected; the recorded selection is not engineering approval.
- **Warning:** in-house-fabrication-dock-capture-set: Qualification is baseline-selected; the recorded selection is not engineering approval.
- **Warning:** in-house-fabrication-dock-latch-hardware: Qualification is baseline-selected; the recorded selection is not engineering approval.
- **Warning:** in-house-fabrication-dock-weather-hood: Qualification is baseline-selected; the recorded selection is not engineering approval.
- **Warning:** in-house-fabrication-top-pulley-keeper: Qualification is baseline-selected; the recorded selection is not engineering approval.
- **Warning:** in-house-fabrication-winch-drum: Qualification is baseline-selected; the recorded selection is not engineering approval.
- **Warning:** in-house-fabrication-winch-mount-and-guard: Qualification is baseline-selected; the recorded selection is not engineering approval.
- **Warning:** kabel24-control-panel-enclosure: Qualification is baseline-selected; the recorded selection is not engineering approval.
- **Warning:** njuskalo-guy-ground-anchor: Qualification is baseline-selected; the recorded selection is not engineering approval.
- **Warning:** pimoroni-raspberry-pi-3a-plus: Qualification is baseline-selected; the recorded selection is not engineering approval.
- **Warning:** ronis-outdoor-cat5e-signal-cable: Qualification is baseline-selected; the recorded selection is not engineering approval.
- **Warning:** stepperonline-4-axis-v2-kit: Qualification is baseline-selected; the recorded selection is not engineering approval.
- **Warning:** tme-microsd-card-32gb: Qualification is baseline-selected; the recorded selection is not engineering approval.
- **Warning:** tme-pico-terminal-expansion-board: Qualification is baseline-selected; the recorded selection is not engineering approval.
- **Warning:** tme-raspberry-pi-camera-module-3: Qualification is unresolved; the recorded selection is not engineering approval.
- **Warning:** tme-raspberry-pi-pico-2-w: Qualification is baseline-selected; the recorded selection is not engineering approval.
- **Warning:** top-pulley-keeper: Fabrication status is concept-unvalidated; fit, materials and physical acceptance still need committed evidence.
- **Warning:** unresolved-winch-drum-joining-hardware: Qualification is unresolved; the recorded selection is not engineering approval.
- **Warning:** unresolved-winch-mount-hardware: Qualification is unresolved; the recorded selection is not engineering approval.
- **Warning:** wasi-barton-30mm: Qualification is baseline-selected; the recorded selection is not engineering approval.
- **Warning:** winch-drum: Fabrication status is concept-unvalidated; fit, materials and physical acceptance still need committed evidence.
- **Warning:** winch-full-cover: Fabrication status is concept-unvalidated; fit, materials and physical acceptance still need committed evidence.
- **Warning:** winch-mount-and-guard: Fabrication status is concept-unvalidated; fit, materials and physical acceptance still need committed evidence.


## Evidence boundary

- The committed BOM inputs are the sole canonical project records. Supplier URLs and dated quote observations are evidence attached to those records, not a competing source of truth.
- The motor kit is modeled as four component types, and the dock funnel and nest are separate generated artifacts; reviewed Git changes may extend the catalog.
- A baseline-selected or unresolved offer is a procurement status, not engineering approval.
- OpenSCAD source consistency, calculation success, procurement, installation, and physical safety validation are separate facts.
