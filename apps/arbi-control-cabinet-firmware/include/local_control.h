#ifndef ARBI_LOCAL_CONTROL_H
#define ARBI_LOCAL_CONTROL_H
#include "homing.h"
#include "runtime.h"
#include "diagnostics.h"
#define LOCAL_COMMAND_CAPACITY 32
#define LOCAL_LINK_TIMEOUT_MS 100
#define LOCAL_SUPERVISOR_TIMEOUT_MS 20
#define LOCAL_LEASE_MAX_MS 1000
#define LOCAL_TRAJECTORY_MAX_MS 250
typedef enum { LOCAL_RECOVERY_REQUIRED, LOCAL_IDLE, LOCAL_RUNNING, LOCAL_HELD, LOCAL_FAULT } LocalPhase;
typedef enum { LOCAL_INHIBIT, LOCAL_COMMAND_TRACK, LOCAL_ABORT_HOLD, LOCAL_DISABLE_REQUEST } LocalOutput;
typedef enum { LOCAL_RESET_UNKNOWN, LOCAL_RESET_SIMULATED_POWER, LOCAL_RESET_SIMULATED_WATCHDOG, LOCAL_RESET_SIMULATED_BROWNOUT } LocalResetCause;
typedef enum {
  LOCAL_FAULT_LINK=1u, LOCAL_FAULT_LEASE=2u, LOCAL_FAULT_INPUT=4u,
  LOCAL_FAULT_SCHEDULER=8u, LOCAL_FAULT_CONFIGURATION=16u,
  LOCAL_FAULT_SUPERVISOR=32u, LOCAL_FAULT_CLOCK=64u, LOCAL_FAULT_CAPACITY=128u
} LocalFault;
typedef enum { LOCAL_ACCEPTED, LOCAL_REJECTED_ENVELOPE, LOCAL_REJECTED_REPLAY, LOCAL_REJECTED_STATE, LOCAL_REJECTED_REFERENCE, LOCAL_REJECTED_MOTION, LOCAL_REJECTED_CAPACITY } LocalResult;
typedef struct {
  Identity source, target;
  MotionIdentity identity;
  char command_id[65], correlation_id[65];
  uint64_t sequence, fence, expires_ms, recovery_generation;
} LocalCommand;
typedef struct {char boot[65];unsigned faults;uint64_t last_sequence;LocalResetCause cause;} LocalResetRecord;
typedef struct LocalModel {
  Identity self, peer;
  MotionState motion;
  LocalCommand active_command, last_command;
  char command_ids[LOCAL_COMMAND_CAPACITY][65];
  unsigned command_count, faults;
  atomic_uint pending_faults;
  uint64_t fence, last_sequence, recovery_generation, last_ms, last_loop_ms, last_link_ms, lease_expires_ms, fault_at_ms;
  LocalPhase phase;
  LocalOutput output;
  LocalResetCause reset_cause;
  LocalResult last_result;
  LocalResetRecord previous_reset;
  DiagnosticRing diagnostics;
  uint64_t commanded_at_ms;
  bool previous_reset_available;
  bool configured, link_seen, lease_active, manual, simulated_only;
} LocalModel;
/* Trusted in-process synthetic adapter only. No wire command, GPIO, interrupt
 * installation, physical stop/disable or persistence authority is provided. */
void local_model_reset(LocalModel *model,Identity self,LocalResetCause reset_cause,uint64_t now_ms);
bool local_model_reset_record(const LocalModel *model,LocalResetRecord *record);
bool local_model_reset_history(LocalModel *model,const LocalResetRecord *record);
bool local_model_configure(LocalModel *model,const MotionProfile *profile,Identity peer,uint64_t now_ms);
bool local_model_link_observe(LocalModel *model,Identity peer,uint64_t now_ms);
void local_model_fault_signal(LocalModel *model,unsigned faults);
void local_model_tick(LocalModel *model,const MotionIdentity *current,const InputsModel *inputs,uint64_t now_ms);
LocalOutput local_model_output(const LocalModel *model);
bool local_model_watchdog_feed_eligible(const LocalModel *model,uint64_t now_ms);
LocalResult local_model_recover(LocalModel *model,const LocalCommand *command,const HomeModel *references,MotionPoint synthetic_reference,const InputsModel *inputs,uint64_t now_ms);
LocalResult local_model_grant_manual(LocalModel *model,const LocalCommand *command,uint64_t lease_expires_ms,const InputsModel *inputs,uint64_t now_ms);
LocalResult local_model_move(LocalModel *model,const LocalCommand *command,const MotionRequest *request,bool manual,const InputsModel *inputs,uint64_t now_ms,const PulseLimits *limits,PulsePlan *owned_plan);
bool local_model_complete(LocalModel *model,const MotionIdentity *current,uint64_t local_sequence,const int32_t commanded[4],const InputsModel *inputs,uint64_t now_ms);
#endif
