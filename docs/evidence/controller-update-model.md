# Controller update source and bench acceptance matrix

Work record: [#72](https://github.com/gredice/arbi/issues/72). [Decision](../decisions/0031-controller-update-owner-interlocks.md), [guide](../software/controller-update-model.md), [consumed updater](pico-flash-model.md).

Actual shared C owner tests cover motion/prepared intent, active leases, wrong epochs, future/stale/dependent protection, pending atomic faults, irreversible reservation, rejected reconnect/reconfiguration/recovery and inhibited fresh reset. Native Node tests compose the signed flash model with a named synthetic owner: valid staged version/trial/confirmation; moving/leased/Parked-only/stale/malformed protection; actual bad signature/hash/target/compatibility refusal; retained reservation after rejected images; renewed protection at activation/confirmation and local timeout rollback. Clean target revision and validation are recorded after implementation.

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
