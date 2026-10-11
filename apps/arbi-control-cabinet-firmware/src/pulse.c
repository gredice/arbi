#include "pulse.h"
#include <limits.h>
#include <math.h>
#include <string.h>

_Static_assert((PULSE_QUEUE_CAPACITY & (PULSE_QUEUE_CAPACITY - 1)) == 0, "queue capacity must be a power of two");
_Static_assert(ATOMIC_INT_LOCK_FREE == 2, "control queue requires lock-free counters");
static bool limits_valid(const PulseLimits *l) {
  // The assembled engine uses one-microsecond ticks and a five-tick high pulse.
  // These are explicit isolated fixture limits, not CL57Y electrical acceptance.
  return l && l->tick_hz == 1000000 && l->minimum_low_ticks >= 5 && l->minimum_low_ticks <= 1000
    && l->direction_setup_ticks >= 10 && l->direction_setup_ticks <= 1000
    && l->direction_hold_ticks >= 10 && l->direction_hold_ticks <= 1000
    && l->maximum_duration_ticks > 0 && l->maximum_duration_ticks <= 250000
    && isfinite(l->maximum_rate_hz) && l->maximum_rate_hz > 0 && l->maximum_rate_hz <= 20000
    && isfinite(l->maximum_acceleration_hz_per_s) && l->maximum_acceleration_hz_per_s >= 100 && l->maximum_acceleration_hz_per_s <= 2000000;
}
static PulseResult word(PulsePlan *p, uint8_t high, uint8_t low, uint32_t interval, const PulseLimits *limits) {
  if (p->count == PULSE_MAX_WORDS) return PULSE_TOO_LARGE;
  if (interval < PULSE_WORD_CYCLES || interval - PULSE_WORD_CYCLES > UINT16_MAX) return PULSE_LIMIT;
  if (p->duration_ticks > limits->maximum_duration_ticks || interval > limits->maximum_duration_ticks - p->duration_ticks) return PULSE_LIMIT;
  p->words[p->count++] = (interval - PULSE_WORD_CYCLES) << 16 | (uint32_t)low << 8 | high;
  p->duration_ticks += interval; return PULSE_OK;
}
PulseResult pulse_plan(PulsePlan *p, const PulseRequest *r, const PulseLimits *l, uint8_t previous) {
  if (!p) return PULSE_INVALID;
  memset(p, 0, sizeof *p);
  if (!r || !limits_valid(l) || (previous & 0x55) || !isfinite(r->maximum_rate_hz) || !isfinite(r->acceleration_hz_per_s)
    || r->maximum_rate_hz <= 0 || r->maximum_rate_hz > l->maximum_rate_hz
    || r->acceleration_hz_per_s < 100 || r->acceleration_hz_per_s > l->maximum_acceleration_hz_per_s) return PULSE_INVALID;
  uint32_t counts[4], maximum = 0, accumulators[4] = {0}; uint8_t directions = previous;
  for (unsigned axis = 0; axis < 4; axis++) {
    if (r->steps[axis] == INT32_MIN) return PULSE_INVALID;
    counts[axis] = (uint32_t)(r->steps[axis] < 0 ? -r->steps[axis] : r->steps[axis]);
    if (counts[axis] > PULSE_MAX_STEPS) return PULSE_TOO_LARGE;
    if (counts[axis] > maximum) maximum = counts[axis];
    if (counts[axis]) {
      uint8_t bit = (uint8_t)(1u << (2 * axis + 1));
      directions = r->steps[axis] < 0 ? directions | bit : directions & (uint8_t)~bit;
    }
  }
  uint32_t guard = l->direction_setup_ticks > l->direction_hold_ticks ? l->direction_setup_ticks : l->direction_hold_ticks;
  PulseResult result = word(p, directions, directions, guard, l);
  if (result != PULSE_OK) goto reject;
  for (uint32_t n = 0; n < maximum; n++) {
    uint8_t high = directions;
    for (unsigned axis = 0; axis < 4; axis++) {
      accumulators[axis] += counts[axis];
      if (accumulators[axis] >= maximum) {
        accumulators[axis] -= maximum; high |= (uint8_t)(1u << (2 * axis)); p->commanded_steps[axis]++;
      }
    }
    // Symmetric per-slot acceleration/deceleration envelope in commanded steps.
    // This is a discrete model; it does not establish mechanical acceleration.
    double start = sqrt(2 * r->acceleration_hz_per_s * (n + 1));
    double finish = sqrt(2 * r->acceleration_hz_per_s * (maximum - n));
    double rate = fmin(r->maximum_rate_hz, fmin(start, finish));
    double ticks = ceil(l->tick_hz / rate);
    uint32_t low_bound = PULSE_HIGH_TICKS + l->minimum_low_ticks;
    if (!isfinite(ticks) || ticks > UINT32_MAX || ticks < low_bound) { result = PULSE_LIMIT; goto reject; }
    result = word(p, high, directions, (uint32_t)ticks, l);
    if (result != PULSE_OK) goto reject;
  }
  result = word(p, directions, directions, guard, l);
  if (result != PULSE_OK) goto reject;
  p->final_directions = directions; return PULSE_OK;
reject:
  memset(p, 0, sizeof *p); return result;
}
void pulse_queue_init(PulseQueue *q) {
  atomic_init(&q->head, 0); atomic_init(&q->tail, 0); atomic_init(&q->pause_requested, false);
}
bool pulse_plan_valid(const PulsePlan *p) {
  if (!p || p->count < 2 || p->count > PULSE_MAX_WORDS || (p->final_directions & 0x55)) return false;
  uint32_t duration = 0, counts[4] = {0};
  for (uint32_t i = 0; i < p->count; i++) {
    uint32_t w = p->words[i], interval = (w >> 16) + PULSE_WORD_CYCLES;
    uint8_t high = (uint8_t)w, low = (uint8_t)(w >> 8);
    if (low != p->final_directions || (high & 0xaa) != low || interval < 10) return false;
    if ((i == 0 || i == p->count - 1) && (high & 0x55)) return false;
    if (duration > 250000 || interval > 250000 - duration) return false;
    duration += interval;
    for (unsigned axis = 0; axis < 4; axis++) if (high & (1u << (2 * axis))) counts[axis]++;
  }
  return duration == p->duration_ticks && !memcmp(counts, p->commanded_steps, sizeof counts);
}
PulseResult pulse_queue_put(PulseQueue *q, const PulsePlan *p) {
  if (!pulse_plan_valid(p)) return PULSE_INVALID;
  if (atomic_load_explicit(&q->pause_requested, memory_order_acquire)) return PULSE_PAUSED;
  unsigned head = atomic_load_explicit(&q->head, memory_order_relaxed);
  unsigned tail = atomic_load_explicit(&q->tail, memory_order_acquire);
  if (head - tail == PULSE_QUEUE_CAPACITY) return PULSE_QUEUE_FULL;
  q->slots[head & (PULSE_QUEUE_CAPACITY - 1)] = *p;
  atomic_store_explicit(&q->head, head + 1, memory_order_release); return PULSE_OK;
}
PulseResult pulse_queue_take(PulseQueue *q, PulsePlan *p) {
  if (atomic_load_explicit(&q->pause_requested, memory_order_acquire)) return PULSE_PAUSED;
  unsigned tail = atomic_load_explicit(&q->tail, memory_order_relaxed);
  unsigned head = atomic_load_explicit(&q->head, memory_order_acquire);
  if (head == tail) return PULSE_STARVED;
  *p = q->slots[tail & (PULSE_QUEUE_CAPACITY - 1)];
  atomic_store_explicit(&q->tail, tail + 1, memory_order_release); return PULSE_OK;
}
void pulse_queue_pause(PulseQueue *q) { atomic_store_explicit(&q->pause_requested, true, memory_order_release); }
