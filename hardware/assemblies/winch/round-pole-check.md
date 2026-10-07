# Round-pole r0.1.0 nominal geometry record

Checked 7 October 2026 with OpenSCAD 2021.01 and the [round-pole mesh checker](../../../scripts/check-winch-pole-meshes.py). Status remains **concept-unvalidated**. The [JSON record](round-pole-check.json) identifies exact source, mesh and checker hashes. [Design and installation sequence](round-pole.md); [proposal and physical acceptance](https://github.com/gredice/arbi/issues/104).

The default fabricated saddle geometry fits nominal 120 mm timber. The checker regenerates matching 100 and 140 mm cases directly from canonical CAD using `-D pole_diameter=100/140`. These study cases are not alternate sizes hidden in the supplied 120 mm STL. The curved saddles are machined metal envelopes; do not print them as load-bearing parts.

## Results

| Nominal timber diameter | Starting M8 bolt | Tip beyond nominal locking nut | Rear/side/top/bottom rays blocked | Without underside closure |
| --- | --- | ---: | ---: | ---: |
| 100 mm | 160 mm | 7.8 mm | 180 | 20 underside rays expose hardware |
| 120 mm | 180 mm | 7.8 mm | 180 | 20 underside rays expose hardware |
| 140 mm | 200 mm | 7.8 mm | 180 | 20 underside rays expose hardware |

**3,081 nominal checks passed.** Each generated front/rear saddle, main nut cap, underside closure and cable guide is one watertight solid with consistent winding and positive volume. Matching timber contact checks permit only a 0.001 mm radial inward allowance for ASCII STL rounding; other checked intersections remain <0.001 mm³. This numerical allowance is not a machining or timber fit tolerance.

At each diameter, 8 mm bolt shanks clear the 9 mm saddle bores. Caps/closures clear conservative 24 mm OD × 1.6 mm washers, 13 mm AF × 8 mm nuts and full nominal tips. The main cap's direct 2 mm rearward-pull control collides with the integral rails. After withdrawing the underside closure downward, the cap lifts +Y through 40 mm and withdraws rearward without rigid interference; paths are sampled every 2 mm. Removing both covers exposes all 180 rear-hardware witness rays. Removing only the underside closure exposes the 20 direct underside rays, reproducing the gap that the closure fixes.

For both passive and powered enclosures, the assembled timber/saddles/caps/guide clear the actual hood, shutter, fascia, rear-shield and covered-base meshes. Two continuous nominal 10 mm cable meshes clear that combined assembly and each other from the under-drum route through the lower ports onto the pole. They also clear the guide's nominal 11 mm channels and both modelled 2.5 × 1 mm soft ties. The two ties clear the guide through-slots, timber, cables and each other across all three diameters. The [full-cover record](full-cover-check.md) separately verifies existing front/side/rear hardware concealment and original cover/core service paths.

## Limits

The rigid closure fit has nominal zero-clearance contacts and needs print calibration and retention tests. The main cap uses a gravity stop; the guide's 7 mm opening needs compliant deformation for a 10 mm loom. None of these checks establishes insertion force, vibration retention or weather behavior. The motor lead origin is provisional, and the 30 mm internal bend is not a supplier-approved cable limit.

No saddle material/manufacturing qualification, timber capacity/shape, bolt bending, preload, installation, corrosion, thermal, rain/UV or loaded operation evidence is provided. Obtain physical fit and qualified structural/proof-load acceptance before installation. Structural bolts remain inspectable after removing the cosmetic caps.
