# ADR-0038: Local WebRTC candidate evidence

Status: proposed in the issue #43 PR. Scope: isolated development-host experiment.

## Decision

Add a reproducible Chromium WebRTC/VP8 candidate experiment using only generated
canvas frames and in-process offer/answer exchange. Two distinct peers receive
real RTP media using host ICE candidates. No camera, Gredice credentials,
STUN/TURN server, remote signaling endpoint or deployment setting is added.

The experiment records actual encoded/decoded frame and RTP payload deltas,
selected candidate types, available round-trip time and sampled Chromium process
tree CPU/RSS. It verifies that closing one viewer leaves the other receiving.
A relay-only probe with no provider yields no candidates and is explicitly
unsupported. This is not a test of an operational TURN server.

The producer uses separate peer connections, so each viewer has its own sender
traffic. `sharedUpstream: false` is deliberate evidence: a single canvas source
is not a shared network uplink. A future SFU/relay proposal must measure one pod
uplink separately from each authorized downstream session and relay overhead.

## Limits and next decision

This PR does not select a physical pod transport, encoder or runtime library.
The existing isolated live authority remains unchanged. Production media still
requires the issue #43 Pi 3A+ encoder/thermal/concurrent-capture bench, mobile
NAT and configured relay tests, current per-viewer revocation integration,
reviewed quotas and measured link accounting. The measured desktop-browser
resources cannot substitute for Pi hardware evidence.

The [guide](../software/live-transport-reference.md) defines this experiment and
the required bench record. The [evidence](../evidence/live-transport-reference.md)
records only executed local results. Unavailable tests remain explicit gates.
