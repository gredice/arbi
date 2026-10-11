#include "local_control.h"
#include <inttypes.h>
#include <limits.h>
#include <stdarg.h>
#include <stdio.h>
#include <string.h>
#ifndef PRIu64
// The pinned ARM compiler's stdint wrapper does not set newlib's 64-bit
// feature guard. Check the actual ABI before supplying its missing macro.
_Static_assert(_Generic((uint64_t)0,unsigned long long:1,default:0),"uint64 format requires an unsigned long long ABI");
#define PRIu64 "llu"
#endif
#define SAFE_TIME UINT64_C(9007199254740991)
static bool id(const char text[65]) {
  for(unsigned i=0;i<65;i++){unsigned char c=(unsigned char)text[i];if(!c)return i>0;
    if(!((c>='A'&&c<='Z')||(c>='a'&&c<='z')||(c>='0'&&c<='9')||(i&&strchr("._:-",c))))return false;}
  return false;
}
static bool endpoint(Identity v){return id(v.device)&&id(v.boot)&&id(v.session);}
static void increment(uint64_t *n){if(*n<UINT64_MAX)(*n)++;}
void diagnostics_reset(DiagnosticRing *r,const char boot[65]) {
  if(!r)return;
  memset(r,0,sizeof *r);if(boot&&id(boot))strcpy(r->boot,boot);
}
bool diagnostics_append(DiagnosticRing *r,const DiagnosticRecord *input) {
  if(!r||!input||!id(r->boot)||input->monotonic_ms>SAFE_TIME||(unsigned)input->kind>DIAG_RESET)return false;
  if(r->next_sequence==UINT64_MAX){increment(&r->dropped);r->exhausted=true;return false;}
  bool priority=input->kind==DIAG_FAULT||input->kind==DIAG_RESET;
  unsigned capacity=priority?DIAGNOSTIC_FAULT_CAPACITY:DIAGNOSTIC_NORMAL_CAPACITY;
  unsigned *head=priority?&r->fault_head:&r->normal_head,*count=priority?&r->fault_count:&r->normal_count;
  DiagnosticRecord *records=priority?r->fault:r->normal;
  if(*count==capacity){uint64_t lost=records[*head].sequence;if(lost>r->dropped_through)r->dropped_through=lost;increment(&r->dropped);*head=(*head+1)%capacity;(*count)--;}
  DiagnosticRecord *out=&records[(*head+*count)%capacity];*out=*input;out->sequence=++r->next_sequence;(*count)++;
  // Caller may report a malformed rejection. Retain a redacted unattributed
  // record instead of serializing unchecked identifiers or private input.
  out->command_available=out->command_available&&id(out->command)&&id(out->correlation)&&endpoint(out->source)&&endpoint(out->target);
  out->identity_available=out->identity_available&&id(out->identity.site)&&id(out->identity.configuration)&&id(out->identity.hardware)
    &&id(out->identity.calibration)&&id(out->identity.geometry)&&id(out->identity.frame)&&id(out->identity.binding);
  return true;
}
bool diagnostics_page(const DiagnosticRing *r,const char boot[65],uint64_t after,DiagnosticPage *p) {
  if(!r||!p||!boot||!id(boot)||!id(r->boot))return false;
  memset(p,0,sizeof *p);p->reset_boundary=strncmp(boot,r->boot,65)!=0;if(p->reset_boundary)after=0;
  if(after>r->next_sequence)return false;
  p->cursor=after;p->dropped=r->dropped;p->dropped_through=r->dropped_through;p->gap=r->exhausted||after<r->dropped_through;
  for(unsigned n=0;n<DIAGNOSTIC_PAGE_CAPACITY;n++) {
    const DiagnosticRecord *best=NULL;
    for(unsigned i=0;i<r->normal_count;i++){const DiagnosticRecord *v=&r->normal[(r->normal_head+i)%DIAGNOSTIC_NORMAL_CAPACITY];if(v->sequence>p->cursor&&(!best||v->sequence<best->sequence))best=v;}
    for(unsigned i=0;i<r->fault_count;i++){const DiagnosticRecord *v=&r->fault[(r->fault_head+i)%DIAGNOSTIC_FAULT_CAPACITY];if(v->sequence>p->cursor&&(!best||v->sequence<best->sequence))best=v;}
    if(!best)break;
    p->records[p->count++]=*best;p->cursor=best->sequence;
  }
  return true;
}
typedef struct {char *data;size_t used;bool ok;} Writer;
static void put(Writer *w,const char *format,...) {
  if(!w->ok)return;
  va_list args;va_start(args,format);int n=vsnprintf(w->data+w->used,DIAGNOSTIC_JSON_BYTES-w->used,format,args);va_end(args);
  if(n<0||(size_t)n>=DIAGNOSTIC_JSON_BYTES-w->used){w->ok=false;w->data[0]=0;return;}w->used+=(size_t)n;
}
static void identity(Writer *w,Identity v){put(w,"{\"deviceId\":\"%s\",\"bootId\":\"%s\",\"sessionId\":\"%s\"}",v.device,v.boot,v.session);}
static bool motion_identity_valid(const MotionIdentity *v) {
  return id(v->site)&&id(v->configuration)&&id(v->hardware)&&id(v->calibration)&&id(v->geometry)&&id(v->frame)&&id(v->binding);
}
static void configuration(Writer *w,const MotionIdentity *v) {
  put(w,"{\"site\":\"%s\",\"configuration\":\"%s\",\"hardware\":\"%s\",\"calibration\":\"%s\",\"geometry\":\"%s\",\"frame\":\"%s\",\"binding\":\"%s\"}",v->site,v->configuration,v->hardware,v->calibration,v->geometry,v->frame,v->binding);
}
size_t diagnostics_record_json(const DiagnosticRecord *r,char out[DIAGNOSTIC_JSON_BYTES]) {
  if(!r||!out||!endpoint(r->target)||r->monotonic_ms>SAFE_TIME||(unsigned)r->kind>DIAG_RESET)return 0;
  static const char *const kinds[]={"accepted","rejected","completed","aborted","fault","reset"};
  bool command=r->command_available&&id(r->command)&&id(r->correlation)&&endpoint(r->source)&&r->deadline_ms<=SAFE_TIME;
  Writer w={out,0,true};put(&w,"{\"version\":\"arbi.mcu-record/1.0\",\"origin\":\"simulated\",\"source\":");identity(&w,r->target);
  put(&w,",\"sequence\":\"%"PRIu64"\",\"monotonicMs\":%"PRIu64",\"kind\":\"%s\",\"reason\":%u,\"faults\":%u,\"configuration\":",r->sequence,r->monotonic_ms,kinds[r->kind],r->reason,r->faults);
  if(r->identity_available&&motion_identity_valid(&r->identity))configuration(&w,&r->identity);else put(&w,"null");
  put(&w,",\"command\":");
  if(command){put(&w,"{\"commandId\":\"%s\",\"correlationId\":\"%s\",\"sequence\":\"%"PRIu64"\",\"fence\":\"%"PRIu64"\",\"expiresMonotonicMs\":%"PRIu64",\"requestSource\":",r->command,r->correlation,r->command_sequence,r->fence,r->deadline_ms);identity(&w,r->source);put(&w,"}");}else put(&w,"null");
  put(&w,"}");return w.ok?w.used:0;
}
size_t diagnostics_outcome(const DiagnosticRecord *r,char out[DIAGNOSTIC_JSON_BYTES]) {
  if(!r||!out||!r->command_available||!r->identity_available||!id(r->command)||!id(r->correlation)||!endpoint(r->source)||!endpoint(r->target)
    ||!id(r->identity.site)||r->monotonic_ms>SAFE_TIME||(unsigned)r->kind>DIAG_ABORTED)return 0;
  static const char *const names[]={"accepted","rejected","completed","failed"};
  Writer w={out,0,true};put(&w,"{\"protocol\":\"arbi/1.0\",\"messageId\":\"mcu-record-%"PRIu64"\",\"realm\":{\"environment\":\"test\",\"namespaceId\":\"synthetic-local-controller\"},\"siteId\":\"%s\",\"source\":",r->sequence,r->identity.site);
  identity(&w,r->target);put(&w,",\"sequence\":\"%"PRIu64"\",\"sourceTime\":{\"utc\":null,\"monotonicMs\":%"PRIu64",\"uncertaintyMs\":null},\"ingestTime\":null,\"kind\":\"event\",\"body\":{\"type\":\"command.outcome\",\"commandId\":\"%s\",\"correlationId\":\"%s\",\"requestSource\":",r->sequence,r->monotonic_ms,r->command,r->correlation);
  identity(&w,r->source);put(&w,",\"outcome\":\"%s\",\"error\":",names[r->kind]);
  static const char *const errors[]={"INVALID_MESSAGE","INVALID_MESSAGE","SEQUENCE_REPLAY","FAULT_INHIBITED","FAULT_INHIBITED","INVALID_RANGE","RESOURCE_LIMIT"};
  if(r->kind==DIAG_REJECTED||r->kind==DIAG_ABORTED)put(&w,"{\"code\":\"%s\",\"retryable\":false}",r->kind==DIAG_ABORTED?"INTERRUPTED":r->reason<sizeof errors/sizeof *errors?errors[r->reason]:"INVALID_MESSAGE");else put(&w,"null");
  put(&w,",\"resourceId\":null},\"executionMode\":\"simulation\"}");return w.ok?w.used:0;
}
size_t diagnostics_snapshot(LocalModel *m,const InputsModel *inputs,uint64_t now,char out[DIAGNOSTIC_JSON_BYTES]) {
  if(!m||!out||!endpoint(m->self)||now>SAFE_TIME||now<m->last_ms)return 0;
  DiagnosticRing *r=&m->diagnostics;
  if(r->snapshot_seen&&(now<r->last_snapshot_ms||now-r->last_snapshot_ms<100)){increment(&r->decimated);return 0;}
  r->snapshot_seen=true;r->last_snapshot_ms=now;Writer w={out,0,true};MotionReport report;motion_report(&m->motion,&report);
  bool available=m->configured&&report.estimate_available;const char *quality=available?(m->motion.ready?"estimated":"stale"):"unavailable";
  put(&w,"{\"version\":\"arbi.mcu-diagnostics/1.0\",\"origin\":\"simulated\",\"source\":");identity(&w,m->self);
  put(&w,",\"sampleMonotonicMs\":%"PRIu64",\"phase\":%u,\"outputRequest\":%u,\"actuationInhibited\":true,\"physicalAcceptance\":false,\"faults\":%u,\"resetCause\":",now,(unsigned)m->phase,(unsigned)local_model_output(m),m->faults);
  static const char *const reset_names[]={"unknown","simulated-power","simulated-watchdog","simulated-brownout"};
  if(m->reset_cause==LOCAL_RESET_UNKNOWN||(unsigned)m->reset_cause>LOCAL_RESET_SIMULATED_BROWNOUT)put(&w,"{\"quality\":\"unavailable\",\"value\":null}");
  else put(&w,"{\"quality\":\"estimated\",\"value\":\"%s\"}",reset_names[m->reset_cause]);
  put(&w,",\"configuration\":");
  if(m->configured) {
    const MotionIdentity *v=&m->motion.profile.identity;
    if(!motion_identity_valid(v))return 0;
    configuration(&w,v);
  } else put(&w,"null");
  put(&w,",\"commandedSteps\":{\"quality\":\"%s\",\"value\":",available?(m->motion.ready?"commanded":"stale"):"unavailable");
  if(available)put(&w,"[%"PRId32",%"PRId32",%"PRId32",%"PRId32"]",report.commanded[0],report.commanded[1],report.commanded[2],report.commanded[3]);else put(&w,"null");
  put(&w,",\"sampleMonotonicMs\":");if(available)put(&w,"%"PRIu64,m->commanded_at_ms);else put(&w,"null");
  put(&w,",\"ageMs\":");if(available&&now>=m->commanded_at_ms)put(&w,"%"PRIu64,now-m->commanded_at_ms);else put(&w,"null");
  put(&w,",\"unit\":\"microstep\"},\"positionMm\":{\"quality\":\"%s\",\"value\":",quality);
  if(available)put(&w,"[%.17g,%.17g,%.17g]",report.estimated_mm.x,report.estimated_mm.y,report.estimated_mm.z);else put(&w,"null");
  put(&w,",\"sampleMonotonicMs\":");if(available)put(&w,"%"PRIu64,m->commanded_at_ms);else put(&w,"null");
  put(&w,",\"ageMs\":");if(available&&now>=m->commanded_at_ms)put(&w,"%"PRIu64,now-m->commanded_at_ms);else put(&w,"null");
  put(&w,",\"unit\":\"mm\",\"frameRevision\":");if(available)put(&w,"\"%s\"",report.identity.frame);else put(&w,"null");
  put(&w,"},\"encoderCounts\":{\"quality\":\"unavailable\",\"value\":null,\"sampleMonotonicMs\":null},\"motorCurrentA\":{\"quality\":\"unavailable\",\"value\":null,\"sampleMonotonicMs\":null},\"lineTensionN\":{\"quality\":\"unavailable\",\"value\":null,\"sampleMonotonicMs\":null},\"inputs\":[");
  for(unsigned i=0;i<INPUT_CHANNELS;i++) {
    bool active=false;InputQuality q=inputs_model_read(inputs,i,now,&active);
    put(&w,"%s{\"channel\":%u,\"realValue\":null,\"realQuality\":\"unavailable\",\"simulatedValue\":",i?",":"",i);
    if(q==INPUT_VALID)put(&w,"%s",active?"true":"false");else put(&w,"null");
    put(&w,",\"simulatedQuality\":\"%s\",\"sampleMonotonicMs\":",q==INPUT_VALID?"estimated":"unavailable");
    if(q==INPUT_VALID)put(&w,"%"PRIu64,inputs->channels[i].last_sample_ms);else put(&w,"null");put(&w,"}");
  }
  put(&w,"],\"activeCommand\":");
  if(m->phase==LOCAL_RUNNING&&id(m->active_command.command_id)&&id(m->active_command.correlation_id))put(&w,"{\"commandId\":\"%s\",\"correlationId\":\"%s\",\"sequence\":\"%"PRIu64"\",\"fence\":\"%"PRIu64"\",\"expiresMonotonicMs\":%"PRIu64"}",m->active_command.command_id,m->active_command.correlation_id,m->active_command.sequence,m->active_command.fence,m->active_command.expires_ms);else put(&w,"null");
  put(&w,",\"counters\":{\"eventSequence\":\"%"PRIu64"\",\"droppedRecords\":\"%"PRIu64"\",\"droppedThrough\":\"%"PRIu64"\",\"decimatedSnapshots\":\"%"PRIu64"\",\"normalQueued\":%u,\"faultQueued\":%u,\"sequenceExhausted\":%s},\"physicalTiming\":{\"maximumFaultResponseMs\":null,\"maximumInterruptDelayUs\":null,\"queueDepth\":null},\"deadlines\":{\"lastOwnerProgressMs\":%"PRIu64",\"lastLinkObservationMs\":",r->next_sequence,r->dropped,r->dropped_through,r->decimated,r->normal_count,r->fault_count,r->exhausted?"true":"false",m->last_loop_ms);
  if(m->link_seen)put(&w,"%"PRIu64,m->last_link_ms);else put(&w,"null");put(&w,",\"manualLeaseExpiresMs\":");if(m->lease_active)put(&w,"%"PRIu64,m->lease_expires_ms);else put(&w,"null");put(&w,"}}");return w.ok?w.used:0;
}
