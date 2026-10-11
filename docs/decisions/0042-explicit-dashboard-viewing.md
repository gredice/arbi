# ADR-0042: Explicit dashboard viewer lifecycle

Status: proposed in the issue #65 PR. Scope: isolated test-realm dashboard.

Add a protected cookie bridge to the existing live-session HTTP/store owner,
with explicit inventory, profile, Start/Stop and bounded heartbeat operations.
Inventory creates no viewer grant. The UI retains server-issued viewer identity,
token epoch and deadline in memory only; navigation/reconnect creates no session.

Use the original signed usage/delivery references for measurements. Unknown
delivery is null, not zero; profile rate estimates, producer acknowledgement,
granted permission, device connection observations and playback remain distinct.
The bridge creates neither a session authority nor a traffic ledger.

Hide, offline, close, expiry and 30-second inactivity clear the UI session and
request bounded best-effort closure. If a start/end response is lost, the existing
15-second backend/producer lease remains the independent bound. Resume always
requires an explicit gesture. Camera gestures use the existing observed local
control workflow; video availability grants no motion or camera authority.

The trusted synthetic provider uses actual PostgreSQL and current Gredice
directory checks, its registered historical fixture source and simulated
signaling. Stored transfer mode controls the declared reference profiles:
low-data limits the higher profile; essential-only denies optional viewing.
This is fixture application policy, not measured WAN/carrier plan enforcement.

Production video remains unavailable pending the selected hardware transport
and resource/timing decision. No fake video or browser playback observation is
created. See the [guide](../software/dashboard-viewing.md) and
[evidence](../evidence/dashboard-viewing.md).
