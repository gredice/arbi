# Rounded dock shelter design record

14 October 2026. **Owner-selected appearance direction; implemented nominal
CAD. Physical acceptance pending.**

This records the initial rounded-crown revision `0.2.0`. The
[15 October lower-enclosure follow-up](lower-enclosure.md) adds dedicated panel
bosses to crown/reference revision `0.3.0`; its quantities, print datum,
service order and additional dead load govern the current kit. The original
crown shape and retained guide/stud interfaces below remain applicable.

The owner selected the [dock appearance board](../../assets/dock/concept-board-2026-10-14.png)
to align the dock with the [camera pod and covered winch product language](../../project/industrial-design.md).
The board guides shape and finish only. It omits positioning lines and cannot
establish geometry, capture, retained load, weather protection or safe operation.

## Scope and boundaries

The roof becomes a broad rounded warm-white removable crown over the
charcoal guide, locator, fork and cantilever arm, using neutral silver bought
hardware. Retain four individually printed roof quadrants, exposed service seams
and the current roof/carrier/arm fastening topology. The shell must remain
separate from the pod-retention load path.

The [DOCK-IF-01 package](design-package.md) still owns the final stud, locating
bore, manually released fork, spider bridge, post configuration and dock axis.
Docking loads pass from stud to bridge and spider, and from fork/locator to arm
and post. The pod hood and new shelter do not retain the pod. Do not copy an
illustrative shape into the load-bearing guide or hide the manual fork behind
an inaccessible cosmetic skirt.

The roof bolts share the carrier/arm stack. Roof removal is an unloaded bench
service operation: independently support the dummy and locator, preserve the
guide/carrier fasteners and inspect the complete stack before reassembly. A
removable cover does not authorize work on a loaded or installed dock.

Keep the downward guide mouth, four open line corridors, fastener/tool access,
water exits and the unobstructed lower camera envelope. Four cable paths remain
required even though the artwork omits them. Do not turn roof seams into a
claim of sealing or add an unreviewed actuator, sensor or electrical interface.

## Implemented geometry

The crown is 300 × 300 mm with R40 plan corners, a skirt down to Z175 and an
apex at Z220 in the existing dock frame. Its hollow nominal skin is 2.8 mm.
Four roof quadrants retain the 49 mm spacers from Z156–205 and four M4 × 100
roof/carrier/arm bolts. Integral Ø16 bosses run Z205–219.2; Ø11 top-access
pockets seat the upper washers at Z215 and bolt heads at Z216. Seam-bolt axes
remain at radius 80 mm on the split boundaries, Z203; the seam tabs extend
Z198–218 to connect to the curved skin. These are nominal CAD datums, not an
accepted dimensional tolerance or material specification.

In this initial record, `dock-roof-quarter`, `dock-guide-quarter` and the `dock-assembly` reference are
revision `0.2.0`; the pod stud is revision `0.1.1`. The roof and guide have four
18 mm passages open radially
to their outer edges, beginning at radius 95 mm with an end center at radius
104 mm. They preserve the synthetic vertical line pose and provide a removal
route instead of enclosing the permanently attached lines in holes. Surveyed
sloping lines, their fittings/conductors and full approach sweeps remain open.

The initial revision replaces four roof and four guide quadrants and one stud.
The arm root, extension, rear pads, locator, fork, bridge, shoes and spacers retain
revision `0.1.0`; inspect existing prints and received hardware before reuse.

The stud now has a flat Ø24 × 11 mm head from Z149.8–160.8. This replaces the
flared retained edge, which would wedge on the fork slot before reaching a
flat bearing face. The new underside is nominally 0.2 mm above the fork's
Z149.6 top when the head is at the upper stop; the supported dummy settles
that gap onto the flat face. The Ø14 stem and Ø17 fork slot retain 3.5 mm ideal
overlap per side before offset/tolerance. No bearing strength is established.
Print the stud head down, with supports reviewed beneath its upper Ø32 flange;
inspect the Ø4.5 axial bore, head face and washer seat afterward.

