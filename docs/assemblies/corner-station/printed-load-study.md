# Printed corner head: load and material study

**Status: concept-unvalidated.** This study supports the proposed replacement
of the steel angle and metal saddles with a printed carrier and post adapters.
Standard metal through-bolts, washers, nuts and the bought pulley remain. It
does not assign a line-tension limit, bolt torque, load rating or proof factor.
Use it with the [design package](design-package.md) and record received-part,
process and physical evidence in the [acceptance record](acceptance-record.md).

The [winch](../winch/README.md) gives approximately 60 N from the ideal
zero-speed calculation `3 Nm / 0.05 m`. That is explicitly not an operating
force rating. It must not become a 60 N continuous-load assumption for this
carrier. Continuous tension, peaks, span direction, fault loads and parked
duration remain inputs to establish through system characterization.

## Nominal CAD section and attachment contract

The [printed CAD library](../../../hardware/lib/corner-head-printed.scad) is
canonical. The values below describe its r0.1.0 source, before physical
qualification. Re-read the library and regenerate the owning geometry report
when a parameter or section changes. Dimensions are millimetres; `Rpost` is
the nominal post radius, 60 in the round-120 default.

| Feature | Nominal source contract | Calculation boundary |
| --- | --- | --- |
| Attachment datum | Passive sheave X=`Rpost + 177.55`, pin X=`Rpost + 177.55 - 40/sqrt(2)`; pin Z=165, sheave Z=`165 - 40/sqrt(2)` | The powered 4.5 mm line substitutes 176.65 for 177.55. The provisional 40 mm pin-to-sheave spacing is pitched 45° for equal leg tensions and the horizontal/vertical turn; received geometry and other equilibrium angles remain unverified. |
| Front seat and bolt rows | Flat washer seat X=`Rpost + 32`; rows Z=45/155, Y=0; body height 205 | Row centroid Z=100 and pitch 110. For moments about the front-seat plane, passive `e=117.265729`, `h=65`; this is an accounting datum, not proof that support/contact acts at that plane. |
| Main side webs | Two 16 mm Y-thick webs at Y=24…40 and -40…-24; tapered XZ profile with an opening | Combined nominal thickness is 32 only where both webs are actually present. Their taper, opening, bosses, row bores and strap cuts prevent treating the whole carrier as a uniform rectangular beam. |
| Upper chord | Full Y width 80, Z=185…205, thickness 20 | An isolated full rectangular chord would have `I=53333.3 mm⁴`, `S=5333.3 mm³` for vertical bending; this is not the composite carrier section or a capacity. |
| Direct attachment lug | One assembled 8 mm Y-thick lug, split into two 4 mm halves; X=`pin X ±16`, Z=150…190; bore 8.6, pin centre Z=165 | Nominal clear ligament below the bore 10.7, above 20.7, toward either X edge 11.7. Use the load direction and actual printed bore, split/joint behaviour and local stress concentrations. |
| Cross-bolt bosses | OD 26, bore 8.6 at X=`Rpost + 50`, Z=100/190; M8 × 100 cross-bolts, washer 1.6, nut 6.5 | Nominal radial ligament 8.7. These are assembly/load-transfer joints between halves; they need clamp, joint slip and bearing evidence rather than an assumption of monolithic material. |
| Through-bolt seats | M12, clearance 13, washers OD 37/ID 13/thickness 3; front central printed depth 31.75 | Curved front contact and split seam complicate washer support. No friction or full-area pressure distribution is assumed. |
| Rear contact | Two separate printed pads, each Y width 80, Z height 50, central depth 15.75 | Nominal curved bore radius is `Rpost + 0.25`; actual timber shape and settlement determine support. Pads do not replace timber/anchor review. |
| Cosmetic strap tunnels | Rounded 3-high, 5-long-X cuts across both webs at X=`front + 29…34`, Z=20…23/170…173 | These lie in structural material and are stress risers even though the straps only retain covers. Include local net section, layer continuity and crack inspection. |

There is no custom metal fabrication in this proposed head's carrier/contact
stack. Standard metal fasteners and the received pulley are retained. A
nominal M8 fit must not be imposed on an incompatible received pulley tang.

## Force at the carrier

Use installed CAD axes: X toward the span, Y across the span, Z upward. The
vertical line descends to the winch. Let `Ts` and `Tw` be span and descending-leg
tensions, `alpha` span elevation, and `beta` span azimuth from +X. Tensions are
nonnegative. The reaction transmitted through the pulley attachment is:

```text
Rx = Ts cos(alpha) cos(beta)
Ry = Ts cos(alpha) sin(beta)
Rz = Ts sin(alpha) - Tw
R  = sqrt(Rx² + Ry² + Rz²)
```

