#include "local_control.h"
#include <limits.h>
#include <string.h>
_Static_assert(ATOMIC_INT_LOCK_FREE==2,"fault latch requires lock-free atomic words");
static bool id(const char value[65]) {
  for(unsigned i=0;i<65;i++) {
    unsigned char c=(unsigned char)value[i];if(!c)return i>0;
    if(!((c>='a'&&c<='z')||(c>='A'&&c<='Z')||(c>='0'&&c<='9')||(i&&strchr("._:-",c))))return false;
  }
  return false;
}
static bool endpoint(Identity a,Identity b) {return !strncmp(a.device,b.device,65)&&!strncmp(a.boot,b.boot,65)&&!strncmp(a.session,b.session,65);}
static bool endpoint_valid(Identity a) {return id(a.device)&&id(a.boot)&&id(a.session);}
static bool revisions(const MotionIdentity *a,const MotionIdentity *b) {
  return a&&b&&!strncmp(a->site,b->site,65)&&!strncmp(a->configuration,b->configuration,65)
    &&!strncmp(a->hardware,b->hardware,65)&&!strncmp(a->calibration,b->calibration,65)
    &&!strncmp(a->geometry,b->geometry,65)&&!strncmp(a->frame,b->frame,65)&&!strncmp(a->binding,b->binding,65);
}
static void diagnostic(LocalModel *m,const LocalCommand *c,DiagnosticKind kind,unsigned reason,uint64_t now) {
  DiagnosticRecord record={0};record.kind=kind;record.reason=reason;record.monotonic_ms=now;record.target=m->self;record.faults=m->faults;
  if(kind==DIAG_FAULT||kind==DIAG_ABORTED)record.faults|=reason;
  record.identity_available=m->configured;if(m->configured)record.identity=m->motion.profile.identity;
  if(c){record.source=c->source;memcpy(record.command,c->command_id,65);memcpy(record.correlation,c->correlation_id,65);record.command_sequence=c->sequence;record.fence=c->fence;record.deadline_ms=c->expires_ms;record.command_available=true;}
  (void)diagnostics_append(&m->diagnostics,&record);
}
void local_model_reset(LocalModel *m,Identity self,LocalResetCause cause,uint64_t now) {
  if(!m)return;
  memset(m,0,sizeof *m);atomic_init(&m->pending_faults,0);m->self=self;
  m->phase=LOCAL_RECOVERY_REQUIRED;m->output=LOCAL_INHIBIT;m->reset_cause=cause;m->simulated_only=true;
  m->last_ms=m->last_loop_ms=now;m->recovery_generation=1;
  diagnostics_reset(&m->diagnostics,self.boot);diagnostic(m,NULL,DIAG_RESET,(unsigned)cause,now);
}
bool local_model_reset_record(const LocalModel *m,LocalResetRecord *record) {
  if(!m||!record||!id(m->self.boot))return false;
  *record=(LocalResetRecord){0};strcpy(record->boot,m->self.boot);
  record->faults=m->faults|atomic_load_explicit(&m->pending_faults,memory_order_acquire);
  record->last_sequence=m->last_sequence;record->cause=m->reset_cause;return true;
}
bool local_model_reset_history(LocalModel *m,const LocalResetRecord *record) {
  if(!m||!record||m->configured||m->phase!=LOCAL_RECOVERY_REQUIRED||!id(record->boot)||!strncmp(record->boot,m->self.boot,65)
    ||(unsigned)record->cause>LOCAL_RESET_SIMULATED_BROWNOUT)return false;
  m->previous_reset=*record;m->previous_reset_available=true;return true;
}
static void latch(LocalModel *m,unsigned faults,uint64_t now) {
  bool moving=m->phase==LOCAL_RUNNING;
  if(!faults)return;
  if(moving)diagnostic(m,&m->active_command,DIAG_ABORTED,faults,now);
  if((m->faults&faults)!=faults)diagnostic(m,NULL,DIAG_FAULT,faults,now);
  if(!m->faults) {
    if(m->recovery_generation==UINT64_MAX)faults|=LOCAL_FAULT_CAPACITY;
    else m->recovery_generation++;
  }
  if((m->faults&faults)!=faults)m->fault_at_ms=now;
  m->faults|=faults;
  // These are synthetic requested responses, never measured stopping or torque.
  bool severe=(m->faults&(LOCAL_FAULT_INPUT|LOCAL_FAULT_SCHEDULER|LOCAL_FAULT_CONFIGURATION|LOCAL_FAULT_SUPERVISOR|LOCAL_FAULT_CLOCK|LOCAL_FAULT_CAPACITY))!=0;
  if(severe) {m->phase=LOCAL_FAULT;m->output=LOCAL_DISABLE_REQUEST;}
  else {m->phase=LOCAL_HELD;if(moving)m->output=LOCAL_ABORT_HOLD;else if(m->output!=LOCAL_ABORT_HOLD)m->output=LOCAL_INHIBIT;}
  motion_inhibit(&m->motion);m->lease_active=false;m->manual=false;
}
void local_model_fault_signal(LocalModel *m,unsigned faults) {if(m)atomic_fetch_or_explicit(&m->pending_faults,faults,memory_order_release);}
LocalOutput local_model_output(const LocalModel *m) {
  return !m||atomic_load_explicit(&m->pending_faults,memory_order_acquire)?LOCAL_INHIBIT:m->output;
}
bool local_model_watchdog_feed_eligible(const LocalModel *m,uint64_t now) {
  return m&&now>=m->last_loop_ms&&now-m->last_loop_ms<=LOCAL_SUPERVISOR_TIMEOUT_MS
    &&!((m->faults|atomic_load_explicit(&m->pending_faults,memory_order_acquire))&(LOCAL_FAULT_SUPERVISOR|LOCAL_FAULT_CLOCK|LOCAL_FAULT_CAPACITY));
}
static bool inputs_valid(const InputsModel *inputs,uint64_t now) {
  if(!inputs||!inputs->simulated_only)return false;
  for(unsigned i=0;i<12;i++) {
    bool active=false;
    if(inputs_model_read(inputs,i,now,&active)!=INPUT_VALID||(i%3&&active))return false;
  }
  return true;
}
bool local_model_configure(LocalModel *m,const MotionProfile *profile,Identity peer,uint64_t now) {
  if(!m)return false;
  // Copy before invalidating old intent; a caller may pass its owned profile.
  MotionProfile copy={0};bool valid=motion_profile_valid(profile);
  if(valid)copy=*profile;
  latch(m,LOCAL_FAULT_CONFIGURATION,now);m->configured=false;m->link_seen=false;
  if(!valid||!endpoint_valid(m->self)||!endpoint_valid(peer)||now<m->last_ms)return false;
  m->motion.profile=copy;m->peer=peer;m->configured=true;m->last_ms=m->last_loop_ms=now;
  return true;
}
bool local_model_link_observe(LocalModel *m,Identity peer,uint64_t now) {
  if(!m||!m->configured||!endpoint(peer,m->peer)||now<m->last_ms)return false;
  m->link_seen=true;m->last_link_ms=now;return true;
}
void local_model_tick(LocalModel *m,const MotionIdentity *current,const InputsModel *inputs,uint64_t now) {
  if(!m)return;
  unsigned faults=atomic_exchange_explicit(&m->pending_faults,0,memory_order_acq_rel);
  if(now<m->last_ms||now<m->last_loop_ms)faults|=LOCAL_FAULT_CLOCK;
  else if(now-m->last_loop_ms>LOCAL_SUPERVISOR_TIMEOUT_MS)faults|=LOCAL_FAULT_SUPERVISOR;
  if(m->configured&&!revisions(&m->motion.profile.identity,current))faults|=LOCAL_FAULT_CONFIGURATION;
  if(m->phase==LOCAL_IDLE||m->phase==LOCAL_RUNNING) {
    if(!inputs_valid(inputs,now))faults|=LOCAL_FAULT_INPUT;
    if(!m->link_seen||now<m->last_link_ms||now-m->last_link_ms>=LOCAL_LINK_TIMEOUT_MS)faults|=LOCAL_FAULT_LINK;
    if(m->lease_active&&now>=m->lease_expires_ms)faults|=LOCAL_FAULT_LEASE;
    if(m->phase==LOCAL_RUNNING&&now>=m->active_command.expires_ms)faults|=LOCAL_FAULT_LEASE;
  }
  latch(m,faults,now);
  if(now>=m->last_ms)m->last_ms=now;
  if(now>=m->last_loop_ms)m->last_loop_ms=now;
}
static LocalResult result(LocalModel *m,const LocalCommand *c,LocalResult r) {
  if(m){m->last_result=r;if(c){m->last_command=*c;diagnostic(m,c,r==LOCAL_ACCEPTED?DIAG_ACCEPTED:DIAG_REJECTED,(unsigned)r,m->last_ms);}}
  return r;
}
static LocalResult envelope(LocalModel *m,const LocalCommand *c,uint64_t now,uint64_t horizon,bool recovery) {
  if(!m||!c||!id(c->command_id)||!id(c->correlation_id)||!endpoint(c->source,m->peer)||!endpoint(c->target,m->self)
    ||!m->configured||!revisions(&c->identity,&m->motion.profile.identity)||!c->sequence||now<m->last_ms
    ||c->expires_ms<=now||c->expires_ms-now>horizon||c->recovery_generation!=m->recovery_generation)
    return result(m,c,LOCAL_REJECTED_ENVELOPE);
  if((recovery?c->fence<=m->fence:c->fence!=m->fence)||(!recovery&&c->sequence<=m->last_sequence))return result(m,c,LOCAL_REJECTED_REPLAY);
  for(unsigned i=0;i<m->command_count;i++)if(!strcmp(c->command_id,m->command_ids[i]))return result(m,c,LOCAL_REJECTED_REPLAY);
  if(m->command_count==LOCAL_COMMAND_CAPACITY){latch(m,LOCAL_FAULT_CAPACITY,now);return result(m,c,LOCAL_REJECTED_CAPACITY);}
  return LOCAL_ACCEPTED;
}
static void remember(LocalModel *m,const LocalCommand *c) {
  strcpy(m->command_ids[m->command_count++],c->command_id);m->last_sequence=c->sequence;
  result(m,c,LOCAL_ACCEPTED);
}
LocalResult local_model_recover(LocalModel *m,const LocalCommand *c,const HomeModel *home,MotionPoint reference,const InputsModel *inputs,uint64_t now) {
  if(!m)return LOCAL_REJECTED_STATE;
  local_model_tick(m,m->configured?&m->motion.profile.identity:NULL,inputs,now);
  LocalResult r=envelope(m,c,now,LOCAL_LEASE_MAX_MS,true);if(r!=LOCAL_ACCEPTED)return r;
  if(m->phase!=LOCAL_RECOVERY_REQUIRED&&m->phase!=LOCAL_FAULT&&m->phase!=LOCAL_HELD)return result(m,c,LOCAL_REJECTED_STATE);
  if((m->faults&LOCAL_FAULT_CAPACITY)||!home||home->phase!=HOME_COMPLETE||!home->policy.simulation
    ||home->started_ms<m->fault_at_ms||!revisions(&home->identity,&m->motion.profile.identity)||now<home->last_ms||now-home->last_ms>100
    ||!inputs_valid(inputs,now)||!m->link_seen||now<m->last_link_ms||now-m->last_link_ms>=LOCAL_LINK_TIMEOUT_MS
    ||atomic_load_explicit(&m->pending_faults,memory_order_acquire))return result(m,c,LOCAL_REJECTED_REFERENCE);
  for(unsigned i=0;i<4;i++)if(!home->reference_valid[i])return result(m,c,LOCAL_REJECTED_REFERENCE);
  if(motion_restore(&m->motion,&m->motion.profile,reference)!=MOTION_OK)return result(m,c,LOCAL_REJECTED_REFERENCE);
  // Never clears an interrupt that arrived during restoration. The output getter
  // remains inhibited, and the next owner tick latches that fault again.
  m->faults=0;m->fence=c->fence;m->phase=LOCAL_IDLE;m->output=LOCAL_INHIBIT;
  m->commanded_at_ms=now;
  m->lease_active=false;m->manual=false;memset(&m->active_command,0,sizeof m->active_command);remember(m,c);return LOCAL_ACCEPTED;
}
LocalResult local_model_grant_manual(LocalModel *m,const LocalCommand *c,uint64_t expires,const InputsModel *inputs,uint64_t now) {
  if(!m)return LOCAL_REJECTED_STATE;
  local_model_tick(m,m->configured?&m->motion.profile.identity:NULL,inputs,now);
  LocalResult r=envelope(m,c,now,LOCAL_LEASE_MAX_MS,false);if(r!=LOCAL_ACCEPTED)return r;
  if(m->phase!=LOCAL_IDLE||m->faults||atomic_load_explicit(&m->pending_faults,memory_order_acquire)
    ||expires<=now||expires-now>LOCAL_LEASE_MAX_MS||expires>c->expires_ms)return result(m,c,LOCAL_REJECTED_STATE);
  m->lease_active=true;m->lease_expires_ms=expires;remember(m,c);return LOCAL_ACCEPTED;
}
LocalResult local_model_move(LocalModel *m,const LocalCommand *c,const MotionRequest *request,bool manual,const InputsModel *inputs,uint64_t now,const PulseLimits *limits,PulsePlan *plan) {
  if(plan)memset(plan,0,sizeof *plan);
  if(!m)return LOCAL_REJECTED_STATE;
  local_model_tick(m,m->configured?&m->motion.profile.identity:NULL,inputs,now);
  LocalResult r=envelope(m,c,now,LOCAL_TRAJECTORY_MAX_MS,false);if(r!=LOCAL_ACCEPTED)return r;
  if(!plan||!request||m->phase!=LOCAL_IDLE||m->faults||(manual&&(!m->lease_active||now>=m->lease_expires_ms||c->expires_ms>m->lease_expires_ms)))return result(m,c,LOCAL_REJECTED_STATE);
  if(request->maximum_duration_ms>LOCAL_TRAJECTORY_MAX_MS||request->maximum_duration_ms>c->expires_ms-now
    ||motion_admit(&m->motion,request,&c->identity,limits)!=MOTION_OK
    ||motion_begin(&m->motion,&c->identity,plan)!=MOTION_OK)return result(m,c,LOCAL_REJECTED_MOTION);
  if(atomic_load_explicit(&m->pending_faults,memory_order_acquire)){memset(plan,0,sizeof *plan);motion_inhibit(&m->motion);return result(m,c,LOCAL_REJECTED_STATE);}
  m->active_command=*c;m->manual=manual;m->phase=LOCAL_RUNNING;m->output=LOCAL_COMMAND_TRACK;remember(m,c);return LOCAL_ACCEPTED;
}
bool local_model_complete(LocalModel *m,const MotionIdentity *current,uint64_t sequence,const int32_t counts[4],const InputsModel *inputs,uint64_t now) {
  if(!m||!counts)return false;
  local_model_tick(m,current,inputs,now);
  if(now<m->last_ms||now>=m->active_command.expires_ms||m->phase!=LOCAL_RUNNING||m->faults
    ||atomic_load_explicit(&m->pending_faults,memory_order_acquire)||!m->link_seen||now<m->last_link_ms||now-m->last_link_ms>=LOCAL_LINK_TIMEOUT_MS
    ||memcmp(counts,m->motion.target,sizeof m->motion.target)||sequence!=m->motion.pending.local_sequence||!revisions(current,&m->active_command.identity)
    ||motion_observe_commanded(&m->motion,current,counts)!=MOTION_OK||motion_complete(&m->motion,current)!=MOTION_OK) {
    latch(m,LOCAL_FAULT_SCHEDULER,now);return false;
  }
  m->phase=LOCAL_IDLE;m->output=LOCAL_INHIBIT;m->manual=false;m->last_ms=now;m->commanded_at_ms=now;
  diagnostic(m,&m->active_command,DIAG_COMPLETED,0,now);return true;
}
