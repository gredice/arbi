# Manual control host/simulation evidence

- Date: 2026-10-11
- Work record: [#50](https://github.com/gredice/arbi/issues/50)
- Revision: source/tests in this PR; the merge commit identifies the accepted revision
- Setup: isolated Linux x86-64 host, Node 24.19.0, pinned pnpm 11.5.2, native Node SQLite,
  committed bounded plant/configuration fixtures; no deployment credentials or physical outputs
- Reviewer: automated assertions and PR review; no qualified physical reviewer

The [manual suite](../../apps/arbi-edge-controller/src/jobs/manual.test.ts) checks missing
or stale human intent, replayed/reordered packets, concurrent operator handover, retired
fences, source UTC jumps, release-before-dispatch, current capability/interlock/configuration
gates, Internet loss, changed receiver/module epochs, clock rollback, journal reopen and
attributable bounded audit handoff. Original job expiry remains 1,500 ms despite fresh
pulses. Every restart exposes no active lease and no new simulator dispatch.

Validation on this host: edge lint, typecheck and build passed; all 24 focused
manual tests passed, including SIGKILL after dispatch. The existing jobs/manual
suite passed 119 assertions, including its full crash-boundary matrix. The complete
edge suite passed 162 of 163 assertions; its existing Linux service-definition test
could not run because this host has no `/usr/bin/node` and the system directory is
not writable. That environment failure remains visible and the PR's Linux CI must
verify the service definition. Documentation links and whitespace checks passed.

The synthetic deadman is 250 ms and the virtual tick interval 50 ms. Exact-boundary
tests close the session at 1,250 ms after the accepted pulse at 1,000 ms, with zero
sample overshoot. Separate tests hold a gesture admitted but unsent, release it and
prove no later dispatch; packet retry returns the failed historical result. These
are virtual schedule and source assertions, not measured servo/motor stop latency.

Physical MCU expiry/watchdog, event-loop/kernel/device latency, selected cabinet host,
signal/wiring interfaces, storage power loss, loaded motion, independent stopping and
restraint remain unverified. The adapter still exposes `physicalActuationEnabled:false`.
Source/CI success cannot enable a physical endpoint or clear commissioning/update gates.
