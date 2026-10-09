# Dock capture and release bench-test plan

Proposed staged tests for fit, capture, retention, release, sensor faults, power
interruption and recovery. No physical test has been performed.

9 October 2026. Plan revision `0.1.0`, proposed for `DOCK-IF-01`.
**No physical test has been performed by this change.** This is an evidence plan, not
authorization to actuate a rig or load overhead hardware. Use the
[design package](design-package.md), [blank acceptance record](acceptance-record.md)
and [commissioning gates](../../operations/prototype-and-commissioning.md#local-safety-and-update-gates).

## Rig and entry conditions

Begin with a low, secured, accessible fixture holding the capture cartridge and
a replaceable dummy pod/stud. A supported manual positioning fixture can study
fit before a powered approach stage is reviewed. Record its motion/contact
limitations; a constrained carriage does not reproduce four-line pendulum motion.
Keep the real camera/electronics out of initial impact tests.

Use independently secured restraint/catch provisions, controlled access and
accessible isolation as required by the rig review. Define travel, force, speed,
stored energy, fixture capacity and recovery before any powered or loaded test.
The operator must not reach into a moving or loaded latch to clear it.

Before each series, record:

- exact CAD/hardware/material/print, fixture, wiring, firmware and configuration
  revisions, plus source identity and dummy mass/centre-of-gravity equivalence;
- load and movement bounds, excluded zones, isolation and reset behavior;
- instruments, calibration/uncertainty, position/angular resolution and sample
  rates adequate for the chosen force/event/response measurements;
- quantitative limits, tested matrix, repeat counts, stop criteria and reviewer;
- public-safe setup drawing/photos and raw-data location.

Missing limits or stage authorization mean the series has not started. Do not
select an acceptance threshold after observing its results.

## Test matrix

| ID / stage | Procedure and required observations | Acceptance basis |
| --- | --- | --- |
| DT-01 Design/source | Export actual candidate geometry; inspect sections, contact path, retained overlap, upward/lateral stops, fastener engagement and continuous approach/release clearance | Reviewed drawing and tolerances; identify sampled versus exhaustive checks; export success alone is insufficient |
| DT-02 Unloaded fit bench | Measure received/printed parts, assemble cartridge/dummy, move manually through entry, seat, capture and release, inspect service access | Dimensions within frozen limits; no shell/gimbal/harness/line contact outside designated structural surfaces |
| DT-03 Capture bench | Sweep reviewed lateral X/Y offsets, pitch/roll, yaw and starting vertical positions; add bounded speed and swing only under the authorized rig procedure | All declared supported combinations meet predefined capture/timeout/force/bounce criteria; no false engagement |
| DT-04 Retention bench | Apply reviewed LC-01/03 directional loads, upward/downward/lateral reactions and moments on a secured fixture; measure overlap, slip, deflection and residual set | Retention and damage limits from reviewed load/process analysis; spring/magnets/sensors carry no structural retained load |
| DT-05 Release bench | Restore the defined supporting condition, release at reviewed minimum/maximum load and misalignment, measure travel/force/current/time; inject a safe obstruction | Release confirmed inside frozen bounds; jam/timeout blocks departure and de-energizes/bounds output as reviewed; no repeated forcing |
| DT-06 Sensor bench/HIL | Exercise empty, partial, seated-but-unlatched, fully latched, released-but-present and clear states; inject open/short/stuck/bounce/stale/disagreement faults | No false `Parked`, release or clear assertion; detection/response meet reviewed deadlines; absent real channels remain unavailable |
| DT-07 Interruption bench/HIL | Interrupt release supply, sensor supply, communications and controller execution/reset at each latch phase; use secured substitutes first | No unintended release/restart; truthful unknown/fault observations; reviewed retention and bounded recovery; no output replay |
| DT-08 Durability bench | Run frozen cycles and sustained-load dwell with reviewed temperature, moisture and contamination cases; inspect wear, spring/fork/pin/fastener changes | All intermediate/end inspections meet fixed limits; preserve failed results; cycle count is justified for intended life |
| DT-09 Shelter bench | Fit actual roof/pod geometry; inspect drainage and lines, then review/test direct and wind-driven rain, splash, condensation and sheltered heat | Defined dry/contact/thermal limits; no water directed into vulnerable pod interfaces; no inferred ingress rating |
| DT-10 Recovery bench/frame | Simulate missed capture, obstructed dock, blocked release and no-power service under the reviewed restraint procedure | Deliberate bounded recovery; remote/automatic work inhibited; no automatic low maintenance positioning or hands in loaded mechanism |
| DT-11 Secured four-line frame | Integrate actual four lines/pulleys/winches, loaded pod and accepted dock; measure force/pose/clearance, repeat DT-03/05/07 relevant cases | Accepted component prerequisites and rig limits; normal and fault cable behavior measured independently of commanded pose |
| DT-12 Installed/qualified | Repeat relevant cases for as-built site and exposure, including disable and total/partial power loss with approved all-line restraint | Accepted minimum clearance, structural/electrical review, local weather/access/recovery and inspection procedure |

DT-07 on a latch fixture cannot validate line sag or driver-disable behavior.
DT-11/12 must explicitly measure LS-18 for all four lines, especially the powered
line. A pod that remains captured does not establish controller update safety.

## Capture-envelope sampling

Freeze a finite matrix before testing. Cover center, boundaries, corners and
combined errors, both signs of lateral/angle errors, and adverse yaw relative to
the four line exits. Include representative tolerance extremes, wear and debris
after the clean baseline. A zero-angle circular-clearance calculation cannot
replace these tests.

Record failed and successful trials. Report the tested envelope and sample count,
not a continuous capture region unless justified by analysis. Repeatability and
failure-rate acceptance require a stated sample-count rationale; a few successful
cycles cannot establish lifetime reliability. Extend scope only after reviewing
new bounds and preserving earlier results.

## Data and fault observations

| Data | Required fields |
| --- | --- |
| Trial identity | Series/trial ID, date, operator/reviewer, rig/part/source/configuration revisions |
| Initial condition | Offsets, orientation, mass/CG, relevant tensions/directions, temperature, contamination, sensor/output state |
| Event trace | Time base, actual seated/engaged/released/clear observations and quality; commanded output separately; power/link interruption markers |
| Mechanical result | Capture/release success, force/moment, deflection, bounce, slip, residual set, overlap and contact location as relevant |
| Outcome | Limits, pass/fail/blocked, uncertainty, anomalies, damage, recovery and raw trace/photo references |

DT-06 must include an empty closed fork and a partially captured head: neither
is valid seated-and-engaged evidence. DT-07 must interrupt both while retained
and while already released; spring return cannot recapture a pod that has left
the locator. Record any temporary support required by the reviewed rig procedure.

Stop on unexpected movement/contact, lost restraint, exceeded force/deflection,
cracks or slip, wiring/power anomalies, heat or contradictory observations.
Recovery follows the reviewed rig procedure; preserve the cause and measurements
before changing parts, parameters or thresholds.

## Exit evidence

Each accepted series links a completed record with the exact configuration,
limits, raw data, failures and reviewer. A changed material/process, pod
attachment, latch, sensor/actuator, wiring, firmware, station or line configuration
requires a documented assessment of which tests must be repeated. DT-01 is
source evidence; DT-02–10 prove only their named bench scope; DT-11, DT-12 and
qualified review remain separate. Keep unloaded, loaded and installed authority
distinct in the [acceptance record](acceptance-record.md).
