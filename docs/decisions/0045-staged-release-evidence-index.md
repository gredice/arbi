# ADR-0045: Staged release evidence inventory

Status: proposed in the issue #79 PR. Scope: offline source-to-field evidence.

Pin a requirements/hazards/test catalogue in source. Each named test declares an
evidence-owner role, target, stage and reviewer role. Stage entry/exit criteria,
instruments, stop conditions and accepted configuration are explicit. Actual
named owner assignments, hardware revisions, reviewed numeric limits and stage
procedures belong to a release-specific input, never invented source defaults.

The index reads bounded raw evidence files by digest and verifies exact source,
configuration, test and target identity. Source/simulation provenance cannot
satisfy physical tests. Hardware-in-loop requires real firmware, measurements
and a trace-comparison digest; loaded/installed stages reject controlled
substitutes. Measurements include instrument identity and uncertainty and must
fit previously declared procedure limits. Procedure digests bind the reviewed
limits. Independent physical review and named owners are mandatory.

Every missing/failed mandatory record blocks reported completion and later-stage
entry eligibility. Deferred recording is not applicable only while disabled
with accepted disabled-feature proof. Activation restores its physical gate.

This is an evidence inventory, not an authorization service. Raw-file integrity
does not independently establish reviewer qualification, calibration, physical
truth or site approval; those remain the external qualified acceptance process.
Even fully populated input cannot set public-operation-ready or enable motion,
updates, deployment or installed operation. Actual target HIL, secured-frame and
installed-site measurements remain absent from this source PR.
