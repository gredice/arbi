# ADR-0041: Isolated live producer and measured viewer payload reference

Status: proposed in the issue #60 PR. Scope: explicit test-realm composition.

Reuse the existing PostgreSQL live-session authority and CapturePreview camera
and transfer-budget owners. Share their existing bounded demand DTO through a
private Node protocol export. No actuator wire protocol changes.

An opt-in native producer holds one camera lease and encodes only current
backend demand. A private immutable SQLite journal fences generations across
restart; a separate kernel-released exclusive database lock prevents concurrent
owners. Independent monotonic expiry and idle checks, local health, update
inhibition, still contention, bounded frame size/rate and sink timeout remove
camera authority. Replayed demand never renews or reopens a stopped generation.

A private server hook reads current individual viewer grants, permissions and
policy, and rechecks authority/deadlines after asynchronous policy evaluation.
It closes revoked/expired grants through the existing audited owner and returns
no recipients for stale demand. The hook mints no session or media endpoint.

The native integration's test-only TCP relay carries one encoded fixture
upstream and separate payloads to independently scoped viewers. Its counters
enter the existing signed usage/device observation APIs. Shared upstream IDs
are referenced by both sessions without duplicating garden traffic. Encoded
attempt charges, accepted payload and packet envelope remain separate evidence.

This reference selects no production media or NAT/relay transport. Physical
camera, selected-host resource limits, WAN/carrier/TURN accounting and the #43
hardware decision remain gates. See the [guide](../software/live-producer.md)
and [host evidence](../evidence/live-producer.md).
