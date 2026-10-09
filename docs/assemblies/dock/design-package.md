# Dock and compact-pod interface design package

Proposed interface study DOCK-IF-01 covers the shared post configuration,
compact-pod compatibility, load paths, observations and docking sequence.
The registered r0.1.0 bench geometry is available; physical acceptance remains pending.

9 October 2026. Documentation revision `0.1.0`; interface study `DOCK-IF-01`.
**Supported-dummy bench candidate; physical acceptance pending.** Read the
[proposal](design-proposal.md), [baseline](README.md) and
[bench plan](bench-test-plan.md) together. The historical `dock-funnel` and `dock-nest` are archived, superseded by the
new split bench kit. Use the [assembly guide](assembly-guide.md).

## Baseline and compatibility

| Item | Current source or starting value | Use in this study |
| --- | --- | --- |
| Funnel r0.1.0 | Mouth Ø275, throat Ø60, height 90, wall 6 mm | Historical starting guide; assembled placement and collisions unresolved |
| Nest r0.1.0 | 330 × 330 × 20 mm; 170 × 125 mm pocket before clearance; Ø28 opening | Historical plate; do not treat it as a compact-pod mating interface |
| Archived stud r0.1.0 | Ø14 stem, Ø24 head, 4 mm flange + 28 mm stem + 5 mm flare + 6 mm head | Historical comparison only; excluded from the compact kit |
| Current fixed pod hood | 124 × 118 mm plan; roof Z=49.5 in pod frame | Packaging reference, not complete pod or capture envelope |
| Current spider | 230 mm arm span, four line terminations | Structural reference; line hardware and full swept envelope also required |
| High dock | Capture 2.65–2.70 m; arm projection 0.3–0.5 m | Unverified site starting values |
| Parked lines | At least 2.2 m over accessible areas; initial 10–20 N/line experiment | Starting requirement/experiment, not approved force settings |
| Complete pod | 100–120 g target, 170 g ceiling | Includes any new docking attachment; sliced estimates do not establish mass |

The owner selected a **non-powered corner** for the dock on 9 October 2026 and
specified the same post radius as the corner support set. Reuse that set's
`post_shape` and `post_size_mm` configuration; its current round-120 default gives
a 60 mm radius. This selects a shared study parameter, not an independent site
measurement. The exact passive corner ID, measured mounting-row dimensions and
printer build volume remain open. Do not attach the dock to the powered-corner
configuration or silently create a different post-size assumption.

Dimensions come from the [existing dock sources](../../../hardware/assemblies/dock/README.md),
[pod library](../../../hardware/lib/camera-pod.scad) and
[compact configuration](../../../hardware/assemblies/camera-pod/camera-pod-enclosure.md).
The [corner support configuration](../corner-station/design-package.md) and
[shared corner source](../../../hardware/lib/corner-head.scad) own post parameters.
Use the full current selected assembly for new CAD checks. Do not restore the
archived stud or count its dimensions as a compatible replacement.

## Implemented bench candidate

The [canonical dock library](../../../hardware/lib/dock.scad) defines a 390 mm
post-face projection, Ø275/60 split guide, Ø26 final bore, Ø14/24 stud, Ø17 fork
slot and 40 mm manual release. Dock frame D uses the pod spider origin in the
nominal seated pose; the post axis is X=-450 for shared round-120. Z65 is the
guide mouth, Z120 throat, Z145.6–149.6 fork, Z160.8 head upper stop and Z220 roof
peak. The bridge top is Z75, above the fixed pod hood Z49.5. These are CAD datums,
not site elevations.

Guide tabs Z115–120 clamp beneath the arm platform Z120–150 and locator
flange Z150–156; the arm includes a recess for the fork guide and rear reaction
bridge. Roof fasteners are
at (+/-40,+/-40), guide fasteners (+/-30,+/-30). Roof spacers run Z156–205; four underside
Ø11 recesses put roof-bolt washer seats at Z125. Nominal 18 mm corridors at the
four radius 104 mm spider axes clear a synthetic vertical 1.5 mm line pose. Actual
approach and installed line/harness sweeps remain required.

The bridge shoes positively constrain arm width; radial retention depends on
clamping friction and requires slip/creep tests or a revised positive stop.
Added solid print volume is reported in the generated geometry report and
fabrication BOM. It is substantial and may exceed the complete-pod mass ceiling
with hardware/electronics. This package uses supported dummy testing until
mass, joints, materials and forces are accepted. Spring automatic capture and
stationary release actuation are not implemented by the manually released fork.

