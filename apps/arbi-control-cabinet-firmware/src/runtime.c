#include "runtime.h"
#include "build_identity.h"
#include "mbedtls/platform_util.h"
#include <stdio.h>
#include <string.h>

#define SAFE_TIME UINT64_C(9007199254740991)
#define KEYS(j, n, ...) json_object(j, n, (const char *const[]){__VA_ARGS__}, sizeof((const char *const[]){__VA_ARGS__}) / sizeof(const char *))
#define FIELD(j, n, key) json_field(j, n, key)
#define TEXT(j, n, key, text) json_text(j, FIELD(j, n, key), text)

static bool id_valid(const char id[65]) {
  for (size_t i = 0; i < 65; i++) {
    unsigned char c = (unsigned char)id[i];
    if (!c) return i > 0;
    bool alnum = (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9');
    if (!alnum && (!i || !strchr("._:-", c))) return false;
  }
  return false;
}
static bool identity_valid(Identity identity) {
  return id_valid(identity.device) && id_valid(identity.boot) && id_valid(identity.session);
}
void arbi_reset(Runtime *r, Identity self, const unsigned char nonce[16]) {
  mbedtls_platform_zeroize(r, sizeof *r);
  if (identity_valid(self)) r->self = self;
  else r->self = (Identity){"invalid-device", "invalid-boot", "invalid-session"};
  memcpy(r->nonce, nonce, 16);
  strcpy(r->revision, "unconfigured"); strcpy(r->site, "unenrolled");
  strcpy(r->namespace_id, "unenrolled"); strcpy(r->environment, "test"); strcpy(r->mode, "hardware");
  r->reason = "CONFIG_MISSING";
}
static const char *poison(Runtime *r, const char *reason) {
  mbedtls_platform_zeroize(r->key, sizeof r->key);
  r->enrolled = false; r->poisoned = true; r->used = r->wanted = 0; r->reason = reason;
  return reason;
}
bool arbi_enroll(Runtime *r, Identity peer, const unsigned char key[32]) {
  if (r->poisoned || r->enrolled || !identity_valid(peer)) return false;
  unsigned char any = 0;
  for (size_t i = 0; i < 32; i++) any |= key[i];
  if (!any) return false;
  r->peer = peer; memcpy(r->key, key, 32); r->enrolled = true;
  r->rx_seen = r->command_seen = false; r->rx_sequence = r->command_sequence = 0;
  return true;
}
bool arbi_load_configuration(Runtime *r, const unsigned char *bytes, size_t length, const AdmittedProfile *profile) {
  r->configured = false; strcpy(r->revision, "unconfigured"); r->digest[0] = 0;
  strcpy(r->site, "unenrolled"); strcpy(r->namespace_id, "unenrolled");
  strcpy(r->environment, "test"); strcpy(r->mode, "hardware");
  r->reason = "CONFIG_MISSING";
  if (!profile || !profile->canonical || !profile->digest || !profile->revision || !bytes || !length || length > ARBI_MESSAGE_BYTES) return false;
  unsigned char digest[32]; char hex[65];
  if (!arbi_sha256(bytes, length, digest)) return false;
  static const char digits[] = "0123456789abcdef";
  for (size_t i = 0; i < 32; i++) { hex[2*i] = digits[digest[i] >> 4]; hex[2*i+1] = digits[digest[i] & 15]; }
  hex[64] = 0;
  if (strlen(profile->digest) != 64 || !arbi_equal((const unsigned char *)hex, (const unsigned char *)profile->digest, 64)
    || strlen(profile->canonical) != length || memcmp(bytes, profile->canonical, length)) { r->reason = "CONFIG_INTEGRITY"; return false; }
  Json *j = &r->json;
  if (!json_parse(j, bytes, length) || !TEXT(j, 0, "schemaVersion", "arbi.configuration/1.0")
    || !TEXT(j, 0, "executionMode", "simulation") || !TEXT(j, 0, "revision", profile->revision)) { r->reason = "CONFIG_INCOMPATIBLE"; return false; }
  int realm = FIELD(j, 0, "realm");
  if (!KEYS(j, realm, "environment", "namespaceId") || !TEXT(j, realm, "environment", "test")
    || !json_id(j, FIELD(j, 0, "revision"), r->revision) || !json_id(j, FIELD(j, 0, "siteId"), r->site)
    || !json_id(j, FIELD(j, realm, "namespaceId"), r->namespace_id)) return false;
  strcpy(r->mode, "simulation"); strcpy(r->environment, "test"); strcpy(r->digest, hex);
  r->configured = true; r->reason = "HARDWARE_READINESS_UNVERIFIED";
  return true;
}
static bool identity(const Json *j, int n, Identity expected) {
  return KEYS(j, n, "deviceId", "bootId", "sessionId") && TEXT(j, n, "deviceId", expected.device)
    && TEXT(j, n, "bootId", expected.boot) && TEXT(j, n, "sessionId", expected.session);
}
static const char *command(Runtime *r, const unsigned char *bytes, size_t length, uint64_t now) {
  Json *j = &r->json;
  if (!json_parse(j, bytes, length)) return "INVALID_JSON";
  if (!TEXT(j, 0, "protocol", "arbi/1.0")) return "UNSUPPORTED_VERSION";
  if (!KEYS(j, 0, "protocol", "messageId", "realm", "siteId", "source", "sequence", "sourceTime", "ingestTime", "kind", "body", "command", "executionMode")) return "INVALID_MESSAGE";
  if (!TEXT(j, 0, "kind", "command")) return "UNKNOWN_KIND";
  int body = FIELD(j, 0, "body");
  if (!TEXT(j, body, "type", "state.resync")) return "UNSUPPORTED_CAPABILITY";
  // Resync is a snapshot request only. Recovery pages/cursors remain edge-owned.
  if (!KEYS(j, body, "type", "cursor", "committedCursor") || !TEXT(j, body, "cursor", "null") || !TEXT(j, body, "committedCursor", "null")) return "INVALID_MESSAGE";
  int context = FIELD(j, 0, "command"), realm = FIELD(j, 0, "realm"), time = FIELD(j, 0, "sourceTime");
  if (!KEYS(j, context, "commandId", "correlationId", "idempotencyKey", "actor", "target", "deadline", "lease", "configRevision")
    || !KEYS(j, realm, "environment", "namespaceId") || !KEYS(j, time, "utc", "monotonicMs", "uncertaintyMs")) return "INVALID_MESSAGE";
  char scratch[65];
  const char *ids[] = {"commandId", "correlationId", "idempotencyKey", "configRevision"};
  for (size_t i = 0; i < 4; i++) if (!json_id(j, FIELD(j, context, ids[i]), scratch)) return "INVALID_MESSAGE";
  if (!json_id(j, FIELD(j, 0, "messageId"), scratch)) return "INVALID_MESSAGE";
  int actor = FIELD(j, context, "actor");
  if (!KEYS(j, actor, "kind", "id") || !json_id(j, FIELD(j, actor, "id"), scratch)
    || !(TEXT(j, actor, "kind", "human") || TEXT(j, actor, "kind", "service") || TEXT(j, actor, "kind", "device"))) return "INVALID_MESSAGE";
  if (!identity(j, FIELD(j, 0, "source"), r->peer)) return "SOURCE_MISMATCH";
  if (!identity(j, FIELD(j, context, "target"), r->self)) return "TARGET_RESTARTED";
  if (!r->configured) return "FAULT_INHIBITED";
  if (!TEXT(j, realm, "environment", r->environment) || !TEXT(j, realm, "namespaceId", r->namespace_id)) return "REALM_MISMATCH";
  if (!TEXT(j, 0, "siteId", r->site) || !TEXT(j, 0, "executionMode", r->mode)) return "SITE_MISMATCH";
  uint64_t source_ms, sequence;
  if (!json_uint(j, FIELD(j, 0, "sequence"), true, UINT64_MAX, &sequence)
    || !json_uint(j, FIELD(j, time, "monotonicMs"), false, SAFE_TIME, &source_ms)) return "INVALID_RANGE";
  if (!TEXT(j, time, "utc", "null") || !TEXT(j, time, "uncertaintyMs", "null") || !TEXT(j, 0, "ingestTime", "null")) return "CLOCK_INVALID";
  if (!TEXT(j, context, "lease", "null")) return "INVALID_MESSAGE";
  int deadline = FIELD(j, context, "deadline"); uint64_t expires;
  if (!KEYS(j, deadline, "bootId", "sessionId", "expiresMonotonicMs")
    || !TEXT(j, deadline, "bootId", r->self.boot) || !TEXT(j, deadline, "sessionId", r->self.session)
    || !json_uint(j, FIELD(j, deadline, "expiresMonotonicMs"), false, SAFE_TIME, &expires)) return "INVALID_MESSAGE";
  if (expires <= now) return "DEADLINE_EXPIRED";
  if (expires - now > 10000) return "DEADLINE_TOO_FAR";
  if (r->command_seen && sequence <= r->command_sequence) return "SEQUENCE_REPLAY";
  r->command_sequence = sequence; r->command_seen = true;
  return "SNAPSHOT";
}
void arbi_tick(Runtime *r, uint64_t now) {
  if (r->used && (now < r->last_byte_ms || now - r->last_byte_ms >= 250 || now - r->first_byte_ms >= 1000)) poison(r, "FRAME_TIMEOUT");
}
const char *arbi_feed(Runtime *r, unsigned char byte, uint64_t now) {
  arbi_tick(r, now);
  if (r->poisoned) return "LINK_RESET_REQUIRED";
  if (r->used == sizeof r->frame) return poison(r, "MESSAGE_TOO_LARGE");
  if (!r->used) r->first_byte_ms = now;
  r->frame[r->used++] = byte; r->last_byte_ms = now;
  if (r->used == 4) {
    uint32_t length = 0;
    for (size_t i = 0; i < 4; i++) length = (length << 8) | r->frame[i];
    if (length <= ARBI_FRAME_OVERHEAD || length > ARBI_MESSAGE_BYTES + ARBI_FRAME_OVERHEAD) return poison(r, "MESSAGE_TOO_LARGE");
    r->wanted = length + 4;
  }
  if (!r->wanted || r->used != r->wanted) return NULL;
  if (now < r->window_ms || now - r->window_ms >= 1000) { r->window_ms = now; r->window_frames = 0; }
  if (++r->window_frames > 32) return poison(r, "RESOURCE_LIMIT");
  if (r->frame[4] != 1) return poison(r, "UNSUPPORTED_VERSION");
  if (!r->enrolled) return poison(r, "NOT_AUTHORIZED");
  unsigned char mac[32];
  if (!arbi_mac(r->key, r->frame, r->wanted - 32, mac) || !arbi_equal(mac, r->frame + r->wanted - 32, 32)) return poison(r, "NOT_AUTHORIZED");
  if (!arbi_equal(r->nonce, r->frame + 5, 16)) return poison(r, "SESSION_MISMATCH");
  uint64_t sequence = 0;
  for (size_t i = 21; i < 29; i++) sequence = (sequence << 8) | r->frame[i];
  if (r->rx_seen && (r->rx_sequence == UINT64_MAX || sequence != r->rx_sequence + 1)) return poison(r, "SEQUENCE_REPLAY");
  if (!r->rx_seen && sequence != 0) return poison(r, "RESYNC_REQUIRED");
  r->rx_sequence = sequence; r->rx_seen = true;
  const char *result = command(r, r->frame + 29, r->wanted - ARBI_FRAME_OVERHEAD - 4, now);
  r->used = r->wanted = 0; r->reason = result;
  return result;
}
size_t arbi_status(Runtime *r, char output[ARBI_RESPONSE_BYTES], uint64_t now) {
  if (now > SAFE_TIME || r->event_sequence == UINT64_MAX) { poison(r, "RESOURCE_LIMIT"); return 0; }
  uint64_t seq = ++r->event_sequence;
  int length = snprintf(output, ARBI_RESPONSE_BYTES,
    "{\"diagnosticVersion\":\"arbi.pico-status/1.0\",\"firmware\":{\"version\":\"%s\",\"revision\":\"%s\",\"dirty\":%s,\"board\":\"pico2_w\"},"
    "\"configurationDigest\":%s%s%s,\"configured\":%s,\"enrolled\":%s,\"actuationInhibited\":true,\"physicalAcceptance\":false,\"reason\":\"%s\",\"lastResult\":\"%s\","
    "\"snapshot\":{\"protocol\":\"arbi/1.0\",\"messageId\":\"status-%llu\",\"realm\":{\"environment\":\"%s\",\"namespaceId\":\"%s\"},\"siteId\":\"%s\","
    "\"source\":{\"deviceId\":\"%s\",\"bootId\":\"%s\",\"sessionId\":\"%s\"},\"sequence\":\"%llu\",\"sourceTime\":{\"utc\":null,\"monotonicMs\":%llu,\"uncertaintyMs\":null},\"ingestTime\":null,\"kind\":\"event\","
    "\"body\":{\"type\":\"state.snapshot\",\"configRevision\":\"%s\",\"capabilitiesRevision\":\"pico-foundation-1\",\"capabilities\":[],\"state\":\"Fault\","
    "\"eventCursor\":{\"source\":{\"deviceId\":\"%s\",\"bootId\":\"%s\",\"sessionId\":\"%s\"},\"stream\":\"event\",\"sequence\":\"%llu\"},\"telemetryCursor\":null,\"committedCursor\":null,\"supportedCommands\":[\"state.resync\"],\"supportedProtocols\":[\"arbi/1.0\"]},\"executionMode\":\"%s\"}}",
    ARBI_FIRMWARE_VERSION, ARBI_BUILD_SHA, ARBI_BUILD_DIRTY ? "true" : "false",
    r->configured ? "\"" : "", r->configured ? r->digest : "null", r->configured ? "\"" : "", r->configured ? "true" : "false", r->enrolled ? "true" : "false",
    !r->configured ? "CONFIG_MISSING" : !r->enrolled ? "LINK_UNENROLLED" : "HARDWARE_READINESS_UNVERIFIED", r->reason,
    (unsigned long long)seq, r->environment, r->namespace_id, r->site, r->self.device, r->self.boot, r->self.session, (unsigned long long)seq, (unsigned long long)now, r->revision,
    r->self.device, r->self.boot, r->self.session, (unsigned long long)seq, r->mode);
  if (length < 0 || length >= ARBI_RESPONSE_BYTES) return 0;
  return (size_t)length;
}
