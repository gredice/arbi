#ifndef ARBI_INPUTS_H
#define ARBI_INPUTS_H
#include <stdbool.h>
#include <stdint.h>
#define INPUT_CHANNELS 14
typedef enum { RAW_UNAVAILABLE, RAW_INACTIVE, RAW_ACTIVE, RAW_DISCONNECTED, RAW_CONTRADICTORY } RawInput;
typedef enum { INPUT_UNAVAILABLE, INPUT_UNSTABLE, INPUT_VALID, INPUT_FAULT } InputQuality;
typedef enum { INPUT_HOME, INPUT_LIMIT, INPUT_ALARM, INPUT_DOCK, INPUT_LATCH } InputRole;
typedef struct { RawInput value; uint64_t sample_ms; } InputSample;
typedef struct {
  RawInput raw;
  InputQuality quality;
  InputRole role;
  uint64_t last_sample_ms, changed_ms, window_ms;
  unsigned transitions;
  bool initialized, active;
} InputChannel;
typedef struct { InputChannel channels[INPUT_CHANNELS]; bool simulated_only; } InputsModel;
/* There is deliberately no GPIO, pin, voltage, fitted or reviewed-hardware flag.
 * All physical capabilities remain unavailable. Explicit fixtures may exercise the model. */
void inputs_model_reset(InputsModel *model);
InputQuality inputs_model_update(InputsModel *model, unsigned channel, InputSample sample, uint64_t now_ms);
InputQuality inputs_model_read(const InputsModel *model, unsigned channel, uint64_t now_ms, bool *active);
bool inputs_physical_available(const InputsModel *model);
#endif
