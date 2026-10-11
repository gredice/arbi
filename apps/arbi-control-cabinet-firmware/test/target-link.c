/* Compile/link proof only; this image is not a board test or installer.
 * Explicit denied permission prevents GPIO activation if it were executed. */
#include "pulse.h"
#include "motion.h"
#include "homing.h"
#include "local_control.h"
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
static LocalModel local;
static LocalResetRecord reset_record;
static LocalCommand local_command;
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
  local_model_reset(&local,(Identity){"link-check","boot","session"},LOCAL_RESET_UNKNOWN,0);
  (void)local_model_reset_record(&local,&reset_record);(void)local_model_reset_history(&local,&reset_record);
  (void)local_model_configure(&local,&profile,(Identity){"edge","boot","session"},0);
  (void)local_model_link_observe(&local,(Identity){"edge","boot","session"},0);
  local_model_fault_signal(&local,LOCAL_FAULT_CONFIGURATION);
  local_model_tick(&local,&profile.identity,&inputs,0);(void)local_model_output(&local);
  (void)local_model_watchdog_feed_eligible(&local,0);
  (void)local_model_recover(&local,&local_command,&home,(MotionPoint){0},&inputs,0);
  (void)local_model_grant_manual(&local,&local_command,0,&inputs,0);
  (void)local_model_move(&local,&local_command,&movement,false,&inputs,0,&limits,&plan);
  (void)local_model_complete(&local,&profile.identity,0,motion.commanded,&inputs,0);
  for (;;) tight_loop_contents();
}
