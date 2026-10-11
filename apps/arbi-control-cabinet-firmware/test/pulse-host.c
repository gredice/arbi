#include "pulse.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <pthread.h>
#include <sched.h>
#include <assert.h>

static const PulseLimits limits = {1000000, 5, 10, 10, 250000, 20000, 2000000};
static PulseQueue queue;
static PulsePlan plan, observed;
static void *producer(void *unused) {
  (void)unused;
  PulsePlan next = plan;
  for (unsigned n = 0; n < 10000; n++) {
    next.local_sequence = n;
    while (pulse_queue_put(&queue, &next) == PULSE_QUEUE_FULL) sched_yield();
  }
  return NULL;
}
static void *consumer(void *unused) {
  (void)unused;
  for (unsigned n = 0; n < 10000; n++) {
    while (pulse_queue_take(&queue, &observed) == PULSE_STARVED) sched_yield();
    assert(observed.local_sequence == n); observed.local_sequence = 0;
    assert(!memcmp(&observed, &plan, sizeof plan));
  }
  return NULL;
}
int main(int argc, char **argv) {
  if (argc == 2 && !strcmp(argv[1], "queue")) {
    PulseRequest request = {{5, -3, 0, 1}, 1000, 100000};
    assert(pulse_plan(&plan, &request, &limits, 0) == PULSE_OK);
    pulse_queue_init(&queue);
    assert(pulse_queue_take(&queue, &observed) == PULSE_STARVED);
    for (unsigned i = 0; i < PULSE_QUEUE_CAPACITY; i++) assert(pulse_queue_put(&queue, &plan) == PULSE_OK);
    assert(pulse_queue_put(&queue, &plan) == PULSE_QUEUE_FULL);
    for (unsigned i = 0; i < PULSE_QUEUE_CAPACITY; i++) assert(pulse_queue_take(&queue, &observed) == PULSE_OK);
    assert(pulse_queue_take(&queue, &observed) == PULSE_STARVED);
    pulse_queue_pause(&queue);
    assert(pulse_queue_take(&queue, &observed) == PULSE_PAUSED);
    assert(pulse_queue_put(&queue, &plan) == PULSE_PAUSED);
    pulse_queue_init(&queue);
    // Exercise unsigned head/tail rollover with bounded occupancy.
    atomic_store(&queue.head, UINT32_MAX - 3); atomic_store(&queue.tail, UINT32_MAX - 3);
    pthread_t a, b;
    assert(!pthread_create(&a, NULL, producer, NULL)); assert(!pthread_create(&b, NULL, consumer, NULL));
    assert(!pthread_join(a, NULL)); assert(!pthread_join(b, NULL));
    assert(pulse_queue_take(&queue, &observed) == PULSE_STARVED);
    PulsePlan bad = plan; bad.words[1] |= 0x100;
    assert(!pulse_plan_valid(&bad)); assert(pulse_queue_put(&queue, &bad) == PULSE_INVALID);
    bad = plan; bad.duration_ticks++;
    assert(!pulse_plan_valid(&bad));
    puts("{\"queue\":\"passed\",\"concurrentTransfers\":10000,\"physicalAcceptance\":false}"); return 0;
  }
  if (argc != 8) return 2;
  PulseRequest request = {0};
  for (unsigned i = 0; i < 4; i++) {
    char *end; long value = strtol(argv[i + 1], &end, 10);
    if (*end || value < INT32_MIN || value > INT32_MAX) return 2;
    request.steps[i] = (int32_t)value;
  }
  char *end; request.maximum_rate_hz = strtod(argv[5], &end); if (*end) return 2;
  request.acceleration_hz_per_s = strtod(argv[6], &end); if (*end) return 2;
  unsigned long previous = strtoul(argv[7], &end, 10); if (*end || previous > 255) return 2;
  PulseResult result = pulse_plan(&plan, &request, &limits, (uint8_t)previous);
  printf("{\"result\":%d,\"durationTicks\":%u,\"directions\":%u,\"counts\":[%u,%u,%u,%u],\"words\":[", result, plan.duration_ticks, plan.final_directions,
    plan.commanded_steps[0], plan.commanded_steps[1], plan.commanded_steps[2], plan.commanded_steps[3]);
  for (uint32_t i = 0; i < plan.count; i++) printf("%s%u", i ? "," : "", plan.words[i]);
  printf("],\"valid\":%s,\"physicalAcceptance\":false}\n", pulse_plan_valid(&plan) ? "true" : "false");
  return 0;
}
