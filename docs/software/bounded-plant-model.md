# Bounded plant and module model 1.0

**Implemented source/host simulation for [#34](https://github.com/gredice/arbi/issues/34), not physical validation.** The additive `arbi.plant/1.0` boundary in [@arbi/simulation-core](../../packages/arbi-simulation-core/README.md) extends the offline development slice with bounded cable/drum references and configurable local modules. It grants no cloud/browser/device control authority. The existing [scenario 1.0](scenarios.md) fixtures, golden traces and independent consumers keep their original affine-only semantics.

## Inputs and portable boundary

[PlantScenario and module interfaces](../../packages/arbi-simulation-core/src/plant-types.ts) and [closed runtime validation](../../packages/arbi-simulation-core/src/plant-validation.ts) define the model contract. The `context` borrows scenario 1.0 identity, units, frames, clock, seed, gate and initial state. Validation delegates these and ordinary protocol messages to the accepted `validateScenario` boundary using an internal structural scaffold; this is not a scenario 1.0 result or a replacement for its expected-output check. Plant expectations are checked separately.

The identity binds protocol, configuration/calibration/geometry revisions and digests, reference-vector content and frames. Production realms, hardware configurations, unsupported versions, nonfinite values, cycles, getters, unknown fields, oversized/deep input, off-grid events, ambiguous order and more than 256 events/512 ticks fail. The same 262,144-byte input limit applies. No deployment credentials or actual site data are inputs to the supplied fixtures.

`PortablePlantModules` defines motion, local input, camera/gimbal and pod-power methods using shared protocol body/vector/sample types. It has no simulator-only identity or scenario command format. A later local adapter can implement these methods for comparison; these interfaces are caller contracts, not a sandbox for untrusted JavaScript. Only [synthetic implementations](../../packages/arbi-simulation-core/src/plant-adapters.ts) are supplied. Call `validatePlant` before constructing modules directly; `runPlant` always validates first. No physical adapter is registered or enabled.

The [runner](../../packages/arbi-simulation-core/src/plant.ts) uses the shared protocol `admitCommand`, configuration-bound command checking and outcome-transition references. Failed admission/configuration/state/timing checks do not commit a receipt, dispatch a module or consume module latency randomness. Duplicates return cached admission without a second dispatch. New remote work is rejected when disconnected, while admitted work and local fault/stop handling need no cloud. A fault remains latched after its disturbance is removed. There is no reset/update permission, actuator endpoint or firmware path.

## Parameters and reference calculations

All parameters are synthetic, unmeasured inputs, bounded by the validator. They must not be presented as surveyed geometry or measured module characteristics.

| Module | Inputs and behavior |
| --- | --- |
| Site/cables | Accepted configuration anchor coordinates, workspace/uncertainty margins and calibrated cable offsets; Euclidean cable length at the common Cartesian reference time |
| Drums/drivers | Per-line constant radius in mm, integer steps/revolution, signed direction, zero payout, minimum/maximum payout and maximum pulse rate; configurable enable/fault, start delay/jitter and stall |
| Local inputs | Independently injected home/limit/dock values, each configured as unavailable or virtual input; no coordinate-derived sensor |
| Pod power | Synthetic voltage and availability, minimum/maximum operating voltage and startup interval; a voltage fault stops work and restoration does not clear Fault |
| Gimbal | Commanded pan/tilt, angular rate, latency/jitter and settling interval; cancellation keeps the outstanding settling interval |
| Camera | Bounded latency/jitter and injected failure; only a synthetic completed capture counter/resource command, no image bytes |
| Disturbances | Explicit uint32 seed, position-noise amplitude in mm, voltage-noise amplitude in V and ordered faults/input changes |
| Dock | Synthetic approach target/tolerance, debounce and timeout; designated existing move command IDs describe return intent in this model only |

Cable payout is `sqrt(dx² + dy² + dz²) + calibration offset`. Drum pulse estimate is `floor(direction × (payout − zeroPayout) × stepsPerRevolution / (2πradius) + 0.5)`. Reverse mapping reports quantized payout separately; it does not reconstruct actual pod position. Rounding ties go toward positive infinity, including negative directions. Entire affine segments are checked using the closest point to each anchor for minimum payout and endpoint maxima for maximum payout. The conservative cable-speed bound is Cartesian speed; requests exceeding any configured pulse rate fail.

Motion uses the existing affine trajectory reference with one delayed start and one shared duration for all four lines. Reference lengths are mapped at each tick; these are estimated pulse targets, not emitted STEP pulses or observed encoders. Duration is distance/speed rounded up to the virtual step, with at least one step. There is no acceleration ramp or braking model. A stall suppresses progress until removed; resumption samples the original elapsed reference, not a physical recovery trajectory.

## Timing, sequences and invariants

Events are sorted by `(atMs, order)`. At each tick deadline/max-duration expiry runs first, then all ordered inputs (including local protection and stop), then module progress, then telemetry sampling. This differs deliberately from scenario 1.0's advance-before-events convention and is owned by the separate plant version. A fault or stop on the completion tick prevents completion. A command on that tick still sees the preceding busy state; schedule a follow-up on the next tick. Deadlines must be strictly later than the worst-case completion; completion exactly at `maxDurationMs` is allowed. Worst-case configured jitter, settling and dock timeout are checked before dispatch.

Nominal imaging is move → completed reference move → explicit stop → gimbal/settle → capture. Gimbal and capture requests fail while motion or another module is active. Capture waits for the configured settling interval even after gimbal cancellation. Capture completion requires unchanged estimated position. Synthetic autofocus, image processing, upload, preview and recording are not implemented.

A designated return move enters Returning, then Docking after reference arrival. Parked requires all of:

1. Arrival within the synthetic dock tolerance.
2. An independent false dock observation during this return.
3. A fresh true transition while Docking, followed by the configured debounce interval without a false reading.
4. Healthy local power/driver/limit state and completion before the bounded timeout/deadline.

An unavailable, stuck-true, premature, bouncing or lost dock input cannot maintain Parked. Sensor contact never comes from target coordinates, home inputs or drum estimates. An initial scenario Parked label is treated as Ready because it supplies no dock evidence. This synthetic Parked label does not prove latch retention, tension, all-line clearance or safe reboot/update authority. Departure/release/homing procedures remain separate physical/runtime work.

The model derives workspace, truthful-feedback, independent-dock, stationary-capture and bounded-trace invariants. Tests also verify rejected-no-dispatch behavior, stop cancellation, local offline fault handling and timing boundaries. These are software assertions only.

## Telemetry, reproducibility and evidence

Every report identifies `arbi.plant/1.0`, fidelity `bounded-affine-modules-no-dynamics`, synthetic-host evidence, bound configuration/reference identity, raw parameters and explicit assumptions. Estimated reference position, virtual noisy position, cable/drum estimates and commanded gimbal angles are separate fields. Encoder feedback is unavailable. Local virtual inputs carry `quality: estimated`, `origin: virtual-input` and their independent input timestamp; they are never physical measurements. Home does not establish homing or position permission.

Configured unavailable position, tension or power signals stay unavailable with null value/timestamps and their declared reason. Reported signals are supplied only as permitted estimated/commanded qualities. No tension model or physical encoder channel is invented. `feedback.valueQ6` is the integer-millionths representation of the stated sample unit; it is not a raw protocol `Sample.value`. Position noise is a virtual observation and does not alter the commanded reference or prove arrival accuracy.

The existing uint32 LCG is reused. Every accepted module operation draws exactly once for its latency, including zero jitter. Every tick draws exactly three times for virtual x/y/z noise, including zero amplitude. Voltage-noise events draw once, including unavailable power. Jitter is `floor(draw / 2^32 × (jitterMs + 1))`; latency is base plus jitter rounded up to the virtual step. Event order, rejected commands and the chosen seed therefore have explicit, testable effects. No wall time, provider response, environment secret or OS randomness participates.

All numerical telemetry is normalized with scenario 1.0's `q6`. The trace digest uses sorted-key canonical JSON of report content (excluding its digest), plus clock, seed and return IDs. For digest serialization only, every numeric parameter is also converted to q6, avoiding language-specific decimal rendering; raw parameters remain in the report and committed fixtures. The digest describes this quantized reference, not a signed raw incident bundle. Fixture IDs/expected results do not affect the trace digest.

Committed fixtures are [nominal](../../packages/arbi-simulation-core/fixtures/plant/1.0/nominal.json), [seeded delays/noise](../../packages/arbi-simulation-core/fixtures/plant/1.0/seeded.json), [out of envelope](../../packages/arbi-simulation-core/fixtures/plant/1.0/out-of-envelope.json), [unconfirmed dock](../../packages/arbi-simulation-core/fixtures/plant/1.0/dock-unconfirmed.json), [limit stop](../../packages/arbi-simulation-core/fixtures/plant/1.0/limit-stop.json) and [power loss](../../packages/arbi-simulation-core/fixtures/plant/1.0/power-loss.json). Nominal checkpoints derive from a 10 mm move at 50 mm/s plus 50 ms latency (arrival 1250 ms), a 10-degree gimbal move at 100 degrees/s plus 100 ms settle (ready 1550 ms), 100 ms capture (1700 ms), return arrival at 2000 ms and independent dock confirmation at 2050 ms plus 100 ms debounce (Parked 2150 ms). These are arithmetic expectations, not measurements.

[Focused tests](../../packages/arbi-simulation-core/src/plant.test.ts) run independent [TypeScript](../../packages/arbi-simulation-core/src/plant-runner.ts) and [Python](../../packages/arbi-simulation-core/conformance/plant.py) consumers twice per fixture and compare every normalized row, invariant and digest. Python derives its own module calculations/state machine and reuses the independent scenario Python admission/structural subset; it never receives TypeScript results or prevalidated input. It is a committed synthetic host consumer, not a complete production configuration/protocol decoder. Both reject deliberate changed seeds/checkpoints/versions/identities/limits/order and hostile files. Existing 130-case TypeScript/Python/C references and scenario 1.0 fixtures remain unchanged.

On 7 October 2026, Node 24.15.0 and pnpm 11.5.2 source/host checks passed 124 scenario/plant cases (65 preserved scenario cases and 59 plant cases) without skips. The separately invoked TypeScript/Python/C reference suite passed all 130 cases. Workspace lint, typecheck, test and build, documentation links and whitespace checks passed. Run from the repository root after pinned dependency installation; source/host checks use only synthetic committed data offline:

```sh
pnpm scenario:check
pnpm protocol:check
pnpm --filter @arbi/simulation-core plant
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm docs:check
git diff --check
```

`scenario:check` includes the new plant tests without Turbo caching. The package's `plant` CLI emits a bounded JSON report, with `--trace` for normalized rows, and verifies fixture expectations before success output.

## Limits and external gates

Omitted/unvalidated physics includes elasticity, sag, wind, payload mass, pendulum response, damping, line tension, thermal/structural behavior, helical radius variation, drum slip, quantized closed-loop pose, driver torque, acceleration, braking and loss-of-power restraint. Noise, latency, gimbal rate and settling parameters are synthetic and unmeasured. No PID/learned controller, real firmware, physical autofocus/camera pipeline, dashboard visuals, provider integration or physical acceptance is claimed.

[#62](https://github.com/gredice/arbi/issues/62) owns later real web/cloud/edge integration; [#54](https://github.com/gredice/arbi/issues/54) owns richer replay and model/measurement comparison. Recording [#68](https://github.com/gredice/arbi/issues/68) remains disabled/deferred. [ADR-0004](../decisions/0004-simulator-boundary.md), [ADR-0005](../decisions/0005-software-architecture-and-deployment.md), [ADR-0006](../decisions/0006-local-safety-authority-and-instrumentation.md), the [dock](../assemblies/dock/README.md), [imaging](../operations/imaging-and-calibration.md) and [commissioning gates](../operations/prototype-and-commissioning.md#local-safety-and-update-gates) still require separate provider, bench/HIL, installed-system and qualified physical evidence. Neither simulation success nor Parked clears those gates.
