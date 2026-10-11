# Capture custody and recovery evidence

Work record: [#61](https://github.com/gredice/arbi/issues/61), [decision](../decisions/0035-native-capture-custody-and-recovery.md), [guide](../software/capture-transfer.md).

Thirteen transfer/recovery groups exercise actual chunks/Ed25519/native custody/one logical debit; lost chunk/owner receipts and counted duplicate payload; bad signer/scope/epoch/corruption/conflicts; quota and acknowledged release; write/offset/rename/owner/ack cuts; retention intent/unlink/commit cuts; fresh epochs/clock/revoked authority; priority/rate/backoff/attempt/time/concurrency bounds; owner corruption; actual SIGKILL at nine native transfer/retention boundaries; signed historical audit/usage/diagnostic handoff with preserved clock gaps; lost/invalid/revoked/timed-out cursor receipts; and SIGKILL after edge cursor commit with fresh-epoch deduplication. Runtime attachment/stop/drain checks close storage only after bounded owners settle.

Actual #53 PNG/metadata and both app implementations drive the integration. Transport calls are explicitly in-process; they are not selected Wi-Fi, physical power loss or a public media endpoint. LAN application submission accounting, capture/processing/upload states and edge/cloud custody remain independent.

Clean source `f7ea0badb5f910aaa297493404f07181994c9153` reports `dirty=false`. All 42 pod tests pass, including thirteen transfer/cursor groups, ten captures, eight gimbal checks and eleven health/runtime groups. The scoped edge suite passes 27 tests; the protocol suite passes 464 including independent cross-runtime references. TypeScript lint/typecheck/build, script syntax, 325-document links and whitespace pass. The existing Linux service check is excluded locally because `/usr/bin/node` is absent; CI stages it. The local package manager's unnecessary manifest-triggered reinstall hit registry timeouts; the successful clean checks use the already frozen dependencies with dependency auto-install disabled for that invocation. Dependency versions are unchanged.

The clean named source reference uses Linux x64 kernel 6.18.44, Node 24.19.0, AMD EPYC 9V74 and five exposed logical CPUs. It repersists/transfers/releases 64 copies of the 32×24, 120-byte raw fixture under 128-row/1-MiB payload policies. Total elapsed time is 1,936.3 ms; process CPU is 1,980.8 ms user/114.8 ms system. Transfer-plus-release samples range from 8.53 to 18.48 ms, excluding the preceding fixture repersistence. RSS begins at 141,299,712 bytes and reaches an after-each-fixture sampled peak of 164,061,184 bytes; that sampling can miss shorter peaks and includes both owners in one process.

Pod files total 475,136 bytes and edge files 302,592 bytes, including databases/locks/usage data. Pod retained payload is zero with 64 immutable released tombstones. Edge has 64 verified owners, 7,680 reserved payload bytes, no incomplete/corrupt records and no WAN upload. Both logical new-ownership bytes and submitted application payload total 7,680; usage retains 64 terminal records, no active/lost intervals and no degraded state. The reference creates no real camera actions or network interface traffic. Selected-host, physical Wi-Fi/power and cloud metadata acceptance remain false.

| Physical/integration acceptance | Status |
| --- | --- |
| Actual Pi/camera/Wi-Fi/edge/storage revisions and named equipment | Unavailable; generic Linux fixtures only |
| Board power loss across writes/chunks/ownership/retention | Unavailable; actual SIGKILL and ordered fsync only |
| Sustained real captures/transfer/storage/mobile budgets/wireless interruptions | Unmeasured; bounded source reference only |
| Installed supervisor/confinement/hardware identity | Source lifecycle/restarts checked; selected image unavailable |
| Canonical cloud metadata after edge/WAN reconnection | Not delivered; #66 owns source forwarding, provider/field gate open |
| LAN/WAN/provider bytes | Submitted LAN payload measured; wireless/TLS/router/carrier overhead unavailable |

#61 remains open for named sustained/power/wireless/eventual-cloud acceptance. No real camera, private site data, public media grant, WAN upload or update trust change is enabled.

Review hardening at clean source `fdebe23e06482b2a0a7f76ce835167c71a3e7954` passes all 44 pod tests and all 16 selected build/lint/typecheck tasks. Two additional regressions reject chunk policies unable to finish the largest accepted store image within cumulative attempts, verify rate pauses consume no attempts (including equality at the final successful attempt), and send a healthy 220-ms cursor sequence across the one-second admission deadline without quarantining it. Transport timeouts remain independently bounded and quarantined; a flush may finish its already admitted final send after the batch deadline. This is source/native-process evidence, not physical link timing.
