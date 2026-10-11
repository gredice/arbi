#include "motion.h"
#include <limits.h>
#include <math.h>
#include <string.h>
#define PI 3.14159265358979323846264338327950288
static bool finite_value(double n) { return isfinite(n) && fabs(n) <= 1e7; }
static bool integer(double n) { return finite_value(n) && trunc(n) == n && n >= -2147483647.0 && n <= INT32_MAX; }
static bool count_value(double n) { return isfinite(n) && trunc(n) == n && n >= -2147483647.0 && n <= INT32_MAX; }
static bool point_valid(MotionPoint p) { return finite_value(p.x) && finite_value(p.y) && finite_value(p.z); }
static bool id_valid(const char *s) {
  size_t n = 0;
  for (; n < 65 && s[n]; n++) if (!((s[n] >= 'a' && s[n] <= 'z') || (s[n] >= 'A' && s[n] <= 'Z')
    || (s[n] >= '0' && s[n] <= '9') || s[n] == '_' || s[n] == '-' || s[n] == '.')) return false;
  return n > 0 && n < 65;
}
static bool identity_valid(const MotionIdentity *i) {
  return i && id_valid(i->site) && id_valid(i->configuration) && id_valid(i->hardware) && id_valid(i->calibration)
    && id_valid(i->geometry) && id_valid(i->frame) && id_valid(i->binding);
}
static bool identity_equal(const MotionIdentity *a, const MotionIdentity *b) {
  return identity_valid(a) && identity_valid(b) && !strcmp(a->site,b->site) && !strcmp(a->configuration,b->configuration)
    && !strcmp(a->hardware,b->hardware) && !strcmp(a->calibration,b->calibration) && !strcmp(a->geometry,b->geometry)
    && !strcmp(a->frame,b->frame) && !strcmp(a->binding,b->binding);
}
static double mm_step(const MotionAxis *a) { return 2 * PI * a->radius_mm / (a->full_steps * a->microsteps); }
static double distance(MotionPoint a, MotionPoint b) { return hypot(hypot(a.x-b.x,a.y-b.y),a.z-b.z); }
static bool inside(const MotionProfile *p, MotionPoint v) {
  return point_valid(v) && v.x >= p->minimum_mm.x && v.x <= p->maximum_mm.x && v.y >= p->minimum_mm.y
    && v.y <= p->maximum_mm.y && v.z >= p->minimum_mm.z && v.z <= p->maximum_mm.z;
}
bool motion_profile_valid(const MotionProfile *p) {
  if (!p || !identity_valid(&p->identity) || !point_valid(p->minimum_mm) || !point_valid(p->maximum_mm)
    || p->minimum_mm.x >= p->maximum_mm.x || p->minimum_mm.y >= p->maximum_mm.y || p->minimum_mm.z >= p->maximum_mm.z
    || !finite_value(p->maximum_speed_mm_per_s) || p->maximum_speed_mm_per_s <= 0 || p->maximum_speed_mm_per_s > 50
    || !finite_value(p->maximum_acceleration_mm_per_s2) || p->maximum_acceleration_mm_per_s2 <= 0 || p->maximum_acceleration_mm_per_s2 > 100) return false;
  for (unsigned i = 0; i < 4; i++) {
    const MotionAxis *a = &p->axes[i];
    if (!point_valid(p->anchors[i]) || !finite_value(p->offsets_mm[i]) || p->anchors[i].z != p->anchors[0].z
      || !finite_value(a->radius_mm) || a->radius_mm < 1 || a->radius_mm > 1000 || !integer(a->full_steps) || a->full_steps < 1 || a->full_steps > 10000
      || !integer(a->microsteps) || a->microsteps < 1 || a->microsteps > 256 || ((unsigned)a->microsteps & ((unsigned)a->microsteps-1))
      || (a->direction != -1 && a->direction != 1) || !integer(a->home_steps) || !integer(a->minimum_steps) || !integer(a->maximum_steps)
      || a->minimum_steps >= a->maximum_steps || a->home_steps < a->minimum_steps || a->home_steps > a->maximum_steps
      || !finite_value(a->minimum_cable_mm) || !finite_value(a->maximum_cable_mm) || !finite_value(a->home_cable_mm)
      || a->minimum_cable_mm <= 0 || a->minimum_cable_mm >= a->maximum_cable_mm || a->home_cable_mm < a->minimum_cable_mm || a->home_cable_mm > a->maximum_cable_mm
      || !finite_value(a->maximum_rate_hz) || a->maximum_rate_hz <= 0 || a->maximum_rate_hz > 20000
      || !finite_value(a->maximum_acceleration_hz_per_s) || a->maximum_acceleration_hz_per_s < 100 || a->maximum_acceleration_hz_per_s > 2000000) return false;
  }
  MotionPoint a=p->anchors[0], b=p->anchors[1], c=p->anchors[2], d=p->anchors[3];
  return b.x-a.x >= 1 && d.y-a.y >= 1 && b.y == a.y && d.x == a.x && c.x == b.x && c.y == d.y && p->maximum_mm.z < a.z;
}
MotionResult motion_pose_counts(const MotionProfile *p, MotionPoint v, int32_t counts[4], double cables[4]) {
  if (!counts || !cables || !motion_profile_valid(p)) return MOTION_PROFILE;
  if (!inside(p,v)) return MOTION_WORKSPACE;
  int32_t candidate[4]; double lengths[4];
  for (unsigned i=0;i<4;i++) {
    const MotionAxis *a=&p->axes[i]; lengths[i]=distance(p->anchors[i],v)+p->offsets_mm[i];
    double n=a->home_steps+round((lengths[i]-a->home_cable_mm)/mm_step(a))*a->direction;
    if (!finite_value(lengths[i]) || lengths[i]<a->minimum_cable_mm || lengths[i]>a->maximum_cable_mm
      || !count_value(n) || n<a->minimum_steps || n>a->maximum_steps) return MOTION_TRAVEL;
    candidate[i]=(int32_t)n;
  }
  memcpy(counts,candidate,sizeof candidate); memcpy(cables,lengths,sizeof lengths); return MOTION_OK;
}
MotionResult motion_counts_pose(const MotionProfile *p, const int32_t counts[4], MotionPoint *pose, double cables[4]) {
  if (!counts || !pose || !cables || !motion_profile_valid(p)) return MOTION_PROFILE;
  double lengths[4],l[4],tolerance=0;
  for (unsigned i=0;i<4;i++) {
    const MotionAxis *a=&p->axes[i];
    if (counts[i]<a->minimum_steps || counts[i]>a->maximum_steps) return MOTION_TRAVEL;
    lengths[i]=a->home_cable_mm+((double)counts[i]-a->home_steps)*a->direction*mm_step(a);
    if (!finite_value(lengths[i]) || lengths[i]<a->minimum_cable_mm || lengths[i]>a->maximum_cable_mm) return MOTION_TRAVEL;
    l[i]=lengths[i]-p->offsets_mm[i]; if (l[i]<=0) return MOTION_NUMERIC;
    tolerance=fmax(tolerance,4*mm_step(a));
  }
  double width=p->anchors[1].x-p->anchors[0].x, depth=p->anchors[3].y-p->anchors[0].y;
  double x=(l[0]*l[0]-l[1]*l[1]+width*width)/(2*width), y=(l[0]*l[0]-l[3]*l[3]+depth*depth)/(2*depth);
  double squared=l[0]*l[0]-x*x-y*y;
  if (!isfinite(squared) || squared<=0) return MOTION_NUMERIC;
  MotionPoint v={p->anchors[0].x+x,p->anchors[0].y+y,p->anchors[0].z-sqrt(squared)};
  if (!inside(p,v)) return MOTION_WORKSPACE;
  for (unsigned i=0;i<4;i++) if (fabs(distance(p->anchors[i],v)-l[i])>tolerance) return MOTION_NUMERIC;
  *pose=v; memcpy(cables,lengths,sizeof lengths); return MOTION_OK;
}
void motion_inhibit(MotionState *s) { if (s) { s->ready=false; s->active=false; s->prepared=false; memset(&s->pending,0,sizeof s->pending); } }
static MotionResult reconcile(MotionState *s, const MotionIdentity *current) {
  if (!s) return MOTION_NOT_READY;
  if (!identity_equal(&s->profile.identity,current)) { motion_inhibit(s); return MOTION_IDENTITY; }
  return s->ready ? MOTION_OK : MOTION_NOT_READY;
}
MotionResult motion_restore(MotionState *s, const MotionProfile *p, MotionPoint reference) {
  if (!s) return MOTION_PROFILE;
  // A deliberate restore may use the state's existing owned profile.
  MotionProfile input={0}; if (p) input=*p;
  memset(s,0,sizeof *s);
  double cables[4];
  if (!motion_profile_valid(&input)) return MOTION_PROFILE;
  MotionResult r=motion_pose_counts(&input,reference,s->commanded,cables);
  if (r!=MOTION_OK) return r;
  r=motion_counts_pose(&input,s->commanded,&s->estimated_mm,cables);
  if (r!=MOTION_OK) return r;
  s->profile=input; s->ready=true; return MOTION_OK;
}
MotionResult motion_admit(MotionState *s, const MotionRequest *r, const MotionIdentity *current, const PulseLimits *limits) {
  MotionResult result=reconcile(s,current); if (result!=MOTION_OK) return result;
  if (!r || !identity_equal(&r->identity,current)) { motion_inhibit(s); return MOTION_IDENTITY; }
  if (s->prepared || s->active) return MOTION_BUSY;
  if (!r->units || strcmp(r->units,"mm") || !r->frame_name || strcmp(r->frame_name,"site")
    || !finite_value(r->speed_mm_per_s) || r->speed_mm_per_s<=0 || r->speed_mm_per_s>s->profile.maximum_speed_mm_per_s
    || !finite_value(r->acceleration_mm_per_s2) || r->acceleration_mm_per_s2<=0 || r->acceleration_mm_per_s2>s->profile.maximum_acceleration_mm_per_s2
    || !r->maximum_duration_ms || r->maximum_duration_ms>250 || s->sequence==UINT64_MAX) return MOTION_NUMERIC;
  int32_t target[4]; double cables[4];
  result=motion_pose_counts(&s->profile,r->target_mm,target,cables); if (result!=MOTION_OK) return result;
  PulseRequest request={0}; double factor=0,rate=20000,acceleration=2000000;
  for (unsigned i=0;i<4;i++) {
    int64_t delta=(int64_t)target[i]-s->commanded[i];
    if (delta < -PULSE_MAX_STEPS || delta > PULSE_MAX_STEPS) return MOTION_TRAVEL;
    request.steps[i]=(int32_t)delta; factor=fmax(factor,1/mm_step(&s->profile.axes[i]));
    rate=fmin(rate,s->profile.axes[i].maximum_rate_hz); acceleration=fmin(acceleration,s->profile.axes[i].maximum_acceleration_hz_per_s);
  }
  request.maximum_rate_hz=fmin(rate,r->speed_mm_per_s*factor);
  request.acceleration_hz_per_s=fmin(acceleration,r->acceleration_mm_per_s2*factor);
  // Worst axis factor constrains the declared step model. It is not a measured pose velocity.
  uint8_t previous=s->previous_directions;
  if (pulse_plan(&s->pending,&request,limits,previous)!=PULSE_OK) return MOTION_PULSE_LIMIT;
  if (s->pending.duration_ticks>(uint64_t)r->maximum_duration_ms*1000) goto reject;
  // Validate every quantized command in the finite plan before publication.
  int32_t counts[4]; memcpy(counts,s->commanded,sizeof counts); MotionPoint estimated;
  for (unsigned n=0;n<s->pending.count;n++) {
    uint32_t w=s->pending.words[n];
    for (unsigned i=0;i<4;i++) if (w&(1u<<(2*i))) counts[i]+=(w&(1u<<(2*i+1)))?-1:1;
    if (motion_counts_pose(&s->profile,counts,&estimated,cables)!=MOTION_OK) goto reject;
  }
  if (distance(s->estimated_mm,estimated)>r->speed_mm_per_s*s->pending.duration_ticks/1e6) goto reject;
  s->pending.local_sequence=++s->sequence; memcpy(s->target,target,sizeof target); s->prepared=true; return MOTION_OK;
reject:
  memset(&s->pending,0,sizeof s->pending); return MOTION_PULSE_LIMIT;
}
MotionResult motion_begin(MotionState *s, const MotionIdentity *current, PulsePlan *owned) {
  MotionResult r=reconcile(s,current); if (r!=MOTION_OK) return r;
  if (!s->prepared || s->active || !owned) return MOTION_NOT_READY;
  if (!pulse_plan_valid(&s->pending)) { motion_inhibit(s); return MOTION_PULSE_LIMIT; }
  *owned=s->pending; s->prepared=false; s->active=true; return MOTION_OK;
}
MotionResult motion_observe_commanded(MotionState *s, const MotionIdentity *current, const int32_t counts[4]) {
  MotionResult r=reconcile(s,current); if (r!=MOTION_OK) return r;
  if (!s->active || !counts) return MOTION_NOT_READY;
  for (unsigned i=0;i<4;i++) if (s->target[i]>=s->commanded[i] ? counts[i]<s->commanded[i] || counts[i]>s->target[i] : counts[i]>s->commanded[i] || counts[i]<s->target[i]) {
    motion_inhibit(s); return MOTION_TRAVEL;
  }
  MotionPoint estimated; double cables[4];
  r=motion_counts_pose(&s->profile,counts,&estimated,cables);
  if (r!=MOTION_OK) { motion_inhibit(s); return r; }
  memcpy(s->commanded,counts,sizeof s->commanded); s->estimated_mm=estimated; return MOTION_OK;
}
MotionResult motion_complete(MotionState *s, const MotionIdentity *current) {
  if (!s) return MOTION_NOT_READY;
  MotionResult r=motion_observe_commanded(s,current,s->target);
  if (r==MOTION_OK) { s->previous_directions=s->pending.final_directions; s->active=false; }
  return r;
}
void motion_report(const MotionState *s, MotionReport *r) {
  if (!r) return;
  memset(r,0,sizeof *r); r->quality="unavailable";
  if (!s || motion_counts_pose(&s->profile,s->commanded,&r->estimated_mm,r->cable_mm)!=MOTION_OK) return;
  r->identity=s->profile.identity; memcpy(r->commanded,s->commanded,sizeof r->commanded);
  r->ready=s->ready; r->estimate_available=true; r->quality=s->ready?"estimated":"stale";
  // Measured channels and physical acceptance remain false in every model state.
}
