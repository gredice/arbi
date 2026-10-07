# ARBI Gredice identity and site authorization

`@arbi/gredice` implements the [authorization 1.0 boundary](../../docs/software/site-authorization.md) for [#17](https://github.com/gredice/arbi/issues/17): dedicated signed identity verification, current Gredice account membership adaptation, explicit site capabilities, scoped resource resolution, required audit acknowledgement and Fetch API request middleware. It consumes `Actor`, `Realm` and `CommandContext` from `@arbi/protocol`; it changes no `arbi/1.0` contracts.

- [Independent executable permission matrix](fixtures/authorization-matrix.json)
- [Identity and membership implementation](src/identity.ts), [Gredice account directory adapter](src/directory.ts)
- [HTTP/realtime/media/audit/artifact request boundary](src/boundary.ts)
- [Identity negatives](src/identity.test.ts) and [request/resubscribe negatives](src/boundary.test.ts)

```sh
pnpm --filter @arbi/protocol build
pnpm --filter @arbi/gredice lint
pnpm --filter @arbi/gredice typecheck
pnpm --filter @arbi/gredice test
pnpm --filter @arbi/gredice build
```

The `@arbi/gredice/testing` subpath offers an in-memory isolated identity provider with ephemeral keys and synthetic simulation-only sites. Its construction rejects production; its identity adapter rejects hardware scope. It supplies no HTTP token-mint endpoint or deployment defaults.

This package is server-only domain code: compose `SiteRequestBoundary.run(request, serverPolicy, handler)` in the dashboard's future Next.js route handlers. Route code selects the capability and surface; request IDs select a resource that protected metadata must resolve. Handlers use the returned actor/site/realm, never body-supplied authority. The middleware never dispatches a job, serves media, installs firmware or authorizes a physical safety gate.

No Gredice endpoint, key or session/site registry has been provisioned by this change. `new GrediceIdentityAdapter(realm)` rejects every credential with `UNPROVISIONED`. Live integration and durable resources remain separate evidence gates; do not replace the production directory or required audit sink with the fixture provider.
