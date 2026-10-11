# Pulse scheduler evidence

Work record: [#41](https://github.com/gredice/arbi/issues/41). Decision: [ADR-0024](../decisions/0024-isolated-synchronized-pulse-engine.md). Implementation: [guide](../software/pulse-scheduler.md).

Codex-executed source/host checks exercise the actual C planner, bounded queue, pinned target compiler and SDK PIO assembler. Independent Node golden equations use differences of integer floor ratios, rather than repeating the C accumulator implementation. A cycle interpreter reads the actual generated PIO instruction words and checks all pin transitions, pulse width, interval and final FIFO-stall STEP-low behavior. Its cycles are source-derived, not measured GPIO waveforms.

Five scheduler host groups cover representative signed/zero/full-capacity vectors and reversals, exact counts/common completion, numeric/NaN/overflow/rate/acceleration/duration rejection, 100 seeded schedules, eight-slot overflow/starvation, latched pause, unsigned queue-counter rollover and 10,000 concurrent transfers with sequence and immutable-content assertions. Existing eight diagnostic protocol/authentication/configuration groups remain regression checks.

Tested clean source revision: `aef06dc3ad9a70208ffb0e6570978233be87ba9d` (`ARBI_BUILD_DIRTY=0`). Both disabled and isolated-adapter branches cross-compiled with the pinned toolchain; all 13 groups passed normally and under AddressSanitizer/UndefinedBehaviorSanitizer. The target link-check retained actual planner/queue/PIO/DMA function symbols and linked 15,172 text bytes / 23,908 BSS bytes. The ordinary diagnostic image remained 59,832 text / 57,788 BSS bytes. All 25 repository CI planner/gate tests, 301-file Markdown link check, script syntax and whitespace checks passed. These are source/link/host observations; no board waveform or physical response was measured.

| Gate | Status / required evidence |
| --- | --- |
| Shared-core deterministic schedules and bounded concurrency | Source/host tests recorded; commanded counts only |
| Real RP2350 PIO program and adapter compilation | Pin-matched target cross-build; no hardware execution claim |
| CL57Y-V20 input interface and manufacturer timing | **Unverified — 3.3 V labels and proposed GP2–GP9 assignment are not acceptance** |
| Isolated logic-analyzer record | **Unavailable — no board/analyzer attached; width/skew/jitter/loaded-I/O response not measured** |
| Pause/abort mechanical response and independent stopping | **Unverified — finish-and-inhibit is an isolated waveform policy only** |
| Loaded real-motion capability | **Disabled — ordinary build cannot initialize the adapter, and no command dispatches it** |

No human qualified physical sign-off, board trace, pulse measurement, driver-connected result, measured position or tension is supplied. The issue's requested physical timing record remains open. Source agreement and cross-compilation cannot clear that gate.
