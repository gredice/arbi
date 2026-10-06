# @arbi/protocol

Implemented, transport-neutral ARBI 1.0 JSON contracts, runtime validation, generated TypeScript types and pure reference admission/telemetry rules. This package has no network client, device credentials, persistence implementation or actuator authority.

- [Protocol specification and integration requirements](../../docs/software/protocol.md)
- [Canonical JSON Schema 2020-12](schema/message.schema.json)
- [Synthetic valid/invalid reference fixtures](fixtures/contracts.json)
- [Reference implementation](src/reference.ts)

From the repository root, using Node.js >=24 and pinned pnpm:

```sh
pnpm --filter @arbi/protocol generate
pnpm --filter @arbi/protocol build
pnpm --filter @arbi/protocol test
```

`build` and `lint` reject stale generated bindings. `test` needs `python3` and a C11 compiler named `cc`; missing tools fail explicitly. Ubuntu CI and the documented macOS toolchain provide them. The Python/C harnesses prove representative host JSON round-trips and exact decimal-string counters; they are not firmware validators or physical-device evidence. Future runtime adapters must apply the schema **and** semantic rules and retain these fixtures (#20).

Consumers declare `"@arbi/protocol": "workspace:*"`. Use `parseMessage` on bounded JSON wire text or `validateMessage` on decoded values; inspect its discriminated `Result` before consuming data. Types alone do not enforce numeric ranges or authorization. Schema consumers can import `@arbi/protocol/schema` without the Node runtime validator.

`admitCommand` returns `accepted` or `duplicate`, or a stable error. A duplicate means return the persisted prior outcome; never dispatch it again. Its in-memory bounded ledger is a reference for tests, not durable or exactly-once execution. Production must transactionally persist admission/dispatch intent, restore it after restart, and enforce independent local limits and stopping.
