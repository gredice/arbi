# Deterministic scenarios 1.0

[Issue #25](https://github.com/gredice/arbi/issues/25) implements the foundation of [epic #10](https://github.com/gredice/arbi/issues/10): a [closed scenario schema](../../packages/arbi-protocol/schema/scenario.schema.json), [generated consumed types](../../packages/arbi-protocol/src/scenario-types.ts), [runtime validation](../../packages/arbi-protocol/src/scenario.ts), and a working [offline core and runner](../../packages/arbi-simulation-core/README.md). This is an analytical reference model and host software evidence. It grants no local/remote device authority and clears no commissioning or update gate.

## Contract and identity

`arbi.scenario/1.0` is an offline fixture format, additive to protocol `arbi/1.0` and configuration `arbi.configuration/1.0`. All objects are closed; unknown versions and fields fail. Units are mm, deg, mm/s, mm/s², N, ms and V. Frame identities directly reuse the accepted site/gimbal definitions. Operating-state and command-outcome definitions reference the canonical message schema; generated types select the corresponding discriminated event branches. Commands remain complete protocol messages, including raw source times, identities, decimal uint64 sequences/fences and receiver-monotonic deadlines.

Each scenario binds the exact configuration revision/content digest, geometry/calibration revisions, site/gimbal frames and SHA-256 of the committed [reference vectors](../../packages/arbi-protocol/fixtures/reference/1.0/vectors.json). The [configuration fixture](../../packages/arbi-protocol/fixtures/configuration.json) is loaded by both consumers, never copied into scenario data. Both also directly exercise their existing independent [reference-vector implementations](reference-fixtures.md). Digests identify content and provide no authentication.

Model, controller and runner each carry an ID, revision and build ID. Version 1.0 accepts only the implemented `arbi.affine-reference`, `arbi.protocol-reference` and `arbi.offline-runner` revisions/builds listed in `SCENARIO_IMPLEMENTATION`; those IDs name this synthetic host implementation, not a measured plant, deployed release or firmware artifact. Evidence is explicitly `synthetic-host-reference`, with `affine-kinematic-no-dynamics` fidelity. A future model/build needs a reviewed contract implementation and fixtures rather than relabeling this model.

The configuration must be nonproduction with simulation execution/calibration scope. A scenario cannot load a production identity as a fallback. Initial estimated position must lie inside the accepted workspace after calibration uncertainty margins; gimbal targets must satisfy configured bounds. Fault state must agree with the initial driver/power condition. A powered rail needs positive voltage. Configuration/calibration mismatches, stale frames, impossible conditions and invalid command structure return explicit errors before running.

## Clock, event order and seed

Time is integer virtual milliseconds in one declared host domain; source clocks inside recorded commands are not subtracted from receiver time. Start is at most 1,000,000 ms; duration at most 60,000 ms; step is 1–1,000 ms. Duration must divide by step. The inclusive start/end loop has at most 512 ticks. Every input and checkpoint lies on that grid. There are at most 256 inputs, 64 trajectory vectors and 64 outcome-transition vectors. Unsupported off-grid events fail rather than being silently rounded.

Inputs are sorted by `(atMs, order)`; duplicate pairs fail `ORDER_CONFLICT`. Array position and JSON property order never decide simultaneous behavior. At each tick the runner handles deadline expiry before advancing the existing trajectory, applies all inputs in explicit order, then samples. Thus a fault with order 0 at the same time as a command with order 1 rejects that command; swapping explicit order changes the result. Movement completed during the advance phase may admit a new command that tick. Removing a driver/power disturbance never clears a latched `Fault`.

The uint32 LCG is `state = (1664525 × state + 1013904223) mod 2^32`. Each `voltage-noise` input takes exactly one draw, even at zero amplitude or with unavailable power. The applied delta is `(2 × state / 2^32 - 1) × amplitudeV`, bounded to ±5 V with a floor of zero. This perturbs only a synthetic voltage estimate. It does not create a voltage sensor. Seed 42 begins with 1083814273, 378494188, 2479403867, 955863294 in independent arithmetic anchors. No wall clock, OS randomness, locale, network response or credential environment participates.

## Model, adapters and truthful values

The implemented [adapter methods](../../packages/arbi-simulation-core/src/adapters.ts) separate virtual time, motor/driver movement and faults, telemetry/local sensors, pod/gimbal/capture and power. Only simulated implementations are provided. Home/limit/dock, physical position and tension feedback remain unavailable. Gimbal angles are commanded values; position/cable geometry and rail voltage are estimates with a simulated origin. A simulated capture increments a counter and produces no image bytes or autofocus/settling claim.

The motor model uses affine interpolation: `p(t) = start + (target - start) × min(elapsed/duration, 1)`. Duration is the Euclidean move distance divided by requested speed, rounded up to the next virtual step, with a minimum of one step. A move must fit its maximum duration and complete strictly before the receiver deadline. Cable targets are Euclidean anchor distances plus accepted calibration offsets. Analytical trajectory vectors cover negative axes, fractional positions, start/end and clamping after completion. The 56 outcome vectors independently cover all pairs of null/seven current states and seven next states, including forbidden transitions and idempotent terminal observations.

TypeScript uses the accepted protocol admission and configured-command checks. The independent Python consumer derives the supported command subset itself. This runner supports move, stop, gimbal and capture only. It applies actor/source/realm/site/target/configuration, lease/fence, sequence, idempotency, lifetime and configured bounds before dispatch. A failed admission never consumes a receipt or dispatches an adapter. Duplicate accepted commands return cached admission without another dispatch/lifecycle. Busy-state, out-of-envelope and disconnected-cloud requests are rejected. Stops remain available during disconnection/fault and do not clear a fault or infer restraint.

An already admitted finite reference move may finish locally after cloud loss, while new remote work is rejected. Its deadline still stops a stalled adapter without cloud participation. This tests host orchestration only; it is not a manual-session resume policy or evidence of motion safety. Actual edge/Pico command liveness and local protection remain independently owned.

## Normalization and invariants

Position, cable length, angle and voltage numeric outputs are represented by safe integer millionths of their stated units: `q6(v) = floor(v × 1,000,000 + 0.5)`. Ties round toward positive infinity; negative zero becomes zero; nonfinite/unsafe outputs fail. Calculations use IEEE-754 binary64, sum squared coordinate differences in x/y/z order and do not use fused multiply-add or intermediate rounding. This is trace quantization, not physical precision. Golden analytical vectors use the accepted tolerance `1e-7 + 1e-12 × abs(expected)` in their unit; normalized checkpoint and digest comparisons are exact.

Trace rows keep virtual time/state, estimated position/cable lengths, cloud/power/driver conditions, gimbal targets, synthetic captures, PRNG state, per-tick outcomes/rejection codes and actual dispatched command IDs. Normalized trace digests are SHA-256 of sorted-key canonical JSON containing scenario version, bound identity, provenance, clock, seed, trace and derived invariants. Arrays retain semantic order; only input events are sorted before execution. Expected outputs are excluded from the digest. Scenario labels are excluded, so renaming a fixture does not alter its numerical behavior. Exact raw inputs remain committed in the fixture; the trace is not an incident bundle or signed record.

The runner derives five invariant outcomes:

- `within-workspace`: every estimated position respects configured uncertainty margins.
- `truthful-feedback`: default position/tension and home/limit/dock readings remain unavailable; supplying fabricated measurement feedback fails this host invariant.
- `rejected-no-dispatch`: rejection introduces no adapter dispatch.
- `local-progress-offline`: an active reference trajectory advances without cloud connectivity; a stalled injected adapter fails it.
- `bounded-trace`: the trace never exceeds the validated tick budget.

These are software/model invariants, not tension, clearance, braking or update-safety assertions. Vacuous cases with no movement/rejection satisfy the corresponding invariant; fixtures explicitly exercise the relevant behavior as well.

## Fixtures and independent evidence

Committed scenarios are [healthy](../../packages/arbi-protocol/fixtures/scenarios/1.0/healthy.json), [rejected command](../../packages/arbi-protocol/fixtures/scenarios/1.0/rejected-command.json), [disconnected cloud](../../packages/arbi-protocol/fixtures/scenarios/1.0/disconnected-cloud.json), [driver fault](../../packages/arbi-protocol/fixtures/scenarios/1.0/driver-fault.json) and [power loss](../../packages/arbi-protocol/fixtures/scenarios/1.0/power-loss.json). Each has analytical trajectory/outcome vectors, independently calculated checkpoints and a reviewed normalized digest. Digests may be refreshed only after reviewing behavioral changes and independent consumer agreement.

The [TypeScript tests](../../packages/arbi-simulation-core/src/conformance.test.ts) execute [TypeScript](../../packages/arbi-simulation-core/src/runner.ts) and [Python](../../packages/arbi-protocol/conformance/scenario.py) directly on the same files. Each independently validates its input, derives its own kinematics, command/state transitions, PRNG samples, trace and digest, and compares golden expectations. Python never receives TypeScript-produced results or prevalidated inputs. It uses only the standard library, runs with `-I -B`, and implements the closed scenario structural subset plus selected command semantics. It is not a complete production message/configuration decoder. Both depend on the accepted committed ASCII/integer configuration subset; normalized trace content is ASCII and safe integers. Existing Python reference calculations remain independent of TypeScript.

Every fixture is run twice in each consumer, requiring identical reports, digests and invariant outcomes, then the independently derived full traces are compared. Both reject 25 deliberate discrepancies: version/units/frames, configuration/calibration/reference identity, unsupported models, impossible initial states, tick/event bounds, ordering collisions, altered cable/trajectory/transition/invariant results, changed seed/noise ordering, deadline identity and uint64 overflow. Reordered input arrays and properties preserve results. Raw oversized/deep/malformed files fail with bounded named errors and no success report. The [protocol boundary tests](../../packages/arbi-protocol/src/scenario.test.ts) also reject cycles, accessors without executing them, nonfinite numbers and non-JSON prototypes. JSON input is bounded at 262,144 UTF-8 bytes, depth 32 and 20,000 nodes before recursive schema/hash work; errors return a bounded code/path without echoing input.

On 7 October 2026, source/host validation used Node 24.15.0 and pnpm 11.5.2 against the merged protocol/configuration, audit, release and enrollment baseline. Protocol tests passed 460 cases, including the preserved 130-case TypeScript/Python/C reference suite. Scenario tests passed 65 cases with no skips. The supplied packages have no provider/hardware imports, endpoint settings or secrets; child consumers inherit only executable path, temporary directory and fixed locale settings. Required tools missing from PATH fail the suite.

```sh
pnpm scenario:check
pnpm protocol:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm docs:check
git diff --check
```

Standard workspace tests include these host tests; [CI](../../.github/workflows/ci.yml) also runs `scenario:check` without Turbo test caching. A fresh checkout needs pinned dependencies installed; scenario execution after that is offline.

## Limitations and external gates

This model contains no elasticity, sag, wind, mass, damping, drum/STEP quantization, driver torque, acceleration ramp, tension, global feedback, physical camera pipeline or PID tuning engine. Affine velocity changes do not enforce the configuration's physical acceleration bound and must never be interpreted as an acceptable real trajectory. Initial `Ready`/`Parked` is a synthetic starting state, not homing, dock sensing, local permission or update-safe reboot evidence. Source checks and deterministic host simulation do not establish sensor availability, physical tension/position, motion safety, execution on a target host, provider integration, bench/HIL, installed operation or qualified physical acceptance.

The additive [bounded plant/module model 1.0](bounded-plant-model.md) implements [#34](https://github.com/gredice/arbi/issues/34) separately, preserving the scenario 1.0 semantics above. Real web/cloud/edge integration [#62](https://github.com/gredice/arbi/issues/62), visual simulator/dashboard pages and firmware remain separate. Recording [#68](https://github.com/gredice/arbi/issues/68) remains deferred and disabled. [ADR-0004](../decisions/0004-simulator-boundary.md), [ADR-0005](../decisions/0005-software-architecture-and-deployment.md), [ADR-0006](../decisions/0006-local-safety-authority-and-instrumentation.md) and the [commissioning gates](../operations/prototype-and-commissioning.md#local-safety-and-update-gates) retain their accepted boundaries.
