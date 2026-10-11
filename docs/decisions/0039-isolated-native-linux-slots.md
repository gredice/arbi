# ADR-0039: Isolated native Linux image slots

Status: proposed in the issue #44 PR. Scope: private development-host integration.

## Decision

Add an optional native file target to the existing update orchestration port.
Use actual separate application/OS A/B image files, complete signed artifact
verification, SQLite intent/selection, exclusive kernel-released ownership,
fsync/rename/readback, private bounded storage and the existing trust/migration
owners. The coordinator remains the release/order/budget/audit authority.

The layout is an isolated directory, not installed partitions. It stages at most
one MiB per image, matching the existing isolated orchestration limit. No raw
block-device writer, physical bootloader selector, service replacement, reboot,
actuator callback or production target capability is added.

A separate persistent area holds identity/configuration/capture data. The target
never replaces those files and binds each operation to their bounded content
digest. Existing reviewed data migrations retain their rollback owner. A missing
or changed preserved file, invalid image, insufficient space, unknown local
health or expired confirmation cannot silently confirm a candidate.

A staged intent may adopt a complete fsynced image after process death, but
restart cannot automatically start a trial. Explicit private owner recovery
requires the same immutable request plus current isolated local preflight.
Rollback persists intent before migration/selection change and reads the signed
known-good files. Local health checks exclude Internet availability; unknown
checks stay pending. Every reported state includes disabled physical installation
and an isolated probe scope.

## Physical decision still required

This does not choose or prove Pi 3A+ or cabinet-edge partition/boot layout, OS
architecture, whole-root/kernel rollback, secure boot, storage durability under
power loss, real agent/camera/interface health or reimage/re-enrollment. The
[guide](../software/linux-slot-reference.md) records those gates and the private
recovery procedure. The [evidence](../evidence/linux-slot-reference.md) separates
native filesystem/process tests from declared health fixtures and hardware boot.
