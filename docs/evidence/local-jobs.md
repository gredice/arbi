# Local job journal and policy host evidence

- Work record: [#30](https://github.com/gredice/arbi/issues/30), parent [#6](https://github.com/gredice/arbi/issues/6)
- Date: 2026-10-07
- Scope: development-host source and isolated synthetic simulator only
- Source: [consumer](../../apps/arbi-edge-controller/src/jobs/orchestrator.ts), [SQLite journal](../../apps/arbi-edge-controller/src/jobs/journal.ts), [tests](../../apps/arbi-edge-controller/src/jobs/jobs.test.ts), [SIGKILL worker](../../apps/arbi-edge-controller/src/jobs/crash-worker.ts)
- Contract: `arbi/1.0`, `arbi.configuration/1.0`, `arbi.audit/1.0`, `arbi.plant/1.0`, committed `config-1`/`calibration-1` and reference digest `e31d9fcf7ba58872ea4954d140944c0c72354524582f1d82c735e1a8343a3f6f`
- Configuration digest: `15f54c85545697d1da5736ef52c0188a0cb8f9dd0916b90c915cba1e6d2ec153`
- Reviewer: implementation self-review; CI/review and merge remain separate repository records

Development host: macOS (`darwin`), Node 24.15.0, pnpm 11.5.2, Node-bundled SQLite 3.51.3. The complete edge suite passed 103 tests with one Linux-only service-verification skip; its 137 actual SIGKILL experiments covered every phase's commit/send/receipt/proof boundaries plus admission/audit-copy windows. Subsequent focused checks passed all six named plant cases and the remote-stop/audit-backlog regressions. Audit (5 tests), traffic (19 tests), independent protocol conformance (130 tests) and scenario/plant conformance (124 tests) passed. Owning build/lint/typecheck, repository lint/typecheck, Markdown links and whitespace checks passed. Linux service confinement, native Linux counters and required repository CI remain separate readbacks in the PR. No test changes a physical evidence gate.

The owning suite runs an independently persisted capture workflow with one synthetic capture and distinct stop/latch witnesses. It checks original command/actor/lease/correlation preservation, duplicate results after expiry/SQLite reopen, key/payload/sequence conflicts, unknown/unsupported/stale operating inputs, loaded configuration/calibration, mode/maintenance/workspace checks, manual disconnect and permitted autonomous offline work, module epoch replacement, controller fault, missing stop/latch, journal/audit rollback/handoff and bounded/full/unavailable storage. Required local stop happens before best-effort failed evidence. Fixture permissions are explicit synthetic test inputs; unavailable physical sensor values remain unavailable.

The process matrix kills the actual Node worker without `close`/`finally` at each move, stop, gimbal, settling, capture, return, approach, dock-stop and latch dispatch/receipt/proof boundary. A fresh process/SQLite open verifies interrupted/operator-required outcomes, no redispatch, retained final committed success and integrity. Admission transaction and audit append-before-ack crash windows are also covered. Passing these tests is host process evidence; power interruption, media/controller firmware and physical timing are not tested.

Owning commands and final results are recorded in the PR:

```bash
pnpm --filter @arbi/edge-controller... build
pnpm --filter @arbi/edge-controller lint
pnpm --filter @arbi/edge-controller typecheck
pnpm --filter @arbi/edge-controller test
pnpm --filter @arbi/audit test
pnpm --filter @arbi/traffic test
pnpm protocol:check
pnpm scenario:check
pnpm docs:check
git diff --check
```

The unchanged independent TypeScript/Python scenario/plant conformance suites retain named healthy, disconnected-cloud, driver-fault, power-loss, rejected-command, nominal, limit-stop, dock-unconfirmed, out-of-envelope and seeded cases. The durable consumer additionally executes nominal/seeded, missing-dock, power-loss, limit and out-of-envelope cases using those committed model parameters and identity. Its composite workflow supplies explicit fresh virtual latch samples for successful cases, rather than claiming the older reference trace timing is its timing. Neither successful reference trace nor a successful job proves model fidelity. See [local job rules](../software/local-jobs.md) and [bounded model evidence](../software/bounded-plant-model.md).

Remaining gates: exact selected Linux cabinet host/storage/filesystem, resource measurements, real Pico/pod runtimes and independent deadlines, reviewed wired interfaces, actual instrumentation and local weather/access policy, native physical stop/latch/release/line-clearance evidence, storage corruption/power loss, provider integration, bench/HIL, installed commissioning and qualified review. [#40](https://github.com/gredice/arbi/issues/40), [#50](https://github.com/gredice/arbi/issues/50), [#66](https://github.com/gredice/arbi/issues/66), firmware, live media and OTA remain separate. Recording stays disabled. No host result clears any gate in [ADR-0006](../decisions/0006-local-safety-authority-and-instrumentation.md).
