# Dashboard shell evidence — 8 October 2026

Scope: [#39](https://github.com/gredice/arbi/issues/39), [dashboard contract and setup](../software/dashboard-shell.md), Node 24.15.0 and repository-pinned pnpm 11.5.2. This record concerns synthetic software only.

## Local source and host evidence

The dashboard integration tests prove signed/current authorization, membership removal, diagnostics denial, session expiry/revocation, audit-required reads and rejection of wrong realm/site/source/configuration messages. Native PostgreSQL tests use independent pools/provider instances against a fresh socket-only database, preserving the existing enrollment, media, audit and jobs tests.

Six application browser tests run the built app against an explicitly provisioned local PostgreSQL synthetic directory. They cover all shell routes, site/realm/mode/connection banners, mobile width and keyboard navigation, no video or command controls, stale/original sample quality, offline/no-device/loading/failure displays, expired sessions and direct cross-site/role-spoofed API denial. Credentials and runtime state are ephemeral; no authenticated trace or storage snapshot is committed. A seventh browser check uses two ephemeral HTTP origins and real native redirect hops to prove that the hosted-check protection credential stays on the selected origin. All seven checks and typechecking passed locally after the verification-helper update.

Application source revision: `c9ccfe191029160727bdbdf6e6efdcefb131def0`, reviewed in [PR #112](https://github.com/gredice/arbi/pull/112). `pnpm install --frozen-lockfile`, `pnpm docs:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test --concurrency=1`, `pnpm build`, `pnpm bom:check` and `git diff --check` passed locally. The shared protocol and scenario consumers also passed within the workspace tests; the explicit `pnpm protocol:check` and `pnpm scenario:check` commands passed in the named CI run. The six browser checks, all 11 native PostgreSQL tests (including realtime subtests) and built fail-closed HTTP checks passed separately. The built HTTP/browser launchers disable optional Node `require(ESM)` support and exercise the native ESM loader used by the hosted deployment. Private test credentials were checked against every browser build asset and are absent.

[GitHub CI run 37727320459](https://github.com/gredice/arbi/actions/runs/37727320459) passed on that revision: workspace/source checks, Linux transport evidence, native PostgreSQL, cross-runtime fixtures, secret-free build, six browser checks, built HTTP checks, BOM, CAD and all three booklet builds; `[CI] OK` passed. CodeRabbit reported a review rate limit, so its green status is not independent review evidence. The implementation received source self-review and the committed authorization tests.

Local `pnpm cad:check -- --require-openscad` could not compile because the `openscad` executable was absent; its static registry check passed for 80 models. The named Linux CI run performed the owning pinned OpenSCAD compilation and booklet checks. These facts do not establish physical acceptance.

## Hosted test evidence

A dedicated `arbi-dashboard-test` Vercel project in the Gredice team is connected to this repository. It uses an independent synthetic Neon resource with preview/development settings and Vercel deployment protection. The app has no test-provider production settings and also rejects `VERCEL_ENV=production` for this provider.

Tested immutable preview: [arbi-dashboard-test-93xncr5gk-gredice.vercel.app](https://arbi-dashboard-test-93xncr5gk-gredice.vercel.app), deployment `dpl_3nLQkHck5FseG1fdyj8MW4mn9KFA`, application revision `c9ccfe191029160727bdbdf6e6efdcefb131def0`. Vercel reported READY with Frankfurt (`fra1`) functions colocated with the dedicated synthetic database. The existing authorization deadlines remain unchanged. Subsequent verification-helper and evidence edits in PR #112 do not change application runtime source.

On **8 October 2026 at 05:12 UTC**, `scripts/check-hosted.ts` passed against that protected HTTPS preview using an ephemeral Chromium context and private operator inputs. It exercised browser form sign-in, current site/realm/mode context, authenticated refresh, protected diagnostics with unavailable physical tension, 390-pixel mobile and keyboard navigation, offline/no-device sites, direct other-site denial (403), logout and the expired/unavailable protected-page display. No JavaScript page errors occurred. Deployment protection stayed enabled; credentials, cookies and authenticated traces were not published. The helper applies the protection header separately to each native redirect hop and strips it from other origins.

Reviewer: Codex, source self-review and executed automated checks. CodeRabbit remained rate-limited; this record does not imply independent human review.

## Limits

No live Gredice issuer, physical device, real coordinate data, actuation, live image, broker subscription, firmware update or recording was tested or enabled. No operational production deployment is accepted by this record. The installed-system and provider gates in [design status](../project/design-status.md), [site authorization](../software/site-authorization.md) and ADR-0006 remain separate.
