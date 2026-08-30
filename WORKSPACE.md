# Workspace guide

Use this guide for repository layout, toolchains, commands, package boundaries, generated artifacts, and planned growth.

## Current layout

- `docs`: engineering documentation organized around physical assemblies, system concerns, operations, project status, decisions, and evidence policy.
- `hardware`: OpenSCAD sources, shared modules, model registry metadata, and model documentation.
- `bom`: canonical procurement and assembly inputs plus deterministic generated reports.
- `packages/arbi-bom`: implemented BOM schemas, calculations, generators, and tests.
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

pnpm cad:check
pnpm cad:check -- --require-openscad
```

The standard Turbo commands cover implemented workspaces only. `docs:check` validates committed local Markdown link targets without network access. `bom:check` validates canonical inputs and fails if tracked reports are missing or stale without modifying them. `bom:generate` writes those deterministic reports.

`cad:check` always validates `hardware/models.json` against its JSON Schema, required files, relative includes, revisions, statuses, output names, and both directions of the model-to-BOM fabrication-source mapping. When OpenSCAD is installed it must match the registry's exact version, then the command compiles every registered entrypoint into a temporary directory. `--require-openscad` makes a missing CLI an error and is used in CI.

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

- `apps/arbi-docs`: Next.js/Vercel public documentation and interactive BOM;
- `apps/arbi-simulator`: executable simulator or simulator UI;
- `apps/arbi-edge-controller`: local job, state, and hardware-adapter ownership;
- `apps/arbi-cloud`: remote integration if the architecture requires a separate deployable;
- `apps/arbi-pod-firmware`: pod camera, gimbal, power-health, and local service target;
- `apps/arbi-control-cabinet-firmware`: motion/safety controller target if it remains separate;
- `packages/arbi-protocol`: versioned commands, configuration, telemetry, units, and fixtures;
- `packages/arbi-control`: pure control and geometry logic when shared;
- `packages/arbi-simulation-core`: deterministic simulated time, plant/sensor/actuator models, scenarios, and traces.

The simulator and real adapters must consume the same versioned contracts and units. Simulator success cannot be used as installed-system proof.

## Future Vercel site

Create `apps/arbi-docs` only with a working page slice. It should consume repository documentation and `@arbi/bom` outputs rather than duplicate them. Vercel preview and environment integration belong to that app and are added only when a secret-free build works for pull requests from forks.

When ARBI V1 is merged into the Gredice monorepo, align tool versions with the destination at merge time, preserve prefixed package names, and add any Vercel app to the destination's application registry. Do not copy environment pull or deployment scripts before they are needed.
