# Controlled host usage evidence

[#63](https://github.com/gredice/arbi/issues/63) adds an opt-in Linux-loopback
probe described in [ADR-0044](../decisions/0044-controlled-host-usage-evidence.md).
From the edge-controller directory, provide a fresh output filename inside an
existing private directory (mode 0700):

```sh
node scripts/controlled-usage-evidence.mjs --output /private/usage/report.json
```

The command rejects dirty source, rebuilds the Edge dependency closure, runs six
fresh private SQLite/TCP scenarios and verifies unchanged source before writing
an exclusive mode-0600 report. It opens only ephemeral localhost sockets and
never starts a production collector, camera, actuator or transport.

| Scenario | Actual measurement | Limit |
| --- | --- | --- |
| Idle short sample | Zero application transfers; independent loopback delta | 40 ms observation, not an idle day |
| Bounded reconnect | Eight connections with 64-byte upload and 16-byte reply | Controlled reconnect sample, not a mobile storm |
| Interrupted still/retry | First 65536-byte prefix plus full 262144-byte retry | Attempt bytes and retry lineage retained |
| Diagnostic export | 64-byte request and 65536-byte response | Fixture bytes, no private diagnostics |
| Artifact download | 64-byte request and 524288-byte response | Controlled payload, not installed OTA |
| Optional exhaustion | Media and update rejected at exhausted 64-byte allowance; local stop and essential 64-byte health upload | Declared fixture policy, no physical safety proof |

Application submission/receipt and native LAN interface counters remain separate
layers. The loopback delta includes both directions, TCP overhead and unrelated
host traffic; its nonnegative residual is reported with 20 ms sampling uncertainty.
Router/WAN/carrier/TURN bytes are unavailable. No equality, latency-budget
acceptance or invoice savings is inferred.

The existing [native shared producer](live-producer.md) test separately measures
one upstream and two viewer payloads, reads Linux counters, signs and ingests
those windows through the original UsageStore, and queries both accounting
layers. Per-viewer and shared-upstream identity stay unchanged.

[Host results](../evidence/controlled-usage.md) cannot close the required mobile
bench. A 24-hour idle run, selected Internet direct/TURN paths, realistic mobile
reconnect/loss measurements and reviewed data/latency budgets remain blocked.
Future recording stays disabled and has no invented traffic measurement.
