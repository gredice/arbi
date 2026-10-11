#ifndef ARBI_DIAGNOSTICS_H
#define ARBI_DIAGNOSTICS_H
#include "motion.h"
#include "inputs.h"
#include "runtime.h"
#define DIAGNOSTIC_NORMAL_CAPACITY 16
#define DIAGNOSTIC_FAULT_CAPACITY 4
#define DIAGNOSTIC_PAGE_CAPACITY 4
#define DIAGNOSTIC_JSON_BYTES 8192
typedef enum { DIAG_ACCEPTED, DIAG_REJECTED, DIAG_COMPLETED, DIAG_ABORTED, DIAG_FAULT, DIAG_RESET } DiagnosticKind;
typedef struct {
  Identity source,target;
  MotionIdentity identity;
  char command[65],correlation[65];
  uint64_t sequence,monotonic_ms,command_sequence,fence,deadline_ms;
  DiagnosticKind kind;
  unsigned reason,faults;
  bool command_available,identity_available;
} DiagnosticRecord;
typedef struct {
  DiagnosticRecord normal[DIAGNOSTIC_NORMAL_CAPACITY],fault[DIAGNOSTIC_FAULT_CAPACITY];
  unsigned normal_head,normal_count,fault_head,fault_count;
  uint64_t next_sequence,dropped,dropped_through,decimated,last_snapshot_ms;
  bool snapshot_seen,exhausted;
  char boot[65];
} DiagnosticRing;
typedef struct {
  DiagnosticRecord records[DIAGNOSTIC_PAGE_CAPACITY];
  unsigned count;
  uint64_t cursor,dropped,dropped_through;
  bool gap,reset_boundary;
} DiagnosticPage;
struct LocalModel;
void diagnostics_reset(DiagnosticRing *ring,const char boot[65]);
bool diagnostics_append(DiagnosticRing *ring,const DiagnosticRecord *record);
bool diagnostics_page(const DiagnosticRing *ring,const char boot[65],uint64_t after,DiagnosticPage *page);
/* Single owner; render at most 10 Hz, no I/O or allocation. No export delay is
 * permitted to become a condition of fault inhibition or watchdog supervision. */
size_t diagnostics_snapshot(struct LocalModel *model,const InputsModel *inputs,uint64_t now_ms,char output[DIAGNOSTIC_JSON_BYTES]);
size_t diagnostics_outcome(const DiagnosticRecord *record,char output[DIAGNOSTIC_JSON_BYTES]);
size_t diagnostics_record_json(const DiagnosticRecord *record,char output[DIAGNOSTIC_JSON_BYTES]);
#endif
