# Edge transfer budgets and verified artifact cache

Work record: [#45](https://github.com/gredice/arbi/issues/45). The prototype is a
trusted, simulation-only WAN coordinator in the existing edge application. Ordinary
settings start no WAN transfer. It enables no media, physical control or update install.

## Composition and policy

[TransferBudget](../../apps/arbi-edge-controller/src/transfers/budget.ts) accepts a
site/test realm, current edge identity, private SQLite path, explicit policy, trusted
clock and current human configuration-authorizer. Optional `EdgeRuntime.composeTransfers`
checks those bindings before exposing diagnostics. Budget storage closes after local
socket inhibition and job stopping. Local watchdog, local stop and LAN module traffic
do not call or await this coordinator. A failed/full WAN ledger denies network work;
it cannot disable independent local stopping.

Policy fixes allowance, essential byte reserve, separate class rates/concurrency,
maximum transfer size/attempts, UTC upload windows, unknown-coverage behavior and stream
bitrate/duration/idle limits. It is persisted and revision-bound: restarting with different
policy is rejected rather than silently resetting quota. A reviewed policy replacement
must preserve and reconcile the ledger; cloud plan/policy editing belongs to #55.
`unknownCoverage:defer` is the fixture/default recommendation; `allow` is an explicit
operator decision and never relabels unknown usage as measured. There is no override
of unknown clocks, stale authority, concurrency, rate or storage bounds.

The coordinator has one live process owner. Multiple consumers share it; another live
owner cannot open the ledger. SQLite immediate transactions, FULL synchronization,
private storage, content hashes and a fixed schema bound admission. Limits are 512
transfer identities, 8,192 charges, 128 overrides, 1,024 audit events, a 1 MiB serialized
ledger and 1,024 database pages. Exhaustion is explicit, with no automatic destructive
compaction. Preserve ledger/receipts across process and policy upgrades.

## Usage and reservations

The trusted accounting bridge supplies `checkpoint` from [usage rollups](usage-rollups.md):
explicit half-open billing-period boundaries, monotonic report revision, observed usage,
coverage/freshness and covered local charge IDs. This method is not a client endpoint.
The bridge must verify that those exact settled attempts are included in the selected
WAN/billing layer and interval before acknowledging them. Application bytes alone
cannot prove router/carrier coverage. Unknown, pending or impossible coverage IDs,
replayed reports and decreasing totals are rejected. Downward corrections require
explicit operator reconciliation; they never automatically enlarge allowance.

Available discretionary bytes equal policy allowance minus reported usage, uncovered
attempt debits and outstanding reservations. Preflight reserves the expected size
atomically; concurrent consumers cannot reserve the same remaining bytes. Essential
control/audit WAN traffic has independent per-period bytes, per-second rate and active
slot limits, and remains admissible during unknown/exhausted discretionary coverage.
It still requires an explicit known billing period and reliable clock. No provider
total, plan period or unlimited offline allowance is invented.

Every transport calls `grant` **before** a bounded attempt (at most 64 KiB). The ledger
durably charges its maximum size. `settle` replaces that debit with trusted actual
attempted bytes and advances only durably accepted payload offsets; retry overhead is
charged again. Authoritative checkpoints remove covered local charges from the pending
sum to avoid double counting. Rate slots use persisted UTC seconds across boot epochs;
the reliable local clock must reject regression and avoid unbounded clock acceleration.
This is application scheduling, not a kernel/router shaper or measured saturated LTE
acceptance. Each owning adapter must limit its transport reads/writes to the grant and
meter all attempted bytes, including partial/failed transfers.

## Resume, cache and live limits

Boot pauses active transfers, discards transport handles and retains maximum debits for
ambiguous attempts. It never automatically restarts network work. Explicit resume
rechecks period, coverage, class window, override and slots; retry counts persist.
Stream resume requires a new session, while total duration/idle/bitrate caps remain
independent of renewed viewer intent. Only an authenticated fresh viewer-intent adapter
may call `intent`; server timers/connection keepalives are not evidence of viewing.

[ArtifactCache](../../apps/arbi-edge-controller/src/transfers/artifacts.ts) downloads
bounded immutable ranges through a caller-owned authenticated transport. It stores no
URL, credential or signed capability. SHA-256 identity deduplicates artifact consumers;
partial bytes are fsynced before recording accepted offsets. Uncommitted tail bytes
are truncated on resume. Missing committed bytes inhibit recovery. Completion requires
exact size and digest; cache hits reverify both and issue no network grant. Oversized
responses, failed transport, digest mismatch and cache exhaustion remain bounded
failures. An attempt cap stops repeated failed downloads even after reboot.

The cache directory is private, uses no-follow opens, stores at most 512 content-addressed
files and has an explicit aggregate byte cap (default 16 MiB, maximum 64 MiB). There is
no automatic eviction or installer. Signed release/trust and physical update recovery
remain owned by #33/#73/#78; a digest-valid cache file alone grants no installation.

## Overrides and audit

Overrides require a current authenticated human configuration grant at trusted local
composition. They name one discretionary class, a bounded extra allowance and expiry
of at most 15 minutes. Every grant rechecks current authorization and expiry. All
outstanding reservations/debits still count, so reuse cannot spend the same exception
twice. An override cannot change essential authority or bypass the other limits.

The full bounded override, actor and two protocol-valid configuration intent/allow
events commit with the ledger before use. `copyAudit` hands pending events to the
existing durable audit spool; its callback must acknowledge only a durable append.
Interrupted handoff retries the same IDs. Audit intent/authorization is distinguished
from physical device application, and no extra protocol action or recording authority
is introduced. Detailed budget outcomes are visible in coordinator status and owning
transfer records; packets do not each allocate an audit event.

See [host evidence](../evidence/transfer-budgets.md) for deterministic concurrency,
reboot, simulated saturation, accounting and cache tests. Actual mobile throughput,
carrier reconciliation, OS power loss and installed-system timing remain unmeasured.
