# Controlled usage host evidence

[#63](https://github.com/gredice/arbi/issues/63),
[guide](../software/controlled-usage-evidence.md),
[ADR-0044](../decisions/0044-controlled-host-usage-evidence.md).

Actual private native SQLite, TCP sockets and Linux sysfs counters exercise six
bounded scenarios. A separate native PostgreSQL test measures an encoded shared
producer with two TCP viewers, independently reads Linux-loopback counters, and
ingests signed application/interface observations through the original usage
service. The loopback interface is a partial LAN boundary, including transport
overhead and unrelated work, never a mobile WAN or carrier invoice.

The [generated clean-source report](controlled-usage.json) records source
d70a2acd2a86b8b02d18071593fe825cdeffe31c and compiled digest
c514044c6a1c3b7f1f7d1cd0208d5a62096d943ea9d3de797f3774044f76a55b. The reconnect case records eight
connections, 512 upload and 128 download bytes. Interrupted still transfer
records 327680 upload bytes including its prefix and retry. Diagnostic/artifact
downloads record 65536/524288 bytes. Optional media/update admission is denied;
local stopping and essential 64-byte health upload remain available.

Native PostgreSQL passed all 74 checks in 43.089 seconds, including signed
application/kernel ingestion and independent layer readback. Forced Edge tasks
and separate clean-source report generation pass. The focused scenario/transfer suite passed 15 checks in 8.662 seconds;
all 19 native traffic checks passed in 1.883 seconds. Dashboard build/lint/
typecheck passed 11 forced tasks in 20.643 seconds. Documentation links and
whole-tree whitespace pass. Mandatory idle-day,
mobile-link, direct/TURN, router/carrier and reviewed latency/data-budget evidence
remain missing. Recording is deferred and disabled. Physical acceptance is false
and invoice savings are unavailable; #63 remains open for those measurements.
