#ifndef ARBI_JSON_H
#define ARBI_JSON_H
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#define ARBI_JSON_TOKENS 2048
typedef enum { J_OBJECT, J_ARRAY, J_STRING, J_NUMBER, J_LITERAL } JsonKind;
typedef struct { JsonKind kind; uint16_t start, end; int child, next; } JsonToken;
typedef struct { const unsigned char *text; size_t length, position; unsigned used; JsonToken tokens[ARBI_JSON_TOKENS]; } Json;
bool json_parse(Json *json, const unsigned char *text, size_t length);
int json_field(const Json *json, int object, const char *key);
bool json_text(const Json *json, int token, const char *value);
bool json_object(const Json *json, int token, const char *const *keys, size_t count);
bool json_id(const Json *json, int token, char output[65]);
bool json_uint(const Json *json, int token, bool quoted, uint64_t maximum, uint64_t *output);
#endif
