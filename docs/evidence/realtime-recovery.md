# Realtime recovery source and host evidence

Date: 2026-10-07. Work: [#29](https://github.com/gredice/arbi/issues/29). Baseline: `92defa6bc887c395e326ed038ceca7f9f588cce0`; tested revision is the source accompanying this record. Configuration: macOS development host, Node 24.15.0, pnpm 11.5.2, native PostgreSQL 15.19 (Homebrew), Ably JavaScript SDK 2.29.0. All identities, keys, sites, broker transports and databases are ephemeral synthetic fixtures. Review: implementation self-review and assertions; independent provider/physical review remains open.

The [native PostgreSQL suite](../../apps/arbi-dashboard/src/realtime/postgres.test.ts), through `pnpm --filter @arbi/dashboard test:postgres`, creates a fresh socket-only temporary cluster/database and applies unchanged 0001–0004 plus repeatable 0005. It preserves the enrollment/media/audit/job suites. Independent connections prove a reader waits for a late writer, rollback does not advance the cursor, a 270-change retention gap resets, deployment epoch/ahead cursors reset, exact per-client routing persists, publication failures retain the outbox, and changed credentials/boot/configuration/member/session fence subscriptions. Audit/grant admission rolls back on issuance failure. Persistent attach/heartbeat/revocation budgets are exercised.

A separately spawned cloud HTTP process owns its own database pool; a separately spawned executable edge recovery consumer uses actual signed HTTP against it and the same native PostgreSQL state. The consumer recovers an authenticated current snapshot, consumes the merged job poll, creates six durable metered request/response attempts and sends no execution receipt. Parent process readback sees the persisted route/presence and can publish to it after instance change. Fixture credentials travel only over local IPC and are never printed. This establishes independent-process host behavior, not Neon/Vercel deployment.

[REST SDK tests](../../apps/arbi-dashboard/src/realtime/ably.test.ts) exercise the installed SDK against an isolated HTTP transport: canonical TokenRequest HMAC, exact channel/client/TTL capability, bounded JSON notification publication, and revocation through current/previous issuing keys without the reauthorization margin. [Realtime SDK and consumer tests](../../apps/arbi-edge-controller/src/cloud-realtime/recovery.test.ts) exercise real SDK WebSocket authentication/strict subscribe attachment, original JSON payload metering, provider-revocation error and original expiry. Consumer tests additionally exercise duplicate/reordered/dropped hints, 100 overlapping callers during a blocked operation, replay gaps, bounded catch-up and repeated disconnects. Failed upload attempts and an oversized discarded response retain measured application bytes. These transport fixtures do **not** use an Ably account or certify provider revocation configuration/latency.

Passed host commands: `pnpm docs:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test --concurrency=1`, native `pnpm --filter @arbi/dashboard test:postgres`, `pnpm protocol:check`, `pnpm scenario:check`, `pnpm build`, `pnpm --filter @arbi/dashboard test:http` and `git diff --check`. Native PostgreSQL totals ten passing tests (five realtime subtests plus preserved suites); the recovery/SDK WebSocket suite has four passing tests. The ordinary dashboard suite has 30 passing tests and five explicit native-test skips, separately fulfilled by `test:postgres`. Linux service verification is skipped on macOS and remains a required CI check. The first repository run and a focused retry hit the unchanged LAN-metering diagnostic timeout; a temporary committed-main snapshot and the subsequent focused/full serialized worktree runs passed with no assertion or deadline changes. Required CI results are recorded in the accompanying PR. Node's existing PGlite-only `--no-wasm-code-gc` workaround and serial package/database tests are preserved.

[Realtime semantics and the exact external gate](../software/realtime-recovery.md#external-acceptance-gate) remain binding. #29 stays open pending isolated live provider/mobile/deployment evidence. Bench/HIL, selected Linux host/storage power loss, installed/qualified physical operation, provider billing and physical completion are **not established**. Broker/HTTP recovery never enables actuator dispatch, clears a local fault, grants a control lease or makes `Parked` update-safe.

## Browser source and host evidence — 10 October 2026

Baseline: `9e1e4da` on current main; tested browser source accompanies this record.
Configuration: macOS, Node 24.13.0, pnpm 11.5.2, native PostgreSQL 15.19
(Homebrew), Ably SDK 2.29.0 and Playwright 1.58.2's Chromium
145.0.7632.6. Reviewer: implementation self-review and executed assertions;
independent provider/physical acceptance remains open.

Six [browser consumer/HTTP unit checks](../../apps/arbi-dashboard/src/realtime/browser.test.ts)
cover duplicate/reordered/wrong-site hints, dropped-hint heartbeats, replay gaps,
bounded catch-up, eight admissions and 60 reads per minute, original expiry,
broker-unavailable HTTPS fallback, denied authorization, wildcard/publish-token
rejection and failed/oversized attempt bytes. One hundred overlapping callers
produce one operation. Closing during delayed admission or SDK opening cannot
resurrect state/subscriptions. HTTP cancellation also bounds an uncooperative
credential callback; overflow cancels the response stream.

The [Chromium integration check](../../apps/arbi-dashboard/browser/realtime.spec.ts)
executes the actual browser source modules and installed Ably browser SDK, with
the real authenticated `RealtimeHttp` boundary and two independent native
PostgreSQL pools/runtime instances. It proves exact subscribe attachment,
authenticated other-site denial, instance-change readback, a burst of 100
notifications, dropped-hint recovery, epoch reset, cancellation during a delayed
HTTP response, broker-unavailable authoritative HTTPS recovery and current
session revocation. SQL readback verifies persisted routing/principal binding;
the client emits no publication/presence or execution receipt and creates no
command job. All identities, bearer tokens and databases are ephemeral synthetic
fixtures. Broker WebSocket frames are intercepted test transport; no Ably account
or mobile network is involved. Traces, videos, screenshots and browser storage
are not saved.

Passed commands:

```text
pnpm docs:check
pnpm lint --filter @arbi/dashboard --concurrency=1
pnpm typecheck --filter @arbi/dashboard --concurrency=1
pnpm --filter @arbi/dashboard test
pnpm --filter @arbi/dashboard test:postgres
pnpm build --filter @arbi/edge-controller --concurrency=1
pnpm build --filter @arbi/dashboard --concurrency=1
pnpm --filter @arbi/dashboard test:browser
pnpm --filter @arbi/dashboard test:http
git diff --check
```

The ordinary dashboard suite passed 40 checks with six explicit native skips;
the separate native suite passed all 11 checks. All eight browser checks passed,
including the existing seven shell/redirect checks. PostgreSQL and the pinned
Chromium were initially absent and installed before successful execution; native
commands used the Homebrew PostgreSQL bin directory on PATH. The Chromium test
exposed and corrected a native browser `fetch` receiver error that Node fixtures
did not reproduce. Tests use the existing serial launchers and assertions, and
the browser launcher now forwards optional Playwright file filters. Hardware/BOM
source and generated artifacts are unchanged, so their owning checks are not
selected by this change.

This adds browser source/host evidence to the existing edge/server foundation;
it does not close #29's live-provider/mobile/deployment gate. The client is
explicit composition, not a default dashboard subscription or a browser export
of the shell's HttpOnly session. The current five-second human directory
freshness and persistent eight-admission budget can throttle continuous browser
renewal; they remain enforced and need measured acceptance/review. No live
Gredice, Ably, Neon/Vercel realtime deployment, actual cellular use, provider
revocation latency or physical operation is established by these checks.

## Edge reconnect and traffic hardening — 11 October 2026

Baseline: `63f75b9` on current main; tested source accompanies this record.
Configuration: Debian 13 development container, Node 24.19.0, pinned pnpm
11.5.2, Ably SDK 2.29.0, native PostgreSQL 16.14 and Playwright 1.58.2's
Chromium 145.0.7632.6. Reviewer: implementation self-review and executed
assertions. All accounts, identities, keys, sites and broker transports are
synthetic fixtures. No live provider credentials or mobile network are present.

The [edge recovery suite](../../apps/arbi-edge-controller/src/cloud-realtime/recovery.test.ts)
now has ten passing checks. A replay gap is followed by a successful fresh
snapshot; it cannot pin subsequent reconnects to the rejected cursor. Closing
during admission, SDK opening, recovery or job polling aborts the adapter and
cannot resurrect a subscription, snapshot or job count. Slow failed operations
start backoff after settlement. Old subscription callbacks cannot wake a new
grant. Invalid site/channel/capability/expiry claims never open the broker or
poll jobs. Broker opening failure keeps bounded HTTPS recovery visibly degraded.
The earlier provider token expiry closes an otherwise unexpired grant.

Actual SDK WebSocket fixtures cover cancellation and missing attachment replies.
An oversized discarded hint is metered before filtering, closes the subscription
when the shared HTTPS/broker byte budget is exhausted and blocks a subsequent
HTTP attempt. HTTP cancellation bounds an uncooperative submission and a stalled
body read; 100 retries cannot accumulate additional orphan submissions. A late
response body is cancelled. The budget resets only at its next minute window.
The original failed/oversized transfer accounting assertions remain intact.

The [browser unit suite](../../apps/arbi-dashboard/src/realtime/browser.test.ts)
adds a seventh passing check for delayed callbacks during backoff and after grant
replacement. Eight Chromium integration checks and all 19 native PostgreSQL
checks pass, including the independent cloud/edge process test, persisted routing,
site isolation, slow-consumer budgets, event gaps and deployment epoch changes.
The ordinary dashboard suite passes 49 checks with seven explicit native skips,
fulfilled by the separate native suite. The ordinary built HTTP launcher also
passes with unconfigured boundaries denied.
These are host fixtures, not live Ably/Vercel/Neon or actual mobile measurements.

Passed commands (using the pinned package manager through `corepack pnpm`):

```text
pnpm docs:check
pnpm lint --filter @arbi/edge-controller --filter @arbi/dashboard --concurrency=1
pnpm typecheck --filter @arbi/edge-controller --filter @arbi/dashboard --concurrency=1
pnpm build --filter @arbi/edge-controller --concurrency=1
node --test apps/arbi-edge-controller/dist/cloud-realtime/recovery.test.js
pnpm --filter @arbi/dashboard test
pnpm build --filter @arbi/dashboard --concurrency=1
pnpm --filter @arbi/dashboard test:postgres
pnpm --filter @arbi/dashboard test:browser
pnpm --filter @arbi/dashboard test:http
git diff --check
```

The container lacks PostgreSQL and cannot install system packages as its
unprivileged user. Test-only PostgreSQL 16.14 binaries from
`@embedded-postgres/linux-x64@16.14.0-beta.17` were unpacked under `/tmp`, with
library SONAME links, a `pg_config --bindir` shim and command-local PATH/library
selectors. The unchanged launchers still create and remove their own real native
socket-only clusters. No dependency or launcher changes are committed.

`pnpm test --filter @arbi/edge-controller --filter @arbi/dashboard --concurrency=1`
fails locally: the full edge suite's existing Linux service test reports
`spawnSync /usr/bin/node ENOENT`; this container's Node resides elsewhere. The
repository CI already provisions that exact service runtime path before running
the unmodified assertion. The unchanged local-job SIGKILL matrix also exceeds its
300000 ms test timeout in this container. Neither assertion/deadline is changed;
the complete configured CI result remains required before merge.
The recovery tests use a consistent injected clock for token and heartbeat
fixtures; their original catch-up/admission assertions are preserved.

The [external acceptance gate](../software/realtime-recovery.md#external-acceptance-gate)
remains open under #29: isolated live revocable Ably keys, current identity and
Neon/Vercel composition, maintenance scheduling, two deployed cloud instances,
measured actual mobile reconnect/revocation/quotas and transport/provider layers.
No actuator dispatch, physical acceptance or live-provider claim is added.
