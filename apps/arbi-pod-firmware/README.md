# Pod service foundation

The [capture job integration](../../docs/software/capture-orchestration.md) consumes the actual local job journal, bounded motion adapter, pod gimbal/sequencer and native edge stage. Failed focus/capture remain separate from processing/upload; retries preserve the original image. These are explicit simulation fixtures, with [source evidence](../../docs/evidence/capture-orchestration.md) separate from hardware acceptance.

The explicit [capture custody/recovery adapter](../../docs/software/capture-transfer.md) adds resumable native chunks, verified signed edge ownership, acknowledged retention and historical cursor handoff. [Evidence](../../docs/evidence/capture-transfer.md) separates native SIGKILL/signature/filesystem checks from physical power/Wi-Fi and cloud acceptance. Trusted runtime attachment drains owners on stop; ordinary startup gains no camera/transfer or actuator endpoint.

The trusted [gimbal source model](../../docs/software/gimbal-model.md) consumes actual configuration/command admission and stopped-motion evidence. It bounds axis/PWM/velocity policy and synthetic settling without hardware activation. See [source and physical evidence](../../docs/evidence/gimbal-model.md).

The [capture source sequence](../../docs/software/capture-sequencing.md) consumes that model, actual command admission and a synthetic camera, with native bounded raw-image/metadata receipts and interrupted-write/process recovery. Capture, processing and upload retain separate states. The normal runtime still opens no camera/servo. See [camera bench gates](../../docs/evidence/capture-sequencing.md).

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
