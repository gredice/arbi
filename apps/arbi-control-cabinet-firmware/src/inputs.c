#include "inputs.h"
#include <string.h>
void inputs_model_reset(InputsModel *m) {
  memset(m,0,sizeof *m); m->simulated_only=true;
  for(unsigned n=0;n<12;n++) m->channels[n].role=(InputRole)(n%3);
  m->channels[12].role=INPUT_DOCK; m->channels[13].role=INPUT_LATCH;
}
InputQuality inputs_model_update(InputsModel *m,unsigned n,InputSample sample,uint64_t now) {
  if(!m || !m->simulated_only || n>=INPUT_CHANNELS) return INPUT_FAULT;
  InputChannel *c=&m->channels[n];
  if(c->quality==INPUT_FAULT) return INPUT_FAULT;
  if((unsigned)sample.value>RAW_CONTRADICTORY || sample.sample_ms>now
    || now-sample.sample_ms>100 || (c->initialized && sample.sample_ms<c->last_sample_ms)
    || sample.value==RAW_DISCONNECTED || sample.value==RAW_CONTRADICTORY) { c->quality=INPUT_FAULT; return INPUT_FAULT; }
  if(sample.value==RAW_UNAVAILABLE) { c->quality=INPUT_UNAVAILABLE; c->initialized=false; c->active=false; return INPUT_UNAVAILABLE; }
  bool first=!c->initialized;
  if(first) { c->initialized=true; c->window_ms=sample.sample_ms; c->changed_ms=sample.sample_ms; c->raw=sample.value; c->quality=INPUT_UNSTABLE; }
  if(sample.sample_ms-c->window_ms>=100) { c->window_ms=sample.sample_ms; c->transitions=0; }
  if(c->raw!=sample.value) {
    c->raw=sample.value; c->changed_ms=sample.sample_ms;
    if(++c->transitions>8) { c->quality=INPUT_FAULT; return INPUT_FAULT; }
    c->quality=INPUT_UNSTABLE;
  }
  bool critical=c->role==INPUT_LIMIT || c->role==INPUT_ALARM;
  // Fixture policy only: critical assertion is immediate, release is debounced.
  // It cannot qualify a real alarm/limit response or cable-failure circuit.
  if((critical && sample.value==RAW_ACTIVE) || sample.sample_ms-c->changed_ms>=5) {
    c->active=sample.value==RAW_ACTIVE; c->quality=INPUT_VALID;
  }
  c->last_sample_ms=sample.sample_ms; return c->quality;
}
InputQuality inputs_model_read(const InputsModel *m,unsigned n,uint64_t now,bool *active) {
  if(active) *active=false;
  if(!m || !m->simulated_only || n>=INPUT_CHANNELS) return INPUT_FAULT;
  const InputChannel *c=&m->channels[n];
  if(c->quality==INPUT_VALID && (now<c->last_sample_ms || now-c->last_sample_ms>100)) return INPUT_UNAVAILABLE;
  if(active && c->quality==INPUT_VALID) *active=c->active;
  return c->quality;
}
bool inputs_physical_available(const InputsModel *m) { (void)m; return false; }
