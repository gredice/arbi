# Dashboard shell evidence — 7 October 2026

Scope: [#39](https://github.com/gredice/arbi/issues/39), [dashboard contract and setup](../software/dashboard-shell.md), Node 24.15.0 and repository-pinned pnpm 11.5.2. This record concerns synthetic software only.

## Local source and host evidence

The dashboard integration tests prove signed/current authorization, membership removal, diagnostics denial, session expiry/revocation, audit-required reads and rejection of wrong realm/site/source/configuration messages. Native PostgreSQL tests use independent pools/provider instances against a fresh socket-only database, preserving the existing enrollment, media, audit and jobs tests.

Six browser tests run the built app against an explicitly provisioned local PostgreSQL synthetic directory. They cover all shell routes, site/realm/mode/connection banners, mobile width and keyboard navigation, no video or command controls, stale/original sample quality, offline/no-device/loading/failure displays, expired sessions and direct cross-site/role-spoofed API denial. Credentials and runtime state are ephemeral; no authenticated trace or storage snapshot is committed.

Application source revision: `f66985f1b8c9562408825a12ccaa72f275e1d07e`, reviewed in [PR #112](https://github.com/gredice/arbi/pull/112). `pnpm install --frozen-lockfile`, `pnpm docs:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test --concurrency=1`, `pnpm build`, `pnpm bom:check`, `pnpm protocol:check`, `pnpm scenario:check` and `git diff --check` passed locally. The six browser checks, all 11 native PostgreSQL tests (including realtime subtests) and built fail-closed HTTP checks passed separately.

[GitHub CI run 37684674706](https://github.com/gredice/arbi/actions/runs/37684674706) passed on that revision: workspace/source checks, Linux transport evidence, native PostgreSQL, cross-runtime fixtures, secret-free build, six browser checks, built HTTP checks, BOM, CAD and all three booklet builds; `[CI] OK` passed. CodeRabbit reported a review rate limit, so its green status is not independent review evidence. The implementation received source self-review and the committed authorization tests.

Local `pnpm cad:check -- --require-openscad` could not compile because the `openscad` executable was absent; its static registry check passed for 71 models. The named Linux CI run performed the owning pinned OpenSCAD compilation and booklet checks. These facts do not establish physical acceptance.

## Hosted test evidence

A dedicated `arbi-dashboard-test` Vercel project in the Gredice team is connected to this repository. It uses an independent synthetic Neon resource with preview/development settings and Vercel deployment protection. The app has no test-provider production settings and also rejects `VERCEL_ENV=production` for this provider.

Hosted URL, application source revision, authenticated check result and reviewer are pending until the protected preview has been deployed and tested. Project creation and successful database provisioning alone do not demonstrate that hosted sign-in works.

## Limits

No live Gredice issuer, physical device, real coordinate data, actuation, live image, broker subscription, firmware update or recording was tested or enabled. No operational production deployment is accepted by this record. The installed-system and provider gates in [design status](../project/design-status.md), [site authorization](../software/site-authorization.md) and ADR-0006 remain separate.
