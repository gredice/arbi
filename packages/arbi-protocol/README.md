# @arbi/protocol

Implemented, transport-neutral ARBI 1.0 JSON contracts, runtime validation, generated TypeScript types and pure reference admission/telemetry rules. This package has no network client, device credentials, persistence implementation or actuator authority.

- [Protocol specification and integration requirements](../../docs/software/protocol.md)
- [Canonical JSON Schema 2020-12](schema/message.schema.json)
- [Synthetic valid/invalid reference fixtures](fixtures/contracts.json)
- [Reference implementation](src/reference.ts)
- [Configuration/calibration contract and apply/rollback boundary](../../docs/software/configuration.md)
- [Configuration schema](schema/configuration.schema.json) and [synthetic fixtures](fixtures/configuration.json)
- [Mobile data accounting 1.0 specification](../../docs/software/mobile-data-accounting.md), [schema](schema/accounting.schema.json), [fixtures](fixtures/accounting.json) and [reference calculations](src/accounting.ts)
- [Cross-runtime reference specification](../../docs/software/reference-fixtures.md) and [versioned vectors](fixtures/reference/1.0/vectors.json)

From the repository root, using Node.js >=24 and pinned pnpm:

```sh
pnpm --filter @arbi/protocol generate
pnpm --filter @arbi/protocol build
pnpm --filter @arbi/protocol test
pnpm protocol:check
```

`build` and `lint` reject stale generated bindings. `test` needs `python3` and a C11 compiler named `cc`; missing tools fail explicitly. Ubuntu CI and the documented macOS toolchain provide them. Existing Python/C JSON round-trips remain intact. The additional `conformance` package command (root `protocol:check`) independently verifies units, transforms, cable geometry, compatibility and exact schema/configuration identity in TypeScript, Python and C, including deliberate discrepancies. These are host reference consumers, not complete firmware validators or physical-device evidence. Future runtime adapters must apply the full schema **and** semantic rules and retain these fixtures.

Consumers declare `"@arbi/protocol": "workspace:*"`. Use `parseMessage` on bounded JSON wire text or `validateMessage` on decoded values; inspect its discriminated `Result` before consuming data. Types alone do not enforce numeric ranges or authorization. Schema consumers can import `@arbi/protocol/schema` without the Node runtime validator.

`admitCommand` returns `accepted` or `duplicate`, or a stable error. A duplicate means return the persisted prior outcome; never dispatch it again. Its in-memory bounded ledger is a reference for tests, not durable or exactly-once execution. Production must transactionally persist admission/dispatch intent, restore it after restart, and enforce independent local limits and stopping.

Configuration consumers use `parseConfigurationRecord` or `validateConfigurationRecord` with the record kind, and can import `@arbi/protocol/configuration-schema`. `ConfigurationReference` demonstrates durable-commit-before-acknowledgement, exact rebooted identity and archived rollback. `checkConfiguredCommand` adds calibration/hardware/frame/limit compatibility to existing protocol admission; it grants no actuator authority. Local bounds and independently approved calibration digests must come from trusted local evidence. Configuration 1.0 is independent of message protocol 1.0, which remains unchanged.

Accounting version `arbi-accounting/1.0` is additive and leaves message protocol 1.0 unchanged. Use `parseAccounting`/`validateAccounting` at its external boundary; `@arbi/protocol/accounting-schema` exports the standalone schema, which references the message schema. Generated types and pure reconciliation, unit, cycle and allowance calculations require these runtime refinements. Accounting does not implement device/router metering, ingestion, budgets or tariff billing.
