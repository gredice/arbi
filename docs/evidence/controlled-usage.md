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

Validation and clean source report are recorded after checks. Mandatory idle-day,
mobile-link, direct/TURN, router/carrier and reviewed latency/data-budget evidence
remain missing. Recording is deferred and disabled. Physical acceptance is false
and invoice savings are unavailable; #63 remains open for those measurements.
