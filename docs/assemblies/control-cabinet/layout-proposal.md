# Control cabinet layout proposal

**Packaging proposal r0.1.0 — concept-unvalidated, 9 October 2026.** This adds a
reviewable physical arrangement to the [cabinet baseline](README.md). It does
not select an enclosure SKU, change power-supply allocation, or establish an
electrical construction schedule. The two supplies remain separate outputs;
their allocation and return/bonding arrangement require electrical review.

## Envelope and views

The reference uses **500 mm width × 600 mm height × 250 mm depth**. The existing
catalog's approximately 400 × 300 × 200 mm starting cabinet remains a procurement
starting point. The larger proposal reserves space for protection, routing,
service access and a separate edge computer alongside the two supplies. It is
not proof that either size fits the delivered hardware. Compare usable internal
dimensions, door/contact depth, mounting plate, cable bends, cooling and final
devices before selecting or revising the catalog item.

The [canonical assembly source](../../../hardware/assemblies/control-cabinet/control-cabinet-assembly.scad)
uses X across the cabinet, Y toward its rear and Z upward. The floor is Z=0;
the front is Y=-125 and the rear is Y=125. Its nominal 460 × 560 × 2 mm mounting
plate is centred at Y=105. The source's assumed 3 mm shell and 4 mm door are
visualization geometry, not construction or ingress specifications.

- Default service view: door opened 105°; supplies and controls visible.
- Closed view: `door_angle=0`.
- Exploded service illustration: `explode=1`; offsets identify inspection
  groups and do not prescribe removal paths or cable slack.
- Website: selectable constituent meshes, orbit/zoom and the same exploded
  offsets exported from the assembly source.

The shell/door are proposed context linked to the enclosure BOM item. The six
other purchased part types reuse their individual CAD modules, including two
instances of the supply. Protection-device solids are generic occupied-space
envelopes; open frames represent unselected stop-interface and edge-computer
reserves. No reference component is a printable part or adds a purchase line.

## Arrangement

| Area | Nominal position / occupied space | Purpose and unresolved work |
| --- | --- | --- |
| Mains row | DIN-rail centre Z=535; isolator 54, RCBO 36 and surge-device 54 mm widths; each 85 mm high × 60 mm deep | Separate mains entry/isolation/protection; device types, coordination, ratings and terminal geometry unselected |
| Protective-earth bar | Upper right, Z=535; 95 × 12 × 8 mm proxy | Protective conductor termination and enclosure/door bonding; material, connections and conductor sizes unselected |
| Supplies | X=-92/+92, Z=380; each 121 mm wide × 215 mm high × 50 mm deep in the reference mesh, including its terminal lip | Two existing supply references, rotated vertically; manufacturer's mounting orientation, spacing and cooling requirements must supersede this pose |
| DC protection row | DIN-rail centre Z=225; five 18 mm branch envelopes | Space for four motor branches and one pod branch; actual fuse/holder sizes, controller protection and supply grouping unresolved |
| Independent stop interface | Lower right of DC row; 85 × 85 × 65 mm open reserve | Reviewed hardwired stopping/supervision devices; no safety relay, contactor or circuit selected |
| Motion control | Terminal-board centre X=-95, Z=115; 90 × 83 × 19.5 mm reference including terminal/rail proxies; Pico stacked 18 mm forward | Header/connector keep-outs, support heights, mounting holes and wiring access require received-unit measurements |
| Controller converter and signal ground | Z=55, below Pico | Existing 48 V→5 V converter and signal-return block; protective earth is a distinct function |
| Edge-computer reserve | X=100, Z=115; 140 × 110 × 55 mm open reserve | Provisional occupied space only; host, mounts, supply, cooling, network and recovery access unselected |
| Field terminals | Lower front, Z=35 | Generic power/control terminal envelopes; terminal count, separation, wire sizes and shields unresolved |
| Wiring ducts | 28 mm wide × 35 mm deep side channels | Routing placeholders; actual duct capacity and mains/control segregation unresolved |
| Cable entries | Six illustrative bottom collars | Visual entry positions only; not the required cable count, gland selection or drilling pattern |
| Door | Left hinge; emergency-stop operator near outer edge | Accessibility, door swing, hinge/lock, protective bonding and a retained flexible harness require review |

The 5 mm nominal vertical gap between the supply envelopes and upper protective
devices is only a geometric gap. It is not a qualified electrical clearance,
ventilation allowance or service space. The final manufacturer's spacing may
require a larger enclosure or different arrangement.

## Power and control interfaces

These identifiers name interfaces for design discussion. They are **not physical
terminal numbers**; a reviewed terminal schedule must define the final blocks,
pins, conductor identification and schematic cross-references.

