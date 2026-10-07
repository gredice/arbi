# Image metadata and private object access

- Work record: [#22](https://github.com/gredice/arbi/issues/22), cloud epic [#4](https://github.com/gredice/arbi/issues/4).
- Baseline: [ADR-0005](../decisions/0005-software-architecture-and-deployment.md), [site authorization](site-authorization.md), [audit vocabulary](audit-events.md), [mobile accounting](mobile-data-accounting.md).
- Implementation: [media service](../../apps/arbi-dashboard/src/media/service.ts), [PostgreSQL store](../../apps/arbi-dashboard/src/media/store.ts), [private Blob adapter](../../apps/arbi-dashboard/src/media/blob.ts), [HTTP composition](../../apps/arbi-dashboard/src/media/server.ts), [0002 migration](../../apps/arbi-dashboard/migrations/0002-media.sql).
- Evidence: [isolated lifecycle suite](../../apps/arbi-dashboard/src/media/lifecycle.test.ts), [independent host PostgreSQL suite](../../apps/arbi-dashboard/src/media/postgres.test.ts), [HTTP object-store fixture](../../apps/arbi-dashboard/src/media/test-support.ts), [built-route checks](../../apps/arbi-dashboard/scripts/test-http.mjs).

## Scope and composition

`arbi.media/1.0` is app-owned metadata and storage lifecycle, implemented alongside enrollment in `apps/arbi-dashboard`. Neon/PostgreSQL owns protected site/account/resource bindings, original/thumbnail metadata, grant attribution and local audit evidence. A private Vercel Blob store owns immutable image bytes. This slice issues no capture job or actuator message, provides no live camera workflow or dashboard UI, and enables no recording. Enrollment remains simulation-only with its original `0001-enrollment.sql` unchanged.

Unconfigured Next.js routes return redacted `503` responses. There is no fixture identity, catalog, database or store credential fallback. A trusted server initializer must explicitly supply `createMediaServer` and install it using `configureMedia`. It must supply the dedicated accepted Gredice adapter/current site resolver, exact browser origins, a migrated pooled SQL database, and `VercelPrivateBlob({ storeId })` bound to a **verified private** store in the appropriate isolated environment. SDK-managed OIDC is preferred; the SDK can also use a privately supplied read-write environment token. The adapter checks the delegated store ID against its configured store ID, never exposes store/signing credentials, and signs private object paths only. Store access mode is a provisioning prerequisite: a pathname, environment label or `.private` URL alone does not establish that the configured store was created private. Live provisioning has not been performed here.

Run `pnpm --filter @arbi/dashboard db:migrate:media` with `ARBI_MEDIA_DATABASE_URL` supplied privately, then provision the protected site using `PostgresMediaStore.provision` and authoritative site/account/execution-mode data. This operation cannot overwrite existing bindings. `0002` is independently repeatable, adds no enrollment foreign-key/authority coupling, and preserves enrollment state and history. The existing enrollment migration command remains separate. No migrations or provisioning run during build/start. The media store can represent hardware scope only when an explicitly configured real identity/site adapter agrees; the isolated identity provider rejects hardware and production resources. No live configuration is committed.

## HTTP contracts

All bodies are strict JSON, bounded to 16 KiB with a five-second body deadline. Unknown authority fields, arbitrary object URLs/paths, active content formats, oversized images and invalid IDs fail without echoing values. Accepted image types are JPEG, PNG and WebP. Full images are bounded to 16 MiB and 24 million pixels; thumbnails to 1 MiB and 1,048,576 pixels. One frame is accepted; animated images are rejected.

| Route/action | Method and permission | Body and behavior |
| --- | --- | --- |
| `/api/sites/:siteId/media/upload` | POST, `capture.request` | `requestId`, `variant`, `imageId`, `captureId`, `size`, `contentType`, `sha256`, `width`, `height`; full requires null `imageId`; thumbnail requires its existing image ID and null `captureId` |
| `/api/sites/:siteId/media/complete` | POST, `capture.request` and original upload owner | `imageId`, `variant`, `uploadId`; inspect stored bytes, then atomically transition pending to ready |
| `/api/sites/:siteId/images/:imageId/metadata` | GET, `still.read` | Return ready image metadata, without private path/URL, credentials or provider ETag |
| `/api/sites/:siteId/images/:imageId/access` | POST, `still.read` | `variant`, `operation` (`view` or `download`); verify object availability/ETag/type/length, persist attributable grant, return a signed GET URL |
| `/api/sites/:siteId/media/revoke` | POST, `configuration.write` | `imageId`, `grantId`; record revocation and existing direct URL deadline; no provider recall claim |
| `/api/sites/:siteId/media/delete` | POST, `configuration.write` | `imageId`, `variant` (`thumbnail`, `full`, `all`); deny new access first, then perform retryable object deletion |
| `/api/sites/:siteId/media/cleanup` | POST, `configuration.write` | `afterId` (null or cursor), `limit` (1–32); bounded page scan, expire abandoned uploads and retry tombstone deletion |

The existing capability vocabulary is reused. Operators and explicitly scoped services may upload; viewers may read. Engineers may delete/clean up, but need an additional operator role to upload. Services cannot obtain still access or deletion by copying a human role. Device enrollment credentials do not become Gredice service identities; the later edge/capture workflow must provide its own accepted integration. A download grant uses the same scoped GET as a view grant; it adds distinct intent/audit attribution, not a client-enforced attachment or export UI.

The request boundary verifies signed identity before resource lookup, rechecks current account/site/session membership and the server-owned image binding, and durably acknowledges authorization before dispatch. Human POST requests require an approved Origin and `x-arbi-request: 1`; service requests must have no browser Origin. UI mode is absent from authority. The same boundary runs again after storage work before a response can expose a capability. ACL changes during signing can therefore withhold a prepared URL. Authorization responses are `private, no-store` and vary on Authorization/Origin.

## Provenance and associations

Original records bind realm, site, account, execution mode, creator/session, request ID, immutable upload ID, object type/size/checksum/dimensions, creation/verification times and lifecycle state. Cloud observation timestamps do not assert a capture time or measured clock uncertainty. The metadata projection represents capture, job, bed, plant and calibration as individually available or explicitly unavailable, plus capture-time/uncertainty and framing frame/revision.

An unassociated upload uses `captureId=null`. Its associations, capture time and framing are unavailable with `upstream-not-implemented`; there is no fabricated job, bed catalog, calibration or measured pose. A non-null capture selector requires an explicitly supplied `CaptureResolver` that obtains one protected, consistent capture/job/catalog/config snapshot and binds it to the persisted realm/site/account/execution mode. Missing or mismatched records deny. The body cannot provide a job/site/calibration owner or arbitrary provenance. This repository implements the resolver seam and tests synthetic trusted records; the live Gredice catalog and upstream capture/job workflow remain follow-up work.

A thumbnail attaches to an already ready original and inherits its protected associations. Its own bytes/type/checksum/dimensions are validated. `derived.sourceSha256` links the original and `provenance=uploader-declared-thumbnail` accurately describes the supplied derivative: this service does not establish that its pixels were computed from the original or claim calibrated rectification. A trusted later image processor must establish that stronger provenance. Each image accepts one full object and at most one thumbnail; replacing deleted variants requires a new image rather than silently resurrecting history.

## Retry, races and integrity

The API returns a scoped signed PUT URL; the uploader transfers bytes directly to Blob and then calls completion. Ordinary API handlers never receive or forward the capture-upload body. This bounded slice uses whole-file retry, not application multipart sessions. Blob's single PUT is the storage commit boundary; incomplete network requests are not accepted metadata. Any complete object orphaned by interruption remains under its durable pending upload/path and is eligible for cleanup.

Paths contain an opaque site/realm hash, image UUID, variant and upload UUID. They are never taken from a body filename or URL. PUT delegation and signature restrict exact path, operation, content type, maximum bytes and deadline, disable suffix changes and overwrite, and set a 60-second object cache lifetime. The server retains signing material only while preparing the response. An upload has a fixed five-minute absolute completion deadline; short PUT grants can be retried against the same immutable path before that deadline. Each URL additionally expires at the accepted identity/directory deadline. After a lost PUT response, a retry may return an object-exists conflict: call completion to reconcile the existing object rather than permitting overwrite.

Completion fetches the private origin outside the SQL transaction, bounds body length, computes SHA-256, checks MIME type/dimensions/frame count, and forces a full Sharp decode so header-only/truncated images cannot pass. It does not return fetched bytes to the caller. Missing, wrong-sized, changed, corrupt or unexpected objects remain unaccepted. This validation incurs provider object-read traffic; it does not proxy capture uploads through the API. Read grants also check current origin metadata, canceling the object response after headers, so a missing/mutated object cannot obtain a successful grant at that observation time. Objects can disappear later; issuance is not a guarantee of future delivery.

A per-site row lock serializes independent processes and short metadata/audit transactions; network/decode work occurs outside that lock. Creation is unique by realm/site/actor/request ID. Replays must have identical input; concurrent completion sees one ready transition and one logical record. Deletion while verification runs fences the subsequent completion commit. Metadata, accepted audit events, lifecycle detail and grant records commit together. Any database/audit failure returns no new capability; object bytes remain recoverable for retry or cleanup. PostgreSQL and Blob have no distributed transaction, so provider acknowledgements followed by database failure are reconciled using retained pending/deleting records.

## Deletion and cleanup

Deleting a thumbnail leaves the full object usable. Deleting the full image or all variants also deletes its thumbnail, invalidates persisted grants and denies new reads immediately after the metadata transaction. Provider failure leaves state `deleting`; the response exposes that state, and cleanup/delete can retry. A successful provider delete acknowledgement is distinct from CDN eviction, browser-copy erasure or physical privacy acceptance.

Cleanup scans pages in immutable ID order and must follow `next` until null, then restart from null on each later sweep. It expires pending uploads and retries deleting/deleted paths. Deletion becomes `deleted` only after a provider acknowledgement and the absolute upload deadline plus 60 seconds. This is a reconciliation grace period, **not** a proven maximum provider in-flight duration. Held upload URLs may create a path again before expiry, and a provider commit already in flight can arrive later. Durable tombstones remain sweepable even after `deleted`; late writes cannot resurrect metadata and subsequent sweeps delete their objects. An unavailable provider remains explicitly incomplete. There is no promise of instantaneous byte erasure or an exact cleanup completion time during provider failure/in-flight transfer.

An operational initializer/scheduler must call this implemented cleanup seam repeatedly for every provisioned site, complete bounded pages, monitor failures and preserve the tombstones. The authenticated cleanup endpoint enables deterministic/manual recovery. A deployed scheduler, restore, privacy retention duration and administrative migration/purge procedures belong to [#47](https://github.com/gredice/arbi/issues/47). This PR does not pretend an unconfigured deployment is already sweeping. Metadata and audit evidence are retained after object deletion; privacy retention review must set their later purge policy separately. The app exposes no multipart upload flow; live provider acceptance must also check provider handling/retention of interrupted requests and any provider-managed partial uploads.

## Access expiry, revocation and audit limits

Access is signed GET only, for one private path/variant, with lifetime at most 30 seconds and no longer than the accepted identity/directory context. The default directory freshness deadline often makes it at most five seconds. A fresh request is needed after expiry. Each successful grant persists verified actor, session, membership revision, realm/site/image/variant, operation, grant ID and deadline before exposing the URL. No permanent public object URL, delegation/signing token or store credential appears in metadata/audit. View/download intent and `access-grant` use the accepted `still.view`/`media.download` actions; a separate service result says the response was prepared and response delivery is unknown.

The signed URL is transferable bearer access. Blob does not consult Gredice membership for each direct fetch, and this adapter has no documented individual presigned-URL revocation API. Session/ACL revocation prevents fresh grants; a recorded grant revocation prevents treating that grant as active application authority. A previously issued URL may remain usable until its signed deadline. Request-time revocation, downloaded copies, browser memory/disk cache and an already started transfer cannot be recalled. `useCache=false` requests origin reads, but the SDK documents that this cache flag is unsigned and a holder can remove it. It is therefore a freshness preference, not a privacy enforcement or revocation guarantee. Before deployment, test the real private CDN's signed-expiry checks, CORS, caching and deletion propagation; this isolated fixture does not establish those provider guarantees.

Grant generation proves authorization and preparation of scoped access. It does **not** prove delivery of the JSON response, object GET, downloaded byte count, cache hits, repeated URL reuse, viewing duration or that a human saw the image. No `bytes-delivered`, browser-heartbeat or media-observation event is invented. Request/verification/grant/deletion failures carry redacted service results. Lifecycle details stay in the app's `arbi_media_audit.detail`, joined to schema-validated accepted audit events; no incompatible protocol vocabulary is introduced. This is transaction-local evidence, not the later durable ingestion/replay/retention implementation in [#27](https://github.com/gredice/arbi/issues/27).

Usage details reuse `still`/`thumbnail` and `application-payload` vocabulary. A verified object's length is measured **stored payload**, not a traffic meter. Grant object size is potential payload only. Transfer, WAN, provider and retry bytes remain null. Upload retries, failed uploads, verification downloads, cache hits, TLS/overhead, Blob billing, Fast Data Transfer and carrier usage cannot be reconstructed from one image length or one grant. Their accepted counters remain owned by [#18](https://github.com/gredice/arbi/issues/18)/[#26](https://github.com/gredice/arbi/issues/26)/[#63](https://github.com/gredice/arbi/issues/63).

## Evidence record — 7 October 2026

Configuration: Node 24.15.0, pnpm 11.5.2, pinned `@vercel/blob` 2.8.1 and Sharp 0.35.5, secret-free simulated identity/sites, generated PNG bytes, PGlite ordinary tests and disposable host PostgreSQL 15.19 on macOS. The fixture uses the **real SDK** `/signed-token` serialization and `presignUrl`, a loopback HTTP control/object server, ephemeral in-memory signing material and an independent HMAC/operation/path/size/type/expiry verifier. Private GET hosts are remapped to loopback only in the fixture. No Vercel/Neon/Gredice account, deployment secret or physical device is used. Reviewer: repository tests and automated implementation self-review; human/provider/physical acceptance remains separate.

| #22 acceptance | Executable isolated evidence |
| --- | --- |
| Completion is idempotent; abandoned objects cleaned | Concurrent/replayed preparation/completion, interrupted upload, lost PUT response, expiry, bounded cleanup pages, deletion retry and late-object tombstone sweeps |
| Cross-site access denied; no permanent public URLs | Current account/site/session/resource checks, owner/service negatives, site mismatch, strict body, exact private scoped SDK signing and deadlines |
| Each successful grant attributable; cache/sign audit limits explicit | Transactional verified-actor/grant detail, audit schema/correlation tests, role/session change during signing, retained-bearer-until-expiry test and limits above |
| PostgreSQL integrity and integration | Separate connections, one ready transition, deletion/completion race, injected SQL audit failure, restarted store, migration replay and unchanged enrollment/history |
| HTTP boundary | Explicitly configured route tests and built Next.js routes failing closed when unconfigured |

Run from the root:

```sh
pnpm docs:check
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @arbi/dashboard test:postgres
pnpm protocol:check
pnpm build
pnpm --filter @arbi/dashboard test:http
git diff --check
```

These are source/deterministic host integration evidence. Live private Blob (including store mode, size/CORS/expiry/cache/deletion behavior), Neon deployment/restore and live Gredice catalog/session wiring remain unverified under #47 and the owning capture/job work. Bench/HIL, installed capture/privacy controls, calibration accuracy and qualified physical acceptance remain unverified. Recording #68 stays deferred and disabled; no cloud/browser actuator authority, measured position/tension or update-safety inference is added.

Provider reference checked 7 October 2026: [Vercel signed URL parameter and direct PUT/GET reference](https://vercel.com/docs/vercel-blob/vercel-signed-urls) and [Blob SDK/private authentication reference](https://vercel.com/docs/vercel-blob/using-blob-sdk). The pinned SDK declarations/source were checked against these primary references. The revocation limit is an explicit application constraint based on the available API, not a claim of a provider revocation feature.
