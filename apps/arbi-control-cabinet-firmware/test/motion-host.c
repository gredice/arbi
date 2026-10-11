#include "motion.h"
#include "motion_fixture.h"
#include <assert.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
static MotionState state;
static PulsePlan owned;
static const PulseLimits limits={1000000,5,10,10,250000,20000,2000000};
static MotionRequest request(MotionPoint target) {
  MotionRequest r={0}; r.identity=motion_fixture.identity; r.target_mm=target; r.units="mm"; r.frame_name="site";
  r.speed_mm_per_s=50; r.acceleration_mm_per_s2=100; r.maximum_duration_ms=250; return r;
}
static void status(void) {
  MotionReport report; motion_report(&state,&report);
  assert(report.estimate_available && !report.measured_position_available && !report.measured_tension_available && !report.physical_acceptance);
  double *cables=report.cable_mm; MotionPoint pose=report.estimated_mm;
  printf("{\"commandedSteps\":[%d,%d,%d,%d],\"estimatedPositionMm\":[%.17g,%.17g,%.17g],\"estimatedCableMm\":[%.17g,%.17g,%.17g,%.17g],\"positionQuality\":\"estimated\",\"lengthQuality\":\"estimated\",\"origin\":\"simulated\",\"configurationDigest\":\"%s\",\"calibrationRevision\":\"%s\",\"modelDigest\":\"%s\",\"measuredPosition\":null,\"measuredTension\":null,\"physicalAcceptance\":false}\n",
    state.commanded[0],state.commanded[1],state.commanded[2],state.commanded[3],pose.x,pose.y,pose.z,cables[0],cables[1],cables[2],cables[3],state.profile.identity.configuration,state.profile.identity.calibration,state.profile.identity.binding);
}
static void lifecycle(void) {
  MotionPoint start={1000,2000,2500},target={1001,2000,2500};
  assert(motion_restore(&state,&motion_fixture,start)==MOTION_OK);
  assert(motion_restore(&state,&state.profile,start)==MOTION_OK);
  MotionRequest r=request(target);
  assert(motion_admit(&state,&r,&r.identity,&limits)==MOTION_OK);
  assert(motion_admit(&state,&r,&r.identity,&limits)==MOTION_BUSY);
  assert(motion_begin(&state,&r.identity,&owned)==MOTION_OK);
  assert(motion_begin(&state,&r.identity,&owned)==MOTION_NOT_READY);
  int32_t counts[4]; memcpy(counts,state.commanded,sizeof counts);
  for (unsigned n=0;n<owned.count;n++) {
    for (unsigned i=0;i<4;i++) if (owned.words[n]&(1u<<(2*i))) counts[i]+=(owned.words[n]&(1u<<(2*i+1)))?-1:1;
    assert(motion_observe_commanded(&state,&r.identity,counts)==MOTION_OK);
  }
  assert(motion_complete(&state,&r.identity)==MOTION_OK);
  assert(motion_complete(&state,&r.identity)==MOTION_NOT_READY);
  // Invalid requests cannot replace the last completed command or publish pulses.
  r.units="m"; assert(motion_admit(&state,&r,&r.identity,&limits)==MOTION_NUMERIC); r.units="mm";
  r.frame_name="bed"; assert(motion_admit(&state,&r,&r.identity,&limits)==MOTION_NUMERIC); r.frame_name="site";
  r.target_mm.x=NAN; assert(motion_admit(&state,&r,&r.identity,&limits)==MOTION_WORKSPACE); r.target_mm=target;
  r.speed_mm_per_s=51; assert(motion_admit(&state,&r,&r.identity,&limits)==MOTION_NUMERIC); r.speed_mm_per_s=50;
  r.acceleration_mm_per_s2=101; assert(motion_admit(&state,&r,&r.identity,&limits)==MOTION_NUMERIC); r.acceleration_mm_per_s2=100;
  r.maximum_duration_ms=251; assert(motion_admit(&state,&r,&r.identity,&limits)==MOTION_NUMERIC); r.maximum_duration_ms=250;
  r.target_mm=(MotionPoint){3000,4000,500}; assert(motion_admit(&state,&r,&r.identity,&limits)==MOTION_TRAVEL);
  assert(!state.prepared && !state.active);
  // Every identity is checked before admission, before start and during progress.
  for (unsigned field=0;field<7;field++) {
    assert(motion_restore(&state,&motion_fixture,start)==MOTION_OK); r=request(target);
    assert(motion_admit(&state,&r,&r.identity,&limits)==MOTION_OK);
    MotionIdentity changed=r.identity;
    char *fields[]={changed.site,changed.configuration,changed.hardware,changed.calibration,changed.geometry,changed.frame,changed.binding};
    fields[field][0]=fields[field][0]=='x'?'y':'x';
    assert(motion_begin(&state,&changed,&owned)==MOTION_IDENTITY);
    assert(!state.ready && !state.prepared && state.pending.count==0);
    MotionReport report; motion_report(&state,&report); assert(!strcmp(report.quality,"stale"));
    assert(motion_admit(&state,&r,&r.identity,&limits)==MOTION_NOT_READY);
    assert(motion_restore(&state,&motion_fixture,start)==MOTION_OK);
    assert(motion_admit(&state,&r,&r.identity,&limits)==MOTION_OK); assert(motion_begin(&state,&r.identity,&owned)==MOTION_OK);
    assert(motion_observe_commanded(&state,&changed,state.commanded)==MOTION_IDENTITY);
    assert(!state.ready);
  }
  assert(motion_restore(&state,&motion_fixture,start)==MOTION_OK); r=request(target);
  assert(motion_admit(&state,&r,&r.identity,&limits)==MOTION_OK); assert(motion_begin(&state,&r.identity,&owned)==MOTION_OK);
  memcpy(counts,state.target,sizeof counts); counts[0]+=1000;
  assert(motion_observe_commanded(&state,&r.identity,counts)==MOTION_TRAVEL); assert(!state.ready);
  // Invalid replacement first discards old intent; restoring readiness is deliberate.
  MotionProfile bad=motion_fixture; bad.axes[0].radius_mm=0;
  assert(motion_restore(&state,&bad,start)==MOTION_PROFILE); assert(!state.ready);
  assert(motion_restore(&state,&motion_fixture,start)==MOTION_OK);
  bad=motion_fixture; bad.anchors[2].z+=1; assert(!motion_profile_valid(&bad));
  bad=motion_fixture; bad.axes[1].microsteps=3; assert(!motion_profile_valid(&bad));
  bad=motion_fixture; bad.axes[0].maximum_steps=1e100; assert(!motion_profile_valid(&bad));
  puts("{\"lifecycle\":\"passed\",\"physicalAcceptance\":false}");
}
int main(int argc,char **argv) {
  if (argc==2 && !strcmp(argv[1],"lifecycle")) { lifecycle(); return 0; }
  if (argc==8 && !strcmp(argv[1],"plan")) {
    MotionPoint start={strtod(argv[2],NULL),strtod(argv[3],NULL),strtod(argv[4],NULL)};
    MotionPoint target={strtod(argv[5],NULL),strtod(argv[6],NULL),strtod(argv[7],NULL)};
    MotionResult result=motion_restore(&state,&motion_fixture,start);
    MotionRequest r=request(target);
    if (result==MOTION_OK) result=motion_admit(&state,&r,&r.identity,&limits);
    if (result!=MOTION_OK) { printf("{\"result\":%d}\n",result); return 0; }
    assert(motion_begin(&state,&r.identity,&owned)==MOTION_OK);
    printf("{\"result\":0,\"durationTicks\":%u,\"target\":[%d,%d,%d,%d],\"initial\":[%d,%d,%d,%d],\"words\":[",owned.duration_ticks,
      state.target[0],state.target[1],state.target[2],state.target[3],state.commanded[0],state.commanded[1],state.commanded[2],state.commanded[3]);
    int32_t counts[4]; memcpy(counts,state.commanded,sizeof counts);
    for (unsigned n=0;n<owned.count;n++) {
      printf("%s%u",n?",":"",owned.words[n]);
      for (unsigned i=0;i<4;i++) if (owned.words[n]&(1u<<(2*i))) counts[i]+=(owned.words[n]&(1u<<(2*i+1)))?-1:1;
      assert(motion_observe_commanded(&state,&r.identity,counts)==MOTION_OK);
    }
    assert(motion_complete(&state,&r.identity)==MOTION_OK); puts("]}"); return 0;
  }
  if (argc!=5) return 2;
  MotionPoint pose={strtod(argv[2],NULL),strtod(argv[3],NULL),strtod(argv[4],NULL)};
  if (!strcmp(argv[1],"pose")) {
    int32_t counts[4]; double cables[4];
    MotionResult result=motion_pose_counts(&motion_fixture,pose,counts,cables);
    if (result!=MOTION_OK) { printf("{\"result\":%d}\n",result); return 0; }
    printf("{\"result\":0,\"counts\":[%d,%d,%d,%d],\"cables\":[%.17g,%.17g,%.17g,%.17g]}\n",counts[0],counts[1],counts[2],counts[3],cables[0],cables[1],cables[2],cables[3]);
  } else if (!strcmp(argv[1],"status")) {
    MotionResult result=motion_restore(&state,&motion_fixture,pose);
    if (result!=MOTION_OK) printf("{\"result\":%d}\n",result); else status();
  } else return 2;
  return 0;
}
