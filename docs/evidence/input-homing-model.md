# Input and homing model source evidence

Work record: [#59](https://github.com/gredice/arbi/issues/59). Decision: [ADR-0027](../decisions/0027-unavailable-real-inputs-and-homing-model.md). Implementation: [guide](../software/input-homing-model.md).

Codex-executed host checks exercise the same C input/homing/pulse core as the pinned target cross-build. The data is an explicitly simulated digital fixture, not a GPIO, voltage, cable-failure, physical repeatability or stopping measurement. The input model marks every real interface unavailable.

Three groups exercise stable/bouncing/stale/out-of-order input, immediate simulated critical assertion and debounced release, persistent input faults, independent dock/latch values, invalid policies and rejection of a real-hardware record; nominal and initially-active coordinated four-axis release/seek/backoff/slow-seek with bounded one-step plans; and stuck-on/off, disconnected, contradictory, alarm, limit, missing, stale, timed-out, changed-revision and implausible-reference refusal. Simulated completion never asserts Ready or Parked. Existing diagnostic, pulse and geometry suites remain regressions.

The clean tested revision, normal/sanitizer counts and both target-link branches are recorded after the implementation commit. Target linking and fixture success are source evidence only.

| Required gate | Current evidence |
| --- | --- |
| Bounded input and homing logic | Explicit source/host fixtures |
| GPIO, voltage/isolation, polarity and cable-failure circuit | Unavailable; proposed requirements only, no reviewed circuit or adapter |
| Actual alarm, independent hard limit, tension and enable protection | Unavailable; no defaults turn reserved conductors into safeguards |
| Named wiring/hardware secured homing repeatability/failure record | Unavailable; no board or rig attached |
| Measured HOME / Ready / Parked and loaded actuation | Disabled; simulated references clear no physical gate |

The issue remains open for its required circuit review and named secured wiring/rig evidence. No reviewer sign-off, electrical test or mechanical acceptance is supplied.
