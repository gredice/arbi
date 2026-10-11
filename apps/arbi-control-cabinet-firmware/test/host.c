#include "runtime.h"
#include "fixture.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static Runtime runtime;
static unsigned char input[ARBI_FRAME_BYTES + 1];
static char response[ARBI_RESPONSE_BYTES];
int main(int argc, char **argv) {
  if (argc < 2) return 2;
  Identity self = {"edge", "edge-boot-1", "edge-session-1"};
  Identity peer = {"cloud", "cloud-boot-1", "cloud-session-1"};
  unsigned char key[32], nonce[16] = {0}; memset(key, 0x0b, sizeof key);
  arbi_reset(&runtime, self, nonce);
  const AdmittedProfile profile = {FIXTURE_CONFIG, FIXTURE_DIGEST, FIXTURE_REVISION};
  const char *result = "BOOT";
  if (!strcmp(argv[1], "config") || !strcmp(argv[1], "config-admitted")) {
    size_t length = fread(input, 1, sizeof input, stdin);
    if (length == sizeof input) return 2;
    AdmittedProfile selected = profile; char hex[65];
    if (!strcmp(argv[1], "config-admitted")) {
      // Trusted-profile fault substitute tests identifier validation after an
      // exact digest match. This mode exists only in the host executable.
      unsigned char digest[32]; input[length] = 0;
      if (!arbi_sha256(input, length, digest)) return 2;
      for (size_t i = 0; i < 32; i++) snprintf(hex + 2*i, 3, "%02x", digest[i]);
      selected.canonical = (const char *)input; selected.digest = hex;
    }
    bool loaded = arbi_load_configuration(&runtime, input, length, &selected);
    result = loaded ? "CONFIG_LOADED" : runtime.reason;
  } else if (!strcmp(argv[1], "mac")) {
    size_t length = fread(input, 1, sizeof input, stdin); unsigned char mac[32];
    if (length == sizeof input || !arbi_mac(key, input, length, mac)) return 2;
    for (size_t i = 0; i < 32; i++) printf("%02x", mac[i]);
    putchar('\n'); return 0;
  } else if (!strcmp(argv[1], "frame") || !strcmp(argv[1], "unenrolled") || !strcmp(argv[1], "timeout") || !strcmp(argv[1], "replay") || !strcmp(argv[1], "reconnect") || !strcmp(argv[1], "rate") || !strcmp(argv[1], "slow")) {
    if (!arbi_load_configuration(&runtime, (const unsigned char *)FIXTURE_CONFIG, strlen(FIXTURE_CONFIG), &profile)) return 2;
    if (strcmp(argv[1], "unenrolled") && !arbi_enroll(&runtime, peer, key)) return 2;
    size_t length = fread(input, 1, sizeof input, stdin);
    if (length == sizeof input) return 2;
    for (size_t i = 0; i < length; i++) {
      const char *next = arbi_feed(&runtime, input[i], 1100);
      if (next) result = next;
    }
    if (!strcmp(argv[1], "timeout")) { arbi_tick(&runtime, 1350); result = runtime.reason; }
    if (!strcmp(argv[1], "slow")) {
      // Keep trickling bytes below the idle timeout; total lifetime still expires.
      for (unsigned i = 1; i <= 5; i++) (void)arbi_feed(&runtime, 0, 1100 + i * 200);
      result = runtime.reason;
    }
    if (!strcmp(argv[1], "rate")) {
      if (length < 61) return 2;
      for (unsigned n = 1; n <= 32; n++) {
        memset(input + 21, 0, 8); input[28] = (unsigned char)n;
        if (!arbi_mac(key, input, length - 32, input + length - 32)) return 2;
        for (size_t i = 0; i < length; i++) {
          const char *next = arbi_feed(&runtime, input[i], 1100);
          if (next) result = next;
        }
      }
    }
    if (!strcmp(argv[1], "replay") || !strcmp(argv[1], "reconnect")) {
      if (!strcmp(argv[1], "reconnect")) {
        nonce[0] = 1; strcpy(self.session, "edge-session-2"); arbi_reset(&runtime, self, nonce);
        if (!arbi_enroll(&runtime, peer, key)) return 2;
      }
      for (size_t i = 0; i < length; i++) {
        const char *next = arbi_feed(&runtime, input[i], 1101);
        if (next) result = next;
      }
    }
  } else if (strcmp(argv[1], "boot")) return 2;
  printf("{\"result\":\"%s\",\"memoryBytes\":%zu,\"status\":", result, sizeof runtime);
  size_t length = arbi_status(&runtime, response, 1100);
  if (!length) return 2;
  fwrite(response, 1, length, stdout); puts("}");
  return 0;
}
