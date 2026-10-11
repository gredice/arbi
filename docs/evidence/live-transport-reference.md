# Live transport candidate evidence

[#43](https://github.com/gredice/arbi/issues/43),
[guide](../software/live-transport-reference.md),
[ADR-0038](../decisions/0038-local-webrtc-candidate-evidence.md).

The executed local candidate uses real Chromium WebRTC and VP8 on synthetic
canvas media. Both viewers must receive decoded frames; closing one peer must
leave the other receiving. The unconfigured relay-only probe must yield zero
local candidates. No test fixture can report mobile NAT or TURN feasibility.

## Executed development-host record

Clean source `0cf2d07502eda819c02de63370f6a83b755f88bb` passed dashboard TypeScript,
script syntax, and the standalone candidate assertions on 2026-10-11. The
[complete machine-readable record](live-transport-reference.json) names Linux
6.18.44/x64, AMD EPYC 9V74, Node 24.19.0 and Chromium 145.0.7632.6.

Over 5,015.19 ms, the two separate senders reported 7,047 and 7,111 RTP payload
bytes (11,226.94 and 11,329.39 bit/s). They each encoded 19 frames; the viewers
decoded 20 and 19 in nearby sampling windows, with zero observed lost packets.
The requested five fps is a configured ceiling, not an achieved measured rate.
One viewer continued receiving after the other closed. All selected candidates
were host/UDP; the unconfigured relay-only probe yielded zero candidates.

The sampled Chromium process tree used 0.46 CPU seconds and peaked at 669,507,584
summed process RSS bytes, including sender, receivers and browser workers. Shared
pages can be counted repeatedly. These figures are desktop-browser host evidence
and cannot estimate Pi encoder resource use. The measured simple scene is not a
physical image-quality assessment. The report labels counters partial and WAN/
carrier/temperature/production selection unavailable.

The evidence-only follow-up changes no tested implementation. CI additionally
runs the candidate after the existing browser suite.
Physical camera quality, Pi resource/thermal limits, still-capture contention,
packet-loss injection, mobile NAT, operational relay, current Gredice viewer
authority and WAN/carrier counter comparison remain untested. The isolated live
session authority has separate [native evidence](live-sessions.md); this candidate
experiment does not claim to integrate its authorization or choose production
transport.