For equal tensions and horizontal +X span, `R = sqrt(2) Ts`. Different leg
tensions, friction, lateral articulation and changing span elevation require
the full vector. A guy acts downstream at the post; it does not subtract force
from the local pulley, pin or printed carrier.

At a representative attachment position `r = (e, 0, h)` relative to the centre
of the through-bolt rows, the moment is:

```text
Mx = -h Ry
My =  h Rx - e Rz
Mz =  e Ry
```

Use the actual attachment datum and transmitted force/couple from the fitted
block. The displayed block envelope does not establish its articulation or
whether a connector also transmits torque. Dimensions must come from the
selected CAD revision and received hardware, with extra applied couples added
when the connector is constrained.

## Free-pin equilibrium and line alignment

The provisional received block's pin-to-sheave distance is 40 mm. For a freely
pitching Y-axis pin with both line legs in XZ, the line resultant must pass
through the pin at static equilibrium. For equal horizontal/vertical 10 N legs,
it points 45° down/toward the span. A vertical block would transmit a nonzero
400 N mm couple about the pin; a freely rotating pin alone cannot hold that
pose. The revised CAD therefore pitches the block 45° and moves the pin
`40/sqrt(2) = 28.284271 mm` behind the sheave centre, retaining the desired
descending tangent in that one nominal equilibrium.

For another in-plane load vector with a downward component, use
`theta = atan2(Rx, -Rz)`,
`sheave X = pin X + dblock sin(theta)` and
`sheave Z = pin Z - dblock cos(theta)`, where `dblock` is the measured
pin-to-sheave distance. That change moves the tangent even though the pin
stays fixed. Span elevation, unequal tensions, friction and lateral loads
therefore need an articulation/clearance/alignment sweep. The displayed 45°
pose is not proof of usable fleet angle across winding travel. A constrained
block requires a defined torque path and its own review; no pin friction is
credited here.

## Screening the print and its fasteners

All lengths below are millimetres, forces newtons, and stresses N/mm² (MPa).
These are simple statics and section checks. They omit contact nonlinearity,
holes and notch concentration unless explicitly included, local infill,
layer defects, rib taper, torsion, cyclic damage, moisture and creep.

| Check | Parameterized calculation | Interpretation |
| --- | --- | --- |
| Rectangular beam surrogate | `I = b d³ / 12`, `S = b d² / 6`, `sigma = abs(N)/(b d) + abs(M)/S` | `b` is the combined effective solid web thickness and `d` the effective section depth at the checked location. A triangular rib or sparse infill is not a constant full rectangle. Check the narrow terminal, row/washer pockets and root independently. |
| Initial elastic surrogate | `delta = P L³ / (3 E I)` | Straight constant-section cantilever with a transverse end load `P`; initial deflection only. It does not predict the ribbed carrier's long-term displacement. |
| Two-row normal-force couple | `Nt = Rx/2 + My/s`, `Nb = Rx/2 - My/s` | `s` is vertical row pitch. A negative result denotes compression/contact in this idealized equilibrium, not a bolt being credited with compressive restraint across an opening joint. |
| Two-row transverse shear | `Yt = Ry/2 - Mx/s`, `Yb = Ry/2 + Mx/s`, `Zt = Zb = Rz/2` | Preliminary symmetric row sharing; each row's shear magnitude is `sqrt(Yi² + Zi²)`. Real timber, preload and clearance can redistribute it. |
| Printed row bearing | `p = Vi / (t_eff db)` | `db` is bolt diameter and `t_eff` the effective printed bearing length. Hole elongation and creep must be measured; nominal CAD thickness alone is insufficient. |
| Printed attachment lug(s) | `p = Fperp / (nl t dp)` | Pin axis Y, `Fperp = sqrt(Rx² + Rz²)`, lug thickness `t`, pin diameter `dp`. Current CAD has `nl=1`, `t=8` assembled across the split; joint sharing remains unverified. Side thrust `Ry`, pin bending and unequal tang contact require separate checks. |
| Lug net section | `sigma_net = Fperp / (nl t (w - dhole))` | `w` is lug width at the hole and `dhole` the clearance bore. Account for the actual section/load direction, split seam and local notch concentration. |
| Lug shear-out screen | `tau = Fperp / (2 nl t (a - dhole/2))` | `a` is hole-centre distance to the free edge in the force direction, assuming two shear planes per lug. This is not a notch or layer-fracture model. |
| Metal pin shear screen | `tau_pin = Fperp / (n pi dp² / 4)` | `n` actual shear planes; the fitted block/pin geometry determines whether single or double shear applies. It does not check pin bending or supplier capacity. |
| Printed compression under washer | `p_clamp = Ppreload / (pi (D² - dh²) / 4)` | Washer diameter `D`, clearance `dh`, per-bolt preload `Ppreload`. Washer flexure, uneven surface contact, print creep and timber settlement remain separate. |

