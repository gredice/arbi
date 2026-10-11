# ADR-0044: Controlled host usage evidence

Status: proposed in the issue #63 PR. Scope: opt-in native Linux fixtures.

Measure actual bounded localhost TCP submissions and peer receipts with the
existing ApplicationMeter/TrafficSpool, independently reading native Linux
loopback counters. Keep the interface boundary labelled LAN and coverage
partial. Record the residual, transport overhead, unrelated host traffic and
clock uncertainty; do not equate loopback bytes with WAN or carrier billing.

Use fresh private native stores per scenario. Exercise a short idle sample,
bounded reconnects, interrupted still transfer and retry, diagnostic export,
artifact download, and exhausted optional media/update budget. Required local
stopping remains independent, and essential health traffic uses its existing
separate reservation. These prove source behavior with controlled substitutes.

Add the same independent kernel observation to the existing native two-viewer
producer test. Ingest the actual observations through registered signed device
proofs into the existing UsageStore; retain one shared upstream and two distinct
viewer windows. No extra usage ledger or runtime collector is introduced.

The opt-in evidence command requires clean source, rebuilds dependencies before
importing measured code, and records commit/digest. A 24-hour idle/mobile run,
selected direct/TURN transport and router/provider measurements remain missing.
Recording is deferred and disabled. No invoice savings, physical timing or
public-operation claim follows from host measurements.
