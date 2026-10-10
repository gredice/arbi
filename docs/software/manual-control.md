# Local manual-control fencing and deadman

Work record: [#50](https://github.com/gredice/arbi/issues/50). This is an explicitly
composed, simulation-only edge slice using [cloud fenced leases](command-jobs.md),
[local jobs](local-jobs.md) and [commissioning](commissioning.md). It enables no
physical output and clears no [local safety gate](../system/local-safety-interface-matrix.md).

## Trusted composition

[ManualControl](../../apps/arbi-edge-controller/src/jobs/manual.ts) receives a trusted
local authority reader, the owning job journal and an immediate local-stop callback.
It is neither a browser endpoint nor a token verifier. The authenticated cloud/device
boundary must supply current site/realm, actor, upstream source, target boot/session,
configuration, module epochs and an exclusive cloud lease mapped conservatively into
the receiver's monotonic clock. Missing mappings/current authority inhibit admission.
Do not deserialize LocalAuthority from a client body or let a viewer request replace
the active controller's global authority. Cloud/cloud-clock uncertainty handling remains
owned by the existing command-job adapter.

Use the optional third argument to [EdgeJobs.compose](../../apps/arbi-edge-controller/src/jobs/runtime.ts)
to configure deadmanMs (50–1,000), maxJogMs (1–500), and maxLeaseMs (deadmanMs–15,000).
The returned consumer uses the gate before admission and every running phase. Its
`manual` coordinator exposes `acquire`, `pulse(sequence)`, `release`, `lost` and read-only
status. Ordinary settings never compose this coordinator or mount an actuator route.
No TLS diagnostic certificate, viewer session or UI mode grants manual capability.

## Lease and gesture rules

Only a current authenticated human with manipulation types and a matching exclusive
lease can acquire. Lease ID, holder, uint64 fence and receiver must match current trusted
state. The job journal persists a strictly increasing fence before admitting the local
session, alongside attributable audit intent/allow events. A second operator cannot
take the active session. Handover stops and retires the old session before a higher
upstream fence is accepted; source/actor/receiver/configuration/module changes stop and
retire current authority. Reconnection never silently adopts a replacement lease.

Acquisition alone cannot dispatch a gesture: it needs an increasing pulse sequence.
The authenticated gesture/renewal boundary supplies each pulse as evidence of current
human intent. It must not manufacture pulses from a transport heartbeat or server timer.
Repeated acquisition and duplicate/out-of-order pulse packets cannot renew the deadman.
Fresh accepted pulses update receiver-local time and may reflect an authorized upstream
renewal; they never extend an already admitted command's original expiry or duration.

Human direct `motion.move`/`camera.gimbal` requests require manual mode, matching session
and a fresh pulse. Maximum gesture duration is independently capped at maxJogMs; shared
configuration checks also enforce site/gimbal frames, calibrated workspace, speed and
angle limits. Ready/stationary/safe pose, current commissioning, local conditions and
module readiness are still checked by the owning job policy. Gimbal repositioning during
main movement is denied. Capture-plan orchestration and explicitly permitted autonomous
service jobs retain their separate existing local policy; this gate cannot invent
homing, maintenance, recording or a new supported command.

An exact duplicate command returns its existing logical result without dispatch or
pulse renewal, even after expiry. New stale commands/leases are rejected. A release
between command admission and dispatch is rechecked and fails the pending gesture;
release never leaves a queue that can restart motion later.

## Stop and restart behavior

The independent local consumer tick evaluates current authority and closes a session
at `min(leaseExpiry, lastAcceptedPulse + deadmanMs)`. It stops the adapter before SQLite
or audit work and marks unfinished jobs failed/operator-required. Explicit transport
teardown, revoked grants, cloud loss, changed module/receiver identity and maintenance
also stop at the next local tick; `lost` can invoke stopping immediately. Clock rollback
or unreliable local time inhibits authority. Sender UTC jumps have no effect on expiry.
The trusted loop must keep calling tick even with no active job or network callback.

For deadman D and enforced local tick interval T, the **synthetic scheduling bound** is
D + T after the last accepted pulse. Host event-loop stalls and SQLite/kernel/device
latency are not bounded by that formula. Independent Pico expiry/watchdog and physical
stopping remain required under #67 and the motion/bench gates; Linux process supervision
alone cannot enforce a real motor stopping deadline. Remote stop does not replace that
protection. The committed tests use D=250 ms and a 50 ms virtual sample interval, with
closure at the exact sampled deadline; they measure no physical stopping time.

Every startup invokes stop, drops the in-memory session, retires any durable old lease
and preserves its fence. The same/older fence cannot acquire after reopen, even with a
new transport identity. Existing journal recovery interrupts unfinished jobs and requires
fresh local reconciliation. No moving state, pulse sequence or browser gesture resumes.
Schema 2 upgrades the prior schema-1 job journal additively; old binaries reject schema 2
instead of ignoring the manual fence. Review any binary rollback with this compatibility
constraint; don't delete a journal to make an old binary start.

## Evidence and bounds

Lease start/allow/end/timeout/revoke events retain actor, site, target/source identity,
configuration/calibration and correlation. They use the existing audit vocabulary and
durable outbox/spool; pulse packets don't each allocate audit rows. The owning journal's
byte/page/record/free-space limits also bound the manual ledger. Storage or audit failure
inhibits new work, preserves visible degradation and never delays the immediate stop
callback. Retired session history remains attributable.

[Manual tests](../../apps/arbi-edge-controller/src/jobs/manual.test.ts) run in the existing
edge suite with temporary synthetic SQLite/plant fixtures. They cover missing session/pulse,
two operators, old/revoked fences, release-before-send, duplicate/reordered packets,
source clock jumps, mode/capability/calibration/interlock failures, cloud/module loss,
restart recovery, original duration and audit handoff. [Host evidence](../evidence/manual-control.md)
distinguishes these checks from physical timing and installed acceptance.

```sh
pnpm --filter @arbi/edge-controller lint
pnpm --filter @arbi/edge-controller typecheck
pnpm --filter @arbi/edge-controller test
pnpm --filter @arbi/edge-controller build
pnpm docs:check
git diff --check
```
