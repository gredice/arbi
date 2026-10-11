# ADR-0043: Repeatable host interruption evidence

Status: proposed in the issue #78 PR. Scope: isolated host evidence only.

Build a repeatable evidence runner using the existing update operation, signed
artifact range source, trust/migration, budget/audit and target owners. It
installs no physical firmware and grants no rollout authority.

Nine source scenarios measure actual HTTP response payload and reconcile it
with original operation charges, durable range receipts and attributable audit:
ordered native file success, truncated range/restart, rejected retry, corrupt
artifact, lost target acknowledgement, unknown reservation, failed pod canary,
mixed-version security floor and injected operation transaction interruption.
Four existing actual SIGKILL recipes use a shared native recovery helper.

Report exact artifact digests, observed installed/confirmed identities, native
file versus SQLite model storage, measured host duration and unresolved receipt/
audit gaps. Health, configuration and release inputs remain declared synthetic
references. Wire/carrier counters and hardware timing stay unavailable.

A failed canary halts later targets in the same existing operation. Explicit
current authorization and local recovery are required; unknown installation
never causes resend. Physical bootloader, brownout, retention/line clearance,
secured-frame and installed-site evidence remain tracked blocked gates.
The [guide](../software/update-interruption-evidence.md) and
[evidence](../evidence/update-interruption-matrix.md) record these limits.
