# ARBI hardware sources

This directory contains the canonical parametric OpenSCAD sources for custom ARBI parts. Every current model is a **concept-unvalidated** starting point: it has not been proven dimensionally compatible, printable, structurally adequate, weather-resistant, or safe for an installed system.

## Model index

The machine-readable registry is [models.json](models.json). It declares stable model IDs, design revisions, source entrypoints, owning assemblies, documentation, status, and release output names.

| Model | Assembly | Revision | Purpose |
| --- | --- | --- | --- |
| `winch-drum` | [Winch](assemblies/winch/README.md) | `2.1.0` | Segmented drum assembly reference |
| `winch-drum-passive-1/2`, `winch-drum-powered-1/2/3` | [Winch](assemblies/winch/README.md) | `0.1.0` | Five variant-specific grooved body sections |
| `winch-drum-flange`, `winch-drum-flange-right`, `winch-drum-clamp-half`, `winch-drum-tail-clamp`, `winch-drum-alignment-pin` | [Winch](assemblies/winch/README.md) | `0.1.0` | Shared drum fabrication components |
| `winch-mount` | [Winch mount](assemblies/winch/mount.md) | `0.1.0` | Passive/powered mount assembly and base drilling reference |
| `winch-bearing-lower`, `winch-bearing-cap`, `winch-motor-stand`, `winch-coupling-guard` | [Winch mount](assemblies/winch/mount.md) | `0.1.0` | Bearing supports, adjustable motor stand and coupling cover |
| `camera-pod-envelope` | [Camera pod](assemblies/camera-pod/README.md) | `0.1.0` | Non-manufacturing pod and motion keep-out reference |
| `camera-pod-assembly` | [Camera pod](assemblies/camera-pod/README.md) | `0.1.0` | Non-manufacturing stacked payload layout |
| `camera-pod-spider` | [Camera pod](assemblies/camera-pod/README.md) | `0.1.0` | Four-line load-interface spider concept |
| `camera-pod-electronics-mount`, `camera-pod-docking-stud`, `camera-pod-line-strain-relief` | [Camera pod](assemblies/camera-pod/README.md) | `0.1.0` | Fixed electronics plate, mushroom stud and line fairleads |
| `camera-gimbal-base`, `camera-gimbal-yoke`, `camera-gimbal-camera-plate`, `camera-gimbal-rain-cap`, `camera-gimbal-optical-hood` | [Camera pod](assemblies/camera-pod/README.md) | `0.1.0` | Two-axis gimbal fabrication set |
| `dock-funnel` | [Dock](assemblies/dock/README.md) | `0.1.0` | Passive conical alignment funnel concept |
| `dock-nest` | [Dock](assemblies/dock/README.md) | `0.1.0` | Pod locating nest and mounting plate concept |
| `top-pulley-keeper` | [Corner station](assemblies/corner-station/README.md) | `0.1.0` | Line-retention keeper around the top pulley concept |

Fabrication models identify their canonical BOM part IDs in the registry. The winch-drum assembly, winch-mount, camera-pod envelope, and camera-pod assembly are `reference` artifacts with no BOM part IDs and export CSG. Individual drum, mount, camera-pod chassis, and gimbal components export fabrication STL and map to their BOM parts. All models remain concept-unvalidated.

## Validation

From the repository root:

```bash
pnpm cad:check
pnpm cad:check -- --require-openscad
```

The first command always validates registry metadata against its JSON Schema, checks source files, documentation links, relative OpenSCAD dependencies, bidirectional BOM fabrication-source traceability, and the exact pinned OpenSCAD version when the CLI is present. It compiles all registered models when `openscad` is installed. The second command requires the CLI and compilation and is the CI path. Both compile paths require OpenSCAD `2021.01`; a different installed version fails explicitly so model outputs are not presented as reproducible across an untracked toolchain change.

Compilation writes declared STL fabrication meshes and CSG reference artifacts into a temporary directory and removes it afterward. Generated STL, 3MF, CSG, and bulk render output are not committed. A successful compile proves only that source geometry can be evaluated.

## CAD downloads

[GitHub Releases](https://github.com/gredice/arbi/releases) publishes a complete CAD snapshot whenever OpenSCAD sources, the model registry, booklet inputs or CAD publication tooling change on `main`. New releases use `cad-vMAJOR.MINOR.PATCH`, starting at `cad-v0.1.0` and automatically incrementing the highest published or reserved patch version. A manual workflow dispatch can request a higher minor or major version. These are snapshot versions; each model keeps its own design revision and evidence status. Existing `cad-<full commit SHA>` releases remain historical records.

Each release includes every registered STL fabrication part, CSG reference assembly, hardware source ZIP, all three assembly booklets and packs, the complete CAD preview pack, and SHA-256 checksums. `cad-release.json` records the exact source commit, model revisions and CAD/booklet/preview input hashes. Publication first uploads a draft, then publishes the complete release. Retrying a published source commit reuses its immutable version and retries the site refresh. Latest follows source commit ancestry, so rerunning an older commit cannot replace a newer source release even if it receives a higher snapshot version.

Production site builds require the release inputs to match their checkout and all registered outputs to be present. Publishing Latest calls the required `ARBI_SITE_DEPLOY_HOOK` secret and verifies that [arbi.gredice.com](https://arbi.gredice.com) serves the current release or a subsequent one within ten minutes. A missing hook, failed request or failed verification fails the workflow visibly; rerun it to retry. While new geometry is being built, a premature Vercel production build fails and the last successful site remains live until the release-triggered rebuild succeeds. A release does not establish that a part is physically safe to build or install.

To keep compiled files locally, pass an empty output directory: `pnpm cad:check -- --require-openscad --output-dir /path/to/empty-directory`.

## Adding a model

1. Read [conventions.md](conventions.md).
2. Put reusable modules in `lib` and assembly-owned entrypoints in `assemblies/<assembly>`.
3. Add one registry entry per intended output in `models.json`.
4. Document purpose, default parameters, interfaces, known omissions, and required validation beside the model.
5. Run the required CAD check and review the generated geometry visually before proposing a release.

The system requirements and evidence status live in the matching documents under [`docs/assemblies`](../docs/assemblies).

The [winch mount family](assemblies/winch/mount.md) adds a bearing lower, bearing
cap, motor stand and coupling cover (0.1.0), with a passive/powered assembly
reference. Metal base stock is a drilling proposal, not a printed release part.

## Archived models

`models.json` separates active `models` from `archivedModels`. Archived entries retain stable IDs, revisions, evidence status, source paths, an archive reason and current replacement IDs. They have no BOM ownership, active inventory count, individual release mesh, preview or fabrication download. CAD validation still checks their source/includes so historical references cannot silently break.

The camera-pod archive covers the original concept kit and keep-out, six dry bench-only alternatives, and the retired fixed fairing, tilt-servo boot and rear camera cowl. The compact `payload-integrated-deck` is current; `payload-electronics-deck` is the dry bench alternative. The shared spider, spacers, pan mount and horn retainers remain active. Docking-stud and line-termination concepts have no selected replacement; archiving them does not resolve those interfaces.

The explicit dry bench booklet opts into only the archived entries marked `alternativeConfiguration: payload-bench`; it is labeled as an alternative and does not add parts to the current compact enclosure BOM or assembly. The enclosure exports 13 fabrication models (12 installed types plus the optional servo fit coupon) and installs 16 printed pieces. Other committed model families retain their documented optional configurations and variants; an unmerged replacement proposal does not supersede them.
