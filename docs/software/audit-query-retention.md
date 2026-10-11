# Authorized audit investigations and lifecycle

This implements the isolated prototype scope of [#36](https://github.com/gredice/arbi/issues/36), using the existing [durable audit store](audit-durability.md) and [site authority](site-authorization.md). Production and hardware enablement remain gated by those owners. Ordinary builds and branch previews expose no configured query or lifecycle adapter.

## API and authority

`createAuditQueryServer` requires a migrated database, current identity/resource resolver, current-authority callback, exact browser origins and a private stable query key of at least 32 bytes. Compose it explicitly with `configureAuditQueries`. There is no generated key, fixture login, automatic migration, default retention policy or startup deletion sweep.

All endpoints live under `/api/sites/:siteId/audit/`. Human bearer authorization is mandatory. Every request passes the existing durable authorization boundary before its handler; audit failures deny access. Current membership, account/site ownership, session expiry and capability are checked again inside the database transaction and before return. Engineering presentation does not grant a capability.

| Endpoint | Capability | Input and bounds |
| --- | --- | --- |
| `GET search` | `audit.read` | Query parameters, at most 31 days, 1–100 rows, 1 MiB response |
| `POST export` | `audit.export` | Same query in a JSON body, maximum 1,000 rows and 8 MiB; excess returns capacity failure |
| `POST policy` | `configuration.write` plus explicit lifecycle steward | Class, unique revision, retention days, identity mode and maximum hold days |
| `POST hold` / `release-hold` | Same steward checks | Immutable hold ID, class, target ID or whole class, finite expiry and closed reason |
| `POST retire` | Same steward checks plus separately privileged database pool | Origin, event ID and closed deletion reason |

POST requests also require an allowed Origin, `x-arbi-request: 1` and JSON content type. Search allows only `fromMs`, `toMs`, `limit`, `cursor`, `actorId`, `deviceId`, `action`, `resourceId`, `outcome`, `correlationId`, and `sessionId`. The time interval is receipt based and half open. Actor filters use the trusted directory's original opaque ID; returned actors are pseudonyms. Unknown fields, site/realm claims and duplicate query parameters fail closed.

The protected export resource is `{kind: 'audit-export', id: siteId}`. The server resource directory must explicitly resolve it to its owning site; absence denies export. This resource authorizes the per-site export view, rather than a caller-selected file. The query transaction rechecks current `audit.export` authority against that same site. Each search/export creates one standalone authorization record with permission `view`/`export`; reading those records does not recursively emit more records. Authorization is evidence of access permission, not proof that a client received every response byte.

## Pagination, export and coverage

[Migration 0008](../../apps/arbi-dashboard/migrations/0008-audit-lifecycle.sql) adds an immutable receipt index over durable, enrollment and media audit origins. A per-site advisory lock orders index admission and snapshot selection before allocating ordinals, so concurrent uncommitted legacy inserts cannot later appear below a frozen high-water mark. Original tables and their IDs remain the source of payloads. Legacy records without a receipt use a conservative migration/admission receipt for retention and disclose their unchanged missing original timestamp.

HMAC-protected cursors bind realm, site, human identity, session and the complete filter, plus high-water ordinal and a lifetime of at most five minutes or session expiry. Later insertions are excluded. Filter changes, another session and modified/expired tokens cannot reuse the cursor. Pages preserve original source time, sequence, clock uncertainty and causal references; index ordinal is a receipt cursor, not source ordering or a physical result.

`arbi.audit-export/1.0` includes the `arbi.audit-query/1.0` filter, snapshot cursor, closed event projection, coverage and canonical SHA-256 integrity digest. The digest covers the query payload; it is not a signature. Actor IDs are HMAC pseudonyms scoped by realm and site. Exports omit raw protocol/request contents, media contents, private URLs, credentials and the underlying media audit `detail` object. Only previously validated audit vocabulary and approved opaque references are projected. Key rotation changes pseudonyms and invalidates old cursors, so operators must plan it explicitly.

Durable rows expose their stored chain hashes. Legacy origins are explicitly unchained. Retired rows expose their immutable receipt/digests rather than a fabricated event; filtered matches after retirement are unknown and the response reports the count of retired payloads within the window. A snapshot reproduces append coverage, not permission to resurrect subsequently deleted sensitive data. Source UTC may remain unknown; no source-clock subtraction crosses boots.

## Policy, holds and privileged retirement

Policies are append-only revisions for `audit`, `media` and `operational` data classes, with 1–3,650 retention days, `identityMode: pseudonymized` and maximum hold duration 1–365 days. The latest committed class policy applies. There are at most 128 policy revisions and 1,024 hold records per site; reaching a cap fails visibly. Holds can cover a class or one event ID, have a closed investigation/incident/privacy-review reason, and append a separate release receipt. Release requires the exact original hold body; it cannot edit or silently shorten a hold.

The steward callback is an explicit trusted server policy and is bounded to one second. A `configuration.write` role alone cannot change these policies or delete records. Policy/hold mutations atomically append configuration intent, authorization and their policy/hold ledger rows. Retirement uses a separately composed privileged pool and atomically appends its configuration approval, immutable retirement receipt and payload removal. Failure or loss of current steward authority rolls everything back.

`retention-expired` permits removal only when trusted receipt time is at or before `now - retainDays`; a unit test covers either side of that exact cutoff. `operator-delete` allows an explicitly authorized earlier deletion. Both require an audit policy and honor active class/target holds. Undelivered durable notifications, unfinished command jobs and unclosed control leases prevent removal of records needed for delivery/correlation. Old identical device replays return their original acknowledgement without restoring deleted payloads. New children of a retired root cannot acquire invented correlation.

Retirement changes only the original audit row's `record` to SQL NULL. IDs, source stream/sequence, chain hashes and receipt index stay immutable. The separate receipt preserves content/record digests, first ingest time, approval intent, policy revision, reason and retirement time, without the original actor. Chain verification validates retired rows using those digests and reports `retiredPayloads`. This is detectable authorized payload deletion, not a history edit or a claim that every associated object was erased. Hashes and opaque source IDs retain linkage and require their own privacy review.

Media objects, image grant state, command/lease operational records, enrollment lifecycle records, and media audit detail retain their existing owning lifecycle. Class policies and holds define their contract here; this API does not invoke Blob deletion, remove active operational state, or implement global subject erasure. Their adapters must honor the policy/hold contract and provide their own receipts before any claim of complete deletion. Recording remains [deferred and disabled](recording-policy.md).

## Database deployment and rollback

Run `pnpm --filter @arbi/dashboard db:migrate:audit-lifecycle` only with a private operator `ARBI_AUDIT_LIFECYCLE_DATABASE_URL`, after migrations 0001–0004. The script applies schema only. Provision separate non-owner logins and pools explicitly; do not give a runtime login schema ownership, role administration or permission to disable triggers. The migration owner is inherently privileged and cannot be constrained by application guards.

The ordinary query/policy login needs its existing registry/job-site/append-audit privileges, SELECT on history/index/retirements/policies/holds/releases, and SELECT/INSERT on policy/hold/release tables. It must have neither INSERT on retirements nor EXECUTE on `arbi_retire_audit_payload(text)`. The separate lifecycle login additionally needs INSERT on retirements and EXECUTE on that function, plus the reviewed site/current-job/control-lease reads. Do not grant UPDATE/DELETE/TRUNCATE on audit or lifecycle history to either login. The payload function alone has SECURITY DEFINER authority with a fixed search path and fixed table allowlist; PUBLIC execution is revoked. A row guard also requires the matching scoped approval receipt and forbids all other field changes.

Exercise these grants against an isolated database before deployment. The native test uses a non-owner ordinary role and proves it cannot mutate audit rows, forge a receipt or call retirement. Owner-role accidental DELETE/TRUNCATE remains denied by triggers. Reapplying migration 0008 is tested. Once a payload has been retired, older binaries that require every row's JSON cannot safely verify/read that database. Roll forward with compatible readers; retention is irreversible and backups require a reviewed privacy/hold policy, not automatic resurrection.

The [host evidence](../evidence/audit-query-retention.md) records the tests and their limits. No production retention has been run.
