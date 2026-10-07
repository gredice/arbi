# Cross-runtime reference fixtures 1.0

[Issue #20](https://github.com/gredice/arbi/issues/20) adds a versioned, language-neutral reference boundary under [@arbi/protocol](../../packages/arbi-protocol/README.md). The [vectors](../../packages/arbi-protocol/fixtures/reference/1.0/vectors.json) and their [closed JSON Schema](../../packages/arbi-protocol/fixtures/reference/1.0/vectors.schema.json) use `arbi.reference/1.0`. Message `arbi/1.0` and configuration `arbi.configuration/1.0` retain their accepted meanings; this fixture format adds no wire message, coordinate frame, control authority or runtime capability.

## Identity and inputs

Each successful consumer emits JSON reporting fixture version, protocol version, configuration schema version, exact configuration revision and SHA-256 digest, geometry revision and calibration revision. The manifest also names exact site/gimbal frame identities and pins the canonical message/configuration schema `$id` and SHA-256 of their committed UTF-8 bytes. A schema file change, including whitespace, requires a reviewed manifest refresh. Digest equality identifies content; it is not authentication or a signature.

All consumers read the existing [configuration fixtures](../../packages/arbi-protocol/fixtures/configuration.json), selecting `valid.configuration`, and [message fixtures](../../packages/arbi-protocol/fixtures/contracts.json), selecting `valid.move`. Configuration identity follows the accepted sorted-key canonical JSON algorithm in [configuration 1.0](configuration.md). No configuration copy or fake calibration is introduced. The Python/C digest implementations deliberately support the current configuration fixture subset: ASCII strings and safe integer numbers, plus arrays, objects, booleans and null. They do not promise arbitrary Unicode/floating-point canonicalization. Reordered configuration properties and whitespace retain the same digest in every consumer.

The schema defines units explicitly: mm, degrees, mm/s, mm/s², newtons and milliseconds. Conversion cases cover metre/millimetre, radian/degree, second/millisecond, speed and acceleration scales. uint64 decimal-string vectors include values above JavaScript's exact-number range, carry to `2^64-1`, and refusal to wrap; each consumer independently parses and increments them without floating-point conversion. Existing representative message round-trips still exercise JSON serialization and exact sequence/fence strings.

## Mathematical reference model

The transform convention is `site = translationMm + Rz(yawDeg) × localMm`. `Rz` is the right-handed active rotation around positive site z: positive 90° maps local +x to site +y. Cases cover translation, both quarter-turn signs, negative coordinates and an oblique angle. Each consumer derives forward and inverse results. These fixture-only local coordinates do not add a protocol frame or infer an observed pod pose, configured gimbal-to-site transform or physical calibration.

Four-cable geometry reads the configured anchors by line identity `a/b/c/d`, checks their horizontal rectangular topology and derives `squaredMm2 = Σ(anchorAxis - positionAxis)²` and `lengthMm = sqrt(squaredMm2)`. Asymmetric, symmetric and near-corner positions exercise anchor ordering, all three axes and scale. Positions remain inside the configured workspace after its uncertainty margin. The `motion-message` case must match the existing message's position and named site frame. Configured length offsets must retain positive payout beyond calibration uncertainty. Separate signed-offset arithmetic examples use synthetic numbers to verify `payoutMm = geometricMm + offsetMm`; they do not replace the accepted configuration's zero offsets.

Results use a fixed numerical tolerance of `1e-7 + 1e-12 × abs(expected)` in the result's unit. The tolerance is implementation-owned, never supplied by a fixture. Euclidean lengths are analytical targets/estimates. They model no sag, elasticity, pulley routing, drum quantization, tension, actuator feedback or measured position and establish no safe trajectory or structural load.

## Independent consumers and rejection evidence

- [TypeScript consumer](../../packages/arbi-protocol/src/reference-vectors.ts) additionally invokes the existing complete message/configuration validators. Its fixture reader applies the reference JSON Schema.
- [Linux/Python consumer](../../packages/arbi-protocol/conformance/reference.py) uses only Python 3's standard library and independently derives identities and results.
- [C11 host consumer](../../packages/arbi-protocol/conformance/reference.c) compiles with `-std=c11 -Wall -Wextra -Werror -pedantic` and `-lm`. Its bounded [JSON token reader](../../packages/arbi-protocol/conformance/fixture-json.h) and [SHA-256 implementation](../../packages/arbi-protocol/conformance/sha256.h) independently read/hash the fixtures. Semantic fixture strings are unescaped ASCII; this is not a general production decoder.

The [acceptance tests](../../packages/arbi-protocol/src/reference-vectors.test.ts) launch each consumer directly against the same inputs. Python/C inputs never pass through TypeScript validation first. Every runtime must reject deliberate unit and version discrepancies, stale frames, schema identities/content, changed configuration/calibration/geometry revisions, edited configuration content, wrong conversion scales, handedness/axis swaps, wrong cable results, invalid payout and uint64 overflow/rounding/wrap. A nonrectangular configuration is also rejected after refreshing its full content digest, proving semantic checks beyond identity matching. Rejection returns exit status 2 and a named error without a success report. Mutations exist only in temporary directories.

Python/C implement the declared reference subset, not the complete configuration/message schema, authentication, command admission, clock/lease, audit or accounting semantics. Existing owning package tests retain those contract checks. Production decoders and runtime integration remain separate work and must consume both the full contracts and these reference cases.

The test compiler and consumer processes receive only executable search path, temporary-directory and fixed locale environment variables; no credential environment is inherited. Python runs in isolated mode. The TypeScript runner orchestrates processes and compares exit/report data without calculating results for the other runtimes.

## Offline commands and evidence boundary

Use Node.js >=24 and the repository's pinned pnpm. With workspace dependencies installed, no command below fetches schemas, credentials, provider APIs, production data or network hardware:

```sh
pnpm protocol:check
pnpm --filter @arbi/protocol lint
pnpm --filter @arbi/protocol typecheck
pnpm --filter @arbi/protocol test
pnpm --filter @arbi/protocol build
pnpm docs:check
git diff --check
```

`protocol:check` builds TypeScript and runs the suite without Turbo caching. The suite requires Python 3 at `python3` and a host compiler at `cc`; absence is a failure, not a skipped runtime. Standard `pnpm test` includes the same tests. [Workspace CI](../../.github/workflows/ci.yml) runs both standard workspace checks and the explicit cross-runtime check on Linux. C binaries are compiled into temporary directories and removed; no generated firmware or geometry is committed. A fresh checkout still needs its pinned dependencies installed or available in the pnpm offline store.

This is deterministic source/host calculation evidence. Execution on a Pico or Pi, firmware timing, device adapters, bench/HIL, installation and qualified physical review remain unverified. [ADR-0004](../decisions/0004-simulator-boundary.md), [ADR-0005](../decisions/0005-software-architecture-and-deployment.md) and [ADR-0006](../decisions/0006-local-safety-authority-and-instrumentation.md) preserve separate authority and physical gates. No pure shared control package is created solely for future reuse. Full scenarios [#25](https://github.com/gredice/arbi/issues/25), plant adapters [#34](https://github.com/gredice/arbi/issues/34) and controller firmware [#31](https://github.com/gredice/arbi/issues/31) remain separate; recording [#68](https://github.com/gredice/arbi/issues/68) remains deferred and disabled.
