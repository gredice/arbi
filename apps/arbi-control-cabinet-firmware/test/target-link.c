/* Compile/link proof only; this image is not a board test or installer.
 * Explicit denied permission prevents GPIO activation if it were executed. */
#include "pulse.h"
#include "pulse_pio.h"
#include "pico/stdlib.h"
static PulseQueue queue;
static PulsePlan plan, observed;
int main(void) {
  const PulseLimits limits = {1000000, 5, 10, 10, 250000, 20000, 2000000};
  const PulseRequest request = {{1, -2, 3, 0}, 1000, 100000};
  const PulseBenchPermission denied = {0};
  pulse_queue_init(&queue);
  if (pulse_plan(&plan, &request, &limits, 0) == PULSE_OK) {
    (void)pulse_queue_put(&queue, &plan); (void)pulse_queue_take(&queue, &observed);
  }
  (void)pulse_pio_initialize(&denied);
  (void)pulse_pio_start(&observed); (void)pulse_pio_completed(); pulse_pio_pause();
  pulse_queue_pause(&queue);
  for (;;) tight_loop_contents();
}
