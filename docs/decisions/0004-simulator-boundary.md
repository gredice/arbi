# ADR-0004: Share contracts between hardware control and simulation

- Status: Accepted
- Date: 2026-08-30

## Context

ARBI will need a simulator for software development, visualization, operator/model training, and controller/PID tuning. A simulator developed independently from operational schemas and algorithms will drift, while firmware coupled directly to a high-level physics engine will be difficult to run deterministically on the MCU.

Simulation can reduce development risk but cannot establish that the physical outdoor system is structurally or electrically safe.

## Decision

Establish a versioned boundary shared by real and simulated environments:

- common units, coordinate frames, configuration schemas, assembly/build IDs, operating-state names, commands, events, faults, and telemetry;
- pure, portable kinematics and trajectory reference functions where practical;
- golden reference vectors consumed by firmware, services, calculators, and simulation;
- a hardware-abstraction boundary for motors/drivers, home/limit/dock sensors, pod power, gimbal/camera, and time;
- deterministic scenarios with explicit seeds, initial conditions, disturbances, controller revision, and expected invariants;
- replay of recorded hardware telemetry through analysis and visualization tools;
- model parameters derived from named bench/site tests and carrying uncertainty/evidence metadata.

The simulator may incrementally model:

- anchor and site geometry;
- drum radius, helix, and quantization;
- motor/driver torque, speed, current, latency, and fault behavior;
- line elasticity, creep, sag, mass, damping, tension, and break/slack faults;
- pulley/termination offsets, friction, backlash, and structure movement;
- pod mass/attitude and gimbal settling;
- sensor noise, delay, dropouts, resets, network effects, wind, and weather-related disturbances.

PID or learned-controller experiments run against a bounded simulation interface and scenario suite. A model must not command real hardware without passing separately defined hardware limits, review, and staged tests.

## Evidence boundary

- Simulation verifies software behavior against a declared model.
- Bench tests characterize components and identify model parameters.
- Hardware-in-loop tests verify real timing/interfaces with controlled plant substitutes.
- Installed tests validate physical behavior in the actual environment.
- Only physical analysis/test and qualified review can support structural, electrical, and public-operation safety claims.

## Consequences

- Web visualization, offline development, controller tuning, and incident replay can reuse one data model.
- Hardware and simulator implementations remain independently testable.
- Model fidelity can grow without changing the command contract unnecessarily.
- The project must maintain golden tests and compatibility/version rules.
- Differences between predicted and measured behavior become tracked calibration evidence rather than hidden tuning.

## Alternatives considered

### Build a visual-only animation

Useful later for communication but rejected as the engineering simulator because it cannot support controller development or quantified comparison.

### Duplicate production logic inside the simulator

Rejected because duplicated kinematics, states, and units inevitably drift.

### Run all firmware source unchanged in the simulator

Not required as the only approach. Portable control cores may be shared, but device timing and hardware code also need target-specific tests.

## References

- [System architecture](../system/architecture.md)
- [Interfaces and operating states](../system/interfaces-and-operating-states.md)
- [Prototype and commissioning](../operations/prototype-and-commissioning.md)
- [Safety case](../system/safety-case.md)
