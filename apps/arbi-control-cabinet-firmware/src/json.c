#include "json.h"
#include <string.h>

static bool digit(unsigned char c) { return c >= '0' && c <= '9'; }
static void whitespace(Json *j) {
  while (j->position < j->length && strchr(" \t\r\n", j->text[j->position]) && j->text[j->position]) j->position++;
}
static bool take(Json *j, unsigned char c) {
  whitespace(j);
  if (j->position == j->length || j->text[j->position] != c) return false;
  j->position++; return true;
}
static int value(Json *j, unsigned depth) {
  whitespace(j);
  if (depth > 16 || j->position == j->length || j->used == ARBI_JSON_TOKENS) return -1;
  int n = (int)j->used++;
  JsonToken *t = &j->tokens[n];
  t->start = (uint16_t)j->position; t->child = t->next = -1;
  unsigned char c = j->text[j->position];
  if (c == '{' || c == '[') {
    t->kind = c == '{' ? J_OBJECT : J_ARRAY; j->position++; whitespace(j);
    unsigned char end = c == '{' ? '}' : ']'; int last = -1;
    if (j->position == j->length) return -1;
    if (j->text[j->position] != end) for (;;) {
      int child = value(j, depth + 1);
      if (child < 0) return -1;
      if (last < 0) t->child = child; else j->tokens[last].next = child;
      last = child;
      if (c == '{') {
        if (j->tokens[child].kind != J_STRING || !take(j, ':')) return -1;
        // Reject duplicate keys before any receiver logic can see the object.
        for (int k = t->child; k != child; k = j->tokens[j->tokens[k].next].next) {
          JsonToken a = j->tokens[k], b = j->tokens[child];
          if (a.end - a.start == b.end - b.start && !memcmp(j->text + a.start, j->text + b.start, b.end - b.start)) return -1;
        }
        int body = value(j, depth + 1);
        if (body < 0) return -1;
        j->tokens[last].next = body; last = body;
      }
      whitespace(j);
      if (j->position == j->length) return -1;
      if (j->text[j->position] != ',') break;
      j->position++;
    }
    if (!take(j, end)) return -1;
  } else if (c == '"') {
    t->kind = J_STRING; j->position++;
    while (j->position < j->length && j->text[j->position] != '"') {
      c = j->text[j->position++];
      // The diagnostic receiver deliberately accepts an unescaped ASCII subset.
      // Rejected spellings never gain authority; it does not normalize aliases.
      if (c < 32 || c >= 127 || c == '\\') return -1;
    }
    if (!take(j, '"')) return -1;
  } else if (c == 't' || c == 'f' || c == 'n') {
    t->kind = J_LITERAL;
    const char *literal = c == 't' ? "true" : c == 'f' ? "false" : "null";
    size_t length = strlen(literal);
    if (j->length - j->position < length || memcmp(j->text + j->position, literal, length)) return -1;
    j->position += length;
  } else {
    t->kind = J_NUMBER;
    if (c == '-') j->position++;
    if (j->position == j->length) return -1;
    if (j->text[j->position] == '0') j->position++;
    else {
      if (!digit(j->text[j->position])) return -1;
      while (j->position < j->length && digit(j->text[j->position])) j->position++;
    }
    if (j->position < j->length && j->text[j->position] == '.') {
      j->position++;
      if (j->position == j->length || !digit(j->text[j->position])) return -1;
      while (j->position < j->length && digit(j->text[j->position])) j->position++;
    }
    if (j->position < j->length && (j->text[j->position] == 'e' || j->text[j->position] == 'E')) {
      j->position++;
      if (j->position < j->length && (j->text[j->position] == '+' || j->text[j->position] == '-')) j->position++;
      if (j->position == j->length || !digit(j->text[j->position])) return -1;
      while (j->position < j->length && digit(j->text[j->position])) j->position++;
    }
  }
  t->end = (uint16_t)j->position; return n;
}
bool json_parse(Json *j, const unsigned char *text, size_t length) {
  if (!text || !length || length > 16384) return false;
  j->text = text; j->length = length; j->position = 0; j->used = 0;
  int root = value(j, 0); whitespace(j);
  return root == 0 && j->position == length;
}
bool json_text(const Json *j, int n, const char *s) {
  if (n < 0 || (unsigned)n >= j->used) return false;
  JsonToken t = j->tokens[n]; size_t length = t.end - t.start;
  if (t.kind == J_STRING) return strlen(s) + 2 == length && !memcmp(j->text + t.start + 1, s, length - 2);
  return t.kind == J_LITERAL && strlen(s) == length && !memcmp(j->text + t.start, s, length);
}
int json_field(const Json *j, int n, const char *s) {
  if (n < 0 || (unsigned)n >= j->used || j->tokens[n].kind != J_OBJECT) return -1;
  for (int k = j->tokens[n].child; k >= 0; k = j->tokens[j->tokens[k].next].next) if (json_text(j, k, s)) return j->tokens[k].next;
  return -1;
}
bool json_object(const Json *j, int n, const char *const *keys, size_t count) {
  if (n < 0 || (unsigned)n >= j->used || j->tokens[n].kind != J_OBJECT) return false;
  size_t seen = 0;
  for (int k = j->tokens[n].child; k >= 0; k = j->tokens[j->tokens[k].next].next) seen++;
  if (seen != count) return false;
  for (size_t i = 0; i < count; i++) if (json_field(j, n, keys[i]) < 0) return false;
  return true;
}
bool json_id(const Json *j, int n, char output[65]) {
  if (n < 0 || (unsigned)n >= j->used || j->tokens[n].kind != J_STRING) return false;
  JsonToken t = j->tokens[n]; size_t length = t.end - t.start - 2;
  if (!length || length > 64) return false;
  for (size_t i = 0; i < length; i++) {
    unsigned char c = j->text[t.start + 1 + i];
    bool alpha = (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z');
    if (!alpha && !digit(c) && (!i || !strchr("._:-", c))) return false;
  }
  memcpy(output, j->text + t.start + 1, length); output[length] = 0; return true;
}
bool json_uint(const Json *j, int n, bool quoted, uint64_t maximum, uint64_t *output) {
  if (n < 0 || (unsigned)n >= j->used || j->tokens[n].kind != (quoted ? J_STRING : J_NUMBER)) return false;
  JsonToken t = j->tokens[n]; size_t start = t.start + (quoted ? 1 : 0), end = t.end - (quoted ? 1 : 0);
  if (start == end || (end - start > 1 && j->text[start] == '0')) return false;
  uint64_t result = 0;
  for (size_t i = start; i < end; i++) {
    unsigned char c = j->text[i];
    if (!digit(c) || (uint64_t)(c - '0') > maximum || result > (maximum - (c - '0')) / 10) return false;
    result = result * 10 + c - '0';
  }
  *output = result; return true;
}
