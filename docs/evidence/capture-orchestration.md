# Capture orchestration source evidence

This record covers issue #66's required simulation and native-host checks,
using the [explicit composition](../software/capture-orchestration.md).
It supplies no physical camera, installed-system or provider-account acceptance.

Source revision: recorded after the clean source commit and checks below.

| Required behavior | Committed executable evidence |
| --- | --- |
| Stopped motion, gimbal, settle, focus and one durable image | [pod integration](../../apps/arbi-pod-firmware/src/capture-orchestration.test.ts) consumes the actual native local job consumer, bounded motion model, pod gimbal/camera sequencer and stores; complete job returns/docks and a repeated request produces no second still |
| Focus/capture/processing/upload are independent | Pod failure fixtures retain failed focus/still phases with no image; [stage tests](../../apps/arbi-edge-controller/src/images/stage.test.ts) preserve unavailable processing and original capture/focus metadata after upload success |
| Actual raw and rectified bytes survive restart | Explicit colour-marker pixel fixture runs the actual processing worker; native files retain raw and derived checksums, quality/transform/calibration lineage and separate upload receipts |
| Outage/restart and lost cloud completion | [native PostgreSQL/Blob SDK HTTP test](../../apps/arbi-dashboard/src/media/capture-orchestration.postgres.test.ts) stages offline, restarts edge owners, renews an expired pending grant, loses a committed cloud response, restarts again and observes exactly one image row, one object and one successful completion audit |
| Original metadata and current authority | The native cloud test compares the complete original trace, keeps unavailable UTC explicit, rejects changed software provenance and current service revocation; pod integration retains its original bounded-UTC capture time and estimated pose |
| Quota, corrupt files and retention | Native stage pressure, bit corruption, reservation/fsync/rename/commit and expiry-intent/unlink cuts produce verified retained files or explicit failed/corrupt/expired states; independent custody is retained |
| Shared budgets and priority | Native workflow/transfer tests cover higher-priority deferral, exhausted budget, wrong receipts, authority loss and timeout; zero allowance still recovers a lost committed upload receipt without another job dispatch |
| Preview grant versus delivery | Stage tests exercise actor/source start, reconnect, expiry, stop and separately returned frame bytes through the shared budget; actual existing native live tests cover PostgreSQL actor/session audit, policy denial, renewal/restart, expiry, signed observations and shared viewers |
| Recording remains disabled | Existing [recording audit tests](../../apps/arbi-dashboard/src/media/media-audit.test.ts) exercise all six reserved operations and actual identity authorization rejection; native fault workflows retain denied recording attempts |

The original 32×24 capture fixture is produced by the actual synthetic pod
sequencer and native store. The marker variant is a separate explicit pixel
fixture; it does not claim that the synthetic pod checkerboard contained markers.
Both are simulated, and their low resolution/focus score are not camera evidence.

Local checks: lint/typecheck/build, complete affected pod/image groups, native
PostgreSQL integration and existing media/live regression, protocol contracts,
Markdown links and whitespace. The edge's `/usr/bin/node` Linux service test
requires CI's staged binary on this host; source-focused local invocation
excludes that one platform check. Logs and exact clean revision will be recorded
before the PR is ready to merge. A successful CI gate remains a separate fact.

Cut fixtures exercise actual native SQLite/filesystem state with injected
process boundaries. Earlier custody/sequencer suites also run actual SIGKILL
children. Neither is board power-loss testing. Host CPU/storage, modelled motion,
application payload and isolated provider HTTP do not establish selected edge,
Pi, physical settling, real WAN/provider accounting or live privacy deployment.
