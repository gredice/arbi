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
