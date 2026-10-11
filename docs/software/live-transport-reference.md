# Local live transport candidate reference

Work record: [#43](https://github.com/gredice/arbi/issues/43),
[ADR-0038](../decisions/0038-local-webrtc-candidate-evidence.md),
[evidence](../evidence/live-transport-reference.md).

From the dashboard workspace, after the pinned dependency install and
`pnpm exec playwright install chromium`, run `pnpm live:transport-reference`.
The existing `test:browser` command also runs it after the protected shell tests
on Linux; other platforms report an explicit skip. The direct command exits
with a Linux requirement before opening any resources on unsupported platforms.
It requires Linux `/proc` and `getconf CLK_TCK`; no PostgreSQL, app server,
provider account or physical device is required by this standalone experiment.

The private loopback HTTP page generates a 320 × 240 canvas at a requested five
frames per second. Two separate VP8 senders request a 96,000 bit/s ceiling each.
Actual encoded/decoded frames and per-sender payload throughput are reported,
rather than assuming the requested limits equal measurements. The fixed
synthetic scene does not establish agricultural image quality or an attainable
physical camera profile.

Host ICE gathering and first-frame checks are bounded. The measurement interval
is five seconds; all peers, tracks, browser processes and the HTTP listener close
on completion or failure. A global 45-second deadline kills the browser to abort
uncertain work. The output includes source commit/dirty status, Node/Chromium,
OS/CPU, exact requested profile and explicit untested paths. It never outputs
SDP, ICE addresses, WebSocket endpoints or authentication material.

RTP payload counters exclude IP/UDP, signaling, STUN/TURN, retransmission
classification, provider traffic and carrier billing. Sender and receiver deltas
are separate observations over nearby sampling times; they need not be identical
at interval boundaries. Browser RTT is an ICE path statistic, not measured
end-to-end frame latency. Sampled summed process RSS can count shared pages more
than once; process exits can omit CPU time. Temperature is unavailable.

## Required physical bench record

Before transport selection, record exact Pi 3A+/camera/gimbal revisions, OS,
firmware/source/build/configuration, encoder/library versions and instruments.
For each candidate profile, record resolution/fps/bitrate, frame latency,
CPU/RAM/temperature/throttling, still-focus/capture contention, loss/recovery and
start/stop timing. Include LAN, representative mobile/carrier NAT, relay-only,
link interruption and more than one independently authorized viewer.

Each path must identify where the uplink terminates, separate measured pod
uplink from relay ingress/egress and viewer downloads, and disclose counter
coverage and overhead. Per-viewer revocation must not leave an unauthorized
viewer receiving a shared upstream. Record proposed viewer/quality limits,
idle/absolute timeout, relay byte/session quotas, acceptance thresholds, failures
and stop conditions, with a named reviewer. Missing hardware/provider tests
cannot produce an accepted production selection.
