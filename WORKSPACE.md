# Workspace guide

Use this guide for repository layout, toolchains, commands, package boundaries, generated artifacts, and planned growth.

## Current layout

- `docs`: engineering documentation organized around physical assemblies, system concerns, operations, project status, decisions, and evidence policy.
- `hardware`: OpenSCAD sources, shared modules, model registry metadata, and model documentation.
- `bom`: canonical procurement and assembly inputs plus deterministic generated reports.
- `packages/arbi-bom`: implemented BOM schemas, calculations, generators, and tests.
- `packages/arbi-protocol`: [implemented versioned message and configuration/calibration contracts](packages/arbi-protocol/README.md), runtime validation, consumed TypeScript bindings and reference fixtures; device adapters and physical calibration remain follow-up work.
- `packages/arbi-gredice`: [implemented signed identity, current account/site permissions and server request boundary](packages/arbi-gredice/README.md), with an isolated simulation identity provider; live Gredice provisioning and resource implementations remain separate work.
- `scripts/check-cad.mjs`: registry, source, include, and optional OpenSCAD compilation validation.
- `.github`: issue forms, pull request guidance, and fork-safe CI.

## Tooling

- Runtime: Node.js `>=24`; `.nvmrc` records the current development version.
- Package manager: pnpm, pinned with integrity in the root `packageManager` field.
- Task runner: Turborepo.
- TypeScript: `7.0.2` with shared defaults in `tsconfig.base.json`.
- Parametric CAD: OpenSCAD `2021.01`, pinned exactly in `hardware/models.json`. The CLI binary is named `openscad`.
- Tests: package-owned tests invoked through Turbo and Node-based repository checks.

## Package boundaries

- `apps/*` is reserved for deployable or executable products.
- `packages/*` contains shared libraries and deterministic domain tooling.
- Internal JavaScript/TypeScript dependencies use `workspace:*`.
- App-only behavior remains in its owning app. Shared packages are added only after real reuse or a deliberate language-neutral contract boundary exists.
- Hardware, BOM inputs, and documentation are not pnpm packages.
- Polyglot firmware may live under `apps/*`; add a `package.json` wrapper only when it exposes real root build, lint, or test commands.

## Commands

Run commands from the repository root:

```bash
pnpm install

pnpm docs:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build

pnpm bom:check
pnpm bom:generate

pnpm protocol:check

pnpm cad:check
pnpm cad:check -- --require-openscad
```

The standard Turbo commands cover implemented workspaces only. `docs:check` validates committed local Markdown link targets without network access. `bom:check` validates canonical inputs and fails if tracked reports are missing or stale without modifying them. `bom:generate` writes those deterministic reports.

`protocol:check` builds the protocol package, then runs its [cross-runtime reference suite](docs/software/reference-fixtures.md) directly, including independent TypeScript, Python 3 and host C11 consumers and deliberate mismatch tests. It requires `python3` and `cc` (C11, standard math library); missing tools fail the check. After installing pinned workspace dependencies, the suite is offline and uses only committed synthetic data and temporary host binaries. `pnpm test` includes this suite too; the explicit CI command bypasses Turbo's test cache for the host toolchain checks.

`cad:check` always validates `hardware/models.json` against its JSON Schema, required files, relative includes, revisions, statuses, output names, and both directions of the model-to-BOM fabrication-source mapping. When OpenSCAD is installed it must match the registry's exact version, then the command compiles every registered entrypoint into a temporary directory. `--require-openscad` makes a missing CLI an error and is used in CI.

CI runs the OpenSCAD validation job when a pull request or push changes model sources (including shared geometry), registry metadata or schema, BOM part mappings, CAD validation tooling, or its workflow and dependency inputs. Deleting a model's assembly README also triggers validation. Other documentation and software changes skip that job; workspace and BOM checks still run, and `[CI] OK` accepts CAD being skipped only after successful change detection confirms it is unnecessary. A manual CI dispatch always validates all models.

## OpenSCAD source and releases

- One registered entrypoint produces one declared release artifact.
- Units are millimetres and the coordinate convention is documented in `hardware/conventions.md`.
- Shared geometry helpers live in `hardware/lib`; assembly sources live in `hardware/assemblies/<assembly>`.
- Models begin as `concept-unvalidated`. Revision or status changes must link the evidence that justifies them.
- Keep stable model IDs and semantic design revisions. BOM assembly data refers to these revisions when a physical build depends on fit or geometry.
- Generated STL, 3MF, CSG, and bulk render output goes to temporary or ignored output directories. CI artifacts and GitHub releases distribute derived geometry.
- A successful render proves source consistency only. It does not prove tolerances, material choice, strength, weathering, print quality, or safe installation.

## BOM source and generated output

Canonical data separates part identity, assembly quantity, supplier identity, commercial offers, destinations, and build configurations. Shipping is aggregated by supplier basket and destination rather than copied onto every part line. Calculations use committed assumptions and dated exchange rates; normal CI does not fetch mutable live pricing.

Generated BOM Markdown and JSON are intentionally tracked because they are direct GitHub documentation and future website inputs. They carry calculation status and must expose missing or stale offers rather than silently treating them as zero.

## Planned software destinations

The following paths are reserved but should not exist until implementation begins:

- `apps/arbi-dashboard`: authenticated user/engineering dashboard and HTTP API in Gredice's Vercel team;
- `apps/arbi-docs`: Next.js/Vercel public documentation and interactive BOM;
- `apps/arbi-simulator`: executable simulator or simulator UI;
- `apps/arbi-edge-controller`: local job, state, and hardware-adapter ownership;
- `apps/arbi-cloud`: reserved only if a later reviewed decision requires an independent backend; the initial API belongs to `apps/arbi-dashboard`;
- `apps/arbi-pod-firmware`: pod camera, gimbal, power-health, and local service target;
- `apps/arbi-control-cabinet-firmware`: motion/safety controller target if it remains separate;
- `packages/arbi-gredice`: implemented identity/site authorization; bed/plant target integration remains future work in this adapter;
- `packages/arbi-control`: pure control and geometry logic when shared;
- `packages/arbi-simulation-core`: deterministic simulated time, plant/sensor/actuator models, scenarios, and traces.

The simulator and real adapters must consume the same versioned contracts and units. Simulator success cannot be used as installed-system proof.

[ADR-0005](docs/decisions/0005-software-architecture-and-deployment.md) owns software deployment, transport/storage selection, environment isolation and release boundaries. Its [bounded feasibility experiment](docs/evidence/software-transport-feasibility.md) runs with `node --test scripts/spikes/software-recovery.test.mjs`; it needs loopback listening and uses only temporary synthetic data. It is not an implemented app or provider integration.

## Future Vercel site

Create `apps/arbi-docs` only with a working page slice. It should consume repository documentation and `@arbi/bom` outputs rather than duplicate them. Vercel preview and environment integration belong to that app and are added only when a secret-free build works for pull requests from forks.

When ARBI V1 is merged into the Gredice monorepo, align tool versions with the destination at merge time, preserve prefixed package names, and add any Vercel app to the destination's application registry. Do not copy environment pull or deployment scripts before they are needed.
