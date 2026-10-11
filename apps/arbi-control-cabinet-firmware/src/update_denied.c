#include "update_denied.h"
#include "update_layout.h"
#include "pico/stdlib.h"
_Static_assert(PICO_FLASH_SIZE_BYTES==ARBI_FLASH_MODEL_BYTES,"model must match the SDK Pico 2 W capacity");
_Static_assert(ARBI_FLASH_MODEL_IMAGE_BYTES>ARBI_FLASH_MODEL_HEADER_BYTES,"nonempty bounded model image");
_Static_assert(ARBI_FLASH_MODEL_TRIAL_MS<16700,"local model trial budget precedes documented RP2350 window");
bool arbi_update_physical_available(void){return false;}
