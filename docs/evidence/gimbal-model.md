# Gimbal source evidence and physical gates

Work record: [#42](https://github.com/gredice/arbi/issues/42). [Decision](../decisions/0032-simulation-only-calibrated-gimbal.md), [guide](../software/gimbal-model.md).

Eight deterministic groups exercise actual configuration apply/compatibility and protocol command admission, bounded endpoint PWM mapping, invalid calibration/frames/angle and velocity deadlines, duplicate/conflicting/reordered/expired commands, old receiver epochs, wrong/stale/reordered stopped evidence, missing/repeated/reordered/unstable servo samples, lease/stop loss after settling, timeout, clock reversal, finite-ledger exhaustion, adapter exceptions, safe pose retained during normal main motion and no automatic restart motion. They use the actual gimbal model and synthetic servo sink. Clean revision and full pod checks are recorded after implementation.

| Required physical evidence | Status |
| --- | --- |
| Pod/gimbal/servo/ribbon/cap revisions and instrument uncertainty | Unavailable; no target hardware attached |
| Accepted calibrated travel/reference direction/PWM and ribbon/cap clearance | Unverified; fixture angles are configuration examples |
| Repeated representative movement/lighting, repeatability and measured settling | Unavailable; fixture 30 ms is explicitly synthetic |
| Real main-stop, local interlock, restart and interrupted servo behavior | Unavailable; no electrical adapter enabled |
| Autofocus/capture after measured settling on the tested revision | Blocked pending the above evidence and camera work |

#42 stays open. Source checks cannot close physical acceptance or enable physical camera/servo operation.
