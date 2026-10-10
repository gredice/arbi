# Commissioning host reference evidence

Status: **source and isolated simulation evidence** for [#40](https://github.com/gredice/arbi/issues/40). The [specification](../software/commissioning.md) owns scope. This is no bench, installed-system or qualified physical acceptance record.

## Named revision and environment

- Record `commissioning-golden-host`, revision `2026-10-10`, referenced by the synthetic calibration evidence.
- Committed input: [fixture](../../apps/arbi-edge-controller/fixtures/commissioning.json), configuration `commissioned-config-1`, calibration `calibration-1`, simulation/test `fixture-run`, fictional `synthetic-site`.
- Full-set digest: `6edd698c30e225686c4e96533534310d9f7061b61be67b460d359651df837aef`.
- Configuration digest: `79fe6c2d1944a2453ad4cde98178d4f6baada58540231e990fde99c70b32292d`.
- Calibration digest: `1ca97f101a4906518f3540b111dd139cbe4b1d9b54f87db5b66d066991dcc3a5`.
- Host: macOS development filesystem, Node.js 24.13.0, pnpm 11.5.2; checks on 2026-10-10–11 using independent SQLite files, child processes and SIGKILL. Signing keys are ephemeral/in-memory; data is fictional.
- Automated reviewer `fixture-reviewer` is fictional. Human engineering/physical review belongs to the PR and subsequent stage acceptance.

## Observations

[Commissioning tests](../../apps/arbi-edge-controller/src/commissioning/commissioning.test.ts) cover signed site capabilities, denial audit, matching local maintenance session/epoch/expiry, closed fields, golden site/bed/plant coordinates/framing, payout direction/HOME references, exact independent approval, immutable revisions and reader/local-limit compatibility.

Failed preparation changes no active device. Failure after one device activates leaves other devices unchanged and normal jobs blocked, with stop available. Explicit recovery finishes the set without reapplying a matching device. A child is killed **after device COMMIT and before response/coordinator persistence**. Reopen stays blocked; fresh enrollment/recovery preserve the original device transaction and reconcile remaining devices/audit without job replay. Changed inspection/firmware or revoked calibration approval latch readiness; metadata restoration alone cannot clear it.

SQLite ownership, atomic state/audit rollback, content verification, device timeout and mid-activation session revocation cover the host failure boundary. [Dashboard tests](../../apps/arbi-dashboard/src/dashboard/server.test.ts) cover scoped engineering status reads, omitted viewer/context data and rejection of cross-site/malformed/secret-bearing projections.

Golden pod positions are `(990,2000,2480)`, `(1190,1750,2480)` and `(990,1500,2480)` mm, with pan `8°`, tilt `-24°`. Optical translation is `(10,0,20)` mm, yaw `10°`, pitch `-5°`, gimbal zeros `(2,-1)°`; no camera/image is involved. All axes yield zero signed turns at HOME; lowering the analytical pose changes payout with the configured direction sign.

## Reproduce

Install pinned dependencies and run from the repository root:

```sh
pnpm lint --filter=@arbi/edge-controller --filter=@arbi/dashboard --filter=@arbi/protocol --filter=@arbi/gredice
pnpm typecheck --filter=@arbi/edge-controller --filter=@arbi/dashboard --filter=@arbi/protocol --filter=@arbi/gredice
pnpm test --filter=@arbi/edge-controller --filter=@arbi/dashboard --filter=@arbi/protocol --filter=@arbi/gredice
pnpm build --filter=@arbi/edge-controller --filter=@arbi/dashboard
pnpm docs:check
git diff --check
```

Protocol tests also run existing independent TypeScript/Python/C references. Native PostgreSQL/browser checks remain separate dashboard integration evidence. Linux confinement, selected cabinet storage power loss, real local authorization/transport and every physical prerequisite remain unverified.

The four-workspace suites passed; their six native PostgreSQL cases and one Linux-only systemd case were skipped by the ordinary host suite. `pnpm --filter @arbi/dashboard test:postgres` separately passed all 11 isolated native PostgreSQL tests on Homebrew PostgreSQL 15.19. The commissioning suite passed all 14 tests, including mounted loopback HTTP routes. Dashboard status tests passed all five tests, and `pnpm --filter @arbi/dashboard test:browser` passed all eight Chromium checks. These results remain source/host evidence.
