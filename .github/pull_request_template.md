## Summary

Describe the problem and the resulting behavior, design, data, or documentation.

## Scope

- Affected physical assemblies:
- Affected interfaces or operating states:
- Affected model, assembly, part, build, protocol, or package IDs:
- Related issue or ADR:

## Source and generated artifacts

- Canonical inputs changed:
- Generated reports or release artifacts refreshed:
- Compatibility or migration impact:

## Safety, security, and privacy

Describe physical hazards, control/fault effects, security boundaries, image/privacy effects, mitigations, residual risk, and required specialist review. Write `None known` only after considering the affected boundary.

## Validation

List exact commands and results. Keep source checks, CAD compilation, simulation, calculations, bench tests, field tests, and installed-system evidence separate.

```text
pnpm docs:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm bom:check
pnpm cad:check
git diff --check
```

## Remaining work

List skipped checks with reasons, unresolved questions, follow-up issues, and claims that remain unverified.
