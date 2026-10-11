# Local controller recovery source evidence

Work record: [#67](https://github.com/gredice/arbi/issues/67). Decision: [ADR-0028](../decisions/0028-simulation-only-local-controller-recovery.md). Implementation: [guide](../software/local-controller-recovery.md).

Host fixtures run the same C input, motion, homing and local recovery sources as the pinned target link-check. Three new groups cover finite commanded completion; old source/target epochs, identities, fences, command IDs and sequences; expired commands and fixed ledger exhaustion; running versus idle edge loss, manual/trajectory expiry and deliberate recovery; partial completion; 100,000 atomic fault signals from a host thread; logical loop stalls, clock reversal, changed configuration, alarm and simulated brownout/reset with diagnostic-only prior-boot history.

Tests inject local monotonic time and digital/reference fixtures. A loop-stall fixture advances virtual time beyond the owner budget; atomic thread load demonstrates the source latch and fixed storage. Neither establishes an actual interrupt latency, parser-load worst case, hardware watchdog timing or physical stopping response. The clean revision and target/sanitizer results are recorded after the implementation commit.

| Required evidence | Status |
| --- | --- |
| Deadline, replay/fencing, reset and recovery source model | Explicit host fixtures; simulation only |
| Actual GPIO/interrupt fault path and reset output circuitry | Unavailable; no real adapter |
| Isolated-board parser/interrupt/main-loop load and watchdog bounds | Unavailable; no attached board or instrument traces |
| Secured loaded response, independent isolation and hard limits | Unavailable; no selected or measured physical stop response |
| Power-loss four-line clearance and qualified installed recovery | Unavailable; LS-18 gate remains unresolved |

#67 remains open. No physical stop/hold/disable result, real reset-cause measurement, reviewer sign-off, retained power-loss diagnostics or actuation authority is claimed.
