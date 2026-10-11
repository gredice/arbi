# Explicit dashboard viewing

The Images screen includes the prototype [#65](https://github.com/gredice/arbi/issues/65)
panel described in [ADR-0042](../decisions/0042-explicit-dashboard-viewing.md).
Read viewing profiles first; then choose an approved source and quality and
select Start viewing. Page load, overview, inventory reads and reconnect request
no session or video. Changing quality requires stopping and a new explicit start.

The protected dashboard-live cookie bridge delegates to the original live
service. Every viewer keeps its own server ID, original human session, token
epoch and authorization/absolute deadline even when sharing a producer.
A heartbeat adapts to the remaining lease, with a 1.5-second maximum polling
interval. It rechecks current authority and renews conservatively before the
last twelve seconds of a valid explicit session within its original absolute
lifetime and re-establishes only that
session's isolated signaling. Error, denial, expiry or revoked state stops it.
The original verified human-session expiry bounds that lifetime. A short
directory-permission snapshot bounds each lease; it is rechecked on renewal
and cannot authorize a viewer after its lease expires.

Expected upstream/per-viewer bytes per minute are profile maximum payload
estimates. Measured bytes read the existing signed usage windows referenced by
the device's delivery observation. They represent the latest reported interval,
not an invented cumulative total. Missing measurement, playback duration, WAN/
carrier bytes and network metering remain explicitly unavailable. A leased
producer or granted permission does not establish connected playback.

Stop viewing, panel closure/navigation, background tabs, offline, expiry and
30 seconds without pointer/keyboard activity clear local authority immediately.
Closure requests use keepalive with a two-second deadline. An uncertain in-flight
start may have committed without returning its ID; a failed/lost closure leaves
the existing independent 15-second server/producer lease as the maximum remaining
authority. Returning online/visible or reloading never restarts viewing.

The ordinary runtime requires explicitly configured LiveDashboardTools and the
existing trusted live service. Branch preview remains unavailable. The explicit
synthetic provider uses real PostgreSQL/current directory/session checks and
its registered synthetic usage source. Its 32/96 kbit/s, two-viewer profiles
are declared application-policy fixtures; current stored low-data mode permits
only the lower profile and essential-only denies optional viewing. Its declared
remaining reference budget is not physical allowance or carrier evidence.

No production media transport/player is selected or enabled. Isolated signaling
and real session lifecycle are available; encoded native payload evidence is
separately covered by the [producer reference](live-producer.md). Camera actions
remain in the observed control panel, which requires current supported commands,
permission, local readiness and manual lease. Recording remains disabled.

[Host evidence](../evidence/dashboard-viewing.md) records browser/database checks.
The #43 transport bench and actual camera/resource tests remain prerequisites.
