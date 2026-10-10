# Complete assembly inventory and bounded diagnostics

Work record: [#48](https://github.com/gredice/arbi/issues/48). The authenticated
dashboard now lists all 19 baseline assemblies: cabinet, edge, Pico, four corner
stations, four winches, four positioning lines, pod, gimbal, camera and dock. Additional
configured components appear with stable IDs and explicit unmapped/unavailable telemetry.
The inventory includes passive parts; lack of instrumentation does not hide an assembly.

## Provenance and unavailable channels

Protected state/configuration reads produce [assembly projections](../../apps/arbi-dashboard/src/dashboard/assemblies.ts).
Configured component/firmware references and calibration revision remain distinct from
installed firmware or actual commissioning receipts. The commissioning panel retains
its separate authoritative active/staged/rejected status when configured.

Numeric readings preserve unit, quality/original quality, source device/boot/session,
sequence, original source UTC/monotonic time, clock uncertainty, receipt time, sample
time/age and value uncertainty. Unknown clocks remain unknown. Aged values are labelled
stale, including when a hidden view resumes before a new response. Driver encoders,
line tension, supply current, latch feedback and unsupported camera channels are never
invented. A measured value requires a declared matching metric/measurement capability;
an undeclared measurement is normalized to unavailable throughout the dashboard.
Simulated estimates/commanded gimbal data remain explicitly simulation data.

## Selected demand

`GET /api/sites/:siteId/dashboard/detail?assembly=:id` checks current site membership,
`diagnostics.read`, required durable authorization evidence, realm and execution mode.
Every request validates protocol units/version, source/capability/configuration identity,
and current authority again before data release. Query keys and assembly identity are
bounded; client-selected source URLs, actors, rates or arbitrary configuration are not
accepted. Responses are private/no-store and at most 32 KiB.

The response negotiates a minimum 5-second refresh and maximum 60 browser observations.
There is no periodic detail demand until an engineer explicitly selects an assembly.
Only that assembly's view refreshes. Closing/deselecting, unmount, page hiding, offline
state and session expiry abort demand and cancel timers. Returning to a visible view
rechecks access; reconnect never creates an actuator command. Generation fencing prevents
a delayed retired fetch from replacing a current result. Visibility changes cannot
bypass the current view's minimum request spacing.

This is bounded HTTPS pull against existing authoritative state, not an automatic
broker/media subscription or a claim of a new source-sampling rate. The trusted optional
`readDiagnosticEvents` adapter queries [#37 history](telemetry-history.md) for the selected
assembly only. It returns at most 32 protocol-valid site/realm events; absent composition
is visibly unavailable. The projection exposes safe state transitions, fault ID/severity/
code, command/outcome correlation and source/time, excluding raw error or protocol bodies.
Delayed history assembly cannot outlive current access.

## Plots, inspection and export

History cannot regress on repeated/out-of-order sequence or receipt time. Source boot,
configuration, capability or assembly changes reset the bounded curve. Missing sequence
intervals are visible; plots do not bridge them or unavailable/stale samples. SVG plots
show metric/unit, min/max and observation count, with source quality/sequence in point
context. Charts are partial observations, not calibrated physical traces or interpolated
sensor measurements. The current reading's provenance remains visible next to the plot.

Filtered inspection covers observed state/protocol headers and available authoritative
fault/command history, with at most 60 observations and 32 events per selected read.
It is not an unrestricted raw log viewer. Diagnostic JSON export uses the closed
`arbi.diagnostics-export/1.0` allowlist, includes explicit partial coverage, timestamps,
quality and revisions, and is capped at 1 MiB. Nested firmware/source/time/reading/event
objects are projected independently: arbitrary fields cannot smuggle credentials,
configuration geometry, media or signed access URLs into the export. Exports use only
already authorized observations; failure/revocation clears the active detail history.

## Mobile-data and acceptance limits

The source ceiling is 12 completed selected reads per minute at at most 32 KiB each
(384 KiB/min of JSON response payload, excluding HTTP/TLS overhead). It is a per-view
application ceiling, not a carrier bill, server-wide rate limiter or unlimited operator
allowance. Background/overview/closed demand generates zero periodic detail requests.
Actual payload evidence is recorded in [host/browser evidence](../evidence/assembly-diagnostics.md).
Multiple browser views and actual source/edge transfers still need the configured
usage/transfer policy under #45/#55; no unmeasured mobile allowance is claimed.

The current committed synthetic site has no measured encoder/tension/current sensing,
live device authority, media stream or configured fault-history adapter. The optional
history seam and unavailable display preserve that fact. Hardware source capabilities,
installed measurements and real cellular acceptance remain with their owning issues.
