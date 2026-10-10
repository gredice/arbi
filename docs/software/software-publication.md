# Gated web builds and immutable software availability

Work record: [#33](https://github.com/gredice/arbi/issues/33), under [ADR-0005](../decisions/0005-software-architecture-and-deployment.md).
This is the implemented **source/isolated-host prototype**. The only executable
release target is the simulation-only Linux edge application. Pico/pod source,
OS images, physical installers and production device commissioning remain absent.

## Builds and previews

[The existing change planner](../../scripts/ci/plan.mjs) selects implemented
workspaces and their downstream consumers. Its software matrix comes from
[the target registry](../../scripts/software-release/targets.mjs): Linux x64,
Ubuntu 24.04, Node 24.15.0 and the root integrity-pinned pnpm version. There is no
Pico matrix entry or empty firmware output; an implemented Pico target must add
its exact SDK/compiler pins and owning conformance tests before publication.

[CI](../../.github/workflows/ci.yml) uses `pull_request`, never
`pull_request_target`. Build/test/package runners have read-only repository
permission, no deployment, production-device or signing secrets, and do not
persist checkout credentials. A fork can run every selected check and build the
unconfigured web apps. CI retains each Next.js review build as
`web-preview-<app>-<commit>` with commit/lock/runtime/run provenance and no compiler
cache. Restore it in the same workspace with pinned dependencies and start with
`VERCEL_ENV=preview`; the docs build already contains its preview banner. Vercel Git integration supplies branch previews after its
fork protection policy permits a deployment. Do not authorize a fork deployment
with provider credentials; its CI build remains available independently.

Both apps label Vercel branch previews **NONPRODUCTION PREVIEW**. The dashboard
blocks enrollment, media, audit, jobs, realtime, telemetry and dashboard runtime adapters
before invocation in ordinary previews, including an accidentally composed
provider. No login, catalog-to-install action or production device endpoint is
available. The explicit `isolated-test` Vercel custom environment is separately
provisioned for synthetic identity/database testing; ordinary branch previews
must have no provider, device, signing or deployment environment variables.
This environment separation must be configured in the provider, not inferred
from a UI banner. Keep fork protection enabled.

## Production web gate

Both app build commands invoke [the production gate](../../scripts/ci/production-gate.mjs)
before Next.js builds. Vercel production builds require the platform's full
`gredice/arbi`, `main` and source SHA metadata. The gate verifies that GitHub marks
`main` protected before waiting and again before accepting checks. It reads that exact commit's
latest CI workflow attempt and accepts only a successful `[CI] OK` job. PR checks,
another commit, failed/cancelled/skipped checks and missing evidence cannot grant
production. Lookup errors, GitHub API rate limits and a 35-minute deadline fail
closed. A production-only read-only `ARBI_CI_READ_TOKEN` can avoid shared public
API quotas; it is never required or read in preview builds. Failed deployments retain the existing production deployment; retry the
same production source after checks complete or a provider lookup failure clears.

Vercel Git integration still builds and deploys the web application. Set project
`arbi` root to `apps/arbi-docs`, build command `pnpm build`, and project
`arbi-dashboard-test` root to `apps/arbi-dashboard`, build command
`cd ../.. && pnpm build --filter @arbi/dashboard --concurrency=1`; production ref
is `main`. Enable Vercel system environment variables. Dashboard Turbo builds
run fresh and pass the gate's identity variables explicitly, so a compilation
cache cannot bypass the gate. Native Vercel GitHub Deployment Checks can require
`[CI] OK` as an additional provider gate; no bypass/force promotion is used.
The public CAD refresh hook invokes the same gated production build.

## Artifact, signing and catalog boundary

[Packaging](../../scripts/software-release/package.mjs) copies the real built
edge executable and production dependency closure into a Linux application
archive. It rejects dirty/mismatched source and wrong runtimes, records the full
commit/tree, lock SHA-256, dependency declarations, exact runtime/package manager
and CI run/attempt, and includes that provenance inside the archive. The
[independent smoke check](../../scripts/software-release/smoke.mjs) extracts it
outside the worktree and starts the real simulated edge process with no provider
credentials. Source checks establish a simulation application, not a physical
update capability or an OS image. OpenSSL and the pinned Node runtime remain
host prerequisites.

`[CI] OK` requires successful selected packaging as well as the existing suites.
The protected `publish_software` job runs only on protected `main`, after that
gate, with the operator's explicit `ARBI_SOFTWARE_RELEASE_ENABLED=true` variable.
Only its final publication step receives a signing key and release credential.
[The publisher](../../scripts/software-release/publish.mjs) independently verifies
the ref, gate, run/attempt, source tree, lock digest, toolchain and artifact bytes.
It uses the accepted [release contract](release-updates.md) to sign the manifest
with Ed25519, then verifies it against a separately supplied public key.

The commit-addressed prerelease `software-edge-<full commit>` contains
`edge.tar.gz`, `edge.manifest.json` and `catalog-entry.json`. It does not replace
CAD Latest. GitHub immutable releases must be enabled before publication: assets
are uploaded to a draft, publication seals the tag/files, and readback requires
`immutable=true` and exact trusted signatures/digests. The publisher never uses
asset overwrite or deletes an old release. Retrying a completed publication
verifies the already sealed release instead of changing it. Failed draft
publication leaves no catalog-visible release; an operator can inspect/remove
that unpublished draft before retrying. Missing inputs or unsealed releases fail
closed.

[The dashboard catalog](../../apps/arbi-dashboard/src/releases/catalog.ts) reads
these immutable GitHub releases, validates catalog metadata, source commit,
synthetic target, artifact size/GitHub SHA-256 and the independently trusted signed
manifest. No release-supplied key becomes trust. It retains previous entries via
bounded pagination, fails on incomplete/untrusted catalogs, and reads no device
or installation storage. Site-authorized `GET .../dashboard/releases` feeds the
Releases page. An unconfigured trust binding reports unavailable, not an empty
verified catalog. This makes a candidate **available**; observed installed/desired
versions and update journals remain unchanged. The catalog has no write or
installation-request interface. Actual artifact download/update authorization
belongs to the later updater slice.

## Operator setup and evidence

Before enabling publication, an authorized repository administrator must:

1. Protect `main` with required `[CI] OK`, enable GitHub immutable releases, and
   restrict the `software-release` environment to `main` with a required reviewer.
2. Provision `ARBI_RELEASE_SIGNING_KEY` and a least-privilege `ARBI_RELEASE_TOKEN`
   in that environment only. The token needs release contents write and the
   immutable-release setting read permission. Set independent public variables
   `ARBI_RELEASE_KEY_ID` and `ARBI_RELEASE_PUBLIC_KEY`; provision the same public
   trust in the isolated dashboard. Never put a key or token in Git or PR builds.
3. Confirm preview environment-variable scoping and production `main` settings in
   Gredice Vercel, then set `ARBI_SOFTWARE_RELEASE_ENABLED=true`. Key rotation,
   revocation and incident response remain [#74](https://github.com/gredice/arbi/issues/74).

The session implementing this slice could update the two Vercel project build
commands and fork protection. Public GitHub branch metadata reported `main` as
unprotected, so production web builds are denied until an administrator protects it.
Its GitHub integration returned 403 for branch
protection, variables and immutable-release settings, and Vercel returned 403
for environment-variable metadata. Those configuration/readback gates and an
actual protected signing run remain **unverified**; publication stays disabled
until operator setup. This record contains no private deployment data.

Run `node --test scripts/ci/*.test.mjs scripts/software-release/*.test.mjs` after
building protocol. The isolated producer tests exercise accepted and deliberately
failed protected-ref builds, signing, seal/readback, replay and tampering without
remote mutation. Dashboard tests verify signatures, catalog retention, cross-site
authorization and preview adapter denial; `test:http` checks the built app in
ordinary and preview starts. CI packages and smoke-tests the real Linux archive.
These are source/isolated-host evidence, separate from live Vercel/signing catalog
readback, selected-device installation, physical safety and qualification.