Initial `0.2.0` roof quadrants print rim down from Z175. Current `0.3.0`
quadrants print mounting-seat down from Z174; use the current supplied meshes
and the lower-enclosure record's support guidance. Review and fit supports
for the crown and bosses; the hollow shell is not a
support-free print claim. One quarter per bed preserves the existing nominal
256 mm study envelope, subject to the full slice and actual printer.

For the current kit, remove all four lower panels before this roof service path.
The nominal service path removes all four roof-stack bolts and seam bolts,
lifts one quarter 60 mm, then translates it 100 mm toward the center along its
diagonal. Reverse to install. The [booklet builder](../../../scripts/dock-booklet/README.md)
samples that path for all four quarters with four Ø1.5 mm vertical line probes
running Z=-200–800, avoiding a false result from short probes below the lifted
roof. It also records seven mesh skin sections, a local Ø10 × 80 mm upper
socket envelope and Ø10 × 20 mm seam socket envelopes beneath the crown.
These are sampled rigid geometry checks; the complete tool/hand approach,
actual line slope, fittings, harness and real service access remain unverified.
The seven sampled crown sections measure 2.8000–3.1734 mm skin thickness;
this range applies to those sections only. The pack's geometry report records
the exact mesh identities, checks and control collisions for each fresh build.

## Nominal shelter dead load

The roof-only estimate compares the four old `0.1.0` quarters with four new
`0.2.0` quarters. Old source volume is 56.840319 cm³ per quarter; new is
91.782998 cm³. The old geometry and recipe are from source commit
`7370779c0b9b19c47ae53cb630217a55dc13b4a9`; the new source mesh volumes are
recorded in the [fabrication catalog](../../../bom/catalog/fabrication.json).
The prior recipe used PETG Basic at 1.25 g/cm³ for the old roof; the current
recipe assigns PETG Matte at 1.37 g/cm³ to the new white crown. Thus this
comparison includes both geometry and
material changes. With `g=9.80665 m/s²` and the roof center 0.390 m inward of
the post face, `mass=volume×density`, `weight=mass×g` and
`post-face moment=weight×0.390` give:

Convert the volume-derived mass from grams to kilograms before applying
gravity; the lever is in metres.

| Four roof quarters only | Solid volume | Estimated mass | Weight | Post-face moment |
| --- | ---: | ---: | ---: | ---: |
| Old sloping roof, PETG Basic | 227.361 cm³ | 284.202 g | 2.787 N | 1.087 N·m |
| New rounded crown, PETG Matte | 367.132 cm³ | 502.971 g | 4.932 N | 1.924 N·m |
| Increase | 139.771 cm³ | 218.769 g | 2.145 N | 0.837 N·m |

This is an unsliced nominal CAD calculation, excluding supports, spacers,
hardware, arm, pod, cable tensions, wind, contact and service forces. It supplies
one dead-load contribution for LC-05, not a load rating or strength proof.
Recalculate complete arm/post reactions with the actual material/slice and
reviewed forces before load testing or installation. The revised pod-side
bridge, four shoes and stud total 95.251585 cm³, or 119.064 g at the catalog's
PETG Basic density, before hardware. That flying-mass addition remains a
separate complete-pod acceptance gate.
The current `0.3.0` crown's added bosses and lower panels are outside this
historical `0.2.0` roof-only comparison; use the lower-enclosure record and
current fabrication catalog for their contribution.

## Feasibility and acceptance

Canonical [dock sources](../../../hardware/assemblies/dock/README.md), registry,
BOM and the regenerated [booklet/source pack](booklet/README.md) must agree on
revisions, quantities, print poses, assembled datums and hardware stacks.
Nominal mesh checks must cover printable envelopes, roof seams/bosses, guide
clearance, line corridors and retained access against the actual current pod.
They do not establish support-free printing, weather resistance or strength.

The kit remains **concept-unvalidated and restricted to an independently
supported dummy**. Manual release is separate from the intended automatic
spring capture. Actual printer/slices, material/process, roof seam/drainage,
wind load, post/arm joints, complete pod mass, bridge clamp retention,
line/harness sweep and latch/observation hardware still need the
[bench plan](bench-test-plan.md) and a completed [acceptance record](acceptance-record.md).
All-line clearance through power loss remains a separate LS-18 gate.
