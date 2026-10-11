# Synchronized four-axis pulse scheduler

The Pico application contains a C11 finite planner, queue and a real SDK-assembled [PIO engine](../../apps/arbi-control-cabinet-firmware/src/pulse.pio). This extends the [inhibited firmware foundation](pico-foundation.md). It does not enable `motion.move` or initialize motor pins during startup. Existing USB diagnostic requests retain the same admission/capability boundary.

## Plans and ownership

`PulseRequest` specifies signed commanded steps on four axes, maximum major-axis rate in steps/second and its discrete acceleration envelope in steps/second². All values are bounded/finite. Direction changes only at a guarded segment boundary. Zero-length axes retain their prior direction and never pulse; a completely zero request produces guards without STEP edges. DDA distributes each axis over the largest count and makes each nonzero axis's last step occur in the final common slot.

For common slot `s` out of `N`, the model rate is bounded by the request cap and `sqrt(2*a*s)` / `sqrt(2*a*(N-s+1))`; interval ticks round upward. This is a declared symmetric discrete commanded-step model. It is not measured motor/cable acceleration, tension or stopping distance. Conversion to drum/line/cable/pose units and compatible calibration limits is the trajectory-validation owner's work.

At most 512 common slots plus two direction guards fit one immutable plan. Timing and total duration must fit the configured synthetic limits and the PIO 16-bit interval field; rejection clears the plan. Default fixture ceiling is 250 ms, with at most 20 kHz, one-microsecond ticks, five-tick high, five-tick minimum low and ten-tick direction setup/hold guards. No driver-reviewed limit is available yet; these constants cannot enable real motion.

The queue holds eight plans. Exactly one producer publishes a complete slot with release semantics; exactly one consumer obtains it with acquire semantics and owns its copy. Empty/full are `PULSE_STARVED` / `PULSE_QUEUE_FULL`, with no eviction or fabricated completion. Pause is latched: no further dequeue/put is permitted, and deliberate queue reset discards old intent. The target owns a separate copied plan throughout DMA. No interrupt refill or cross-core shared mutation can extend a segment.

## Hardware-timed word

One state machine updates all eight interleaved STEP/DIR pins. Each 32-bit word holds the rising pin mask in bits 0–7, STEP-low/direction mask in bits 8–15 and delay `x` in bits 16–31. The actual assembled six-instruction program executes blocking pull, high output, a delayed NOP, low output, delay extraction and `jmp x--`. At the selected 1 MHz clock, high-to-low is five ticks and the next rise follows `x + 9` ticks. Guard words contain no STEP bits.

Because both masks are in the already-fetched word, missing FIFO input cannot freeze a high pulse: the next blocking pull occurs with STEP low. Its interpretation as a mechanical state remains unknown. Completion requires DMA idle, empty TX FIFO and the PIO program counter at its blocking pull after the final guard. This is a commanded-waveform completion condition; it is not measured position or physical restraint.

The adapter uses PIO0/SM0 and one explicitly claimed DMA channel, checks the system clock's exact integer divider, avoids automatic next-segment dispatch and uses no DMA/PIO ISR. Initialization/start/completion belong to one consumer; asynchronous pause uses an atomic state word. An atomic reservation is the start/pause ordering point: a pause before reservation denies start, and a later pause allows that one finite segment to finish while blocking the next. Input parsing/telemetry can delay the next segment but cannot delay active PIO instructions. Their real worst-case load, pulse width, inter-axis skew, request-to-pause response and clock stability must still be measured on the named board and interface.

## Pause and activation gates

The isolated policy finishes the current prepared segment (at most 250 ms nominal) and latches inhibition of another segment. Immediate stopping through discarded pulses would imply an unreviewed mechanical response, so it is not implemented as a loaded stop policy. Independent electrical stop/restraint and state-dependent fault response remain separate prerequisites.

The ordinary build sets `ARBI_ISOLATED_PULSE_BENCH=0`, so even an asserted permission structure cannot initialize motor GPIO. `node scripts/build.mjs --bench-code-check` compiles the unloaded-fixture code path into ignored `dist/pico-bench-check`; the diagnostic main still never calls the adapter. A separate `arbi_pulse_link_check.elf` references the planner, queue and DMA functions with explicitly denied permission, preventing linker garbage collection from hiding missing target dependencies. Repository build commands check both branches. These commands cross-compile/link code only and perform no flashing or physical test. A future isolated procedure must supply accepted interface/timing records, review the circuit and actual limits, and deliberately invoke the adapter under its permitted unloaded-fixture scope. Loaded operation is outside that scope.

Normal repository build/test commands compile the PIO program and run [golden/concurrency/instruction tests](../../apps/arbi-control-cabinet-firmware/scripts/pulse.test.mjs). The logic-analyzer and mechanical evidence requirements remain [unverified](../evidence/pulse-scheduler.md).
