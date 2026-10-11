# Native isolated live producer

[#60](https://github.com/gredice/arbi/issues/60) adds the explicit source reference
in [ADR-0041](../decisions/0041-isolated-live-producer.md), extending the existing
[live-session authority](live-sessions.md). The class has no normal runtime or
supervisor startup integration and accepts only the test realm.

Construct IsolatedLiveProducer with private native storage, exact device
identity/site, current reliable UTC, the existing CapturePreview, mandatory
current health and a bounded injected sink. A SQLite exclusive owner lock and
immutable generation/frame records are independent of the original PostgreSQL
viewer authority. The original human actor stays in that authority; the
producer's camera/budget grant names its service actor.

Boot and reconnect do not encode. Apply only the current backend demand;
duplicate delivery cannot extend its expiry or reopen it after stop/restart.
A higher explicit current generation is required. Maximum lease is 15 seconds,
frame rate 1–5 per second, payload 64 KiB and 128 frames per generation. At most
32 preview generations and 512 journal records bound a reference lifetime;
reaching capacity requires deliberate replacement rather than silent pruning.

The independent 100 ms tick uses conservative monotonic expiry and the existing
budget's idle limit. Unknown/unready local health, resource pressure, capture
contention and update inhibition stop the camera. A send is bounded to 10–1000
ms and aborted on stop. An unconfirmed timeout quarantines further demand for
that owner. Never translate a leased acknowledgement into observed playback.

LiveStore.inspectFrameRecipients is a private, unmounted sink hook. It checks
existing viewer deadlines, current Gredice permissions, device/configuration
and policy on each frame, including authority after asynchronous policy checks.
Changed recipients update the original demand generation; stale frames return
no recipients. An injected sink must respect abort and individual epochs/
deadlines. The test-only TCP composition does so before each viewer write and
bounds each viewer connection to 500 ms. Its total frame send is bounded to
1000 ms. This is a host reference bound, not a production revocation guarantee.

The producer exposes immutable leased/frame/stopped hooks with durable frame
IDs, digest and encoded/acknowledged bytes. A successful sink receipt is
application payload evidence only. The native integration signs actual socket
counters into existing usage windows and delivery reports; downstream windows
retain distinct viewer IDs and original human actors while upstream is shared
once. Private packet envelope is measured separately. WAN, carrier, NAT/relay
overhead and physical camera coverage are unavailable; no recording is enabled.

Run the Edge compiled native live-producer test, protocol demand test and
Dashboard's isolated PostgreSQL suite. [Evidence](../evidence/live-producer.md)
records their scope. Production media selection and physical acceptance remain
blocked on [#43](https://github.com/gredice/arbi/issues/43).
