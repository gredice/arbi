# AI collaborator notes

ARBI is a public engineering monorepo containing documentation, OpenSCAD hardware sources, normalized BOM data, and software packages.

## Start here

- Use Node.js `>=24` and the pnpm version pinned in `packageManager`.
- Check for nested `AGENTS.md` files before editing; nested files override this one.
- Read [WORKSPACE.md](WORKSPACE.md) for boundaries and commands.
- Read [CONTRIBUTING.md](CONTRIBUTING.md) for validation and contributor expectations.
- For system meaning and evidence status, begin with [docs/README.md](docs/README.md) and [docs/project/design-status.md](docs/project/design-status.md).
- Treat the current committed tree and tagged releases as the authoritative engineering baseline. Use this repository's GitHub issues and pull requests as the work and review record, but do not treat a proposal as accepted until it is merged. Do not rely on an external workspace or unpublished decision.

## Rules

- Preserve user and collaborator changes already in the worktree.
- Keep deployable applications in `apps/*` and shared code in `packages/*`; use `workspace:*` for internal package dependencies.
- Do not create empty packages for planned firmware, edge, cloud, website, or simulator work.
- Treat `hardware/**/*.scad` as canonical geometry. Do not commit generated STL, 3MF, CSG, or bulk render output.
- Register each public CAD entrypoint in `hardware/models.json` and keep its status, revision, documentation link, and output name current.
- Treat BOM inputs as canonical. Do not hand-edit `bom/generated/*`; run `pnpm bom:generate`.
- A supplier offer is time- and destination-specific evidence, not a permanent product fact. Preserve source URL, currency, observed date, pack quantity, and shipping assumptions.
- Do not claim that a concept is validated without a committed test, calculation, inspection, or review record.
- Never commit or print secrets, credentials, private keys, private vulnerability reports, or real deployment configuration.

## Validation

Run the narrowest relevant commands from the repository root:

```bash
pnpm docs:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm bom:check
pnpm cad:check
```

Use `pnpm cad:check -- --require-openscad` when OpenSCAD compilation is required. Documentation-only changes need at least `pnpm docs:check` and `git diff --check`; changes to generated reports need their owning validation as well.

If a check cannot run, report the exact command and reason. Passing CI, a successful simulation, and physical validation remain separate facts.