Two vertically aligned bolts alone do not form a lateral axial-force couple
for `Mz`. Eccentric sideways loading needs a reviewed path through the wide
curved contact, timber and fastener bearing/bending. This study gives no
friction credit and does not establish that the contact can carry that moment.
Commodity metal compression sleeves, if selected, may control local plastic
compression only when their lengths, end contact and washer support fit the
actual stack. They do not eliminate plastic bearing, layer stress or timber
settlement and must not be assumed to bypass the entire load path.

## Reproducible synthetic examples

The following numbers are **arithmetic references only**. None is a configured
load, accepted geometry, material allowable or proof procedure. The dimensions
below first exercise the nominal attachment contract, then deliberately define
a separate simple beam/lug surrogate independently of the detailed CAD.

With equal horizontal/vertical 10 N leg tensions and the passive front-seat
datum `e=117.265729`, `h=65`, `s=110`, the nominal CAD bookkeeping gives
`My=1822.657 N mm` and row normal forces `21.570/-11.570 N`. Each row's vertical
shear is 5 N in magnitude. Projected row bearing over the central front/rear
seat depths would be `0.0131/0.0265 MPa`; contact distribution and joint slip
remain unverified. The one assembled 8 mm lug's M8 pin bearing screen is
`0.221 MPa`. A full-resultant scalar screen using width 32/bore 8.6 gives
net-section `0.0755 MPa` and, using minimum ligament 10.7, shear-out
`0.0826 MPa`; these omit the force-angle/notch/split effects and are not a
conservative bound on the real joint. The minimum ligament is not permission
to install a load, and the tall upper-lug root still needs bending review.

For `Ts = Tw = 10 N`, `alpha = beta = 0`, `e = 180 mm`, `h = 80 mm`, and
`s = 110 mm`: `R = (10, 0, -10) N`, `|R| = 14.142 N`,
`M = (0, 2600, 0) N mm`. Row normal forces are `28.636` and `-18.636 N`;
each row's vertical shear is `-5 N`. With two 8 mm lugs, 8 mm pin,
30 mm lug width and 20 mm edge distance, projected lug bearing is `0.110 MPa`,
net-section stress `0.040 MPa`, and the shear-out screen `0.028 MPa`.

For an independent rectangular surrogate `b = 16 mm`, `d = 60 mm`, `L = 180 mm`,
`P = 10 N`, `N = 10 N`, `M = P L`, and an illustrative instantaneous
`E = 1920 MPa`, `I = 288000 mm⁴`, `S = 9600 mm³`,
`sigma = 0.198 MPa`, and `delta = 0.0352 mm`. The modulus is a manufacturer
ASA coupon value shown below; the calculation is not a carrier deflection
prediction. A synthetic 1000 N preload on a 37/13 mm annular washer gives
`1.061 MPa` average contact pressure; it is not a tightening recommendation.

```python
from math import hypot, pi, sqrt

Ts = Tw = 10.0
e, h, s = 180.0, 80.0, 110.0
Rx, Ry, Rz = Ts, 0.0, -Tw
Mx, My, Mz = -h*Ry, h*Rx-e*Rz, e*Ry
assert abs(hypot(Rx, Rz)-sqrt(2)*10) < 1e-10
assert (Mx, My, Mz) == (0.0, 2600.0, 0.0)
assert abs((Rx/2+My/s)-28.6363636364) < 1e-8
assert abs((Rx/2-My/s)+18.6363636364) < 1e-8
Fperp = hypot(Rx, Rz)
t, dp, w, a = 8.0, 8.0, 30.0, 20.0
assert abs(Fperp/(2*t*dp)-0.1104854346) < 1e-8
assert abs(Fperp/(2*t*(w-dp))-0.0401765217) < 1e-8
assert abs(Fperp/(4*t*(a-dp/2))-0.0276213586) < 1e-8
b, d, L, P, N, E = 16.0, 60.0, 180.0, 10.0, 10.0, 1920.0
I, S = b*d**3/12, b*d**2/6
assert (I, S) == (288000.0, 9600.0)
assert abs(abs(N)/(b*d)+P*L/S-0.1979166667) < 1e-8
assert abs(P*L**3/(3*E*I)-0.03515625) < 1e-10
assert abs(1000/(pi*(37**2-13**2)/4)-1.0610329539) < 1e-8
# Current passive CAD attachment contract, still only a synthetic 10 N load.
block_advance = 40/sqrt(2)
e, h, s = 177.55-block_advance-32, 65.0, 110.0
My = h*Rx-e*Rz
assert abs(block_advance-28.2842712475) < 1e-8
assert abs(165-block_advance-136.7157287525) < 1e-8
assert abs(My-1822.6572875254) < 1e-8
assert abs(Rx/2+My/s-21.5696117048) < 1e-8
assert abs(Rx/2-My/s+11.5696117048) < 1e-8
assert abs(Fperp/(8*8)-0.2209708691) < 1e-8
assert abs(Fperp/(8*(32-8.6))-0.0755455963) < 1e-8
assert abs(Fperp/(2*8*10.7)-0.0826059324) < 1e-8
assert abs(5/(12*31.75)-0.0131233596) < 1e-8
assert abs(5/(12*15.75)-0.0264550265) < 1e-8
```

