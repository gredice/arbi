# Round-pole pulley mount proposal

Revision `0.1.0`, status `concept-unvalidated`, 7 October 2026.

## Intent and baseline boundary

Create an editable 3D concept that attaches a purchased marine pulley to a round
post. Two half collars can be installed around an existing pole without access
to its end. Four transverse clamp bolts join the halves; two integral gusseted
arms support a removable pulley attachment pin. The eye sits between spacer
sleeves so tightening the pin stack need not squeeze the pulley body.

This is a proposed friction-clamp alternative to the committed
[through-bolted steel bracket](../../../docs/assemblies/corner-station/README.md).
It does not change the installed-system baseline, current purchasing quantities
or approved physical interfaces. The pole diameter and actual pulley have not
been supplied for this concept. Defaults below are design assumptions from the
repository's starting range, not measurements of received parts.

## Starting dimensions

| Interface | Default | Meaning |
| --- | ---: | --- |
| Pole outside diameter | 120 mm | Adjustable 100–140 mm; re-export matching halves |
| Bore diameter | 120.5 mm | 0.25 mm radial fit allowance; no liner modelled |
| Collar height / radial wall | 90 / 10 mm | Concept dimensions, not strength sizing |
| Split gap | 3 mm at both sides | Nominal open gap between halves |
| Clamp fasteners | 4 × nominal M8 × 60 | Ø8.6 mm clearance; washers and locking nuts shown |
| Clamp row heights | 22 / 68 mm | 46 mm vertical separation, measured from collar bottom |
| Clamp column spacing | 160.5 mm | Varies with pole diameter and collar wall |
| Pin offset from pole surface | 110 mm | Pin X = 170 mm for the default Ø120 pole |
| Pin height | 60 mm | Above collar bottom |
| Clevis opening / cheek thickness | 22 / 8 mm | 38 mm total outside width |
| Attachment pin | Nominal M8 × 60 | Ø9 mm holes; verify actual eye and bearing surfaces |
| Pulley eye width / spacers | 12 / 2 × 5 mm | Generic nominal eye; spacers Ø14 with Ø8.6 bore |
| Sheave diameter / width | 30 / 18 mm | Generic visualization only |
| Pin to sheave-center drop | 42 mm | Sheave center Z = 18 mm |

The approximate line route turns 90 degrees from the garden span to a vertical
drop toward the winch. Its centerline is shown for layout only. The down-going
tangent is 95.75 mm from the nominal pole surface at the default geometry.
The pulley body, eye, groove, bearing, spacer length and attachment freedom must
be replaced with measured supplier geometry before fit decisions. No supplier
SKU, load rating or keeper fit is asserted by this generic block.

## Sources and export

The [assembly README](README.md) links all registered entrypoints. Parameters
are in [hardware/lib/pole-pulley-mount.scad](../../lib/pole-pulley-mount.scad)
and can be overridden with OpenSCAD `-D`. Use identical overrides on both halves
and the assembly. Units are millimetres; +Z runs up the pole, +X toward the span,
and Y is the attachment-pin axis. Both fit solids retain the installed frame
with collar bottom at Z=0. A slicer orientation, supports and print process have
not been qualified.

```bash
mkdir -p hardware/generated/pole-pulley-mount
openscad -D 'pole_diameter_mm=120' \
  -o hardware/generated/pole-pulley-mount/front.stl \
  hardware/assemblies/corner-station/pole-pulley-mount-front.scad
openscad -D 'pole_diameter_mm=120' \
  -o hardware/generated/pole-pulley-mount/rear.stl \
  hardware/assemblies/corner-station/pole-pulley-mount-rear.scad
openscad -D 'explode_mm=45' \
  -o hardware/generated/pole-pulley-mount/exploded.csg \
  hardware/assemblies/corner-station/pole-pulley-mount-assembly.scad
```

The assembly exposes `show_pole`, `show_pulley`, `show_hardware` and `show_line`.
The exploded option separates the rear and front assemblies along X and omits
the clamp bolts for clarity. The pole, hardware and pulley are reference geometry;
only the front and rear entrypoints produce custom-part fit solids.

To regenerate the checked diameter variants, assembly GLB, assembled/exploded
PNG previews, source-hash report and portable ZIP, run:

```bash
python scripts/build-pole-pulley-concept.py
```

This needs OpenSCAD 2021.01 on PATH and Python `numpy`, `trimesh`, `manifold3d`
and `vtk`. The [builder](../../../scripts/build-pole-pulley-concept.py) writes
only to ignored `hardware/generated/pole-pulley-mount` by default. The GLB uses
metres as required by glTF; SCAD and STL dimensions remain in millimetres.

## Load path and unresolved decisions

Proposed load path: line → purchased pulley → metal attachment pin and spacers →
twin arms → collar → pole contact. Unlike the baseline, this proposal depends on
clamp friction to resist sliding and rotation. A circular pole has no positive
anti-rotation key in this model. Collar closure, preload and contact pressure
cannot be inferred from the fit allowance, and the two halves must not bottom
out before obtaining the required contact.

For a frictionless 90-degree line turn with equal tension T in both legs, the
pulley reaction magnitude is √2 T; the actual load case also includes dynamics,
line angles and unequal tension. No configured T, friction coefficient or
allowable stress is available here, so no capacity, bolt torque or proof load
is assigned. Material and manufacturing method remain open. Printed STLs are
for unloaded fit/appearance mock-ups, not approved overhead structural parts.
A metal implementation still needs a fabrication design and load assessment.

Before selecting this alternative, measure the pole at both clamp rows, account
for taper/ovality and timber moisture movement, select the exact closed pulley,
verify the pin/spacer stack and articulation, and check the complete line path
with the actual winch. Resolve clamp slip/rotation, creep, corrosion and weather
exposure, local pole crushing, fastener retention and the independent retention
strategy. Physical load testing and review must precede installed use.

## CAD evidence

The [nominal geometry record](pole-pulley-mount-check.md) records exports and
checks for this revision. Rendering and watertight solids establish only CAD
consistency. They do not establish physical fit, strength or field acceptance.
