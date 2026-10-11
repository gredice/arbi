# Capture dashboard evidence

Work record: [#69](https://github.com/gredice/arbi/issues/69),
[guide](../software/capture-dashboard.md),
[ADR-0037](../decisions/0037-protected-capture-history-and-framing-review.md).

The source/native scenarios read actual SQLite staging after failed upload and
restart, preserve immutable capture clocks/identity and keep a declared synthetic
failed-autofocus receipt distinct. An actual isolated image worker rejects a
marker-free synthetic image with `FIDUCIAL_MISSING` while preserving captured raw
media and its pending upload. Native commissioning review reports accepted
source identities and canonical audit; incompatible framing cannot silently
activate. The earlier pod capture composition tests separately exercise an actual
synthetic autofocus failure and durable failed camera result.

The protected integration uses actual PostgreSQL and private Blob SDK/HTTP
fixtures plus native commissioning devices/stores. It checks metadata without
media grants, separate processing-unavailable/pending-upload outcomes, stable-ID
paging without repeats, filter rejection, explicitly deferred access without
signing, authorized access audit, cloud-only original capture identity and bed/
plant metadata after offline recovery, replay with an unavailable historical
catalog without changing the original association, latest verified receipt ordering, changed
calibration revision rejection, independently reviewed new calibration staging/
activation with matching audit correlation, and current human revocation.

Chromium renderer fixtures exercise visible focus/processing/upload/delivery
states and reported schedule metadata, explicit budget deferral, an issued link
without automatic download, on-demand thumbnail bytes and visibility cleanup
without retry. Those route fixtures do not establish backend authorization or
physical outcomes. A separate browser check hits the real unconfigured protected
shell and sees explicit provider unavailability with no media or edit authority.

Source/native/browser validation does not establish physical camera focus,
selected-device timing, carrier/WAN bytes, real provider tenancy or installed
commissioning. No production/live capture provider, hardware output or accepted
physical configuration is enabled.

## Reproducible source validation

Clean source `752ad9644307df33929b15c961a2b16c8dc5fbd4` on the merged issue #66
main baseline passed 14 protocol/edge build, lint and typecheck tasks and five
full offline preview dashboard build, lint and typecheck tasks. The affected
edge image/commissioning suite passed all 46 tests serially; the full native
PostgreSQL suite passed all 72 tests. The protocol suite passed all 464 tests,
including independent TypeScript, Python and host C reference consumers. Both
capture Chromium browser checks passed. These results use Node 24.19.0,
PostgreSQL 18.4 and Chromium 145.0.7632.6 on an isolated Linux development host.

The evidence-only follow-up changes no validated implementation. GitHub CI and
review are additional PR merge gates; this record does not imply deployed or
physical acceptance.

After the audit inventory and mobile navigation expectations were updated, clean
source `05eb63e2ef0376a9ae0478e973d178df3df94971` rebased onto the merged issue #43
main passed 14 forced protocol/edge tasks and 11 forced dashboard/dependency
build/lint/typecheck tasks. All 21 dashboard Chromium checks passed, followed by
the actual local WebRTC candidate. The complete dashboard Node suite also passed
92 tests with 18 native skips; the separate native suite above covers those
PostgreSQL paths. The source implementation matches the earlier native and
protocol record; later changes register audit coverage and update the replaced
Images placeholder expectation.
