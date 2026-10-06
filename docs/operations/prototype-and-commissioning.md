# Prototype and commissioning

## Principle

ARBI progresses by reducing uncertainty at the smallest practical scale. A later integrated demonstration does not erase missing component evidence. Each phase records the exact hardware, source revision, configuration, conditions, instruments, results, failures, and reviewer.

## Phase 1 — bench winch

- Acquire the selected closed-loop stepper kit plus representative Dyneema, shaft, bearings, coupling, and controller parts.
- Print one complete winch revision.
- Characterize direct-drive force, speed, acceleration, repeatability, holding, heat, and faults.
- Exercise one-layer winding across the full intended drum width.
- Measure effective radius/length mapping, reversal error, line tracking, and maximum useful tension.
- Test home/reference and bounded recovery after lost position.
- Inspect guards, retention, fasteners, printed creep, bearing load, and failure modes.

**Exit evidence:** an approved mechanical revision and measured operating envelope, not merely visible motion.

## Phase 2 — powered line

- Build a representative hybrid line with two conductors mechanically slack relative to Dyneema.
- Build the rotating slip-ring and stationary/rotating strain relief.
- Run repeated full winding/unwinding cycles under representative bend and tension.
- Inspect conductor fatigue, abrasion, insulation, local stiffness, temperature, and effect on line tracking.
- Measure voltage at maximum extension under the worst expected Pi/camera/servo/Wi-Fi load.
- Exercise open/short/contact-intermittency and branch-protection responses under a controlled procedure.

**Exit evidence:** justified working current/voltage, construction, cycle life or replacement interval, and safe fault behavior.

## Phase 3 — camera pod and dock

- Print and assemble the spider/chassis, electronics mount, gimbal, cap, strain relief, and docking stud.
- Install Pi 3A+, selected converter/capacitor, Camera Module 3, and two selected micro servos.
- Weigh the complete pod and record center of gravity.
- Calibrate pan to approximately ±90 degrees and tilt from straight down toward approximately 70 degrees sideways, bounded by safe limits.
- Verify stable pod voltage under simultaneous worst expected loads.
- Implement and measure stop → gimbal → settle → autofocus → capture.
- Test Wi-Fi transfer, local caching, reset, and command interruption.
- Exercise funnel capture, latch, dock confirmation, release, shelter, drainage, and maintenance access.

**Exit evidence:** accepted mass, power stability, gimbal/camera performance, and dock capture/recovery envelope.

## Phase 4 — small four-cable frame

- Build an approximately 4 × 2 m controlled test rectangle.
- Install four winches, representative pulleys/lines, pod, and a test dock or safe restraint.
- Implement synchronized inverse kinematics and smooth trajectories.
- Validate positive-tension strategy, workspace limits, homing, stopping, and representative fault responses.
- Install fiducials and capture repeatable images at known positions.
- Record motion, line, motor, pod, and image data for simulator comparison.

**Exit evidence:** repeatable integrated operation in a controlled exclusion zone with known residual risks and bounded recovery.

## Phase 5 — full outdoor installation

- Survey the site and update the structural, electrical, environmental, privacy, and maintenance plans.
- Install and inspect four posts and guy anchors.
- Pull-test and resurvey corner structures.
- Install and electrically test cabinet and field distribution.
- Install winches, four lines, pod, dock, and fiducials.
- Load the as-built coordinate/configuration revision.
- Calibrate anchors, line references, safe workspace, bed/plant targets, gimbal, camera, dock, and vision processing.
- Commission in stages with exclusion zones, reduced limits, fault injections, weather checks, and inspections.
- Integrate cloud requests only after local operation is accepted.

**Exit evidence:** complete as-built record, accepted safety case, qualified reviews, operating envelope, inspection schedule, and release tag.

## Local safety and update gates

[ADR-0006](../decisions/0006-local-safety-authority-and-instrumentation.md) and the [local safety interface matrix](../system/local-safety-interface-matrix.md) define required functions and evidence owners. These gates govern authority for the named rig/target/configuration. No gate is passed merely by merging requirements, changing a capability flag or completing a GitHub issue.

