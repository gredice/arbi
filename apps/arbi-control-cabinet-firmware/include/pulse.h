#ifndef ARBI_PULSE_H
#define ARBI_PULSE_H
#include <stdbool.h>
#include <stdint.h>
#include <stdatomic.h>
#define PULSE_AXES 4
#define PULSE_MAX_STEPS 512
#define PULSE_MAX_WORDS (PULSE_MAX_STEPS + 2)
#define PULSE_QUEUE_CAPACITY 8
#define PULSE_HIGH_TICKS 5
#define PULSE_WORD_CYCLES 9
typedef struct {
  uint32_t tick_hz, minimum_low_ticks, direction_setup_ticks, direction_hold_ticks, maximum_duration_ticks;
  double maximum_rate_hz, maximum_acceleration_hz_per_s;
} PulseLimits;
typedef struct { int32_t steps[PULSE_AXES]; double maximum_rate_hz, acceleration_hz_per_s; } PulseRequest;
typedef struct {
  uint64_t local_sequence;
  uint32_t words[PULSE_MAX_WORDS], count, duration_ticks;
  uint32_t commanded_steps[PULSE_AXES];
  uint8_t final_directions;
} PulsePlan;
typedef enum { PULSE_OK, PULSE_INVALID, PULSE_TOO_LARGE, PULSE_LIMIT, PULSE_QUEUE_FULL, PULSE_STARVED, PULSE_PAUSED } PulseResult;
typedef struct {
  PulsePlan slots[PULSE_QUEUE_CAPACITY];
  atomic_uint head, tail;
  atomic_bool pause_requested;
} PulseQueue;
PulseResult pulse_plan(PulsePlan *plan, const PulseRequest *request, const PulseLimits *limits, uint8_t previous_directions);
bool pulse_plan_valid(const PulsePlan *plan);
void pulse_queue_init(PulseQueue *queue);
/* Exactly one producer owns put; exactly one consumer owns take. */
PulseResult pulse_queue_put(PulseQueue *queue, const PulsePlan *plan);
PulseResult pulse_queue_take(PulseQueue *queue, PulsePlan *plan);
void pulse_queue_pause(PulseQueue *queue);
/* Pause remains latched; deliberate reset discards old queued intent. */
#endif
