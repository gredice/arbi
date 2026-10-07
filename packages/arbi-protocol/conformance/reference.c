/* Independent host-compiled C11 fixture consumer. No Pico SDK, GPIO or Pi I/O.
 * Exact identity, units, frames, uint64 arithmetic and analytical geometry only.
 * This is a bounded synthetic fixture reader, not a full firmware validator.
 */
#include <inttypes.h>
#include "fixture-json.h"
#include "sha256.h"

static Json *relative(const char *root, const char *name) {
    char path[4096]; int n=snprintf(path,sizeof path,"%s/%s",root,name);
    if (n<0 || (size_t)n>=sizeof path) fail("RESOURCE_LIMIT");
    return load(path);
}
static uint64_t counter(Json *j, int n) {
    Token t=j->tokens[n]; if (t.kind!=STRING || t.end-t.start<3) fail("COUNTER_MISMATCH");
    const char *p=j->text+t.start+1; size_t len=t.end-t.start-2;
    if (len>20 || (len>1 && p[0]=='0')) fail("COUNTER_MISMATCH");
    uint64_t v=0;
    for (size_t i=0;i<len;i++) {
        if (p[i]<'0' || p[i]>'9') fail("COUNTER_MISMATCH");
        unsigned digit=(unsigned)(p[i]-'0');
        if (v>(UINT64_MAX-digit)/10) fail("COUNTER_MISMATCH");
        v=v*10+digit;
    }
    return v;
}
static void schema(Json *v, int identity, const char *key, const char *version, const char *id, const char *root, const char *path) {
    int descriptor=field(v,identity,key); is(v,field(v,descriptor,"version"),version,"VERSION_MISMATCH");
    is(v,field(v,descriptor,"id"),id,"SCHEMA_MISMATCH");
    Json *s=relative(root,path); is(s,field(s,0,"$id"),id,"SCHEMA_MISMATCH");
    char hash[65]; sha256(s->text,s->length,hash); is(v,field(v,descriptor,"sha256"),hash,"SCHEMA_MISMATCH"); free(s);
}
static void report_string(Json *j, int n) { Token t=j->tokens[n]; fwrite(j->text+t.start,1,t.end-t.start,stdout); }
int main(int argc, char **argv) {
    if (argc<2 || argc>3) fail("INVALID_VECTORS");
    char selftest[65]; sha256("abc",3,selftest);
    if (strcmp(selftest,"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")) fail("HASH_MISMATCH");
    Json *v=argc==3?load(argv[2]):relative(argv[1],"fixtures/reference/1.0/vectors.json");
    int identity=field(v,0,"identity");
    is(v,field(v,0,"fixtureVersion"),"arbi.reference/1.0","VERSION_MISMATCH");
    is(v,field(v,field(v,identity,"protocol"),"version"),"arbi/1.0","VERSION_MISMATCH");
    is(v,field(v,field(v,identity,"configurationSchema"),"version"),"arbi.configuration/1.0","VERSION_MISMATCH");
    const char *unit_keys[]={"position","angle","speed","acceleration","force","time"};
    const char *units[]={"mm","deg","mm/s","mm/s^2","N","ms"};
    int u=field(v,0,"units");
    for (int i=0;i<6;i++) is(v,field(v,u,unit_keys[i]),units[i],"UNIT_MISMATCH");
    schema(v,identity,"protocol","arbi/1.0","https://arbi.gredice.com/schemas/protocol/1.0/message.schema.json",argv[1],"schema/message.schema.json");
    schema(v,identity,"configurationSchema","arbi.configuration/1.0","https://arbi.gredice.com/schemas/configuration/1.0/configuration.schema.json",argv[1],"schema/configuration.schema.json");
    Json *config_doc=relative(argv[1],"fixtures/configuration.json");
    int config=field(config_doc,field(config_doc,0,"valid"),"configuration");
    char *canonical_json=malloc(BYTES+1); if (!canonical_json) fail("RESOURCE_LIMIT"); size_t used=0;
    canonical(config_doc,config,canonical_json,&used); char hash[65]; sha256(canonical_json,used,hash); free(canonical_json);
    is(v,field(v,identity,"configurationDigest"),hash,"IDENTITY_MISMATCH");
    is(config_doc,field(config_doc,config,"schemaVersion"),"arbi.configuration/1.0","VERSION_MISMATCH");
    int geo=field(config_doc,config,"geometry"), cal=field(config_doc,config,"calibration");
    same_text(config_doc,field(config_doc,config,"revision"),v,field(v,identity,"configurationRevision"),"IDENTITY_MISMATCH");
    same_text(config_doc,field(config_doc,geo,"revision"),v,field(v,identity,"geometryRevision"),"IDENTITY_MISMATCH");
    same_text(config_doc,field(config_doc,cal,"revision"),v,field(v,identity,"calibrationRevision"),"IDENTITY_MISMATCH");
    is(config_doc,field(config_doc,config,"executionMode"),"simulation","IDENTITY_MISMATCH");
    is(config_doc,field(config_doc,cal,"scope"),"simulation","IDENTITY_MISMATCH");
    is(config_doc,field(config_doc,geo,"convention"),"right-handed-x-y-z-mm-deg","IDENTITY_MISMATCH");
    int site_frame=field(config_doc,geo,"siteFrame"), gimbal_frame=field(config_doc,geo,"gimbalFrame");
    frame(config_doc,site_frame,v,field(v,identity,"siteFrame")); frame(config_doc,gimbal_frame,v,field(v,identity,"gimbalFrame"));
    is(config_doc,field(config_doc,site_frame,"name"),"site","FRAME_MISMATCH");
    is(config_doc,field(config_doc,gimbal_frame,"name"),"pod-gimbal","FRAME_MISMATCH");
    double anchors[4][3], offsets[4]; int seen[4]={0};
    const char *lines[]={"a","b","c","d"};
    for (int n=array(config_doc,field(config_doc,geo,"anchors"));n!=-1;n=config_doc->tokens[n].next) {
        int line=field(config_doc,n,"line"), index=-1;
        for (int i=0;i<4;i++) if (text_is(config_doc,line,lines[i])) index=i;
        if (index<0 || seen[index]++) fail("GEOMETRY_MISMATCH");
        vector(config_doc,field(config_doc,n,"positionMm"),anchors[index]);
    }
    for (int i=0;i<4;i++) {
        if (!seen[i]) fail("GEOMETRY_MISMATCH");
        offsets[i]=number(config_doc,field(config_doc,field(config_doc,cal,"lineLengthOffsetsMm"),lines[i]));
    }
    if (!(anchors[0][0]<anchors[1][0] && anchors[0][1]<anchors[3][1] && anchors[0][1]==anchors[1][1] && anchors[1][0]==anchors[2][0] && anchors[2][1]==anchors[3][1] && anchors[3][0]==anchors[0][0])) fail("GEOMETRY_MISMATCH");
    for (int i=1;i<4;i++) if (anchors[i][2]!=anchors[0][2]) fail("GEOMETRY_MISMATCH");
    Json *messages=relative(argv[1],"fixtures/contracts.json"); int move=field(messages,field(messages,0,"valid"),"move");
    is(messages,field(messages,move,"protocol"),"arbi/1.0","VERSION_MISMATCH");
    int cmd=field(messages,move,"command"),body=field(messages,move,"body");
    same_text(messages,field(messages,cmd,"configRevision"),config_doc,field(config_doc,config,"revision"),"IDENTITY_MISMATCH");
    frame(messages,field(messages,body,"frame"),config_doc,site_frame);
    is(messages,field(messages,move,"executionMode"),"simulation","IDENTITY_MISMATCH");
    same_text(messages,field(messages,move,"siteId"),config_doc,field(config_doc,config,"siteId"),"IDENTITY_MISMATCH");
    int mr=field(messages,move,"realm"),cr=field(config_doc,config,"realm");
    same_text(messages,field(messages,mr,"environment"),config_doc,field(config_doc,cr,"environment"),"IDENTITY_MISMATCH");
    same_text(messages,field(messages,mr,"namespaceId"),config_doc,field(config_doc,cr,"namespaceId"),"IDENTITY_MISMATCH");
    (void)counter(messages,field(messages,move,"sequence"));
    (void)counter(messages,field(messages,field(messages,cmd,"lease"),"fence"));
    for (int n=array(v,field(v,0,"counters"));n!=-1;n=v->tokens[n].next) {
        uint64_t value=counter(v,field(v,n,"value")); int successor=field(v,n,"successor");
        if (value==UINT64_MAX) {
            Token t=v->tokens[successor]; if (t.kind!=LITERAL || t.end-t.start!=4 || memcmp(v->text+t.start,"null",4)) fail("COUNTER_MISMATCH");
        } else if (counter(v,successor)!=value+1) fail("COUNTER_MISMATCH");
    }
    const double pi=acos(-1.0);
    for (int n=array(v,field(v,0,"conversions"));n!=-1;n=v->tokens[n].next) {
        int from=field(v,n,"from"),to=field(v,n,"to"); double factor;
        if ((text_is(v,from,"m") && text_is(v,to,"mm")) || (text_is(v,from,"s") && text_is(v,to,"ms")) || (text_is(v,from,"m/s") && text_is(v,to,"mm/s")) || (text_is(v,from,"m/s^2") && text_is(v,to,"mm/s^2"))) factor=1000;
        else if (text_is(v,from,"mm") && text_is(v,to,"m")) factor=1.0/1000;
        else if (text_is(v,from,"deg") && text_is(v,to,"rad")) factor=pi/180;
        else if (text_is(v,from,"rad") && text_is(v,to,"deg")) factor=180/pi;
        else fail("UNIT_MISMATCH");
        close_number(number(v,field(v,n,"value"))*factor,number(v,field(v,n,"expected")));
    }
    for (int n=array(v,field(v,0,"transforms"));n!=-1;n=v->tokens[n].next) {
        frame(v,field(v,n,"siteFrame"),config_doc,site_frame);
        double p[3],origin[3],expected[3]; vector(v,field(v,n,"localMm"),p); vector(v,field(v,n,"translationMm"),origin); vector(v,field(v,n,"expectedSiteMm"),expected);
        double radians=number(v,field(v,n,"yawDeg"))*pi/180, c=cos(radians),s=sin(radians);
        close_number(origin[0]+c*p[0]-s*p[1],expected[0]); close_number(origin[1]+s*p[0]+c*p[1],expected[1]); close_number(origin[2]+p[2],expected[2]);
        double x=expected[0]-origin[0],y=expected[1]-origin[1];
        close_number(c*x+s*y,p[0]); close_number(-s*x+c*y,p[1]); close_number(expected[2]-origin[2],p[2]);
    }
    int workspace=field(config_doc,field(config_doc,config,"limits"),"workspace"); double min[3],max[3];
    vector(config_doc,field(config_doc,workspace,"minMm"),min); vector(config_doc,field(config_doc,workspace,"maxMm"),max);
    double uncertainty=number(config_doc,field(config_doc,cal,"uncertaintyMm")),move_position[3]; vector(messages,field(messages,body,"positionMm"),move_position);
    int motion_seen=0;
    for (int n=array(v,field(v,0,"geometry"));n!=-1;n=v->tokens[n].next) {
        frame(v,field(v,n,"siteFrame"),config_doc,site_frame); double p[3]; vector(v,field(v,n,"positionMm"),p);
        for (int i=0;i<3;i++) if (p[i]<min[i]+uncertainty || p[i]>max[i]-uncertainty) fail("GEOMETRY_MISMATCH");
        for (int line=0;line<4;line++) {
            double squared=0; for (int i=0;i<3;i++) { double delta=anchors[line][i]-p[i]; squared+=delta*delta; }
            close_number(squared,number(v,field(v,field(v,n,"expectedSquaredMm2"),lines[line])));
            close_number(sqrt(squared),number(v,field(v,field(v,n,"expectedLengthMm"),lines[line])));
            if (sqrt(squared)+offsets[line]<=uncertainty) fail("GEOMETRY_MISMATCH");
        }
        if (text_is(v,field(v,n,"id"),"motion-message")) {
            if (motion_seen++) fail("GEOMETRY_MISMATCH");
            for (int i=0;i<3;i++) if (p[i]!=move_position[i]) fail("GEOMETRY_MISMATCH");
        }
    }
    if (!motion_seen) fail("GEOMETRY_MISMATCH");
    for (int n=array(v,field(v,0,"offsets"));n!=-1;n=v->tokens[n].next) {
        double length=number(v,field(v,n,"geometricMm")),offset=number(v,field(v,n,"offsetMm"));
        if (length<=0 || length+offset<=0) fail("GEOMETRY_MISMATCH");
        close_number(length+offset,number(v,field(v,n,"expectedPayoutMm")));
    }
    const char *keys[]={"fixtureVersion","protocol","configurationSchema","configurationRevision","configurationDigest","geometryRevision","calibrationRevision"};
    int values[]={field(v,0,"fixtureVersion"),field(v,field(v,identity,"protocol"),"version"),field(v,field(v,identity,"configurationSchema"),"version"),field(v,identity,"configurationRevision"),field(v,identity,"configurationDigest"),field(v,identity,"geometryRevision"),field(v,identity,"calibrationRevision")};
    putchar('{'); for (int i=0;i<7;i++) { if (i) putchar(','); printf("\"%s\":",keys[i]); report_string(v,values[i]); } puts("}");
    free(v); free(config_doc); free(messages); return 0;
}
