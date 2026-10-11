# ADR-0032: Calibrated gimbal source model

Status: Proposed for source review; physical servo and capture activation unavailable.

Work record: [#42](https://github.com/gredice/arbi/issues/42). Foundation: [pod runtime](0026-inhibited-pod-service.md).

## Context

Approximate design angles cannot establish ribbon clearance or calibrated travel. Time elapsed after an angle command cannot establish measured settling. Main motion, leases and module epochs must remain local interlocks.

## Decision

Add an application-owned trusted synthetic gimbal model without enabling a command on the ordinary pod listener. Consume actual shared command admission and configured-command compatibility, a locally applied pod configuration and a matching private calibration. Validate per-axis reference/direction, bounded PWM endpoints, travel limits and velocity, configured safe pose and a named synthetic settling interval. Narrow private axis limits may never widen the accepted configuration. The deterministic servo sink has no electrical/device callback.

Require explicit synthetic known-pose reconciliation; startup never sweeps, homes or adopts a zero pose. Repositioning needs fresh stopped evidence bound to the current motion epoch, generation, configuration, calibration and ordered sequence. Reject stale/reordered/wrong proofs, leases, deadlines, replay and conflicting identities. A finite non-evicting admission ledger preserves cached outcomes without dispatching duplicates; exhaustion requires a fresh boot rather than forgetting accepted identities. An interruption invalidates the pose and requires deliberate reconciliation.

Travel duration respects each axis's velocity bound. Capture eligibility requires a complete fresh multi-sample within-tolerance settling window after modeled travel; missing, repeated, reordered or unstable samples cannot manufacture it. Current stop and authority evidence remain required after settling. Expose commanded/unavailable pose, safe-motion-pose status and explicitly synthetic eligibility. Physical capture eligibility and measured settling are always false.

## Consequences

This supplies a concrete adapter for later [capture sequencing](https://github.com/gredice/arbi/issues/53) and local orchestration, without claiming a physically calibrated range or accepted duration. Normal main motion must consume the configured safe-pose gate and may never reposition during a gimbal operation. A physical adapter remains unavailable until range, PWM/reference policy, ribbon/cap clearance, repeatability, representative settling and local motion sequencing have named accepted evidence. See the [guide](../software/gimbal-model.md) and [evidence](../evidence/gimbal-model.md).