The PDF and source/STL ZIP contain only the round-120 nominal checked pack.
Shared 100–140 round parameters exist in source but require their own regenerated
geometry, stacks, print poses and acceptance records. The nominal 256 mm cube
with 5 mm XY reserve is an existing study envelope, not a measured user printer.

## Final-locator calculation

For a circular head approaching a circular opening axially, with ideal rigid
parts and zero angular error, the remaining radial center offset is at most
`(opening diameter - head diameter) / 2`.

Using the historical Ø24 head gives 18 mm at the Ø60 throat, but only 2 mm at
the Ø28 nest opening. These are nominal geometric upper bounds before print
tolerance, contamination, tilt or movement; they are not capture-test results.
The funnel throat alone therefore does not establish the required final
alignment. The current kit transitions to a Ø26 bore, leaving only 1 mm nominal
radial offset for the Ø24 head. Centered insertion/release meshes clear the
locator; toleranced, tilted and moving approaches still require bench evidence.

## Coordinate frames and interface datums

Use millimetres, newtons, degrees and seconds in this package; convert explicitly
when mapping to versioned software contracts. Pod P retains the current source
frame: origin at spider center, Z=0 at its mid-plane, +Z toward the dock, and
pan=tilt=0 as the initial packaging-study pose. That pose is not an accepted
physical parking pose until the real harness and gimbal checks pass.

Nominal dock frame D shares the seated pod spider origin, +Z toward the
shelter along the insertion axis, and +X from the post toward the span. Record
the actual alignment and transforms `site ← D` and `D ← P` for PRE-DOCK,
seated and released poses. Do not assume the site and pod axes coincide.

The interface drawing must identify the capture axis, lead-in, locating bearing
surfaces, head/shoulder, engagement overlap, upward stop, lateral load surfaces,
release travel, sensor targets and wear allowances. State tolerances, print
orientation and received fastener dimensions; model a section through the latch
as well as the external appearance.

For the candidate fork, its closed slot must clear the stem at the worst
tolerance while remaining narrower than the head by the reviewed retained
overlap on both sides. Check that overlap under offset, deflection and wear,
and that the full release stroke clears the head. A nominal head/slot diameter
comparison alone does not establish retained contact area or load capacity.

## Inputs and decision register

| ID | Required input or decision | Owner / present status |
| --- | --- | --- |
| DI-01 | Non-powered corner ID; shared corner-set post parameters; measured section at mounting rows; pulley coordinates; paths, obstacles and service zone | Owner selected non-powered corner and shared post radius. Default study round-120 / radius 60 mm; exact corner ID and site measurements pending |
| DI-02 | Full configured pod mass, center of gravity, line terminations, powered-line route, harness/gimbal keep-outs and parking pose | Pod/lines; unresolved. Preserve complete-pod mass ceiling |
| DI-03 | Maximum/minimum line tensions and directions, approach error, swing/tilt, speed/acceleration and stop envelope | Winch/control/site; values require calculation and measurements |
| DI-04 | Bench and field wind, temperature, rain, contamination and icing envelope; storage exposure and lifetime | Site/dock; no new weather limit selected |
| DI-05 | Printer volume/process, materials, tolerances, split joints and permitted bought/fabricated structural parts | Eleven split models fit the nominal 256 mm cube with 5 mm XY reserve. Actual printer, slices and print-process acceptance pending |
| DI-06 | Pod-side structural bridge versus independent mast; complete assembly/service clearance and added mass | Spider bridge/shoes/stud mesh against the current pod. About 94.44 cm³ / 118 g solid PETG before hardware; complete mass, radial clamp retention and swept/service envelopes pending |
| DI-07 | Locator/fork versus rotary-pawl geometry; retention overlap, wear, jam and secondary-retention analysis | Manual sliding fork implemented; nominal travel checked. Automatic capture, tolerance, contact/load, wear and jam evidence pending |
| DI-08 | Release actuator/linkage, maximum travel/duration/force, power-off/reset position and manual recovery | Dock/cabinet; stationary actuator proposed, product and circuit unselected |
| DI-09 | Seating/engagement/release observations, diagnostics, redundancy, debounce, freshness and response deadlines | Dock/Pico/edge; separate physical observations proposed, circuits unreviewed |
| DI-10 | Passive all-line restraint and measured clearance through total/partial power loss and driver disable | Winch/lines/dock/site; unresolved, separate from pod retention |

Keep sensitive site details out of the public tree. Public records can use a
synthetic frame/configuration identity while an authorized reviewer retains the
real survey. Missing values remain missing; do not replace them with rig defaults
or prototype values and then describe them as installed settings.

## Load paths and cases

