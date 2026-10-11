# Live transport candidate evidence

[#43](https://github.com/gredice/arbi/issues/43),
[guide](../software/live-transport-reference.md),
[ADR-0038](../decisions/0038-local-webrtc-candidate-evidence.md).

The executed local candidate uses real Chromium WebRTC and VP8 on synthetic
canvas media. Both viewers must receive decoded frames; closing one peer must
leave the other receiving. The unconfigured relay-only probe must yield zero
local candidates. No test fixture can report mobile NAT or TURN feasibility.

The clean source report and measured values are recorded below after validation.
Physical camera quality, Pi resource/thermal limits, still-capture contention,
packet-loss injection, mobile NAT, operational relay, current Gredice viewer
authority and WAN/carrier counter comparison remain untested. The isolated live
session authority has separate [native evidence](live-sessions.md); this candidate
experiment does not claim to integrate its authorization or choose production
transport.
