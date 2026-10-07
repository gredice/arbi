# Round-pole mount nominal CAD record

Revision `0.1.0`, `concept-unvalidated`, 7 October 2026.

This record covers only the [split-clamp proposal](pole-pulley-mount.md), using
OpenSCAD 2021.01 and nominal geometry. Physical material, clamp slip resistance,
loads, received-part fit and installed operation remain unverified.

## Export and geometry checks

`python scripts/build-pole-pulley-concept.py` exports both custom halves at pole
diameters 100, 120 and 140 mm. All other dimensions remain at the r0.1.0 defaults.
Six exported meshes were each a single watertight solid with positive volume and
collar bottom at Z=0. The front is one connected solid, including both arms.

| Pole diameter | Front envelope X × Y × Z | Rear envelope X × Y × Z |
| --- | --- | --- |
| 100 mm | 173.5 × 172.5 × 90 mm | 58.75 × 172.5 × 90 mm |
| 120 mm | 183.5 × 192.5 × 90 mm | 68.75 × 192.5 × 90 mm |
| 140 mm | 193.5 × 212.5 × 90 mm | 78.75 × 212.5 × 90 mm |

Independent mesh booleans at each diameter found less than 0.001 mm³ overlap
between the front/rear pair and between either half and the nominal pole,
four M8 clamp shanks and their Ø18 mm washer envelopes. The attachment-pin shank
and the nominal 22 mm eye/spacer opening also cleared the front part. Washer and
eye envelopes are shortened by 0.02 mm to distinguish intentional face contact
from penetration. This is a numerical test allowance, not a manufacturing fit.

At the default Ø120 mm pole, the exported generic pulley, metal-hardware and
line-route meshes had less than 0.001 mm³ overlap with either mount half. The
default front/rear solid volumes were 357,917.151 / 264,313.526 mm³. These are
full-solid CAD volumes, not print-mass estimates.

Assembled and exploded previews were rendered from the actual exported meshes
and visually inspected. The GLB is an assembly reference, including purchased
hardware envelopes; it is not a fabrication mesh. The builder emits source
SHA-256 hashes with its geometry report in the ignored output folder.

## Local verification

| Check | Result on 7 October 2026 |
| --- | --- |
| `pnpm cad:check -- --require-openscad` | Passed: all 71 registered models compiled with OpenSCAD 2021.01 |
| `python scripts/build-pole-pulley-concept.py` | Passed: six custom-part meshes, nominal interface checks, CAD renders, GLB and ZIP |
| `pnpm bom:generate` then `pnpm bom:check` | Passed; 234 existing report incompleteness warnings; baseline build quantities and costs unchanged |
| `pnpm docs:check` | Passed: 171 Markdown files |
| `git diff --check` | Passed |
| Invalid assembly overrides | Ø80 pole, zero split gap and 10 mm clevis gap rejected by assertions |
| Portable source pack | ZIP integrity passed; extracted assembly compiled independently to CSG |
| Reused output directory | Fresh build excluded a deliberately pre-existing obsolete STL; ZIP contained only the 16 current generated artifacts |
| GLB scale and provenance | Z envelope 0.310 m; all recorded CAD source hashes matched |

These are local checks. No CI run, fabricated prototype or physical inspection
is claimed by this record.

## Scope of the result

These checks cover nominal static CAD at three pole diameters. They do not
simulate closure of the split collar, friction, deflection, bolt preload, pole
taper/ovality, printing, material strength, articulation under changing line
angles, full drum travel, keeper retention or weather exposure. The purchased
pulley has not been selected or measured. This record does not promote the model
above `concept-unvalidated` and does not replace the through-bolt baseline.
