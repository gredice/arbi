# Roadmap

The roadmap advances from isolated evidence to an integrated outdoor system. A later phase does not make an earlier result more complete; each gate needs its own recorded evidence.

## Phase 0 — repository baseline

- Capture and structure the initial engineering baseline in repository-owned files.
- Establish physical assembly boundaries and stable part identifiers.
- Normalize the BOM into parts, assembly quantities, supplier offers, destinations, and build manifests.
- Add OpenSCAD conventions, model checks, and reproducible exports.
- Define versioned configuration, protocol, telemetry, and simulator boundaries.
- Convert open engineering questions into linked GitHub issues.

**Gate:** documentation links resolve, data validates, the project has no external authoring or synchronization dependency, and every baseline claim is labeled by evidence state.

## Phase 1 — bench winch

- Acquire the selected four-axis closed-loop stepper kit, test line, bearings, shaft, coupling, and controller parts.
- Print one full winch revision.
- Test direct-drive operation with a 3 Nm motor.
- Characterize usable line force and speed, repeatability, heating, braking behavior, and fault response.
- Exercise the single-layer drum across its full working width.

**Gate:** measured working envelope and failure behavior support the next test; drum geometry and line management have an accepted revision.

## Phase 2 — powered positioning line

- Produce a representative hybrid line with two high-flex conductors mechanically slack relative to the Dyneema.
- Build the slip-ring drum interface and pod-side strain relief.
- Run repeated winding cycles over the expected travel.
- Inspect insulation, conductor continuity, abrasion, temperature, and mechanical damage.
- Verify pod-side voltage at full extension under the worst expected simultaneous load.

**Gate:** the tested construction has a defined cycle life or replacement interval and no single observed failure bypasses the required electrical protection.

## Phase 3 — camera pod and dock

- Build and weigh the spider, fixed electronics mount, gimbal, optical protection, docking stud, and shelter interface.
- Calibrate safe pan and tilt limits.
- Verify 5 V stability during simultaneous servo motion, capture, and Wi-Fi transfer.
- Measure settling time before autofocus and capture.
- Exercise repeatable docking, latch confirmation, departure, drainage, and maintenance access.

**Gate:** pod mass, electrical stability, imaging sequence, dock capture envelope, and maintenance procedure meet documented acceptance criteria.

## Phase 4 — small four-cable frame

- Implement an initial deterministic simulator slice for ideal cable geometry, drum geometry, commanded trajectories, and versioned telemetry replay.
- Build an approximately 4 × 2 m test rectangle.
- Install four winches and representative positioning lines.
- Implement inverse kinematics, synchronized trajectories, homing, tension strategy, and safety workspace limits.
- Add representative fiducials and capture repeatable images at known coordinates.
- Compare measured motion and tension data with the initial simulator predictions and record the model gaps.

**Gate:** the integrated test frame demonstrates bounded motion and repeatable recovery without relying on cloud connectivity.

## Phase 5 — full outdoor installation

- Survey the actual site and validate the coordinate model.
- Review soil, post, guy, anchor, wind, lightning, electrical, and public-access conditions with qualified people.
- Install and pull-test corner structures.
- Install the control cabinet, field distribution, lines, pod, dock, and fiducials.
- Calibrate anchors, cable-length references, bed targets, camera geometry, and safe workspace.
- Run staged commissioning with exclusion zones before any public operation.
- Integrate the Gredice imaging API only after local operation and safety behavior are accepted.

**Gate:** the as-built revision has signed commissioning records, an updated hazard log, operating limits, inspection intervals, recovery procedures, and qualified approval for its intended environment.

## Phase 6 — interactive site and simulation

- Publish project documentation and BOM calculations through a Vercel-hosted interface.
- Add deterministic visualization and replay of real telemetry.
- Extend the Phase 4 simulator with measured motor, cable-tension, sag, elasticity, gimbal-settling, sensor, and environmental-disturbance models.
- Add controller tuning workflows and training environments.
- Validate each model against bench or installed-system measurements.

## V1 release and Gredice integration

Release V1 from this repository with tagged hardware, BOM, software, configuration, and evidence. Merge into the Gredice monorepo only after the V1 boundaries are stable. Keep packages and apps independently buildable so the merge is a repository move, not an architecture rewrite.
