#include "local_control.h"
#include "motion_fixture.h"
#include <assert.h>
#include <stdio.h>
#include <string.h>
static LocalModel model;
static InputsModel inputs;
static DiagnosticPage page;
static DiagnosticRecord record;
static PulsePlan plan;
static char output[DIAGNOSTIC_JSON_BYTES];
static const Identity self={"pico-synthetic","boot-1","usb-1"},peer={"edge-synthetic","edge-boot-1","edge-link-1"};
static const PulseLimits limits={1000000,5,10,10,250000,20000,2000000};
static void print_record(const DiagnosticRecord *v,bool *first) {
  assert(diagnostics_record_json(v,output));printf("%s{\"record\":%s,\"protocolOutcome\":",*first?"":",",output);*first=false;
  if(diagnostics_outcome(v,output))fputs(output,stdout);else fputs("null",stdout);putchar('}');
}
int main(int argc,char **argv) {
  const char *mode=argc==2?argv[1]:"snapshot";static const char previous_boot[65]="previous-boot";local_model_reset(&model,self,LOCAL_RESET_UNKNOWN,0);inputs_model_reset(&inputs);
  if(!strcmp(mode,"ring")) {
    record=(DiagnosticRecord){.target=self,.monotonic_ms=1,.kind=DIAG_FAULT};assert(diagnostics_append(&model.diagnostics,&record));
    for(unsigned i=0;i<10000;i++){record.kind=DIAG_REJECTED;record.monotonic_ms=i+2;assert(diagnostics_append(&model.diagnostics,&record));}
    assert(model.diagnostics.normal_count==16&&model.diagnostics.fault_count==2&&model.diagnostics.dropped==9984);
    assert(diagnostics_page(&model.diagnostics,self.boot,0,&page)&&page.gap&&page.records[0].kind==DIAG_RESET&&page.records[1].kind==DIAG_FAULT);
    unsigned count=0;uint64_t cursor=0;
    do{assert(diagnostics_page(&model.diagnostics,self.boot,cursor,&page));for(unsigned i=0;i<page.count;i++){assert(page.records[i].sequence>cursor);cursor=page.records[i].sequence;count++;}}while(page.count);
    assert(count==18);assert(!diagnostics_page(&model.diagnostics,self.boot,model.diagnostics.next_sequence+1,&page));
    assert(diagnostics_page(&model.diagnostics,previous_boot,123,&page)&&page.reset_boundary&&page.gap);
    for(unsigned i=0;i<10;i++){record.kind=DIAG_FAULT;assert(diagnostics_append(&model.diagnostics,&record));}
    assert(model.diagnostics.fault_count==4&&model.diagnostics.dropped==9992);
    model.diagnostics.next_sequence=UINT64_MAX;assert(!diagnostics_append(&model.diagnostics,&record)&&model.diagnostics.exhausted);
    assert(diagnostics_page(&model.diagnostics,self.boot,UINT64_MAX,&page)&&page.gap);
    assert(sizeof model<65536);
    printf("{\"normalCapacity\":16,\"faultCapacity\":4,\"gap\":true,\"resetBoundary\":true,\"memoryBytes\":%zu}\n",sizeof model);return 0;
  }
  if(!strcmp(mode,"redaction")) {
    record=(DiagnosticRecord){.target=self,.source=peer,.identity=motion_fixture.identity,.identity_available=true,.command_available=true,.kind=DIAG_REJECTED};
    memset(record.command,'x',sizeof record.command);strcpy(record.correlation,"secret\"payload");assert(diagnostics_append(&model.diagnostics,&record));
    assert(diagnostics_page(&model.diagnostics,self.boot,1,&page));assert(!page.records[0].command_available);assert(!diagnostics_outcome(&page.records[0],output));
    assert(diagnostics_record_json(&page.records[0],output));puts(output);return 0;
  }
  if(!strcmp(mode,"unconfigured")){assert(diagnostics_snapshot(&model,&inputs,0,output));puts(output);return 0;}
  assert(local_model_configure(&model,&motion_fixture,peer,0));
  for(unsigned i=0;i<INPUT_CHANNELS;i++){inputs_model_update(&inputs,i,(InputSample){RAW_INACTIVE,0},0);inputs_model_update(&inputs,i,(InputSample){RAW_INACTIVE,5},5);}
  HomeModel home={0};home.phase=HOME_COMPLETE;home.policy.simulation=true;home.identity=motion_fixture.identity;home.last_ms=home.started_ms=5;for(unsigned i=0;i<4;i++)home.reference_valid[i]=true;
  LocalCommand c={.source=peer,.target=self,.identity=motion_fixture.identity,.command_id="recover-1",.correlation_id="correlation-1",.sequence=1,.fence=1,.expires_ms=255,.recovery_generation=model.recovery_generation};
  assert(local_model_link_observe(&model,peer,5));assert(local_model_recover(&model,&c,&home,(MotionPoint){1000,2000,2500},&inputs,5)==LOCAL_ACCEPTED);
  if(!strcmp(mode,"outcomes")) {
    c.sequence=2;strcpy(c.command_id,"move-2");strcpy(c.correlation_id,"correlation-2");MotionRequest move={motion_fixture.identity,{1000.5,2000,2500},"mm","site",10,20,250};
    assert(local_model_move(&model,&c,&move,false,&inputs,5,&limits,&plan)==LOCAL_ACCEPTED);
    int32_t target[4];memcpy(target,model.motion.target,sizeof target);assert(local_model_complete(&model,&c.identity,plan.local_sequence,target,&inputs,10));
    assert(local_model_move(&model,&c,&move,false,&inputs,10,&limits,&plan)==LOCAL_REJECTED_REPLAY);
    c.sequence=3;strcpy(c.command_id,"move-3");strcpy(c.correlation_id,"correlation-3");c.expires_ms=260;move.target_mm.x=1001;
    assert(local_model_move(&model,&c,&move,false,&inputs,10,&limits,&plan)==LOCAL_ACCEPTED);
    local_model_fault_signal(&model,LOCAL_FAULT_INPUT);assert(local_model_output(&model)==LOCAL_INHIBIT);local_model_tick(&model,&c.identity,&inputs,15);
    strcpy(model.motion.profile.identity.calibration,"calibration-2");
    putchar('[');bool first=true;uint64_t cursor=0;
    do{assert(diagnostics_page(&model.diagnostics,self.boot,cursor,&page));for(unsigned i=0;i<page.count;i++)print_record(&page.records[i],&first);cursor=page.cursor;}while(page.count);
    puts("]");return 0;
  }
  assert(diagnostics_snapshot(&model,&inputs,5,output));if(!strcmp(mode,"stale")){local_model_fault_signal(&model,LOCAL_FAULT_LINK);local_model_tick(&model,&c.identity,&inputs,10);assert(diagnostics_snapshot(&model,&inputs,205,output));}
  else {assert(!diagnostics_snapshot(&model,&inputs,6,output));assert(model.diagnostics.decimated==1);assert(diagnostics_snapshot(&model,&inputs,105,output));}
  puts(output);return 0;
}