| Logical interface | Destination / function | Information needed before implementation |
| --- | --- | --- |
| AC-IN | Fixed-site mains feed | Source protection, isolator, RCD/RCBO, surge approach, conductor and entry specification |
| PE | Protective earthing and bonding | Supply PE, enclosure/door continuity, site earth arrangement and inspection records |
| DC-A / DC-B | Two separate 48 V supply outputs | Exact supply models, load allocation, startup/inrush, fault coordination and return/bonding scheme |
| MOTOR-A…D | Four locally protected 48 V motor-driver feeds | Per-branch current, conductor length/section, voltage drop, fusing, isolation and pole endpoints |
| POD-48 | Protected powered-line supply at one pole | Separate isolation, worst-load drop, slip-ring/line limits and reviewed stop-state behavior |
| CTRL-5 | Converter → Pico / cabinet auxiliaries | Converter input/transient margin, current, local protection and brownout/reset behavior |
| STEP/DIR-A…D | Pico → four pole-mounted CL57Y-V20 drivers | Existing GP2…GP9 assignment; input compatibility, cable lengths, EMI and false-step tests |
| SIGNAL-GND | Dedicated STEP/DIR pair returns | Signal-return routing and reviewed relationship to power returns / PE; no assumed equivalence |
| HOME / LIMIT / ALARM / ENABLE | Local motion/safety endpoints | Instrumentation, independent limits and final electrical/GPIO allocation; reserved pairs imply no circuit |
| E-STOP | Door operator → independent stop path | Contacts, supervision, reset, output states, energy isolation and restraint sequence |
| EDGE↔PICO | Dedicated wired cabinet link | USB/isolated serial decision, framing, authentication, reset effects and connector access |
| EDGE↔POD / WAN | Imaging jobs, cached images and cloud connectivity | LAN/router hardware, antenna/ports, local diagnostics and offline recovery |

Four CL57Y-V20 drivers stay at the poles with their short motor/encoder harnesses.
The camera Pi remains on the pod. The separate cabinet edge machine follows
[ADR-0008](../../decisions/0008-edge-host-and-local-transport.md): Debian 13/systemd
target, two CPU cores, 4 GiB RAM and at least 64 GiB storage as starting budgets.
The reserve drawn here does not establish that a suitable host fits.

## Cabinet BOM completion register

The canonical cabinet assembly currently contains one enclosure, two supplies,
one Pico, one expansion board, one controller converter, one signal-ground block
and one emergency-stop button: **seven part types, eight purchased units**.
Supplies are sourced through the motor-kit bundle. The known-goods figure is a
partial allocation, not a complete installed cabinet price.

| Missing or unselected group | Selection record to add |
| --- | --- |
| Final enclosure / mounting plate / wall mounts | Manufacturer, usable dimensions, environment, mounting, door swing and service access |
| DIN rails, ducts, end stops and fixings | Dimensions, quantities, conductor capacity and usable plate layout |
| Mains protection and isolation | Reviewed schematic, selected isolator/RCD/RCBO/surge devices, coordination and installation assumptions |
| Protective-earth terminals and bonding | Exact bars/terminals, enclosure/door bonds and test access |
| DC protection and distribution | Fuse/holder/terminal IDs, branch grouping, fault rating, controller and pod isolation |
| Independent stop/supervision hardware | Devices and circuit selected by the local safety design; button alone is incomplete |
| Field terminals, connectors and glands | Count by actual cable, conductor range, entry diameter, weather/service requirements |
| Internal conductors and identification | Wire specification, ferrules, labels, schematic references and revision plate |
| Edge computer and networking | Selected host/storage, DC conversion, network hardware, thermal budget and recovery interface |
| Condensation / thermal treatment | Measured losses and environment; qualified ventilation, heater or other treatment if required |

Add normalized BOM identities/usages and dated supplier offers when selections
exist; do not create priced purchase lines from these reference envelopes.

## Assembly and service planning

The proposed sequence is enclosure/plate/mounts, rails and ducts, protective
bonding, reviewed protection/distribution, supplies, control electronics, then
field terminations and labels. Keep mounting patterns parametric until selected
hardware is measured. The stop operator needs serviceable door wiring and
bonding; neither harness is modeled as an accepted installation.

Before commissioning, reconcile every physical label with the as-built schematic
and terminal schedule. Verify the qualified electrical inspection, branch fault
and isolation tests, worst-duty enclosure temperatures, field signal integrity,
controller brownout/watchdog behavior, independent stopping and power-loss
restraint described in the [cabinet acceptance requirements](README.md#acceptance-evidence).

The CAD reference and website demonstrate nominal source geometry and navigation
only. They do not establish received-hardware fit, IP rating, thermal capacity,
electrical safety, safe stopping or installed operation.
