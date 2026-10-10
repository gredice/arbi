# BOSL2 in ARBI

ARBI vendors [BOSL2](https://github.com/BelfrySCAD/BOSL2), the Belfry OpenSCAD
Library, to simplify shared shapes, sampled surfaces and cable reference meshes.
No separate library installation or `OPENSCADPATH` configuration is needed.

## Pinned source

- Version: [v2.0.766](https://github.com/BelfrySCAD/BOSL2/releases/tag/v2.0.766).
- Upstream commit: [e173fa0ae45f9e2082e0d8c0382dae98621b7c20](https://github.com/BelfrySCAD/BOSL2/commit/e173fa0ae45f9e2082e0d8c0382dae98621b7c20).
- Supported compiler: OpenSCAD 2021.01, as pinned in [the model registry](../../models.json).
- License: [BSD 2-Clause](LICENSE), retained separately from ARBI's license.
- [manifest.json](manifest.json) records the release archive SHA-256 and hashes of
  every unmodified upstream file. The copy contains all root-level `.scad` files
  and the upstream license; upstream examples, tests, images and tooling are omitted.

The upstream library remains labelled beta. Update it deliberately in a reviewed
PR; do not substitute a globally installed version or track its moving `master`.
Git disables whitespace diagnostics only for these unmodified third-party SCAD
files so upstream bytes, including their formatting, remain reproducible.

## Authoring models

Include the existing ARBI helpers using the path appropriate to the source file:

```scad
include <../../lib/arbi.scad>

// Existing helper interface: corner at the origin, flat top and bottom.
arbi_rounded_box([60, 40, 6], radius=3, facets=64);
```

[arbi.scad](../../lib/arbi.scad) includes this pinned `std.scad` and retains the
project's helper arguments, assertions and named epsilon. Reuse those helpers
for existing shapes. For new geometry, BOSL2 functions are available after that
include:

```scad
// BOTTOM keeps the base on Z=0; edges="Z" rounds only vertical edges.
cuboid([60, 40, 6], rounding=3, edges="Z", anchor=BOTTOM, $fn=64);

// A child's bottom follows the parent's top when its thickness changes.
cuboid([60, 40, 6], anchor=BOTTOM)
    attach(TOP, BOTTOM, overlap=ARBI_EPSILON)
        cyl(d=12, h=10, $fn=64);
```

Use `include`, rather than `use`, when importing BOSL2: its constants and
initialization are required. `std.scad` extends native primitives such as
`cube()` and `cylinder()` with attachment support. Most BOSL2 alternatives,
including `cuboid()` and `cyl()`, center by default; set anchors explicitly when
preserving an existing part's datum. Specify release facet counts explicitly.

Specialized files such as `screws.scad` require a separate relative include under
this directory after `arbi.scad`. Do not replace bought fasteners, measured fits,
groove profiles or load-bearing interfaces with library defaults.

## Current use and migration boundaries

| Source | BOSL2 use | Geometry retained |
| --- | --- | --- |
| [Shared helpers](../../lib/arbi.scad) | Extruded rounded `rect()` in `arbi_rounded_box()` | Public centering, radius, facets and flat mating faces |
| [Integrated camera head](../../lib/camera-pod-integrated-head.scad) | `vnf_vertex_array()` | Superelliptic rings, neck blend and slope-compensated inner profile |
| [Enclosure shoulder](../../lib/camera-pod-enclosure.scad) | `vnf_vertex_array()` | Rounded tray-to-neck sections and wall offsets |
| [Winch loom reference](../../lib/winch-cover.scad) | `bezier_points()` and `vnf_vertex_array()` | Route samples, 24-sided sections and original tangent frames |

The rounded-box helper extrudes `rect()` so only vertical edges are rounded.
This avoids the extra 3D corner clipping in `cuboid()`, which produced zero-area
triangles after the stand adapter's Boolean cuts with this pinned toolchain.
Keep the shared helper for these existing mating faces and retain the adapter's
strict degenerate-face check.

The shared `arbi_ring_volume()` adapter uses `style="quad"` with separate polygon
caps and explicit winding. In this pin, `vnf_vertex_array()`'s quad sides wind
opposite to its automatic caps; using both directly fails closed-mesh checks.
The adapter also preserves each quad's first vertex so OpenSCAD retains the
existing tessellation. This removes manual face indexing from models without
changing the profile mathematics. Existing printable entrypoints, design
revisions, assembly datums and clearance assertions remain authoritative.

Further migrations can use `skin()`, `path_sweep()`, oriented cylinders and
named attachments where they simplify a real edit. Compare the resulting meshes
and assembly clearances first: sweep frames, triangulation, defaults and corner
treatments can alter a shape. Preserve the drum's globally phased groove and
asymmetric bolt pattern. Rendering performance must be measured separately;
shorter source does not establish a speed improvement.

The [attachment tutorial](https://github.com/BelfrySCAD/BOSL2/wiki/Tutorial-Attachment-Overview),
[shape tutorial](https://github.com/BelfrySCAD/BOSL2/wiki/Tutorial-Shapes3d) and
[VNF reference](https://github.com/BelfrySCAD/BOSL2/wiki/vnf.scad) describe these APIs.
Online documentation can describe a newer revision; the vendored source comments
are the reference for this pin. Custom compound shapes need declared datums and
an `attachable()` wrapper before using attachment operations. For a subtractive
attached child, follow BOSL2's `diff()`/tag rules and recheck the Boolean result.

## Reproduction and updates

`pnpm cad:check -- --require-openscad` verifies the pinned version, file inventory,
license and source hashes before compiling the registry. Changes to anything in
`hardware/vendor/` select CAD, previews and all five booklet variants in CI.
Release provenance and portable source packs include the library, this guide,
the manifest and its license. Packed copies use relative includes too.

For an upgrade, download a tagged upstream archive into a temporary directory,
verify the tag's commit and record the archive checksum. Replace all vendored
root `.scad` files and `LICENSE` together, regenerate the per-file SHA-256 values
in `manifest.json`, and update the expected version/commit in
[the CAD validator](../../../scripts/check-cad.mjs). Keep upstream files unmodified;
place project adaptations in `hardware/lib`.

Run all registered exports, compare affected fabrication meshes against the
previous pin, and run the owning mesh, clearance, service, preview and booklet
checks. Recompile representative entrypoints from extracted source packs without
a global BOSL2 installation. Include the measured results in the upgrade PR.
Source checks do not change a model's physical validation status.
