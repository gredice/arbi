#ifndef ARBI_UPDATE_DENIED_H
#define ARBI_UPDATE_DENIED_H
#include <stdbool.h>
/* The host flash model is not an RP2350 updater, partition table, image
 * signature verifier, output-state interlock or BOOTSEL/SWD rehearsal. */
bool arbi_update_physical_available(void);
#endif
