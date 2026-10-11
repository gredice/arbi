# ADR-0013: Isolated web–cloud–edge protocol integration

- Status: Accepted when merged; proposed until then
- Date: 2026-10-11
- Work record: [#62](https://github.com/gredice/arbi/issues/62), parent [#10](https://github.com/gredice/arbi/issues/10)
- Evidence: [protocol integration](../evidence/protocol-integration.md)

## Decision

The native browser harness connects the existing protected control bridge to an independent edge process running the local durable journal, manual deadman, job consumer and bounded module adapters. The controller signs actual HTTP job snapshots, polls, outcomes and telemetry with a fresh Ed25519 credential provisioned only into its empty dedicated synthetic site. Every message retains its current device/boot/session identity and simulation/test realm. No direct browser-to-simulator command endpoint is added.

The isolated test composition's control site reads the existing authorized telemetry authority. It displays original admitted snapshots and individually aged readings, including source/receipt clocks, missing coverage and estimated/unavailable qualities. The read projection does not advance receipt time or substitute seeded data when the controller is missing. Other synthetic examples retain their explicit frozen/empty model fixtures. The telemetry projection resolves a newer job receiver snapshot through its matching immutable admitted report, because the original device payload deliberately has no ingestion timestamp.

A private loopback proxy between this controller and the actual cloud HTTP handlers provides bounded delay, lost completion acknowledgements, disconnection and reordered telemetry. Only a file in the harness's owned temporary directory selects a closed scenario. The proxy cannot select another site/remote origin, forward human credentials, or expose a public fault-control endpoint. One-shot faults operate on signed requests/responses; the services still perform authentication, current authorization, scope, deadline, sequence, audit and idempotency checks. Local 25 ms ticking runs independently of cloud awaits. Optional one-second telemetry does not gate the required job/audit path.

The proxy records at most 128 allowlisted facts in 64 KiB: message/command/correlation/operation identities, source clocks, boundary status, terminal outcome and local dispatch or admission error. Signatures, credential IDs, private keys, tokens and request bodies are excluded. These are host observations, not measured mobile traffic or physical timing. Device proof windows are two seconds; the test-only delayed poll is 1750 ms, beyond the 1500 ms browser command expiry. Reconnection observes current state and durable jobs; it cannot reacquire browser intent or replay work.

## Limits

No production Gredice issuer, real device enrollment, provider deployment, NAT/relay, camera bytes or physical actuator is introduced. The private fixture must use a fresh owned PostgreSQL Unix socket and loopback origin; ordinary previews and production remain unavailable for these bridges. The host timing and synthetic stopped/reference inputs cannot clear bench, installed-system or physical review gates. Loss of a local recovery witness still requires an explicit local operator action.
