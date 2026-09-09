# Drum geometry check — 2026-09-08

Status: **concept-unvalidated**. This is computational and visual inspection,
not physical print, assembly or load evidence. See the [print and assembly guide](README.md).

## Geometry evidence

OpenSCAD 2021.01 compiled the registry's original 15 entries with
`pnpm cad:check -- --require-openscad`. The subsequently added right-hand flange
was separately compiled to STL with the same executable. The assembly reference
uses that handed print rotated into place. Both passive and powered assemblies
were exported/rendered for inspection. Generated artifacts remain ignored.

Independent inspection with Python `trimesh` found all ten fabrication exports
watertight, each with one connected body:

| Parts | Bounds X × Y × Z (mm) |
| --- | --- |
| Passive sections 1–2 | 100 × 100 × 123.45 |
| Powered sections 1–3 | 100 × 100 × 190.1 |
| Left and right flanges | 128 × 127.918 × 6 |
| Clamp half | 64 × 15.6 × 20 |
| Tail clamp | 28 × 12 × 6 |
| Alignment pin | 5 × 5 × 8 |

All fit within the stated X1C design allowance. Slicer placement and print
quality have not been inspected. The asymmetric bolt pattern requires separate
left/right flanges; reflecting the right print about Y and rotating it 180°
about X in assembly preserves the body bolt and pin positions.

Exported meshes were sectioned 0.00001 mm inside each adjacent body end face.
For the outer profile (segment endpoints at radius greater than 48 mm), the
maximum bidirectional endpoint-to-segment distance was 0.000091 mm at the passive
joint and 0.000129 / 0.000074 mm at the two powered joints. This checks that the
exported groove phase continues across section boundaries; it does not predict
the seam step on an actual print. Keying, flatness and clamping require inspection.

## Shaft stiffness screening

The BAUHAUS rod remains the selected prototype stock. Its increased powered-drum
span is a significant unresolved mechanical issue. For a simply supported bare
8 mm rod, assuming steel E = 200,000 N/mm² and a central transverse force:

`I = π d⁴ / 64 = 201.06 mm⁴`; `deflection = F L³ / (48 E I)`.

Bearing-center spans in this layout are body width + 43 mm:

| Variant | Span | Deflection at illustrative 20 N | At illustrative 60 N |
| --- | ---: | ---: | ---: |
| Passive | 289.9 mm | 0.252 mm | 0.757 mm |
| Powered | 613.3 mm | 2.390 mm | 7.171 mm |

These illustrative forces are not operating ratings. The calculation ignores
drum stiffening, actual load position, bearing-housing compliance and dynamics;
it is a screening model, not a prediction of the finished assembly. Resolve shaft
and support stiffness before loaded powered-drum operation. A successful STL
export does not qualify a long hot-rolled rod, its bearing fit or straightness.

## Remaining physical evidence

Start with the short PLA joint specimen and clamp fit described in the guide.
Check rod diameter/straightness, bore fit, clamp grip, flush keyed joints, groove
seams, actual wire envelope, tail retention, abrasion and payout calibration.
The nominal 32 m capacity uses an assumed circular hybrid envelope and three
retained turns. The coupling's 10 mm engagement is still a layout allowance.
Bearing housings, motor/slip-ring mounts and conductor strain relief are outside
this fabrication set. ASA needs separate process, fit and load/cycle qualification.
