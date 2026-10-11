#include "runtime.h"
#include "pico/stdlib.h"
#include "pico/stdio_usb.h"
#include "pico/unique_id.h"
#include "pico/rand.h"
#include "hardware/watchdog.h"
#include <stdio.h>
#include <string.h>

static Runtime runtime;
static char response[ARBI_RESPONSE_BYTES];
static void fresh_link(void) {
  Identity self = {0}; unsigned char nonce[16];
  pico_get_unique_board_id_string(self.device, sizeof self.device);
  // Random epochs are identification, not credentials. No secret is derived here.
  static char boot[65];
  if (!boot[0]) {
    snprintf(boot, sizeof boot, "boot-%08lx%08lx%08lx%08lx", (unsigned long)get_rand_32(), (unsigned long)get_rand_32(), (unsigned long)get_rand_32(), (unsigned long)get_rand_32());
  }
  strcpy(self.boot, boot);
  for (size_t i = 0; i < 16; i += 4) { uint32_t random = get_rand_32(); memcpy(nonce + i, &random, 4); }
  static const char hex[] = "0123456789abcdef";
  for (size_t i = 0; i < 16; i++) { self.session[2*i] = hex[nonce[i] >> 4]; self.session[2*i+1] = hex[nonce[i] & 15]; }
  arbi_reset(&runtime, self, nonce);
  // No provisioning adapter or admitted physical profile exists in this build.
  // USB traffic cannot call arbi_enroll or install configuration/key material.
}
int main(void) {
  stdio_init_all(); fresh_link(); watchdog_enable(2000, true);
  bool connected = false; uint64_t last_status = 0;
  for (;;) {
    uint64_t now = time_us_64() / 1000;
    bool current = stdio_usb_connected();
    if (current != connected) { fresh_link(); connected = current; last_status = 0; }
    arbi_tick(&runtime, now);
    if (connected) {
      // Consume at most 256 bytes per tick; output at most one diagnostic/second.
      for (unsigned i = 0; i < 256; i++) {
        int byte = getchar_timeout_us(0);
        if (byte == PICO_ERROR_TIMEOUT) break;
        (void)arbi_feed(&runtime, (unsigned char)byte, now);
      }
      if (now - last_status >= 1000) {
        size_t length = arbi_status(&runtime, response, now);
        if (length) { fwrite(response, 1, length, stdout); putchar('\n'); }
        last_status = now;
      }
    }
    watchdog_update(); sleep_ms(1);
  }
}
