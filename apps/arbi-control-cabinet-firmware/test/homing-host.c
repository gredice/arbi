#include "homing.h"
#include "motion_fixture.h"
#include <assert.h>
#include <stdio.h>
#include <string.h>
static InputsModel inputs;
static HomeModel home;
static PulsePlan plan;
static const PulseLimits limits={1000000,5,10,10,250000,20000,2000000};
static HomePolicy policy(void) {
  HomePolicy p={{0,1,2,3},64,4,2,{1,-1,1,-1},5000,20000,1000,100,10000,"synthetic-homing-59",true};return p;
}
static void samples(uint64_t now,const char *mode) {
  for(unsigned i=0;i<INPUT_CHANNELS;i++) {
    RawInput raw=RAW_INACTIVE;
    if(i<12 && i%3==0) {
      unsigned axis=i/3;int approach=home.commanded[axis]*home.policy.approach_direction[axis];
      raw=approach>=(!strcmp(mode,"initial-active")?-1:3)?RAW_ACTIVE:RAW_INACTIVE;
      if(!strcmp(mode,"implausible") && home.phase==HOME_SLOW_SEEK)raw=approach>=6?RAW_ACTIVE:RAW_INACTIVE;
      if(!strcmp(mode,"stuck-off"))raw=RAW_INACTIVE;
      if(!strcmp(mode,"stuck-on"))raw=RAW_ACTIVE;
    }
    if(!strcmp(mode,"disconnected") && i==1)raw=RAW_DISCONNECTED;
    if(!strcmp(mode,"contradictory") && i==0)raw=RAW_CONTRADICTORY;
    if(!strcmp(mode,"alarm") && i==2 && now>=100)raw=RAW_ACTIVE;
    if(!strcmp(mode,"limit") && i==4 && now>=100)raw=RAW_ACTIVE;
    if(!strcmp(mode,"unavailable") && i==2)raw=RAW_UNAVAILABLE;
    inputs_model_update(&inputs,i,(InputSample){raw,now},now);
  }
}
int main(int argc,char **argv) {
  const char *mode=argc==2?argv[1]:"nominal";HomePolicy p=policy();inputs_model_reset(&inputs);
  assert(!inputs_physical_available(&inputs));bool active=true;assert(inputs_model_read(&inputs,0,0,&active)==INPUT_UNAVAILABLE && !active);
  assert(home_model_restore(&home,&motion_fixture,&p,0));
  if(!strcmp(mode,"debounce")) {
    inputs_model_update(&inputs,0,(InputSample){RAW_ACTIVE,0},0);assert(inputs_model_read(&inputs,0,4,&active)==INPUT_UNSTABLE);
    inputs_model_update(&inputs,0,(InputSample){RAW_ACTIVE,5},5);assert(inputs_model_read(&inputs,0,5,&active)==INPUT_VALID && active);
    assert(inputs_model_read(&inputs,0,106,&active)==INPUT_UNAVAILABLE && !active);
    inputs_model_reset(&inputs);
    for(unsigned n=0;n<10;n++)inputs_model_update(&inputs,0,(InputSample){n%2?RAW_ACTIVE:RAW_INACTIVE,n},n);
    assert(inputs_model_read(&inputs,0,10,&active)==INPUT_FAULT);
    inputs_model_update(&inputs,0,(InputSample){RAW_INACTIVE,1000},1000);assert(inputs_model_read(&inputs,0,1000,&active)==INPUT_FAULT);
    inputs_model_reset(&inputs);inputs_model_update(&inputs,1,(InputSample){RAW_ACTIVE,0},0);
    assert(inputs_model_read(&inputs,1,0,&active)==INPUT_VALID && active);
    inputs_model_update(&inputs,1,(InputSample){RAW_INACTIVE,1},1);assert(inputs_model_read(&inputs,1,1,&active)==INPUT_UNSTABLE);
    inputs_model_update(&inputs,1,(InputSample){RAW_INACTIVE,6},6);assert(inputs_model_read(&inputs,1,6,&active)==INPUT_VALID && !active);
    inputs_model_update(&inputs,1,(InputSample){RAW_INACTIVE,5},6);assert(inputs_model_read(&inputs,1,6,&active)==INPUT_FAULT);
    inputs_model_reset(&inputs);
    inputs_model_update(&inputs,12,(InputSample){RAW_ACTIVE,0},0);inputs_model_update(&inputs,13,(InputSample){RAW_INACTIVE,0},0);
    inputs_model_update(&inputs,12,(InputSample){RAW_ACTIVE,5},5);inputs_model_update(&inputs,13,(InputSample){RAW_INACTIVE,5},5);
    assert(inputs_model_read(&inputs,12,5,&active)==INPUT_VALID && active);
    assert(inputs_model_read(&inputs,13,5,&active)==INPUT_VALID && !active);
    assert(!inputs_physical_available(&inputs));
    puts("{\"debounce\":\"passed\",\"physicalInputs\":false}");return 0;
  }
  if(!strcmp(mode,"policy")) {
    p.simulation=false;assert(!home_model_restore(&home,&motion_fixture,&p,0));assert(home.phase==HOME_BLOCKED);
    p=policy();p.order[1]=0;assert(!home_model_restore(&home,&motion_fixture,&p,0));
    p=policy();p.maximum_axis_steps=1000;assert(!home_model_restore(&home,&motion_fixture,&p,0));
    p=policy();strcpy(p.fixture_record,"unreviewed-real-hardware");assert(!home_model_restore(&home,&motion_fixture,&p,0));
    puts("{\"policy\":\"passed\",\"physicalInputs\":false}");return 0;
  }
  unsigned plans=0;uint64_t now=0;HomeResult result=HOME_NO_OUTPUT;MotionIdentity current=motion_fixture.identity;
  if(!strcmp(mode,"timeout"))home.policy.axis_timeout_ms=100;
  if(!strcmp(mode,"stuck-off") || !strcmp(mode,"stuck-on"))home.policy.maximum_axis_steps=16;
  for(;now<=20000;now+=20) {
    samples(now,mode);
    if(!strcmp(mode,"revision") && now==100)strcpy(current.calibration,"calibration-2");
    if(!strcmp(mode,"stale") && now==100)now+=200;
    result=home_model_tick(&home,&current,&inputs,now,&limits,&plan);
    if(result==HOME_PLAN) {
      assert(pulse_plan_valid(&plan));unsigned total=0;
      for(unsigned i=0;i<4;i++)total+=plan.commanded_steps[i];
      assert(total==1);
      assert(home_model_tick(&home,&current,&inputs,now,&limits,&plan)==HOME_NO_OUTPUT);
      assert(home_model_complete_plan(&home,home.sequence));plans++;
    }
    if(result==HOME_FINISHED || result==HOME_REJECTED)break;
  }
  bool success=!strcmp(mode,"nominal") || !strcmp(mode,"initial-active");
  if(success) {
    assert(result==HOME_FINISHED && home.phase==HOME_COMPLETE);
    for(unsigned i=0;i<4;i++){assert(home.reference_valid[i]);assert(home.references[i]==(!strcmp(mode,"nominal")?3:-1)*p.approach_direction[i]);}
    assert(plans<256);assert(!inputs_physical_available(&inputs));
  } else {
    assert(result==HOME_REJECTED && home.phase==HOME_FAULT);assert(!home.pending);
    for(unsigned i=0;i<4;i++)assert(!home.reference_valid[i]);
    assert(home_model_tick(&home,&motion_fixture.identity,&inputs,now,&limits,&plan)==HOME_REJECTED && plan.count==0);
  }
  printf("{\"phase\":%d,\"reason\":\"%s\",\"plans\":%u,\"elapsedMs\":%llu,\"referenceValid\":%s,\"physicalInputs\":false,\"physicalAcceptance\":false,\"parkedAsserted\":false}\n",
    home.phase,home.reason,plans,(unsigned long long)now,success?"true":"false");return 0;
}
