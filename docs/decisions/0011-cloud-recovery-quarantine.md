# ADR-0011: Quarantine restored cloud state before admission

- Status: Accepted when merged; proposed until then
- Date: 2026-10-11
- Work record: [#47](https://github.com/gredice/arbi/issues/47), parent [#4](https://github.com/gredice/arbi/issues/4)
- Prerequisites: [ADR-0005](0005-software-architecture-and-deployment.md), [ADR-0006](0006-local-safety-authority-and-instrumentation.md), [durable jobs](../software/command-jobs.md), [audit durability](../software/audit-durability.md)
- Evidence: [native operations/restore drill](../evidence/cloud-operations.md)

## Context

A consistent database backup preserves historical references but can predate device execution, local manual fences, provider grants and private object changes. Restoring a previously active lease or command cannot establish whether the device acted after the backup. A restored realtime cursor also cannot refer to a different history under its old epoch.

## Decision

Introduce an owner-managed database admission barrier with `ready`/`quarantined` state. Every ordinary `postgresDatabase` transaction checks the barrier inside BEGIN and holds its shared lock through COMMIT. The narrow owner-defined function permits this lock without granting application UPDATE permission on recovery state. A quarantine change waits for existing application transactions and rejects subsequent transactions. Missing rows, missing function privileges or unreadable installed barriers deny. Databases predating the additive migration retain their earlier behavior; operations readiness identifies the absent schema as degraded.

Recovery tools use a separate explicit operator connection. The isolated restore drill requires an owned socket-only test cluster, paused source admission, a private bounded archive and an empty different target. The dump is consistent; table fingerprints and archive SHA-256 verify references. Restoring reapplies additive migration privilege guards before any application grants. No production/network restore target or HTTP recovery/release endpoint is introduced.

Restored state remains quarantined. A recovery transaction retires leases, suppresses pending command delivery without inventing terminal results, revokes restored device credentials, removes current receiver/telemetry projections and realtime grants, and creates a new realtime epoch. Immutable audit/usage/history/media metadata remains historical evidence. The service policy authorization and recovery receipt commit with these changes; failures roll them back together. No method automatically releases quarantine.

An operator must reconcile current identity/provider grants, local device journals and manual fences, newly enrolled device epochs, external release trust, object bytes and writes after the backup before permitting service admission. The barrier protects cloud transactions, not local emergency stopping or physical state. Old application binaries that lack the barrier must not be connected to a restored database before reconciliation and equivalent database/provider access restrictions. A binary rollback is not permission to replay archived work.

## Consequences and limits

The shared barrier intentionally pauses all ordinary application transactions for that database, including audited reads. Private owner diagnostics remain available through a distinct connection. Ordinary runtime roles receive only narrow function execution and read access; they cannot release quarantine, migrate schema or append recovery receipts. Database-owner runtime connections are reported as degraded by health checks.

Operational health/log counters describe a process boot and stay distinct from durable audit and transfer accounting. Public site diagnostics expose current probe results; historical cross-site logs/counters require private owner tooling. Provider failures and missing integrations remain explicit rather than inferred healthy.

The committed drill proves native Postgres software behavior and synthetic release/audit reference preservation. Actual Neon restore/PITR, Ably grant rotation, Vercel identity, private Blob bytes, cellular operation and local hardware recovery remain separate acceptance. Restored bytes are a historical lower bound until post-backup accounting is reconciled. Recording remains disabled.
