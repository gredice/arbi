# Dashboard hosted build closure evidence

[#33](https://github.com/gredice/arbi/issues/33),
[ADR-0046](../decisions/0046-dashboard-native-build-dependencies.md).

Actual protected `arbi-dashboard-test` deployment logs reported missing Edge
capture/preview/budget/commissioning/live-producer and Traffic declarations.
The provider command is `cd ../.. && pnpm build --filter @arbi/dashboard --concurrency=1`.
It did not compile the independently owned Edge modules used by native test files.

The Turbo graph now orders Edge compilation before each Dashboard build, lint,
typecheck and test task. Dry-run output verifies all four edges and retains web
build/test cache disabling, ordinary upstream dependencies and build outputs.
The existing protected production gate and metadata declarations are preserved.

Validation with the exact filtered command and absent generated Edge/Traffic
outputs is recorded after checks. This build-order evidence establishes no
provider deployment, installable signed release or physical acceptance. Protected
signing/publication and deployed source identity remain separate #33 criteria.
