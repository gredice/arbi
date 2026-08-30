# ARBI hardware sources

This directory contains the canonical parametric OpenSCAD sources for custom ARBI parts. Every current model is a **concept-unvalidated** starting point: it has not been proven dimensionally compatible, printable, structurally adequate, weather-resistant, or safe for an installed system.

## Model index

The machine-readable registry is [models.json](models.json). It declares stable model IDs, design revisions, source entrypoints, owning assemblies, documentation, status, and release output names.

| Model | Assembly | Revision | Purpose |
| --- | --- | --- | --- |
| `winch-drum` | [Winch](assemblies/winch/README.md) | `0.1.0` | Non-manufacturing nominal 100 mm capacity/groove study |
| `camera-pod-envelope` | [Camera pod](assemblies/camera-pod/README.md) | `0.1.0` | Non-manufacturing pod and motion keep-out reference |
| `camera-pod-spider` | [Camera pod](assemblies/camera-pod/README.md) | `0.1.0` | Four-line load-interface spider concept |
| `dock-funnel` | [Dock](assemblies/dock/README.md) | `0.1.0` | Passive conical alignment funnel concept |
| `dock-nest` | [Dock](assemblies/dock/README.md) | `0.1.0` | Pod locating nest and mounting plate concept |
| `top-pulley-keeper` | [Corner station](assemblies/corner-station/README.md) | `0.1.0` | Line-retention keeper around the top pulley concept |

Fabrication models identify their canonical BOM part IDs in the registry. The winch-drum study and camera-pod envelope are deliberately `reference` artifacts with no BOM part IDs and export CSG rather than printable meshes. All defaults illustrate parameter ownership and interfaces; they are not purchasing, printing, or construction instructions.

## Validation

From the repository root:

```bash
pnpm cad:check
pnpm cad:check -- --require-openscad
```

The first command always validates registry metadata against its JSON Schema, checks source files, documentation links, relative OpenSCAD dependencies, bidirectional BOM fabrication-source traceability, and the exact pinned OpenSCAD version when the CLI is present. It compiles all registered models when `openscad` is installed. The second command requires the CLI and compilation and is the CI path. Both compile paths require OpenSCAD `2021.01`; a different installed version fails explicitly so model outputs are not presented as reproducible across an untracked toolchain change.

Compilation writes declared STL fabrication meshes and CSG reference artifacts into a temporary directory and removes it afterward. Generated STL, 3MF, CSG, and bulk render output are not committed. A successful compile proves only that source geometry can be evaluated.

## Adding a model

1. Read [conventions.md](conventions.md).
2. Put reusable modules in `lib` and assembly-owned entrypoints in `assemblies/<assembly>`.
3. Add one registry entry per intended output in `models.json`.
4. Document purpose, default parameters, interfaces, known omissions, and required validation beside the model.
5. Run the required CAD check and review the generated geometry visually before proposing a release.

The system requirements and evidence status live in the matching documents under [`docs/assemblies`](../docs/assemblies).
