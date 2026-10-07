# Gredice identity and site authorization 1.0

Work record: [#17](https://github.com/gredice/arbi/issues/17). Implementation: [`@arbi/gredice`](../../packages/arbi-gredice/README.md). Authority: [ADR-0005](../decisions/0005-software-architecture-and-deployment.md), [ADR-0006](../decisions/0006-local-safety-authority-and-instrumentation.md). Message/configuration/accounting contracts are unchanged.

## Implemented slice and evidence

The package verifies dedicated Gredice-compatible signed identity, adapts current account membership, reads active site grants and sessions, resolves resource ownership, applies one server policy across request surfaces, and waits for required authorization audit acceptance before calling the resource handler. An executable isolated provider exercises the Fetch API boundary without external services. These are host source/authorization tests, not deployed Gredice, broker, media, database, device or physical acceptance.

There are no new identity HTTP endpoints, enrolled devices, live credentials or resource implementations in this slice. The selected dashboard/API remains the future consumer. Identity integration deliberately fails closed until server provisioning supplies an approved token issuer, separate trust roots, consistent directory reads, protected resource metadata and durable audit sink.

## Gredice source inspection

The committed Gredice tree was inspected at `35adaaea26588acc0cd3ee82836d872789d6a5de` on 2026-10-07:

- [`packages/auth/src/index.ts`](https://github.com/gredice/gredice/blob/35adaaea26588acc0cd3ee82836d872789d6a5de/packages/auth/src/index.ts) exposes `UserBase.id/accountIds`, HS256 `createJwtWithClaims`, configurable issuer/audience/key factory, and access-purpose checks.
- [`apps/api/lib/auth/auth.ts`](https://github.com/gredice/gredice/blob/35adaaea26588acc0cd3ee82836d872789d6a5de/apps/api/lib/auth/auth.ts) uses the general web audience and separates OAuth state, account deletion and delivery tokens. None of those tokens grants ARBI authority.
- [`sessionConfig.ts`](https://github.com/gredice/gredice/blob/35adaaea26588acc0cd3ee82836d872789d6a5de/apps/api/lib/auth/sessionConfig.ts) sets a 15-minute access lifetime. [`sessionTokens.ts`](https://github.com/gredice/gredice/blob/35adaaea26588acc0cd3ee82836d872789d6a5de/apps/api/lib/auth/sessionTokens.ts) revokes refresh tokens; that alone does not establish ARBI access-session revocation.
- [`authValidator.ts`](https://github.com/gredice/gredice/blob/35adaaea26588acc0cd3ee82836d872789d6a5de/apps/api/lib/hono/authValidator.ts) reloads account membership, and [`gardensRepo.ts`](https://github.com/gredice/gredice/blob/35adaaea26588acc0cd3ee82836d872789d6a5de/packages/storage/src/repositories/gardensRepo.ts) contains account-owned gardens. Neither a global Gredice role nor an arbitrary garden/account selection defines an ARBI installation grant.

No committed ARBI identity/site endpoint was found in that inspected tree. This implementation defines a dedicated relying-party profile using the existing signing primitive and account identity shape; it does not claim the Gredice provider currently issues that profile. Gredice source is integration evidence, while ARBI's merged decisions own this boundary.

## Dedicated identity profile

The server configures the issuer, distinct human/service ARBI audiences and a dedicated HS256 key of at least 256 bits for exactly one realm. Keys must be randomly generated and separate for production, preview and test, including preview namespaces; never reuse the general Gredice web signing key. The adapter copies configured key bytes and never obtains a key from a token header or remote URL. Algorithm selection is fixed to HS256. A missing configuration denies all requests.

| Field | Required behavior |
| --- | --- |
| Protected `alg` | Exactly `HS256`; no algorithm negotiation |
| Protected `typ` | If present, exactly `arbi-identity+jwt`; absent remains compatible with Gredice's current mint primitive |
| Other protected headers | Rejected, including `jku`, embedded keys, `kid` and critical extensions; rotate the configured dedicated root through a reviewed provisioning procedure |
| `iss` | Exact configured issuer |
| `aud` | Exactly one configured purpose-specific audience string, never the general web audience or an audience array |
| `sub` | Opaque verified human/service ID |
| `jti` | Opaque ID of the active ARBI session registry record; not a browser principal |
| `tokenUse` | Exactly `arbi_access` for a human or `arbi_service` for a service, paired with that kind's audience |
| `accountId` | Session's account binding, checked against current membership and resource/site ownership |
| `realm` | Exact protocol `Realm` environment and namespace, checked against server, resource, session and site |
| `iat`, `exp` | Integral UTC seconds; issuance cannot be in the future, expiry must be later than issuance and strictly later than now; maximum lifetime 900 seconds, zero clock tolerance |
| `nbf` | Optional standard claim checked by the JWT verifier |
| Other claims | Rejected, including role, browser actor, account lists and device identity |

The existing Gredice `createJwtWithClaims` primitive can express the dedicated claims/audience when configured with the dedicated key factory. This package does not mint production tokens, discover a provider, refresh general web sessions or infer an environment from a browser label. Provisioning must tie `jti` to a revocable server registry and link changes/logout to that registry. The key configuration is a trusted server dependency, never client input.

`authenticate` produces a frozen object branded to its adapter instance. `authorizeIdentity` rejects copied, serialized, forged or other-instance principals. External callers can use `authorize(token, capability, scope)` directly; the request middleware performs signature validation before metadata lookup to prevent unauthenticated resource-existence probes.

JWT verification uses pinned `jose` 6.2.12 and its [primary verification API](https://github.com/panva/jose/blob/v6.2.12/docs/jwt/verify/functions/jwtVerify.md). Fixed algorithm, purpose/audience separation and claim validation follow [RFC 8725](https://www.rfc-editor.org/rfc/rfc8725.html). Node 24 provides the [runtime cryptography](https://nodejs.org/download/release/v24.15.0/docs/api/crypto.html).

## Current identity and site directory

`createGrediceAuthorizationDirectory` adapts the committed Gredice `id/accountIds/isTemporary` shape. It derives account membership from the current list, rejects temporary users and never promotes a Gredice global role. Service identities have a separate active registry and account list. ARBI site bindings, site memberships and access-session records remain protected data; the adapter does not assume an existing Gredice database table or URL.

`readState` must return one consistent authoritative read of the account identity, active account/site, session and site grant. The package validates the resulting snapshot at runtime, including exact actor/session/site/account/realm/execution mode, active flags, membership revision, role vocabulary and allowed service scopes. Missing, malformed, removed, expired or revoked records deny access. Every request and realtime attach/resubscribe reads again; there is no package membership cache.

The original directory observation time bounds freshness: default 5 seconds, configurable from 1 millisecond to a maximum of 30 seconds. Future timestamps and snapshots at or beyond the bound are rejected. A cache cannot relabel delivery time as observation time. Authorized contexts expire at the earliest token expiry, registry expiry or directory freshness deadline. Directory, resource and audit dependencies have a 2-second default timeout, configurable up to 5 seconds, with AbortSignal and a caller-side deadline even for a noncooperative adapter. Changes can therefore take effect only within the configured original-read freshness window, never a renewed cached grant.

Scope metadata must bind each site/still/artifact/audit-export ID to its owning site, account, realm and execution mode. A route's site ID is a lookup selector: it must equal the resolved site's ID. Cross-site resource IDs are denied even when the actor belongs to both sites. Moved/deleted resources require a new matching protected metadata record. A site cannot become a hardware installation through a request field or fixture mapping.

## Explicit capability matrix

Roles combine by explicit union; they form no implicit hierarchy. In particular, engineer and update-admin are independent from operator. Assign multiple roles when that authority is intended. The independently authored [JSON matrix](../../packages/arbi-gredice/fixtures/authorization-matrix.json) is consumed by the tests.

| Capability | viewer | operator | engineer | update-admin | Service allowlist |
| --- | --- | --- | --- | --- | --- |
| State, live view, stills, history | Yes | Yes | Yes | Yes | State only |
| Capture request | No | Yes | No | No | Explicit grant |
| Manipulation intent | No | Yes | No | No | No |
| Diagnostics | No | No | Yes | No | No |
| Configuration read | No | No | Yes | Yes | No |
| Configuration write | No | No | Yes | No | No |
| Update request | No | No | No | Yes | No |
| Private artifact read/download | No | No | No | Yes | Explicit grant |
| Audit read | No | No | Yes | Yes | No |
| Audit export | No | No | Yes | Yes | No |
| Future recording create/read/export/delete | Disabled | Disabled | Disabled | Disabled | Disabled |

Services require both their current site scope and the server service allowlist (`state.read`, `capture.request`, `artifact.read`). Human roles cannot authorize a service, and service scopes cannot authorize a human. Device enrollment, local module identities and credential lifecycle belong to [#21](https://github.com/gredice/arbi/issues/21).

UI mode is absent from the policy. These capabilities permit server handling of authenticated intent or reads. Capture, manipulation, configuration and update handlers must still enforce durable intent/audit transactions, leases and independent edge/Pico/pod local safety preconditions in their owning issues. Artifact availability/download does not imply installation; `Parked` does not establish update safety. No local stop/fault path calls this package.

## Request composition

`SiteRequestBoundary.run` accepts a Fetch `Request`, a **server-selected** policy descriptor, and a handler. A dashboard route derives its site/resource selectors from its URL, fixes the surface/capability in server code, and injects protected storage resolvers. Never accept a policy descriptor or resolved scope from the browser.

The same guard supports HTTP state/history and intent, realtime state/diagnostics/audit subscriptions, live/still media authorization, audit read/export and private artifacts. Surface/capability/resource-kind mismatch is rejected. Still, artifact and audit-export operations require a corresponding resource ID; remaining implemented operations resolve the site itself. The guard returns no object-store URL or provider credential.

The boundary accepts only the dedicated Authorization bearer; it does not use ambient Gredice cookies. Human POST operations require an exact allowed Origin and `x-arbi-request: 1`. Any presented human Origin must match the server allowlist. Browser-origin requests using service credentials are rejected. Reads support GET/HEAD/POST; action and session-grant operations require POST. Production origin configuration requires HTTPS; nonproduction permits explicit loopback origins. The middleware overrides response caching with `private, no-store` and varies on Authorization/Origin, including media/artifact responses.

Handlers copy the returned protocol actor and site/realm into intent context and validate the remaining versioned command fields. A body actor, account header, UI mode or selected site is never principal evidence. Returning from the handler is not a device outcome. The test handlers are synthetic; job routing, durable jobs, media bytes, signed updates, full UI and deployment belong to their own issues.

## Realtime grants and audit seam

`subscribe` authorizes the current session/site and issues a frozen, local subscribe-only state-channel grant. Expiry cannot exceed the identity/directory deadline or 30 seconds. `resubscribe` requires a same-instance grant, current bearer and matching actor/session, then reruns the complete policy and audit. Serialized grants and grants from an old process are rejected; deployment recovery must obtain fresh authorization. Grants are not credentials and contain no publish capability. Server-mediated attach/delivery must call the guard again; a prior grant cannot justify unchecked delivery.

The adapter intentionally does not issue Ably tokens or control an already established broker/media connection. [#29](https://github.com/gredice/arbi/issues/29) must map grants to provider-scoped short-lived revocable tokens, enable provider revocation and revoke active subscriptions on identity changes. [#38](https://github.com/gredice/arbi/issues/38) owns media-session revocation, idle/absolute deadlines and grants. This slice proves request and resubscribe behavior, not provider revocation or frame delivery.

`auditAuthorization` is a required injected seam, with no production no-op default. It receives only allowlisted authorization evidence: correlation ID, time, verified actor/session when available, realm/site/resource/capability, decision/reason and membership revision. Unverified token claims never become an actor. The handler runs only after a positive durable acknowledgement and while the grant is still fresh. If audit is unavailable, the requested action/read is denied. Denied requests try to persist denial evidence; failed denial persistence cannot authorize work. The isolated test sink is in-memory and supplies no durability evidence.

This observation is an authorization decision, not a durable job intent, broker receipt, image-view duration or device result. [#19](https://github.com/gredice/arbi/issues/19) owns the canonical audit vocabulary; [#27](https://github.com/gredice/arbi/issues/27) owns durable cloud append. Their accepted contracts should be consumed at this seam without duplicating audit storage or device-outcome schemas. Tokens, secrets, private configuration, media and provider error messages are excluded.

## Acceptance and remaining gates

| #17 criterion | Executable source evidence |
| --- | --- |
| Cross-site IDs and expired/revoked sessions denied | Signature/purpose/realm and current-directory tests; request tests for all surfaces and resource ownership |
| UI mode grants no permissions | Viewer body/header spoofing cannot invoke manipulation; returned actor comes from signature plus directory |
| Capabilities distinguish view/still/history/capture/manipulation/config/update/audit/recording | Per-role/per-capability matrix, service negatives and unconditional recording denial |
| Realtime resubscribe honors changes | Changed roles/membership revision, revoked session, expired/forged grant and different-session tests |

Run the package lint/typecheck/test/build, `pnpm docs:check` and `git diff --check`. These establish source behavior only. Live provisioning, deployment and current provider acceptance remain unverified under [#47](https://github.com/gredice/arbi/issues/47); the dashboard integration belongs to [#39](https://github.com/gredice/arbi/issues/39). Enrollment #21, durable jobs #28, resources #22/#37, realtime #29 and media #38 retain their implementation and acceptance gates. [#68](https://github.com/gredice/arbi/issues/68) recording remains deferred and disabled. Physical enablement remains governed by ADR-0006 and [#79](https://github.com/gredice/arbi/issues/79).
