# Capture custody and recovery evidence

Work record: [#61](https://github.com/gredice/arbi/issues/61), [decision](../decisions/0035-native-capture-custody-and-recovery.md), [guide](../software/capture-transfer.md).

Thirteen transfer/recovery groups exercise actual chunks/Ed25519/native custody/one logical debit; lost chunk/owner receipts and counted duplicate payload; bad signer/scope/epoch/corruption/conflicts; quota and acknowledged release; write/offset/rename/owner/ack cuts; retention intent/unlink/commit cuts; fresh epochs/clock/revoked authority; priority/rate/backoff/attempt/time/concurrency bounds; owner corruption; actual SIGKILL at nine native transfer/retention boundaries; signed historical audit/usage/diagnostic handoff with preserved clock gaps; lost/invalid/revoked/timed-out cursor receipts; and SIGKILL after edge cursor commit with fresh-epoch deduplication. Runtime attachment/stop/drain checks close storage only after bounded owners settle.

Actual #53 PNG/metadata and both app implementations drive the integration. Transport calls are explicitly in-process; they are not selected Wi-Fi, physical power loss or a public media endpoint. LAN application submission accounting, capture/processing/upload states and edge/cloud custody remain independent.

Clean source and the 64-fixture resource record are recorded after source commit.

| Physical/integration acceptance | Status |
| --- | --- |
| Actual Pi/camera/Wi-Fi/edge/storage revisions and named equipment | Unavailable; generic Linux fixtures only |
| Board power loss across writes/chunks/ownership/retention | Unavailable; actual SIGKILL and ordered fsync only |
| Sustained real captures/transfer/storage/mobile budgets/wireless interruptions | Unmeasured; bounded source reference only |
| Installed supervisor/confinement/hardware identity | Source lifecycle/restarts checked; selected image unavailable |
| Canonical cloud metadata after edge/WAN reconnection | Not delivered; #66 owns source forwarding, provider/field gate open |
| LAN/WAN/provider bytes | Submitted LAN payload measured; wireless/TLS/router/carrier overhead unavailable |

#61 remains open for named sustained/power/wireless/eventual-cloud acceptance. No real camera, private site data, public media grant, WAN upload or update trust change is enabled.
