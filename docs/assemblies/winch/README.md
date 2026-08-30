# Winch

## Responsibility and boundary

Each winch converts motor rotation into controlled positioning-line length. The assembly owns its motor, motor driver interface, flexible coupling, supported drum shaft, bearings, bearing blocks, single-layer drum, line guide/termination, home/reference device, structural mount, guard/weather cover, local harness, and characterization data.

The [corner station](../corner-station/README.md) owns the pole and mounting envelope. The [positioning line](../positioning-lines/README.md) owns the line construction and external termination. One powered-line winch adds a slip-ring variant.

## Motor kit baseline

The V1 source selects one StepperOnline `4-CLYS30-V20` four-axis closed-loop kit containing:

- 4 × 3.0 Nm NEMA23 closed-loop stepper motors with encoders;
- 4 × CL57Y-V20 V2.0 closed-loop drivers;
- matched motor and encoder cables, approximately 2 m;
- 2 × 48 V / 350 W power supplies.

The exact current commercial offer, manufacturer revisions, ratings, wiring, protection, and availability must be verified in the BOM before purchase.

## Direct-drive baseline

V1 uses no GT2 belt, gearbox, or reduction pulley. Each motor drives an independently supported 8 mm drum shaft through a flexible 8 mm-to-8 mm jaw coupling. External bearings carry radial positioning-line load rather than using motor bearings as the drum support.

With a nominal 100 mm drum diameter, 3 Nm gives an ideal zero-speed tangential force of approximately 60 N:

```text
force = torque / radius = 3 Nm / 0.05 m ≈ 60 N
```

This is not a usable-force rating. Driver current, motor speed, acceleration, coupling, bearings, drum, line layers, thermal limits, tension strategy, efficiency, and safety margins reduce the permissible operating envelope. Bench characterization is required.

## Drum and line management

The baseline drum is a large, 3D-printed, single-layer grooved part. Its goals are:

- one line layer only;
- known effective radius;
- predictable line length per revolution;
- sufficient working width for full travel plus safe end retention;
- no line crossing, biting, side-wall climb, or uncontrolled fleet angle.

Multilayer winding is excluded because each layer changes effective radius and therefore commanded length. The final diameter, width, groove pitch/profile, wall geometry, line attachment, material, print orientation, shaft interface, balancing, and overspeed margin are open.

OpenSCAD source must parameterize the line diameter, groove pitch, usable turns, diameter, width, shaft interface, and revision. Generated meshes are not canonical design sources.

## Shaft, bearings, coupling, and fasteners

The mechanical stack must define:

- motor shaft and key/flat details;
- flexible coupling type, clamp/locking method, misalignment allowance, and guard;
- drum-shaft material, diameter, shoulder/retention, and allowable deflection;
- bearing type, spacing, static/dynamic load, environmental sealing, and fit;
- bearing-block and winch-frame material and fastening;
- drum axial retention and safe end stops;
- fastener grade, locking, torque, witness marks, and inspection.

Printed motor mounts or bearing blocks must be treated as load-bearing parts and validated for creep, layer direction, temperature, UV, fatigue, and fastener bearing—not as “free” consumables.

## Powered-line variant

One winch passes 48 V from fixed wiring to the rotating hybrid line through a multi-channel capsule slip ring. The repository baseline suggests a six-channel device with three contacts paralleled for `+48 V` and three for return.

Before adoption, verify:

- working and transient voltage rating;
- current per contact and permitted parallel-contact use;
- insulation resistance, dielectric behavior, temperature rise, and contact noise;
- environmental protection and condensation control;
- rotational speed and cycle life;
- stationary and rotating strain relief;
- fuse/protection response to each plausible short or open circuit;
- safe separation from the drum shaft, Dyneema, bearings, and accessible metal.

The slip-ring mount, cover, and service access are part of the powered winch revision.

## Motor driver, cabling, and homing

The CL57Y-V20 driver mounts near the motor because the kit's matched cables are approximately 2 m. The driver receives a separately protected 48 V branch and single-ended 3.3 V STEP/DIR signals from the Pico baseline. Long outdoor control runs need signal-integrity, grounding, surge, and fault testing.

Each winch has a home/reference switch. After position loss, the baseline sequence moves slowly toward the reference, establishes a spool-angle reference, then transitions to calibrated cable length. Define switch technology, mechanical actuation, repeatability, independent travel limits, cable failure behavior, and how a homing move avoids over-tension or slack.

## Firmware and configuration

Per-axis configuration must include at least motor/driver revision, steps per revolution, microstep setting, encoder behavior, direction, drum geometry/revision, home polarity and offset, travel limits, line-length mapping, force/current/speed/acceleration limits, and alarm behavior.

Changing drum or line geometry invalidates calibration unless compatibility is explicitly demonstrated.

## Guarding, weather, and maintenance

The drum, coupling, shaft, and line entry create pinch, entanglement, and stored-energy hazards. The assembly needs a drainable outdoor cover and service guard that:

- prevents contact during operation;
- does not create a line-rub surface;
- permits inspection without disturbing alignment;
- supports lockout and controlled de-tensioning;
- does not trap water or overheat the driver/motor;
- provides secondary retention for heavier components as required.

## Acceptance evidence

- Measured force-speed-acceleration envelope across intended line lengths and supply conditions.
- Motor, driver, bearing, printed-part, and enclosure temperatures through representative duty cycles.
- Repeatability and accumulated length error over full drum travel and repeated reversals.
- No line crossing, multilayer winding, abrasion, side-wall climb, or loss of termination.
- Home/reference repeatability and safe recovery after controlled position loss.
- Driver alarm, encoder error, communication loss, jam, and limit behavior.
- Guard, retention, locking, corrosion, ingress, and maintenance inspection.
- Powered variant electrical, thermal, insulation, and cycle-life evidence.

## Open questions

- Final drum diameter, width, groove, material, and printable design factor.
- Maximum continuous and peak line tension, speed, and acceleration.
- Whether direct drive provides acceptable holding and power-loss behavior.
- Need and timing for a normally engaged brake or drum lock.
- Final home switch and independent hard-limit architecture.
- Long-run STEP/DIR signal integrity and whether differential signaling becomes necessary.
