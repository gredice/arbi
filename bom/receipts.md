# BOM order and receipt log

Owner-confirmed orders and deliveries for the ARBI V1 build, linked by offer ID to the [offer catalog](catalog/offers.json). Actual ordered and received quantities are kept separate from the calculator's planned purchase quantities.

## Incoming orders confirmed on 2026-09-08

Evidence: Aleks reported that the following AliExpress items were ordered and are incoming, then confirmed the quantities and pack sizes below on 2026-09-08. Order dates and arrival estimates were not supplied.

| Supplier | Offer ID / BOM mapping | Item reported | Ordered quantity | Status |
| --- | --- | --- | --- | --- |
| AliExpress | `aliexpress-micro-pan-tilt-servo` | 3 g micro servos | 6 servos (2 packs × 3 pcs) | Ordered / incoming |
| AliExpress | `aliexpress-flexible-jaw-coupling-8mm` | Couplings | 4 couplers | Ordered / incoming |
| AliExpress | `aliexpress-controller-buck-converter-48v-5v`, `aliexpress-pod-buck-converter-48v-5v` (allocation unconfirmed) | Step-down converters | 4 converters total | Ordered / incoming |
| AliExpress | `aliexpress-roller-lever-microswitch` | Microswitches | 10 switches (1 pack × 10 pcs) | Ordered / incoming |
| AliExpress | `aliexpress-shaft-collar-8mm` | Split shaft collars | 8 collars (2 packs × 4 pcs) | Ordered / incoming |

Mappings identify the corresponding BOM items; exact ordered variants have not been checked. The step-down order is recorded as a single category pending confirmation of allocation to the controller and pod. These entries do not establish receipt or inspection, and planned pack sizes are not treated as confirmed order quantities.

## Receipts confirmed on 2026-09-08

Evidence: Aleks reported receiving the motor kit, four 50 m line spools, camera module, and Raspberry Pi microcontroller, then explicitly confirmed that all these and the other two identified TME items should be marked received. The date is the confirmation date; exact delivery dates were not supplied.

| Supplier | Offer ID / BOM mapping | Item | Received quantity | Status |
| --- | --- | --- | --- | --- |
| StepperOnline | `stepperonline-4-axis-v2-kit` | Four-axis motor kit, 4-CLYS30-V20 | 1 kit | Received |
| Dive Store | `dive-store-dyneema-positioning-line` | Dyneema positioning line | 4 × 50 m spools (200 m total) | Received |
| TME | `tme-raspberry-pi-camera-module-3` | Raspberry Pi Camera Module 3 | 1 | Received |
| TME | `tme-raspberry-pi-pico-2-w` | Raspberry Pi Pico 2 W with headers | 1 | Received |
| TME | `tme-microsd-card-32gb` | SanDisk 32 GB microSD card | 1 | Received |
| TME | `tme-pico-terminal-expansion-board` | Pico screw-terminal expansion board | 1 | Received |
| WASI Zagreb (BOM listing) | `baseline-combined-top-pulley-offer` | Top positioning-line rollers / pulleys | 4 | Received |

Aleks also confirmed receipt of four top rollers on 2026-09-08 and clarified that the supplier is the one in the BOM. The selected `baseline-combined-top-pulley-offer` links to WASI Zagreb. Its catalog supplier ID remains `baseline-top-pulley-combined` (Combined top-pulley source); this receipt uses that selected offer and identifies the seller from its listing. Exact delivered model has not been inspected.

Aleks explicitly confirmed on 2026-09-08 that the received motor kit and positioning lines are from the selected BOM offers: `stepperonline-4-axis-v2-kit` (StepperOnline) and `dive-store-dyneema-positioning-line` (Dive Store). The receipt entries above reflect those confirmed sources.

The catalog lists four motors, four CL57Y-V20 drivers, four matched motor cables, and two 48 V / 350 W power supplies inside the motor kit. Receipt is recorded at kit level; no separate contents inspection was reported.

Exact delivered camera and terminal-board variants have not been inspected against the BOM requirements. Receipt does not resolve existing catalog qualification or model discrepancies, or establish functional testing or installation.

Append future orders and deliveries with their confirmation date, evidence, stable offer ID, and actual quantity when known. When incoming items arrive, record receipt separately so the order history remains traceable. Do not infer receipt for unlisted items. This manual log is not included in generated cost reports.
