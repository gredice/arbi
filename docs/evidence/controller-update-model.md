# Controller update source and bench acceptance matrix

Work record: [#72](https://github.com/gredice/arbi/issues/72). [Decision](../decisions/0031-controller-update-owner-interlocks.md), [guide](../software/controller-update-model.md), [consumed updater](pico-flash-model.md).

Actual shared C owner tests cover motion/prepared intent, active leases, wrong epochs, future/stale/dependent protection, pending atomic faults, irreversible reservation, rejected reconnect/reconfiguration/recovery and inhibited fresh reset. Native Node tests compose the signed flash model with a named synthetic owner: valid staged version/trial/confirmation; moving/leased/Parked-only/stale/malformed protection; actual bad signature/hash/target/compatibility refusal; retained reservation after rejected images; renewed protection at activation/confirmation and local timeout rollback.

Clean revision `4dc0ad989f9be89b4299fda8e6064c19f6fae17a` reports `ARBI_BUILD_DIRTY=0`. Linux x64/Node 24.19.0 passes all 33 groups normally and with five C host binaries under ASan/UBSan; the ten Node update groups retain native cryptographic/filesystem/SQLite coverage rather than C sanitizer coverage. Both pinned Pico SDK 2.2.0/ARM GCC 12.2.1 branches build. The normal image uses 59,832 text / 57,788 BSS bytes. The denied target link retains `local_model_update_begin` and the physical-denial gate, using 39,572 text / 39,956 BSS bytes. Lint, documentation, 25 planner/gate regressions and whitespace pass. No board was connected.

Combined diagnostics/updater source `692ff988e881f2da7441159311030b9560193431` also reports `ARBI_BUILD_DIRTY=0` and passes all 36 groups normally and with six C binaries under ASan/UBSan. Both pinned target builds pass; the denied link retains diagnostics, reservation and denial gates together, using 55,784 text / 74,124 BSS bytes. Normal image size and physical unavailability remain unchanged.

| Acceptance item | Source result / remaining gate |
| --- | --- |
| Current identities/compatibility/authentic image and no stale moving intent | C owner plus actual native signed flash tests; no connected MCU updater |
| Installation and recovery cannot restore motion authority | C boot lock/reset source tests; real GPIO/PIO/reset behavior unavailable |
| Exposed staged/slot identity, failure reason and service classification | Private bounded source inventory; no claim of actually executed firmware |
| Erase/program/journal/trial interruption | Inherited native file/fsync, journal cuts and SIGKILL evidence; board power cuts unavailable |
| Firmware/source identity and capacity | Pinned ARM cross-build source evidence; board serial/flash identity unavailable |
| Measured timing, physical configuration/equipment/conditions/reviewer | Unavailable; no board, secured rig, logic analyzer or qualified physical reviewer |
| BOOTSEL/SWD rescue and independent restraint/line clearance | Unavailable; physical installer and remote activation remain unsupported |

#72 remains open. No physical bench or public-operation acceptance is claimed.
