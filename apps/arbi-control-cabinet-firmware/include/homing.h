#ifndef ARBI_HOMING_H
#define ARBI_HOMING_H
#include "inputs.h"
#include "motion.h"
typedef enum { HOME_BLOCKED, HOME_PRECHECK, HOME_RELEASE, HOME_SEEK, HOME_BACKOFF, HOME_SLOW_SEEK, HOME_COMPLETE, HOME_FAULT } HomePhase;
typedef enum { HOME_NO_OUTPUT, HOME_PLAN, HOME_FINISHED, HOME_REJECTED } HomeResult;
typedef struct {
  unsigned order[4], maximum_axis_steps, backoff_steps, repeatability_steps;
  int approach_direction[4];
  uint32_t axis_timeout_ms, total_timeout_ms;
  double seek_rate_hz, slow_rate_hz, acceleration_hz_per_s;
  char fixture_record[65];
  bool simulation;
} HomePolicy;
typedef struct {
  MotionIdentity identity;
  HomePolicy policy;
  HomePhase phase;
  unsigned order_index, axis_steps;
  int32_t commanded[4], references[4], first_reference, backoff_target;
  uint64_t started_ms, axis_started_ms, phase_started_ms, last_ms, sequence;
  unsigned pending_axis;
  int pending_direction;
  uint8_t previous_directions, pending_directions;
  bool pending, reference_valid[4];
  const char *reason;
} HomeModel;
/* Synthetic state machine only; completion is neither measured HOME nor Ready.
 * No adapter dispatch, profile promotion or Parked assertion is performed. */
bool home_model_restore(HomeModel *model,const MotionProfile *profile,const HomePolicy *policy,uint64_t now_ms);
HomeResult home_model_tick(HomeModel *model,const MotionIdentity *current,const InputsModel *inputs,uint64_t now_ms,const PulseLimits *limits,PulsePlan *plan);
bool home_model_complete_plan(HomeModel *model,uint64_t sequence);
void home_model_inhibit(HomeModel *model,const char *reason);
#endif
