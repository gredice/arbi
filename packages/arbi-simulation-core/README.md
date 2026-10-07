# @arbi/simulation-core

Implemented deterministic offline scenario runner, affine trajectory and Euclidean cable references, uint32 seeded disturbances, normalized traces and adapter seams. It consumes [@arbi/protocol](../arbi-protocol/README.md) via `workspace:*`. No dependency on the dashboard, cloud, enrollment, devices or providers exists.

From the repository root, after installing pinned dependencies:

```sh
pnpm scenario:check
pnpm --filter @arbi/simulation-core scenario
pnpm --filter @arbi/simulation-core scenario ../arbi-protocol/fixtures/scenarios/1.0/disconnected-cloud.json
node packages/arbi-simulation-core/dist/runner.js packages/arbi-protocol/fixtures/scenarios/1.0/healthy.json packages/arbi-protocol --trace
python3 -I -B packages/arbi-protocol/conformance/scenario.py packages/arbi-protocol/fixtures/scenarios/1.0/healthy.json packages/arbi-protocol --trace
```

`scenario:check` builds both packages before testing. The CLI defaults to the healthy fixture, validates declared golden results and emits a JSON report; `--trace` adds every normalized row. Paths passed through a package script are relative to that package. Validation failures exit 2 with a bounded named error and no success output. Library exports include `runScenario`, `checkScenarioExpected`, `referenceTrajectory`, `seededRandom`, `q6` and the implemented `simulatedAdapters` factory.

The [scenario specification and evidence](../../docs/software/scenarios.md) define ordering, numerical normalization, consumer independence, model limitations and physical gates. The default adapters expose simulated estimates/commanded gimbal targets and unavailable physical feedback. Future device adapters can implement these method boundaries in a separately gated local runtime; this runner requires `executionMode: simulation`. An adapter mode tag is a caller contract, not a security boundary against arbitrary untrusted JavaScript. No hardware implementation or endpoint is supplied.

## Bounded plant model

The additive `arbi.plant/1.0` model implements synchronized cable/drum references, configurable driver/local-input/power/gimbal/camera adapters, seeded delay/noise and imaging/return sequences. [Model contracts, timing, evidence and limits](../../docs/software/bounded-plant-model.md) distinguish estimates and virtual sensors from physical measurements. `runPlant`, `validatePlant`, `boundedPlantAdapters`, `cableLengths`, `drumMapping` and the portable module interfaces are exported. Scenario 1.0 behavior remains unchanged.

```sh
pnpm scenario:check
pnpm --filter @arbi/simulation-core plant
node packages/arbi-simulation-core/dist/plant-runner.js packages/arbi-simulation-core/fixtures/plant/1.0/nominal.json packages/arbi-protocol --trace
python3 -I -B packages/arbi-simulation-core/conformance/plant.py packages/arbi-simulation-core/fixtures/plant/1.0/nominal.json packages/arbi-protocol --trace
```
