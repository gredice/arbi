# Goals and V1 scope

## Purpose

ARBI, the Automatic Raised Bed Imaging system, is intended to photograph raised beds autonomously on a schedule and on demand. The V1 concept is a four-cable, Skycam-style robot with a very light camera pod, fixed winches, distributed low-voltage power, and local motion control.

## Product goals

- Capture repeatable images of every raised bed.
- Return a fresh on-demand image with low wait time.
- Cover the current 25 beds and a planned expansion to 30 beds without rebuilding the system.
- Operate outdoors while parking the pod in a sheltered HOME dock whenever inactive or adverse weather is expected.
- Keep visible infrastructure garden-friendly: timber posts and thin lines instead of an industrial gantry.
- Prefer consumer and hobby components over industrial machine-vision hardware where testing shows them to be adequate.
- Use version-controlled, parameterized OpenSCAD models for custom three-dimensional parts.
- Keep all moving parts battery-free.
- Support future close-up images by moving above a plant and using fine camera pan and tilt.
- Make documentation, hardware sources, software, BOM data, tests, and decisions reviewable through Git.

## V1 baseline

The current V1 baseline assumes:

- four motorized positioning lines, one from each corner;
- three normal Dyneema lines and one hybrid Dyneema line carrying pod power conductors;
- one fixed winch and closed-loop stepper system at each corner;
- one lightweight pod with a Raspberry Pi 3A+, Camera Module 3 Standard, a two-axis micro-servo gimbal, a 48 V to 5 V converter, and local bulk capacitance;
- one high, corner-mounted dock with a passive structural latch and sheltered parked state;
- one central cabinet containing mains protection, two 48 V supplies, fused distribution, and a Pico 2 W motion controller;
- a local edge service that owns job orchestration and communicates with the motion controller and pod;
- cloud integration that requests images and stores or presents their results, without directly closing the motion-control loop.

These are baseline choices, not evidence that the complete system has been assembled or validated.

## V1 constraints

- The pod, positioning system, and other moving parts use no batteries.
- Normal imaging keeps positive tension in all four positioning lines.
- The gimbal does not reposition during a normal Skycam move.
- The motion loop and safety decisions remain local when Internet access is unavailable.
- The pod is not treated as weatherproof; normal idle behavior is to dock.
- Mains voltage remains inside fixed, purpose-designed equipment. Garden and moving equipment use low-voltage DC.
- The V1 pod is daylight-only unless testing establishes a need for controlled lighting.
- Printed parts are versioned engineering parts. “Effectively free” printing must not be interpreted as zero material, labor, maintenance, or safety cost.

## Explicitly outside the current V1 baseline

- a battery on the pod;
- a propulsion motor on the pod;
- Ethernet to the moving pod;
- a heavy pod enclosure;
- a 360-degree camera;
- a dedicated IMU unless testing demonstrates sufficient value;
- dedicated lighting for the first daylight prototype;
- an automatic below-head-height maintenance move;
- a complete high-fidelity simulator, although its interfaces and data needs must be preserved from the beginning.

The current V1 baseline defers a normally engaged drum lock or fail-safe brake, but this is not a categorical V1 exclusion. Whether V1 requires one is a release-gated safety decision: public operation cannot proceed until power-loss testing and the installed safety case demonstrate acceptable parked line clearance, with a brake added if that evidence requires it.

## V1 success criteria

V1 is not complete merely because the source code builds or the pod moves. Completion requires recorded evidence that the released configuration:

1. covers the defined safe workspace and all intended bed targets;
2. maintains configured line-clearance and tension constraints in operating and parked states;
3. captures repeatable, focused, rectifiable images at representative bed and plant targets;
4. homes, docks, rejects unsafe work, and enters a safe fault response deterministically;
5. remains electrically stable at maximum line extension and worst-case pod load;
6. passes assembly-specific structural, fatigue, thermal, weather, and maintenance checks;
7. can be reproduced from versioned BOM, OpenSCAD, software, configuration, and commissioning records;
8. documents residual risks and obtains the required qualified review before public operation.

See [design status](design-status.md), [safety case](../system/safety-case.md), and [prototype and commissioning](../operations/prototype-and-commissioning.md).
