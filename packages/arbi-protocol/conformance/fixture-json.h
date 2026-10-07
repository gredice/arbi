/* Bounded host JSON token reader; no production schema/admission guarantee.
 * Semantic fixture strings are unescaped ASCII. Canonical digest supports only
 * the accepted configuration fixture's ASCII strings and safe integer numbers.
 */
#include <ctype.h>
#include <errno.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define BYTES 262144
#define TOKENS 16384
typedef enum { OBJECT, ARRAY, STRING, NUMBER, LITERAL } Kind;
typedef struct { Kind kind; size_t start, end; int child, next; } Token;
typedef struct { char text[BYTES+1]; Token tokens[TOKENS]; size_t length, pos; int used; } Json;
_Noreturn static void fail(const char *code) { fprintf(stderr, "%s\n", code); exit(2); }
static void ws(Json *j) { while (j->pos < j->length && strchr(" \r\n\t", j->text[j->pos])) j->pos++; }
static void expect(Json *j, char c) { ws(j); if (j->pos >= j->length || j->text[j->pos++] != c) fail("INVALID_VECTORS"); }
static int parse(Json *j, unsigned depth) {
    if (depth > 32 || j->used == TOKENS) fail("INVALID_VECTORS");
    ws(j); if (j->pos == j->length) fail("INVALID_VECTORS");
    int n = j->used++; Token *t = &j->tokens[n]; t->start = j->pos; t->child = t->next = -1;
    char c = j->text[j->pos];
    if (c == '{' || c == '[') {
        t->kind = c == '{' ? OBJECT : ARRAY; j->pos++; ws(j);
        char end = c == '{' ? '}' : ']'; int last = -1;
        if (j->text[j->pos] != end) for (;;) {
            int child = parse(j, depth+1);
            if (last == -1) t->child = child; else j->tokens[last].next = child;
            last = child;
            if (c == '{') {
                if (j->tokens[child].kind != STRING) fail("INVALID_VECTORS");
                expect(j, ':'); int value = parse(j, depth+1); j->tokens[last].next = value; last = value;
            }
            ws(j); if (j->text[j->pos] != ',') break;
            j->pos++;
        }
        expect(j, end);
    } else if (c == '"') {
        t->kind = STRING; j->pos++;
        while (j->pos < j->length && j->text[j->pos] != '"') {
            unsigned char ch = (unsigned char)j->text[j->pos++];
            if (ch < 32 || ch >= 128) fail("INVALID_VECTORS");
            if (ch == '\\') {
                if (j->pos == j->length) fail("INVALID_VECTORS");
                char escaped = j->text[j->pos++];
                if (!strchr("\"\\/bfnrtu", escaped)) fail("INVALID_VECTORS");
                if (escaped == 'u') for (int k = 0; k < 4; k++) if (j->pos == j->length || !isxdigit((unsigned char)j->text[j->pos++])) fail("INVALID_VECTORS");
            }
        }
        expect(j, '"');
    } else if (c == 't' || c == 'f' || c == 'n') {
        t->kind = LITERAL; const char *s = c == 't' ? "true" : c == 'f' ? "false" : "null";
        size_t len = strlen(s); if (j->length-j->pos < len || strncmp(j->text+j->pos,s,len)) fail("INVALID_VECTORS"); j->pos += len;
    } else {
        t->kind = NUMBER;
        if (c == '-') j->pos++;
        if (j->text[j->pos] == '0') j->pos++;
        else { if (!isdigit((unsigned char)j->text[j->pos])) fail("INVALID_VECTORS"); while (isdigit((unsigned char)j->text[j->pos])) j->pos++; }
        if (j->text[j->pos] == '.') { j->pos++; if (!isdigit((unsigned char)j->text[j->pos])) fail("INVALID_VECTORS"); while (isdigit((unsigned char)j->text[j->pos])) j->pos++; }
        if (j->text[j->pos] == 'e' || j->text[j->pos] == 'E') { j->pos++; if (j->text[j->pos] == '+' || j->text[j->pos] == '-') j->pos++; if (!isdigit((unsigned char)j->text[j->pos])) fail("INVALID_VECTORS"); while (isdigit((unsigned char)j->text[j->pos])) j->pos++; }
    }
    t->end = j->pos; return n;
}
static Json *load(const char *path) {
    Json *j = calloc(1,sizeof *j); if (!j) fail("RESOURCE_LIMIT");
    FILE *f = fopen(path,"rb"); if (!f) fail("INVALID_VECTORS");
    j->length = fread(j->text,1,BYTES+1,f); int error = ferror(f); fclose(f);
    if (error || j->length > BYTES) fail("RESOURCE_LIMIT");
    j->text[j->length] = '\0'; parse(j,0); ws(j);
    if (j->pos != j->length) { fail("INVALID_VECTORS"); }
    return j;
}
static int text_is(Json *j, int n, const char *s) {
    if (n < 0 || j->tokens[n].kind != STRING) return 0;
    Token t = j->tokens[n]; size_t len = t.end-t.start-2;
    return strlen(s) == len && !memcmp(j->text+t.start+1,s,len);
}
static void is(Json *j, int n, const char *s, const char *code) { if (!text_is(j,n,s)) fail(code); }
static int field(Json *j, int n, const char *name) {
    if (n < 0 || j->tokens[n].kind != OBJECT) fail("INVALID_VECTORS");
    int found = -1;
    for (int k = j->tokens[n].child; k != -1;) {
        int value = j->tokens[k].next;
        if (text_is(j,k,name)) { if (found != -1) fail("INVALID_VECTORS"); found = value; }
        k = j->tokens[value].next;
    }
    if (found == -1) { fail("INVALID_VECTORS"); }
    return found;
}
static void same_text(Json *a, int x, Json *b, int y, const char *code) {
    Token p=a->tokens[x],q=b->tokens[y];
    if (p.kind != STRING || q.kind != STRING || p.end-p.start != q.end-q.start || memcmp(a->text+p.start,b->text+q.start,p.end-p.start)) fail(code);
}
static double number(Json *j, int n) {
    Token t = j->tokens[n]; if (t.kind != NUMBER || t.end-t.start >= 64) fail("INVALID_VECTORS");
    char s[64]; memcpy(s,j->text+t.start,t.end-t.start); s[t.end-t.start]='\0';
    char *end; errno=0; double v = strtod(s,&end);
    if (*end || errno || !isfinite(v)) { fail("INVALID_VECTORS"); }
    return v;
}
static void close_number(double actual, double expected) {
    if (!isfinite(actual) || !isfinite(expected) || fabs(actual-expected) > 1e-7+1e-12*fabs(expected)) fail("RESULT_MISMATCH");
}
static int array(Json *j, int n) {
    if (j->tokens[n].kind != ARRAY || j->tokens[n].child == -1) { fail("INVALID_VECTORS"); }
    return j->tokens[n].child;
}
static void vector(Json *j, int n, double out[3]) {
    const char *axes[3]={"x","y","z"}; for (int i=0;i<3;i++) out[i]=number(j,field(j,n,axes[i]));
}
static void frame(Json *a, int x, Json *b, int y) {
    same_text(a,field(a,x,"name"),b,field(b,y,"name"),"FRAME_MISMATCH");
    same_text(a,field(a,x,"revision"),b,field(b,y,"revision"),"FRAME_MISMATCH");
}
static Json *sort_doc;
static int key_compare(const void *a, const void *b) {
    Token x=sort_doc->tokens[*(const int *)a],y=sort_doc->tokens[*(const int *)b];
    size_t lx=x.end-x.start-2,ly=y.end-y.start-2;
    int c=memcmp(sort_doc->text+x.start+1,sort_doc->text+y.start+1,lx<ly?lx:ly);
    return c ? c : lx<ly ? -1 : lx>ly ? 1 : 0;
}
static void append(char out[BYTES+1], size_t *used, const char *s, size_t len) {
    if (*used+len > BYTES) { fail("RESOURCE_LIMIT"); }
    memcpy(out+*used,s,len); *used+=len;
}
static void canonical(Json *j, int n, char out[BYTES+1], size_t *used) {
    Token t=j->tokens[n];
    if (t.kind == OBJECT) {
        int keys[TOKENS/2], count=0;
        for (int k=t.child;k!=-1;k=j->tokens[j->tokens[k].next].next) { if (count == TOKENS/2) fail("RESOURCE_LIMIT"); keys[count++]=k; }
        sort_doc=j; qsort(keys,(size_t)count,sizeof *keys,key_compare);
        append(out,used,"{",1);
        for (int i=0;i<count;i++) {
            if (i && key_compare(&keys[i-1],&keys[i]) == 0) fail("INVALID_CONFIGURATION");
            if (i) append(out,used,",",1);
            canonical(j,keys[i],out,used); append(out,used,":",1); canonical(j,j->tokens[keys[i]].next,out,used);
        }
        append(out,used,"}",1);
    } else if (t.kind == ARRAY) {
        append(out,used,"[",1);
        for (int k=t.child;k!=-1;k=j->tokens[k].next) { if (k!=t.child) append(out,used,",",1); canonical(j,k,out,used); }
        append(out,used,"]",1);
    } else if (t.kind == NUMBER) {
        double v=number(j,n); if (floor(v)!=v || fabs(v)>9007199254740991.0) fail("INVALID_CONFIGURATION");
        char s[64]; int len=snprintf(s,sizeof s,"%.0f",v==0?0:v); append(out,used,s,(size_t)len);
    } else {
        if (t.kind==STRING) for (size_t i=t.start+1;i<t.end-1;i++) if (j->text[i]=='\\') fail("INVALID_CONFIGURATION");
        append(out,used,j->text+t.start,t.end-t.start);
    }
}
