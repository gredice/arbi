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
fa8914df42a5dd5a17d16320f53ab9c5fbdfab0b, dirty false, Node 24.19/x64 Linux
and compiled source digest b9e9f5b1cb0f930471e3cf6e97e1175148b526a774563dd67c6c51756f6fafd5.
It records 70000 bytes for truncated download/recovery and 78192 bytes for a
rejected 8192-byte attempt plus the 70000-byte retry. All reported charges match
independent HTTP response payload and audit counts; receipts and sequence gaps
are zero. The failed pod canary rolls back with zero edge installation.

The clean source passed 13 forced build/lint/typecheck tasks and all 58 update
tests serially in 75.994 seconds, including the new matrix and the existing
preflight, trust/migration, range/budget/audit, native Linux and SIGKILL tests.
A separate report generation ran all nine cases and four kills on the same
clean source. The individual native kill/recovery durations are recorded in the JSON; no physical timing is inferred. Documentation links and whole-tree
whitespace pass. The source-binding follow-up passed 13 forced build/lint/typecheck tasks,
19 matrix/native-target tests in 50.079 seconds, and separate report generation
on clean source. The runner rebuilds before importing measured modules and
rejects dirty source or changes during measurement.

These host records supply no physical evidence and name no qualified
physical reviewer. Hardware, bootloader, electrical/structural and installed
configuration acceptance remain missing. Canary halt is proven only for the
one isolated ordered operation, not a fleet deployment.
