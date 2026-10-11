#include "pulse_pio.h"
#include "pulse.pio.h"
#include "hardware/pio.h"
#include "hardware/dma.h"
#include "hardware/clocks.h"
#include <string.h>

static bool initialized;
enum { ACTIVE = 1, PAUSED = 2 };
static atomic_uint state;
static int channel = -1;
static uint offset;
static PulsePlan owned;
static bool named(const char *s) { return s && s[0] && strlen(s) <= 64; }
bool pulse_pio_initialize(const PulseBenchPermission *p) {
  if (!p || !p->isolated_unloaded_fixture || !p->interface_reviewed || !p->timing_measured
    || !named(p->procedure_id) || !named(p->wiring_revision) || !named(p->timing_record)) return false;
#if !ARBI_ISOLATED_PULSE_BENCH
  return false;
#else
  if (initialized || atomic_load_explicit(&state, memory_order_acquire) || clock_get_hz(clk_sys) % 1000000) return false;
  if (pio_sm_is_claimed(pio0, 0) || !pio_can_add_program(pio0, &arbi_pulse_program)) return false;
  channel = dma_claim_unused_channel(false);
  if (channel < 0) return false;
  pio_sm_claim(pio0, 0); offset = pio_add_program(pio0, &arbi_pulse_program);
  pio_sm_config config = arbi_pulse_program_get_default_config(offset);
  sm_config_set_out_pins(&config, 2, 8);
  sm_config_set_out_shift(&config, true, false, 32);
  sm_config_set_clkdiv_int_frac(&config, (uint16_t)(clock_get_hz(clk_sys) / 1000000), 0);
  for (uint pin = 2; pin <= 9; pin++) pio_gpio_init(pio0, pin);
  pio_sm_set_consecutive_pindirs(pio0, 0, 2, 8, true);
  pio_sm_init(pio0, 0, offset, &config);
  // Isolated unloaded fixture only. Low output is not a safe mechanical state.
  pio_sm_set_pins_with_mask(pio0, 0, 0, 0x3fcu);
  initialized = true; return true;
#endif
}
bool pulse_pio_start(const PulsePlan *plan) {
  if (!initialized || channel < 0 || (uint)channel >= NUM_DMA_CHANNELS || !pulse_plan_valid(plan)) return false;
  unsigned expected = 0;
  // Reservation is the start/pause linearization point. A later pause permits
  // this one finite segment to finish and prevents the next reservation.
  if (!atomic_compare_exchange_strong_explicit(&state, &expected, ACTIVE, memory_order_acq_rel, memory_order_acquire)) return false;
  // The consumer owns this immutable copy through completion. Producer/parser
  // code cannot modify DMA source memory or delay the hardware pulse loop.
  owned = *plan;
  pio_sm_set_enabled(pio0, 0, false); pio_sm_clear_fifos(pio0, 0); pio_sm_restart(pio0, 0);
  pio_sm_exec(pio0, 0, pio_encode_jmp(offset));
  dma_channel_config config = dma_channel_get_default_config((uint)channel);
  channel_config_set_transfer_data_size(&config, DMA_SIZE_32);
  channel_config_set_read_increment(&config, true); channel_config_set_write_increment(&config, false);
  channel_config_set_dreq(&config, pio_get_dreq(pio0, 0, true));
  // No DMA/PIO ISR or CPU refill is required. Completion is polled and cannot
  // dispatch a subsequent segment automatically.
  dma_channel_configure((uint)channel, &config, &pio0->txf[0], owned.words, owned.count, true);
  pio_sm_set_enabled(pio0, 0, true); return true;
}
bool pulse_pio_completed(void) {
  if (!(atomic_load_explicit(&state, memory_order_acquire) & ACTIVE)) return true;
  if (channel < 0 || (uint)channel >= NUM_DMA_CHANNELS) return false;
  if (dma_channel_is_busy((uint)channel) || !pio_sm_is_tx_fifo_empty(pio0, 0)
    || pio_sm_get_pc(pio0, 0) != offset) return false;
  // At the blocking pull all STEP pins are low and the final guard expired.
  // Count completion is a commanded waveform observation, not measured motion.
  atomic_fetch_and_explicit(&state, (unsigned)~ACTIVE, memory_order_acq_rel); return true;
}
void pulse_pio_pause(void) { atomic_fetch_or_explicit(&state, PAUSED, memory_order_acq_rel); }
