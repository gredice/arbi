# Authenticated dashboard shell

The [Next.js dashboard](../../apps/arbi-dashboard/README.md) implements the foundation in [#39](https://github.com/gredice/arbi/issues/39). Every operational screen retains site, realm/namespace, simulation or hardware origin, display mode, connection and observation freshness. User and engineering navigation share the same backend authorization. Overview, devices, images, activity, live readiness and engineering diagnostics have responsive, keyboard-accessible navigation. Missing image history, commands, camera streams and detailed telemetry are explicitly unavailable; recording remains disabled.

## Protected read contract

`GET /api/sites/:siteId/dashboard/{context,state,diagnostics}` returns the app-owned `arbi.dashboard/1.0` wrapper around shared `@arbi/protocol` snapshots, telemetry and configuration identity. It does not create a competing device protocol. Trusted server composition installs a `DashboardServer` with the existing [Gredice identity/current-directory boundary](site-authorization.md), resource resolver, required durable authorization audit, bounded site catalogue and state/configuration readers. `configureDashboard` is the explicit integration seam for a later accepted provider. An ordinary build has no provider and returns redacted 503 responses.

Every read checks current signed identity, session, account/site membership, realm and server-selected capabilities. Diagnostics always requires `diagnostics.read`, including a direct URL in user mode. The server rechecks current authority after assembling data and before returning it. Read responses are `private, no-store`. State messages must pass protocol validation and match the protected site, execution mode, source boot/session, capabilities revision and reported configuration revision. Directory, state and configuration dependencies have bounded deadlines. Authorization audit acknowledgement precedes data release; an unavailable audit cannot silently authorize a read.

The browser receives the authorized site list, public identity IDs and capabilities, never the signing key, database URL or credential. The explicit test BFF uses an HttpOnly, Secure-on-HTTPS, SameSite=Strict cookie. Site changes use a new server-rendered route and clear displayed data. Refresh clears old data while checking authority; timeout, offline, 401 and 403 responses do not retain the previous site's values. Session expiry hides protected data. Page restoration clears stale browser state. No credentials or site values are persisted in localStorage, service workers or shared client caches.

## Explicit isolated test provider

The test provider must be selected explicitly with `ARBI_DASHBOARD_PROVIDER=isolated-test-simulation`, `ARBI_DASHBOARD_REALM=test`, a dedicated namespace, origin and migrated PostgreSQL database. It rejects Vercel production execution. Never set these variables on an operational production deployment. No provider is inferred from development mode or missing configuration.

The dedicated synthetic directory contains an engineer and optional viewer profile with server-fixed roles; a form cannot choose actor, account, site or permissions. Private random access codes authenticate only these synthetic profiles. A signed five-minute session is stored in PostgreSQL and current membership/revocation is checked across instances. Ending the session commits revocation before clearing the cookie. This is isolated adapter evidence, **not live Gredice account authentication**; [#47](https://github.com/gredice/arbi/issues/47) owns that acceptance.

The read adapter consumes the committed nominal [bounded plant/module model](bounded-plant-model.md). Position stays estimated, gimbal feedback commanded, and physical tension/power unavailable where the configured model has no observation. Aged values retain their original quality. `synthetic-offline`, `synthetic-stale` and `synthetic-empty` exercise offline, stale and no-device states without real device endpoints or keys. The illustration is decorative, not surveyed geometry. There is no actuator adapter, command sender, broker subscription or automatic media request in this shell. Existing job APIs still require their own trusted composition; display mode cannot configure them.

## Local setup and validation

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @arbi/dashboard... build
pnpm --filter @arbi/dashboard test
pnpm --filter @arbi/dashboard test:postgres
pnpm --filter @arbi/dashboard exec playwright install chromium
pnpm --filter @arbi/dashboard test:browser
pnpm --filter @arbi/dashboard test:http
```

`test:browser` creates and removes a fresh socket-only PostgreSQL cluster, generates private ephemeral codes/keys, explicitly provisions synthetic records, starts the built app on an ephemeral loopback port, then runs the browser suite. It needs native PostgreSQL tools and loopback/browser access; no cloud credentials are needed. Ordinary fork CI builds without a provider and invokes this isolated test launcher. Six application browser tests cover all screens, mobile/keyboard navigation, loading/failure states, expiry, site switching, direct HTTP denial and current database revocation. A seventh browser check verifies origin-scoped protection headers across real native redirect hops. Native tests additionally use independent pools to prove current directory/session checks and durable authorization evidence.

Workspace libraries remain native ESM externals through dynamic imports so filesystem/schema paths remain intact. Both built HTTP and authenticated browser launchers disable Node's optional `require(ESM)` support, reproducing the restriction observed in the hosted serverless loader. A local Node 24 default alone would not detect that packaging mismatch.

For an operator-created dedicated test database, privately supply `ARBI_DASHBOARD_TEST_DATABASE_URL`, namespace and test realm, then run `pnpm --filter @arbi/dashboard db:provision-dashboard-test`. This explicitly applies unchanged migrations 0001–0003 and additive [0006-dashboard.sql](../../apps/arbi-dashboard/migrations/0006-dashboard.sql) and seeds a new empty synthetic registry. Do not run it against an existing operational registry. Nothing migrates or seeds at build/start. Use a separately constrained application database role for operational integration; provisioning ownership is not an application authorization policy.

Privately configure `ARBI_DASHBOARD_ORIGIN`, `ARBI_DASHBOARD_TEST_SIGNING_KEY` (at least 32 random bytes encoded as base64url), `ARBI_DASHBOARD_TEST_ACCESS_CODE` and optional `ARBI_DASHBOARD_TEST_VIEWER_CODE` (distinct random codes of at least 32 characters). Keep keys and access codes in private environment settings or ignored local files. Public artifacts contain only synthetic IDs and source/verification records.

## Evidence and remaining gates

The [dated shell evidence](../evidence/dashboard-shell.md) records local and hosted checks separately. CI, authenticated test deployment, real provider integration, real cloud-edge protocol, physical commissioning and safe installed operation are independent claims. Full assembly diagnostics, image history, audit timeline, command controls, realtime broker and camera viewing retain their own issue scope. This shell cannot clear ADR-0006 physical gates or enable recording.

For hosted test acceptance, place the test functions alongside the dedicated database so current directory checks fit the bounded authorization deadlines. Vercel environment pulls leave sensitive access codes empty; `scripts/check-hosted.ts` then reads the operator-created ignored `.vercel/ARBI_DASHBOARD_TEST_ACCESS_CODE.txt` file. It scopes the protection credential to the target deployment origin and never records authenticated traces or prints credentials.
