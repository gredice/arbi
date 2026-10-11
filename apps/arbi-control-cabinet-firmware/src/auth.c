#include "runtime.h"
#include "mbedtls/sha256.h"
#include "mbedtls/platform_util.h"
#include <string.h>

bool arbi_sha256(const unsigned char *input, size_t length, unsigned char output[32]) {
  return mbedtls_sha256(input, length, output, 0) == 0;
}
bool arbi_mac(const unsigned char key[32], const unsigned char *input, size_t length, unsigned char output[32]) {
  static const unsigned char domain[] = "arbi-usb/1.0";
  unsigned char pad[64], inner[32];
  mbedtls_sha256_context context;
  mbedtls_sha256_init(&context);
  for (size_t i = 0; i < sizeof pad; i++) pad[i] = (unsigned char)(0x36 ^ (i < 32 ? key[i] : 0));
  int error = mbedtls_sha256_starts(&context, 0);
  if (!error) error = mbedtls_sha256_update(&context, pad, sizeof pad);
  if (!error) error = mbedtls_sha256_update(&context, domain, sizeof domain);
  if (!error) error = mbedtls_sha256_update(&context, input, length);
  if (!error) error = mbedtls_sha256_finish(&context, inner);
  for (size_t i = 0; i < sizeof pad; i++) pad[i] = (unsigned char)(0x5c ^ (i < 32 ? key[i] : 0));
  if (!error) error = mbedtls_sha256_starts(&context, 0);
  if (!error) error = mbedtls_sha256_update(&context, pad, sizeof pad);
  if (!error) error = mbedtls_sha256_update(&context, inner, sizeof inner);
  if (!error) error = mbedtls_sha256_finish(&context, output);
  mbedtls_sha256_free(&context);
  mbedtls_platform_zeroize(pad, sizeof pad); mbedtls_platform_zeroize(inner, sizeof inner);
  return error == 0;
}
bool arbi_equal(const unsigned char *a, const unsigned char *b, size_t length) {
  unsigned char different = 0;
  for (size_t i = 0; i < length; i++) different |= a[i] ^ b[i];
  return different == 0;
}
