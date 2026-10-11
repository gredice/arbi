# Isolated protocol integration

[#62](https://github.com/gredice/arbi/issues/62) extends the [bounded control playground](control-playground.md) with actual signed telemetry and reproducible protocol-boundary faults. [ADR-0013](../decisions/0013-isolated-protocol-integration.md) defines the boundary; [evidence](../evidence/protocol-integration.md) separates host observations from outstanding hardware/provider work.

Run from the repository root with Node 24, native PostgreSQL tools and the installed Playwright Chromium:

```bash
pnpm build --filter=@arbi/dashboard
pnpm --filter @arbi/dashboard test:browser
```

The harness owns a new database, test namespace, five synthetic sites, private access profiles and ephemeral device credential. Its dedicated `synthetic-controls` site is the only independent controller target. User and engineering modes share current site authorization; an operator code does not grant diagnostics access, and the engineer code does not grant manipulation. Explicit browser entry requests the existing fenced lease; each gesture creates one durable command. The independent edge consumer enforces current local state/interlocks, deadlines and module proof before reporting completion.

The optional isolated telemetry bridge supports protected `current`/`history` reads and signed device ingestion. Dashboard context and diagnostics for the control site project that authority's actual current snapshot and aged samples. A missing, stale or incompatible head cannot become a fresh seeded observation. No browser message can supply a device proof or select a different realm. The application bounds its SQL pool at four connections to accommodate concurrent signed job/telemetry transactions, a human transaction and its current-directory recheck.

The private harness reads `arbi.playground-fault/1.0` from its owned temporary file. Modes are `normal`, one-shot `drop-outcome-ack`, one-shot `delay-poll`, one-shot `reorder-telemetry`, and time-bounded `disconnect` (at most 15 seconds). Changing scenarios requires local harness access. Reordering admits the newer signed telemetry sample before forwarding the held older sample inside its original proof window; it never rewrites a sequence or clock. Lost acknowledgements retry the original immutable report ID. The independent local timer continues while cloud responses are delayed or unavailable.

Successful browser runs save minimized protocol facts to `apps/arbi-dashboard/test-results/protocol-integration-trace.json` (the integration scenarios) and `protocol-trace.json` (the final harness window). These are bounded synthetic observations, not a measured plant dataset or a public actuator API. The source regression also checks loopback-only targeting, cross-site forwarding denial, closed fault input and secret-field minimization.
