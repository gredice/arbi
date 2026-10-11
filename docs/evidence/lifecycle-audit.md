# Lifecycle audit software evidence

Scope: [#46](https://github.com/gredice/arbi/issues/46), [ADR-0016](../decisions/0016-lifecycle-audit-attempts.md). The worktree extends merged software baseline `55fef66f89ac3a224ea3bbefa640e12a52b14451`.

Native PostgreSQL fixtures exercise two independent job/admission instances, identical request replay, accepted/running/terminal device reports, contradictions and a protected bounded timeline. Separate fixture scopes exercise repeated denials, bounded actor cardinality, mixed overflow and controlled counter-clock rollover into immutable summaries. Counts are synthetic attempts; they are not traffic measurements.

Commissioning fixtures exercise actual SQLite configuration/calibration journal commits, original human attribution, partial activation and recovery. Protocol update fixtures replay synthetic admitted journals and check original actor retention, local boot references, rollback policy, foreign-source rejection and staging rejection. They do not authenticate an arbitrary journal file or install firmware.

Run conditions: isolated Linux x64 workspace; Node 24.19.0, pnpm 11.5.2 and native PostgreSQL 18.4 with fresh owned databases, fsync and synchronous commit. All references and identities are synthetic. Automated checks and the issue PR's review/CI trail are software evidence. No bench hardware, deployed provider or qualified physical reviewer participated. Final check counts are recorded in the PR.

Physical home outcomes, installed calibration, target firmware installation and independent motion verification remain unavailable. This change provides concrete instrumentation and isolated trace coverage while preserving those gates.

Local validation: 86 dashboard source checks passed with 15 native-only skips; all 65 native PostgreSQL checks and all 17 Chromium checks passed. Protocol validation passed 463 checks. Edge commissioning/job validation passed 134 checks; the final calibration-phase change separately passed all 14 commissioning checks. Production build, lint/types, ordinary/preview denial checks, Markdown links and diff whitespace passed. The browser payload observer measures completed cloned bodies inside Chromium and avoids relying on CDP body retention after the application drains a stream. Final update attribution retains authorization identity separately from an unavailable human login-session identity.
