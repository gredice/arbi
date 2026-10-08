# Workspace guide

Use this guide for repository layout, toolchains, commands, package boundaries, generated artifacts, and planned growth.

## Current layout

- `docs`: engineering documentation organized around physical assemblies, system concerns, operations, project status, decisions, and evidence policy.
- `hardware`: OpenSCAD sources, shared modules, model registry metadata, and model documentation.
- `bom`: canonical procurement and assembly inputs plus deterministic generated reports.
- `packages/arbi-bom`: implemented BOM schemas, calculations, generators, and tests.
- `packages/arbi-protocol`: [implemented versioned message and configuration/calibration contracts](packages/arbi-protocol/README.md), runtime validation, consumed TypeScript bindings and reference fixtures; device adapters and physical calibration remain follow-up work.
- `packages/arbi-simulation-core`: [implemented offline scenario runner and adapter seams](packages/arbi-simulation-core/README.md), bounded virtual time, seeded disturbances, analytical references and [bounded plant/module model 1.0](docs/software/bounded-plant-model.md); physical fidelity and runtime integration remain follow-up work.
- `packages/arbi-gredice`: [implemented signed identity, current account/site permissions and server request boundary](packages/arbi-gredice/README.md), with an isolated simulation identity provider; live Gredice provisioning and resource implementations remain separate work.
- `packages/arbi-traffic`: [implemented application taps, bounded SQLite traffic spool, Linux interface collector and optional router snapshot adapter](packages/arbi-traffic/README.md), consumed by edge/pod diagnostics; actual cellular/router/provider coverage remains separate.
- `packages/arbi-audit`: [implemented bounded SQLite admission and replay spool](packages/arbi-audit/README.md) for edge/pod Node runtimes and cloud receipt/integrity primitives; storage hardware power-loss evidence remains separate.
- `apps/arbi-dashboard`: [implemented authenticated shell, enrollment, image-storage, command-job and realtime HTTP boundaries](apps/arbi-dashboard/README.md), explicit bounded-plant test provider, simulation-only device identity/inventory lifecycle, private Blob/Ably SDK adapters and transactional PostgreSQL state/audit/recovery; live provider setup and detailed operational UI remain separate work.
- `apps/arbi-docs`: [public statically generated Next.js site](apps/arbi-docs/README.md) deployed to `arbi.gredice.com` from the Gredice Vercel team. It reads data compiled at build time from the CAD registry, BOM reports, documents, booklet packs and the latest CAD release.
- `apps/arbi-edge-controller`: [executable supervised edge prototype](apps/arbi-edge-controller/README.md), bounded authenticated loopback diagnostic transport, optional [durable local job/policy consumer](docs/software/local-jobs.md), health/readiness and Linux service definition; physical host/transport activation remains gated by ADR-0008.
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
pnpm scenario:check

