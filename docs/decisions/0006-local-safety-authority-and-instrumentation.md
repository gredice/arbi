# ADR-0006: Local safety authority and instrumentation

- Status: Accepted when merged; proposed until then
- Date: 2026-10-07
- Work record: [#15](https://github.com/gredice/arbi/issues/15)
- Prerequisite: [ADR-0005](0005-software-architecture-and-deployment.md), accepted through [PR #80](https://github.com/gredice/arbi/pull/80) for [#13](https://github.com/gredice/arbi/issues/13)

## Context

This refines the local authority and physical-evidence boundary selected in ADR-0005. Its cloud/edge/pod/MCU deployment and environment-isolation decisions remain binding; this ADR owns instrumentation, independent stopping and update-safe restraint requirements.

Remote controls, camera jobs and dashboard-managed updates need a local authority that can reject requests and stop through cloud, network, process and power failures. The [safety case](../system/safety-case.md) does not yet demonstrate physical stopping or safe line clearance. The [wiring baseline](../assemblies/winch/wiring.md) terminates motor encoder feedback at the commercial drivers; the Pico receives no measured shaft position. Enable/alarm, home and independent-limit circuits remain undesigned. The [dock](../assemblies/dock/README.md) supports the pod, while powered winches currently maintain line height; a latch cannot prove reboot safety.

This ADR selects requirements and responsibility boundaries. It does not select new GPIOs, sensor products, electrical circuits, stopping categories or brake hardware, and does not validate the installed concept. Those choices require reviewed assembly/interface revisions, canonical BOM updates where applicable, and stage-specific evidence.

## Decision

### Local authority

| Boundary | Authority and obligation |
| --- | --- |
| Browser and cloud | Submit authenticated, bounded intent and display actual outcomes. Neither UI mode, an operator lease nor a signed release can override local inhibits or provide an emergency-stop guarantee. Preview/simulation credentials cannot enable installed hardware. |
| Edge controller | Own the local job/state machine, configuration/calibration identity, weather/access policy, command expiry/fencing, maintenance and update locks, and durable local records. Reject work without accepted prerequisites; coordinate the state-dependent response to faults. An unavailable cloud, budget/accounting service or audit upload must never delay stopping. |
| Pico motion controller | Independently validate the loaded motion envelope and bounded command lifetime; own synchronized STEP/DIR, local input checks, fault latching, communication deadlines, watchdog/reset handling and no automatic restart. Edge approval cannot enlarge MCU limits. |
| Pod runtime | Independently enforce calibrated gimbal limits, motion/capture interlocks, command deadlines, local watchdog/reset and power-health behavior. Pod loss inhibits dependent jobs; pod software does not authorize winch motion. |
| Commercial drivers | Own their internal motor/encoder loop and driver faults. A healthy driver does not establish line tension, pod position, independent stopping or structural safety. |
| Independent protection and restraint | Cabinet owns the emergency-isolation, hard-limit and independent-supervision design and its actuator inhibit path; winch/dock/line assemblies own mechanical restraint and load paths. These protections must remain effective through failure of the normal edge/Pico control path. The implementation and independence argument remain unverified until reviewed and physically tested. |
| Local operator and evidence reviewers | Own controlled test authorization, area clearance, lockout, inspection and deliberate recovery. Qualified electrical/structural/physical-safety review remains a separate prerequisite for the applicable installed stage. A remote acknowledgement cannot prove an area is clear. |

Use the [local safety interface matrix](../system/local-safety-interface-matrix.md) as the requirements register. Each required input/output has an assembly owner, runtime authority, endpoints, failure response and evidence gate. A normally running application heartbeat is not an independent safeguard. A watchdog reset can leave torque unavailable; its safe effect must be established together with restraint and output circuitry.

### Stop, fault and recovery semantics

1. A local stop/fault request preempts normal work, configuration activation, diagnostics, media and updates. Reject further actuator work and latch the cause locally; record it without making persistence or network success a condition of stopping.
2. Apply the reviewed response for the current state and fault: bounded coordinated deceleration, holding, independent inhibition/isolation, or restrained recovery. These are distinct actions. Stopping STEP pulses is not isolation; driver disable or power removal is not proof that a suspended load or line stays safe. Do not select one universal stop response before the load/energy analysis and measured stop tests.
3. Broken/slack lines, an alarming or unpowered axis, implausible references, loss of control authority, unknown weather or an inaccessible dock must not trigger an unconditional return-home or homing trajectory. Recovery motion needs a reviewed bounded procedure with sufficient trustworthy inputs and restraint.
4. Boot, brownout, watchdog and local-runtime restart enter an inhibited/recovery-required state. Reconcile installed revisions, configuration, references, latched faults and restraint before deliberate local reauthorization. Reconnection does not reinstate authority lost on disconnect. Never restore a previous moving state, lease or queued actuator command automatically.
5. The MCU and pod enforce their own monotonic deadlines when edge/browser/cloud communication stops. Installed operation needs demonstrated bounded responses to every relevant local-link loss; reconnect does not clear a fault. Browser loss ends manual authority, while an already accepted autonomous task may only continue if its locally approved policy and prerequisites permit it.

Numeric limits, input polarity, debounce, freshness, command/watchdog intervals and measured detection-to-stop time are **unverified**. Before each physical stage, its reviewed configuration must establish bounds, uncertainty and worst-case stopping distance/force compatible with that stage's hazard analysis. Missing values or evidence inhibit the affected capability.

### Instrumentation and truthful observations

For operational enablement, require evidenced functions for travel/reference limits, driver fault/inhibit, independent stopping/supervision, line slack/overload/clearance, position/reference confidence, electrical/power health, dock/restraint and local environmental/access permission. The matrix separates these requirements from optional debug measurements. The sensing technology and any justified alternative must be reviewed; a missing sensor cannot silently become a passing condition.

Telemetry carries source identity, units/frame, sample time and age, configuration/calibration identity, evidence stage and quality. Keep **measured**, **commanded**, **estimated**, **stale** and **unavailable** distinct; simulated data also identifies its simulated origin. Driver encoder counts, measured pod position and per-line tension are unavailable in the present Pico interface. An issued STEP count is commanded output, and a derived cable length/pose is an estimate. A driver alarm, motor current, dock coordinate or home switch cannot substitute for an unrelated measurement. Unavailable values have no numeric placeholder or last-known-good implication.

Stale, missing, contradictory or unhealthy required observations inhibit affected work and select the reviewed local response. Both dashboard modes expose the capability restriction and reason; engineering mode does not bypass it. Optional instrumentation becomes mandatory only through a reviewed requirement/interface change, with its failure response and evidence.

### Update-safe restraint and recovery

`Parked`, `DOCKED`, a commanded zero speed and release-signature verification are insufficient update authorization. Before any target restart or update, the edge must obtain the target-specific local preflight evidence and lock out conflicting work:

- no active motion/manual authority, ambiguous capture, maintenance conflict or unreviewed fault; the local controllers acknowledge inhibition under the accepted procedure;
- mechanical support of the pod and safe clearance of **all four lines**, including the powered line, through reset, driver-disable, loss of holding torque and complete/partial power loss for the whole update/recovery interval;
- positive restraint/retention confirmation or a verified local inspection under a controlled procedure, with structural capacity, slip/wear limits and isolation sequence established for the exact revision;
- accepted startup output behavior, compatible target/configuration, power/storage readiness and a tested interruption, rollback and manual recovery procedure;
- return-to-service inspection/reference reconciliation and deliberate release of the update lock, with no automatic resurrection of jobs or control leases.

The cabinet owns electrical isolation and output states; winch owns drum/shaft restraint; dock owns pod retention/release; winch-owned positioning lines and site own clearance evidence (ownership grouped by [ADR-0010](0010-corner-support-and-winch-line-ownership.md)); edge owns coordinated preflight and recovery. A brake/drum lock or other passive clearance solution may be required. The existing deferred brake entry does not satisfy the requirement. A pod/edge update also needs a specific procedure proving that its outage cannot disrupt required motion protections, gimbal safety or restraint.

Loaded/installed operational actuation and motion-controller updates remain disabled until their separate stage gates pass. Secured isolated bench/HIL actuation and flashing are permitted only within an explicitly authorized, reviewed test procedure, with actuator loads disconnected or controlled substitutes/restraint, reduced bounds, an exclusion zone and accessible isolation. Such permission is scoped to the named rig, target, revision and test; it never enables installed controls. Artifact publication/download and simulator work may proceed without granting physical installation or actuation authority.

### Evidence and follow-up ownership

The matrix and [commissioning gates](../operations/prototype-and-commissioning.md#local-safety-and-update-gates) distinguish source review, simulation, instrumented bench/HIL, secured frame, installed commissioning and qualified review. Closing #15 records this specification; it clears no physical gate. All physical evidence identified here is currently **unverified**.

| Unresolved work | Accountable boundary and existing work record |
| --- | --- |
| Reviewed input/output circuits, home/limit/alarm/dock fault detection and instrumentation selection; assembly and BOM revisions | Cabinet, winch, dock and line owners through [#59](https://github.com/gredice/arbi/issues/59); physical acceptance tracked by [#79](https://github.com/gredice/arbi/issues/79) |
| Expiry, local stop/fault latching, reset/watchdog and edge-loss timing | MCU through [#67](https://github.com/gredice/arbi/issues/67); independent cabinet safeguards require separate design/bench/qualified evidence under #79 |
| Local environmental/access permission, calibrated motion and gimbal interlocks | Edge through [#30](https://github.com/gredice/arbi/issues/30), calibration through [#40](https://github.com/gredice/arbi/issues/40), pod through [#42](https://github.com/gredice/arbi/issues/42); installed envelope through #79 |
| Restraint, line clearance, target preflight and power-loss/update recovery | Winch/dock/line/cabinet owners with edge integration through [#76](https://github.com/gredice/arbi/issues/76), interruption evidence through [#78](https://github.com/gredice/arbi/issues/78), installed/qualified acceptance through #79 |
| Truthful capabilities, calibration and evidence identity | [#16](https://github.com/gredice/arbi/issues/16), input capability evidence under #59, diagnostics through [#70](https://github.com/gredice/arbi/issues/70) |

Hardware/interface selections must land as reviewed documentation and canonical BOM changes before a real adapter enables them. These issue links assign future work; their proposals are not accepted hardware or evidence.

## Alternatives considered

- Cloud/browser stop authority: rejected because Internet/provider/session loss must not remove local protection.
- Edge-only safety logic or MCU-only watchdog: rejected as the sole protection because the normal controller and its power/software may fail together. Independent safeguards and restraint need their own failure/independence argument.
- Treat driver encoder feedback, step counts or motor current as measured global position/tension: rejected because the current interfaces and mechanics do not support that inference.
- Permit motion-controller updates whenever docked: rejected because pod retention alone does not preserve line clearance without motor holding torque.
- Prohibit all physical actuation until field acceptance: rejected because controlled, reviewed isolated tests are necessary to generate the evidence; later-stage authority remains separately gated.

## Consequences

Remote and simulator development can progress with honest unavailable capabilities and explicit test scopes. Real adapters, operational activation and updates acquire additional local prerequisites and evidence records. This ADR establishes requirements, not a physical safety rating, certification or qualified review, and no GPIO, BOM quantity or geometry changes result from it.

## References

- [Safety case](../system/safety-case.md)
- [Interfaces and operating states](../system/interfaces-and-operating-states.md)
- [Local safety interface matrix](../system/local-safety-interface-matrix.md)
- [Control cabinet](../assemblies/control-cabinet/README.md)
- [Winch wiring](../assemblies/winch/wiring.md)
- [Dock](../assemblies/dock/README.md)
- [Positioning lines](../assemblies/positioning-lines/README.md)
- [Weather, parking and maintenance](../operations/weather-parking-and-maintenance.md)
- [Prototype and commissioning](../operations/prototype-and-commissioning.md)
