# ADR-0019: Isolated signing trust and migration recovery

Status: accepted when the issue PR merges. Work record: [#74](https://github.com/gredice/arbi/issues/74).

## Decision

Add private test-realm SQLite trust and representative data-migration stores. They provide no actuator, reboot, firmware flashing, OTP/fuse operation or network listener. A pinned public offline root verifies domain-separated signed trust policies. Release-signing keys appear only as public Ed25519 SPKI data, with explicit activation/expiry/revocation windows. Private signing keys belong to the offline publisher/protected signing service, never the device, dashboard, diagnostics or policy store.

Root policies bind realm/site, monotonic policy revision, predecessor digest, key identities and public keys, immutable release/digest/module security-version bindings, and nondecreasing per-module security floors. Security version is independent of display/build version. Revoked keys remain tombstones; key IDs and release IDs cannot be rebound. A persisted reliable-clock floor rejects rollback, including across process restart. Expired trust or unreliable time requires recovery before artifact acceptance.

Normal policy transition requires its predecessor. A device that missed intermediate policy windows may accept a newer, currently valid checkpoint signed by its pinned root only through the trusted local recovery entrypoint with a reviewed procedure reference. The reference in source fixtures is declared synthetic evidence, not a physical-review authorization. Root replacement changes the private store binding and requires reprovisioning outside normal updates.

The existing release-set planner verifies compatibility at every intermediate and rollback state. The trust wrapper also verifies manifest signatures, active key windows, exact root-bound security versions and floors for all selected recovery states. An unsafe downgrade is rejected with `SECURITY_DOWNGRADE_BLOCKED`; unavailable trust recovery is `NO_TRUSTED_RECOVERY_PATH`. Publish a compatible replacement with an acceptable security version when the old artifact cannot be used.

Representative migration data uses a closed, bounded vocabulary of revisions and voltage/speed limits. Immutable prior snapshots and prepared/committed/recovery markers persist with full SQLite acknowledgement. Only a named synthetic transform is implemented; unknown transformations enter recovery-required while preserving prior data. Applying a prepared migration and restoring its baseline recheck current artifact trust. Restoration requires declared reverse-data compatibility and the exact prior release. No marker grants motion permission or proves installation/boot.

## Evidence and consequences

Tests use ephemeral in-memory signing keys, private temporary directories, actual SQLite, process termination before commit, signed synthetic artifacts and explicit clock values. They cover rotation/revocation, offline checkpoint recovery, clock rollback, incompatible mixed versions, a valid bridge sequence, a compatible replacement at the security floor, interrupted migration, prior-data restoration and deliberately blocked downgrade. Known ephemeral private-key bytes are absent from fixture artifact/policy/store/diagnostic outputs.

The bounded stores refuse unknown schema, corrupt history, public/symlink paths and capacity exhaustion. Their hash chains detect accidental corruption; unlocked owner storage does not provide hardware anti-rollback or resist replacement by a hostile device owner. No irreversible security provisioning is implemented. Representative data is separate from installed commissioning configuration. Live publication, actual Linux/MCU installation, canonical update-operation audit and qualified physical recovery remain separately gated in [#33](https://github.com/gredice/arbi/issues/33), [#44](https://github.com/gredice/arbi/issues/44), [#71](https://github.com/gredice/arbi/issues/71) and [#73](https://github.com/gredice/arbi/issues/73).
