#include "local_control.h"
#include "motion_fixture.h"
#include <assert.h>
#include <pthread.h>
#include <stdio.h>
#include <string.h>
static LocalModel model;
static InputsModel inputs;
static HomeModel home;
static PulsePlan plan;
static const Identity self={"pico-synthetic","boot-1","usb-1"},peer={"edge-synthetic","edge-boot-1","edge-link-1"};
static const PulseLimits limits={1000000,5,10,10,250000,20000,2000000};
static void sample(uint64_t now) {for(unsigned i=0;i<INPUT_CHANNELS;i++)inputs_model_update(&inputs,i,(InputSample){RAW_INACTIVE,now},now);}
static LocalCommand command(unsigned n,uint64_t now) {
  LocalCommand c={0};c.source=peer;c.target=self;c.identity=motion_fixture.identity;
  snprintf(c.command_id,sizeof c.command_id,"command-%u",n);snprintf(c.correlation_id,sizeof c.correlation_id,"correlation-%u",n);
  c.sequence=n;c.fence=model.fence;c.expires_ms=now+250;c.recovery_generation=model.recovery_generation;return c;
}
static void referenced(uint64_t now) {
  // Explicit simulated reference fixture; no physical home or calibration gate.
  memset(&home,0,sizeof home);home.phase=HOME_COMPLETE;home.policy.simulation=true;
  home.identity=motion_fixture.identity;home.last_ms=home.started_ms=now;
  for(unsigned i=0;i<4;i++)home.reference_valid[i]=true;
}
static void prepare(void) {
  local_model_reset(&model,self,LOCAL_RESET_UNKNOWN,0);inputs_model_reset(&inputs);
  assert(model.phase==LOCAL_RECOVERY_REQUIRED&&!model.configured&&local_model_output(&model)==LOCAL_INHIBIT);
  assert(local_model_configure(&model,&motion_fixture,peer,0));sample(0);sample(5);referenced(5);
  assert(local_model_link_observe(&model,peer,5));LocalCommand c=command(1,5);c.fence=1;
  assert(local_model_recover(&model,&c,&home,(MotionPoint){1000,2000,2500},&inputs,5)==LOCAL_ACCEPTED);
  assert(model.phase==LOCAL_IDLE&&!model.faults&&model.simulated_only);
}
static MotionRequest request(void) {
  return (MotionRequest){motion_fixture.identity,{1000.5,2000,2500},"mm","site",10,20,250};
}
static LocalCommand start(bool manual) {
  LocalCommand c=command(manual?3:2,5);MotionRequest r=request();
  assert(local_model_move(&model,&c,&r,manual,&inputs,5,&limits,&plan)==LOCAL_ACCEPTED);
  assert(pulse_plan_valid(&plan));assert(model.phase==LOCAL_RUNNING&&local_model_output(&model)==LOCAL_COMMAND_TRACK);return c;
}
static void *interrupt_load(void *unused) {
  (void)unused;for(unsigned i=0;i<100000;i++)local_model_fault_signal(&model,i%2?LOCAL_FAULT_INPUT:LOCAL_FAULT_SCHEDULER);return NULL;
}
int main(int argc,char **argv) {
  const char *mode=argc==2?argv[1]:"nominal";prepare();
  if(!strcmp(mode,"nominal")) {
    LocalCommand c=start(false);int32_t target[4];memcpy(target,model.motion.target,sizeof target);
    assert(local_model_complete(&model,&c.identity,plan.local_sequence,target,&inputs,10));assert(model.phase==LOCAL_IDLE);
    MotionReport report;motion_report(&model.motion,&report);assert(report.estimate_available&&!report.physical_acceptance&&!report.measured_position_available);
  } else if(!strcmp(mode,"replay")) {
    LocalCommand c=command(2,5);MotionRequest r=request();
    c.fence=0;assert(local_model_move(&model,&c,&r,false,&inputs,5,&limits,&plan)==LOCAL_REJECTED_REPLAY&&plan.count==0);
    c=command(2,5);c.expires_ms=5;assert(local_model_move(&model,&c,&r,false,&inputs,5,&limits,&plan)==LOCAL_REJECTED_ENVELOPE);
    c=command(2,5);strcpy(c.target.boot,"old-boot");assert(local_model_move(&model,&c,&r,false,&inputs,5,&limits,&plan)==LOCAL_REJECTED_ENVELOPE);
    c=command(2,5);strcpy(c.identity.calibration,"old-calibration");assert(local_model_move(&model,&c,&r,false,&inputs,5,&limits,&plan)==LOCAL_REJECTED_ENVELOPE);
    c=command(2,5);c.sequence=1;assert(local_model_move(&model,&c,&r,false,&inputs,5,&limits,&plan)==LOCAL_REJECTED_REPLAY);
    c=start(false);int32_t target[4];memcpy(target,model.motion.target,sizeof target);assert(local_model_complete(&model,&c.identity,plan.local_sequence,target,&inputs,10));
    assert(local_model_move(&model,&c,&r,false,&inputs,10,&limits,&plan)==LOCAL_REJECTED_REPLAY);
    c.sequence=3;c.expires_ms=260;assert(local_model_move(&model,&c,&r,false,&inputs,10,&limits,&plan)==LOCAL_REJECTED_REPLAY);
  } else if(!strcmp(mode,"link")||!strcmp(mode,"lease")||!strcmp(mode,"deadline")) {
    bool manual=!strcmp(mode,"lease");
    if(manual){LocalCommand g=command(2,5);g.expires_ms=105;assert(local_model_grant_manual(&model,&g,105,&inputs,5)==LOCAL_ACCEPTED);}
    LocalCommand c=command(manual?3:2,5);if(manual)c.expires_ms=105;MotionRequest r=request();if(manual){r.maximum_duration_ms=100;r.acceleration_mm_per_s2=100;}
    assert(local_model_move(&model,&c,&r,manual,&inputs,5,&limits,&plan)==LOCAL_ACCEPTED);
    for(uint64_t now=15;now<=(!strcmp(mode,"deadline")?255:105);now+=10) {
      sample(now);if(strcmp(mode,"link"))assert(local_model_link_observe(&model,peer,now));local_model_tick(&model,&c.identity,&inputs,now);
    }
    assert(model.phase==LOCAL_HELD&&(model.faults&(manual?LOCAL_FAULT_LEASE:!strcmp(mode,"link")?LOCAL_FAULT_LINK:LOCAL_FAULT_LEASE)));
    assert(local_model_output(&model)==LOCAL_ABORT_HOLD&&!model.motion.active&&!model.lease_active);
    assert(local_model_link_observe(&model,peer,model.last_ms));assert(model.phase==LOCAL_HELD);
    LocalCommand recovery=command(4,model.last_ms);recovery.fence=model.fence+1;
    assert(local_model_recover(&model,&recovery,&home,(MotionPoint){1000,2000,2500},&inputs,model.last_ms)==LOCAL_REJECTED_REFERENCE);
    referenced(model.last_ms);assert(local_model_recover(&model,&recovery,&home,(MotionPoint){1000,2000,2500},&inputs,model.last_ms)==LOCAL_ACCEPTED);
    c.expires_ms=model.last_ms+100;assert(local_model_move(&model,&c,&r,false,&inputs,model.last_ms,&limits,&plan)==LOCAL_REJECTED_ENVELOPE);
  } else if(!strcmp(mode,"faults")) {
    start(false);pthread_t thread;assert(!pthread_create(&thread,NULL,interrupt_load,NULL));assert(!pthread_join(thread,NULL));
    assert(local_model_output(&model)==LOCAL_INHIBIT);local_model_tick(&model,&motion_fixture.identity,&inputs,10);
    assert(model.phase==LOCAL_FAULT&&(model.faults&LOCAL_FAULT_INPUT)&&(model.faults&LOCAL_FAULT_SCHEDULER));assert(local_model_output(&model)==LOCAL_DISABLE_REQUEST);
    assert(!atomic_load(&model.pending_faults));assert(!model.motion.active);
  } else if(!strcmp(mode,"stall")||!strcmp(mode,"clock")||!strcmp(mode,"revision")||!strcmp(mode,"alarm")||!strcmp(mode,"completion")) {
    LocalCommand c=start(false);MotionIdentity current=c.identity;uint64_t now=10;
    if(!strcmp(mode,"stall"))now=26;
    if(!strcmp(mode,"clock"))now=4;
    if(!strcmp(mode,"revision"))strcpy(current.configuration,"replacement");
    if(!strcmp(mode,"alarm"))inputs_model_update(&inputs,2,(InputSample){RAW_ACTIVE,10},10);
    if(!strcmp(mode,"completion")){int32_t wrong[4];memcpy(wrong,model.motion.commanded,sizeof wrong);assert(!local_model_complete(&model,&current,plan.local_sequence,wrong,&inputs,10));}
    else {
      if(!strcmp(mode,"stall")){assert(local_model_link_observe(&model,peer,now));assert(!local_model_watchdog_feed_eligible(&model,now));}
      local_model_tick(&model,&current,&inputs,now);
    }
    assert(model.phase==LOCAL_FAULT&&local_model_output(&model)==LOCAL_DISABLE_REQUEST&&!model.motion.ready);
  } else if(!strcmp(mode,"capacity")) {
    for(unsigned i=2;i<=LOCAL_COMMAND_CAPACITY;i++){LocalCommand c=command(i,5);assert(local_model_grant_manual(&model,&c,255,&inputs,5)==LOCAL_ACCEPTED);}
    LocalCommand c=command(33,5);assert(local_model_grant_manual(&model,&c,255,&inputs,5)==LOCAL_REJECTED_CAPACITY);assert(model.faults&LOCAL_FAULT_CAPACITY);
  } else if(!strcmp(mode,"reset")) {
    LocalCommand c=start(false);Identity fresh=self;strcpy(fresh.boot,"boot-2");
    local_model_fault_signal(&model,LOCAL_FAULT_SCHEDULER);LocalResetRecord record;assert(local_model_reset_record(&model,&record));
    local_model_reset(&model,fresh,LOCAL_RESET_SIMULATED_BROWNOUT,10);
    assert(local_model_reset_history(&model,&record)&&model.previous_reset_available&&(model.previous_reset.faults&LOCAL_FAULT_SCHEDULER));
    assert(!model.configured&&!model.motion.active&&!model.lease_active&&!model.fence&&model.reset_cause==LOCAL_RESET_SIMULATED_BROWNOUT);
    assert(local_model_output(&model)==LOCAL_INHIBIT);assert(local_model_configure(&model,&motion_fixture,peer,10));
    c.expires_ms=100;MotionRequest r=request();assert(local_model_move(&model,&c,&r,false,&inputs,10,&limits,&plan)==LOCAL_REJECTED_ENVELOPE);
  } else if(!strcmp(mode,"update")) {
    LocalCommand c=command(2,5);
    LocalUpdateEvidence e={.target=self,.record_id="restraint-fixture",.independent_owner="independent-fixture",.sampled_ms=5,
      .simulated=true,.update_safe=true,.outputs_isolated=true,.restraint=true,.line_clearance=true,.stable_power=true};
    e.update_safe=false;assert(local_model_update_begin(&model,&c,&e,5)==LOCAL_UPDATE_PROTECTION);e.update_safe=true;
    e.sampled_ms=6;assert(local_model_update_begin(&model,&c,&e,5)==LOCAL_UPDATE_PROTECTION);e.sampled_ms=5;
    assert(local_model_update_begin(&model,&c,&e,105)==LOCAL_UPDATE_PROTECTION);
    strcpy(c.target.boot,"old-boot");assert(local_model_update_begin(&model,&c,&e,5)==LOCAL_UPDATE_ENVELOPE);c=command(2,5);
    strcpy(e.independent_owner,self.device);assert(local_model_update_begin(&model,&c,&e,5)==LOCAL_UPDATE_PROTECTION);strcpy(e.independent_owner,"independent-fixture");
    strcpy(e.target.boot,"old-boot");assert(local_model_update_begin(&model,&c,&e,5)==LOCAL_UPDATE_PROTECTION);e.target=self;
    local_model_fault_signal(&model,LOCAL_FAULT_INPUT);assert(local_model_update_begin(&model,&c,&e,5)==LOCAL_UPDATE_STATE);prepare();c=command(2,5);
    assert(local_model_update_begin(&model,&c,&e,5)==LOCAL_UPDATE_ACCEPTED);
    assert(model.update_locked&&!model.configured&&!model.motion.ready&&!model.motion.active&&!model.motion.prepared&&!model.lease_active);
    assert(local_model_output(&model)==LOCAL_INHIBIT);
    assert(!local_model_configure(&model,&motion_fixture,peer,5));
    assert(local_model_update_begin(&model,&c,&e,5)==LOCAL_UPDATE_STATE);
    assert(local_model_recover(&model,&c,&home,(MotionPoint){1000,2000,2500},&inputs,5)!=LOCAL_ACCEPTED);
    assert(local_model_grant_manual(&model,&c,255,&inputs,5)!=LOCAL_ACCEPTED);
    MotionRequest r=request();assert(local_model_move(&model,&c,&r,false,&inputs,5,&limits,&plan)!=LOCAL_ACCEPTED&&plan.count==0);
    prepare();LocalCommand lease=command(2,5);assert(local_model_grant_manual(&model,&lease,255,&inputs,5)==LOCAL_ACCEPTED);c=command(3,5);
    assert(local_model_update_begin(&model,&c,&e,5)==LOCAL_UPDATE_LEASE);
    prepare();start(false);c=command(3,5);assert(local_model_update_begin(&model,&c,&e,5)==LOCAL_UPDATE_MOVING);
    assert(local_model_update_begin(&model,&c,&e,255)==LOCAL_UPDATE_MOVING);
    prepare();MotionRequest pending=request();assert(motion_admit(&model.motion,&pending,&motion_fixture.identity,&limits)==MOTION_OK);
    c=command(2,5);assert(local_model_update_begin(&model,&c,&e,5)==LOCAL_UPDATE_MOVING);
    Identity fresh=self;strcpy(fresh.boot,"update-boot");local_model_reset(&model,fresh,LOCAL_RESET_UNKNOWN,5);
    assert(!model.update_locked&&!model.configured&&!model.motion.ready&&!model.lease_active&&local_model_output(&model)==LOCAL_INHIBIT);
    assert(local_model_configure(&model,&motion_fixture,peer,5));assert(local_model_recover(&model,&c,&home,(MotionPoint){1000,2000,2500},&inputs,5)!=LOCAL_ACCEPTED);
  } else if(!strcmp(mode,"idle-loss")) {
    for(uint64_t now=15;now<=105;now+=10){sample(now);local_model_tick(&model,&motion_fixture.identity,&inputs,now);}
    assert(model.phase==LOCAL_HELD&&local_model_output(&model)==LOCAL_INHIBIT);
  } else assert(false);
  puts("{\"sourceModel\":\"passed\",\"physicalResponseMeasured\":false,\"physicalAcceptance\":false}");return 0;
}