| Stage | Entry, scope and exit requirements |
| --- | --- |
| Source/design and simulation | Requirements and fixtures may use simulated or unavailable inputs. Review interface semantics and fault scenarios; label every result as source/model evidence. No physical actuation or field activation authority follows. |
| Secured isolated bench/HIL | Explicit authorization under a reviewed test procedure for the exact target, wiring, fixture and configuration. Disconnect operational actuator loads or use secured controlled substitutes/restraint; define reduced travel/speed/force/time, exclusion zone, accessible isolation, initial output states and stop conditions. Actuation/flashing may produce B evidence before installed gates pass. Actual target timing and electrical response are measured; substitute-input tests cannot validate absent sensors or loaded restraint. |
| Secured loaded frame | Accept relevant component/interface B evidence, rig structural/electrical hazards, independent stop path, restraint, calibrated force/position/clearance measurements and test-specific fault/recovery procedure before applying load. Measure the LS fault matrix under reduced limits and controlled access. The test rig's acceptance does not enable unattended or installed operation. |
| Installed operational actuation | Disabled until the as-built installation has required B/F/I evidence, approved local configuration/calibration, independent protections, measured line tension/clearance, power-loss response, local weather/access policy and applicable Q reviews. Missing mandatory observations or limits block the affected capability. |
| Loaded/installed motion-controller updates | Disabled until that stage's target-specific LS-18 restraint/clearance evidence and LS-03/08/12/16/17 reset/isolation/recovery prerequisites are accepted. `Parked`, zero commanded speed or a signed artifact is insufficient. Conflicting motion/manual/maintenance work is locked out; interrupted update/reset cannot automatically restore commands. Edge/pod restarts also need their own reviewed outage/recovery procedure. |
| Public operation and return to service | Release evidence index, qualified acceptance, residual-risk/inspection/recovery procedures and deliberate local authorization for the released installation. Material hardware/firmware/configuration/calibration changes invalidate affected evidence and require retesting before restoring authority. |

All physical gates above are currently **unverified**. Source checks, simulator assertions and ordinary documentation review do not constitute instrumented bench/HIL, loaded-frame, installed-site or qualified physical-safety review. [#59](https://github.com/gredice/arbi/issues/59), [#67](https://github.com/gredice/arbi/issues/67), [#76](https://github.com/gredice/arbi/issues/76), [#78](https://github.com/gredice/arbi/issues/78) and [#79](https://github.com/gredice/arbi/issues/79) carry the implementation/evidence follow-ups.

## Test-record minimum

Every committed evidence record should include:

- test identifier, purpose, linked requirement/issue, and date;
- part/assembly/build/software/configuration revisions;
- setup diagram or photos safe for public release;
- environmental and initial conditions;
- calibrated instruments and measurement uncertainty where relevant;
- exact procedure and stop conditions;
- raw data location and analysis version;
- result against predefined acceptance criteria;
- anomalies, damage, follow-up, and reviewer.
- applicable LS requirement IDs, authorized stage/rig scope, measured fault-detection/response times, stopping distance/force and line-clearance results where relevant, and any evidence still missing before the next stage.

Do not replace raw data with a screenshot when machine-readable measurements exist.

## Commissioning rules

- Begin at reduced speed, acceleration, force/current, workspace, and access.
- Validate one hazard/control at a time when practical.
- Keep people outside loaded and moving envelopes.
- Stop on unexpected noise, motion, heat, smell, deformation, line damage, low clearance, moisture, or sensor disagreement.
- Never bypass a safeguard just to finish a test.
- After any structural, electrical, line, drum, pod, dock, firmware, or calibration change, rerun affected acceptance tests.
- Simulation may predict tests but cannot authorize a higher hardware limit.

## Open engineering questions carried into testing

- Final post and anchor design for the real soil/wind environment.
- Final pulley and drum size.
- Maximum line tension, speed, acceleration, and parking tension.
- Powered-line conductor and slip-ring life.
- Converter/servo selection, pod mass, and settling interval.
- Need for IMU, tension sensing, controlled lighting, differential signals, and fail-safe brakes.
- Final dock geometry and power-loss response.
- Final per-bed/plant mapping and fiducial system.
