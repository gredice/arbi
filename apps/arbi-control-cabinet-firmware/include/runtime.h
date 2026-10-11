#ifndef ARBI_RUNTIME_H
#define ARBI_RUNTIME_H
#include "json.h"
#define ARBI_MESSAGE_BYTES 16384
#define ARBI_FRAME_OVERHEAD 57
#define ARBI_FRAME_BYTES (ARBI_MESSAGE_BYTES + ARBI_FRAME_OVERHEAD + 4)
#define ARBI_RESPONSE_BYTES 4096
typedef struct { char device[65], boot[65], session[65]; } Identity;
typedef struct { const char *canonical, *digest, *revision; } AdmittedProfile;
typedef struct {
  Identity self, peer;
  unsigned char nonce[16], key[32], frame[ARBI_FRAME_BYTES];
  size_t used, wanted;
  uint64_t first_byte_ms, last_byte_ms, rx_sequence, command_sequence, event_sequence, window_ms;
  unsigned window_frames;
  bool enrolled, poisoned, rx_seen, command_seen, configured;
  char revision[65], digest[65], site[65], namespace_id[65], environment[65], mode[65];
  const char *reason;
  Json json;
} Runtime;
bool arbi_sha256(const unsigned char *input, size_t length, unsigned char output[32]);
bool arbi_mac(const unsigned char key[32], const unsigned char *input, size_t length, unsigned char output[32]);
bool arbi_equal(const unsigned char *a, const unsigned char *b, size_t length);
void arbi_reset(Runtime *runtime, Identity self, const unsigned char nonce[16]);
bool arbi_enroll(Runtime *runtime, Identity peer, const unsigned char key[32]);
bool arbi_load_configuration(Runtime *runtime, const unsigned char *bytes, size_t length, const AdmittedProfile *profile);
const char *arbi_feed(Runtime *runtime, unsigned char byte, uint64_t now);
void arbi_tick(Runtime *runtime, uint64_t now);
size_t arbi_status(Runtime *runtime, char output[ARBI_RESPONSE_BYTES], uint64_t now);
/* Diagnostic foundation contains no GPIO or actuator dispatch function. */
#endif