pnpm cad:check
pnpm cad:check -- --require-openscad
```

The standard Turbo commands cover implemented workspaces only. `docs:check` validates committed local Markdown link targets without network access. `bom:check` validates canonical inputs and fails if tracked reports are missing or stale without modifying them. `bom:generate` writes those deterministic reports.

`protocol:check` builds the protocol package, then runs its [cross-runtime reference suite](docs/software/reference-fixtures.md) directly, including independent TypeScript, Python 3 and host C11 consumers and deliberate mismatch tests. It requires `python3` and `cc` (C11, standard math library); missing tools fail the check. After installing pinned workspace dependencies, the suite is offline and uses only committed synthetic data and temporary host binaries. The protocol package tests include this suite too; CI runs them without a test cache, so a second conformance run is unnecessary.

`scenario:check` builds protocol and simulation-core, then runs the [scenario 1.0 conformance suite](docs/software/scenarios.md) directly. Independent TypeScript and Python 3 consumers derive their own traces from identical committed fixtures, repeat each run and reject deliberate discrepancies. Python 3 is required; no provider/device credentials or network are used after dependencies are installed. `pnpm test` also includes these tests.

`cad:check` always validates `hardware/models.json` against its JSON Schema, required files, relative includes, revisions, statuses, output names, and both directions of the model-to-BOM fabrication-source mapping. When OpenSCAD is installed it must match the registry's exact version, then the command compiles every registered entrypoint into a temporary directory. `--require-openscad` makes a missing CLI an error and is used in CI.

## Selective CI

[One CI workflow](.github/workflows/ci.yml) owns validation, booklet artifacts and
CAD releases. Its [planner](scripts/ci/plan.mjs) compares the complete pushed
range on `main` or the PR merge base and head, treating renames as deletions and
additions. Manual dispatches and unavailable push baselines validate everything.
Shared toolchain, lockfile and CI tooling changes also select all checks.

Each affected workspace runs on its own runner. Internal `workspace:*`
dependencies from package manifests select downstream consumers transitively;
only their dependency builds run upstream. The selected package owns its lint,
typecheck, tests and build, plus its existing native/conformance or dashboard
PostgreSQL/browser/HTTP checks. Suites stay serial within a runner while
independent workspaces, BOM, CAD and booklets run in parallel.

| Changed inputs | Selected work beyond repository checks |
| --- | --- |
| Website source, `docs`, root README | Website only; the industrial-design document also selects booklets |
| Dashboard source | Dashboard, including its integration checks |
| Edge source | Edge, including Linux service verification |
| Shared software package | That package and all downstream consumers |
| BOM data/reports | BOM package, generated-report verification and website; part mappings also select CAD |
| Registered/shared geometry, registry/schema, CAD validator, deleted model documentation | CAD; hardware changes also select website |
| Winch or camera-pod assembly sources/documentation | Owning booklet variants and website; geometry also selects CAD |
| Booklet generators, shared rendering helpers, fonts, license and mesh validators | Affected booklet variants |
| Architecture recovery experiment | Recovery experiment only |

Repository links and whitespace run on every change because deleting or moving
any file can break a Markdown target. `[CI] OK` requires successful change
detection and repository checks, then accepts only a successful selected job or
a skipped job explicitly reported unnecessary. Failed, cancelled, unexpected
skipped and missing selections fail the gate. Planner and gate regression tests
run before change selection, including multi-commit pushes, PR merge bases,
renames, deletions and conservative fallback behavior.

The pinned Node/pnpm setup caches the pnpm store and installs only each selected
workspace's dependency closure. Workspace jobs persist Turbo compilation/static
check results and Next.js compiler caches, with OS, architecture, runtime and
workspace cache scopes. Turbo includes the shared TypeScript configuration in
its task hashes. Tests always run fresh so Linux/toolchain/loopback evidence
cannot be replaced by cached logs. The website build also runs fresh because it
embeds Git provenance and can consume a mutable Latest release; CI builds use
committed offline snapshots, while Next.js keeps its incremental compiler cache.
Python jobs cache pip downloads, and the dashboard caches its pinned Chromium
browser while installing system dependencies on every runner.

On relevant `main` pushes and manual dispatches on `main`, the planner expands
the release to all three commit-matched booklet packs and CAD. Publication waits
for `[CI] OK`, downloads geometry and packs already built in this run, then
publishes `cad-<commit>` with source ZIPs/checksums. It performs no second CAD or
booklet build. Only the publication job has write permission and access to the
site refresh hook. Main runs are not cancelled by later merges; serialized
publication retains the ancestry check that prevents an older snapshot from
replacing a newer Latest release. PRs only upload review artifacts.

## OpenSCAD source and releases

- One registered entrypoint produces one declared release artifact.
- Units are millimetres and the coordinate convention is documented in `hardware/conventions.md`.
- Shared geometry helpers live in `hardware/lib`; assembly sources live in `hardware/assemblies/<assembly>`.
- Models begin as `concept-unvalidated`. Revision or status changes must link the evidence that justifies them.
- Keep stable model IDs and semantic design revisions. BOM assembly data refers to these revisions when a physical build depends on fit or geometry.
- Generated STL, 3MF, CSG, and bulk render output goes to temporary or ignored output directories. CI artifacts and GitHub releases distribute derived geometry.
- A successful render proves source consistency only. It does not prove tolerances, material choice, strength, weathering, print quality, or safe installation.

## Assembly booklet builds

The Python generators in [scripts/winch-booklet](scripts/winch-booklet/README.md)
and [scripts/payload-booklet](scripts/payload-booklet/README.md) export current
registered CAD, check meshes and nominal assembly geometry, render white-face
line illustrations and package A4 PDFs with portable STL/source ZIPs. The three
configurations are the winch, dry payload bench and payload rain enclosure.

[Booklet CI](.github/workflows/ci.yml) builds affected variants on PRs and
all three on release runs or manual dispatches. [CAD release CI](.github/workflows/ci.yml) includes
their PDFs/ZIPs and checksums in the same `cad-<commit>` release as the geometry.
CI keeps generated outputs as artifacts and never commits snapshots back to Git.
Use `scripts/check-booklet.py` for the owning PDF/pack checks; local `--publish`
is reserved for intentionally refreshing checked-in publication snapshots.

## BOM source and generated output

Canonical data separates part identity, assembly quantity, supplier identity, commercial offers, destinations, and build configurations. Shipping is aggregated by supplier basket and destination rather than copied onto every part line. Calculations use committed assumptions and dated exchange rates; normal CI does not fetch mutable live pricing.

Generated BOM Markdown and JSON are intentionally tracked because they are direct GitHub documentation and future website inputs. They carry calculation status and must expose missing or stale offers rather than silently treating them as zero.

## Planned software destinations

The following paths are reserved but should not exist until implementation begins; implemented destinations above retain these ownership boundaries:

- `apps/arbi-dashboard`: implemented enrollment, [image-storage HTTP slices](docs/software/image-storage.md) and [authenticated user/engineering shell](docs/software/dashboard-shell.md); remaining operational UI/API and live provider acceptance in Gredice's Vercel team are follow-up work;
- `apps/arbi-simulator`: executable simulator or simulator UI;
- `apps/arbi-cloud`: reserved only if a later reviewed decision requires an independent backend; the initial API belongs to `apps/arbi-dashboard`;
- `apps/arbi-pod-firmware`: pod camera, gimbal, power-health, and local service target;
- `apps/arbi-control-cabinet-firmware`: motion/safety controller target if it remains separate;
- `packages/arbi-gredice`: implemented identity/site authorization; bed/plant target integration remains future work in this adapter;
- `packages/arbi-control`: pure control and geometry logic when shared;
- `packages/arbi-simulation-core`: implemented deterministic scenarios and bounded plant/module references described above; measured physical fidelity remains separate work.

The simulator and real adapters must consume the same versioned contracts and units. Simulator success cannot be used as installed-system proof.

[ADR-0005](docs/decisions/0005-software-architecture-and-deployment.md) owns software deployment, transport/storage selection, environment isolation and release boundaries. Its [bounded feasibility experiment](docs/evidence/software-transport-feasibility.md) runs with `node --test scripts/spikes/software-recovery.test.mjs`; it needs loopback listening and uses only temporary synthetic data. It is not an implemented app or provider integration.

## Public Vercel site

`apps/arbi-docs` consumes repository documentation, CAD registry metadata, `bom/generated` reports, booklet packs and the latest CI-built `cad-<commit>` release; it never duplicates them. `scripts/compile-data.mjs` writes the ignored `public/data` during `dev` and `build`. It checks release assets against `SHA256SUMS.txt`, falls back to committed snapshots when the release is stale or unreachable, and reads exploded poses from the booklet renderer's figure manifests. The build is secret-free and works for pull requests from forks. The Vercel project `arbi` in the Gredice team uses root directory `apps/arbi-docs` and is connected to this repository: `main` deploys production at `arbi.gredice.com`, and pull requests get previews.

When ARBI V1 is merged into the Gredice monorepo, align tool versions with the destination at merge time, preserve prefixed package names, and add any Vercel app to the destination's application registry. Do not copy environment pull or deployment scripts before they are needed.
