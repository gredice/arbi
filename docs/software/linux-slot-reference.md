# Isolated native Linux slot reference

Work record: [#44](https://github.com/gredice/arbi/issues/44),
[ADR-0039](../decisions/0039-isolated-native-linux-slots.md),
[evidence](../evidence/linux-slot-reference.md).

`IsolatedLinuxUpdateTarget` is an optional adapter for the existing
`UpdateOrchestrator` target port. Its only supported realm is `test`. Ordinary
edge/pod startup has no native Linux installer. The explicit test recipe uses
synthetic signed application/OS payloads and declared isolated health probes.
An OS payload here is an image file; no kernel or root filesystem boots.

Each target uses a private root containing `slots/application-{a,b}.image`,
`slots/os-{a,b}.image`, `persistent/`, an immutable SQLite state journal and a
separate SQLite exclusive ownership lock. Files are private, single-link and
opened without following symlinks. Reads/writes are bounded; inactive images,
partial files and temporary space count toward the configured slot quota. Images
are at most 1 MiB; total slots at most 8 MiB. The persistent digest walk is limited
to 256 entries, 128 files, eight directory levels, 1 MiB per file and 8 MiB total.
These are reference limits, not the capacity of a production Linux OS update.

Trust validates complete bytes, signature, immutable release/security version and
current keys/clock. Target identity and kind must match. A journal reservation
precedes installation; the same operation cannot start a second trial. Native
write intent precedes file fsync, directory rename/fsync and staged readback.
The current selection remains known-good until explicit local trial entry.
Staged recovery never bypasses current local update-safe evidence, target
compatibility or confirmation deadline. Slot selection does not activate any
hardware or execute an uploaded artifact.

The target-specific health port requires agent/configuration/durable-state/local
interface checks, plus pod camera/gimbal configuration or edge policy loading.
OS trials additionally require the isolated image-readback check. Unknown or
not-applicable required checks cannot pass; cloud connectivity is not a health
input. The test recipe reports declared probe results rather than real camera,
OS boot or electrical state. `healthScope`, `secureBoot: not-established` and
`physicalInstallationEnabled: false` preserve that distinction in inventory.

## Private recovery

After process interruption, close old owners and construct a fresh target with
the same provisioned trust, data and private directory binding. The kernel
releases the ownership lock after SIGKILL. A complete fsynced partial image may
be renamed/adopted; it becomes staged and does not start automatically.

For an incomplete write, the private owner may call `resumeStaging` with the
same reserved journal, exact verified bytes and a review record identity. Its
record precedes partial-file retirement and bounded rewrite. It does not start a
trial. `resumeLocalTrial` separately requires current local preflight and an
unexpired confirmation deadline. Observe an existing trial without resending
installation. A failed local trial may roll back under renewed local preflight;
a rollback intent survives interruption and resumes only through owner recovery.
Do not clear corrupted journals, rebind a root or report health from missing data.

For unusable physical storage, a future accepted target procedure must specify
reimage media/architecture, root trust, identity backups or deliberate
re-enrollment, configuration/calibration reconciliation and capture/audit recovery.
Review instrumented application/OS trial failures, power interruptions, watchdogs
and independent boot readback on the named Pi/edge targets before enabling those
capabilities. Source signatures protect this private file workflow; they do not
establish a hardware secure-boot chain or public-operation acceptance.
