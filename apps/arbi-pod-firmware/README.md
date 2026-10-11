# Pod service foundation

Node/TypeScript executable with a supervised Linux unit, real TLS 1.3 loopback diagnostic adapter, bounded local records and shared audit/traffic spools. The production adapter has no camera or servo access. Default startup needs no credentials and exposes `Fault` / `CONFIG_MISSING` on loopback health; it cannot capture, reposition, autofocus, provision devices or install updates.

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm exec turbo build --filter=@arbi/pod-firmware
pnpm --filter @arbi/pod-firmware test
pnpm --filter @arbi/pod-firmware start -- --health-port 8081
```

`GET http://127.0.0.1:8081/health` returns 503 until configuration and camera initialization are valid. A trusted mock camera can provide diagnostic readiness in integration tests; physical readiness remains false. The [service unit](deploy/arbi-pod-firmware.service) uses a dedicated account, 64 MiB Node old-space, 192 MiB process-memory ceiling, private devices and loopback-only networking. Actual Debian 13 arm64/Pi 3A+ image startup, confinement enforcement and resource budgets remain unverified.

The test-only manifest is schema `arbi.pod-runtime/1.0`: simulation/test applied configuration and exact accepted digest, health/module ports, private storage directory, and TLS CA/server-certificate/private-key files plus the exact enrolled edge certificate digest. Only protected local restart can replace it. Private credential contents never enter source or output. The target accepts one authenticated edge peer and only versioned `state.resync`; it creates a new session after disconnect and never replays command intent.

`node scripts/benchmark.mjs` starts the actual inhibited executable under its heap limit and reports a two-second development-host CPU/RSS/temperature observation. Network baseline is explicitly unavailable. It is not a Pi bench record. See [runtime and provenance](../../docs/software/pod-runtime.md), [ADR-0026](../../docs/decisions/0026-inhibited-pod-service.md) and [evidence](../../docs/evidence/pod-runtime.md).
