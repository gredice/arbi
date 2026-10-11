# Release evidence index

[#79](https://github.com/gredice/arbi/issues/79) connects source checks to the
separate field gates in [ADR-0045](../decisions/0045-staged-release-evidence-index.md)
and the [safety case](../system/safety-case.md).

The pinned [catalogue](../../scripts/ci/release-evidence-catalog.json) maps 20
requirements and nine known hazard classes to 24 named tests and evidence-owner
roles. It includes identity/realm, command expiry/replay, local fault stopping,
reset, viewing/capture/privacy, accounting/audit, updates, dock/clearance/loads,
guards/electrical/environment, maintenance, recording and installed recovery.

| Stage | Required evidence before progressing |
| --- | --- |
| Unit/contract | Exact source, named owners, reviewed native/contract logs |
| Simulation | Reproducible fault/geometry traces and source identity |
| Component bench | Selected target revisions, accepted configuration, independent reviewed procedure and calibrated measurements |
| Hardware-in-loop | Real firmware/interfaces, controlled substitutes, measured timing and simulator comparison |
| Secured frame | Restrained real configuration, remote flows, camera, mobile bytes, audit, updates and independent stopping/retention/clearance |
| Installed site | Qualified electrical/structural review, accepted loads/weather/envelope, guarding/privacy/lockout and site-specific recovery |

Stage criteria also specify instruments, exit criteria and stop conditions.
Actual named assignments, target revisions, independent reviewer records and
numeric limits are release-specific. The catalogue declares roles, not completed
ownership/review or an accepted operating envelope. No new physical limit is
invented by the software.

From the repository root, generate a missing-evidence draft on clean source:

```sh
node scripts/ci/release-evidence.mjs --draft /private/release/index.json
```

The parent directory must already exist with mode 0700; output is exclusive and
mode 0600. For reviewed records, replace `--draft` with an input JSON path. The
input version is `arbi.release-evidence-input/1.0`; its release binds a full source
commit, configuration digest, hardware revisions, named owner assignments,
reviewed stage procedures/limits and recording state. Tests use their pinned IDs;
records cannot remove or rename mandatory gates. Incomplete non-draft input writes
the index and exits nonzero.

Each passed/failed record names a bounded relative raw JSON file and SHA-256,
matching source/configuration identity and accepted reviewer role. Raw files use
`arbi.release-test-evidence/1.0`; they include test/target identity, provenance,
real-firmware/substitute flags, stop-condition outcome and measurements with
instrument, unit and uncertainty. Physical values and uncertainty must fit the
limits in the release's digest-bound stage procedure. HIL also references its
reviewed simulator comparison digest. The implementation and test fixture define
the exact closed shapes; synthetic validator fixtures supply no physical proof.

The result shows passed, failed, missing and not-applicable tests, requirement
coverage, named-owner gaps, stage eligibility and blockers. Recording acceptance
is not applicable only when recording is disabled and the disabled capability/
reserved accounting-event contract evidence passed for this release. Enabling recording requires its
physical acceptance again.

`complete` means that every pinned requirement has accepted reported coverage
and a named owner. File hashes establish byte integrity, not reviewer identity,
qualification, calibrated instruments or actual physical truth. Those require
independent acceptance outside this tool. `publicOperationReady` is always false;
this inventory grants no bench, loaded-frame or installed-site authority. The
current [generated draft](../evidence/release-index.json) reports missing records,
unassigned names and unknown configuration/revisions explicitly. Existing source
evidence at older commits must be revalidated for the exact release; prose claims
are never automatically imported as passed test records.

Run `node --test scripts/ci/release-evidence.test.mjs`. These tests also run through
the existing CI planning job's `scripts/ci/*.test.mjs` selection. No runtime or
production promotion path is changed.
