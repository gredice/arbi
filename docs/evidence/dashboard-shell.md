# Dashboard shell evidence — 7 October 2026

Scope: [#39](https://github.com/gredice/arbi/issues/39), [dashboard contract and setup](../software/dashboard-shell.md), Node 24.15.0 and repository-pinned pnpm 11.5.2. This record concerns synthetic software only.

## Local source and host evidence

The dashboard integration tests prove signed/current authorization, membership removal, diagnostics denial, session expiry/revocation, audit-required reads and rejection of wrong realm/site/source/configuration messages. Native PostgreSQL tests use independent pools/provider instances against a fresh socket-only database, preserving the existing enrollment, media, audit and jobs tests.

Six browser tests run the built app against an explicitly provisioned local PostgreSQL synthetic directory. They cover all shell routes, site/realm/mode/connection banners, mobile width and keyboard navigation, no video or command controls, stale/original sample quality, offline/no-device/loading/failure displays, expired sessions and direct cross-site/role-spoofed API denial. Credentials and runtime state are ephemeral; no authenticated trace or storage snapshot is committed.

The check results and exact reviewed revision will be recorded with the PR. Local source/host checks are not CI or hosted acceptance.

## Hosted test evidence

A dedicated `arbi-dashboard-test` Vercel project in the Gredice team is connected to this repository. It uses an independent synthetic Neon resource with preview/development settings and Vercel deployment protection. The app has no test-provider production settings and also rejects `VERCEL_ENV=production` for this provider.

Hosted URL, application source revision, authenticated check result and reviewer are pending until the protected preview has been deployed and tested. Project creation and successful database provisioning alone do not demonstrate that hosted sign-in works.

## Limits

No live Gredice issuer, physical device, real coordinate data, actuation, live image, broker subscription, firmware update or recording was tested or enabled. No operational production deployment is accepted by this record. The installed-system and provider gates in [design status](../project/design-status.md), [site authorization](../software/site-authorization.md) and ADR-0006 remain separate.