## Material and print-process candidates

Manufacturer references were inspected on 8 October 2026. Values are short-term
standard-specimen comparisons, not allowable stresses for ARBI. The three
Bambu V3.0 data sheets describe 100% infill specimens dried/annealed at 80 °C
for 12 h; those results cannot be transferred to an as-printed hollow carrier.
Annealing can alter fit and requires a dimensional check after the process.

| Candidate | Manufacturer coupon flexural strength XY / Z | Proposed use and unresolved evidence |
| --- | --- | --- |
| ASA | `65 ± 5 / 40 ± 3 MPa`; XY flexural modulus `1920 ± 130 MPa` | Outdoor prototype carrier/adapters and covers candidate. Manufacturer identifies UV/weather resistance, but this establishes no loaded lifetime. [Bambu ASA V3.0](https://store.bblcdn.eu/s8/default/cad72d633f104a1aa80dc6c5937cb642/Bambu_ASA_Technical_Data_Sheet.pdf). |
| PAHT-CF | Dry `125 ± 7 / 61 ± 5 MPa`; dry XY flexural modulus `4230 ± 210 MPa` | Structural candidate with a different qualified process and outdoor protection to establish. Manufacturer's product comparison reports wet XY/Z strength `115/49 MPa`; moisture is still a design condition. [Bambu PAHT-CF V3.0](https://store.bblcdn.eu/s8/default/91dea87af3414d878a0696d2c51b98f7/Bambu_PAHT-CF_Technical_Data_Sheet_V2.pdf), [manufacturer wet comparison](https://uk.store.bambulab.com/collections/carbon-fiber/products/paht-cf). |
| PC | `108 ± 4 / 55 ± 2 MPa`; XY flexural modulus `2310 ± 70 MPa` | Alternative structural candidate after printer, moisture, weather and fit evidence. The material name alone does not establish outdoor lifetime. [Bambu PC V3.0](https://store.bblcdn.eu/s8/default/ab03007d58814bc28a08145719b552de/Bambu_PC_Technical_Data_Sheet.pdf). |

Stratasys describes weaker interlayer properties, long-term thermoplastic creep,
environmental effects and use of metallic hard points. Its cited Nylon 12/12CF
weather guidance is not a PAHT-CF qualification. Consequently the proposed
carrier is printed with its main XZ load plane in the printer's XY plane,
continuous rib/perimeter paths and broad washer seats. Transverse loading
still crosses layers. Sheltering the core, using fillets and retaining metal
washers/sleeves are design responses, not demonstrated life or capacity.
[Stratasys FDM tooling design guide, sections 2.2–2.3](https://www.stratasys.com/contentassets/1a0cc7a8e7d14f29ac972189bfeade4c/dg_fdm_designconsiderationsfdmtooling_0718a.pdf?v=48fbe5).

The slicer record must identify printer, nozzle, material brand/batch, drying,
orientation, temperatures, layer height, extrusion width, perimeter count,
solid regions/infill, speed and any post-processing. Verify the actual printed
washer-seat thickness, hole clearance, rib continuity and post/pin fit. A
single preset or nominal infill percentage does not establish those features.

## Physical evidence to close the design

Establish the real continuous/peak/fault load vectors and attachment geometry,
then review each terminal, rib, root, bolt row, saddle, timber, guy and anchor
load path. Select allowables from the actual print process in relevant
orientations and environmental conditions, including sustained-load creep.
The low synthetic stresses above are not a substitute for those allowables.

Record coupon and complete-head initial displacement, displacement versus time,
washer-seat compression, bolt/preload loss, post slip, hole growth, line
alignment and permanent movement after unloading. Include reviewed hot/sun,
wet, lateral and cyclic cases and inspect interlayer cracks and the fitted pin.
Loads, durations, temperature range, cycles and acceptance limits are set by
the structural/test review; this document supplies none. Reconcile the dock
corner's extra loads and the powered line's groove/electrical requirements in
their own fitted configurations before clearing installed operation.
