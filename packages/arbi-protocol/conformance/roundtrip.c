/* Host C JSON lexical round-trip harness for already schema-validated fixtures.
 * Not a firmware binding, general input validator, or actuator implementation.
 * Preserve decimal-string counters verbatim; C never routes them through double.
 */
#include <ctype.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define CAPACITY 16384
static char input[CAPACITY + 1];
static size_t pos;
static int counter_seen;

static void fail(void) { exit(2); }
static void whitespace(void) { while (isspace((unsigned char)input[pos])) pos++; }
static void expect(char c) { whitespace(); if (input[pos++] != c) fail(); putchar(c); }

/* Fixture strings are ASCII. Escapes are preserved as JSON lexical bytes. */
static void string_value(char *decoded, size_t capacity) {
    size_t used = 0;
    if (input[pos++] != '"') fail();
    putchar('"');
    while (input[pos] && input[pos] != '"') {
        unsigned char c = (unsigned char)input[pos++];
        if (c < 32) fail();
        putchar(c);
        if (used + 1 >= capacity) fail();
        decoded[used++] = (char)c;
        if (c == '\\') {
            char escape = input[pos++];
            if (!strchr("\"\\/bfnrtu", escape) || escape == '\0') fail();
            putchar(escape);
            if (used + 1 >= capacity) fail();
            decoded[used++] = escape;
            if (escape == 'u') for (int i = 0; i < 4; i++) {
                char hex = input[pos++];
                if (!isxdigit((unsigned char)hex) || used + 1 >= capacity) fail();
                putchar(hex); decoded[used++] = hex;
            }
        }
    }
    if (input[pos++] != '"') fail();
    putchar('"'); decoded[used] = '\0';
}

static void counter(const char *text) {
    uint64_t value = 0;
    if (!*text || (text[0] == '0' && text[1])) fail();
    for (size_t i = 0; text[i]; i++) {
        if (text[i] < '0' || text[i] > '9') fail();
        unsigned digit = (unsigned)(text[i] - '0');
        if (value > (UINT64_MAX - digit) / 10) fail();
        value = value * 10 + digit;
    }
    counter_seen++;
}

static void value(unsigned depth, const char *key) {
    char text[CAPACITY + 1];
    if (depth > 16) fail();
    whitespace();
    if (input[pos] == '"') {
        string_value(text, sizeof text);
        if (!strcmp(key, "sequence") || !strcmp(key, "fence")) counter(text);
    } else if (input[pos] == '{') {
        expect('{'); whitespace();
        if (input[pos] != '}') for (;;) {
            string_value(text, sizeof text); expect(':'); value(depth + 1, text); whitespace();
            if (input[pos] != ',') break;
            expect(','); whitespace();
        }
        expect('}');
    } else if (input[pos] == '[') {
        expect('['); whitespace();
        if (input[pos] != ']') for (;;) {
            value(depth + 1, ""); whitespace();
            if (input[pos] != ',') break;
            expect(',');
        }
        expect(']');
    } else if (input[pos] == 't' || input[pos] == 'f' || input[pos] == 'n') {
        const char *literal = input[pos] == 't' ? "true" : input[pos] == 'f' ? "false" : "null";
        size_t length = strlen(literal);
        if (strncmp(input + pos, literal, length)) fail();
        fputs(literal, stdout); pos += length;
    } else {
        size_t start = pos;
        if (input[pos] == '-') pos++;
        if (input[pos] == '0') pos++;
        else { if (!isdigit((unsigned char)input[pos])) fail(); while (isdigit((unsigned char)input[pos])) pos++; }
        if (input[pos] == '.') { pos++; if (!isdigit((unsigned char)input[pos])) fail(); while (isdigit((unsigned char)input[pos])) pos++; }
        if (input[pos] == 'e' || input[pos] == 'E') { pos++; if (input[pos] == '-' || input[pos] == '+') pos++; if (!isdigit((unsigned char)input[pos])) fail(); while (isdigit((unsigned char)input[pos])) pos++; }
        fwrite(input + start, 1, pos - start, stdout);
    }
}

int main(void) {
    size_t length = fread(input, 1, sizeof input, stdin);
    if (length > CAPACITY || ferror(stdin)) fail();
    input[length] = '\0'; value(0, ""); whitespace();
    if (pos != length || !counter_seen) fail();
    return 0;
}
