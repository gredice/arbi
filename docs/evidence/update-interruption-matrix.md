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

The [generated clean-source report](update-interruption-matrix.json) identifies
968a53cd671cb7e6ce3b4b808092f73dc437af19, dirty false, Node 24.19/x64 Linux
and compiled source digest b85ef708f42fa06cb01ec74d1079c51313991553306389e30c0cb3361e314fad.
It records 70000 bytes for truncated download/recovery and 78192 bytes for a
rejected 8192-byte attempt plus the 70000-byte retry. All reported charges match
independent HTTP response payload and audit counts; receipts and sequence gaps
are zero. The failed pod canary rolls back with zero edge installation.

The clean source passed 13 forced build/lint/typecheck tasks and all 58 update
tests serially in 75.994 seconds, including the new matrix and the existing
preflight, trust/migration, range/budget/audit, native Linux and SIGKILL tests.
A separate report generation ran all nine cases and four kills on the same
clean source. Its native kill/recovery durations were 1769.85–1900.80 ms on
this host; no physical timing is inferred. Documentation links and whole-tree
whitespace pass. The evidence-only follow-up changes no tested source.

These host records supply no physical evidence and name no qualified
physical reviewer. Hardware, bootloader, electrical/structural and installed
configuration acceptance remain missing. Canary halt is proven only for the
one isolated ordered operation, not a fleet deployment.
