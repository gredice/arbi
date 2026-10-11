# Seeded service fault workflows

[#77](https://github.com/gredice/arbi/issues/77) is implemented under [ADR-0022](../decisions/0022-seeded-service-fault-workflows.md). The [local runner](../../apps/arbi-edge-controller/src/scenarios/workflows.ts) calls the actual durable local consumer and existing update server, not a parallel state-machine oracle.

```sh
pnpm --filter @arbi/edge-controller build
pnpm --filter @arbi/edge-controller simulate:faults --seed 77 --directory /tmp/arbi-new-fault-experiment
pnpm --filter @arbi/dashboard test:postgres
```

The local directory must be empty and private. The command prints a redacted semantic trace; original immutable journals, audit spools, target slots, signing trust and byte receipts stay in that directory. Delete only an experiment directory you own after inspecting its evidence. The CLI never installs physical firmware or opens actuator interfaces.

| Scenario | Required observed result | Bandwidth / audit boundary |
| --- | --- | --- |
| Driver alarm, lost reference, sensor disagreement, power instability | Fault and explicit recovery; no replay | Local stop remains independent of transfer policy; attributed interruption has unknown physical effect |
| Pod reset, edge restart | Original work fails; reconnect cannot redispatch | Original command and historical audit producer remain visible |
| Command timeout, cloud outage | Stale/manual authority cannot continue or replay | Local handling does not depend on Internet availability |
| Interrupted download | Original 4,096-byte prefix resumes and confirms one target | Actual Range bodies reconcile to 70,000 application bytes |
| Failed canary | Healthy baseline rollback; later targets untouched | Original actor/session join and rollback observation |
| Incompatible signature, corrupt artifact | Rejected or paused; zero installs | Incompatible request reads zero artifact bytes; corrupt 70,000-byte body remains charged |
| Optional quota exhaustion | Optional media denied; essential pool admissible | Essential health bytes are declared synthetic traffic, not a measured socket/carrier result |
| Allowed/rejected cloud manipulation | One durable job; revocation prevents delivery | Current SDK decisions and durable audit readback; no invented device result |
| Concurrent viewing, profile restriction, budget exhaustion | Separate viewers, shared producer, explicit lower profile, then stop | Isolated signaling only; no fabricated video delivery bytes |
| Upload retry after missing/lost acknowledgement | One verified image and one completion | Actual two PUT bodies include rejected retry bytes; raw image stays out of trace/audit |
| Deferred recording | Six operations denied; no handler executes | Existing disabled lifecycle contract fixtures; no recording success |

The local automated test repeats seed 77 and compares complete semantic traces, then changes seed 78 to exercise alternate timing. The native [cloud/media test](../../apps/arbi-dashboard/src/dashboard/fault-workflows.test.ts) persists redacted `fault-results/*.json` and logs traces in CI; the local test does likewise. Generated files are ignored. [Committed representative trace evidence](../evidence/fault-workflows.md) records the reviewed software revision.

Existing protocol fixtures cover invalid versions, malformed contracts and numeric/deadline boundaries. The [actual web–cloud–edge integration](protocol-integration.md) and [browser update flow](update-dashboard.md) retain their complete pipeline proofs. Physical carrier/billing reconciliation, GPIO fault timing, installed power interruption, hardware media and field acceptance remain separate blocked gates.
