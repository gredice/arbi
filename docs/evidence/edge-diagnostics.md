# Edge diagnostic retention and reconnect host evidence

- Date: 2026-10-11
- Work record: [#51](https://github.com/gredice/arbi/issues/51)
- Revision: source/tests in this PR; its merge commit identifies the accepted revision
- Host: isolated Linux x86-64, Node 24.19.0, pinned pnpm 11.5.2, native SQLite and PostgreSQL 18.4
- Inputs: synthetic protocol/capabilities, private temporary files, generated isolated signing keys; no live credentials

The [diagnostic suite](../../apps/arbi-edge-controller/src/diagnostics/diagnostics.test.ts) passed nine tests, including authenticated TLS observation, bounded synchronous floods, reserved fault history, clock/boot changes, unsupported measured sensing, closed-schema secret/text rejection, expiration, current export authorization/cancellation, frozen snapshots, concurrent export limits, low-data/essential-only modes, unknown coverage, exhausted quota, durable debit before transport, lost receipts, stalled callbacks and private-file/ownership/corruption checks.

The sixty-second disconnected soak uses a 64-record, 64 KiB logical, 64-page ring and 100-input bursts with an event-loop yield between bursts. Recorded source evidence:

| Observation | Result |
| --- | --- |
| Duration | 60,006 ms |
| Diagnostic inputs | 1,084,300 |
| Peak process RSS | 229,838,848 bytes (219.2 MiB) |
| Peak diagnostic directory size | 65,536 bytes |
| Maximum simulated stop-timer delay | 19.640 ms |
| Timer callbacks | 5,220 |
| Retained / logical bytes | 32 / 38,720 |
| Accepted / dropped / uploaded / rejected | 10,858 / 1,084,268 / 0 / 0 |
| Volatile losses / degraded storage | 0 / false |

These are actual measurements on this selected prototype host. The timer represents a simulated local stop scheduler; it is not a physical GPIO/watchdog latency measurement or a hard real-time guarantee. Limits of 512 MiB RSS and 1,000 ms timer delay are test regression ceilings, not production safety requirements.

The [native reconnect test](../../apps/arbi-dashboard/src/audit/diagnostics.postgres.test.ts) uses the actual edge pump, SQLite job audit relay/transfer ledger, signed HTTP ingest handler and fresh native PostgreSQL schema. The first event commits while its response is lost. After storage/process-epoch reconstruction, two original old-boot events reach cloud storage in three attempts, with two authoritative rows. Actor, site, device, boot/session, command links and original source clocks compare exactly. Missing sequence 2 and disjoint clock uncertainty remain visible. The test exhausts discretionary quota with unknown WAN coverage while bounded essential audit replay succeeds. The full native dashboard slice passes 44/44 tests.

The shared audit suite passes six tests, including native SIGKILL/SQLite-full recovery and bounded prefix corruption/receipt checks. Edge and dashboard build/type checks, ordinary dashboard regressions, HTTP contracts, docs/whitespace checks and the full CI matrices provide additional source evidence. The existing local systemd check cannot run because this host lacks `/usr/bin/node`; Linux CI stages its pinned executable and runs that check.

No selected Pi/Pico, installed sensor, actual cellular connection, production notification/media/recording service, privileged kernel shaping, physical storage interruption or carrier bill was exercised. Cloud/edge adapters stay opt-in and simulation-only.
