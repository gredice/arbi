# Contributing

ARBI welcomes documentation, hardware, BOM, software, testing, and review contributions. Follow the [Code of Conduct](CODE_OF_CONDUCT.md) and keep each change focused and reviewable.

## Before starting

- Read [docs/README.md](docs/README.md), [current design status](docs/project/design-status.md), and the affected assembly document.
- Follow the [repository source-of-truth policy](docs/project/repository-source-of-truth.md). GitHub issues and pull requests record proposed work and review, but only merged files, accepted ADRs, and committed validation records change the project baseline.
- Search existing issues, pull requests, and [decision records](docs/decisions).
- Open a design proposal before changing system topology, control ownership, safety behavior, physical interfaces, electrical architecture, protocol compatibility, or the V1 baseline.
- Do not disclose a vulnerability in a public issue; follow [SECURITY.md](SECURITY.md).

## Local setup

```bash
corepack enable
pnpm install
```

Use Node.js `>=24` and the pinned pnpm version. Install the exact OpenSCAD version declared in `hardware/models.json` when changing geometry or when local compilation evidence is required.

## Documentation and evidence

- Organize information by physical assembly. Component types such as cables, fasteners, electronics, and printed parts belong to their owning assembly.
- Use `Requirement`, `Baseline`, `Target`, `Starting point`, `Unverified`, `Deferred`, and `Validated` consistently with [docs/README.md](docs/README.md).
- A `Validated` statement must link a committed record identifying the tested revision, configuration, conditions, equipment, result, and reviewer. Off-repository notes, chats, dashboards, or file shares are not validation records.
- Record durable architecture choices as ADRs. Track unresolved work in issues rather than hiding it in optimistic prose.

## OpenSCAD changes

- Keep source models parametric and in millimetres.
- Reuse `hardware/lib` helpers before copying geometry.
- Register new release entrypoints in `hardware/models.json` with a stable ID, semantic design revision, status, documentation path, and output filename.
- Keep concept geometry marked `concept-unvalidated` until physical evidence supports another status.
- Do not commit STL, 3MF, CSG, or bulk render output.
- Run `pnpm cad:check`; use `pnpm cad:check -- --require-openscad` for compile proof.

## BOM changes

- Preserve stable part and assembly IDs.
- Keep part specifications separate from assembly quantities and supplier offers.
- Record offer currency, pack quantity, source URL, observed date, destination applicability, and availability assumptions.
- Aggregate shipping once per supplier basket and destination.
- Run `pnpm bom:generate`, review the generated diff, and then run `pnpm bom:check`.

## Software changes

- Keep deployables in `apps/*`, shared code in `packages/*`, and internal dependencies on `workspace:*`.
- Add a workspace only with an implemented and testable slice.
- Validate external input at its boundary. Keep units, coordinate frames, message versions, timeouts, and failure behavior explicit.
- Real hardware and simulation should share contracts and reference fixtures without sharing unsafe authority assumptions.
- Never commit credentials, deployment configuration, private keys, or real-site secrets.

## Validation

Run the narrowest relevant checks and include results in the pull request:

```bash
pnpm docs:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm bom:check
pnpm cad:check
git diff --check
```

If a check cannot run, state the exact command and reason. Passing source checks, CAD compilation, simulation, bench validation, field validation, and safe public operation are distinct claims.

## Pull requests

- Explain the problem and the resulting behavior or documentation.
- Identify affected assemblies, interfaces, model IDs, BOM builds, and software packages.
- Call out safety impact, generated artifacts, compatibility changes, and unresolved risks.
- Keep unrelated formatting, dependency, or generated changes out of the pull request.
- Link issues, ADRs, calculations, test records, photos, or measurements that support the change.
