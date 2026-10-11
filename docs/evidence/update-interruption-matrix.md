# Host update interruption evidence

[#78](https://github.com/gredice/arbi/issues/78),
[guide](../software/update-interruption-evidence.md),
[ADR-0043](../decisions/0043-host-update-interruption-evidence.md).

The repeatable runner produces versioned, secret-free measurements from actual
host sockets, immutable native SQLite and signed Linux application files.
Pico slots, local health, update-safe conditions and configuration are declared
isolated references. No physical board, bootloader, kernel/root image boot,
power cutoff, actuator output or loaded rig was exercised.

Nine cases check original operation recovery, independent HTTP/application/audit
payload equality, receipt coverage, current authority, mixed-version recovery
and canary halt. Four actual child-process SIGKILL cases check fresh native owner
recovery at image fsync, rename, trial and confirmation. The measured host
durations are not physical reset/stop or storage brownout guarantees.

A generated report and clean source/check results are linked after validation.
Mandatory physical gates remain blocked under #44, #71, #76 and #79. The
source matrix cannot authorize field updates or close the hardware-dependent issue.
