#ifndef ARBI_MOTION_H
#define ARBI_MOTION_H
#include "pulse.h"
typedef struct { double x, y, z; } MotionPoint;
typedef struct {
  char site[65], configuration[65], hardware[65], calibration[65], geometry[65], frame[65], binding[65];
} MotionIdentity;
typedef struct {
  double radius_mm, full_steps, microsteps, direction, home_cable_mm, home_steps;
  double minimum_cable_mm, maximum_cable_mm, minimum_steps, maximum_steps, maximum_rate_hz, maximum_acceleration_hz_per_s;
} MotionAxis;
typedef struct {
  MotionIdentity identity;
  MotionPoint anchors[4], minimum_mm, maximum_mm;
  double offsets_mm[4], maximum_speed_mm_per_s, maximum_acceleration_mm_per_s2;
  MotionAxis axes[4];
} MotionProfile;
typedef enum { MOTION_OK, MOTION_PROFILE, MOTION_IDENTITY, MOTION_WORKSPACE, MOTION_TRAVEL, MOTION_NUMERIC, MOTION_BUSY, MOTION_NOT_READY, MOTION_PULSE_LIMIT } MotionResult;
typedef struct {
  MotionIdentity identity;
  MotionPoint target_mm;
  const char *units, *frame_name;
  double speed_mm_per_s, acceleration_mm_per_s2;
  uint32_t maximum_duration_ms;
} MotionRequest;
typedef struct {
  MotionProfile profile; PulsePlan pending;
  MotionPoint estimated_mm;
  int32_t commanded[4], target[4];
  uint64_t sequence;
  uint8_t previous_directions;
  bool ready, active, prepared;
} MotionState;
typedef struct {
  MotionIdentity identity; MotionPoint estimated_mm; int32_t commanded[4]; double cable_mm[4];
  const char *quality;
  bool ready, estimate_available, measured_position_available, measured_tension_available, physical_acceptance;
} MotionReport;
bool motion_profile_valid(const MotionProfile *profile);
MotionResult motion_pose_counts(const MotionProfile *profile, MotionPoint pose, int32_t counts[4], double cables_mm[4]);
MotionResult motion_counts_pose(const MotionProfile *profile, const int32_t counts[4], MotionPoint *pose, double cables_mm[4]);
/* Caller supplies a trusted immutable profile and deliberate simulated reference.
 * These functions never provide authentication, provisioning or physical readiness. */
MotionResult motion_restore(MotionState *state, const MotionProfile *profile, MotionPoint reference_mm);
MotionResult motion_admit(MotionState *state, const MotionRequest *request, const MotionIdentity *current, const PulseLimits *limits);
MotionResult motion_begin(MotionState *state, const MotionIdentity *current, PulsePlan *owned_plan);
MotionResult motion_observe_commanded(MotionState *state, const MotionIdentity *current, const int32_t counts[4]);
MotionResult motion_complete(MotionState *state, const MotionIdentity *current);
void motion_inhibit(MotionState *state);
void motion_report(const MotionState *state, MotionReport *report);
#endif
