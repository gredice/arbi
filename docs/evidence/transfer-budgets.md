# Transfer budget and artifact recovery host evidence

- Date: 2026-10-11
- Work record: [#45](https://github.com/gredice/arbi/issues/45)
- Revision: source/tests in this PR; its merge commit identifies the accepted revision
- Host: isolated Linux x86-64, Node 24.19.0, pinned pnpm 11.5.2, native SQLite
- Inputs: synthetic site, policy and clocks; temporary private files; no live credentials

Edge build, lint/typecheck, documentation links and whitespace checks passed. The
focused transfer suite passed 13/13 assertions, including native SIGKILL recovery.
The edge/realtime/commissioning regression slice passed 42/43 assertions; the existing
systemd test cannot execute because `/usr/bin/node` is absent on this host. The PR's
Linux CI runs the full edge and downstream suites, including that service check.

The [transfer suite](../../apps/arbi-edge-controller/src/transfers/transfers.test.ts)
uses a 1,000-byte discretionary allowance, 200-byte essential reserve, separate
400/100-byte per-second caps and two/one active slots. Atomic competing reservations,
duplicate/conflicting IDs, a second live process owner and exhausted/unknown coverage
are checked. Partial attempts replace maximum debits with observed attempted bytes;
exact covered charge IDs reconcile against reported usage without double counting.

Reopen and SIGKILL after attempt admission retain debit, attempt count, paused state,
rate-window consumption and accepted offsets. Firmware ranges resume from 100 bytes
and verified cache reuse performs zero extra transport calls. Tests reject oversized
segments, repeat retries beyond the configured cap, bad digests and full cache storage;
uncommitted file tails are truncated. Current operator authority, class scope, expiry
and durable attributable audit are checked for overrides. Fresh viewer intent cannot
extend total stream duration, idle or bitrate limits. Upload windows, stale coverage
and unreliable/regressed clocks produce explicit denial/defer reasons.

These are deterministic scheduling and filesystem/process tests. No actual cellular
saturation, carrier billing, privileged router/kernel shaping, selected hardware,
storage power interruption or physical firmware installation was exercised. The
owning WAN adapter must use grants and trusted receipt/checkpoint bindings; ordinary
runtime composition starts none. Physical control/watchdog paths remain independent.
