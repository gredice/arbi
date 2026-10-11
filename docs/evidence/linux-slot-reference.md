# Isolated Linux slot evidence

[#44](https://github.com/gredice/arbi/issues/44),
[guide](../software/linux-slot-reference.md),
[ADR-0039](../decisions/0039-isolated-native-linux-slots.md).

Native host scenarios compose the actual existing trust store, signed release
producer, range source/budget, audit/update orchestration and reversible data
migration with private A/B files and an exclusive SQLite owner. Application and
OS cases run both pod and edge targets, retain declared identity/configuration/
calibration/pending-capture files and independently read candidate bytes.
Failing declared local trials restore signed baseline files/data and stop later
canary targets. This is native file/update integration, not a booted OS image.

The fixture health port is explicitly declared isolated evidence; it does not
initialize a physical camera, exercise gimbal motion, load a real kernel or
measure physical local interfaces. Unknown health remains pending. An unavailable
private artifact HTTP source cannot force an already downloaded healthy local
trial to roll back. Current preflight, concurrent ownership, corrupted bytes,
changed signature and configured native slot pressure are negative gates.

Abrupt process tests use actual SIGKILL after image fsync, rename, trial and local
confirmation. A fresh owner must recover complete staged files without automatic
trial, preserve the original operation and report one installation after explicit
recovery. These exercise kernel process/SQLite/file behavior. They do not model
storage controller brownout or prove physical boot/reset or power-loss durability.

Clean source `445d9c50e1252aa7258091ae14600fee0446f051` on the merged issue #69
main baseline passed 13 forced edge/dependency build, lint and typecheck tasks.
All 34 update tests passed serially, including the 18 native Linux scenarios and
existing range/budget/audit/trust/migration/recovery regressions. The four abrupt
process cases passed after actual SIGKILL. Validation used Node 24.19.0 on the
isolated Linux development host; fixture clocks and health remain declared test
inputs. The evidence-only follow-up changes no tested implementation.
Physical Pi 3A+/cabinet-edge storage/boot layout, OS architecture, complete kernel/
root recovery, secure boot, real local health, watchdog and reimage acceptance
remain unverified. Physical installation remains disabled.
