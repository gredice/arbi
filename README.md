# ARBI

ARBI, the Automatic Raised Bed Imaging system, is an open engineering project for a four-cable outdoor camera robot. This GitHub repository is the sole source of truth for the project. Its committed files and Git history define the documentation, parametric OpenSCAD models, bill of materials, software, tests, and design decisions; GitHub issues and pull requests hold the corresponding work and review history.

The current material is a **concept and design baseline**. It is not evidence of a built, certified, or safe installation. See the [design status](docs/project/design-status.md) and [safety case](docs/system/safety-case.md) before using any design information.

## Start here

- [Engineering documentation](docs/README.md)
- [Goals and V1 scope](docs/project/goals-and-v1-scope.md)
- [System architecture](docs/system/architecture.md)
- [Current design status](docs/project/design-status.md)
- [Repository source-of-truth policy](docs/project/repository-source-of-truth.md)
- [Hardware and OpenSCAD sources](hardware/README.md)
- [BOM data and generated reports](bom/README.md)
- [Contributing](CONTRIBUTING.md)

## Repository map

- `docs`: requirements, architecture, physical assemblies, operations, decisions, and evidence policy.
- `hardware`: canonical OpenSCAD sources, shared modeling helpers, model metadata, and hardware-specific notes.
- `bom`: canonical part, assembly, supplier, offer, destination, and build data plus generated reports.
- `packages/arbi-bom`: BOM schemas, deterministic landed-cost calculation, generation, and validation.
- `scripts`: repository-level validation that does not belong to one package.
- `.github`: public contribution templates and secret-free continuous integration.

The documentation is organized by physical assembly: [site installation](docs/assemblies/site-installation/README.md), [corner station](docs/assemblies/corner-station/README.md), [winch](docs/assemblies/winch/README.md), [positioning lines](docs/assemblies/positioning-lines/README.md), [camera pod](docs/assemblies/camera-pod/README.md), [dock](docs/assemblies/dock/README.md), and [control cabinet](docs/assemblies/control-cabinet/README.md). Mechanical parts, electronics, wiring, fasteners, printed parts, software interfaces, tests, and maintenance information belong to their owning assembly rather than to component-type subsystems.

## Local setup

Requirements:

- Node.js `>=24` (`.nvmrc` pins the current development release)
- Corepack and the pnpm version pinned in `packageManager`
- OpenSCAD `2021.01` for local geometry compilation; static CAD validation still runs when OpenSCAD is absent

```bash
corepack enable
pnpm install
pnpm docs:check
pnpm bom:check
pnpm cad:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

`pnpm cad:check` compiles every registered model when `openscad` is available. CI requires OpenSCAD and always performs compilation. Generated STL, 3MF, and CSG files are derived artifacts and are not committed.

Use `pnpm bom:generate` after changing canonical BOM inputs. Generated Markdown and JSON reports are tracked so GitHub readers can inspect a deterministic build calculation. CI rejects missing or stale generated reports.

See [WORKSPACE.md](WORKSPACE.md) for boundaries, commands, generated artifacts, and the planned software layout.

## Planned monorepo growth

Deployable software will be added only with an implemented, testable slice. Expected destinations are:

- `apps/arbi-docs`: future Next.js documentation and interactive BOM site on Vercel;
- `apps/arbi-simulator`: simulator executable or interface;
- `apps/arbi-edge-controller`: local orchestration and control adapter;
- `apps/arbi-cloud`: remote request, telemetry, and image integration if required;
- `apps/arbi-pod-firmware` and `apps/arbi-control-cabinet-firmware`: hardware targets when their toolchains and boundaries are selected;
- `packages/arbi-protocol`, `packages/arbi-control`, and `packages/arbi-simulation-core`: shared contracts and pure logic when reuse is real.

Empty placeholder applications are intentionally omitted. The [simulator decision](docs/decisions/0004-simulator-boundary.md) preserves the required contract boundary without claiming an implementation exists.

## Contributing and safety

Contributions are welcome through GitHub issues and pull requests. Changes that affect loads, mains wiring, motion, line clearance, docking, control authority, or fault behavior must state their safety impact and validation evidence. CAD compilation, simulation, bench testing, installed-system testing, and safe public operation are separate evidence levels.

Read [CONTRIBUTING.md](CONTRIBUTING.md), [GOVERNANCE.md](GOVERNANCE.md), [SECURITY.md](SECURITY.md), and the [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

## License

Unless an individual file explicitly states otherwise, all source code, OpenSCAD hardware sources, documentation, BOM files, and other repository materials are licensed under the [GNU Affero General Public License v3.0 only](LICENSE). This matches the Gredice monorepo license and keeps the planned V1 merge path explicit.
