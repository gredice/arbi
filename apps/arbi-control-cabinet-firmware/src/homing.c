#include "homing.h"
#include <limits.h>
#include <math.h>
#include <stdlib.h>
#include <string.h>
void home_model_inhibit(HomeModel *m,const char *reason) {
  if(!m)return;
  m->phase=HOME_FAULT; m->reason=reason; m->pending=false;
  memset(m->reference_valid,0,sizeof m->reference_valid);
}
static bool identity_equal(const MotionIdentity *a,const MotionIdentity *b) {
  // Identities come from a validated copied profile; bound comparisons also
  // reject nonterminated/incompatible current values without reading past them.
  return b && !strncmp(a->site,b->site,65) && !strncmp(a->configuration,b->configuration,65)
    && !strncmp(a->hardware,b->hardware,65) && !strncmp(a->calibration,b->calibration,65)
    && !strncmp(a->geometry,b->geometry,65) && !strncmp(a->frame,b->frame,65) && !strncmp(a->binding,b->binding,65);
}
bool home_model_restore(HomeModel *m,const MotionProfile *profile,const HomePolicy *p,uint64_t now) {
  if(!m)return false;
  memset(m,0,sizeof *m); m->phase=HOME_BLOCKED; m->reason="MODEL_NOT_ADMITTED";
  if(!motion_profile_valid(profile) || !p || !p->simulation || !memchr(p->fixture_record,0,sizeof p->fixture_record) || strcmp(p->fixture_record,"synthetic-homing-59")
    || p->maximum_axis_steps<8 || p->maximum_axis_steps>128 || p->backoff_steps<2 || p->backoff_steps>16
    || p->repeatability_steps>4 || p->backoff_steps>=p->maximum_axis_steps || p->axis_timeout_ms<100 || p->axis_timeout_ms>5000
    || p->total_timeout_ms<p->axis_timeout_ms || p->total_timeout_ms>20000
    || !isfinite(p->seek_rate_hz) || p->seek_rate_hz<100 || p->seek_rate_hz>1000
    || !isfinite(p->slow_rate_hz) || p->slow_rate_hz<100 || p->slow_rate_hz>p->seek_rate_hz
    || !isfinite(p->acceleration_hz_per_s) || p->acceleration_hz_per_s<10000 || p->acceleration_hz_per_s>100000) return false;
  unsigned mask=0;
  for(unsigned i=0;i<4;i++) {
    if(p->order[i]>=4 || (mask&(1u<<p->order[i])) || (p->approach_direction[i]!=1 && p->approach_direction[i]!=-1)) return false;
    mask|=1u<<p->order[i];
  }
  m->identity=profile->identity; m->policy=*p; m->phase=HOME_PRECHECK; m->reason="SIMULATED_ONLY";
  m->started_ms=now; m->axis_started_ms=now; m->phase_started_ms=now; m->last_ms=now; return true;
}
static void phase(HomeModel *m,HomePhase next,uint64_t now) { m->phase=next; m->phase_started_ms=now; }
HomeResult home_model_tick(HomeModel *m,const MotionIdentity *current,const InputsModel *inputs,uint64_t now,const PulseLimits *limits,PulsePlan *plan) {
  if(plan)memset(plan,0,sizeof *plan);
  if(!m || !plan || !inputs || m->phase==HOME_BLOCKED || m->phase==HOME_FAULT)return HOME_REJECTED;
  if(!identity_equal(&m->identity,current)) { home_model_inhibit(m,"IDENTITY_CHANGED"); return HOME_REJECTED; }
  if(now<m->last_ms || (m->phase!=HOME_COMPLETE && (now-m->started_ms>=m->policy.total_timeout_ms || now-m->axis_started_ms>=m->policy.axis_timeout_ms))) {
    home_model_inhibit(m,"CLOCK_OR_TIMEOUT");return HOME_REJECTED;
  }
  m->last_ms=now;
  bool home[4],stable=true;
  for(unsigned axis=0;axis<4;axis++) {
    bool limit=false,alarm=false;
    InputQuality h=inputs_model_read(inputs,axis*3,now,&home[axis]),l=inputs_model_read(inputs,axis*3+1,now,&limit),a=inputs_model_read(inputs,axis*3+2,now,&alarm);
    if(h==INPUT_FAULT || l==INPUT_FAULT || a==INPUT_FAULT || limit || alarm) { home_model_inhibit(m,"INPUT_FAULT_OR_LIMIT");return HOME_REJECTED; }
    if(h==INPUT_UNAVAILABLE || l==INPUT_UNAVAILABLE || a==INPUT_UNAVAILABLE) { home_model_inhibit(m,"INPUT_UNAVAILABLE");return HOME_REJECTED; }
    stable=stable && h==INPUT_VALID && l==INPUT_VALID && a==INPUT_VALID;
  }
  if(m->phase==HOME_COMPLETE)return HOME_FINISHED;
  if(!stable || m->pending)return HOME_NO_OUTPUT;
  unsigned axis=m->policy.order[m->order_index];int direction=m->policy.approach_direction[axis];
  if(m->phase==HOME_PRECHECK)phase(m,home[axis]?HOME_RELEASE:HOME_SEEK,now);
  if(m->phase==HOME_RELEASE && !home[axis])phase(m,HOME_SEEK,now);
  if(m->phase==HOME_SEEK && home[axis]) {
    m->first_reference=m->commanded[axis];m->backoff_target=m->first_reference-direction*(int)m->policy.backoff_steps;phase(m,HOME_BACKOFF,now);
  }
  if(m->phase==HOME_BACKOFF && m->commanded[axis]==m->backoff_target) {
    if(home[axis]){home_model_inhibit(m,"HOME_STUCK_ACTIVE");return HOME_REJECTED;}
    phase(m,HOME_SLOW_SEEK,now);
  }
  if(m->phase==HOME_SLOW_SEEK && home[axis]) {
    if(abs(m->commanded[axis]-m->first_reference)>(int)m->policy.repeatability_steps){home_model_inhibit(m,"REFERENCE_IMPLAUSIBLE");return HOME_REJECTED;}
    m->references[axis]=m->commanded[axis];m->reference_valid[axis]=true;
    if(++m->order_index==4){phase(m,HOME_COMPLETE,now);m->reason="SIMULATED_REFERENCES_ONLY";return HOME_FINISHED;}
    m->axis_steps=0;m->axis_started_ms=now;phase(m,HOME_PRECHECK,now);return HOME_NO_OUTPUT;
  }
  if(m->axis_steps>=m->policy.maximum_axis_steps || m->sequence==UINT64_MAX) {home_model_inhibit(m,"TRAVEL_OR_SEQUENCE_LIMIT");return HOME_REJECTED;}
  if(m->phase==HOME_RELEASE || m->phase==HOME_BACKOFF)direction=-direction;
  PulseRequest r={0};r.steps[axis]=direction;r.maximum_rate_hz=m->phase==HOME_SLOW_SEEK?m->policy.slow_rate_hz:m->policy.seek_rate_hz;r.acceleration_hz_per_s=m->policy.acceleration_hz_per_s;
  if(pulse_plan(plan,&r,limits,m->previous_directions)!=PULSE_OK){home_model_inhibit(m,"SCHEDULER_REJECTED");return HOME_REJECTED;}
  plan->local_sequence=++m->sequence;m->pending=true;m->pending_axis=axis;m->pending_direction=direction;m->pending_directions=plan->final_directions;
  return HOME_PLAN;
}
bool home_model_complete_plan(HomeModel *m,uint64_t sequence) {
  if(!m || !m->pending || m->phase==HOME_FAULT || sequence!=m->sequence){if(m)home_model_inhibit(m,"COMPLETION_MISMATCH");return false;}
  int64_t next=(int64_t)m->commanded[m->pending_axis]+m->pending_direction;
  if(next<INT32_MIN || next>INT32_MAX){home_model_inhibit(m,"COUNT_OVERFLOW");return false;}
  m->commanded[m->pending_axis]=(int32_t)next;m->axis_steps++;m->pending=false;m->previous_directions=m->pending_directions;return true;
}
