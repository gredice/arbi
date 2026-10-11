# Gimbal source evidence and physical gates

Work record: [#42](https://github.com/gredice/arbi/issues/42). [Decision](../decisions/0032-simulation-only-calibrated-gimbal.md), [guide](../software/gimbal-model.md).

Eight deterministic groups exercise actual configuration apply/compatibility and protocol command admission, bounded endpoint PWM mapping, invalid calibration/frames/angle and velocity deadlines, duplicate/conflicting/reordered/expired commands, old receiver epochs, wrong/stale/reordered stopped evidence, missing/repeated/reordered/unstable servo samples, lease/stop loss after settling, timeout, clock reversal, finite-ledger exhaustion, adapter exceptions, safe pose retained during normal main motion and no automatic restart motion. They use the actual gimbal model and synthetic servo sink.

Clean source `f5806b648981a74e29ddcf1bd78d9fbef3d82391` reports `dirty=false`. Linux x64/Node 24.19.0 passes all 18 pod groups, including the eight gimbal groups and the foundation's actual TLS, SQLite, startup cancellation and killed-process restart checks. Build, TypeScript lint/typecheck, documentation links and whitespace pass. The synthetic endpoints map pan 90° to 2,400 µs and tilt −60° to 900 µs; the modeled 180°/s bound requires 500 ms pan travel, followed by separate fresh samples spanning 30 ms. These are calculated fixture outputs, not measured servo pulses or physical settling.

| Required physical evidence | Status |
| --- | --- |
| Pod/gimbal/servo/ribbon/cap revisions and instrument uncertainty | Unavailable; no target hardware attached |
| Accepted calibrated travel/reference direction/PWM and ribbon/cap clearance | Unverified; fixture angles are configuration examples |
| Repeated representative movement/lighting, repeatability and measured settling | Unavailable; fixture 30 ms is explicitly synthetic |
| Real main-stop, local interlock, restart and interrupted servo behavior | Unavailable; no electrical adapter enabled |
| Autofocus/capture after measured settling on the tested revision | Blocked pending the above evidence and camera work |

#42 stays open. Source checks cannot close physical acceptance or enable physical camera/servo operation.
