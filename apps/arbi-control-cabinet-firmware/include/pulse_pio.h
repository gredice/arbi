#ifndef ARBI_PULSE_PIO_H
#define ARBI_PULSE_PIO_H
#include "pulse.h"
typedef struct {
  bool isolated_unloaded_fixture, interface_reviewed, timing_measured;
  const char *procedure_id, *wiring_revision, *timing_record;
} PulseBenchPermission;
/* No network/USB command reaches this API. Ordinary builds always deny start. */
bool pulse_pio_initialize(const PulseBenchPermission *permission);
bool pulse_pio_start(const PulsePlan *plan);
bool pulse_pio_completed(void);
/* Pause/abort finishes this finite segment and inhibits another segment.
 * Immediate independent stopping remains the separate physical authority. */
void pulse_pio_pause(void);
#endif