Required pod path: mushroom/shoulder → independent structural attachment →
spider/core. Required dock path: locator, fork and stops → cartridge carrier →
arm → positively retained station attachment → reviewed post/guy/anchor system.
The hood, circuit boards, gimbal, magnets, sensor levers and latch spring must
not become the structural support path.

For a stationary retained pod, derive the dock reaction from the vector sum of
weight, all four `T_i * u_i` line forces and wind/contact loads in one frame.
Use measured/bounded line forces and angles. Calculate the arm moment at its
station connection from each force and its lever arm. Include roof wind load
and service forces; four scalar tensions added together are not a vector result.
Impact assessment also needs effective moving mass, approach speed, compliance
and stopping distance. Do not turn energy alone into a peak force or select a
proof factor without review.

| Case | Required analysis and evidence |
| --- | --- |
| LC-01 Parked, sustained | Pod support plus all line forces; arm/joint deflection, bearing, slip, creep and temperature |
| LC-02 Capture or bounded miss | Off-axis contact, swing, bounce and stop; guide/fork impacts and pod-shell clearance |
| LC-03 Unequal tension or one-axis fault | Upward/lateral reactions and torsion; no assumed healthy force redistribution |
| LC-04 Release, jam and maintenance | Restored tension before release, loaded-fork friction, bounded actuator, hand/tool/service forces |
| LC-05 Wind, shelter and contamination | Roof/arm loading, debris/ice obstruction, drainage and access |
| LC-06 Disable, partial/total power loss | Pod retention plus separate all-line restraint, sag/clearance and controlled restart |

Record load magnitudes, directions, allowed deflection, residual set, retained
overlap, material/process basis and reviewer before proof/cycle testing.

## Observation and sequence requirements

The following names describe proposed physical observations, not new protocol
fields or fitted capabilities: `seated`, `engaged`, `released` and `clear`.
Each needs source, freshness, fault interpretation and evidence. Commands and
coordinates cannot supply these observations. Review whether independent sensors
or a qualified local procedure provide each required observation.

| Step | Required permission and observation | Interrupted or ambiguous result |
| --- | --- | --- |
| PRE-DOCK | Accepted configuration, weather/access permission, healthy references, tension and dock availability | Reject approach and apply the existing reviewed state-specific response |
| Guide entry | Accepted low-speed envelope; pod motion pose; positive tension and monitored bounds | Stop within accepted limits; no blind automatic retry |
| Seat and engage | Actual seating plus full fork engagement/overlap; release demand inactive | No `Parked` assertion from one ambiguous input or head coordinates |
| Park | Accepted retention, parking tension and line clearance | Missing prerequisites inhibit dependent work; latch alone cannot permit updates |
| Release | Accepted supporting tension/restraint; bounded dock actuator demand | Jam/timeout denies departure; never pull the pod against an unconfirmed latch |
| Clear dock | Actual release and accepted clear envelope before normal motion | Contradiction or link/power loss invokes local fault/recovery policy |
| Restart or maintenance | Deliberate inspection/reconciliation; cleared area and reviewed isolation/recovery | No automatic release, low service move, lease replay or restored motion |

Pico observes reviewed local inputs and bounds its outputs; edge owns the state
transition under [ADR-0006](../../decisions/0006-local-safety-authority-and-instrumentation.md).
No cloud reply is required for a local protective response. Actuator supply,
protection, isolation, wiring, connectors and boot states need their own reviewed
interface record before real adapters can be enabled.

## CAD, procurement and publication work

The registered bench kit, [assembly guide](assembly-guide.md) and
[PDF/STL pack](booklet/README.md) implement the nominal cartridge, bridge,
arm and shelter. The pack checks actual current pod and bought-hardware meshes,
sampled fork travel, centered release and one synthetic vertical-line pose.
Approach, offset/tilt, optical/gimbal/harness sweeps, service and real site line
envelopes still require their own evidence. Derive installed mounting rows and
stacks from the measured station before installation.

Canonical BOM recipes count 24 printed pieces across 11 registered fabrication
models and a 100-piece nominal bought-hardware set. Spring stock and two
microswitches remain development allowances; actuator, circuit, spring force and
sensor targets/mounts are unselected. Historical standalone dock samples are
archived and excluded from current fabrication quantities.

The website uses checked assembled/exploded mesh transforms and links this
package, guide, bench plan and blank acceptance record. Exploded figures are
illustrations, not checked removal trajectories. Known goods remain a partial
subtotal; solid-volume print estimates and unresolved procurement/wiring costs
remain separate. The [product palette](../../project/industrial-design.md)
uses white protection, charcoal structure and neutral bought hardware.
