/* Compile/link proof only; this image is not a board test or installer.
 * Explicit denied permission prevents GPIO activation if it were executed. */
#include "pulse.h"
#include "motion.h"
#include "homing.h"
#include "pulse_pio.h"
#include "pico/stdlib.h"
static PulseQueue queue;
static PulsePlan plan, observed;
static MotionState motion;
static MotionProfile profile;
static MotionRequest movement;
static MotionReport report;
static InputsModel inputs;
static HomeModel home;
static HomePolicy home_policy;
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
  (void)motion_restore(&motion,&profile,(MotionPoint){1000,2000,2500});
  (void)motion_admit(&motion,&movement,&profile.identity,&limits);
  (void)motion_begin(&motion,&profile.identity,&plan);
  (void)motion_observe_commanded(&motion,&profile.identity,motion.commanded);
  (void)motion_complete(&motion,&profile.identity); motion_inhibit(&motion);
  motion_report(&motion,&report);
  inputs_model_reset(&inputs);
  (void)inputs_model_update(&inputs,0,(InputSample){RAW_UNAVAILABLE,0},0);
  (void)inputs_physical_available(&inputs);
  (void)home_model_restore(&home,&profile,&home_policy,0);
  (void)home_model_tick(&home,&profile.identity,&inputs,0,&limits,&plan);
  (void)home_model_complete_plan(&home,0); home_model_inhibit(&home,"LINK_CHECK_ONLY");
  for (;;) tight_loop_contents();
}
